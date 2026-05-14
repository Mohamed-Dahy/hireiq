from fastapi import APIRouter

router = APIRouter()


@router.get("/roles")
def get_roles():
    return {"roles": []}


@router.get("/countries")
def get_countries():
    return {"countries": []}


@router.get("/query")
def query_salary():
    return {"detail": "Not implemented yet"}
