"""Chat router — SSE streaming endpoint for the hybrid chat assistant."""
from __future__ import annotations
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from chat.handler import handle_chat
from chat.schemas import ChatRequest
from utils.helpers import get_optional_user

router = APIRouter()


@router.post("/")
async def chat(
    req: ChatRequest,
    user: dict | None = Depends(get_optional_user),
):
    """Chat with the safety assistant (SSE streaming).

    Returns Server-Sent Events:
    - {"type": "stream_start", "lane": 1|2}
    - {"type": "token", "content": "..."} (repeated)
    - {"type": "cards", "data": {...}} (card mode, single event)
    - {"type": "stream_end"}
    - {"type": "error", "content": "..."}
    """
    user_id = user["sub"] if user else None

    async def event_generator():
        async for event in handle_chat(
            message=req.message,
            user_lat=req.user_lat,
            user_lng=req.user_lng,
            session_id=req.session_id,
            user_id=user_id,
        ):
            yield f"data: {event}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
