"""Alerts router — returns recent incidents near user's saved places and live location."""
from __future__ import annotations

from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query
from services.insforge_service import insforge
from utils.helpers import get_current_user
from routers.incidents import haversine_distance

router = APIRouter()


@router.get("")
async def get_alerts(
    radius: float = Query(2, description="Alert radius in miles"),
    hours: int = Query(6, description="Look back N hours"),
    token_payload: dict = Depends(get_current_user),
):
    """Get recent incidents near user's saved places and group members' locations."""
    user_id = token_payload["sub"]

    # 1. Gather user's anchor points (saved places + live location)
    anchor_points: list[dict] = []

    # Saved places
    try:
        places = await insforge.query(
            "saved_places",
            select="name,lat,lng",
            filters={"user_id": f"eq.{user_id}"},
        )
        for p in places:
            if p.get("lat") and p.get("lng"):
                anchor_points.append({
                    "name": p.get("name", "Saved place"),
                    "lat": p["lat"],
                    "lng": p["lng"],
                })
    except Exception:
        pass

    # Live location
    try:
        live = await insforge.query(
            "locations_live",
            filters={"user_id": f"eq.{user_id}"},
        )
        if live and isinstance(live, list) and live[0].get("lat"):
            anchor_points.append({
                "name": "Your location",
                "lat": live[0]["lat"],
                "lng": live[0]["lng"],
            })
        elif live and isinstance(live, dict) and live.get("lat"):
            anchor_points.append({
                "name": "Your location",
                "lat": live["lat"],
                "lng": live["lng"],
            })
    except Exception:
        pass

    # If no anchor points, fall back to a default (won't return useful alerts)
    if not anchor_points:
        return []

    # 2. Fetch recent incidents
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    cutoff_str = cutoff.isoformat()

    try:
        incidents = await insforge.query(
            "incidents",
            raw_params=[
                ("occurred_at", f"gte.{cutoff_str}"),
                ("order", "occurred_at.desc"),
            ],
            limit=500,
        )
    except Exception:
        incidents = []

    if not incidents:
        return []

    # 3. Match incidents to anchor points
    alerts = []
    seen_ids: set[str] = set()

    for inc in incidents:
        if inc["id"] in seen_ids:
            continue
        inc_lat = inc.get("lat")
        inc_lng = inc.get("lng")
        if inc_lat is None or inc_lng is None:
            continue

        for anchor in anchor_points:
            dist = haversine_distance(anchor["lat"], anchor["lng"], inc_lat, inc_lng)
            if dist <= radius:
                alerts.append({
                    "id": inc["id"],
                    "category": inc.get("category", "other"),
                    "description": inc.get("description", ""),
                    "lat": inc_lat,
                    "lng": inc_lng,
                    "occurred_at": inc.get("occurred_at", ""),
                    "source": inc.get("source", "unknown"),
                    "verified": inc.get("verified", False),
                    "distance_miles": round(dist, 2),
                    "near": anchor["name"],
                })
                seen_ids.add(inc["id"])
                break  # Don't duplicate for multiple anchors

    return alerts[:50]
