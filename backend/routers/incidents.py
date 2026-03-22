from fastapi import APIRouter, BackgroundTasks, Query
from services.insforge_service import insforge
import math

router = APIRouter()


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance in miles between two lat/lng points."""
    R = 3959  # Earth radius in miles
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def _attach_community_images(incidents: list) -> None:
    """Attach image_url from community_reports to community-sourced incidents."""
    community_ids = [r["id"] for r in incidents if r.get("source") == "community"]
    if not community_ids:
        return
    reports = await insforge.query(
        "community_reports",
        select="linked_incident_id,image_url",
        filters={"linked_incident_id": f"in.({','.join(community_ids)})"},
    )
    image_map = {r["linked_incident_id"]: r.get("image_url") for r in reports if r.get("image_url")}
    for r in incidents:
        if r["id"] in image_map:
            r["image_url"] = image_map[r["id"]]


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
async def get_nearby_incidents(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: float = Query(5, description="Radius in miles"),
    limit: int = Query(200),
):
    """Get incidents within radius of a point."""
    # Approximate bounding box for filtering (1 degree ≈ 69 miles)
    delta = radius / 69.0
    filters = {
        "lat": f"gte.{lat - delta}",
        "lng": f"gte.{lng - delta}",
    }

    # Fetch from DB with bounding box
    rows = await insforge.query(
        "incidents",
        filters=filters,
    )

    # Also filter by upper bounds (PostgREST doesn't support multiple filters on same column easily)
    # and calculate exact distance
    results = []
    for row in rows:
        if row["lat"] > lat + delta or row["lng"] > lng + delta:
            continue
        dist = haversine_distance(lat, lng, row["lat"], row["lng"])
        if dist <= radius:
            row["distance_miles"] = round(dist, 2)
            results.append(row)

    # Sort by most recent
    results.sort(key=lambda x: x.get("occurred_at", ""), reverse=True)
    results = results[:limit]
    await _attach_community_images(results)
    return results


@router.get("/bounds")
async def get_incidents_in_bounds(
    north: float = Query(...),
    south: float = Query(...),
    east: float = Query(...),
    west: float = Query(...),
    limit: int = Query(200),
):
    """Get incidents within map viewport bounds."""
    filters = {
        "lat": f"gte.{south}",
        "lng": f"gte.{west}",
    }
    rows = await insforge.query("incidents", filters=filters)

    results = [r for r in rows if r["lat"] <= north and r["lng"] <= east]
    results.sort(key=lambda x: x.get("occurred_at", ""), reverse=True)
    results = results[:limit]
    await _attach_community_images(results)
    return results


@router.get("/stats")
async def get_incident_stats(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: float = Query(5),
):
    """Get aggregated stats for an area."""
    incidents = await get_nearby_incidents(lat=lat, lng=lng, radius=radius, limit=1000)

    by_category: dict[str, int] = {}
    by_source: dict[str, int] = {}
    for inc in incidents:
        cat = inc.get("category", "other")
        src = inc.get("source", "unknown")
        by_category[cat] = by_category.get(cat, 0) + 1
        by_source[src] = by_source.get(src, 0) + 1

    return {
        "total_count": len(incidents),
        "by_category": by_category,
        "by_source": by_source,
        "sources": list(by_source.keys()),
    }


@router.get("/{incident_id}")
async def get_incident(incident_id: str):
    """Get full incident details."""
    result = await insforge.query(
        "incidents",
        filters={"id": f"eq.{incident_id}"},
        single=True,
    )

    await _attach_community_images([result])
    return result
