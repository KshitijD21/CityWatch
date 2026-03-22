from __future__ import annotations

from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Request
from models.schemas import LocationUpdate, SharingToggle
from services.insforge_service import insforge
from utils.helpers import get_current_user

router = APIRouter()

STALE_THRESHOLD = timedelta(minutes=5)


@router.post("/webhook")
async def location_webhook(request: Request):
    """Receive location update from InsForge realtime webhook.

    Called automatically by InsForge when a client publishes to
    a group:*:locations channel. Persists the location to DB.
    """
    body = await request.json()

    # InsForge sends the payload directly as the body (not wrapped)
    # It also sends metadata in headers: X-Insforge-Channel, X-Insforge-Event, X-Insforge-Message-Id
    user_id = body.get("user_id")
    lat = body.get("lat")
    lng = body.get("lng")

    if not user_id or lat is None or lng is None:
        return {"ok": False, "reason": "missing fields"}

    await insforge.upsert("locations_live", {
        "user_id": user_id,
        "lat": lat,
        "lng": lng,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }, on_conflict="user_id")

    return {"ok": True}


@router.post("/update")
async def update_location(
    req: LocationUpdate,
    token_payload: dict = Depends(get_current_user),
):
    """Fallback REST endpoint for location update (if WebSocket unavailable)."""
    user_id = token_payload["sub"]

    await insforge.upsert("locations_live", {
        "user_id": user_id,
        "lat": req.lat,
        "lng": req.lng,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }, on_conflict="user_id")

    return {"updated": True}


@router.get("/group/{group_id}")
async def get_group_locations(
    group_id: str,
    token_payload: dict = Depends(get_current_user),
):
    """Get live locations for all sharing members in a group.

    Used for initial map load. After this, frontend uses WebSocket
    subscription for real-time updates.
    """
    # Get members who have sharing enabled
    members = await insforge.query(
        "group_members",
        select="user_id,display_name",
        filters={"group_id": f"eq.{group_id}", "sharing_location": "eq.true"},
    )

    # Filter out placeholder members (no user_id)
    user_ids = [m["user_id"] for m in members if m.get("user_id")]
    if not user_ids:
        return []

    # Build a name lookup
    name_map = {m["user_id"]: m["display_name"] for m in members if m.get("user_id")}

    # Get live locations for these users
    locations = await insforge.query(
        "locations_live",
        filters={"user_id": f"in.({','.join(user_ids)})"},
    )

    now = datetime.now(timezone.utc)
    result = []
    for loc in locations:
        updated_at = loc.get("updated_at", "")
        try:
            updated_dt = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
            is_stale = (now - updated_dt) > STALE_THRESHOLD
        except (ValueError, TypeError):
            is_stale = True

        result.append({
            "user_id": loc["user_id"],
            "display_name": name_map.get(loc["user_id"], ""),
            "lat": loc["lat"],
            "lng": loc["lng"],
            "updated_at": updated_at,
            "is_stale": is_stale,
        })

    return result


@router.put("/sharing")
async def toggle_sharing(
    req: SharingToggle,
    token_payload: dict = Depends(get_current_user),
):
    """Toggle location sharing for current user in a specific group."""
    user_id = token_payload["sub"]

    # Update sharing flag in group_members
    await insforge.update(
        "group_members",
        {"sharing_location": req.sharing_location},
        filters={"group_id": f"eq.{req.group_id}", "user_id": f"eq.{user_id}"},
    )

    # If turning off, remove live location so dot disappears immediately
    if not req.sharing_location:
        await insforge.delete(
            "locations_live",
            filters={"user_id": f"eq.{user_id}"},
        )

    return {"sharing_location": req.sharing_location}
