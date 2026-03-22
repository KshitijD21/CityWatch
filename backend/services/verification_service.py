"""
B6 — AI Verification Service

Background task triggered after a community report is submitted (B4).
Uses Claude to verify the report against nearby official incidents
and other community reports.
"""

from __future__ import annotations

import json
import logging

from anthropic import AsyncAnthropic

from config import ANTHROPIC_API_KEY
from services.insforge_service import insforge

logger = logging.getLogger(__name__)

_anthropic = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

VERIFICATION_PROMPT = """\
You are verifying a community safety report. Compare it against official data and other community reports.

## Community Report Under Review
- Category: {category}
- Description: {description}
- Location: ({lat}, {lng})
- Reported at: {reported_at}

## Official Incidents Nearby (0.5 mi, last 7 days)
{official_incidents}

## Other Community Reports Nearby (0.25 mi, last 7 days)
{community_reports}

## Instructions
Assess:
1. Is this plausible for this area and time?
2. Does it match or correlate with official data?
3. Are there corroborating community reports?
4. Does the description target specific people or contain racial/ethnic descriptions?

Mark as "flagged" if the description contains: people descriptions, racial references, or specific individual targeting.
Mark as "verified" if it correlates with official data or has corroborating community reports.
Mark as "unverified" if there is insufficient data to verify but nothing suspicious.

Respond ONLY with this JSON (no other text):
{{"status": "verified"|"unverified"|"flagged", "confidence": "high"|"medium"|"low", "reason": "brief explanation"}}
"""


def _format_incidents(incidents: list) -> str:
    if not incidents:
        return "None found."
    lines = []
    for inc in incidents[:20]:  # cap at 20 for prompt size
        lines.append(
            f"- [{inc.get('category')}] {inc.get('description', 'No description')} "
            f"(source: {inc.get('source')}, at: {inc.get('occurred_at')})"
        )
    return "\n".join(lines)


def _format_reports(reports: list) -> str:
    if not reports:
        return "None found."
    lines = []
    for r in reports[:20]:
        lines.append(
            f"- [{r.get('category')}] {r.get('description', 'No description')} "
            f"(status: {r.get('status')}, at: {r.get('reported_at')})"
        )
    return "\n".join(lines)


async def _fetch_nearby_official_incidents(lat: float, lng: float) -> list:
    """Fetch official (police/news) incidents within 0.5 miles, last 7 days."""
    radius_deg_lat = 0.5 * 0.0145  # ~0.5 miles in degrees lat
    radius_deg_lng = 0.5 * 0.0175  # ~0.5 miles in degrees lng

    incidents = await insforge.query(
        "incidents",
        filters={
            "source": "neq.community",
            "lat": f"gte.{lat - radius_deg_lat}",
            "lng": f"gte.{lng - radius_deg_lng}",
            "and": f"(lat.lte.{lat + radius_deg_lat},lng.lte.{lng + radius_deg_lng})",
            "occurred_at": "gte.now()-7d",
        },
    )
    return incidents if isinstance(incidents, list) else []


async def _fetch_nearby_community_reports(
    lat: float, lng: float, exclude_id: str | None = None
) -> list:
    """Fetch community reports within 0.25 miles, last 7 days."""
    radius_deg_lat = 0.25 * 0.0145
    radius_deg_lng = 0.25 * 0.0175

    reports = await insforge.rpc("get_nearby_reports", {
        "p_lat": lat,
        "p_lng": lng,
        "p_radius_miles": 0.25,
        "p_days": 7,
    })
    if not isinstance(reports, list):
        reports = []
    # Exclude the report being verified
    if exclude_id:
        reports = [r for r in reports if r.get("id") != exclude_id]
    return reports


async def verify_report(report_id: str) -> dict:
    """
    Run AI verification on a community report.

    Steps:
    1. Fetch report details
    2. Fetch nearby official incidents (0.5 mi, 7 days)
    3. Fetch nearby community reports (0.25 mi, 7 days)
    4. Call Claude for verification
    5. Update community_reports status + verification_note
    6. Update linked incident if verified/flagged
    """
    # Step 1: Get report details
    report = await insforge.query(
        "community_reports",
        filters={"id": f"eq.{report_id}"},
        single=True,
    )

    lat = report["lat"]
    lng = report["lng"]
    linked_incident_id = report.get("linked_incident_id")

    # Step 2 & 3: Fetch nearby data
    official_incidents = await _fetch_nearby_official_incidents(lat, lng)
    community_reports = await _fetch_nearby_community_reports(lat, lng, exclude_id=report_id)

    logger.info(
        "B6 verify report=%s: %d official incidents, %d community reports nearby",
        report_id, len(official_incidents), len(community_reports),
    )

    # Step 4: Call Claude
    prompt = VERIFICATION_PROMPT.format(
        category=report.get("category", "unknown"),
        description=report.get("description") or "No description provided",
        lat=lat,
        lng=lng,
        reported_at=report.get("reported_at", "unknown"),
        official_incidents=_format_incidents(official_incidents),
        community_reports=_format_reports(community_reports),
    )

    response = await _anthropic.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=256,
        messages=[{"role": "user", "content": prompt}],
    )

    # Step 5: Parse Claude's response
    raw_text = response.content[0].text.strip()
    try:
        verdict = json.loads(raw_text)
    except json.JSONDecodeError:
        logger.warning("B6: Failed to parse Claude response: %s", raw_text)
        verdict = {"status": "unverified", "confidence": "low", "reason": "AI response parse error"}

    new_status = verdict.get("status", "unverified")
    reason = verdict.get("reason", "")

    if new_status not in ("verified", "unverified", "flagged"):
        new_status = "unverified"

    logger.info("B6 verdict for report=%s: status=%s, reason=%s", report_id, new_status, reason)

    # Step 6: Update community_reports
    await insforge.update(
        "community_reports",
        {"status": new_status, "verification_note": reason},
        filters={"id": f"eq.{report_id}"},
    )

    # Step 7 & 8: Update linked incident
    if linked_incident_id:
        if new_status == "verified":
            await insforge.update(
                "incidents",
                {"verified": True, "verification_note": reason},
                filters={"id": f"eq.{linked_incident_id}"},
            )
        elif new_status == "flagged":
            await insforge.update(
                "incidents",
                {"verified": False, "verification_note": reason},
                filters={"id": f"eq.{linked_incident_id}"},
            )

    # TODO: Step 9 — Run clustering check (B7)
    # TODO: Step 10 — Broadcast update via realtime

    return {
        "report_id": report_id,
        "status": new_status,
        "confidence": verdict.get("confidence", "low"),
        "reason": reason,
    }
