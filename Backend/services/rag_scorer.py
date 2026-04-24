"""
rag_scorer.py
-------------
Scores how well a CV matches a job description using two signals:

1. Semantic score  — embed both texts with sentence-transformers (local, free)
2. Keyword score   — TF-IDF overlap using scikit-learn

Final score = 70% semantic + 30% keyword  →  0–100 range

Model is loaded lazily — only on the first scoring request, not at server startup.
"""

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


def compute_match_score(cv_text: str, jd_text: str) -> float:
    semantic = _semantic_score(cv_text, jd_text)
    keyword  = _keyword_score(cv_text, jd_text)
    combined = (0.7 * semantic) + (0.3 * keyword)
    return round(min(max(combined * 100, 0.0), 100.0), 2)


def delete_embeddings(session_id: int) -> None:
    try:
        _get_collection().delete(ids=[f"cv_{session_id}", f"jd_{session_id}"])
    except Exception:
        pass
