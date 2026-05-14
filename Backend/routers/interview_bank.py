from fastapi import APIRouter

router = APIRouter()


@router.get("/roles")
def get_roles():
    return {"roles": []}


@router.get("/questions")
def get_questions():
    return {"detail": "Not implemented yet"}
