from fastapi import APIRouter

router = APIRouter()


@router.get("/me")
def get_profile():
    return {"detail": "Not implemented yet"}
