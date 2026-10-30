"""
Deterministic Score Calculator
Computes exact test case pass/fail metrics and scores based on expected outputs and weights.
No LLMs are used for correctness decisions.
"""

import math
from typing import Any, Dict, List, Optional, Tuple

from backend.app.execution.comparator import (
    compare_outputs,
    compare_single_token,
    normalize_output,
)


class ScoreCalculator:
    """Calculates deterministic grades for question submissions and overall assessments."""

    @classmethod
    def evaluate_test_results(
        cls,
        test_case_evaluations: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Calculates pass/fail counts, weighted question score (0-100), and execution metrics.
        test_case_evaluations items format:
        {
            "test_case_id": str,
            "passed": bool,
            "weight": float,
            "execution_time_ms": float,
            "memory_used_mb": float,
            "status": str
        }
        """
        total_tests = len(test_case_evaluations)
        if total_tests == 0:
            return {
                "score": 0.0,
                "passed_tests": 0,
                "failed_tests": 0,
                "total_tests": 0,
                "is_accepted": False,
                "total_time_ms": 0.0,
                "max_memory_mb": 0.0,
            }

        passed_tests = sum(1 for t in test_case_evaluations if t.get("passed", False))
        failed_tests = total_tests - passed_tests

        # Weighted calculation
        total_weight = sum(float(t.get("weight", 1.0)) for t in test_case_evaluations)
        if total_weight <= 0:
            total_weight = float(total_tests)

        earned_weight = sum(
            float(t.get("weight", 1.0))
            for t in test_case_evaluations
            if t.get("passed", False)
        )

        score = round((earned_weight / total_weight) * 100.0, 2)
        is_accepted = (passed_tests == total_tests)

        total_time_ms = sum(float(t.get("execution_time_ms", 0.0)) for t in test_case_evaluations)
        max_memory_mb = max((float(t.get("memory_used_mb", 0.0)) for t in test_case_evaluations), default=0.0)

        return {
            "score": score,
            "passed_tests": passed_tests,
            "failed_tests": failed_tests,
            "total_tests": total_tests,
            "is_accepted": is_accepted,
            "total_time_ms": round(total_time_ms, 2),
            "max_memory_mb": round(max_memory_mb, 2),
        }

    @classmethod
    def calculate_assessment_final_score(
        cls,
        question_scores: List[float],
        total_questions: int,
    ) -> float:
        """
        Computes final assessment score (0-100) across all questions.
        Unattempted questions are counted as 0.
        """
        if total_questions <= 0:
            return 0.0

        total_earned = sum(question_scores)
        final_score = round(total_earned / total_questions, 2)
        return min(max(final_score, 0.0), 100.0)
