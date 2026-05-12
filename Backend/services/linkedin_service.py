"""
linkedin_service.py
-------------------
Detects whether an uploaded PDF was exported from LinkedIn.
LinkedIn exports have a distinctive "LinkedIn" header visible in page text.
"""

import fitz  # PyMuPDF


def is_linkedin_pdf(file_bytes: bytes) -> bool:
    """
    Return True if the PDF appears to be a LinkedIn profile export.
    Checks the first two pages for the string "linkedin" (case-insensitive).
    Returns False on any parse error.
    """
    try:
        with fitz.open(stream=file_bytes, filetype="pdf") as doc:
            for i, page in enumerate(doc):
                if i >= 2:
                    break
                text = page.get_text().lower()
                if "linkedin" in text:
                    return True
    except Exception:
        pass
    return False
