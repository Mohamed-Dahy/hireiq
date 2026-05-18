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

CSV_FILE_CONFIG = {
    "Software Questions.csv": {
        "role": "Software Engineer",
        "source": "kaggle_csv",
        "question_col": "Question",
        "answer_col": "Answer",
        "category_col": "Category",
        "difficulty_col": "Difficulty",
        "encoding": "cp1252",
    }
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


def process_csv(filepath: Path, config: dict) -> list[dict]:
    rows = []
    with open(filepath, encoding=config.get("encoding", "utf-8-sig"), errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            q = (row.get(config["question_col"]) or "").strip()
            a = (row.get(config["answer_col"]) or "").strip()
            if not q or not a:
                continue
            cat_raw = (row.get(config.get("category_col", ""), "") or "general_programming").strip()
            diff_raw = (row.get(config.get("difficulty_col", ""), "") or "medium").strip()
            rows.append({
                "role": config["role"],
                "level": infer_level(diff_raw),
                "category": truncate_category(cat_raw),
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
