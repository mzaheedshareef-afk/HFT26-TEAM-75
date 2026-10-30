from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client

from backend.app.core.security import AuthException
from backend.app.database.supabase import get_supabase_client
from backend.app.schemas.auth import (
    AuthResponse,
    CompanyLoginRequest,
    CompanyRegisterRequest,
    MeResponse,
    StudentLoginRequest,
    StudentRegisterRequest,
)
from backend.app.services.auth_service import AuthService, build_user_detail_from_profile

router = APIRouter()
security_bearer = HTTPBearer(auto_error=False)


def get_current_user_dependency(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    client: Client = Depends(get_supabase_client),
) -> Dict[str, Any]:
    """Dependency extracting and verifying the Supabase JWT token from the Authorization header."""
    if not credentials or not credentials.credentials:
        raise AuthException(
            code="INVALID_TOKEN",
            message="Authorization token is missing or malformed",
            status_code=401,
        )
    return AuthService.get_current_user_profile(client=client, token=credentials.credentials)


# -------------------------------------------------------------
# Student Endpoints
# -------------------------------------------------------------

@router.post(
    "/student/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new student account",
    description="Registers a new student with Supabase Auth and creates a profile.",
)
def register_student(
    request: StudentRegisterRequest,
    client: Client = Depends(get_supabase_client),
) -> AuthResponse:
    profile, token = AuthService.register_student(client=client, request=request)
    return AuthResponse(
        success=True,
        access_token=token,
        token_type="bearer",
        user=build_user_detail_from_profile(profile),
    )


@router.post(
    "/student/login",
    response_model=AuthResponse,
    status_code=status.HTTP_200_OK,
    summary="Student login",
    description="Authenticates student credentials via Supabase Auth and returns an access token.",
)
def login_student(
    request: StudentLoginRequest,
    client: Client = Depends(get_supabase_client),
) -> AuthResponse:
    profile, token = AuthService.login_student(client=client, request=request)
    return AuthResponse(
        success=True,
        access_token=token,
        token_type="bearer",
        user=build_user_detail_from_profile(profile),
    )


# -------------------------------------------------------------
# Company Endpoints
# -------------------------------------------------------------

@router.post(
    "/company/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new company account",
    description="Registers a new company account with Supabase Auth, mapping company_name to display name.",
)
def register_company(
    request: CompanyRegisterRequest,
    client: Client = Depends(get_supabase_client),
) -> AuthResponse:
    profile, token = AuthService.register_company(client=client, request=request)
    return AuthResponse(
        success=True,
        access_token=token,
        token_type="bearer",
        user=build_user_detail_from_profile(profile),
    )


@router.post(
    "/company/login",
    response_model=AuthResponse,
    status_code=status.HTTP_200_OK,
    summary="Company login",
    description="Authenticates company credentials via Supabase Auth and returns an access token.",
)
def login_company(
    request: CompanyLoginRequest,
    client: Client = Depends(get_supabase_client),
) -> AuthResponse:
    profile, token = AuthService.login_company(client=client, request=request)
    return AuthResponse(
        success=True,
        access_token=token,
        token_type="bearer",
        user=build_user_detail_from_profile(profile),
    )


# -------------------------------------------------------------
# Current User Endpoint
# -------------------------------------------------------------

@router.get(
    "/me",
    response_model=MeResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current user profile",
    description="Retrieves the authenticated profile using the verified Supabase Bearer token.",
)
def get_me(
    current_profile: Dict[str, Any] = Depends(get_current_user_dependency),
) -> MeResponse:
    return MeResponse(
        success=True,
        user=build_user_detail_from_profile(current_profile),
    )
