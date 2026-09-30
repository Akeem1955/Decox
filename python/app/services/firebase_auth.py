"""Firebase Auth token verification and FastAPI dependency."""
import logging
from typing import Optional, Dict, Any
from fastapi import HTTPException, Header

logger = logging.getLogger(__name__)

# We use google.auth to verify Firebase ID tokens without needing
# the full firebase-admin SDK or a service account key.
# This approach only requires the Firebase project ID.
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.config import settings

FIREBASE_PROJECT_ID = settings.FIREBASE_PROJECT_ID


def verify_firebase_token(token: str) -> Dict[str, Any]:
    """
    Verify a Firebase ID token and return decoded claims.
    
    Returns dict with at least: sub (uid), email, name, email_verified
    """
    try:
        # Firebase ID tokens are standard Google-signed JWTs
        # The audience is the Firebase project ID
        decoded = id_token.verify_firebase_token(
            token,
            google_requests.Request(),
            audience=FIREBASE_PROJECT_ID,
        )
        return decoded
    except ValueError as e:
        logger.warning(f"[Auth] Invalid Firebase token: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired authentication token")
    except Exception as e:
        logger.error(f"[Auth] Token verification error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")


async def get_current_user(
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    """
    FastAPI dependency that extracts and verifies Firebase ID token
    from the Authorization header.
    
    Usage:
        @app.get("/protected")
        async def protected(user: dict = Depends(get_current_user)):
            uid = user["sub"]
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization must be Bearer token")

    token = authorization[7:]  # Strip "Bearer "
    
    if not token:
        raise HTTPException(status_code=401, detail="Token is empty")

    return verify_firebase_token(token)


async def get_optional_user(
    authorization: Optional[str] = Header(default=None),
) -> Optional[Dict[str, Any]]:
    """Optional authentication dependency for public feeds."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:].strip()
    if not token:
        return None
    try:
        return verify_firebase_token(token)
    except Exception:
        return None

