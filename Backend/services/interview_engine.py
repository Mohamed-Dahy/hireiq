"""
interview_engine.py
-------------------
Step 1: Transcribe audio with Groq Whisper (whisper-large-v3).
Step 2: Score the transcript with LLaMA 3 — returns clarity, relevance,
        depth (each 0–10) and a short feedback string.
"""

import json
from groq import Groq
from app.config import settings

_client = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=settings.groq_api_key)
    return _client


def transcribe_audio(audio_bytes: bytes, filename: str = "answer.webm") -> str:
    """Send audio bytes to Groq Whisper and return the transcript text."""
    client = _get_client()
    transcription = client.audio.transcriptions.create(
        model="whisper-large-v3",
        file=(filename, audio_bytes, "audio/webm"),
        response_format="text",
    )
    return transcription.strip()


_SCORE_PROMPT = """\
You are an expert interviewer evaluating a candidate's spoken answer.

Question asked:
{question}

Candidate's transcript:
{transcript}

Score the answer on three dimensions (each 0–10):
- clarity    : how clear, structured, and easy to follow the answer is
- relevance  : how directly the answer addresses the question
- depth      : how detailed, insightful, and technically strong the answer is

Also write one short sentence of actionable feedback (max 20 words).

Respond with ONLY valid JSON — no markdown, no extra text:
{{"clarity": <int>, "relevance": <int>, "depth": <int>, "feedback": "<string>"}}
"""


def score_answer(question: str, transcript: str) -> dict:
    """
    Ask LLaMA 3 to score a transcript and return a dict with:
    clarity, relevance, depth (ints 0-10) and feedback (str).
    Falls back to zeros if JSON parsing fails.
    """
    client = _get_client()
    prompt = _SCORE_PROMPT.format(question=question, transcript=transcript)

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=120,
    )

    raw = response.choices[0].message.content.strip()

    try:
        data = json.loads(raw)
        return {
            "clarity":   min(max(int(data.get("clarity",  0)), 0), 10),
            "relevance": min(max(int(data.get("relevance", 0)), 0), 10),
            "depth":     min(max(int(data.get("depth",     0)), 0), 10),
            "feedback":  str(data.get("feedback", "")),
        }
    except (json.JSONDecodeError, KeyError, ValueError):
        return {"clarity": 0, "relevance": 0, "depth": 0, "feedback": raw}
