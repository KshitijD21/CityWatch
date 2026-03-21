from fastapi import APIRouter

router = APIRouter()

@router.post("/update")
async def update_location():
    """Send location update."""
    return {"message": "TODO"}

@router.get("/group/{group_id}")
async def get_group_locations(group_id: str):
    """Get live locations for group."""
    return {"message": "TODO"}

@router.put("/sharing")
async def toggle_sharing():
    """Toggle location sharing."""
    return {"message": "TODO"}
