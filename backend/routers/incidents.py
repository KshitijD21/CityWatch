from fastapi import APIRouter

router = APIRouter()

@router.get("/nearby")
async def get_nearby_incidents():
    """Get incidents within radius of a point."""
    return {"message": "TODO"}

@router.get("/bounds")
async def get_incidents_in_bounds():
    """Get incidents within map viewport bounds."""
    return {"message": "TODO"}

@router.get("/stats")
async def get_incident_stats():
    """Get aggregated stats for an area."""
    return {"message": "TODO"}

@router.get("/{incident_id}")
async def get_incident(incident_id: str):
    """Get full incident details."""
    return {"message": "TODO"}
