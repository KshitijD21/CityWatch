import secrets

from fastapi import APIRouter, Depends, HTTPException
from models.schemas import GroupCreate, GroupUpdate, MemberCreate
from services.insforge_service import insforge
from utils.helpers import get_current_user

router = APIRouter()


@router.post("")
async def create_group(req: GroupCreate, token_payload: dict = Depends(get_current_user)):
    """Create group, add current user as admin."""
    user_id = token_payload["sub"]
    invite_code = secrets.token_urlsafe(4)[:6].upper()

    # Get user's name for the member display_name
    user_row = await insforge.query(
        "users",
        select="name",
        filters={"id": f"eq.{user_id}"},
        single=True,
    )

    group = await insforge.insert("groups", {
        "name": req.name,
        "type": req.type,
        "invite_code": invite_code,
        "created_by": user_id,
    })

    group_id = group["id"]

    # Add creator as admin member
    await insforge.insert("group_members", {
        "group_id": group_id,
        "user_id": user_id,
        "display_name": user_row.get("name", ""),
        "role": "admin",
        "sharing_location": False,
    })

    return {"group_id": group_id, "invite_code": invite_code}


@router.get("")
async def list_groups(token_payload: dict = Depends(get_current_user)):
    """List all groups the current user belongs to."""
    user_id = token_payload["sub"]

    memberships = await insforge.query(
        "group_members",
        select="group_id,role,groups(id,name,type,invite_code,created_at)",
        filters={"user_id": f"eq.{user_id}"},
    )

    groups = []
    for m in memberships:
        if m.get("groups"):
            group = m["groups"]
            group["role"] = m["role"]
            groups.append(group)

    return groups


@router.get("/{group_id}")
async def get_group(group_id: str, token_payload: dict = Depends(get_current_user)):
    """Get group details + all members."""
    group = await insforge.query(
        "groups",
        filters={"id": f"eq.{group_id}"},
        single=True,
    )

    members = await insforge.query(
        "group_members",
        select="id,user_id,display_name,age_band,role,sharing_location,joined_at",
        filters={"group_id": f"eq.{group_id}"},
    )

    return {**group, "members": members}


@router.patch("/{group_id}")
async def update_group(
    group_id: str,
    req: GroupUpdate,
    token_payload: dict = Depends(get_current_user),
):
    """Rename a group (admin only)."""
    user_id = token_payload["sub"]

    # Verify user is admin
    membership = await insforge.query(
        "group_members",
        select="role",
        filters={"group_id": f"eq.{group_id}", "user_id": f"eq.{user_id}"},
    )
    if not membership or membership[0].get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update this group")

    update_data = req.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    updated = await insforge.update(
        "groups",
        update_data,
        filters={"id": f"eq.{group_id}"},
    )
    return updated


@router.delete("/{group_id}")
async def delete_group(group_id: str, token_payload: dict = Depends(get_current_user)):
    """Delete a group and all its members (admin only)."""
    user_id = token_payload["sub"]

    # Verify user is admin
    membership = await insforge.query(
        "group_members",
        select="role",
        filters={"group_id": f"eq.{group_id}", "user_id": f"eq.{user_id}"},
    )
    if not membership or membership[0].get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete this group")

    # Delete all members first
    await insforge.delete("group_members", filters={"group_id": f"eq.{group_id}"})
    # Delete the group
    await insforge.delete("groups", filters={"id": f"eq.{group_id}"})

    return {"deleted": True}


@router.get("/join/{invite_code}")
async def join_group(invite_code: str, token_payload: dict = Depends(get_current_user)):
    """Join group via invite code."""
    user_id = token_payload["sub"]

    # Find group by invite code
    group = await insforge.query(
        "groups",
        select="id,name",
        filters={"invite_code": f"eq.{invite_code}"},
        single=True,
    )

    group_id = group["id"]

    # Check if user is already a member
    existing = await insforge.query(
        "group_members",
        filters={"group_id": f"eq.{group_id}", "user_id": f"eq.{user_id}"},
    )
    if existing:
        return {"group_id": group_id, "group_name": group["name"], "message": "Already a member"}

    # Get user's name
    user_row = await insforge.query(
        "users",
        select="name",
        filters={"id": f"eq.{user_id}"},
        single=True,
    )
    display_name = user_row.get("name", "")

    # Check for a placeholder member with matching name to link
    placeholders = await insforge.query(
        "group_members",
        filters={
            "group_id": f"eq.{group_id}",
            "user_id": "is.null",
            "display_name": f"eq.{display_name}",
        },
    )

    if placeholders:
        # Link the placeholder to this user
        await insforge.update(
            "group_members",
            {"user_id": user_id},
            filters={"id": f"eq.{placeholders[0]['id']}"},
        )
    else:
        # Add as new member
        await insforge.insert("group_members", {
            "group_id": group_id,
            "user_id": user_id,
            "display_name": display_name,
            "role": "member",
            "sharing_location": False,
        })

    return {"group_id": group_id, "group_name": group["name"]}


@router.post("/{group_id}/members")
async def add_member(
    group_id: str,
    req: MemberCreate,
    token_payload: dict = Depends(get_current_user),
):
    """Add a placeholder member (no user_id yet)."""
    member = await insforge.insert("group_members", {
        "group_id": group_id,
        "user_id": None,
        "display_name": req.display_name,
        "age_band": req.age_band,
        "role": "member",
        "sharing_location": False,
    })

    return member


@router.delete("/{group_id}/members/{member_id}")
async def remove_member(
    group_id: str,
    member_id: str,
    token_payload: dict = Depends(get_current_user),
):
    """Remove a member from the group."""
    await insforge.delete(
        "group_members",
        filters={"id": f"eq.{member_id}", "group_id": f"eq.{group_id}"},
    )

    return {"deleted": True}
