import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from supabase import Client

from backend.app.ai_engine.guarded_assistant import GuardedAssistantService
from backend.app.core.security import AuthException
from backend.app.database.supabase import get_supabase_client
from backend.app.services.auth_service import AuthService

logger = logging.getLogger(__name__)

router = APIRouter()


class HintRequestSchema(BaseModel):
    assessment_id: Optional[str] = None
    question_id: str
    question_title: Optional[str] = None
    hint_level: int = Field(default=1, ge=1, le=3)
    language: str = "python"
    current_code: Optional[str] = None
    previous_hints: List[str] = Field(default_factory=list)
    allow_solution: bool = False


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
            message="Only students can request AI tutor hints during an assessment.",
            status_code=403,
        )
    return current_user


@router.post(
    "/hint",
    status_code=status.HTTP_200_OK,
    summary="Request progressive AI tutor hint",
)
def request_hint(
    payload: HintRequestSchema,
    current_user: Dict[str, Any] = Depends(require_student_user),
) -> JSONResponse:
    """
    Returns progressive conceptual guidance (Level 1, 2, or 3) for a problem.
    Strictly redacts any solution code implementations to preserve assessment integrity.
    """
    hint = GuardedAssistantService.generate_hint(
        question_id=payload.question_id,
        question_title=payload.question_title,
        hint_level=payload.hint_level,
        language=payload.language,
        current_code=payload.current_code,
        previous_hints=payload.previous_hints,
    )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "hint": hint,
        },
    )
