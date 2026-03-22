from __future__ import annotations

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from services.insforge_service import insforge

_security = HTTPBearer()
_security_optional = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
) -> dict:
    """Validate token via InsForge and return the user payload. Raises 401 on failure."""
    try:
        result = await insforge.get_auth_user(credentials.credentials)
        user = result.get("user", {})
        if not user.get("id"):
            raise HTTPException(status_code=401, detail="Invalid token payload")
        # Return a payload dict compatible with existing code (sub = user id)
        return {"sub": user["id"], "email": user.get("email", ""), "role": user.get("role", "")}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_security_optional),
) -> dict | None:
    """Same as get_current_user but returns None when no token is provided."""
    if credentials is None:
        return None
    try:
        result = await insforge.get_auth_user(credentials.credentials)
        user = result.get("user", {})
        if not user.get("id"):
            return None
        return {"sub": user["id"], "email": user.get("email", ""), "role": user.get("role", "")}
    except Exception:
        return None
