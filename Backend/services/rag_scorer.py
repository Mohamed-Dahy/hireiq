"""
rag_scorer.py
-------------
Scores how well a CV matches a job description using two signals:

1. Semantic score  — embed both texts with sentence-transformers (local, free)
                     then compute cosine similarity via ChromaDB
2. Keyword score   — TF-IDF overlap using scikit-learn

Final score = 70% semantic + 30% keyword  →  0–100 range
"""

from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import chromadb
import numpy as np

from app.config import settings

# ---------------------------------------------------------------------------
# Model + ChromaDB — loaded once when the module is first imported
# ---------------------------------------------------------------------------

embedder = SentenceTransformer(settings.embedding_model)

# ChromaDB runs in-memory for now; swap path= for persistence later
chroma_client = chromadb.Client()
collection = chroma_client.get_or_create_collection(name="cv_jd_embeddings")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _embed(text: str) -> list[float]:
    """Turn a text string into a vector using all-MiniLM-L6-v2."""
    return embedder.encode(text).tolist()


def _semantic_score(cv_text: str, jd_text: str) -> float:
    """Cosine similarity between CV and JD embeddings → 0.0–1.0."""
    cv_vec = embedder.encode(cv_text)
    jd_vec = embedder.encode(jd_text)

    # numpy cosine similarity
    dot = np.dot(cv_vec, jd_vec)
    norm = np.linalg.norm(cv_vec) * np.linalg.norm(jd_vec)
    return float(dot / norm) if norm > 0 else 0.0


def _keyword_score(cv_text: str, jd_text: str) -> float:
    """TF-IDF cosine overlap between CV and JD → 0.0–1.0."""
    vectorizer = TfidfVectorizer(stop_words="english")
    tfidf_matrix = vectorizer.fit_transform([cv_text, jd_text])
    score = cosine_similarity(tfidf_matrix[0], tfidf_matrix[1])
    return float(score[0][0])


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def store_embeddings(session_id: int, cv_text: str, jd_text: str) -> None:
    """
    Embed CV and JD texts and store them in ChromaDB under this session.
    Call this once after a CV is uploaded so we can reuse embeddings later.
    """
    collection.upsert(
        ids=[f"cv_{session_id}", f"jd_{session_id}"],
        documents=[cv_text, jd_text],
        embeddings=[_embed(cv_text), _embed(jd_text)],
    )


def compute_match_score(cv_text: str, jd_text: str) -> float:
    """
    Main entry point — returns a 0–100 match score.

    Weights:
      70% semantic similarity (sentence-transformers cosine)
      30% keyword overlap    (TF-IDF cosine)
    """
    semantic = _semantic_score(cv_text, jd_text)
    keyword  = _keyword_score(cv_text, jd_text)

    combined = (0.7 * semantic) + (0.3 * keyword)

    # Convert 0.0–1.0 → 0–100, clamped to valid range
    return round(min(max(combined * 100, 0.0), 100.0), 2)
