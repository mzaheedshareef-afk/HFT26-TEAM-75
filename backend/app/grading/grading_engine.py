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
from backend.app.services.assessment_service import (
    _assessment_memory_store,
    _assessment_questions_store,
)

logger = logging.getLogger(__name__)

STATUS_TO_VERDICT = {
    "accepted": "AC",
    "wrong_answer": "WA",
    "time_limit_exceeded": "TLE",
    "memory_limit_exceeded": "MLE",
    "compilation_error": "CE",
    "runtime_error": "RTE",
    "security_violation": "SEC",
    "ACCEPTED": "AC",
    "WRONG_ANSWER": "WA",
    "TIME_LIMIT_EXCEEDED": "TLE",
    "MEMORY_LIMIT_EXCEEDED": "MLE",
    "COMPILATION_ERROR": "CE",
    "RUNTIME_ERROR": "RTE",
}

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
        failed_count = len(results) - passed_count
        total_time_ms = round(sum(r.execution_time_ms for r in results), 2)
        max_memory_mb = round(max((r.memory_used_mb for r in results), default=0.0), 2)

        # Detect overall status & verdict
        if any(r.status == "COMPILATION_ERROR" for r in results):
            overall_verdict = "CE"
            overall_status = "compilation_error"
        elif any(r.status == "TIME_LIMIT_EXCEEDED" for r in results):
            overall_verdict = "TLE"
            overall_status = "time_limit_exceeded"
        elif any(r.status == "MEMORY_LIMIT_EXCEEDED" for r in results):
            overall_verdict = "MLE"
            overall_status = "memory_limit_exceeded"
        elif any(r.status == "RUNTIME_ERROR" for r in results):
            overall_verdict = "RTE"
            overall_status = "runtime_error"
        elif passed_count == len(results) and len(results) > 0:
            overall_verdict = "AC"
            overall_status = "accepted"
        else:
            overall_verdict = "WA"
            overall_status = "wrong_answer"

        compile_err = next((r.error_message for r in results if r.status == "COMPILATION_ERROR"), None)
        stdout_top = "\n".join(r.actual_output for r in results if r.actual_output).strip() or None
        stderr_top = "\n".join(r.error_message for r in results if r.error_message).strip() or None

        return {
            "success": True,
            "language": canonical_lang,
            "question_id": question_id,
            "overall_verdict": overall_verdict,
            "status": overall_status,
            "total_test_cases": len(results),
            "total_count": len(results),
            "passed_test_cases": passed_count,
            "passed_count": passed_count,
            "failed_test_cases": failed_count,
            "failed_count": failed_count,
            "total_time_ms": total_time_ms,
            "memory_used_mb": max_memory_mb,
            "stdout": stdout_top,
            "stderr": stderr_top,
            "compile_error": compile_err,
            "compilation_error": compile_err,
            "timed_out": overall_verdict == "TLE",
            "test_results": candidate_results,
            "results": candidate_results,
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
        elapsed_seconds: Optional[int] = None,
        hints_used: Optional[int] = None,
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

        # Determine overall submission status and verdict
        all_results = public_results + hidden_results
        if any(r.status == "COMPILATION_ERROR" for r in all_results):
            overall_status = "compilation_error"
            overall_verdict = "CE"
        elif any(r.status == "TIME_LIMIT_EXCEEDED" for r in all_results):
            overall_status = "time_limit_exceeded"
            overall_verdict = "TLE"
        elif any(r.status == "MEMORY_LIMIT_EXCEEDED" for r in all_results):
            overall_status = "memory_limit_exceeded"
            overall_verdict = "MLE"
        elif any(r.status == "RUNTIME_ERROR" for r in all_results):
            overall_status = "runtime_error"
            overall_verdict = "RTE"
        elif all(r.passed for r in all_results) and len(all_results) > 0:
            overall_status = "accepted"
            overall_verdict = "AC"
        else:
            overall_status = "wrong_answer"
            overall_verdict = "WA"

        # AI Efficiency analysis (does NOT affect deterministic score)
        efficiency_report = AIEfficiencyEvaluator.evaluate_efficiency(
            source_code=source_code,
            language=canonical_lang,
            problem_title=question.get("title", "Coding Problem"),
        )

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
            "question_title": question.get("title", "Coding Question"),
            "language": canonical_lang,
            "source_code": source_code,
            "status": overall_status,
            "verdict": overall_verdict,
            "overall_verdict": overall_verdict,
            "score": score_metrics["score"],
            "deterministic_score": score_metrics["score"],
            "overall_score": score_metrics["score"],
            "total_tests": total_tests_count,
            "passed_tests": passed_tests_count,
            "failed_tests": failed_tests_count,
            "execution_time_ms": round(total_exec_time, 2),
            "memory_used_mb": score_metrics["max_memory_mb"],
            "public_test_results": candidate_public_results,
            "hidden_test_results": candidate_hidden_results,
            "efficiency": efficiency_report,
            "created_at": now_iso,
            "submitted_at": now_iso,
        }

        # 4. Save to in-memory store
        _submissions_memory_store[submission_id] = submission_record
        if user_id not in _user_submissions_index:
            _user_submissions_index[user_id] = []
        _user_submissions_index[user_id].insert(0, submission_id)

        # 5. Persist to Supabase Database (both coding_submissions and submissions)
        try:
            client.table("coding_submissions").insert({
                "id": submission_id,
                "assessment_id": assessment_id,
                "question_id": question_id,
                "student_id": user_id,
                "user_id": user_id,
                "language": canonical_lang,
                "source_code": source_code,
                "execution_status": overall_status,
                "status": overall_status,
                "test_cases_passed": passed_tests_count,
                "passed_tests": passed_tests_count,
                "total_test_cases": total_tests_count,
                "total_tests": total_tests_count,
                "failed_tests": failed_tests_count,
                "execution_time_ms": int(total_exec_time),
                "memory_used_mb": float(score_metrics["max_memory_mb"]),
                "score": float(score_metrics["score"]),
                "test_results": candidate_public_results + candidate_hidden_results,
                "submitted_at": now_iso,
                "created_at": now_iso,
            }).execute()
        except Exception as e:
            logger.debug("Database insert coding_submissions note: %s", e)

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

        public_verdict = (
            "AC" if all(r.passed for r in public_results) and len(public_results) > 0
            else "WA" if any(r.status == "WRONG_ANSWER" for r in public_results)
            else "CE" if any(r.status == "COMPILATION_ERROR" for r in public_results)
            else "TLE" if any(r.status == "TIME_LIMIT_EXCEEDED" for r in public_results)
            else "RTE"
        )

        run_results_dict = {
            "success": True,
            "question_id": question_id,
            "overall_verdict": public_verdict,
            "passed_count": sum(1 for r in public_results if r.passed),
            "total_count": len(public_results),
            "results": candidate_public_results,
        }

        summary_dict = {
            "submission_id": submission_id,
            "assessment_id": assessment_id,
            "question_id": question_id,
            "question_title": question.get("title", "Coding Question"),
            "language": canonical_lang,
            "deterministic_score": score_metrics["score"],
            "overall_score": score_metrics["score"],
            "score": score_metrics["score"],
            "passed_tests": passed_tests_count,
            "failed_tests": failed_tests_count,
            "total_tests": total_tests_count,
            "execution_time_ms": round(total_exec_time, 2),
            "memory_used_mb": score_metrics["max_memory_mb"],
            "overall_verdict": overall_verdict,
            "verdict": overall_verdict,
            "submitted_at": now_iso,
            "efficiency": efficiency_report,
        }

        return {
            "success": True,
            "submission_id": submission_id,
            "assessment_id": assessment_id,
            "question_id": question_id,
            "status": overall_status,
            "verdict": overall_verdict,
            "overall_verdict": overall_verdict,
            "score": score_metrics["score"],
            "deterministic_score": score_metrics["score"],
            "overall_score": score_metrics["score"],
            "is_accepted": overall_status == "accepted",
            "passed_tests": passed_tests_count,
            "failed_tests": failed_tests_count,
            "total_tests": total_tests_count,
            "execution_time_ms": round(total_exec_time, 2),
            "memory_used_mb": score_metrics["max_memory_mb"],
            "public_test_cases": candidate_public_results,
            "hidden_test_cases": candidate_hidden_results,
            "efficiency": efficiency_report,
            "summary": summary_dict,
            "run_results": run_results_dict,
            "created_at": now_iso,
            "submitted_at": now_iso,
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
    def get_latest_submission(
        cls,
        client: Client,
        user_id: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieves candidate's most recent graded submission summary.
        Returns None (consistent empty state) if no submissions exist (never raises 404).
        """
        subs = [
            s for s in _submissions_memory_store.values()
            if str(s.get("user_id")) == str(user_id) or str(s.get("student_id")) == str(user_id)
        ]

        if subs:
            latest = sorted(
                subs,
                key=lambda s: str(s.get("created_at") or s.get("submitted_at") or ""),
                reverse=True,
            )[0]
            summary = dict(latest)
            status_val = latest.get("status") or latest.get("execution_status", "wrong_answer")
            summary.setdefault("deterministic_score", latest.get("score", 0.0))
            summary.setdefault("overall_score", latest.get("score", 0.0))
            summary.setdefault("overall_verdict", STATUS_TO_VERDICT.get(status_val, "WA"))
            summary.setdefault("verdict", STATUS_TO_VERDICT.get(status_val, "WA"))
            summary.setdefault("submission_id", latest.get("id") or latest.get("submission_id"))
            summary.setdefault("passed_tests", latest.get("passed_tests") or latest.get("test_cases_passed", 0))
            summary.setdefault("total_tests", latest.get("total_tests") or latest.get("total_test_cases", 0))
            return summary

        # 1. Query coding_submissions in Supabase
        try:
            res = client.table("coding_submissions").select("*").or_(
                f"user_id.eq.{user_id},student_id.eq.{user_id}"
            ).order("created_at", desc=True).limit(1).execute()
            if res.data and len(res.data) > 0:
                row = dict(res.data[0])
                status_val = row.get("status") or row.get("execution_status", "wrong_answer")
                row.setdefault("deterministic_score", row.get("score", 0.0))
                row.setdefault("overall_score", row.get("score", 0.0))
                row.setdefault("overall_verdict", STATUS_TO_VERDICT.get(status_val, "WA"))
                row.setdefault("verdict", STATUS_TO_VERDICT.get(status_val, "WA"))
                row.setdefault("submission_id", row.get("id") or row.get("submission_id"))
                row.setdefault("passed_tests", row.get("passed_tests") or row.get("test_cases_passed", 0))
                row.setdefault("total_tests", row.get("total_tests") or row.get("total_test_cases", 0))
                return row
        except Exception as e:
            logger.debug("Database coding_submissions fetch note: %s", e)

        # 2. Query legacy submissions in Supabase
        try:
            res = client.table("submissions").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(1).execute()
            if res.data and len(res.data) > 0:
                row = dict(res.data[0])
                status_val = row.get("status") or row.get("execution_status", "wrong_answer")
                row.setdefault("deterministic_score", row.get("score", 0.0))
                row.setdefault("overall_score", row.get("score", 0.0))
                row.setdefault("overall_verdict", STATUS_TO_VERDICT.get(status_val, "WA"))
                row.setdefault("verdict", STATUS_TO_VERDICT.get(status_val, "WA"))
                row.setdefault("submission_id", row.get("id") or row.get("submission_id"))
                return row
        except Exception as e:
            logger.debug("Database submissions fetch note: %s", e)

        # Consistent empty state: return None
        return None

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
                res = client.table("coding_submissions").select("*").eq("id", submission_id).execute()
                if res.data and len(res.data) > 0:
                    sub = res.data[0]
            except Exception as e:
                logger.debug("Database coding_submissions fetch note: %s", e)

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

        owner_id = str(sub.get("user_id") or sub.get("student_id"))
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
        Retrieves comprehensive aggregated assessment results, question breakdown, and scores.
        Enforces candidate ownership isolation.
        """
        req_user_id = str(requesting_user.get("id"))
        req_role = str(requesting_user.get("role", "student"))

        assessment_record = _assessment_memory_store.get(assessment_id)
        if not assessment_record:
            try:
                res = client.table("assessments").select("*").eq("id", assessment_id).execute()
                if res.data and len(res.data) > 0:
                    assessment_record = res.data[0]
            except Exception:
                pass

        if assessment_record:
            owner_id = str(assessment_record.get("user_id"))
            if req_role != "company" and owner_id != req_user_id:
                raise AuthException(
                    code="UNAUTHORIZED_ACCESS",
                    message="Access forbidden: You cannot view another student's assessment results.",
                    status_code=403,
                )

        result = cls._update_assessment_results(client, assessment_id, req_user_id)

        from backend.app.services.hint_service import HintService
        from backend.app.services.efficiency_service import AIEfficiencyScorer

        hints = HintService.get_assessment_hints(client, assessment_id, req_user_id)
        hints_by_q: Dict[str, List[Dict[str, Any]]] = {}
        for h in hints:
            hints_by_q.setdefault(str(h.get("question_id")), []).append(h)

        # Build detailed question performance list
        questions = _assessment_questions_store.get(assessment_id, [])
        all_subs = [
            s for s in _submissions_memory_store.values()
            if str(s.get("assessment_id")) == str(assessment_id)
        ]

        question_perf: List[Dict[str, Any]] = []
        for q in questions:
            qid = str(q.get("id") or q.get("question_id"))
            q_subs = [s for s in all_subs if str(s.get("question_id")) == qid]
            best_sub = sorted(q_subs, key=lambda s: float(s.get("score", 0.0)), reverse=True)[0] if q_subs else None
            q_hints = hints_by_q.get(qid, [])
            hints_count = len(q_hints)
            q_hint_levels = sorted({int(h.get("hint_level", 1)) for h in q_hints})

            if best_sub:
                status_val = best_sub.get("status", "wrong_answer")
                verdict_val = STATUS_TO_VERDICT.get(status_val, "WA")
                score_val = float(best_sub.get("score", 0.0))
                passed_t = int(best_sub.get("passed_tests", 0))
                failed_t = int(best_sub.get("failed_tests", 0))
                total_t = int(best_sub.get("total_tests", 0))
                exec_ms = float(best_sub.get("execution_time_ms", 0.0))
                mem_mb = float(best_sub.get("memory_used_mb", 0.0))
                complexity = best_sub.get("efficiency", {}).get("detected_time_complexity", "O(N)")
            else:
                verdict_val = "PENDING"
                score_val = 0.0
                passed_t = 0
                failed_t = 0
                sample_count = len(q.get("sample_test_cases", []) or q.get("public_test_cases", []))
                hidden_count = len(q.get("hidden_test_cases", []))
                total_t = sample_count + hidden_count
                exec_ms = 0.0
                mem_mb = 0.0
                complexity = "N/A"

            question_perf.append({
                "question_id": qid,
                "title": q.get("title", f"Question {len(question_perf) + 1}"),
                "difficulty": (q.get("difficulty") or "Medium").capitalize(),
                "verdict": verdict_val,
                "score": score_val,
                "passed_tests": passed_t,
                "failed_tests": failed_t,
                "total_tests": total_t,
                "time_taken_seconds": 0,
                "execution_time_ms": exec_ms,
                "memory_used_mb": mem_mb,
                "hints_used": hints_count,
                "hint_levels_used": q_hint_levels,
                "detected_time_complexity": complexity,
            })

        total_passed = sum(p["passed_tests"] for p in question_perf)
        total_failed = sum(p["failed_tests"] for p in question_perf)
        total_tests = sum(p["total_tests"] for p in question_perf)
        coding_score = float(result.get("total_score", 0.0))
        title = assessment_record.get("title", "Personalized Technical Assessment") if assessment_record else "Personalized Technical Assessment"
        status_str = assessment_record.get("status", "completed") if assessment_record else "completed"

        eff_eval = AIEfficiencyScorer.calculate_efficiency_score(
            coding_score=coding_score,
            hint_interactions=hints,
            questions=questions,
            submissions=all_subs,
            tier=assessment_record.get("difficulty") if assessment_record else None,
        )
        ai_eff_score = eff_eval["ai_efficiency_score"]
        final_score = eff_eval["final_score"]
        all_hint_levels = sorted({int(h.get("hint_level", 1)) for h in hints})

        enriched = {
            "assessment_id": assessment_id,
            "assessment_title": title,
            "completion_status": status_str,
            "status": status_str,
            "coding_score": coding_score,
            "deterministic_score": coding_score,
            "ai_efficiency_score": ai_eff_score,
            "final_score": final_score,
            "total_score": final_score,
            "formula_version": eff_eval["formula_version"],
            "scoring_components": eff_eval["scoring_components"],
            "correct_test_cases": total_passed,
            "failed_test_cases": total_failed,
            "total_test_cases": total_tests,
            "time_taken_seconds": assessment_record.get("duration_seconds", 3600) if assessment_record else 3600,
            "total_hints_used": len(hints),
            "hint_levels_used": all_hint_levels,
            "hints_viewed": len(hints) > 0,
            "completed_at": assessment_record.get("completed_at") if assessment_record else None,
            "question_performance": question_perf,
            "question_scores": result.get("question_scores", {}),
            "updated_at": result.get("updated_at"),
        }
        return enriched
