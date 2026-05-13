"""
rag_scorer.py
-------------
Scores how well a CV matches a job description using two signals:

1. Semantic score  — embed both texts with sentence-transformers (local, free)
2. Keyword score   — TF-IDF overlap using scikit-learn

Raw cosine similarity for CV/JD pairs (cross-domain text) typically ranges
0.35 (no match) to 0.85 (excellent match), not 0–1. Multiplying raw cosine
by 100 therefore caps "perfect" matches at ~75%. We apply a sigmoid
calibration to map the realistic range into a user-meaningful 0–100 score.

Final score = sigmoid(0.7 * semantic + 0.3 * keyword)  →  0–100 range
"""

import math

from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import chromadb
import numpy as np

from app.config import settings

# ---------------------------------------------------------------------------
# Lazy globals — None until first use, then loaded once and reused
# ---------------------------------------------------------------------------

_embedder = None
_chroma_client = None
_collection = None


def _get_embedder() -> SentenceTransformer:
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer(settings.embedding_model)
    return _embedder


def _get_collection():
    global _chroma_client, _collection
    if _collection is None:
        _chroma_client = chromadb.Client()
        _collection = _chroma_client.get_or_create_collection(name="cv_jd_embeddings")
    return _collection


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _embed(text: str) -> list[float]:
    return _get_embedder().encode(text).tolist()


def _semantic_score(cv_text: str, jd_text: str) -> float:
    embedder = _get_embedder()
    cv_vec = embedder.encode(cv_text)
    jd_vec = embedder.encode(jd_text)
    dot = np.dot(cv_vec, jd_vec)
    norm = np.linalg.norm(cv_vec) * np.linalg.norm(jd_vec)
    return float(dot / norm) if norm > 0 else 0.0


def _keyword_score(cv_text: str, jd_text: str) -> float:
    vectorizer = TfidfVectorizer(stop_words="english")
    tfidf_matrix = vectorizer.fit_transform([cv_text, jd_text])
    return float(cosine_similarity(tfidf_matrix[0], tfidf_matrix[1])[0][0])


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def store_embeddings(session_id: int, cv_text: str, jd_text: str) -> None:
    _get_collection().upsert(
        ids=[f"cv_{session_id}", f"jd_{session_id}"],
        documents=[cv_text, jd_text],
        embeddings=[_embed(cv_text), _embed(jd_text)],
    )


def _sigmoid_calibrate(raw: float, center: float = 0.42, steepness: float = 9.0) -> float:
    """
    Applies a sigmoid curve so that typical cross-domain cosine similarities
    (CV vs JD, range ~0.35–0.85) map to user-meaningful percentages.
    center=0.42 → a weak match becomes ~50%; steepness=9 → sharp spread.
    """
    return 1.0 / (1.0 + math.exp(-steepness * (raw - center)))


def compute_match_score(cv_text: str, jd_text: str) -> float:
    semantic = _semantic_score(cv_text, jd_text)
    keyword  = _keyword_score(cv_text, jd_text)
    # Weighted combination of raw cosine signals, then calibrate via sigmoid
    raw_combined = (0.7 * semantic) + (0.3 * keyword)
    calibrated   = _sigmoid_calibrate(raw_combined)
    return round(min(max(calibrated * 100, 0.0), 100.0), 2)


def delete_embeddings(session_id: int) -> None:
    try:
        _get_collection().delete(ids=[f"cv_{session_id}", f"jd_{session_id}"])
    except Exception:
        pass
