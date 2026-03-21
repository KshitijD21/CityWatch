from fastapi import APIRouter

router = APIRouter()

@router.post("/signup")
async def signup():
    """Create account."""
    return {"message": "TODO"}

@router.post("/login")
async def login():
    """Log in."""
    return {"message": "TODO"}

@router.get("/me")
async def get_me():
    """Get current user profile."""
    return {"message": "TODO"}

@router.put("/me")
async def update_me():
    """Update profile."""
    return {"message": "TODO"}

@router.put("/me/onboarded")
async def mark_onboarded():
    """Mark onboarding complete."""
    return {"message": "TODO"}
