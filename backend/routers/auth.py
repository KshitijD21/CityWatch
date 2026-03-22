from fastapi import APIRouter, Depends, HTTPException
from models.schemas import (
    SignupRequest,
    LoginRequest,
    AuthResponse,
    UserProfile,
    UserUpdateRequest,
)
from services.insforge_service import insforge
from utils.helpers import get_current_user

router = APIRouter()


@router.post("/signup", response_model=AuthResponse)
async def signup(req: SignupRequest):
    """Create account via InsForge auth, then store profile in users table."""
    # 1. Create auth user in InsForge
    auth_result = await insforge.sign_up(req.email, req.password, req.name)

    user_id = auth_result.get("user", {}).get("id")
    access_token = auth_result.get("accessToken", "")
    if not user_id:
        raise HTTPException(status_code=500, detail="Signup failed: no user id returned")

    # 2. Insert profile row in users table
    await insforge.insert("users", {
        "id": user_id,
        "email": req.email,
        "name": req.name,
        "age_band": req.age_band,
        "onboarded": False,
    })

    return AuthResponse(user_id=user_id, token=access_token, onboarded=False)


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    """Log in with email+password or Google token."""
    # 1. Authenticate via InsForge
    if req.google_token:
        auth_result = await insforge.sign_in_google(req.google_token)
    else:
        auth_result = await insforge.sign_in_password(req.email, req.password)

    user_id = auth_result.get("user", {}).get("id")
    access_token = auth_result.get("accessToken", "")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication failed")

    # 2. Get onboarded status from users table
    try:
        user_row = await insforge.query(
            "users",
            select="onboarded",
            filters={"id": f"eq.{user_id}"},
            single=True,
        )
        onboarded = user_row.get("onboarded", False)
    except HTTPException:
        # First Google OAuth login — user row doesn't exist yet
        email = auth_result.get("user", {}).get("email", "")
        await insforge.insert("users", {
            "id": user_id,
            "email": email,
            "name": email.split("@")[0],
            "age_band": "adult",
            "onboarded": False,
        })
        onboarded = False

    return AuthResponse(user_id=user_id, token=access_token, onboarded=onboarded)


@router.get("/me", response_model=UserProfile)
async def get_me(token_payload: dict = Depends(get_current_user)):
    """Get current user profile with groups and saved places."""
    user_id = token_payload["sub"]

    user_row = await insforge.query(
        "users",
        filters={"id": f"eq.{user_id}"},
        single=True,
    )

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
