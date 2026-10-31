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
_assessment_memory_store: Dict[str, Dict[str, Any]] = {}        # assessment_id -> assessment dict
_assessment_questions_store: Dict[str, List[Dict[str, Any]]] = {} # assessment_id -> list of full questions (with secrets)
_user_assessments_index: Dict[str, List[str]] = {}               # user_id -> list of assessment_ids
_candidate_answers_store: Dict[str, Dict[str, Any]] = {}          # assessment_id -> {question_id -> answer dict}
_assessment_results_store: Dict[str, Dict[str, Any]] = {}         # assessment_id -> results dict


class AssessmentService:
    """
    Manages end-to-end multi-format assessment lifecycle:
    - MCQ, MSQ, and Coding question generation and validation
    - Candidate authorization and confidential test case protection
    - Response capture, deterministic evaluation, and results reporting
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
        persists records, and returns sanitized assessment details.
        Guarantees that a new assessment generates a fresh set avoiding previously served fingerprints.
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

        # 3. Extract previously served question fingerprints for this candidate
        previous_fingerprints: List[str] = []
        past_aids = _user_assessments_index.get(user_id, [])
        for aid in past_aids:
            for q in _assessment_questions_store.get(aid, []):
                fp = q.get("question_fingerprint")
                if fp:
                    previous_fingerprints.append(fp)

        # Determine counts
        mcq_cnt = request.mcq_count if request.mcq_count is not None else 3
        msq_cnt = request.msq_count if request.msq_count is not None else 2
        coding_cnt = request.coding_count if request.coding_count is not None else 1
        total_cnt = mcq_cnt + msq_cnt + coding_cnt

        # 4. Generate multi-format questions tailored to portfolio
        generated: GeneratedAssessmentSchema = question_generator.generate_assessment(
            portfolio_data=portfolio,
            target_role=request.target_role or "Software Engineer",
            difficulty_preference=request.difficulty_preference or "medium",
            question_count=total_cnt,
            mcq_count=mcq_cnt,
            msq_count=msq_cnt,
            coding_count=coding_cnt,
            previous_fingerprints=previous_fingerprints,
        )

        # 5. Prepare assessment and question models
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
            "mcq_count": mcq_cnt,
            "msq_count": msq_cnt,
            "coding_count": coding_cnt,
            "created_at": now_iso,
            "completed_at": None,
            "metadata": {
                "model": settings.FEATHERLESS_MODEL,
                "primary_languages": clean_langs,
                "mcq_count": mcq_cnt,
                "msq_count": msq_cnt,
                "coding_count": coding_cnt,
            },
        }

        # Full database questions (with answer keys & hidden test cases)
        full_questions: List[Dict[str, Any]] = []
        # Sanitized questions for frontend consumption
        candidate_questions: List[Dict[str, Any]] = []

        for idx, q in enumerate(generated.questions):
            q_id = str(uuid.uuid4())
            q.question_id = q_id
            q.order_index = idx + 1
            full_questions.append(q.to_database_dict(assessment_id))
            candidate_questions.append(q.to_candidate_dict())

        # 6. Persist to memory store
        _assessment_memory_store[assessment_id] = assessment_record
        _assessment_questions_store[assessment_id] = full_questions
        _candidate_answers_store[assessment_id] = {}
        if user_id not in _user_assessments_index:
            _user_assessments_index[user_id] = []
        _user_assessments_index[user_id].insert(0, assessment_id)

        # 7. Persist to Supabase Database
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
            logger.info("Successfully persisted multi-format assessment %s to Supabase.", assessment_id)
        except Exception as e:
            logger.debug("Database insert notes for assessment: %s (in-memory store guaranteed)", e)

        # 8. Return candidate-safe response
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
            try:
                res = client.table("assessments").select("*").or_(
                    f"user_id.eq.{user_id},student_id.eq.{user_id}"
                ).order("created_at", desc=True).execute()
                if res.data:
                    for row in res.data:
                        aid = row.get("id")
                        q_res = client.table("assessment_questions").select("*").eq("assessment_id", aid).order("order_index").execute()
                        full_qs = q_res.data or []
                        row_copy = dict(row)
                        clean_qs = []
                        for q in full_qs:
                            cq = dict(q)
                            cq.pop("hidden_test_cases", None)
                            cq.pop("reference_solution", None)
                            cq.pop("solution_code", None)
                            cq.pop("correct_answer", None)
                            cq.pop("correct_answers", None)
                            cq.pop("explanation", None)
                            cq["question_id"] = cq.get("id")
                            clean_qs.append(cq)
                        row_copy["questions"] = clean_qs
                        assessments.append(sanitize_assessment_for_candidate(row_copy))
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

        record = _assessment_memory_store.get(assessment_id)
        full_questions = _assessment_questions_store.get(assessment_id, [])

        if not record:
            try:
                res = client.table("assessments").select("*").eq("id", assessment_id).execute()
                if res.data and len(res.data) > 0:
                    record = res.data[0]
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

        # Authorization check
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
            clean_q.pop("hidden_test_cases", None)
            clean_q.pop("reference_solution", None)
            clean_q.pop("correct_answer", None)
            clean_q.pop("correct_answers", None)
            clean_q.pop("explanation", None)
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
        Idempotent: Refreshing an active assessment resumes the existing session.
        """
        assessment = cls.get_assessment_by_id(client, assessment_id, requesting_user)

        # Transition status to in_progress if ready
        if assessment.get("status") in ("ready", "in_progress"):
            assessment["status"] = "in_progress"
            if assessment_id in _assessment_memory_store:
                _assessment_memory_store[assessment_id]["status"] = "in_progress"
            try:
                client.table("assessments").update({"status": "in_progress"}).eq("id", assessment_id).execute()
            except Exception:
                pass

        questions = assessment.get("questions", [])
        coding_qs = [q for q in questions if q.get("question_type") == "coding"]
        allowed_languages = (
            coding_qs[0].get("allowed_languages", ["python"])
            if coding_qs
            else ["python"]
        )

        duration_sec = assessment.get("duration_seconds", 3600)

        # Count rounds
        mcq_count = len([q for q in questions if q.get("question_type") == "mcq"])
        msq_count = len([q for q in questions if q.get("question_type") == "msq"])
        coding_count = len([q for q in questions if q.get("question_type") == "coding"])

        # Fetch any previously saved candidate answers
        saved_answers = _candidate_answers_store.get(assessment_id, {})

        return {
            "assessment_id": assessment_id,
            "title": assessment.get("title", "Personalized Technical Assessment"),
            "status": assessment.get("status", "in_progress"),
            "duration_seconds": duration_sec,
            "remaining_seconds": duration_sec,
            "allowed_languages": allowed_languages,
            "questions": questions,
            "mcq_count": mcq_count,
            "msq_count": msq_count,
            "coding_count": coding_count,
            "saved_answers": saved_answers,
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
        Idempotent: Refreshing the page returns the exact same session snapshot.
        """
        assessments = cls.get_candidate_assessments(client, user_id)
        if not assessments:
            return None

        # Prioritize in_progress, then ready
        target = next((a for a in assessments if a.get("status") == "in_progress"), None)
        if not target:
            target = next((a for a in assessments if a.get("status") == "ready"), None)

        if not target:
            # If all are completed, return None (requires starting a new one)
            return None

        return cls.start_assessment_session(
            client=client,
            assessment_id=target["id"],
            requesting_user={"id": user_id, "role": "student"},
        )

    @classmethod
    def save_candidate_answer(
        cls,
        client: Client,
        assessment_id: str,
        user_id: str,
        question_id: str,
        selected_option: Optional[str] = None,
        selected_options: Optional[List[str]] = None,
        source_code: Optional[str] = None,
        language: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Persists candidate's answer for an MCQ, MSQ, or Coding question in the active session.
        """
        record = _assessment_memory_store.get(assessment_id)
        if not record or str(record.get("user_id")) != str(user_id):
            raise AuthException(
                code="UNAUTHORIZED_ACCESS",
                message="Cannot record answer: assessment not owned by candidate.",
                status_code=403,
            )

        if assessment_id not in _candidate_answers_store:
            _candidate_answers_store[assessment_id] = {}

        now_iso = datetime.now(timezone.utc).isoformat()
        answer_payload: Dict[str, Any] = {
            "question_id": question_id,
            "updated_at": now_iso,
        }

        if selected_option is not None:
            answer_payload["selected_option"] = selected_option.strip().upper()
        if selected_options is not None:
            answer_payload["selected_options"] = [str(o).strip().upper() for o in selected_options]
        if source_code is not None:
            answer_payload["source_code"] = source_code
        if language is not None:
            answer_payload["language"] = language

        _candidate_answers_store[assessment_id][question_id] = answer_payload
        return {"success": True, "saved_at": now_iso, "question_id": question_id}

    @classmethod
    def complete_assessment(
        cls,
        client: Client,
        assessment_id: str,
        user_id: str,
        submitted_answers: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Deterministically evaluates all MCQ, MSQ, and Coding questions.
        - MCQ: exact match against correct_answer
        - MSQ: exact set match against correct_answers
        - Coding: evaluated test pass ratio
        Transitions status to 'completed' and records results with complete explanations.
        """
        record = _assessment_memory_store.get(assessment_id)
        if not record or str(record.get("user_id")) != str(user_id):
            raise AuthException(
                code="UNAUTHORIZED_ACCESS",
                message="Cannot complete assessment: not owned by candidate.",
                status_code=403,
            )

        full_questions = _assessment_questions_store.get(assessment_id, [])
        saved_answers = dict(_candidate_answers_store.get(assessment_id, {}))
        if submitted_answers:
            saved_answers.update(submitted_answers)

        from backend.app.grading.grading_engine import _submissions_memory_store

        mcq_earned = 0.0
        mcq_total = 0.0
        msq_earned = 0.0
        msq_total = 0.0
        coding_earned = 0.0
        coding_total = 0.0

        evaluated_questions: List[Dict[str, Any]] = []

        for q in full_questions:
            qid = str(q.get("id"))
            q_type = q.get("question_type", "coding")
            marks = float(q.get("marks", 2.0))
            ans = saved_answers.get(qid, {})

            q_eval: Dict[str, Any] = {
                "question_id": qid,
                "title": q.get("title"),
                "question_type": q_type,
                "topic": q.get("topic"),
                "marks_possible": marks,
                "marks_earned": 0.0,
                "is_correct": False,
                "explanation": q.get("explanation"),
            }

            if q_type == "mcq":
                mcq_total += marks
                user_choice = str(ans.get("selected_option") or "").strip().upper()
                correct_choice = str(q.get("correct_answer") or "").strip().upper()
                q_eval["selected_option"] = user_choice
                q_eval["correct_answer"] = correct_choice
                q_eval["options"] = q.get("options")
                if user_choice and user_choice == correct_choice:
                    q_eval["is_correct"] = True
                    q_eval["marks_earned"] = marks
                    mcq_earned += marks

            elif q_type == "msq":
                msq_total += marks
                raw_user_choices = ans.get("selected_options") or []
                user_choices = sorted([str(c).strip().upper() for c in raw_user_choices if str(c).strip()])
                correct_choices = sorted([str(c).strip().upper() for c in (q.get("correct_answers") or []) if str(c).strip()])
                q_eval["selected_options"] = user_choices
                q_eval["correct_answers"] = correct_choices
                q_eval["options"] = q.get("options")
                # Default exact match scoring
                if user_choices and user_choices == correct_choices:
                    q_eval["is_correct"] = True
                    q_eval["marks_earned"] = marks
                    msq_earned += marks

            elif q_type == "coding":
                coding_total += marks
                q_eval["starter_code"] = q.get("starter_code")
                # Find best graded submission for this question
                matching_subs = [
                    s for s in _submissions_memory_store.values()
                    if str(s.get("assessment_id")) == str(assessment_id) and str(s.get("question_id")) == qid
                ]
                if matching_subs:
                    best_sub = sorted(matching_subs, key=lambda s: float(s.get("score", 0.0)), reverse=True)[0]
                    sub_score = float(best_sub.get("score", 0.0))
                    earned = (sub_score / 100.0) * marks
                    q_eval["marks_earned"] = round(earned, 2)
                    q_eval["is_correct"] = (sub_score >= 100.0)
                    q_eval["submission_score"] = sub_score
                    coding_earned += earned
                else:
                    q_eval["marks_earned"] = 0.0
                    q_eval["is_correct"] = False
                    q_eval["submission_score"] = 0.0

            evaluated_questions.append(q_eval)

        total_earned = round(mcq_earned + msq_earned + coding_earned, 2)
        total_possible = round(mcq_total + msq_total + coding_total, 2)
        percentage = round((total_earned / total_possible * 100.0), 2) if total_possible > 0 else 0.0

        now_iso = datetime.now(timezone.utc).isoformat()

        # Update assessment status
        record["status"] = "completed"
        record["completed_at"] = now_iso
        _assessment_memory_store[assessment_id]["status"] = "completed"
        _assessment_memory_store[assessment_id]["completed_at"] = now_iso

        results_record: Dict[str, Any] = {
            "assessment_id": assessment_id,
            "user_id": user_id,
            "status": "completed",
            "title": record.get("title"),
            "difficulty": record.get("difficulty"),
            "total_score": total_earned,
            "max_score": total_possible,
            "percentage": percentage,
            "mcq_score": round(mcq_earned, 2),
            "mcq_max": round(mcq_total, 2),
            "msq_score": round(msq_earned, 2),
            "msq_max": round(msq_total, 2),
            "coding_score": round(coding_earned, 2),
            "coding_max": round(coding_total, 2),
            "questions_count": len(full_questions),
            "questions_passed": len([q for q in evaluated_questions if q["is_correct"]]),
            "questions": evaluated_questions,
            "question_scores": {q["question_id"]: q.get("marks_earned", 0.0) for q in evaluated_questions},
            "completed_at": now_iso,
        }

        _assessment_results_store[assessment_id] = results_record

        # Also store into grading results store for analytics compatibility
        from backend.app.grading.grading_engine import _assessment_results_memory_store
        _assessment_results_memory_store[assessment_id] = {
            "assessment_id": assessment_id,
            "user_id": user_id,
            "total_score": percentage,
            "questions_count": len(full_questions),
            "questions_attempted": len([q for q in evaluated_questions if q.get("selected_option") or q.get("selected_options") or q.get("submission_score")]),
            "questions_passed": results_record["questions_passed"],
            "status": "completed",
            "updated_at": now_iso,
        }

        try:
            client.table("assessments").update({
                "status": "completed",
                "completed_at": now_iso,
            }).eq("id", assessment_id).execute()
        except Exception:
            pass

        try:
            client.table("assessment_results").upsert({
                "assessment_id": assessment_id,
                "student_id": user_id,
                "user_id": user_id,
                "total_questions": len(full_questions),
                "questions_count": len(full_questions),
                "correct_answers": results_record["questions_passed"],
                "questions_passed": results_record["questions_passed"],
                "total_score": percentage,
                "max_possible_score": total_possible,
                "percentage": percentage,
                "passed": percentage >= 60.0,
                "status": "completed",
                "breakdown": results_record,
                "updated_at": now_iso,
            }, on_conflict="assessment_id").execute()
        except Exception as e:
            logger.debug("Database upsert assessment_results note: %s", e)

        return results_record

    @classmethod
    def get_assessment_results(
        cls,
        client: Client,
        assessment_id: str,
        requesting_user: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Retrieves evaluated results including answer keys and explanations once completed.
        Enforces candidate ownership isolation.
        """
        req_user_id = str(requesting_user.get("id"))
        req_role = str(requesting_user.get("role", "student"))

        record = _assessment_memory_store.get(assessment_id)
        if not record:
            try:
                res = client.table("assessments").select("*").eq("id", assessment_id).execute()
                if res.data and len(res.data) > 0:
                    record = res.data[0]
            except Exception:
                pass

        if record:
            owner_id = str(record.get("user_id") or record.get("student_id"))
            if req_role != "company" and owner_id != req_user_id:
                raise AuthException(
                    code="UNAUTHORIZED_ACCESS",
                    message="Cannot view results: assessment not owned by candidate.",
                    status_code=403,
                )

        if assessment_id in _assessment_results_store:
            return _assessment_results_store[assessment_id]

        try:
            r_res = client.table("assessment_results").select("*").eq("assessment_id", assessment_id).execute()
            if r_res.data and len(r_res.data) > 0:
                row = r_res.data[0]
                breakdown = row.get("breakdown") or {}
                combined = {**breakdown, **row}
                combined.setdefault("final_score", row.get("total_score", 0.0))
                combined.setdefault("percentage", row.get("percentage", 0.0))
                combined.setdefault("total_score", row.get("total_score", 0.0))
                return combined
        except Exception as e:
            logger.debug("Database assessment_results fetch note: %s", e)

        # If not evaluated yet, auto-evaluate
        return cls.complete_assessment(client, assessment_id, req_user_id)
