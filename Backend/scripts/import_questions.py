"""
Standalone import script for interview questions.
Run via: docker compose exec backend python scripts/import_questions.py
"""
import sys
import os
import csv
import json
import hashlib
import re
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models.content import InterviewQuestion
from sqlalchemy.dialects.postgresql import insert as pg_insert

DATA_DIR = Path(__file__).parent.parent / "data" / "questions"

DIFFICULTY_MAP = {
    "easy": "junior",
    "medium": "mid",
    "hard": "senior",
}

# Emoji → difficulty level (dataset_Datascience.csv uses these in question text)
EMOJI_LEVEL_MAP = {
    "👶": "junior",
    "⭐": "mid",
    "🤔": "senior",
}

CSV_FILE_CONFIG = {
    "Software Questions.csv": {
        "role": "Software Engineer",
        "source": "kaggle_csv",
        "question_col": "Question",
        "answer_col": "Answer",
        "category_col": "Category",
        "difficulty_col": "Difficulty",
        "encoding": "cp1252",
    },
    "DataScienceBasics_QandA - Sheet1.csv": {
        "role": "Data Scientist",
        "source": "ds_basics_csv",
        "question_col": "Question",
        "answer_col": "Answer",
        "fixed_category": "ds_fundamentals",
        "fixed_level": "junior",
        "encoding": "utf-8-sig",
    },
    "dataset_Datascience.csv": {
        "role": "Data Scientist",
        "source": "ds_kaggle_csv",
        "question_col": "question",
        "answer_col": "answer",
        "fixed_category": "data_science",
        "emoji_level": True,
        "encoding": "utf-8-sig",
    },
}

JSON_FILE_CONFIG = {
    "behavioral_hr.json": {
        "role": "All Roles",
        "source": "behavioral_pdf",
        "level": "all",
    }
}


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def content_hash(question_text: str) -> str:
    return hashlib.sha256(normalize(question_text).encode()).hexdigest()


def truncate_category(category: str, max_len: int = 30) -> str:
    cat = re.sub(r"\s+", "_", category.strip().lower())
    cat = re.sub(r"[^a-z0-9_]", "", cat)
    return cat[:max_len]


def infer_level(difficulty: str) -> str:
    return DIFFICULTY_MAP.get(difficulty.strip().lower(), "mid")


def extract_emoji_level(question_text: str) -> tuple[str, str]:
    """Strip trailing emoji from question text and return (clean_text, level)."""
    for emoji, level in EMOJI_LEVEL_MAP.items():
        if emoji in question_text:
            clean = question_text.replace(emoji, "").strip()
            return clean, level
    return question_text, "mid"


def process_csv(filepath: Path, config: dict) -> list[dict]:
    rows = []
    with open(filepath, encoding=config.get("encoding", "utf-8-sig"), errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            q = (row.get(config["question_col"]) or "").strip()
            a = (row.get(config["answer_col"]) or "").strip()
            if not q or not a:
                continue

            # Level determination
            if config.get("emoji_level"):
                q, level = extract_emoji_level(q)
            elif config.get("fixed_level"):
                level = config["fixed_level"]
            else:
                diff_raw = (row.get(config.get("difficulty_col", ""), "") or "medium").strip()
                level = infer_level(diff_raw)

            # Category determination
            if config.get("fixed_category"):
                category = config["fixed_category"]
            else:
                cat_raw = (row.get(config.get("category_col", ""), "") or "general_programming").strip()
                category = truncate_category(cat_raw)

            rows.append({
                "role": config["role"],
                "level": level,
                "category": category,
                "question_text": q,
                "model_answer": a,
                "source": config["source"],
                "content_hash": content_hash(q),
            })
    return rows


def process_json(filepath: Path, config: dict) -> list[dict]:
    with open(filepath, encoding="utf-8") as f:
        data = json.load(f)
    rows = []
    for item in data:
        q = (item.get("question") or "").strip()
        a = (item.get("answer") or "").strip()
        if not q or not a:
            continue
        cat_raw = item.get("category", "behavioral")
        diff_raw = item.get("difficulty", "medium")
        rows.append({
            "role": config["role"],
            "level": config.get("level") or infer_level(diff_raw),
            "category": truncate_category(cat_raw),
            "question_text": q,
            "model_answer": a,
            "source": config["source"],
            "content_hash": content_hash(q),
        })
    return rows


def upsert_rows(db, rows: list[dict]) -> tuple[int, int, int]:
    inserted = 0
    skipped = 0
    rejected = 0
    for row in rows:
        if not row["question_text"] or not row["model_answer"]:
            rejected += 1
            continue
        stmt = (
            pg_insert(InterviewQuestion)
            .values(**row)
            .on_conflict_do_nothing(index_elements=["content_hash"])
        )
        result = db.execute(stmt)
        if result.rowcount > 0:
            inserted += 1
        else:
            skipped += 1
    db.commit()
    return inserted, skipped, rejected


def main():
    db = SessionLocal()
    total_processed = 0
    total_inserted = 0
    total_skipped = 0
    total_rejected = 0

    try:
        for filename, config in CSV_FILE_CONFIG.items():
            filepath = DATA_DIR / filename
            if not filepath.exists():
                print(f"[SKIP] {filename} not found at {filepath}")
                continue
            print(f"[CSV] Processing {filename}...")
            rows = process_csv(filepath, config)
            ins, skip, rej = upsert_rows(db, rows)
            total_processed += len(rows)
            total_inserted += ins
            total_skipped += skip
            total_rejected += rej
            print(f"       {len(rows)} rows → inserted={ins}, skipped={skip}, rejected={rej}")

        for filename, config in JSON_FILE_CONFIG.items():
            filepath = DATA_DIR / filename
            if not filepath.exists():
                print(f"[SKIP] {filename} not found at {filepath}")
                continue
            print(f"[JSON] Processing {filename}...")
            rows = process_json(filepath, config)
            ins, skip, rej = upsert_rows(db, rows)
            total_processed += len(rows)
            total_inserted += ins
            total_skipped += skip
            total_rejected += rej
            print(f"       {len(rows)} rows → inserted={ins}, skipped={skip}, rejected={rej}")

        print(
            f"\nDone. Processed {total_processed} rows. "
            f"Inserted {total_inserted}. "
            f"Skipped {total_skipped} duplicates. "
            f"Rejected {total_rejected} (missing fields)."
        )

        count = db.query(InterviewQuestion).count()
        print(f"Total questions in DB: {count}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
