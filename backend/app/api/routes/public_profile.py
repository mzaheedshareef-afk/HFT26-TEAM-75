"""
Student Public Profile & Sharing Endpoints
Provides authenticated profile management and zero-auth shareable public profile views.
Strictly strips private candidate metadata (email, auth tokens, user UUID, raw code, hidden tests).
"""

import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Header, Path, status
from fastapi.responses import JSONResponse
from supabase import Client

from backend.app.core.config import settings
from backend.app.core.security import AuthException
from backend.app.database.supabase import get_supabase_client
from backend.app.schemas.profile import (
    ProfileUpdateRequest,
    ProfileVisibilityRequest,
    PublicStudentProfileView,
    StudentProfileMeResponse,
)
from backend.app.services.auth_service import AuthService
from backend.app.services.profile_service import ProfileService

logger = logging.getLogger(__name__)

profile_router = APIRouter()
public_profile_router = APIRouter()


def require_student_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    client: Client = Depends(get_supabase_client),
) -> Dict[str, Any]:
    """Dependency enforcing authenticated candidate (student) access."""
    if not authorization or not authorization.strip():
        raise AuthException(
            code="UNAUTHORIZED",
            message="Authorization token header is missing",
            status_code=401,
        )
    current_user = AuthService.get_current_user_profile(client, authorization)
    role = str(current_user.get("role", "student"))

    if role != "student":
        raise AuthException(
            code="ROLE_MISMATCH",
            message="Only student accounts can manage student profiles.",
            status_code=403,
        )
    return current_user


# -------------------------------------------------------------
# Authenticated Profile Management Endpoints (/api/profile)
# -------------------------------------------------------------

@profile_router.get(
    "/me",
    summary="Get authenticated student's profile details",
    response_model=StudentProfileMeResponse,
)
@profile_router.get(
    "",
    summary="Get authenticated student's profile details",
    response_model=StudentProfileMeResponse,
)
def get_my_profile(
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """Retrieves authenticated candidate's profile, visibility status, and share URL."""
    profile = ProfileService.get_or_create_profile(client, current_user)
    share_url = f"/public/profile/{profile['share_id']}"

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "id": profile["id"],
            "user_id": profile["user_id"],
            "full_name": profile.get("full_name", ""),
            "public_name": profile.get("public_name", ""),
            "headline": profile.get("headline"),
            "bio": profile.get("bio"),
            "skills": profile.get("skills", []),
            "technologies": profile.get("technologies", []),
            "projects": profile.get("projects", []),
            "portfolio_highlights": profile.get("portfolio_highlights", []),
            "verified_achievements": profile.get("verified_achievements", []),
            "performance_summary": profile.get("performance_summary", {}),
            "visibility": profile.get("visibility", "private"),
            "share_id": profile["share_id"],
            "share_url": share_url,
            "created_at": profile["created_at"],
            "updated_at": profile["updated_at"],
        },
    )


@profile_router.put(
    "/me",
    summary="Update authenticated student's profile details",
    response_model=StudentProfileMeResponse,
)
@profile_router.patch(
    "/me",
    summary="Update authenticated student's profile details",
    response_model=StudentProfileMeResponse,
)
@profile_router.put(
    "",
    summary="Update authenticated student's profile details",
    response_model=StudentProfileMeResponse,
)
@profile_router.patch(
    "",
    summary="Update authenticated student's profile details",
    response_model=StudentProfileMeResponse,
)
def update_my_profile(
    payload: ProfileUpdateRequest,
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """Updates candidate profile information (public name, headline, bio, skills, etc.)."""
    updates = payload.model_dump(exclude_unset=True)
    profile = ProfileService.update_profile(client, current_user, updates)
    share_url = f"/public/profile/{profile['share_id']}"

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "id": profile["id"],
            "user_id": profile["user_id"],
            "full_name": profile.get("full_name", ""),
            "public_name": profile.get("public_name", ""),
            "headline": profile.get("headline"),
            "bio": profile.get("bio"),
            "skills": profile.get("skills", []),
            "technologies": profile.get("technologies", []),
            "projects": profile.get("projects", []),
            "portfolio_highlights": profile.get("portfolio_highlights", []),
            "verified_achievements": profile.get("verified_achievements", []),
            "performance_summary": profile.get("performance_summary", {}),
            "visibility": profile.get("visibility", "private"),
            "share_id": profile["share_id"],
            "share_url": share_url,
            "created_at": profile["created_at"],
            "updated_at": profile["updated_at"],
        },
    )


@profile_router.patch(
    "/me/visibility",
    summary="Update profile visibility (public or private)",
)
@profile_router.put(
    "/me/visibility",
    summary="Update profile visibility (public or private)",
)
@profile_router.patch(
    "/visibility",
    summary="Update profile visibility (public or private)",
)
@profile_router.put(
    "/visibility",
    summary="Update profile visibility (public or private)",
)
def update_profile_visibility(
    payload: ProfileVisibilityRequest,
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """Toggles profile visibility between 'public' and 'private'."""
    profile = ProfileService.set_visibility(client, current_user, payload.visibility)
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "visibility": profile["visibility"],
            "share_id": profile["share_id"],
            "share_url": f"/public/profile/{profile['share_id']}",
            "message": f"Profile visibility updated to {profile['visibility']}.",
        },
    )


@profile_router.post(
    "/me/revoke",
    summary="Revoke existing public share link and generate new share ID",
)
@profile_router.post(
    "/revoke",
    summary="Revoke existing public share link and generate new share ID",
)
def revoke_profile_share_link(
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """Invalidates the existing share link immediately and generates a fresh secret share_id."""
    profile = ProfileService.revoke_share_link(client, current_user)
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "share_id": profile["share_id"],
            "share_url": f"/public/profile/{profile['share_id']}",
            "message": "Previous public profile link has been revoked. A new share link is active.",
        },
    )


# -------------------------------------------------------------
# Public Profile Endpoint (/api/public/profile/{share_id})
# -------------------------------------------------------------

@public_profile_router.get(
    "/{share_id}",
    summary="Get verified public student profile by share ID",
    response_model=PublicStudentProfileView,
)
@profile_router.get(
    "/public/{share_id}",
    summary="Get verified public student profile by share ID",
    response_model=PublicStudentProfileView,
)
def get_public_student_profile(
    share_id: str,
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """
    Publicly accessible endpoint (requires NO authorization token).
    Returns verified achievements and candidate summary if visibility is 'public'.
    Strictly denies access (404) if profile is private or link was revoked.
    Guarantees zero exposure of email, user ID, auth tokens, raw code, or hidden tests.
    """
    profile_data = ProfileService.get_public_profile(client, share_id)
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=profile_data,
    )
