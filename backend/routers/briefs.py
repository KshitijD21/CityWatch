from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Query
from openai import AsyncOpenAI
from config import OPENAI_API_KEY
from services.insforge_service import insforge
from routers.incidents import haversine_distance

router = APIRouter()

PHOENIX_TZ = ZoneInfo("America/Phoenix")

client = AsyncOpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None


def _classify_time(hour: int) -> str:
    if 6 <= hour < 18:
        return "daytime"
    elif 18 <= hour < 22:
        return "evening"
    else:
        return "late_night"


@router.get("/generate")
async def generate_brief(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: float = Query(5),
    days: int = Query(7),
):
    """Generate an AI safety brief for the area."""
    # 1. Fetch incidents
    delta = radius / 69.0
    raw_params = [
        ("lat", f"gte.{round(lat - delta, 6)}"),
        ("lat", f"lte.{round(lat + delta, 6)}"),
        ("lng", f"gte.{round(lng - delta, 6)}"),
        ("lng", f"lte.{round(lng + delta, 6)}"),
    ]
    rows = await insforge.query("incidents", raw_params=raw_params, limit=2000)

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    incidents = []
    for row in rows:
        dist = haversine_distance(lat, lng, row["lat"], row["lng"])
        if dist > radius:
            continue
        try:
            occurred = datetime.fromisoformat(row["occurred_at"].replace("Z", "+00:00"))
            if occurred < cutoff:
                continue
        except (ValueError, TypeError):
            continue
        row["distance_miles"] = round(dist, 2)
        incidents.append(row)

    # 2. Build stats
    by_category: dict[str, int] = {}
    by_source: dict[str, int] = {}
    by_time: dict[str, list] = {"daytime": [], "evening": [], "late_night": []}

    for inc in incidents:
        cat = inc.get("category", "other")
        src = inc.get("source", "unknown")
        by_category[cat] = by_category.get(cat, 0) + 1
        by_source[src] = by_source.get(src, 0) + 1

        try:
            occurred = datetime.fromisoformat(inc["occurred_at"].replace("Z", "+00:00"))
            local = occurred.astimezone(PHOENIX_TZ)
            period = _classify_time(local.hour)
            by_time[period].append(cat)
        except (ValueError, TypeError):
            pass

    # 3. Build time breakdown summaries
    def time_summary(period_incidents: list) -> str:
        if not period_incidents:
            return "No incidents reported during this period."
        counts: dict[str, int] = {}
        for cat in period_incidents:
            counts[cat] = counts.get(cat, 0) + 1
        parts = [f"{v} {k.replace('_', ' ')}" for k, v in sorted(counts.items(), key=lambda x: -x[1])]
        return f"{len(period_incidents)} incidents: {', '.join(parts)}."

    time_breakdown = {
        "daytime": time_summary(by_time["daytime"]),
        "evening": time_summary(by_time["evening"]),
        "late_night": time_summary(by_time["late_night"]),
    }

    # 4. Build sources list
    sources = [
        {"name": src.capitalize(), "type": src, "count": count}
        for src, count in sorted(by_source.items(), key=lambda x: -x[1])
    ]

    # 5. Generate AI summary
    if client and incidents:
        top_categories = sorted(by_category.items(), key=lambda x: -x[1])[:5]
        cat_str = ", ".join(f"{v} {k.replace('_', ' ')}" for k, v in top_categories)

        prompt = f"""You are a safety analyst. Generate a concise 2-3 sentence safety summary for this area.

Data for the last {days} days within {radius} miles:
- Total incidents: {len(incidents)}
- Top categories: {cat_str}
- Daytime: {len(by_time['daytime'])} incidents
- Evening: {len(by_time['evening'])} incidents
- Late night: {len(by_time['late_night'])} incidents

Rules:
- Be factual, not alarmist. Never say an area is "safe" or "unsafe".
- Mention specific numbers and top categories.
- Note the most active time period.
- Keep it under 3 sentences."""

        try:
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=200,
                temperature=0.3,
            )
            summary = response.choices[0].message.content or ""
        except Exception:
            summary = f"In the last {days} days, {len(incidents)} incidents were reported within {radius} miles. The most common categories are {cat_str}."
    elif incidents:
        top_categories = sorted(by_category.items(), key=lambda x: -x[1])[:3]
        cat_str = ", ".join(f"{v} {k.replace('_', ' ')}" for k, v in top_categories)
        summary = f"In the last {days} days, {len(incidents)} incidents were reported within {radius} miles. The most common categories are {cat_str}."
    else:
        summary = f"No incidents reported within {radius} miles in the last {days} days."

    return {
        "summary": summary,
        "time_breakdown": time_breakdown,
        "by_category": by_category,
        "household_context": None,
        "sources": sources,
        "incident_count": len(incidents),
        "disclaimer": "Based on reported data from police records and community reports. Actual conditions may vary. This is not a guarantee of safety.",
    }
