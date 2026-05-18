from fastapi import APIRouter

router = APIRouter()


@router.get("/tokens/summary")
def token_summary():
    return {"detail": "Not implemented yet"}
