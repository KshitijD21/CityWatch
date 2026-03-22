from fastapi import APIRouter, BackgroundTasks, Query
from services.insforge_service import insforge
import math
import sys

def log(msg: str):
    sys.stderr.write(f"{msg}\n")
    sys.stderr.flush()

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
    radius: float = Query(10, description="Radius in miles"),
    limit: int = Query(10000),
):
    """Get incidents within radius of a point."""
    log("=" * 60)
    log(f"GET /nearby — center=({lat}, {lng}), radius={radius}mi, limit={limit}")

    # Approximate bounding box for filtering (1 degree ≈ 69 miles)
    delta = radius / 69.0
    bbox = {
        "lat_min": round(lat - delta, 6),
        "lat_max": round(lat + delta, 6),
        "lng_min": round(lng - delta, 6),
        "lng_max": round(lng + delta, 6),
    }
    log(f"Bounding box: lat[{bbox['lat_min']} → {bbox['lat_max']}], lng[{bbox['lng_min']} → {bbox['lng_max']}]")

    # Use raw_params to support duplicate keys for proper bounding box
    raw_params = [
        ("lat", f"gte.{bbox['lat_min']}"),
        ("lat", f"lte.{bbox['lat_max']}"),
        ("lng", f"gte.{bbox['lng_min']}"),
        ("lng", f"lte.{bbox['lng_max']}"),
    ]

    rows = await insforge.query(
        "incidents",
        raw_params=raw_params,
        order="occurred_at.desc",
        limit=limit,
    )
    log(f"DB returned {len(rows)} rows (limit={limit})")

    if rows:
        lats = [r["lat"] for r in rows]
        lngs = [r["lng"] for r in rows]
        log(f"DB rows lat range: [{min(lats):.4f} → {max(lats):.4f}], lng range: [{min(lngs):.4f} → {max(lngs):.4f}]")
        log(f"DB rows date range: {rows[-1].get('occurred_at', '?')} → {rows[0].get('occurred_at', '?')}")

    # Calculate exact Haversine distance
    results = []
    max_dist = 0.0
    for row in rows:
        dist = haversine_distance(lat, lng, row["lat"], row["lng"])
        if dist <= radius:
            row["distance_miles"] = round(dist, 2)
            results.append(row)
            max_dist = max(max_dist, dist)

    log(f"After haversine filter: {len(results)} incidents (dropped {len(rows) - len(results)} outside {radius}mi circle)")
    log(f"Max distance in results: {max_dist:.2f}mi")
    log("=" * 60)

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
    raw_params = [
        ("lat", f"gte.{south}"),
        ("lat", f"lte.{north}"),
        ("lng", f"gte.{west}"),
        ("lng", f"lte.{east}"),
    ]
    rows = await insforge.query("incidents", raw_params=raw_params, limit=5000)

    results = rows
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
