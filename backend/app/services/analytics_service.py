"""
Student Analytics & Performance History Service
Calculates aggregated student performance, historical trends, topic breakdowns, and consistency metrics.
"""

from datetime import datetime, timezone
import logging
import math
from typing import Any, Dict, List, Optional

from supabase import Client

from backend.app.core.security import AuthException
from backend.app.grading.grading_engine import (
    _assessment_results_memory_store,
    _submissions_memory_store,
)
from backend.app.services.assessment_service import (
    AssessmentService,
    _assessment_memory_store,
    _assessment_questions_store,
)
from backend.app.services.efficiency_service import AIEfficiencyScorer
from backend.app.services.hint_service import HintService

logger = logging.getLogger(__name__)


class AnalyticsService:
    """Service generating authentic candidate performance analytics from stored assessment data."""

    @classmethod
    def get_candidate_all_submissions(cls, client: Client, user_id: str) -> List[Dict[str, Any]]:
        """Retrieves all submissions made by the candidate across all assessments."""
        user_submissions = [
            s for s in _submissions_memory_store.values()
            if str(s.get("user_id")) == str(user_id)
        ]

        try:
            res = client.table("submissions").select("*").eq("user_id", user_id).execute()
            if res.data:
                # Merge without duplicating by ID
                existing_ids = {str(s.get("id")) for s in user_submissions}
                for row in res.data:
                    if str(row.get("id")) not in existing_ids:
                        user_submissions.append(row)
        except Exception as e:
            logger.debug("Database submissions fetch note: %s", e)

        return user_submissions

    @classmethod
    def get_candidate_assessment_list(cls, client: Client, user_id: str) -> List[Dict[str, Any]]:
        """Retrieves all assessment sessions belonging to the candidate."""
        return AssessmentService.get_candidate_assessments(client, user_id)

    @classmethod
    def get_student_dashboard_analytics(
        cls,
        client: Client,
        user: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Computes comprehensive dashboard analytics for the authenticated candidate:
        - Assessment summary (total, completed, average, highest).
        - Test case aggregation.
        - Topic-wise & difficulty-wise performance breakdowns.
        - Historical score progression.
        - Improvement delta and consistency score.
        """
        user_id = str(user["id"])
        assessments = cls.get_candidate_assessment_list(client, user_id)
        all_submissions = cls.get_candidate_all_submissions(client, user_id)

        if not assessments:
            # Handle empty history cleanly without fabricating data
            return {
                "success": True,
                "total_assessments": 0,
                "completed_assessments": 0,
                "average_score": 0.0,
                "highest_score": 0.0,
                "latest_final_score": None,
                "total_correct_test_cases": 0,
                "total_failed_test_cases": 0,
                "total_test_cases": 0,
                "average_completion_time_seconds": 0.0,
                "topic_performance": [],
                "difficulty_performance": [],
                "improvement_delta": 0.0,
                "performance_consistency_score": 100.0,
                "historical_trends": [],
            }

        total_assessments = len(assessments)
        completed_assessments = 0
        final_scores: List[float] = []
        completion_times: List[float] = []
        historical_trends: List[Dict[str, Any]] = []

        # Topic & difficulty aggregators
        # topic -> {total_questions, questions_solved, scores}
        topic_map: Dict[str, Dict[str, Any]] = {}
        # difficulty -> {total_questions, questions_solved, scores}
        diff_map: Dict[str, Dict[str, Any]] = {
            "easy": {"total": 0, "solved": 0, "scores": []},
            "medium": {"total": 0, "solved": 0, "scores": []},
            "hard": {"total": 0, "solved": 0, "scores": []},
        }

        # Sort assessments by created_at ascending to build chronological trends
        sorted_assessments = sorted(
            assessments,
            key=lambda a: a.get("created_at", "") or "",
        )

        for assess in sorted_assessments:
            aid = str(assess.get("id"))
            status = str(assess.get("status", "")).lower()
            title = str(assess.get("title", "Technical Assessment"))
            date_str = str(assess.get("completed_at") or assess.get("created_at") or "")

            # Questions for this assessment
            q_list = _assessment_questions_store.get(aid, [])
            if not q_list:
                try:
                    res_q = client.table("assessment_questions").select("*").eq("assessment_id", aid).execute()
                    if res_q.data:
                        q_list = res_q.data
                except Exception:
                    pass

            # Submissions for this assessment
            assess_subs = [s for s in all_submissions if str(s.get("assessment_id")) == aid]

            # Hints for this assessment
            hint_interactions = HintService.get_assessment_hints(client, aid, user_id)

            # Rollup score
            # Check assessment_results memory store or database
            coding_score = 0.0
            if aid in _assessment_results_memory_store:
                coding_score = float(_assessment_results_memory_store[aid].get("total_score", 0.0))
            elif assess_subs:
                # Latest submission score for each question
                latest_by_q: Dict[str, float] = {}
                for s in assess_subs:
                    qid = str(s.get("question_id"))
                    latest_by_q[qid] = max(latest_by_q.get(qid, 0.0), float(s.get("score", 0.0)))
                if latest_by_q:
                    coding_score = sum(latest_by_q.values()) / max(1, len(latest_by_q))

            efficiency_eval = AIEfficiencyScorer.calculate_efficiency_score(
                coding_score=coding_score,
                hint_interactions=hint_interactions,
                questions=q_list,
                submissions=assess_subs,
            )

            c_score = efficiency_eval["coding_score"]
            eff_score = efficiency_eval["ai_efficiency_score"]
            fin_score = efficiency_eval["final_score"]

            time_taken = float(assess.get("elapsed_seconds") or assess.get("time_taken_seconds") or 0.0)

            if status in ("completed", "evaluated") or assess.get("completed_at"):
                completed_assessments += 1
                final_scores.append(fin_score)
                if time_taken > 0:
                    completion_times.append(time_taken)

            historical_trends.append({
                "assessment_id": aid,
                "title": title,
                "date": date_str[:10] if len(date_str) >= 10 else date_str,
                "coding_score": c_score,
                "ai_efficiency_score": eff_score,
                "final_score": fin_score,
                "completion_time_seconds": time_taken,
            })

            # Populate topic and difficulty metrics from questions
            for q in q_list:
                qid = str(q.get("id") or q.get("question_id", ""))
                q_topic = str(q.get("target_skill") or q.get("category") or "Algorithms").strip().title()
                q_diff = str(q.get("difficulty", "medium")).lower()

                # Find best score for question
                q_best_score = max(
                    (float(s.get("score", 0)) for s in assess_subs if str(s.get("question_id")) == qid),
                    default=0.0,
                )
                is_solved = q_best_score >= 80.0

                # Topic stats
                if q_topic not in topic_map:
                    topic_map[q_topic] = {"total": 0, "solved": 0, "scores": []}
                topic_map[q_topic]["total"] += 1
                if is_solved:
                    topic_map[q_topic]["solved"] += 1
                topic_map[q_topic]["scores"].append(q_best_score)

                # Difficulty stats
                if q_diff in diff_map:
                    diff_map[q_diff]["total"] += 1
                    if is_solved:
                        diff_map[q_diff]["solved"] += 1
                    diff_map[q_diff]["scores"].append(q_best_score)

        # Aggregate test cases from submissions
        correct_test_cases = sum(int(s.get("passed_tests", 0)) for s in all_submissions)
        failed_test_cases = sum(int(s.get("failed_tests", 0)) for s in all_submissions)
        total_test_cases = correct_test_cases + failed_test_cases

        avg_score = round(sum(final_scores) / len(final_scores), 2) if final_scores else 0.0
        high_score = round(max(final_scores), 2) if final_scores else 0.0
        latest_score = final_scores[-1] if final_scores else None
        avg_completion_time = (
            round(sum(completion_times) / len(completion_times), 1) if completion_times else 0.0
        )

        # Format topic performance
        topic_performance = []
        for topic, data in topic_map.items():
            tot = data["total"]
            sol = data["solved"]
            avg = round(sum(data["scores"]) / len(data["scores"]), 2) if data["scores"] else 0.0
            rate = round((sol / tot) * 100.0, 1) if tot > 0 else 0.0
            topic_performance.append({
                "topic": topic,
                "total_questions": tot,
                "questions_solved": sol,
                "success_rate": rate,
                "average_score": avg,
            })

        # Format difficulty performance
        difficulty_performance = []
        for diff_name in ("easy", "medium", "hard"):
            data = diff_map[diff_name]
            tot = data["total"]
            sol = data["solved"]
            avg = round(sum(data["scores"]) / len(data["scores"]), 2) if data["scores"] else 0.0
            rate = round((sol / tot) * 100.0, 1) if tot > 0 else 0.0
            difficulty_performance.append({
                "difficulty": diff_name,
                "total_questions": tot,
                "questions_solved": sol,
                "success_rate": rate,
                "average_score": avg,
            })

        # Improvement delta: difference between average of first half and second half
        improvement_delta = 0.0
        if len(final_scores) >= 2:
            mid = len(final_scores) // 2
            first_half = final_scores[:mid]
            second_half = final_scores[mid:]
            avg_first = sum(first_half) / len(first_half)
            avg_second = sum(second_half) / len(second_half)
            improvement_delta = round(avg_second - avg_first, 2)

        # Consistency score: based on standard deviation of scores (100 = perfectly consistent)
        consistency_score = 100.0
        if len(final_scores) >= 2:
            mean = sum(final_scores) / len(final_scores)
            variance = sum((x - mean) ** 2 for x in final_scores) / len(final_scores)
            std_dev = math.sqrt(variance)
            # Std dev of 0 -> 100, std dev of 25 -> 50, std dev of 50 -> 0
            consistency_score = round(max(0.0, min(100.0, 100.0 - (std_dev * 2.0))), 1)

        return {
            "success": True,
            "total_assessments": total_assessments,
            "completed_assessments": completed_assessments,
            "average_score": avg_score,
            "highest_score": high_score,
            "latest_final_score": latest_score,
            "total_correct_test_cases": correct_test_cases,
            "total_failed_test_cases": failed_test_cases,
            "total_test_cases": total_test_cases,
            "average_completion_time_seconds": avg_completion_time,
            "topic_performance": topic_performance,
            "difficulty_performance": difficulty_performance,
            "improvement_delta": improvement_delta,
            "performance_consistency_score": consistency_score,
            "historical_trends": historical_trends,
        }

    @classmethod
    def get_candidate_assessment_history(
        cls,
        client: Client,
        user: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """Retrieves list of candidate assessment summary cards with score breakdowns."""
        user_id = str(user["id"])
        assessments = cls.get_candidate_assessment_list(client, user_id)
        all_submissions = cls.get_candidate_all_submissions(client, user_id)

        history: List[Dict[str, Any]] = []

        for assess in assessments:
            aid = str(assess.get("id"))
            title = str(assess.get("title", "Technical Assessment"))
            diff = str(assess.get("difficulty", "medium"))
            status = str(assess.get("status", "ready"))
            created_at = str(assess.get("created_at", ""))
            completed_at = assess.get("completed_at")

            # Fetch questions
            q_list = _assessment_questions_store.get(aid, [])
            if not q_list:
                try:
                    res_q = client.table("assessment_questions").select("*").eq("assessment_id", aid).execute()
                    if res_q.data:
                        q_list = res_q.data
                except Exception:
                    pass

            assess_subs = [s for s in all_submissions if str(s.get("assessment_id")) == aid]
            hint_interactions = HintService.get_assessment_hints(client, aid, user_id)

            coding_score = 0.0
            if aid in _assessment_results_memory_store:
                coding_score = float(_assessment_results_memory_store[aid].get("total_score", 0.0))
            elif assess_subs:
                scores = [float(s.get("score", 0)) for s in assess_subs]
                coding_score = max(scores, default=0.0)

            eff_eval = AIEfficiencyScorer.calculate_efficiency_score(
                coding_score=coding_score,
                hint_interactions=hint_interactions,
                questions=q_list,
                submissions=assess_subs,
            )

            # Test cases counts
            correct_tc = sum(int(s.get("passed_tests", 0)) for s in assess_subs)
            failed_tc = sum(int(s.get("failed_tests", 0)) for s in assess_subs)
            tot_tc = correct_tc + failed_tc

            # Passed questions count
            passed_questions = 0
            for q in q_list:
                qid = str(q.get("id") or q.get("question_id", ""))
                if any(
                    str(s.get("question_id")) == qid and float(s.get("score", 0)) >= 80.0
                    for s in assess_subs
                ):
                    passed_questions += 1

            time_taken = float(assess.get("elapsed_seconds") or assess.get("time_taken_seconds") or 0.0)

            history.append({
                "assessment_id": aid,
                "title": title,
                "difficulty": diff,
                "status": status,
                "completed_at": completed_at,
                "created_at": created_at,
                "coding_score": eff_eval["coding_score"],
                "ai_efficiency_score": eff_eval["ai_efficiency_score"],
                "final_score": eff_eval["final_score"],
                "formula_version": eff_eval["formula_version"],
                "questions_count": len(q_list),
                "questions_passed": passed_questions,
                "correct_test_cases": correct_tc,
                "total_test_cases": tot_tc,
                "total_time_taken_seconds": time_taken,
            })

        # Return sorted by created_at descending
        return sorted(history, key=lambda x: x.get("created_at", ""), reverse=True)

    @classmethod
    def get_assessment_result_analytics(
        cls,
        client: Client,
        assessment_id: str,
        user: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Retrieves detailed analytics report for an individual assessment.
        Ensures strict candidate assessment ownership.
        """
        user_id = str(user["id"])
        assessment = AssessmentService.get_assessment_by_id(client, assessment_id, user)

        q_list = _assessment_questions_store.get(assessment_id, [])
        if not q_list:
            try:
                res_q = client.table("assessment_questions").select("*").eq("assessment_id", assessment_id).execute()
                if res_q.data:
                    q_list = res_q.data
            except Exception:
                pass

        all_submissions = cls.get_candidate_all_submissions(client, user_id)
        assess_subs = [s for s in all_submissions if str(s.get("assessment_id")) == assessment_id]
        hints = HintService.get_assessment_hints(client, assessment_id, user_id)

        coding_score = 0.0
        if assessment_id in _assessment_results_memory_store:
            coding_score = float(_assessment_results_memory_store[assessment_id].get("total_score", 0.0))
        elif assess_subs:
            latest_by_q: Dict[str, float] = {}
            for s in assess_subs:
                qid = str(s.get("question_id"))
                latest_by_q[qid] = max(latest_by_q.get(qid, 0.0), float(s.get("score", 0.0)))
            if latest_by_q:
                coding_score = sum(latest_by_q.values()) / max(1, len(latest_by_q))

        eff_eval = AIEfficiencyScorer.calculate_efficiency_score(
            coding_score=coding_score,
            hint_interactions=hints,
            questions=q_list,
            submissions=assess_subs,
        )

        # Question performance breakdown
        question_performance: List[Dict[str, Any]] = []
        questions_passed = 0
        total_correct = 0
        total_failed = 0

        for idx, q in enumerate(q_list, 1):
            qid = str(q.get("id") or q.get("question_id", f"q-{idx}"))
            title = str(q.get("title", f"Question {idx}"))
            diff = str(q.get("difficulty", "medium"))
            q_subs = [s for s in assess_subs if str(s.get("question_id")) == qid]
            q_hints = [h for h in hints if str(h.get("question_id")) == qid]

            best_sub = max(q_subs, key=lambda s: float(s.get("score", 0.0)), default=None) if q_subs else None
            score = float(best_sub.get("score", 0.0)) if best_sub else 0.0
            verdict = str(best_sub.get("verdict", "PENDING")) if best_sub else "NOT_SUBMITTED"
            passed = score >= 80.0
            if passed:
                questions_passed += 1

            p_tests = int(best_sub.get("passed_tests", 0)) if best_sub else 0
            f_tests = int(best_sub.get("failed_tests", 0)) if best_sub else 0
            total_correct += p_tests
            total_failed += f_tests

            question_performance.append({
                "question_id": qid,
                "title": title,
                "difficulty": diff,
                "score": score,
                "verdict": verdict,
                "passed": passed,
                "passed_tests": p_tests,
                "failed_tests": f_tests,
                "total_tests": p_tests + f_tests,
                "hints_used": len(q_hints),
                "max_hint_level": max((int(h.get("hint_level", 1)) for h in q_hints), default=0),
            })

        time_taken = float(assessment.get("elapsed_seconds") or assessment.get("time_taken_seconds") or 0.0)

        return {
            "success": True,
            "assessment_id": assessment_id,
            "title": str(assessment.get("title", "Technical Assessment")),
            "status": str(assessment.get("status", "completed")),
            "completed_at": assessment.get("completed_at"),
            "coding_score": eff_eval["coding_score"],
            "ai_efficiency_score": eff_eval["ai_efficiency_score"],
            "final_score": eff_eval["final_score"],
            "formula_version": eff_eval["formula_version"],
            "formula_description": eff_eval["formula_description"],
            "scoring_components": eff_eval["scoring_components"],
            "questions_count": len(q_list),
            "questions_passed": questions_passed,
            "correct_test_cases": total_correct,
            "failed_test_cases": total_failed,
            "total_test_cases": total_correct + total_failed,
            "time_taken_seconds": time_taken,
            "question_performance": question_performance,
        }

