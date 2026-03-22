from __future__ import annotations

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from config import INSFORGE_JWT_SECRET

_security = HTTPBearer()
_security_optional = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
) -> dict:
    """Decode InsForge JWT and return the payload. Raises 401 on failure."""
    try:
        payload = jwt.decode(
            credentials.credentials,
            INSFORGE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        if "sub" not in payload:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_security_optional),
) -> dict | None:
    """Same as get_current_user but returns None when no token is provided."""
    if credentials is None:
        return None
    try:
        payload = jwt.decode(
            credentials.credentials,
            INSFORGE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        return payload if "sub" in payload else None
    except jwt.InvalidTokenError:
        return None
