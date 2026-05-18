from sqlalchemy.orm import Session
from sqlalchemy import func
from models.content import InterviewQuestion, UserQuestionProgress


def get_roles(db: Session) -> list[str]:
    rows = (
        db.query(InterviewQuestion.role)
        .distinct()
        .order_by(InterviewQuestion.role)
        .all()
    )
    return [r[0] for r in rows]


def get_questions(
    db: Session,
    role: str,
    level: str,
    user_id: int | None = None,
) -> dict:
    query = db.query(InterviewQuestion).filter(
        InterviewQuestion.role == role,
        InterviewQuestion.level.in_([level, "all"]),
    )
    questions = query.all()

    practiced_ids: set[int] = set()
    if user_id:
        rows = (
            db.query(UserQuestionProgress.question_id)
            .filter(UserQuestionProgress.user_id == user_id)
            .all()
        )
        practiced_ids = {r[0] for r in rows}

    by_category: dict[str, list[dict]] = {}
    for q in questions:
        cat = q.category
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append({
            "id": q.id,
            "question_text": q.question_text,
            "model_answer": q.model_answer,
            "level": q.level,
            "practiced": q.id in practiced_ids,
        })

    return {
        "role": role,
        "level": level,
        "total_questions": len(questions),
        "categories": by_category,
    }


def search_questions(
    db: Session,
    q: str,
    role: str | None = None,
    level: str | None = None,
    user_id: int | None = None,
) -> dict:
    query = db.query(InterviewQuestion).filter(
        InterviewQuestion.question_text.ilike(f"%{q}%")
    )
    if role:
        query = query.filter(InterviewQuestion.role == role)
    if level:
        query = query.filter(InterviewQuestion.level.in_([level, "all"]))

    questions = query.limit(50).all()

    practiced_ids: set[int] = set()
    if user_id and questions:
        q_ids = [qu.id for qu in questions]
        rows = (
            db.query(UserQuestionProgress.question_id)
            .filter(
                UserQuestionProgress.user_id == user_id,
                UserQuestionProgress.question_id.in_(q_ids),
            )
            .all()
        )
        practiced_ids = {r[0] for r in rows}

    results = [
        {
            "id": qu.id,
            "role": qu.role,
            "level": qu.level,
            "category": qu.category,
            "question_text": qu.question_text,
            "model_answer": qu.model_answer,
            "practiced": qu.id in practiced_ids,
        }
        for qu in questions
    ]

    return {"query": q, "results": results, "total": len(results)}


def set_practiced(db: Session, user_id: int, question_id: int, practiced: bool) -> None:
    existing = (
        db.query(UserQuestionProgress)
        .filter(
            UserQuestionProgress.user_id == user_id,
            UserQuestionProgress.question_id == question_id,
        )
        .first()
    )
    if practiced:
        if not existing:
            db.add(UserQuestionProgress(user_id=user_id, question_id=question_id))
            db.commit()
    else:
        if existing:
            db.delete(existing)
            db.commit()


def get_progress(
    db: Session,
    user_id: int,
    role: str,
    level: str,
) -> dict:
    questions = (
        db.query(InterviewQuestion)
        .filter(
            InterviewQuestion.role == role,
            InterviewQuestion.level.in_([level, "all"]),
        )
        .all()
    )

    if not questions:
        return {
            "role": role,
            "level": level,
            "overall_readiness_pct": 0,
            "by_category": {},
        }

    q_ids = [q.id for q in questions]
    practiced_rows = (
        db.query(UserQuestionProgress.question_id)
        .filter(
            UserQuestionProgress.user_id == user_id,
            UserQuestionProgress.question_id.in_(q_ids),
        )
        .all()
    )
    practiced_ids = {r[0] for r in practiced_rows}

    by_cat: dict[str, dict] = {}
    for q in questions:
        cat = q.category
        if cat not in by_cat:
            by_cat[cat] = {"practiced": 0, "total": 0}
        by_cat[cat]["total"] += 1
        if q.id in practiced_ids:
            by_cat[cat]["practiced"] += 1

    for cat, data in by_cat.items():
        data["pct"] = round(data["practiced"] / data["total"] * 100) if data["total"] else 0

    total = len(questions)
    overall = round(len(practiced_ids) / total * 100) if total else 0

    return {
        "role": role,
        "level": level,
        "overall_readiness_pct": overall,
        "by_category": by_cat,
    }
