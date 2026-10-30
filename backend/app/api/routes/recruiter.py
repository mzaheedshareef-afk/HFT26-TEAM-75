"""
FastAPI Routes for Company Profile, Recruiter Candidate Discovery, Shortlisting & Comparison.
Role: Testing & Integration Lead (Vasil)
Project: Portfolio-Driven Adaptive Coding & Technical Assessment Platform
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from supabase import Client

from backend.app.core.security import AuthException
from backend.app.database.supabase import get_supabase_client
from backend.app.schemas.recruiter import (
    AddShortlistRequest,
    CandidateSearchResponse,
    CompanyProfileResponse,
    CompareCandidatesRequest,
    CompareCandidatesResponse,
    RecruiterCandidateDetail,
    RecruiterDashboardResponse,
    ShortlistItem,
    ShortlistResponse,
    UpdateCompanyProfileRequest,
    UpdateShortlistNotesRequest,
)
from backend.app.services.auth_service import AuthService
from backend.app.services.recruiter_service import RecruiterService

logger = logging.getLogger(__name__)

recruiter_router = APIRouter()
company_router = APIRouter()


def require_company_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    client: Client = Depends(get_supabase_client),
) -> Dict[str, Any]:
    """
    Dependency enforcing authenticated company recruiter access.
    Rejects student accounts and unauthenticated requests with standard security codes.
    """
    if not authorization or not authorization.strip():
        raise AuthException(
            code="UNAUTHORIZED",
            message="Authorization token header is missing",
            status_code=401,
        )

    current_user = AuthService.get_current_user_profile(client, authorization)
    role = str(current_user.get("role", "company"))

    if role != "company":
        raise AuthException(
            code="ROLE_MISMATCH",
            message="Only company recruiter accounts can access recruiter APIs.",
            status_code=403,
        )

    return current_user


# =============================================================
# MODULE 1 — COMPANY PROFILE ENDPOINTS
# =============================================================

@company_router.get(
    "/me",
    summary="Get authenticated company profile",
    response_model=CompanyProfileResponse,
    status_code=status.HTTP_200_OK,
)
def get_company_profile_endpoint(
    current_user: Dict[str, Any] = Depends(require_company_user),
    client: Client = Depends(get_supabase_client),
) -> CompanyProfileResponse:
    """Retrieves authenticated company account profile and metadata."""
    profile_data = RecruiterService.get_company_profile(client, current_user)
    return CompanyProfileResponse(**profile_data)


@company_router.patch(
    "/me",
    summary="Update authenticated company profile",
    response_model=CompanyProfileResponse,
    status_code=status.HTTP_200_OK,
)
@company_router.put(
    "/me",
    summary="Update authenticated company profile (PUT alias)",
    response_model=CompanyProfileResponse,
    status_code=status.HTTP_200_OK,
)
def update_company_profile_endpoint(
    request: UpdateCompanyProfileRequest,
    current_user: Dict[str, Any] = Depends(require_company_user),
    client: Client = Depends(get_supabase_client),
) -> CompanyProfileResponse:
    """Updates company profile metadata while preserving identity and role."""
    updates = request.model_dump(exclude_unset=True)
    updated_profile = RecruiterService.update_company_profile(client, current_user, updates)
    return CompanyProfileResponse(**updated_profile)


# =============================================================
# MODULE 2 — CANDIDATE DISCOVERY ENDPOINTS
# =============================================================

@recruiter_router.get(
    "/candidates",
    summary="Discover and filter verified public talent",
    response_model=CandidateSearchResponse,
    status_code=status.HTTP_200_OK,
)
def search_candidates_endpoint(
    q: Optional[str] = Query(None, description="Free-text search across candidate name, skills, bio"),
    query: Optional[str] = Query(None, description="Free-text search alias"),
    languages: Optional[str] = Query(None, description="Comma-separated programming languages"),
    skills: Optional[str] = Query(None, description="Comma-separated technical skills"),
    frameworks: Optional[str] = Query(None, description="Comma-separated frameworks"),
    domain: Optional[str] = Query(None, description="Problem domain / topic"),
    min_score: Optional[float] = Query(None, ge=0.0, le=100.0, description="Minimum overall score"),
    max_score: Optional[float] = Query(None, ge=0.0, le=100.0, description="Maximum overall score"),
    min_coding_score: Optional[float] = Query(None, ge=0.0, le=100.0, description="Minimum coding score"),
    min_ai_efficiency_score: Optional[float] = Query(None, ge=0.0, le=100.0, description="Minimum AI efficiency score"),
    min_consistency: Optional[float] = Query(None, ge=0.0, le=100.0, description="Minimum consistency score"),
    min_completions: Optional[int] = Query(None, ge=0, description="Minimum completed assessments"),
    min_improvement: Optional[float] = Query(None, description="Minimum trajectory improvement delta"),
    sort_by: Optional[str] = Query("highest_score", description="Sort criteria"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    current_user: Dict[str, Any] = Depends(require_company_user),
    client: Client = Depends(get_supabase_client),
) -> CandidateSearchResponse:
    """
    Searches candidates whose profiles have explicitly enabled recruiter visibility.
    Private student profiles are strictly excluded.
    """
    if min_score is not None and max_score is not None and min_score > max_score:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="min_score cannot be greater than max_score.",
        )

    search_query = q or query
    lang_list = [l.strip() for l in languages.split(",") if l.strip()] if languages else None
    skill_list = [s.strip() for s in skills.split(",") if s.strip()] if skills else None
    fw_list = [f.strip() for f in frameworks.split(",") if f.strip()] if frameworks else None

    result = RecruiterService.search_candidates(
        client=client,
        company_id=str(current_user["id"]),
        query=search_query,
        languages=lang_list,
        skills=skill_list,
        frameworks=fw_list,
        domain=domain,
        min_score=min_score,
        max_score=max_score,
        min_coding_score=min_coding_score,
        min_ai_efficiency_score=min_ai_efficiency_score,
        min_consistency=min_consistency,
        min_completions=min_completions,
        min_improvement=min_improvement,
        sort_by=sort_by or "highest_score",
        page=page,
        limit=limit,
    )
    return CandidateSearchResponse(**result)


# =============================================================
# MODULE 3 — CANDIDATE PROFILE DETAILS ENDPOINT
# =============================================================

@recruiter_router.get(
    "/candidates/{student_id}",
    summary="Get verified candidate profile for recruiters",
    response_model=RecruiterCandidateDetail,
    status_code=status.HTTP_200_OK,
)
def get_candidate_detail_endpoint(
    student_id: str,
    current_user: Dict[str, Any] = Depends(require_company_user),
    client: Client = Depends(get_supabase_client),
) -> RecruiterCandidateDetail:
    """
    Retrieves approved recruiter view of a candidate profile.
    Demarcates self-reported portfolio from verified assessment accomplishments.
    Guarantees zero exposure of private student emails, internal UUIDs, or hidden test cases.
    """
    return RecruiterService.get_candidate_detail(
        client=client,
        company_id=str(current_user["id"]),
        student_id=student_id,
    )


# =============================================================
# MODULE 4 — SHORTLISTED CANDIDATES ENDPOINTS
# =============================================================

@recruiter_router.post(
    "/shortlist/{student_id}",
    summary="Shortlist a candidate",
    status_code=status.HTTP_201_CREATED,
)
def add_to_shortlist_endpoint(
    student_id: str,
    request: Optional[AddShortlistRequest] = None,
    current_user: Dict[str, Any] = Depends(require_company_user),
    client: Client = Depends(get_supabase_client),
) -> Dict[str, Any]:
    """Adds a public candidate to the company's shortlist with optional private notes."""
    notes = request.notes if request else None
    return RecruiterService.add_to_shortlist(
        client=client,
        company_id=str(current_user["id"]),
        student_id=student_id,
        notes=notes,
    )


