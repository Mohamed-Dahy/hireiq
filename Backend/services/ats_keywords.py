"""
ats_keywords.py
---------------
AI-assisted keyword coverage for the ATS Check when a job description is
supplied (spec 003, US3 / FR-017–019, FR-028).

Extracts the important role keywords from the JD and splits them into those
present in the CV (matched) vs. absent (missing), via the LLM.

This is a NON-CRITICAL dependency: any failure — LLM error, network hang, bad
JSON — returns ``{"available": False}`` so the deterministic ATS score is still
returned and the run is not charged. No exception escapes, and the call is
bounded by a hard timeout so it can never hang the upload request.
"""

from __future__ import annotations

import json
import logging
import re
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout

from langchain_groq import ChatGroq
from langchain_core.output_parsers import StrOutputParser

from app.config import settings
from rag.prompts import ats_keyword_prompt

logger = logging.getLogger(__name__)

# Bounded, low-temperature, non-streaming call. max_retries=0 so a failure fails
# fast rather than retrying inside the (already timeout-bounded) upload request.
_llm = ChatGroq(
    model=settings.llm_model,
    api_key=settings.groq_api_key,
    temperature=0.0,
    streaming=False,
    max_retries=0,
)
_chain = ats_keyword_prompt | _llm | StrOutputParser()

_TIMEOUT_SECONDS = getattr(settings, "ats_keyword_timeout_seconds", 20)
_executor = ThreadPoolExecutor(max_workers=2)


def _strip_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


def _unavailable() -> dict:
    return {"matched": [], "missing": [], "available": False}


def compute_keyword_coverage(cv_text: str, jd_text: str) -> dict:
    """
    Return {"matched": [...], "missing": [...], "available": True} on success,
    or {"matched": [], "missing": [], "available": False} on any failure/timeout.
    Never raises.
    """
    if not (cv_text and jd_text and jd_text.strip()):
        return _unavailable()

    try:
        future = _executor.submit(
            _chain.invoke, {"cv_text": cv_text[:6000], "jd_text": jd_text[:4000]}
        )
        raw = future.result(timeout=_TIMEOUT_SECONDS)
        data = json.loads(_strip_fences(raw))
        matched = [str(x).strip() for x in data.get("matched", []) if str(x).strip()][:40]
        missing = [str(x).strip() for x in data.get("missing", []) if str(x).strip()][:40]
        return {"matched": matched, "missing": missing, "available": True}
    except FutureTimeout:
        logger.warning("ATS keyword coverage timed out after %ss", _TIMEOUT_SECONDS)
        return _unavailable()
    except Exception:
        logger.exception("ATS keyword coverage failed")
        return _unavailable()
