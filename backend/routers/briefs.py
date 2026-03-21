from fastapi import APIRouter

router = APIRouter()

@router.get("/generate")
async def generate_brief():
    """Generate area safety brief."""
    return {"message": "TODO"}
