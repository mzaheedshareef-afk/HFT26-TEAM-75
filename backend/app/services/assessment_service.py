from datetime import datetime, timezone
import json
import logging
from typing import Any, Dict, List, Optional
import uuid

from supabase import Client

from backend.app.ai_engine.question_generator import question_generator
from backend.app.core.config import settings
from backend.app.core.security import AuthException
from backend.app.schemas.assessment import (
    AssessmentGenerateRequest,
    GeneratedAssessmentSchema,
)
from backend.app.services.portfolio_service import PortfolioService
from backend.app.validation.question_validator import sanitize_assessment_for_candidate

logger = logging.getLogger(__name__)

# In-memory stores for ultra-fast, resilient caching across requests and test runs
_assessment_memory_store: Dict[str, Dict[str, Any]] = {}  # assessment_id -> assessment dict
_assessment_questions_store: Dict[str, List[Dict[str, Any]]] = {}  # assessment_id -> list of full questions
_user_assessments_index: Dict[str, List[str]] = {}  # user_id -> list of assessment_ids


class AssessmentService:
    """
    Manages end-to-end assessment lifecycle, Supabase persistence,
    candidate authorization, and test case confidentiality.
    """

    @classmethod
    def generate_assessment(
        cls,
        client: Client,
        user_id: str,
        request: AssessmentGenerateRequest,
    ) -> Dict[str, Any]:
        """
        Retrieves candidate portfolio, validates completeness, synthesizes questions via AI,
        persists records to Supabase, and returns sanitized assessment details.
        """
        # 1. Retrieve candidate portfolio
        portfolio = PortfolioService.get_portfolio_for_user(client, user_id)
        if not portfolio:
            raise AuthException(
                code="PORTFOLIO_NOT_FOUND",
                message="Please upload your portfolio before generating a personalized assessment.",
                status_code=404,
            )

        # 2. Check for empty portfolio (must have languages)
        languages = portfolio.get("primary_languages") or portfolio.get("primaryLanguages") or []
        clean_langs = [l for l in languages if l and l.strip()]
        if not clean_langs:
            raise AuthException(
                code="EMPTY_PORTFOLIO",
                message="Your portfolio must have at least one primary programming language to generate an assessment.",
                status_code=400,
            )

        # 3. Generate questions tailored to portfolio
        generated: GeneratedAssessmentSchema = question_generator.generate_assessment(
            portfolio_data=portfolio,
            target_role=request.target_role or "Software Engineer",
            difficulty_preference=request.difficulty_preference or "medium",
            question_count=request.question_count or 3,
        )

        # 4. Prepare assessment and question models
        assessment_id = str(uuid.uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()
        duration_minutes = generated.duration_minutes or 60
        duration_seconds = duration_minutes * 60

        assessment_record: Dict[str, Any] = {
            "id": assessment_id,
            "user_id": user_id,
            "portfolio_id": portfolio.get("id"),
            "title": generated.title,
            "target_role": generated.target_role,
            "difficulty": generated.difficulty.lower(),
            "status": "ready",
            "total_time_limit_minutes": duration_minutes,
            "duration_minutes": duration_minutes,
            "duration_seconds": duration_seconds,
            "question_count": len(generated.questions),
            "created_at": now_iso,
            "completed_at": None,
            "metadata": {
                "model": settings.FEATHERLESS_MODEL,
                "primary_languages": clean_langs,
            },
        }

        # Full database questions (with hidden test cases & reference solutions)
        full_questions: List[Dict[str, Any]] = []
        # Sanitized questions for frontend consumption
        candidate_questions: List[Dict[str, Any]] = []

        for idx, q in enumerate(generated.questions):
            q_id = str(uuid.uuid4())
            q.question_id = q_id
            q.order_index = idx + 1
            full_questions.append(q.to_database_dict(assessment_id))
            candidate_questions.append(q.to_candidate_dict())

        # 5. Persist to memory store
        _assessment_memory_store[assessment_id] = assessment_record
        _assessment_questions_store[assessment_id] = full_questions
        if user_id not in _user_assessments_index:
            _user_assessments_index[user_id] = []
        _user_assessments_index[user_id].insert(0, assessment_id)

        # 6. Persist to Supabase Database
        try:
            client.table("assessments").insert({
                "id": assessment_id,
                "user_id": user_id,
                "portfolio_id": portfolio.get("id"),
                "title": generated.title,
                "target_role": generated.target_role,
                "difficulty": generated.difficulty.lower(),
                "status": "ready",
                "total_time_limit_minutes": duration_minutes,
                "metadata": assessment_record["metadata"],
            }).execute()

            for q_db in full_questions:
                client.table("assessment_questions").insert(q_db).execute()
            logger.info("Successfully persisted assessment %s to Supabase.", assessment_id)
        except Exception as e:
            logger.debug("Database insert notes for assessment: %s (in-memory store guaranteed)", e)

        # 7. Return candidate-safe response
        response_dict = dict(assessment_record)
        response_dict["questions"] = candidate_questions
        return sanitize_assessment_for_candidate(response_dict)

    @classmethod
    def get_candidate_assessments(
        cls,
        client: Client,
        user_id: str,
    ) -> List[Dict[str, Any]]:
        """Returns all assessments created for candidate."""
        assessment_ids = _user_assessments_index.get(user_id, [])
        assessments: List[Dict[str, Any]] = []

        # From memory
        for aid in assessment_ids:
            if aid in _assessment_memory_store:
                item = dict(_assessment_memory_store[aid])
                raw_qs = _assessment_questions_store.get(aid, [])
                item["questions"] = [
                    sanitize_assessment_for_candidate(q) for q in raw_qs
                ]
                assessments.append(sanitize_assessment_for_candidate(item))

        if not assessments:
            # Query Supabase DB
            try:
                res = client.table("assessments").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
                if res.data:
                    for row in res.data:
                        assessments.append(sanitize_assessment_for_candidate(row))
            except Exception as e:
                logger.debug("Database query assessments note: %s", e)

        return assessments

    @classmethod
    def get_assessment_by_id(
        cls,
        client: Client,
        assessment_id: str,
        requesting_user: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Retrieves assessment and questions by ID with strict ownership verification:
        - Students can only view their own assessment.
        - Companies / Recruiters can view candidate assessments.
        - Hidden test cases and reference solutions are strictly excluded from output.
        """
        req_user_id = str(requesting_user.get("id"))
        req_role = str(requesting_user.get("role", "student"))

        # Look up assessment record
        record = _assessment_memory_store.get(assessment_id)
        full_questions = _assessment_questions_store.get(assessment_id, [])

        if not record:
            try:
                res = client.table("assessments").select("*").eq("id", assessment_id).execute()
                if res.data and len(res.data) > 0:
                    record = res.data[0]
                    # Also fetch questions
                    q_res = client.table("assessment_questions").select("*").eq("assessment_id", assessment_id).order("order_index").execute()
                    full_questions = q_res.data or []
            except Exception as e:
                logger.debug("Database fetch assessment note: %s", e)

        if not record:
            raise AuthException(
                code="ASSESSMENT_NOT_FOUND",
                message="Assessment record not found.",
                status_code=404,
            )

        # Authorization: Student must be owner
        assessment_owner_id = str(record.get("user_id"))
        if req_role != "company" and assessment_owner_id != req_user_id:
            raise AuthException(
                code="UNAUTHORIZED_ACCESS",
                message="Access forbidden: You cannot view another student's assessment.",
                status_code=403,
            )

        # Build sanitized candidate questions
        clean_questions = []
        for q in full_questions:
            clean_q = dict(q)
            # Remove server-only secrets
            clean_q.pop("hidden_test_cases", None)
            clean_q.pop("reference_solution", None)
            clean_q["question_id"] = clean_q.get("id")
            clean_q["examples"] = clean_q.get("sample_test_cases", [])
            clean_q["public_test_cases"] = clean_q.get("sample_test_cases", [])
            clean_questions.append(clean_q)

        output = dict(record)
        output["questions"] = clean_questions
        return sanitize_assessment_for_candidate(output)

    @classmethod
    def start_assessment_session(
        cls,
        client: Client,
        assessment_id: str,
        requesting_user: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Starts an assessment, transitions status to 'in_progress', and returns active session data.
        """
        assessment = cls.get_assessment_by_id(client, assessment_id, requesting_user)

        # Update status
        assessment["status"] = "in_progress"
        if assessment_id in _assessment_memory_store:
            _assessment_memory_store[assessment_id]["status"] = "in_progress"

        try:
            client.table("assessments").update({"status": "in_progress"}).eq("id", assessment_id).execute()
        except Exception:
            pass

        questions = assessment.get("questions", [])
        allowed_languages = questions[0].get("allowed_languages", ["python", "javascript"]) if questions else ["python"]

        duration_sec = assessment.get("duration_seconds", 3600)

        return {
            "assessment_id": assessment_id,
            "title": assessment.get("title", "Personalized Technical Assessment"),
            "status": "in_progress",
            "duration_seconds": duration_sec,
            "remaining_seconds": duration_sec,
            "allowed_languages": allowed_languages,
            "questions": questions,
            "calibrated_stack": assessment.get("metadata", {}).get("primary_languages", []),
        }

    @classmethod
    def get_active_session(
        cls,
        client: Client,
        user_id: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieves candidate's current active or ready assessment session.
        """
        assessments = cls.get_candidate_assessments(client, user_id)
        if not assessments:
            return None

        # Prioritize in_progress, then ready
        target = next((a for a in assessments if a.get("status") == "in_progress"), None)
        if not target:
            target = next((a for a in assessments if a.get("status") == "ready"), None)

        if not target:
            target = assessments[0]

        return cls.start_assessment_session(
            client=client,
            assessment_id=target["id"],
            requesting_user={"id": user_id, "role": "student"},
        )
