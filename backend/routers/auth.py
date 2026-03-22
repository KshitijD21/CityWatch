from fastapi import APIRouter, Depends, HTTPException
from models.schemas import (
    UserProfile,
    UserUpdateRequest,
    InitProfileRequest,
)
from services.insforge_service import insforge
from utils.helpers import get_current_user

router = APIRouter()


@router.post("/init")
async def init_profile(
    req: InitProfileRequest,
    token_payload: dict = Depends(get_current_user),
):
    """Create users table row if it doesn't exist. Idempotent."""
    user_id = token_payload["sub"]
    email = token_payload.get("email", "")

    # Check if user row already exists
    try:
        existing = await insforge.query(
            "users",
            select="id,onboarded",
            filters={"id": f"eq.{user_id}"},
            single=True,
        )
        return {"user_id": existing["id"], "onboarded": existing.get("onboarded", False)}
    except HTTPException:
        pass

    # Create user row
    await insforge.insert("users", {
        "id": user_id,
        "email": email,
        "name": req.name,
        "age_band": req.age_band,
        "onboarded": False,
    })
    return {"user_id": user_id, "onboarded": False}


@router.get("/me", response_model=UserProfile)
async def get_me(token_payload: dict = Depends(get_current_user)):
    """Get current user profile with groups and saved places."""
    user_id = token_payload["sub"]

    try:
        user_row = await insforge.query(
            "users",
            filters={"id": f"eq.{user_id}"},
            single=True,
        )
    except HTTPException:
        raise HTTPException(status_code=404, detail="User profile not found")

    # Get groups via group_members join
    memberships = await insforge.query(
        "group_members",
        select="group_id,role,groups(id,name,type,invite_code,created_at)",
        filters={"user_id": f"eq.{user_id}"},
    )
    groups = [m["groups"] for m in memberships if m.get("groups")]

    # Get saved places
    places = await insforge.query(
        "saved_places",
        filters={"user_id": f"eq.{user_id}"},
    )

    return UserProfile(
        id=user_row["id"],
        email=user_row["email"],
        name=user_row["name"],
        age_band=user_row["age_band"],
        avatar_url=user_row.get("avatar_url"),
        onboarded=user_row["onboarded"],
        notification_prefs=user_row.get("notification_prefs") or {},
        groups=groups,
        saved_places=places,
    )


@router.put("/me")
async def update_me(
    req: UserUpdateRequest,
    token_payload: dict = Depends(get_current_user),
):
    """Update profile fields."""
    user_id = token_payload["sub"]
    update_data = req.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    updated = await insforge.update(
        "users",
        update_data,
        filters={"id": f"eq.{user_id}"},
    )
    return updated


@router.put("/me/onboarded")
async def mark_onboarded(token_payload: dict = Depends(get_current_user)):
    """Mark onboarding complete."""
    user_id = token_payload["sub"]
    await insforge.update(
        "users",
        {"onboarded": True},
        filters={"id": f"eq.{user_id}"},
    )
    return {"onboarded": True}
