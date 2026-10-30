"""
Student Analytics & Historical Trends Endpoints
Provides comprehensive performance analytics, historical score trends, topic breakdowns, and consistency metrics.
"""

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, Path, status
from fastapi.responses import JSONResponse
from supabase import Client

from backend.app.core.security import AuthException
from backend.app.database.supabase import get_supabase_client
from backend.app.schemas.analytics import (
    AssessmentHistoryItem,
    AssessmentResultAnalyticsResponse,
    StudentDashboardAnalytics,
)
from backend.app.services.analytics_service import AnalyticsService
from backend.app.services.auth_service import AuthService

logger = logging.getLogger(__name__)

router = APIRouter()


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
            message="Only student accounts can access candidate performance analytics.",
            status_code=403,
        )
    return current_user


@router.get(
    "/me",
    summary="Get authenticated student dashboard analytics",
    response_model=StudentDashboardAnalytics,
)
def get_student_dashboard_analytics_endpoint(
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """
    Retrieves comprehensive candidate performance analytics:
    - Average and highest scores.
    - Historical assessment score trends.
    - Topic-wise and difficulty-wise performance breakdowns.
    - Total correct and failed test cases.
    - Improvement delta and consistency index.
    """
    analytics = AnalyticsService.get_student_dashboard_analytics(
        client=client,
        user=current_user,
    )
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=analytics,
    )


@router.get(
    "/me/history",
    summary="Get authenticated student assessment history",
    response_model=List[AssessmentHistoryItem],
)
def get_student_assessment_history_endpoint(
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """Retrieves list of candidate assessment history items with scores and timestamps."""
    history = AnalyticsService.get_candidate_assessment_history(
        client=client,
        user=current_user,
    )
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=history,
    )


@router.get(
    "/me/results/{assessment_id}",
    summary="Get detailed analytics report for single assessment",
    response_model=AssessmentResultAnalyticsResponse,
)
def get_assessment_result_analytics_endpoint(
    assessment_id: str,
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """
    Retrieves detailed results analytics for an individual assessment session.
    Strictly enforces candidate assessment ownership.
    """
    result = AnalyticsService.get_assessment_result_analytics(
        client=client,
        assessment_id=assessment_id,
        user=current_user,
    )
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=result,
    )
