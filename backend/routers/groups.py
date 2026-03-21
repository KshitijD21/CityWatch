from fastapi import APIRouter

router = APIRouter()

@router.post("/")
async def create_group():
    """Create group."""
    return {"message": "TODO"}

@router.get("/")
async def list_groups():
    """List user's groups."""
    return {"message": "TODO"}

@router.get("/{group_id}")
async def get_group(group_id: str):
    """Get group details."""
    return {"message": "TODO"}

@router.get("/join/{invite_code}")
async def join_group(invite_code: str):
    """Join group via invite."""
    return {"message": "TODO"}

@router.post("/{group_id}/members")
async def add_member(group_id: str):
    """Add placeholder member."""
    return {"message": "TODO"}

@router.delete("/{group_id}/members/{member_id}")
async def remove_member(group_id: str, member_id: str):
    """Remove member."""
    return {"message": "TODO"}
