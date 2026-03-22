from fastapi import APIRouter, BackgroundTasks, Query

router = APIRouter()


@router.post("/scrape")
async def trigger_scrape(
    background_tasks: BackgroundTasks,
    hours: int = Query(default=24, ge=1, le=168),
):
    """Trigger a TinyFish scrape in the background.

    Args:
        hours: scrape incidents from the last N hours (default 24, max 168/7 days)
    """
    from services.tinyfish_service import scrape_all

    background_tasks.add_task(scrape_all, since_hours=hours)
    return {"status": "started", "hours": hours}


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
