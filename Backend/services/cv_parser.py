"""
cv_parser.py
------------
Step 1: extract raw text from a PDF CV using PyMuPDF.
Step 2: run spaCy NER to pull out named entities (orgs, dates, etc.).

We keep skills extraction simple for now — just a keyword match against
a small built-in list. We will expand this with a proper spaCy pipeline later.
"""

import fitz  # PyMuPDF — reads PDF pages
import spacy

_nlp = None

def _get_nlp():
    global _nlp
    if _nlp is None:
        _nlp = spacy.load("en_core_web_sm")
    return _nlp

# Basic skill keywords — we will grow this list or replace with a spaCy EntityRuler
COMMON_SKILLS = [
    "python", "javascript", "typescript", "react", "fastapi", "django",
    "sql", "postgresql", "docker", "git", "aws", "machine learning",
    "deep learning", "pytorch", "tensorflow", "pandas", "numpy",
]


def extract_text_from_pdf(file_path: str) -> str:
    """Read every page of a PDF and return all text as one string."""
    doc = fitz.open(file_path)
    pages_text = [page.get_text() for page in doc]
    doc.close()
    return "\n".join(pages_text)


def extract_entities(text: str) -> dict:
    """
    Run spaCy over the CV text and return a structured dict with:
    - skills      : keywords found in COMMON_SKILLS list
    - job_titles  : person titles spaCy tagged as ORG/PERSON context
    - orgs        : companies / schools detected by spaCy
    - dates       : years / date ranges (for experience calculation later)
    """
    doc = _get_nlp()(text)
    lower_text = text.lower()

    skills_found = [skill for skill in COMMON_SKILLS if skill in lower_text]

    orgs = list({ent.text.strip() for ent in doc.ents if ent.label_ == "ORG"})
    dates = list({ent.text.strip() for ent in doc.ents if ent.label_ == "DATE"})

    return {
        "skills": skills_found,
        "orgs": orgs,
        "dates": dates,
    }


def parse_cv(file_path: str) -> dict:
    """
    Main entry point — call this from the router.
    Returns raw text + extracted entities in one dict.
    """
    raw_text = extract_text_from_pdf(file_path)
    entities = extract_entities(raw_text)

    return {
        "raw_text": raw_text,
        **entities,  # skills, orgs, dates merged in at the top level
    }