@recruiter_router.delete(
    "/shortlist/{student_id}",
    summary="Remove a candidate from shortlist",
    status_code=status.HTTP_200_OK,
)
def remove_from_shortlist_endpoint(
    student_id: str,
    current_user: Dict[str, Any] = Depends(require_company_user),
    client: Client = Depends(get_supabase_client),
) -> Dict[str, Any]:
    """Removes a candidate from the company's shortlist."""
    return RecruiterService.remove_from_shortlist(
        client=client,
        company_id=str(current_user["id"]),
        student_id=student_id,
    )


@recruiter_router.patch(
    "/shortlist/{student_id}/notes",
    summary="Update recruiter notes for a shortlisted candidate",
    status_code=status.HTTP_200_OK,
)
@recruiter_router.put(
    "/shortlist/{student_id}/notes",
    summary="Update recruiter notes (PUT alias)",
    status_code=status.HTTP_200_OK,
)
def update_shortlist_notes_endpoint(
    student_id: str,
    request: UpdateShortlistNotesRequest,
    current_user: Dict[str, Any] = Depends(require_company_user),
    client: Client = Depends(get_supabase_client),
) -> Dict[str, Any]:
    """Updates private internal notes for a shortlisted candidate."""
    return RecruiterService.update_shortlist_notes(
        client=client,
        company_id=str(current_user["id"]),
        student_id=student_id,
        notes=request.notes,
    )


