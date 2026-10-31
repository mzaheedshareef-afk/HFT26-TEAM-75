from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, Request, status
from fastapi.responses import JSONResponse
from supabase import Client

from backend.app.core.security import AuthException
from backend.app.database.supabase import get_supabase_client
from backend.app.grading.grading_engine import GradingEngine
from backend.app.schemas.assessment import (
    AssessmentAnswerRequest,
    AssessmentApiResponse,
    AssessmentGenerateRequest,
)
from backend.app.schemas.submission import (
    AssessmentCompleteRequest,
    CodeRunRequest,
)
from backend.app.services.assessment_service import (
    AssessmentService,
    _assessment_memory_store,
)
from backend.app.services.auth_service import AuthService

logger = logging.getLogger(__name__)

router = APIRouter()


def require_student_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    client: Client = Depends(get_supabase_client),
) -> Dict[str, Any]:
    """Dependency enforcing that request comes from an authenticated candidate (student)."""
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
            message="Only student accounts can access and generate personalized technical assessments.",
            status_code=403,
        )
    return current_user


def require_authenticated_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    client: Client = Depends(get_supabase_client),
) -> Dict[str, Any]:
    """Dependency enforcing that request comes from any authenticated candidate or recruiter."""
    if not authorization or not authorization.strip():
        raise AuthException(
            code="UNAUTHORIZED",
            message="Authorization token header is missing",
            status_code=401,
        )
    return AuthService.get_current_user_profile(client, authorization)


@router.post(
    "/generate",
    status_code=status.HTTP_201_CREATED,
    summary="Generate personalized assessment from portfolio",
    response_model=AssessmentApiResponse,
)
def generate_assessment(
    request_data: Optional[AssessmentGenerateRequest] = None,
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """
    Generates a 60-minute personalized coding assessment based on the student's actual portfolio.
    Guarantees zero-trust question validation and strips hidden test cases from response.
    """
    req = request_data or AssessmentGenerateRequest()
    assessment = AssessmentService.generate_assessment(
        client=client,
        user_id=current_user["id"],
        request=req,
    )

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "success": True,
            "assessment": assessment,
            "message": "Personalized technical assessment generated successfully.",
        },
    )


@router.get(
    "",
    summary="List candidate assessments",
    response_model=AssessmentApiResponse,
)
def list_candidate_assessments(
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """Retrieves all assessments generated for authenticated candidate."""
    assessments = AssessmentService.get_candidate_assessments(
        client=client,
        user_id=current_user["id"],
    )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "assessments": assessments,
            "count": len(assessments),
        },
    )


@router.get(
    "/active",
    summary="Get active assessment session",
    response_model=AssessmentApiResponse,
)
def get_active_session(
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """
    Returns active or ready assessment session for candidate.
    Returns consistent empty session response (HTTP 200) if no assessment has been generated yet.
    """
    session = AssessmentService.get_active_session(
        client=client,
        user_id=current_user["id"],
    )

    if not session:
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "success": True,
                "session": None,
                "assessment": None,
                "message": "No active assessment session found. Please generate or start an assessment.",
            },
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "session": session,
            "assessment": session,
            "message": "Active assessment session retrieved successfully.",
        },
    )


@router.post(
    "/start",
    summary="Start new assessment session",
    response_model=AssessmentApiResponse,
)
def start_or_create_session(
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """
    Starts the candidate's existing ready assessment or generates a new one from their portfolio.
    """
    session = AssessmentService.get_active_session(
        client=client,
        user_id=current_user["id"],
    )

    if not session:
        assessment = AssessmentService.generate_assessment(
            client=client,
            user_id=current_user["id"],
            request=AssessmentGenerateRequest(),
        )
        session = AssessmentService.start_assessment_session(
            client=client,
            assessment_id=assessment["id"],
            requesting_user=current_user,
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "session": session,
        },
    )


