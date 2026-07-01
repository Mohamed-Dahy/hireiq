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


def extract_layout_signals(file_path: str) -> dict:
    """
    Extract structural/layout signals from a PDF for the deterministic ATS engine.

    Returns measurable signals only (no scoring/interpretation — that lives in
    services/ats_checker.py). Defensive: any per-page failure is skipped so a
    malformed PDF still yields a usable (low) signal set rather than raising.

    Keys: page_count, total_chars, chars_per_page, image_count, fonts,
    link_count, multi_column, table_like, header_footer_text, non_ascii_ratio.
    """
    signals = {
        "page_count": 0,
        "total_chars": 0,
        "chars_per_page": [],
        "image_count": 0,
        "fonts": [],
        "link_count": 0,
        "multi_column": False,
        "table_like": False,
        "header_footer_text": "",
        "non_ascii_ratio": 0.0,
    }

    try:
        doc = fitz.open(file_path)
    except Exception:
        return signals

    fonts: set[str] = set()
    header_footer_parts: list[str] = []
    multi_col_pages = 0
    full_text_parts: list[str] = []

    try:
        for page in doc:
            text = page.get_text() or ""
            full_text_parts.append(text)
            signals["chars_per_page"].append(len(text.strip()))

            try:
                signals["image_count"] += len(page.get_images(full=True))
            except Exception:
                pass
            try:
                signals["link_count"] += len(page.get_links())
            except Exception:
                pass
            try:
                for f in page.get_fonts(full=True):
                    # font tuple: (xref, ext, type, basefont, name, encoding)
                    if len(f) >= 4 and f[3]:
                        fonts.add(str(f[3]))
            except Exception:
                pass

            # Block geometry → multi-column heuristic + header/footer zones
            try:
                blocks = page.get_text("blocks") or []
                page_h = page.rect.height or 1.0
                page_w = page.rect.width or 1.0
                mid_x = page_w * 0.5
                text_blocks = [b for b in blocks if len(b) >= 6 and isinstance(b[4], str) and b[4].strip()]
                if text_blocks:
                    right_start = sum(1 for b in text_blocks if b[0] > mid_x)
                    if right_start / len(text_blocks) >= 0.35:
                        multi_col_pages += 1
                for b in text_blocks:
                    y0 = b[1]
                    if y0 < page_h * 0.08 or y0 > page_h * 0.92:
                        header_footer_parts.append(b[4].strip())
            except Exception:
                pass
    finally:
        doc.close()

    full_text = "\n".join(full_text_parts)
    signals["page_count"] = len(signals["chars_per_page"])
    signals["total_chars"] = len(full_text.strip())
    signals["fonts"] = sorted(fonts)
    signals["multi_column"] = multi_col_pages > 0
    signals["header_footer_text"] = "\n".join(header_footer_parts)[:2000]

    if full_text:
        _ALLOWED = set("•·–—’‘“”…€£°%&/\\@#")
        non_ascii = sum(1 for c in full_text if ord(c) > 127 and c not in _ALLOWED)
        signals["non_ascii_ratio"] = round(non_ascii / max(len(full_text), 1), 4)

    return signals


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
