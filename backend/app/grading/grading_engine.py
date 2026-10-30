"""
Deterministic Grading Engine
Evaluates student submissions against public and hidden test cases.
Computes deterministic weighted scores, records submissions, and preserves hidden test confidentiality.
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional
import uuid

from supabase import Client

from backend.app.core.security import AuthException
from backend.app.execution.execution_manager import ExecutionManager, TestCaseResult
from backend.app.execution.security import ExecutionSecurityValidator
from backend.app.grading.ai_efficiency import AIEfficiencyEvaluator
from backend.app.grading.score_calculator import ScoreCalculator
from backend.app.services.assessment_service import _assessment_questions_store

logger = logging.getLogger(__name__)

# In-memory stores for resilient, lightning-fast testing and fallback
_submissions_memory_store: Dict[str, Dict[str, Any]] = {}  # submission_id -> submission dict
_user_submissions_index: Dict[str, List[str]] = {}  # user_id -> list of submission_ids
_assessment_results_memory_store: Dict[str, Dict[str, Any]] = {}  # assessment_id -> assessment results dict


class GradingEngine:
    """Zero-trust deterministic evaluation and grading engine."""

    @classmethod
    def get_trusted_question(
        cls,
        client: Client,
        question_id: str,
        assessment_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Retrieves trusted question details (including server-side hidden test cases).
        Looks up memory store first, then queries Supabase assessment_questions table.
        """
        # 1. Search memory store
        if assessment_id and assessment_id in _assessment_questions_store:
            for q in _assessment_questions_store[assessment_id]:
                if str(q.get("id")) == str(question_id) or str(q.get("question_id")) == str(question_id):
                    return q

        # Also search across all assessments in memory store
        for aid, q_list in _assessment_questions_store.items():
            for q in q_list:
                if str(q.get("id")) == str(question_id) or str(q.get("question_id")) == str(question_id):
                    return q

        # 2. Query Supabase database
        try:
            res = client.table("assessment_questions").select("*").eq("id", question_id).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            logger.debug("Database question fetch note: %s", e)

        raise AuthException(
            code="QUESTION_NOT_FOUND",
            message=f"Question with ID '{question_id}' not found.",
            status_code=404,
        )

    @classmethod
    def run_public_tests(
        cls,
        source_code: str,
        language: str,
        question_id: str,
        client: Client,
        custom_input: Optional[str] = None,
        assessment_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Runs code only against public test cases (or a single custom input).
        Does NOT touch hidden test cases or record a graded submission.
        """
        # Validate inputs
        canonical_lang = ExecutionSecurityValidator.run_pre_execution_checks(source_code, language)
        question = cls.get_trusted_question(client, question_id, assessment_id)

        time_limit = float(question.get("time_limit_seconds", 2.0))
        memory_limit = int(question.get("memory_limit_mb", 256))

        if custom_input is not None and custom_input.strip():
            test_cases = [{
                "test_case_id": "custom_run",
                "input": custom_input,
                "expected_output": "",
                "weight": 1.0,
            }]
        else:
            test_cases = question.get("sample_test_cases") or question.get("public_test_cases") or []

        # Execute tests
        results: List[TestCaseResult] = ExecutionManager.execute_test_suite(
            source_code=source_code,
            language=canonical_lang,
            test_cases=test_cases,
            time_limit_seconds=time_limit,
            memory_limit_mb=memory_limit,
        )

        candidate_results = [r.to_candidate_dict(is_hidden=False) for r in results]
        passed_count = sum(1 for r in results if r.passed)

        return {
            "success": True,
            "language": canonical_lang,
            "question_id": question_id,
            "total_test_cases": len(results),
            "passed_test_cases": passed_count,
            "failed_test_cases": len(results) - passed_count,
            "test_results": candidate_results,
        }

    @classmethod
    def submit_and_grade(
        cls,
        source_code: str,
        language: str,
        question_id: str,
        assessment_id: str,
        user_id: str,
        client: Client,
    ) -> Dict[str, Any]:
        """
        Evaluates submission against BOTH public and hidden test cases.
        Calculates deterministic grade, persists submission to Supabase,
        updates assessment aggregate results, and strips hidden test details.
        """
        canonical_lang = ExecutionSecurityValidator.run_pre_execution_checks(source_code, language)
        question = cls.get_trusted_question(client, question_id, assessment_id)

        time_limit = float(question.get("time_limit_seconds", 2.0))
        memory_limit = int(question.get("memory_limit_mb", 256))

        public_cases = question.get("sample_test_cases") or question.get("public_test_cases") or []
        hidden_cases = question.get("hidden_test_cases") or []

        # Ensure unique IDs and weights
        for idx, tc in enumerate(public_cases):
            tc.setdefault("test_case_id", f"pub_{idx + 1}")
            tc.setdefault("weight", 1.0)
        for idx, tc in enumerate(hidden_cases):
            tc.setdefault("test_case_id", f"hid_{idx + 1}")
            tc.setdefault("weight", tc.get("weight", 20.0))

        # 1. Execute public test cases
        public_results: List[TestCaseResult] = ExecutionManager.execute_test_suite(
            source_code=source_code,
            language=canonical_lang,
            test_cases=public_cases,
            time_limit_seconds=time_limit,
            memory_limit_mb=memory_limit,
        )

        # 2. Execute hidden test cases
        hidden_results: List[TestCaseResult] = []
        is_compilation_error = any(r.status == "COMPILATION_ERROR" for r in public_results)

        if is_compilation_error:
            # Fast fail hidden tests if public tests had compilation error
            for tc in hidden_cases:
                hidden_results.append(TestCaseResult(
                    test_case_id=tc.get("test_case_id", "hid_tc"),
                    status="COMPILATION_ERROR",
                    passed=False,
                    input="",
                    expected_output="",
                    actual_output="",
                    error_message="Skipped due to compilation error.",
                    weight=float(tc.get("weight", 20.0)),
                ))
        else:
            hidden_results = ExecutionManager.execute_test_suite(
                source_code=source_code,
                language=canonical_lang,
                test_cases=hidden_cases,
                time_limit_seconds=time_limit,
                memory_limit_mb=memory_limit,
            )

        # 3. Deterministic score calculation
        # If there are hidden test cases, grade primary score based on weighted hidden tests (or combined)
        combined_tests = hidden_cases if hidden_cases else public_cases
        combined_results = hidden_results if hidden_results else public_results

        eval_data = [
            {
                "test_case_id": r.test_case_id,
                "passed": r.passed,
                "weight": r.weight,
                "execution_time_ms": r.execution_time_ms,
                "memory_used_mb": r.memory_used_mb,
                "status": r.status,
            }
            for r in combined_results
        ]
        score_metrics = ScoreCalculator.evaluate_test_results(eval_data)

        # Determine overall submission status
        all_results = public_results + hidden_results
        if any(r.status == "COMPILATION_ERROR" for r in all_results):
            overall_status = "compilation_error"
        elif any(r.status == "TIME_LIMIT_EXCEEDED" for r in all_results):
            overall_status = "time_limit_exceeded"
        elif any(r.status == "MEMORY_LIMIT_EXCEEDED" for r in all_results):
            overall_status = "memory_limit_exceeded"
        elif any(r.status == "RUNTIME_ERROR" for r in all_results):
            overall_status = "runtime_error"
        elif all(r.passed for r in all_results):
            overall_status = "accepted"
        else:
            overall_status = "wrong_answer"

        # AI Efficiency analysis (does NOT affect deterministic score)
        efficiency_report = AIEfficiencyEvaluator.evaluate_efficiency(
            source_code=source_code,
            language=canonical_lang,
            problem_title=question.get("title", "Coding Problem"),
        )

        # Total counts across public + hidden
        total_tests_count = len(all_results)
        passed_tests_count = sum(1 for r in all_results if r.passed)
        failed_tests_count = total_tests_count - passed_tests_count

        total_exec_time = sum(r.execution_time_ms for r in all_results)
        submission_id = str(uuid.uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()

        # Build candidate-safe test results (strip hidden inputs/outputs)
        candidate_public_results = [r.to_candidate_dict(is_hidden=False) for r in public_results]
        candidate_hidden_results = [r.to_candidate_dict(is_hidden=True) for r in hidden_results]

        submission_record = {
            "id": submission_id,
            "submission_id": submission_id,
            "user_id": user_id,
            "assessment_id": assessment_id,
            "question_id": question_id,
            "language": canonical_lang,
            "source_code": source_code,
            "status": overall_status,
            "score": score_metrics["score"],
            "total_tests": total_tests_count,
            "passed_tests": passed_tests_count,
            "failed_tests": failed_tests_count,
            "execution_time_ms": round(total_exec_time, 2),
            "memory_used_mb": score_metrics["max_memory_mb"],
            "public_test_results": candidate_public_results,
            "hidden_test_results": candidate_hidden_results,
            "efficiency": efficiency_report,
            "created_at": now_iso,
        }

        # 4. Save to in-memory store
        _submissions_memory_store[submission_id] = submission_record
        if user_id not in _user_submissions_index:
            _user_submissions_index[user_id] = []
        _user_submissions_index[user_id].insert(0, submission_id)

        # 5. Persist to Supabase Database
        try:
            client.table("submissions").insert({
                "id": submission_id,
                "user_id": user_id,
                "assessment_id": assessment_id,
                "question_id": question_id,
                "language": canonical_lang,
                "source_code": source_code,
                "status": overall_status,
                "score": score_metrics["score"],
                "total_tests": total_tests_count,
                "passed_tests": passed_tests_count,
                "failed_tests": failed_tests_count,
                "execution_time_ms": round(total_exec_time, 2),
                "memory_used_mb": score_metrics["max_memory_mb"],
                "test_results": candidate_public_results + candidate_hidden_results,
            }).execute()
        except Exception as e:
            logger.debug("Database insert submission note: %s", e)

        # 6. Update overall assessment aggregate results
        cls._update_assessment_results(
            client=client,
            assessment_id=assessment_id,
            user_id=user_id,
        )

        return {
            "success": True,
            "submission_id": submission_id,
            "assessment_id": assessment_id,
            "question_id": question_id,
            "status": overall_status,
            "score": score_metrics["score"],
            "is_accepted": overall_status == "accepted",
            "passed_tests": passed_tests_count,
            "failed_tests": failed_tests_count,
            "total_tests": total_tests_count,
            "public_test_cases": candidate_public_results,
            "hidden_test_cases": candidate_hidden_results,
            "efficiency": efficiency_report,
            "created_at": now_iso,
        }

    @classmethod
    def _update_assessment_results(
        cls,
        client: Client,
        assessment_id: str,
        user_id: str,
    ) -> Dict[str, Any]:
        """
        Recalculates total assessment score across all questions in the assessment.
        Takes the best score per question.
        """
        # Find all submissions for this assessment
        submissions = [
            s for s in _submissions_memory_store.values()
            if str(s.get("assessment_id")) == str(assessment_id)
        ]

        # Best score per question
        best_per_question: Dict[str, float] = {}
        for s in submissions:
            qid = str(s.get("question_id"))
            score = float(s.get("score", 0.0))
            if qid not in best_per_question or score > best_per_question[qid]:
                best_per_question[qid] = score

        # Determine total questions in assessment
        questions_in_assessment = _assessment_questions_store.get(assessment_id, [])
        total_questions = len(questions_in_assessment) or len(best_per_question) or 1

        final_score = ScoreCalculator.calculate_assessment_final_score(
            question_scores=list(best_per_question.values()),
            total_questions=total_questions,
        )

        passed_questions = sum(1 for s in best_per_question.values() if s >= 100.0)
        now_iso = datetime.now(timezone.utc).isoformat()

        result_record = {
            "assessment_id": assessment_id,
            "user_id": user_id,
            "total_score": final_score,
            "questions_count": total_questions,
            "questions_attempted": len(best_per_question),
            "questions_passed": passed_questions,
            "status": "completed" if len(best_per_question) >= total_questions else "in_progress",
            "question_scores": best_per_question,
            "updated_at": now_iso,
        }

        _assessment_results_memory_store[assessment_id] = result_record

        try:
            client.table("assessment_results").upsert({
                "assessment_id": assessment_id,
                "user_id": user_id,
                "total_score": final_score,
                "questions_count": total_questions,
                "questions_passed": passed_questions,
                "status": result_record["status"],
                "breakdown": best_per_question,
                "updated_at": now_iso,
            }).execute()
        except Exception as e:
            logger.debug("Database upsert assessment_results note: %s", e)

        return result_record

    @classmethod
    def get_submission_by_id(
        cls,
        client: Client,
        submission_id: str,
        requesting_user: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Retrieves submission details by ID.
        Strict ownership check: Students can only view their own submissions.
        Companies / recruiters can view submissions for assessment evaluation.
        """
        req_user_id = str(requesting_user.get("id"))
        req_role = str(requesting_user.get("role", "student"))

        sub = _submissions_memory_store.get(submission_id)
        if not sub:
            try:
                res = client.table("submissions").select("*").eq("id", submission_id).execute()
                if res.data and len(res.data) > 0:
                    sub = res.data[0]
            except Exception as e:
                logger.debug("Database submission fetch note: %s", e)

        if not sub:
            raise AuthException(
                code="SUBMISSION_NOT_FOUND",
                message=f"Submission with ID '{submission_id}' not found.",
                status_code=404,
            )

        owner_id = str(sub.get("user_id"))
        if req_role != "company" and owner_id != req_user_id:
            raise AuthException(
                code="UNAUTHORIZED_ACCESS",
                message="Access forbidden: You cannot view another student's submission.",
                status_code=403,
            )

        return dict(sub)

    @classmethod
    def get_assessment_results(
        cls,
        client: Client,
        assessment_id: str,
        requesting_user: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Retrieves aggregated assessment results, question breakdown, and scores.
        Enforces candidate ownership isolation.
        """
        req_user_id = str(requesting_user.get("id"))
        req_role = str(requesting_user.get("role", "student"))

        result = _assessment_results_memory_store.get(assessment_id)
        if not result:
            # Recompute or query Supabase
            result = cls._update_assessment_results(client, assessment_id, req_user_id)

        owner_id = str(result.get("user_id"))
        if req_role != "company" and owner_id != req_user_id:
            raise AuthException(
                code="UNAUTHORIZED_ACCESS",
                message="Access forbidden: You cannot view another student's assessment results.",
                status_code=403,
            )

        return result