@router.post(
    "/run",
    summary="Run code against public test cases (alias for /api/code/run)",
)
def run_code_assessment_alias(
    payload: CodeRunRequest,
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """Alias allowing POST /api/assessment/run directly."""
    from backend.app.api.routes.submissions import run_code
    return run_code(payload, current_user, client)


@router.get(
    "/results/latest",
    summary="Get latest assessment results",
)
def get_latest_assessment_results(
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """
    Retrieves results of latest completed assessment for candidate.
    Returns consistent empty state response (HTTP 200) if candidate has not completed an assessment.
    """
    user_id = str(current_user["id"])

    # 1. Check in-memory results store
    from backend.app.services.assessment_service import _assessment_results_store
    candidate_results = [
        r for r in _assessment_results_store.values()
        if str(r.get("user_id")) == user_id or str(r.get("student_id")) == user_id
    ]
    if candidate_results:
        latest_res = sorted(
            candidate_results,
            key=lambda r: str(r.get("completed_at") or r.get("updated_at") or ""),
            reverse=True,
        )[0]
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "success": True,
                "results": latest_res,
                "result": latest_res,
                "message": "Latest assessment results retrieved successfully.",
            },
        )

    # 2. Check Supabase assessment_results table
    try:
        res = client.table("assessment_results").select("*").or_(
            f"user_id.eq.{user_id},student_id.eq.{user_id}"
        ).order("created_at", desc=True).limit(1).execute()
        if res.data and len(res.data) > 0:
            db_row = dict(res.data[0])
            breakdown = db_row.get("breakdown") or {}
            combined = {**breakdown, **db_row}
            combined.setdefault("final_score", db_row.get("total_score", 0.0))
            combined.setdefault("percentage", db_row.get("percentage", 0.0))
            combined.setdefault("total_score", db_row.get("total_score", 0.0))
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "success": True,
                    "results": combined,
                    "result": combined,
                    "message": "Latest assessment results retrieved successfully.",
                },
            )
    except Exception as e:
        logger.debug("Database assessment_results fetch note: %s", e)

    # 3. Check assessments table for any completed assessments
    assessments = AssessmentService.get_candidate_assessments(client, user_id)
    completed_assessments = [
        a for a in assessments if a.get("status") in ("completed", "evaluated")
    ]
    if completed_assessments:
        latest_aid = completed_assessments[0]["id"]
        results = AssessmentService.get_assessment_results(client, latest_aid, current_user)
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "success": True,
                "results": results,
                "result": results,
                "message": "Latest assessment results retrieved successfully.",
            },
        )

    # 4. Consistent empty state: HTTP 200 with null results
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "results": None,
            "result": None,
            "message": "No completed assessment results found for candidate.",
        },
    )


@router.get(
    "/submissions/latest",
    summary="Get candidate's latest submission (alias)",
)
def get_latest_submission_assessment_alias(
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """Alias allowing GET /api/assessment/submissions/latest."""
    from backend.app.api.routes.submissions import get_latest_candidate_submission
    return get_latest_candidate_submission(current_user, client)


@router.get(
    "/history",
    summary="Get candidate assessment history (alias for /api/analytics/history)",
)
def get_assessment_history_alias(
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """Retrieves full candidate assessment history with score breakdown."""
    from backend.app.services.analytics_service import AnalyticsService
    history = AnalyticsService.get_candidate_assessment_history(client, current_user)
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=history,
    )


@router.get(
    "/{assessment_id}",
    summary="Get assessment by ID",
    response_model=AssessmentApiResponse,
)
def get_assessment_by_id(
    assessment_id: str,
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """
    Retrieves assessment by ID. Enforces candidate ownership isolation:
    students cannot access other students' assessments.
    """
    assessment = AssessmentService.get_assessment_by_id(
        client=client,
        assessment_id=assessment_id,
        requesting_user=current_user,
    )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "assessment": assessment,
        },
    )


@router.post(
    "/{assessment_id}/start",
    summary="Start specific assessment by ID",
    response_model=AssessmentApiResponse,
)
def start_specific_assessment(
    assessment_id: str,
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """Transitions status of specific assessment to in_progress and returns session timer."""
    session = AssessmentService.start_assessment_session(
        client=client,
        assessment_id=assessment_id,
        requesting_user=current_user,
    )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "session": session,
        },
    )


@router.post(
    "/{assessment_id}/answer",
    summary="Save candidate answer for an assessment question",
)
def save_assessment_answer(
    assessment_id: str,
    payload: AssessmentAnswerRequest,
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """Records candidate's option choice or coding draft for a specific question."""
    result = AssessmentService.save_candidate_answer(
        client=client,
        assessment_id=assessment_id,
        user_id=current_user["id"],
        question_id=payload.question_id,
        selected_option=payload.selected_option,
        selected_options=payload.selected_options,
        source_code=payload.source_code,
        language=payload.language,
    )
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=result,
    )


@router.post(
    "/{assessment_id}/complete",
    summary="Complete and finalize technical assessment",
)
def complete_assessment_endpoint(
    assessment_id: str,
    payload: Optional[AssessmentCompleteRequest] = None,
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """Finalizes assessment session, marks completed, and returns comprehensive results."""
    assessment = AssessmentService.get_assessment_by_id(client, assessment_id, current_user)

    now_iso = datetime.now(timezone.utc).isoformat()
    if assessment_id in _assessment_memory_store:
        _assessment_memory_store[assessment_id]["status"] = "completed"
        _assessment_memory_store[assessment_id]["completed_at"] = now_iso

    try:
        client.table("assessments").update({
            "status": "completed",
            "completed_at": now_iso,
        }).eq("id", assessment_id).execute()
    except Exception:
        pass

    results = AssessmentService.complete_assessment(
        client=client,
        assessment_id=assessment_id,
        user_id=current_user["id"],
    )
    results["completion_status"] = "completed"
    results["status"] = "completed"
    results["completed_at"] = now_iso
    if payload and payload.elapsed_seconds:
        results["time_taken_seconds"] = payload.elapsed_seconds
    if payload and payload.total_hints_used is not None:
        results["total_hints_used"] = payload.total_hints_used

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "results": results,
            "result": results,
        },
    )


@router.get(
    "/{assessment_id}/results",
    summary="Get assessment grading results",
)
def get_assessment_results(
    assessment_id: str,
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

    results = AssessmentService.get_assessment_results(
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
