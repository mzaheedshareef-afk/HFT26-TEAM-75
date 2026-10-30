import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Header, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from supabase import Client

from backend.app.core.security import AuthException
from backend.app.database.supabase import get_supabase_client
from backend.app.services.assessment_service import AssessmentService
from backend.app.services.auth_service import AuthService

logger = logging.getLogger(__name__)

router = APIRouter()


class SubmitSolutionRequest(BaseModel):
    assessment_id: Optional[str] = None
    question_id: str
    language: str = "python"
    code: str
    elapsed_seconds: Optional[int] = None
    hints_used: Optional[int] = 0


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
            message="Only students can submit solutions for assessment questions.",
            status_code=403,
        )
    return current_user


@router.post(
    "",
    status_code=status.HTTP_200_OK,
    summary="Submit solution for deterministic grading",
)
def submit_solution(
    payload: SubmitSolutionRequest,
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """
    Submits candidate code for grading against both public and hidden test cases.
    Returns composite deterministic score summary and execution verdicts.
    """
    submission_res = AssessmentService.submit_solution(
        client=client,
        user_id=current_user["id"],
        assessment_id=payload.assessment_id,
        question_id=payload.question_id,
        language=payload.language,
        code=payload.code,
        elapsed_seconds=payload.elapsed_seconds,
        hints_used=payload.hints_used,
    )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=submission_res,
    )


@router.get(
    "/latest",
    status_code=status.HTTP_200_OK,
    summary="Get candidate's latest graded submission summary",
)
def get_latest_submission(
    current_user: Dict[str, Any] = Depends(require_student_user),
) -> JSONResponse:
    """Returns candidate's latest score summary or 404 if none submitted yet."""
    latest = AssessmentService.get_latest_score_summary(current_user["id"])
    if not latest:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "success": False,
                "error": {
                    "code": "NO_SUBMISSIONS_FOUND",
                    "message": "No graded submissions found for candidate.",
                },
            },
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "summary": latest,
        },
    )
