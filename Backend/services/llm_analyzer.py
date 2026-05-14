"""
llm_analyzer.py
---------------
LangChain chain → Groq llama-3.3-70b → skill gap analysis + interview questions.
Supports streaming (SSE) and structured non-streaming JSON responses.
"""

import json
import re

from langchain_groq import ChatGroq
from langchain_core.output_parsers import StrOutputParser

from app.config import settings
from rag.prompts import skill_gap_prompt, structured_analysis_prompt

# Streaming LLM for the SSE narrative analysis
llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    api_key=settings.groq_api_key,
    temperature=0.5,
    streaming=True,
)

# Non-streaming LLM for structured JSON output (lower temperature for determinism)
_structured_llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    api_key=settings.groq_api_key,
    temperature=0.1,
    streaming=False,
)

analysis_chain = skill_gap_prompt | llm | StrOutputParser()
structured_chain = structured_analysis_prompt | _structured_llm | StrOutputParser()

_FALLBACK: dict = {
    "skill_inventory": [],
    "gap_report": [],
    "questions": [],
}


def _strip_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


def stream_analysis(cv_text: str, jd_text: str):
    """Generator that streams the LLM response token by token for the SSE endpoint."""
    try:
        for chunk in analysis_chain.stream({"cv_text": cv_text, "jd_text": jd_text}):
            yield chunk
    except Exception as exc:
        err_str = str(exc)
        if "rate_limit" in err_str.lower() or "429" in err_str:
            yield "\n\n**Service temporarily unavailable:** The AI analysis quota has been reached. Please try again in a few minutes.\n"
        else:
            yield "\n\n**Analysis error:** Could not complete the analysis. Please try again.\n"


def run_analysis(cv_text: str, jd_text: str) -> str:
    """Non-streaming narrative analysis — full string, used by report generator."""
    return analysis_chain.invoke({"cv_text": cv_text, "jd_text": jd_text})


def analyze_structured(cv_text: str, jd_text: str) -> dict:
    """
    Returns structured JSON analysis as a dict.
    Never raises — returns empty lists on any LLM or parse error.
    """
    try:
        raw = structured_chain.invoke({"cv_text": cv_text, "jd_text": jd_text})
        raw = _strip_fences(raw)
        data = json.loads(raw)
        # Ensure required keys exist even if LLM omits them
        data.setdefault("skill_inventory", [])
        data.setdefault("gap_report", [])
        data.setdefault("questions", [])
        return data
    except Exception:
        return dict(_FALLBACK)
