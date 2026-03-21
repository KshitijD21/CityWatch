from fastapi import APIRouter

router = APIRouter()

@router.post("/")
async def submit_report():
    """Submit community report."""
    return {"message": "TODO"}

@router.get("/nearby")
async def get_nearby_reports():
    """Get reports near a point."""
    return {"message": "TODO"}

@router.put("/{report_id}/flag")
async def flag_report(report_id: str):
    """Flag a report."""
    return {"message": "TODO"}
