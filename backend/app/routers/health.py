from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def root():
    return {"message": "OnCall Foot Provider API"}
