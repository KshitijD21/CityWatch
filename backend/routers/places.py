from fastapi import APIRouter

router = APIRouter()

@router.post("/")
async def add_place():
    """Add saved place."""
    return {"message": "TODO"}

@router.get("/")
async def list_places():
    """List saved places."""
    return {"message": "TODO"}

@router.delete("/{place_id}")
async def remove_place(place_id: str):
    """Remove saved place."""
    return {"message": "TODO"}