@recruiter_router.get(
    "/shortlist",
    summary="Retrieve company's shortlisted candidates",
    response_model=ShortlistResponse,
    status_code=status.HTTP_200_OK,
)
def get_company_shortlist_endpoint(
    query: Optional[str] = Query(None, description="Search across notes and candidate name"),
    sort_by: Optional[str] = Query("date_added", description="Sort by date_added, score, or name"),
    current_user: Dict[str, Any] = Depends(require_company_user),
    client: Client = Depends(get_supabase_client),
) -> ShortlistResponse:
    """
    Retrieves all candidates shortlisted by the authenticated company.
    Re-checks candidate visibility dynamically: if candidate has revoked sharing,
    redacts details and marks is_visible=False.
    """
    result = RecruiterService.get_company_shortlist(
        client=client,
        company_id=str(current_user["id"]),
        query=query,
        sort_by=sort_by or "date_added",
    )
    return ShortlistResponse(**result)


# =============================================================
# MODULE 5 — CANDIDATE COMPARISON ENDPOINT
# =============================================================

@recruiter_router.post(
    "/compare",
    summary="Compare up to four public candidates side-by-side",
    response_model=CompareCandidatesResponse,
    status_code=status.HTTP_200_OK,
)
def compare_candidates_endpoint(
    request: CompareCandidatesRequest,
    current_user: Dict[str, Any] = Depends(require_company_user),
    client: Client = Depends(get_supabase_client),
) -> CompareCandidatesResponse:
    """
    Generates side-by-side comparison across 2 to 4 candidates.
    Strictly verifies each candidate's recruiter visibility.
    """
    return RecruiterService.compare_candidates(
        client=client,
        company_id=str(current_user["id"]),
        student_ids=request.student_ids,
    )


# =============================================================
# MODULE 6 — RECRUITER DASHBOARD ANALYTICS ENDPOINT
# =============================================================

@recruiter_router.get(
    "/dashboard",
    summary="Get recruiter dashboard talent analytics",
    response_model=RecruiterDashboardResponse,
    status_code=status.HTTP_200_OK,
)
def get_recruiter_dashboard_endpoint(
    current_user: Dict[str, Any] = Depends(require_company_user),
    client: Client = Depends(get_supabase_client),
) -> RecruiterDashboardResponse:
    """Compiles talent pool discovery statistics and company shortlist activity."""
    return RecruiterService.get_recruiter_dashboard(
        client=client,
        company_id=str(current_user["id"]),
    )
