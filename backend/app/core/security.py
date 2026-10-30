from datetime import datetime, timezone
import re
from typing import Any, Dict, Optional, Tuple
import jwt
from backend.app.core.config import settings


class AuthException(Exception):
    """Base application exception for authentication and authorization errors."""

    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def validate_password_strength(password: str) -> Tuple[bool, Optional[str]]:
    """
    Validate password complexity:
    - Minimum 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one number
    """
    if not password or len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r"\d", password):
        return False, "Password must contain at least one number"
    return True, None


def verify_supabase_jwt(token: str) -> Dict[str, Any]:
    """
    Cryptographically verify incoming Supabase access token signature and expiration.
    Uses SUPABASE_JWT_SECRET to prevent accepting untrusted or forged tokens.
    """
    if not token or not isinstance(token, str):
        raise AuthException(
            code="INVALID_TOKEN",
            message="Authorization token is missing or invalid",
            status_code=401,
        )

    clean_token = token.strip()
    if clean_token.lower().startswith("bearer "):
        clean_token = clean_token[7:].strip()

    try:
        payload = jwt.decode(
            clean_token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_signature": True, "verify_exp": True},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthException(
            code="EXPIRED_TOKEN",
            message="Token has expired",
            status_code=401,
        )
    except jwt.InvalidTokenError:
        raise AuthException(
            code="INVALID_TOKEN",
            message="Invalid or malformed token signature",
            status_code=401,
        )
    except Exception as e:
        raise AuthException(
            code="INVALID_TOKEN",
            message=f"Token verification failed: {str(e)}",
            status_code=401,
        )
