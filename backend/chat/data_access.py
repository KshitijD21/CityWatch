"""Database queries for the chat module — all go through InsForgeClient."""
from __future__ import annotations
import math
from datetime import datetime, timedelta, timezone
from services.insforge_service import insforge


def _haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance in miles between two coordinates."""
    R = 3958.8  # Earth radius in miles
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def get_nearby_incidents(
    lat: float,
    lng: float,
    radius_miles: float = 5.0,
    days: int = 7,
) -> list[dict]:
    """Fetch incidents within radius_miles of (lat, lng) from the last N days."""
    # Approximate bounding box (1 degree lat ≈ 69 miles)
    lat_delta = radius_miles / 69.0
    lng_delta = radius_miles / (69.0 * math.cos(math.radians(lat)))

    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    # PostgREST AND filter: use "and" key with parenthesized conditions
    rows = await insforge.query(
        "incidents",
        filters={
            "and": (
                f"(lat.gte.{lat - lat_delta},"
                f"lat.lte.{lat + lat_delta},"
                f"lng.gte.{lng - lng_delta},"
                f"lng.lte.{lng + lng_delta},"
                f"occurred_at.gte.{cutoff})"
            ),
        },
    )
    if not isinstance(rows, list):
        rows = [rows] if rows else []

    # Filter by actual haversine distance and add distance_miles
    results = []
    for row in rows:
        d = _haversine_miles(lat, lng, row["lat"], row["lng"])
        if d <= radius_miles:
            row["distance_miles"] = round(d, 3)
            results.append(row)

    results.sort(key=lambda r: r.get("occurred_at", ""), reverse=True)
    return results


async def get_incident_stats(
    lat: float,
    lng: float,
    radius_miles: float = 5.0,
    days: int = 7,
) -> dict:
    """Aggregate stats from nearby incidents."""
    incidents = await get_nearby_incidents(lat, lng, radius_miles, days)

    by_category: dict[str, int] = {}
    by_source: dict[str, int] = {}
    by_time: dict[str, int] = {"morning": 0, "afternoon": 0, "evening": 0, "late_night": 0}

    for inc in incidents:
        cat = inc.get("category", "other")
        by_category[cat] = by_category.get(cat, 0) + 1

        src = inc.get("source", "unknown")
        by_source[src] = by_source.get(src, 0) + 1

        occurred = inc.get("occurred_at", "")
        try:
            dt = datetime.fromisoformat(occurred.replace("Z", "+00:00"))
            hour = dt.hour
            if 6 <= hour < 12:
                by_time["morning"] += 1
            elif 12 <= hour < 17:
                by_time["afternoon"] += 1
            elif 17 <= hour < 22:
                by_time["evening"] += 1
            else:
                by_time["late_night"] += 1
        except (ValueError, AttributeError):
            pass

    sources = list(by_source.keys())
    return {
        "by_category": by_category,
        "by_source": by_source,
        "by_time": by_time,
        "total_count": len(incidents),
        "sources": sources,
    }


async def get_user_profile(user_id: str) -> dict | None:
    """Get user profile from users table."""
    try:
        result = await insforge.query(
            "users",
            filters={"id": f"eq.{user_id}"},
            single=True,
        )
        return result if isinstance(result, dict) else None
    except Exception:
        return None


async def get_group_members(user_id: str) -> list[dict]:
    """Get all group members for groups the user belongs to.
    Each member dict includes 'group_name' and 'group_id'.
    """
    # First find user's groups
    memberships = await insforge.query(
        "group_members",
        filters={"user_id": f"eq.{user_id}"},
    )
    if not isinstance(memberships, list):
        memberships = [memberships] if memberships else []

    # Fetch group names
    group_names: dict[str, str] = {}
    for membership in memberships:
        gid = membership.get("group_id")
        if gid and gid not in group_names:
            try:
                group = await insforge.query("groups", filters={"id": f"eq.{gid}"}, single=True)
                if isinstance(group, dict):
                    group_names[gid] = group.get("name", "Unknown Group")
            except Exception:
                group_names[gid] = "Unknown Group"

    all_members = []
    for membership in memberships:
        group_id = membership.get("group_id")
        if not group_id:
            continue
        members = await insforge.query(
            "group_members",
            filters={"group_id": f"eq.{group_id}"},
        )
        if isinstance(members, list):
            for m in members:
                m["group_name"] = group_names.get(group_id, "Unknown Group")
            all_members.extend(members)

    # Deduplicate by (id, group_id) — same person can be in multiple groups
    seen = set()
    unique = []
    for m in all_members:
        key = (m.get("id"), m.get("group_id"))
        if key not in seen:
            seen.add(key)
            unique.append(m)
    return unique


async def get_user_groups(user_id: str) -> list[dict]:
    """Get list of groups the user belongs to (id, name, type, member_count)."""
    memberships = await insforge.query(
        "group_members",
        filters={"user_id": f"eq.{user_id}"},
    )
    if not isinstance(memberships, list):
        memberships = [memberships] if memberships else []

    groups = []
    for membership in memberships:
        gid = membership.get("group_id")
        if not gid:
            continue
        try:
            group = await insforge.query("groups", filters={"id": f"eq.{gid}"}, single=True)
            if isinstance(group, dict):
                # Count members
                members = await insforge.query("group_members", filters={"group_id": f"eq.{gid}"})
                count = len(members) if isinstance(members, list) else 0
                groups.append({
                    "id": gid,
                    "name": group.get("name", "Unknown"),
                    "type": group.get("type", "friends"),
                    "member_count": count,
                    "role": membership.get("role", "member"),
                })
        except Exception:
            pass
    return groups


async def get_live_location(member_user_id: str) -> dict | None:
    """Get live location for a specific user."""
    try:
        result = await insforge.query(
            "locations_live",
            filters={"user_id": f"eq.{member_user_id}"},
            single=True,
        )
        return result if isinstance(result, dict) else None
    except Exception:
        return None


async def get_saved_places(user_id: str) -> list[dict]:
    """Get user's saved places."""
    rows = await insforge.query(
        "saved_places",
        filters={"user_id": f"eq.{user_id}"},
    )
    return rows if isinstance(rows, list) else []
