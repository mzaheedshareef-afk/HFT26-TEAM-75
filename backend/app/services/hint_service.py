"""
AI Hint Service & Interaction Tracking
Handles database persistence, rate limiting, and progressive hint lifecycle for technical assessments.
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional
import uuid

from supabase import Client

from backend.app.ai_engine.guarded_assistant import GuardedAIAssistant
from backend.app.core.security import AuthException
from backend.app.services.assessment_service import AssessmentService, _assessment_questions_store

logger = logging.getLogger(__name__)

MAX_HINTS_PER_QUESTION = 3

# In-memory store for hint interactions (assessment_id -> list of hint interactions)
_hint_interactions_store: Dict[str, List[Dict[str, Any]]] = {}


class HintService:
    """Manages progressive AI hint delivery and candidate interaction analytics."""

    @classmethod
    def get_question_hint_history(
        cls,
        client: Client,
        assessment_id: str,
        question_id: str,
        user_id: str,
    ) -> List[Dict[str, Any]]:
        """
        Retrieves all prior hints requested by this candidate for the target question.
        Ensures strict candidate data isolation.
        """
        # 1. Search memory store
        mem_hints = [
            h for h in _hint_interactions_store.get(assessment_id, [])
            if str(h.get("question_id")) == str(question_id) and str(h.get("user_id")) == str(user_id)
        ]
        if mem_hints:
            return sorted(mem_hints, key=lambda x: x.get("hint_level", 1))

        # 2. Query Supabase
        try:
            res = (
                client.table("ai_hint_interactions")
                .select("*")
                .eq("assessment_id", assessment_id)
                .eq("question_id", question_id)
                .eq("user_id", user_id)
                .order("created_at", desc=False)
                .execute()
            )
            if res.data:
                return res.data
        except Exception as e:
            logger.debug("Database hint fetch note: %s", e)

        return []

    @classmethod
    def get_assessment_hints(
        cls,
        client: Client,
        assessment_id: str,
        user_id: str,
    ) -> List[Dict[str, Any]]:
        """Retrieves all hints requested for an assessment session by the candidate."""
        mem_hints = [
            h for h in _hint_interactions_store.get(assessment_id, [])
            if str(h.get("user_id")) == str(user_id)
        ]
        if mem_hints:
            return sorted(mem_hints, key=lambda x: x.get("created_at", ""))

        try:
            res = (
                client.table("ai_hint_interactions")
                .select("*")
                .eq("assessment_id", assessment_id)
                .eq("user_id", user_id)
                .order("created_at", desc=False)
                .execute()
            )
            if res.data:
                return res.data
        except Exception as e:
            logger.debug("Database assessment hint fetch note: %s", e)

        return []

    @classmethod
    def request_hint(
        cls,
        client: Client,
        user: Dict[str, Any],
        assessment_id: str,
        question_id: str,
        hint_level: int,
        language: str = "python",
        current_code: Optional[str] = None,
        question_title: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Orchestrates progressive hint request:
        1. Validates candidate assessment ownership.
        2. Retrieves question context.
        3. Checks hint rate limit and progression bounds.
        4. Calls GuardedAIAssistant.
        5. Persists interaction record in Supabase and memory store.
        """
        user_id = str(user["id"])

        # 1. Verify assessment ownership
        assessment = AssessmentService.get_assessment_by_id(
            client=client,
            assessment_id=assessment_id,
            requesting_user=user,
        )

        # 2. Retrieve question details
        question = None
        if assessment_id in _assessment_questions_store:
            for q in _assessment_questions_store[assessment_id]:
                if str(q.get("id")) == str(question_id) or str(q.get("question_id")) == str(question_id):
                    question = q
                    break

        if not question:
            try:
                res = client.table("assessment_questions").select("*").eq("id", question_id).execute()
                if res.data and len(res.data) > 0:
                    question = res.data[0]
            except Exception as e:
                logger.debug("Database question lookup note: %s", e)

        if not question:
            raise AuthException(
                code="QUESTION_NOT_FOUND",
                message=f"Question '{question_id}' not found in assessment '{assessment_id}'.",
                status_code=404,
            )

        # 3. Check progression and limit
        history = cls.get_question_hint_history(client, assessment_id, question_id, user_id)
        if len(history) >= MAX_HINTS_PER_QUESTION:
            raise AuthException(
                code="EXCESSIVE_HINT_REQUESTS",
                message=f"Maximum hint limit ({MAX_HINTS_PER_QUESTION}) reached for this question.",
                status_code=429,
            )

        # Check if requested hint_level has already been delivered
        delivered_levels = {int(h.get("hint_level", 0)) for h in history}
        if hint_level in delivered_levels:
            # Return previously delivered hint rather than wasting tokens or advancing prematurely
            for h in history:
                if int(h.get("hint_level", 0)) == hint_level:
                    return h

        # Progressive enforcement: candidate must request hints in sequence (e.g. 1 -> 2 -> 3)
        expected_level = len(history) + 1
        effective_level = min(hint_level, expected_level)

        previous_hint_texts = [str(h.get("hint_text", "")) for h in history]
        q_title = question_title or str(question.get("title", "Coding Problem"))
        q_desc = str(question.get("description", ""))
        topic = str(question.get("target_skill") or question.get("category", "Algorithms"))
        difficulty = str(question.get("difficulty", "medium"))

        # 4. Generate progressive guarded hint
        hint_result = GuardedAIAssistant.request_hint(
            question_title=q_title,
            question_description=q_desc,
            topic=topic,
            difficulty=difficulty,
            hint_level=effective_level,
            language=language,
            current_code=current_code,
            previous_hints=previous_hint_texts,
        )

        hint_id = f"hint_{uuid.uuid4().hex[:12]}"
        now_iso = datetime.now(timezone.utc).isoformat()

        record = {
            "id": hint_id,
            "hint_id": hint_id,
            "user_id": user_id,
            "assessment_id": assessment_id,
            "question_id": question_id,
            "hint_level": effective_level,
            "level": effective_level,
            "category_label": hint_result["category_label"],
            "category": hint_result["category"],
            "content": hint_result["content"],
            "hint_text": hint_result["hint_text"],
            "sanitized_redacted": hint_result["sanitized_redacted"],
            "status": "delivered",
            "request_metadata": {
                "language": language,
                "had_code": bool(current_code),
            },
            "created_at": now_iso,
        }

        # 5. Store in memory store
        if assessment_id not in _hint_interactions_store:
            _hint_interactions_store[assessment_id] = []
        _hint_interactions_store[assessment_id].append(record)

        # 6. Store in Supabase
        try:
            client.table("ai_hint_interactions").insert({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "assessment_id": assessment_id,
                "question_id": question_id,
                "hint_level": effective_level,
                "hint_text": record["hint_text"],
                "sanitized_redacted": record["sanitized_redacted"],
                "request_metadata": record["request_metadata"],
                "status": "delivered",
                "created_at": now_iso,
            }).execute()
        except Exception as e:
            logger.debug("Database hint insert note: %s", e)

        return record

    @classmethod
    def get_hint_stats(
        cls,
        client: Client,
        assessment_id: str,
        user_id: str,
    ) -> Dict[str, Any]:
        """Calculates aggregated hint statistics for the assessment session."""
        all_hints = cls.get_assessment_hints(client, assessment_id, user_id)

        hints_by_level = {"1": 0, "2": 0, "3": 0}
        questions_with_hints = set()

        for h in all_hints:
            lvl = str(h.get("hint_level", 1))
            if lvl in hints_by_level:
                hints_by_level[lvl] += 1
            questions_with_hints.add(str(h.get("question_id")))

        return {
            "total_hints_requested": len(all_hints),
            "hints_by_level": hints_by_level,
            "questions_with_hints": len(questions_with_hints),
            "max_hints_per_question": MAX_HINTS_PER_QUESTION,
            "history": all_hints,
        }

