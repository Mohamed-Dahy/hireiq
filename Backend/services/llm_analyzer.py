"""
llm_analyzer.py
---------------
LangChain chain → Groq llama-3.1-70b → skill gap analysis + interview questions.
Supports both streaming (SSE) and non-streaming responses.
"""

from langchain_groq import ChatGroq
from langchain_core.output_parsers import StrOutputParser

from app.config import settings
from rag.prompts import skill_gap_prompt

# LLM — Groq free tier (100k tokens/day)
llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    api_key=settings.groq_api_key,
    temperature=0.5,
    streaming=True,
)

# Chain: prompt → LLM → plain string output
analysis_chain = skill_gap_prompt | llm | StrOutputParser()


def stream_analysis(cv_text: str, jd_text: str):
    """
    Generator that streams the LLM response token by token.
    Used by the SSE endpoint — yields chunks as they arrive from Groq.
    """
    for chunk in analysis_chain.stream({"cv_text": cv_text, "jd_text": jd_text}):
        yield chunk


def run_analysis(cv_text: str, jd_text: str) -> str:
    """
    Non-streaming version — returns the full response as one string.
    Useful for caching or background tasks.
    """
    return analysis_chain.invoke({"cv_text": cv_text, "jd_text": jd_text})
