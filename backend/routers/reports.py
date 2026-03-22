from __future__ import annotations

from datetime import datetime, timezone

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from models.schemas import ReportCreate
from services.insforge_service import insforge
from services.verification_service import verify_report
from utils.helpers import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("")
async def submit_report(
    req: ReportCreate,
    background_tasks: BackgroundTasks,
    token_payload: dict = Depends(get_current_user),
):
    """Submit a community report. Creates a linked incident so pin shows on map immediately."""
    user_id = token_payload["sub"]

    # 1. Insert community report
    report = await insforge.insert("community_reports", {
        "user_id": user_id,
        "category": req.category,
        "description": req.description,
        "lat": req.lat,
        "lng": req.lng,
        "status": "unverified",
    })

    # 2. Create linked incident (same category — both tables share categories)
    incident = await insforge.insert("incidents", {
        "category": req.category,
        "description": req.description,
        "lat": req.lat,
        "lng": req.lng,
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "source": "community",
        "verified": False,
    })

    # 3. Link incident to report
    await insforge.update(
        "community_reports",
        {"linked_incident_id": incident["id"]},
        filters={"id": f"eq.{report['id']}"},
    )

    # B6: Trigger AI verification as background task
    background_tasks.add_task(verify_report, report["id"])
    logger.info("B6 verification queued for report=%s", report["id"])

    return {
        "report_id": report["id"],
        "incident_id": incident["id"],
        "status": "unverified",
    }


@router.get("/nearby")
async def get_nearby_reports(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: float = Query(0.5, description="Radius in miles"),
    days: int = Query(7),
):
    """Get community reports near a location."""
    reports = await insforge.rpc("get_nearby_reports", {
        "p_lat": lat,
        "p_lng": lng,
        "p_radius_miles": radius,
        "p_days": days,
    })
    return reports


@router.put("/{report_id}/flag")
async def flag_report(
    report_id: str,
    token_payload: dict = Depends(get_current_user),
):
    """Flag a report. Auto-sets status to 'flagged' when flagged_by_users >= 3."""
    # Get current count
    report = await insforge.query(
        "community_reports",
        select="flagged_by_users,status",
        filters={"id": f"eq.{report_id}"},
        single=True,
    )

    new_count = (report.get("flagged_by_users") or 0) + 1
    new_status = "flagged" if new_count >= 3 else report["status"]

    await insforge.update(
        "community_reports",
        {"flagged_by_users": new_count, "status": new_status},
        filters={"id": f"eq.{report_id}"},
    )

    return {"flagged_by_users": new_count, "status": new_status}
