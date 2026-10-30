from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, Optional, Tuple
import httpx
import jwt
from postgrest.exceptions import APIError
from supabase import Client
from supabase_auth.errors import AuthApiError, AuthError

from backend.app.core.config import settings
from backend.app.core.security import (
    AuthException,
    validate_password_strength,
    verify_supabase_jwt,
)
from backend.app.schemas.auth import (
    CompanyLoginRequest,
    CompanyRegisterRequest,
    StudentLoginRequest,
    StudentRegisterRequest,
    UserDetail,
)

logger = logging.getLogger(__name__)


def build_user_detail_from_profile(profile: Dict[str, Any]) -> UserDetail:
    """Safely map Supabase profile row to public UserDetail schema."""
    return UserDetail(
        id=str(profile.get("id")),
        name=str(profile.get("full_name") or ""),
        email=str(profile.get("email") or ""),
        role=str(profile.get("role") or ""),
    )


def generate_fallback_access_token(user_id: str, email: str, role: str) -> str:
    """
    Generate a signed JWT access token compatible with Supabase Auth schema.
    Used when sign_up returns a confirmed user without an immediate session.
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=60 * 24)
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": "authenticated",
        "app_role": role,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")


class AuthService:
    @staticmethod
    def register_student(client: Client, request: StudentRegisterRequest) -> Tuple[Dict[str, Any], str]:
        """
        Registers a new student using Supabase Auth and inserts profile into 'profiles'.
        """
        is_strong, err_msg = validate_password_strength(request.password)
        if not is_strong:
            raise AuthException(
                code="WEAK_PASSWORD",
                message=err_msg or "Password does not meet security criteria",
                status_code=400,
            )

        try:
            # 1. Register with Supabase Auth
            auth_response = client.auth.sign_up({
                "email": request.email,
                "password": request.password,
                "options": {
                    "data": {
                        "full_name": request.full_name,
                        "role": "student",
                    }
                },
            })

            user = auth_response.user
            if not user or (hasattr(user, "identities") and user.identities == []):
                raise AuthException(
                    code="EMAIL_ALREADY_EXISTS",
                    message="An account with this email already exists",
                    status_code=409,
                )

            user_id = str(user.id)

            # 2. Insert into profiles table
            profile_record = {
                "id": user_id,
                "full_name": request.full_name,
                "email": request.email,
                "role": "student",
                "is_active": True,
            }

            try:
                profile_res = client.table("profiles").insert(profile_record).execute()
                if profile_res.data and len(profile_res.data) > 0:
                    saved_profile = profile_res.data[0]
                else:
                    saved_profile = profile_record
            except APIError as pe:
                if pe.code == "23505" or "unique" in str(pe.message).lower():
                    raise AuthException(
                        code="EMAIL_ALREADY_EXISTS",
                        message="An account with this email already exists",
                        status_code=409,
                    )
                logger.error(f"Profile creation failed: {pe}")
                raise AuthException(
                    code="PROFILE_CREATION_FAILED",
                    message="Failed to create user profile",
                    status_code=500,
                )

            # 3. Retrieve or generate access token
            token = (
                auth_response.session.access_token
                if auth_response.session and auth_response.session.access_token
                else generate_fallback_access_token(user_id, request.email, "student")
            )

            return saved_profile, token

        except (AuthApiError, AuthError) as e:
            err_str = str(e).lower()
            if "already registered" in err_str or "already exists" in err_str or "user_already_exists" in err_str:
                raise AuthException(
                    code="EMAIL_ALREADY_EXISTS",
                    message="An account with this email already exists",
                    status_code=409,
                )
            if "weak" in err_str or "password" in err_str:
                raise AuthException(
                    code="WEAK_PASSWORD",
                    message="Password does not meet security criteria",
                    status_code=400,
                )
            logger.error(f"Supabase auth error during student registration: {e}")
            raise AuthException(
                code="SUPABASE_AUTH_ERROR",
                message=str(e),
                status_code=400,
            )
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            logger.error(f"Supabase network error: {e}")
            raise AuthException(
                code="SERVICE_UNAVAILABLE",
                message="Supabase service is temporarily unavailable. Please try again later.",
                status_code=503,
            )

    @staticmethod
    def register_company(client: Client, request: CompanyRegisterRequest) -> Tuple[Dict[str, Any], str]:
        """
        Registers a new company user using Supabase Auth and stores company_name in profiles.full_name.
        """
        is_strong, err_msg = validate_password_strength(request.password)
        if not is_strong:
            raise AuthException(
                code="WEAK_PASSWORD",
                message=err_msg or "Password does not meet security criteria",
                status_code=400,
            )

        try:
            # 1. Register with Supabase Auth
            auth_response = client.auth.sign_up({
                "email": request.official_email,
                "password": request.password,
                "options": {
                    "data": {
                        "company_name": request.company_name,
                        "full_name": request.company_name,
                        "role": "company",
                    }
                },
            })

            user = auth_response.user
            if not user or (hasattr(user, "identities") and user.identities == []):
                raise AuthException(
                    code="EMAIL_ALREADY_EXISTS",
                    message="An account with this email already exists",
                    status_code=409,
                )

            user_id = str(user.id)

            # 2. Insert into profiles table
            profile_record = {
                "id": user_id,
                "full_name": request.company_name,
                "email": request.official_email,
                "role": "company",
                "is_active": True,
            }

            try:
                profile_res = client.table("profiles").insert(profile_record).execute()
                if profile_res.data and len(profile_res.data) > 0:
                    saved_profile = profile_res.data[0]
                else:
                    saved_profile = profile_record
            except APIError as pe:
                if pe.code == "23505" or "unique" in str(pe.message).lower():
                    raise AuthException(
                        code="EMAIL_ALREADY_EXISTS",
                        message="An account with this email already exists",
                        status_code=409,
                    )
                logger.error(f"Profile creation failed: {pe}")
                raise AuthException(
                    code="PROFILE_CREATION_FAILED",
                    message="Failed to create user profile",
                    status_code=500,
                )

            # 3. Retrieve or generate access token
            token = (
                auth_response.session.access_token
                if auth_response.session and auth_response.session.access_token
                else generate_fallback_access_token(user_id, request.official_email, "company")
            )

            return saved_profile, token

        except (AuthApiError, AuthError) as e:
            err_str = str(e).lower()
            if "already registered" in err_str or "already exists" in err_str or "user_already_exists" in err_str:
                raise AuthException(
                    code="EMAIL_ALREADY_EXISTS",
                    message="An account with this email already exists",
                    status_code=409,
                )
            if "weak" in err_str or "password" in err_str:
                raise AuthException(
                    code="WEAK_PASSWORD",
                    message="Password does not meet security criteria",
                    status_code=400,
                )
            logger.error(f"Supabase auth error during company registration: {e}")
            raise AuthException(
                code="SUPABASE_AUTH_ERROR",
                message=str(e),
                status_code=400,
            )
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            logger.error(f"Supabase network error: {e}")
            raise AuthException(
                code="SERVICE_UNAVAILABLE",
                message="Supabase service is temporarily unavailable. Please try again later.",
                status_code=503,
            )

    @staticmethod
    def login_student(client: Client, request: StudentLoginRequest) -> Tuple[Dict[str, Any], str]:
        """
        Authenticates student via Supabase Auth and verifies student role.
        """
        try:
            auth_response = client.auth.sign_in_with_password({
                "email": request.email,
                "password": request.password,
            })
        except (AuthApiError, AuthError) as e:
            # Prevent user enumeration / credential fishing
            raise AuthException(
                code="INVALID_CREDENTIALS",
                message="Email or password is incorrect",
                status_code=401,
            )
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            logger.error(f"Supabase network error: {e}")
            raise AuthException(
                code="SERVICE_UNAVAILABLE",
                message="Supabase service is temporarily unavailable. Please try again later.",
                status_code=503,
            )

        if not auth_response.user:
            raise AuthException(
                code="INVALID_CREDENTIALS",
                message="Email or password is incorrect",
                status_code=401,
            )

        user_id = str(auth_response.user.id)

        # Retrieve profile
        try:
            profile_res = client.table("profiles").select("*").eq("id", user_id).execute()
        except Exception as pe:
            logger.error(f"Failed to query profiles table: {pe}")
            raise AuthException(
                code="DATABASE_ERROR",
                message="Failed to retrieve user profile",
                status_code=500,
            )

        if not profile_res.data:
            # Fallback to metadata if profiles row was created by trigger
            metadata = getattr(auth_response.user, "user_metadata", {}) or {}
            profile = {
                "id": user_id,
                "full_name": metadata.get("full_name") or metadata.get("name") or "Candidate",
                "email": request.email,
                "role": metadata.get("role") or "student",
                "is_active": True,
            }
        else:
            profile = profile_res.data[0]

        # Verify active status
        if not profile.get("is_active", True):
            raise AuthException(
                code="ACCOUNT_INACTIVE",
                message="Account is deactivated. Please contact support.",
                status_code=403,
            )

        # Verify student role
        if profile.get("role") != "student":
            raise AuthException(
                code="ROLE_MISMATCH",
                message="Role mismatch: Account is registered as a company. Please use the company portal.",
                status_code=403,
            )

        token = (
            auth_response.session.access_token
            if auth_response.session and auth_response.session.access_token
            else generate_fallback_access_token(user_id, request.email, "student")
        )

        return profile, token

    @staticmethod
    def login_company(client: Client, request: CompanyLoginRequest) -> Tuple[Dict[str, Any], str]:
        """
        Authenticates company user via Supabase Auth and verifies company role.
        """
        target_email = request.email or request.official_email
        if not target_email:
            raise AuthException(
                code="MISSING_FIELDS",
                message="email or official_email is required",
                status_code=422,
            )

        try:
            auth_response = client.auth.sign_in_with_password({
                "email": target_email,
                "password": request.password,
            })
        except (AuthApiError, AuthError) as e:
            # Do not reveal whether email exists
            raise AuthException(
                code="INVALID_CREDENTIALS",
                message="Email or password is incorrect",
                status_code=401,
            )
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            logger.error(f"Supabase network error: {e}")
            raise AuthException(
                code="SERVICE_UNAVAILABLE",
                message="Supabase service is temporarily unavailable. Please try again later.",
                status_code=503,
            )

        if not auth_response.user:
            raise AuthException(
                code="INVALID_CREDENTIALS",
                message="Email or password is incorrect",
                status_code=401,
            )

        user_id = str(auth_response.user.id)

        # Retrieve profile
        try:
            profile_res = client.table("profiles").select("*").eq("id", user_id).execute()
        except Exception as pe:
            logger.error(f"Failed to query profiles table: {pe}")
            raise AuthException(
                code="DATABASE_ERROR",
                message="Failed to retrieve user profile",
                status_code=500,
            )

        if not profile_res.data:
            metadata = getattr(auth_response.user, "user_metadata", {}) or {}
            profile = {
                "id": user_id,
                "full_name": metadata.get("company_name") or metadata.get("full_name") or "Company",
                "email": target_email,
                "role": metadata.get("role") or "company",
                "is_active": True,
            }
        else:
            profile = profile_res.data[0]

        # Verify active status
        if not profile.get("is_active", True):
            raise AuthException(
                code="ACCOUNT_INACTIVE",
                message="Account is deactivated. Please contact support.",
                status_code=403,
            )

        # Verify company role
        if profile.get("role") != "company":
            raise AuthException(
                code="ROLE_MISMATCH",
                message="Role mismatch: Account is registered as a student. Please use the student portal.",
                status_code=403,
            )

        token = (
            auth_response.session.access_token
            if auth_response.session and auth_response.session.access_token
            else generate_fallback_access_token(user_id, target_email, "company")
        )

        return profile, token

    @staticmethod
    def get_current_user_profile(client: Client, token: str) -> Dict[str, Any]:
        """
        Cryptographically verifies access token signature and returns active profile.
        """
        payload = verify_supabase_jwt(token)
        user_id = payload.get("sub")
        if not user_id:
            raise AuthException(
                code="INVALID_TOKEN",
                message="Invalid token payload: missing subject identifier",
                status_code=401,
            )

        try:
            profile_res = client.table("profiles").select("*").eq("id", str(user_id)).execute()
        except Exception as pe:
            logger.error(f"Database error querying profile: {pe}")
            raise AuthException(
                code="DATABASE_ERROR",
                message="Failed to query user profile",
                status_code=500,
            )

        if not profile_res.data:
            raise AuthException(
                code="INVALID_TOKEN",
                message="User profile associated with token does not exist",
                status_code=401,
            )

        profile = profile_res.data[0]

        if not profile.get("is_active", True):
            raise AuthException(
                code="ACCOUNT_INACTIVE",
                message="Account is deactivated",
                status_code=403,
            )

        return profile

    @staticmethod
    def update_user_profile(
        client: Client,
        user_id: str,
        current_profile: Dict[str, Any],
        updates: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Updates profile fields while strictly prohibiting role changes (privilege escalation).
        """
        if "role" in updates and updates["role"] != current_profile.get("role"):
            raise AuthException(
                code="ROLE_MODIFICATION_PROHIBITED",
                message="Modifying account role is strictly prohibited.",
                status_code=403,
            )

        filtered_updates = {k: v for k, v in updates.items() if k not in ["id", "role", "created_at"]}
        res = client.table("profiles").update(filtered_updates).eq("id", user_id).execute()
        return res.data[0] if res.data else current_profile
