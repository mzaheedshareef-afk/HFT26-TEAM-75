"""
Guarded AI Assistant & Progressive Hint Endpoints
Provides contextual, non-spoiling AI hints, rate limiting, and interaction tracking.
"""

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, Path, Query, status
from fastapi.responses import JSONResponse
from supabase import Client

from backend.app.core.security import AuthException
from backend.app.database.supabase import get_supabase_client
from backend.app.schemas.assistant import (
    AiHintItem,
    AiHintRequest,
    AiHintResponse,
    HintUsageStats,
)
from backend.app.services.assessment_service import AssessmentService
from backend.app.services.auth_service import AuthService
from backend.app.services.hint_service import HintService, _hint_interactions_store

logger = logging.getLogger(__name__)

router = APIRouter()
assistant_router = APIRouter()
assessment_hint_router = APIRouter()


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
            message="Only student accounts can request AI hints during technical assessments.",
            status_code=403,
        )
    return current_user


@assistant_router.post(
    "/hint",
    summary="Request a guarded progressive AI hint (Direct /assistant alias)",
    response_model=AiHintResponse,
)
@router.post(
    "/hint",
    summary="Request a guarded progressive AI hint (Direct /assistant alias)",
    response_model=AiHintResponse,
)
def request_assistant_hint_direct(
    payload: AiHintRequest,
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """
    Direct alias endpoint supporting frontend assistantService.requestHint (/api/assistant/hint).
    Delivers progressive, non-spoiling hints with full server-side guardrail protection.
    """
    if not payload.assessment_id:
        raise AuthException(
            code="MISSING_ASSESSMENT_ID",
            message="assessment_id is required to deliver contextual AI hints.",
            status_code=400,
        )

    if not payload.question_id:
        raise AuthException(
            code="MISSING_QUESTION_ID",
            message="question_id is required to deliver contextual AI hints.",
            status_code=400,
        )

    hint_record = HintService.request_hint(
        client=client,
        user=current_user,
        assessment_id=payload.assessment_id,
        question_id=payload.question_id,
        hint_level=payload.hint_level or 1,
        language=payload.language or "python",
        current_code=payload.current_code,
        question_title=payload.question_title,
    )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "hint": hint_record,
            "hint_text": hint_record["hint_text"],
            "level": hint_record["hint_level"],
            "hint_level": hint_record["hint_level"],
            "sanitized_redacted": hint_record.get("sanitized_redacted", False),
            "created_at": hint_record["created_at"],
        },
    )


@assistant_router.get(
    "/hints",
    summary="Get previously delivered hints (supporting assistantService query format)",
)
@assistant_router.get(
    "/history",
    summary="Get previously delivered hints (alias for /hints)",
)
def get_assistant_hints_by_query(
    assessment_id: Optional[str] = Query(None),
    question_id: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """Retrieves hint interaction history by query parameters for frontend assistantService."""
    user_id = str(current_user["id"])
    if assessment_id:
        AssessmentService.get_assessment_by_id(client, assessment_id, current_user)
        if question_id:
            hints = HintService.get_question_hint_history(client, assessment_id, question_id, user_id)
        else:
            hints = HintService.get_assessment_hints(client, assessment_id, user_id)
    else:
        hints = []
        for aid, h_list in _hint_interactions_store.items():
            for h in h_list:
                if str(h.get("user_id")) == user_id:
                    if not question_id or str(h.get("question_id")) == question_id:
                        hints.append(h)

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "hints": hints,
            "total_hints": len(hints),
        },
    )


@assessment_hint_router.post(
    "/{assessment_id}/questions/{question_id}/hint",
    summary="Request next progressive AI hint for assessment question",
    response_model=AiHintResponse,
)
@router.post(
    "/{assessment_id}/questions/{question_id}/hint",
    summary="Request next progressive AI hint for assessment question",
    response_model=AiHintResponse,
)
def request_question_hint(
    assessment_id: str,
    question_id: str,
    payload: Optional[AiHintRequest] = None,
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """
    Requests the next contextual progressive hint for a specific assessment question.
    Strictly prevents solution spoilage and rejects cross-student access.
    """
    requested_level = payload.hint_level if payload else 1
    language = payload.language if payload else "python"
    current_code = payload.current_code if payload else None
    q_title = payload.question_title if payload else None

    hint_record = HintService.request_hint(
        client=client,
        user=current_user,
        assessment_id=assessment_id,
        question_id=question_id,
        hint_level=requested_level,
        language=language,
        current_code=current_code,
        question_title=q_title,
    )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "hint": hint_record,
            "hint_text": hint_record["hint_text"],
            "level": hint_record["hint_level"],
            "hint_level": hint_record["hint_level"],
            "sanitized_redacted": hint_record.get("sanitized_redacted", False),
            "created_at": hint_record["created_at"],
        },
    )


@assistant_router.get(
    "/hints",
    summary="Get previously delivered hints (supporting assistantService query format)",
)
@assistant_router.get(
    "/history",
    summary="Get previously delivered hints (alias for /hints)",
)
def get_assistant_hints_by_query(
    assessment_id: Optional[str] = Query(None),
    question_id: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """Retrieves hint interaction history by query parameters for frontend assistantService."""
    user_id = str(current_user["id"])
    if assessment_id:
        AssessmentService.get_assessment_by_id(client, assessment_id, current_user)
        if question_id:
            hints = HintService.get_question_hint_history(client, assessment_id, question_id, user_id)
        else:
            hints = HintService.get_assessment_hints(client, assessment_id, user_id)
    else:
        hints = []
        for aid, h_list in _hint_interactions_store.items():
            for h in h_list:
                if str(h.get("user_id")) == user_id:
                    if not question_id or str(h.get("question_id")) == question_id:
                        hints.append(h)

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "hints": hints,
            "total_hints": len(hints),
        },
    )


@assessment_hint_router.get(
    "/{assessment_id}/questions/{question_id}/hints",
    summary="Get previously delivered hints for this question",
)
@router.get(
    "/{assessment_id}/questions/{question_id}/hints",
    summary="Get previously delivered hints for this question",
)
def get_question_hints(
    assessment_id: str,
    question_id: str,
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """Retrieves hint interaction history for candidate on this question."""
    AssessmentService.get_assessment_by_id(client, assessment_id, current_user)
    history = HintService.get_question_hint_history(
        client=client,
        assessment_id=assessment_id,
        question_id=question_id,
        user_id=str(current_user["id"]),
    )
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "hints": history,
            "total_hints": len(history),
        },
    )


@assessment_hint_router.get(
    "/{assessment_id}/hints/stats",
    summary="Get overall hint usage statistics for assessment",
    response_model=HintUsageStats,
)
@router.get(
    "/{assessment_id}/hints/stats",
    summary="Get overall hint usage statistics for assessment",
    response_model=HintUsageStats,
)
def get_assessment_hint_stats(
    assessment_id: str,
    current_user: Dict[str, Any] = Depends(require_student_user),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    """Retrieves aggregated hint statistics and interaction metadata for the session."""
    AssessmentService.get_assessment_by_id(client, assessment_id, current_user)
    stats = HintService.get_hint_stats(
        client=client,
        assessment_id=assessment_id,
        user_id=str(current_user["id"]),
    )
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=stats,
    )
