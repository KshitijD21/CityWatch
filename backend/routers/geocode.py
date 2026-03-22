from fastapi import APIRouter

router = APIRouter()

@router.get("")
async def geocode():
    """Geocode an address to lat/lng."""
    return {"message": "TODO"}
