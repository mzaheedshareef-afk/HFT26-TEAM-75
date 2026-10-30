"""
API Routes: Code Execution & Submissions
Provides endpoints:
- POST /api/code/run (and alias POST /api/assessment/run)
- POST /api/code/submit (and alias POST /api/submissions)
- GET /api/submissions/latest
- GET /api/submissions/{submission_id}
- GET /api/assessment/{assessment_id}/results
"""

import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Header, Path, status
from fastapi.responses import JSONResponse
from supabase import Client

from backend.app.core.security import AuthException
from backend.app.database.supabase import get_supabase_client
from backend.app.grading.grading_engine import GradingEngine
from backend.app.schemas.submission import (
    AssessmentResultsResponse,
    CodeRunRequest,
    CodeRunResponse,
    CodeSubmitRequest,
    CodeSubmitResponse,
    SubmissionDetailResponse,
)
from backend.app.services.assessment_service import AssessmentService
from backend.app.services.auth_service import AuthService

logger = logging.getLogger(__name__)

code_router = APIRouter()
submissions_router = APIRouter()


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
            message="Only student accounts can execute and submit code for technical assessments.",
            status_code=403,
        )
    return current_user


def require_authenticated_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    client: Client = Depends(get_supabase_client),
) -> Dict[str, Any]:
    """Dependency allowing authenticated students or company recruiters."""
    if not authorization or not authorization.strip():
        raise AuthException(
            code="UNAUTHORIZED",
            message="Authorization token header is missing",
            status_code=401,
        )
    return AuthService.get_current_user_profile(client, authorization)


# -------------------------------------------------------------------------
# Core Code Execution & Submission Endpoints
# -------------------------------------------------------------------------

@code_router.post(
    "/run",
    status_code=status.HTTP_200_OK,
    summary="Run code against public test cases",
    response_model=CodeRunResponse,
)
def run_code(
    payload: CodeRunRequest,
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """
    Executes student code strictly against public sample test cases (or optional custom input).
    Never accesses or evaluates against hidden test cases.
    """
    if payload.assessment_id:
        AssessmentService.get_assessment_by_id(
            client=client,
            assessment_id=payload.assessment_id,
            requesting_user=current_user,
        )

    code_to_run = payload.source_code or payload.code or ""

    results = GradingEngine.run_public_tests(
        source_code=code_to_run,
        language=payload.language,
        question_id=payload.question_id,
        client=client,
        custom_input=payload.custom_input,
        assessment_id=payload.assessment_id,
    )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=results,
    )


@code_router.post(
    "/submit",
    status_code=status.HTTP_200_OK,
    summary="Submit code for final automated grading",
    response_model=CodeSubmitResponse,
)
def submit_code(
    payload: CodeSubmitRequest,
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """
    Submits code for official question grading.
    Evaluates against both public and hidden test cases in isolated Docker containers.
    Calculates deterministic score, updates assessment scores, and returns sanitized results.
    Hidden test inputs and expected outputs are never returned to candidate.
    """
    AssessmentService.get_assessment_by_id(
        client=client,
        assessment_id=payload.assessment_id,
        requesting_user=current_user,
    )

    code_to_submit = payload.source_code or payload.code or ""

    result = GradingEngine.submit_and_grade(
        source_code=code_to_submit,
        language=payload.language,
        question_id=payload.question_id,
        assessment_id=payload.assessment_id,
        user_id=current_user["id"],
        client=client,
        elapsed_seconds=payload.elapsed_seconds,
        hints_used=payload.hints_used,
    )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=result,
    )


# -------------------------------------------------------------------------
# Submission Query & Alias Endpoints
# -------------------------------------------------------------------------

@submissions_router.post(
    "",
    status_code=status.HTTP_200_OK,
    summary="Submit solution (alias for /api/code/submit)",
    response_model=CodeSubmitResponse,
)
def submit_code_alias(
    payload: CodeSubmitRequest,
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """Alias for POST /api/code/submit allowing direct POST to /api/submissions."""
    return submit_code(payload, current_user, client)


@submissions_router.get(
    "/latest",
    status_code=status.HTTP_200_OK,
    summary="Get candidate's latest submission",
)
def get_latest_candidate_submission(
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """Returns candidate's latest graded submission summary."""
    latest = GradingEngine.get_latest_submission(client, current_user["id"])
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "summary": latest,
        },
    )


@submissions_router.get(
    "/{submission_id}",
    status_code=status.HTTP_200_OK,
    summary="Get submission by ID",
    response_model=SubmissionDetailResponse,
)
def get_submission_by_id(
    submission_id: str = Path(..., description="Submission UUID"),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """
    Retrieves submission details.
    Enforces student ownership isolation (students cannot view other students' submissions).
    """
    submission = GradingEngine.get_submission_by_id(
        client=client,
        submission_id=submission_id,
        requesting_user=current_user,
    )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "submission": submission,
            "summary": submission,
        },
    )


@submissions_router.get(
    "/assessment/{assessment_id}/results",
    status_code=status.HTTP_200_OK,
    summary="Get assessment grading results",
    response_model=AssessmentResultsResponse,
)
def get_assessment_results(
    assessment_id: str = Path(..., description="Assessment UUID"),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """
    Retrieves rolled-up assessment results and per-question score breakdown.
    Enforces student ownership isolation.
    """
    AssessmentService.get_assessment_by_id(
        client=client,
        assessment_id=assessment_id,
        requesting_user=current_user,
    )

    results = GradingEngine.get_assessment_results(
        client=client,
        assessment_id=assessment_id,
        requesting_user=current_user,
    )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "results": results,
            "result": results,
        },
    )
