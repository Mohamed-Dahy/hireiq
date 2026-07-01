"""
sample_cvs.py
-------------
Text + layout-signal fixtures for the deterministic ATS engine
(`services.ats_checker`). The engine is driven by extracted text and a
`signals` dict (produced in production by `cv_parser.extract_layout_signals`),
so these fixtures exercise it without needing binary PDFs on disk.

Each fixture is a `(text, signals)` pair. `make_signals` builds a sane default
signal set so individual tests only override what they care about.
"""

from __future__ import annotations


def make_signals(**overrides) -> dict:
    """Default 'healthy single-column CV' signal set; override per test."""
    base = {
        "page_count": 1,
        "total_chars": 1800,
        "chars_per_page": [1800],
        "image_count": 0,
        "fonts": ["Helvetica", "Arial"],
        "link_count": 1,
        "multi_column": False,
        "table_like": False,
        "header_footer_text": "",
        "non_ascii_ratio": 0.0,
    }
    base.update(overrides)
    return base


# A clean, well-structured, single-column CV with standard headings.
CLEAN_CV_TEXT = """John Smith
john.smith@example.com | +1 555 123 4567 | New York, NY

Summary
Senior backend engineer with 7 years building scalable services.

Experience
Senior Software Engineer, Acme Corp — Jan 2019 - Present
- Led migration that reduced latency by 40% across 12 services.
- Built and shipped a payments API handling 2M requests/day.

Software Engineer, Beta Inc — Jun 2016 - Dec 2018
- Developed and maintained REST APIs in Python and Go.
- Improved test coverage from 45% to 90%.

Education
B.Sc. Computer Science, State University — 2012 - 2016

Skills
Python, Go, PostgreSQL, Docker, Kubernetes, FastAPI, Redis
"""

CLEAN_CV = (CLEAN_CV_TEXT, make_signals(total_chars=len(CLEAN_CV_TEXT), chars_per_page=[len(CLEAN_CV_TEXT)]))


# A CV missing the Skills section and missing a phone number.
MISSING_SKILLS_CV_TEXT = """Jane Doe
jane.doe@example.com

Experience
Marketing Associate, Gamma LLC — 2019 - Present
- Managed social media campaigns.

Education
B.A. Communications, City College — 2015 - 2019
"""

MISSING_SKILLS_CV = (
    MISSING_SKILLS_CV_TEXT,
    make_signals(total_chars=len(MISSING_SKILLS_CV_TEXT), chars_per_page=[len(MISSING_SKILLS_CV_TEXT)]),
)


# Image-only / scanned CV: almost no extractable text, an image present.
IMAGE_ONLY_CV_TEXT = "  \n  "
IMAGE_ONLY_CV = (
    IMAGE_ONLY_CV_TEXT,
    make_signals(total_chars=len(IMAGE_ONLY_CV_TEXT.strip()), chars_per_page=[3], image_count=1),
)


# A CV using NON-standard section headings ("My Journey" instead of "Experience",
# "What I Know" instead of "Skills") plus decorative glyphs and an exotic font.
NONSTANDARD_HEADINGS_CV_TEXT = """Maria García
maria.garcia@example.com | +34 600 000 000

★ My Journey ★
Product Designer, Delta — 2018 - Present
◆ Crafted delightful experiences for millions of users.

What I Know
Figma, Sketch, Prototyping, User Research

Where I Studied
B.Des Visual Design, Art Institute — 2014 - 2018
"""

NONSTANDARD_HEADINGS_CV = (
    NONSTANDARD_HEADINGS_CV_TEXT,
    make_signals(
        total_chars=len(NONSTANDARD_HEADINGS_CV_TEXT),
        chars_per_page=[len(NONSTANDARD_HEADINGS_CV_TEXT)],
        fonts=["Comic Sans MS", "Brush Script MT"],
        non_ascii_ratio=0.04,
    ),
)


# A deliberately WEAK CV: no standard section headings, no metrics, no phone,
# decorative glyphs, no dates. Used for the score-discrimination test (SC-013).
WEAK_CV_TEXT = """Jane Doe
jane.doe@example.com

About Me
I have worked at a few companies and helped with various tasks over the years.

★ My Journey ★
Did some work. Helped the team. Was responsible for things and other duties.
"""

WEAK_CV = (
    WEAK_CV_TEXT,
    make_signals(
        total_chars=len(WEAK_CV_TEXT),
        chars_per_page=[len(WEAK_CV_TEXT)],
        non_ascii_ratio=0.03,
    ),
)


# A CV whose only "quantified" tokens are bare calendar years, and no phone —
# used to prove the recalibrated detection no longer gives false passes (SC-016).
YEARS_ONLY_CV_TEXT = """Bob Lee
bob.lee@example.com

Experience
Analyst, Contoso — 2016 2018 2020
Worked on reports and analysis.

Education
B.A. Economics — 2012 2016

Skills
Excel, PowerPoint
"""

YEARS_ONLY_CV = (
    YEARS_ONLY_CV_TEXT,
    make_signals(total_chars=len(YEARS_ONLY_CV_TEXT), chars_per_page=[len(YEARS_ONLY_CV_TEXT)]),
)
