from fastapi import APIRouter

router = APIRouter()

@router.post("/")
async def chat():
    """Chat with Claude (SSE streaming)."""
    return {"message": "TODO"}
