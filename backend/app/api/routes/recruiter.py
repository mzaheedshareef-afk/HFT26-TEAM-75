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
    CompanySettingsUpdateRequest,
    CompareCandidatesRequest,
    CompareCandidatesResponse,
    RecruiterCandidateDetail,
    RecruiterDashboardResponse,
    SavedCandidateSearchRequest,
    SavedCandidateSearchResponse,
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
# MODULE 1 — COMPANY PROFILE & SETTINGS ENDPOINTS
# =============================================================

@company_router.get(
    "/me",
    summary="Get authenticated company profile",
    response_model=CompanyProfileResponse,
    status_code=status.HTTP_200_OK,
)
@company_router.get(
    "/profile",
    summary="Get company profile (alias)",
    response_model=CompanyProfileResponse,
    status_code=status.HTTP_200_OK,
)
@recruiter_router.get(
    "/company/profile",
    summary="Get recruiter company profile",
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
@company_router.patch(
    "/profile",
    summary="Update company profile (alias)",
    response_model=CompanyProfileResponse,
    status_code=status.HTTP_200_OK,
)
@company_router.put(
    "/profile",
    summary="Update company profile (PUT alias)",
    response_model=CompanyProfileResponse,
    status_code=status.HTTP_200_OK,
)
@recruiter_router.put(
    "/company/profile",
    summary="Update company profile via recruiter router",
    response_model=CompanyProfileResponse,
    status_code=status.HTTP_200_OK,
)
@recruiter_router.patch(
    "/company/profile",
    summary="Update company profile (PATCH alias)",
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


@company_router.patch(
    "/settings",
    summary="Update company settings",
    response_model=CompanyProfileResponse,
    status_code=status.HTTP_200_OK,
)
@recruiter_router.patch(
    "/company/settings",
    summary="Update company settings via recruiter router",
    response_model=CompanyProfileResponse,
    status_code=status.HTTP_200_OK,
)
def update_company_settings_endpoint(
    request: CompanySettingsUpdateRequest,
    current_user: Dict[str, Any] = Depends(require_company_user),
    client: Client = Depends(get_supabase_client),
) -> CompanyProfileResponse:
    """Updates discovery view preferences and notification configurations."""
    settings_payload = request.model_dump(exclude_unset=True)
    updated_profile = RecruiterService.update_company_settings(client, current_user, settings_payload)
    return CompanyProfileResponse(**updated_profile)


# =============================================================
# MODULE 2 — CANDIDATE DISCOVERY & SEARCH ENDPOINTS
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
    language: Optional[str] = Query(None, description="Programming language filter (singular)"),
    languages: Optional[str] = Query(None, description="Comma-separated programming languages"),
    skill: Optional[str] = Query(None, description="Technical skill filter (singular)"),
    skills: Optional[str] = Query(None, description="Comma-separated technical skills"),
    framework: Optional[str] = Query(None, description="Framework filter (singular)"),
    frameworks: Optional[str] = Query(None, description="Comma-separated frameworks"),
    domain: Optional[str] = Query(None, description="Problem domain / topic"),
    project_experience: Optional[str] = Query(None, description="Project experience filter"),
    min_score: Optional[float] = Query(None, ge=0.0, le=100.0, description="Minimum overall score"),
    max_score: Optional[float] = Query(None, ge=0.0, le=100.0, description="Maximum overall score"),
    min_coding_score: Optional[float] = Query(None, ge=0.0, le=100.0, description="Minimum coding score"),
    min_ai_efficiency: Optional[float] = Query(None, ge=0.0, le=100.0, description="Minimum AI efficiency score alias"),
    min_ai_efficiency_score: Optional[float] = Query(None, ge=0.0, le=100.0, description="Minimum AI efficiency score"),
    min_consistency: Optional[float] = Query(None, ge=0.0, le=100.0, description="Minimum consistency score"),
    min_completions: Optional[int] = Query(None, ge=0, description="Minimum completed assessments"),
    min_improvement: Optional[float] = Query(None, description="Minimum trajectory improvement delta"),
    difficulty: Optional[str] = Query(None, description="Target difficulty level"),
    consistency: Optional[str] = Query(None, description="Consistency filter"),
    improvement_trend: Optional[str] = Query(None, description="Improvement trend filter"),
    portfolio_only: Optional[str] = Query(None, description="Filter for candidates with projects/portfolio"),
    sort_by: Optional[str] = Query("highest_score", description="Sort criteria"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    limit: Optional[int] = Query(None, ge=1, le=100, description="Items per page"),
    page_size: Optional[int] = Query(None, ge=1, le=100, description="Items per page alias"),
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

    # Merge singular and plural language filters
    all_langs: List[str] = []
    if languages:
        all_langs.extend([l.strip() for l in languages.split(",") if l.strip()])
    if language:
        all_langs.extend([l.strip() for l in language.split(",") if l.strip()])
    lang_list = list(dict.fromkeys(all_langs)) if all_langs else None

    # Merge singular and plural skill filters
    all_skills: List[str] = []
    if skills:
        all_skills.extend([s.strip() for s in skills.split(",") if s.strip()])
    if skill:
        all_skills.extend([s.strip() for s in skill.split(",") if s.strip()])
    skill_list = list(dict.fromkeys(all_skills)) if all_skills else None

    # Merge singular and plural framework filters
    all_fws: List[str] = []
    if frameworks:
        all_fws.extend([f.strip() for f in frameworks.split(",") if f.strip()])
    if framework:
        all_fws.extend([f.strip() for f in framework.split(",") if f.strip()])
    fw_list = list(dict.fromkeys(all_fws)) if all_fws else None

    resolved_ai_score = min_ai_efficiency_score if min_ai_efficiency_score is not None else min_ai_efficiency
    resolved_limit = limit or page_size or 10

    result = RecruiterService.search_candidates(
        client=client,
        company_id=str(current_user["id"]),
        query=search_query,
        languages=lang_list,
        skills=skill_list,
        frameworks=fw_list,
        domain=domain,
        project_experience=project_experience,
        min_score=min_score,
        max_score=max_score,
        min_coding_score=min_coding_score,
        min_ai_efficiency_score=resolved_ai_score,
        min_consistency=min_consistency,
        min_completions=min_completions,
        min_improvement=min_improvement,
        difficulty=difficulty,
        portfolio_only=portfolio_only,
        sort_by=sort_by or "highest_score",
        page=page,
        limit=resolved_limit,
    )
    return CandidateSearchResponse(**result)


# =============================================================
# MODULE 2B — SAVED CANDIDATE SEARCHES
# =============================================================

@recruiter_router.post(
    "/saved-searches",
    summary="Save a candidate search filter preset",
    response_model=SavedCandidateSearchResponse,
    status_code=status.HTTP_201_CREATED,
)
def save_candidate_search_endpoint(
    request: SavedCandidateSearchRequest,
    current_user: Dict[str, Any] = Depends(require_company_user),
    client: Client = Depends(get_supabase_client),
) -> SavedCandidateSearchResponse:
    """Saves candidate search filters associated with the authenticated company."""
    return RecruiterService.save_candidate_search(
        client=client,
        company_id=str(current_user["id"]),
        name=request.name,
        query_string=request.query_string,
        filters_summary=request.filters_summary,
    )


@recruiter_router.get(
    "/saved-searches",
    summary="Retrieve saved candidate search filter presets",
    response_model=List[Dict[str, Any]],
    status_code=status.HTTP_200_OK,
)
def get_saved_candidate_searches_endpoint(
    current_user: Dict[str, Any] = Depends(require_company_user),
) -> List[Dict[str, Any]]:
    """Returns saved candidate searches for the company."""
    return RecruiterService.get_saved_searches(company_id=str(current_user["id"]))


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
    "/shortlist",
    summary="Shortlist a candidate via JSON body payload",
    status_code=status.HTTP_201_CREATED,
)
@company_router.post(
    "/shortlist",
    summary="Shortlist a candidate (company router alias)",
    status_code=status.HTTP_201_CREATED,
)
def add_to_shortlist_body_endpoint(
    request: AddShortlistRequest,
    current_user: Dict[str, Any] = Depends(require_company_user),
    client: Client = Depends(get_supabase_client),
) -> Dict[str, Any]:
    """Adds a candidate to the company's shortlist using JSON body payload."""
    target_id = request.candidate_id or request.student_id or request.candidateId
    if not target_id or not str(target_id).strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="candidate_id is required in request body.",
        )
    return RecruiterService.add_to_shortlist(
        client=client,
        company_id=str(current_user["id"]),
        student_id=str(target_id).strip(),
        notes=request.notes,
    )


@recruiter_router.post(
    "/shortlist/{student_id}",
    summary="Shortlist a candidate via path parameter",
    status_code=status.HTTP_201_CREATED,
)
@company_router.post(
    "/shortlist/{student_id}",
    summary="Shortlist a candidate via path parameter (company router alias)",
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
@company_router.delete(
    "/shortlist/{student_id}",
    summary="Remove a candidate from shortlist (company router alias)",
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
@recruiter_router.patch(
    "/shortlist/{student_id}",
    summary="Update recruiter notes (short path alias)",
    status_code=status.HTTP_200_OK,
)
@recruiter_router.put(
    "/shortlist/{student_id}",
    summary="Update recruiter notes (short path PUT alias)",
    status_code=status.HTTP_200_OK,
)
@company_router.patch(
    "/shortlist/{student_id}",
    summary="Update recruiter notes (company router alias)",
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
@company_router.get(
    "/shortlist",
    summary="Retrieve company's shortlisted candidates (company router alias)",
    response_model=ShortlistResponse,
    status_code=status.HTTP_200_OK,
)
def get_company_shortlist_endpoint(
    q: Optional[str] = Query(None, description="Search across notes and candidate name"),
    query: Optional[str] = Query(None, description="Search alias"),
    skill: Optional[str] = Query(None, description="Filter by skill"),
    min_score: Optional[float] = Query(None, description="Filter by minimum score"),
    portfolio_only: Optional[str] = Query(None, description="Filter by portfolio availability"),
    sort_by: Optional[str] = Query("date_added", description="Sort by date_added, score, or name"),
    current_user: Dict[str, Any] = Depends(require_company_user),
    client: Client = Depends(get_supabase_client),
) -> ShortlistResponse:
    """
    Retrieves all candidates shortlisted by the authenticated company.
    Re-checks candidate visibility dynamically: if candidate has revoked sharing,
    redacts details and marks is_visible=False.
    """
    search_q = q or query
    result = RecruiterService.get_company_shortlist(
        client=client,
        company_id=str(current_user["id"]),
        query=search_q,
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
        student_ids=request.student_ids or [],
    )


@recruiter_router.get(
    "/compare",
    summary="Compare up to four candidates via query parameters (GET alias)",
    response_model=CompareCandidatesResponse,
    status_code=status.HTTP_200_OK,
)
def compare_candidates_get_endpoint(
    candidate_ids: Optional[str] = Query(None, description="Comma-separated candidate IDs"),
    student_ids: Optional[str] = Query(None, description="Comma-separated student IDs alias"),
    current_user: Dict[str, Any] = Depends(require_company_user),
    client: Client = Depends(get_supabase_client),
) -> CompareCandidatesResponse:
    """GET endpoint alias supporting candidate comparison via query parameters."""
    raw_ids = candidate_ids or student_ids or ""
    id_list = [i.strip() for i in raw_ids.split(",") if i.strip()]
    if len(id_list) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least 2 candidates are required for comparison.",
        )
    return RecruiterService.compare_candidates(
        client=client,
        company_id=str(current_user["id"]),
        student_ids=id_list,
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
@company_router.get(
    "/dashboard",
    summary="Get recruiter dashboard talent analytics (company router alias)",
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
