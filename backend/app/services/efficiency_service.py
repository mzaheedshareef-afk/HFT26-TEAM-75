"""
AI Efficiency Scoring Engine (Formula Version v1.0)
Calculates deterministic, transparent, and normalized AI efficiency scores.
Combines coding correctness (80%) and calibrated AI utilization efficiency (20%).
"""

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

FORMULA_VERSION = "v1.0"
CODING_WEIGHT = 0.80
EFFICIENCY_WEIGHT = 0.20

DIFFICULTY_PENALTY_MULTIPLIER = {
    "easy": 1.2,
    "medium": 1.0,
    "hard": 0.7,
}

BASE_HINT_PENALTIES = {
    1: 3.0,   # Level 1 Conceptual guidance
    2: 6.0,   # Level 2 Strategy & Data Structure
    3: 9.0,   # Level 3 Implementation & Optimization
}


class AIEfficiencyScorer:
    """
    Zero-LLM deterministic scoring service.
    Evaluates how effectively candidate combined problem-solving with AI assistance.
    """

    @classmethod
    def calculate_efficiency_score(
        cls,
        coding_score: float,
        hint_interactions: List[Dict[str, Any]],
        questions: List[Dict[str, Any]],
        submissions: Optional[List[Dict[str, Any]]] = None,
        tier: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Calculates normalized AI efficiency score and final composite score.

        Principles:
        1. Never penalizes students purely for using AI.
        2. Proactive inquiry on Hard problems receives minimal deduction.
        3. Successful resolution following AI guidance earns an Effective Utilization offset.
        4. Formula is strictly deterministic and version-stamped.
        """
        submissions = submissions or []
        questions_by_id = {
            str(q.get("id", "")): q for q in questions
        }
        # Also map question_id field if present
        for q in questions:
            if "question_id" in q:
                questions_by_id[str(q["question_id"])] = q

        # Group hint interactions by question_id
        hints_by_question: Dict[str, List[Dict[str, Any]]] = {}
        for h in hint_interactions:
            qid = str(h.get("question_id", ""))
            hints_by_question.setdefault(qid, []).append(h)

        total_questions = max(1, len(questions))
        total_deduction = 0.0
        total_effective_bonus = 0.0
        independent_count = 0
        resolved_after_hint_count = 0

        # Submissions outcome map by question_id
        accepted_questions = set()
        for s in submissions:
            verdict = str(s.get("verdict", "")).upper()
            status = str(s.get("status", "")).lower()
            if verdict == "AC" or status == "accepted" or float(s.get("score", 0)) >= 80.0:
                accepted_questions.add(str(s.get("question_id", "")))

        for q in questions:
            qid = str(q.get("id") or q.get("question_id", ""))
            q_hints = hints_by_question.get(qid, [])
            diff = str(q.get("difficulty", "medium")).lower()
            diff_mult = DIFFICULTY_PENALTY_MULTIPLIER.get(diff, 1.0)

            if not q_hints:
                independent_count += 1
                continue

            # Evaluate max hint level requested for this question
            max_level = max((int(h.get("hint_level", 1)) for h in q_hints), default=1)
            base_pen = BASE_HINT_PENALTIES.get(max_level, 3.0)
            adjusted_penalty = (base_pen * diff_mult) / total_questions
            total_deduction += adjusted_penalty

            # Effective Utilization Offset: Did candidate solve the question after requesting AI help?
            if qid in accepted_questions:
                resolved_after_hint_count += 1
                offset = (4.0 * diff_mult) / total_questions
                total_effective_bonus += offset

        # Independent problem solving bonus
        independent_ratio = independent_count / total_questions
        independent_bonus = 4.0 * independent_ratio

        # Compilation error frequency deduction
        compilation_error_count = sum(
            1 for s in submissions
            if str(s.get("status", "")).lower() == "compilation_error"
            or str(s.get("verdict", "")).upper() == "CE"
        )
        ce_penalty = min(6.0, max(0, compilation_error_count - 1) * 1.5)

        # Baseline starts at 100.0
        raw_efficiency = 100.0 - total_deduction + total_effective_bonus + independent_bonus - ce_penalty
        efficiency_score = round(max(0.0, min(100.0, raw_efficiency)), 2)

        # Normalize coding score bounds
        normalized_coding_score = round(max(0.0, min(100.0, coding_score)), 2)

        # For Novice/Easy tier, AI Assistant is completely disabled.
        # Technical score is normalized to full 100-point scale with zero penalty.
        if tier and str(tier).strip().lower() in ("easy", "novice"):
            return {
                "coding_score": normalized_coding_score,
                "ai_efficiency_score": 100.0,
                "final_score": normalized_coding_score,
                "formula_version": FORMULA_VERSION,
                "formula_description": "Final Score = 100% Coding Score (Novice tier: AI Assistant disabled)",
                "scoring_components": {
                    "formula_version": FORMULA_VERSION,
                    "tier": "novice",
                    "weights": {
                        "coding_weight": 1.0,
                        "efficiency_weight": 0.0,
                    },
                    "total_questions": total_questions,
                    "questions_solved_independently": total_questions,
                    "questions_resolved_after_hints": 0,
                    "total_hints_used": 0,
                    "deductions": {
                        "hint_progression_deduction": 0.0,
                        "compilation_error_deduction": 0.0,
                    },
                    "bonuses": {
                        "effective_utilization_bonus": 0.0,
                        "independent_solving_bonus": 0.0,
                    },
                    "normalized_coding_score": normalized_coding_score,
                    "raw_efficiency_score": 100.0,
                },
            }

        # Final composite score: 80% Coding + 20% AI Efficiency
        final_score = round(
            (CODING_WEIGHT * normalized_coding_score) + (EFFICIENCY_WEIGHT * efficiency_score),
            2,
        )

        scoring_components = {
            "formula_version": FORMULA_VERSION,
            "weights": {
                "coding_weight": CODING_WEIGHT,
                "efficiency_weight": EFFICIENCY_WEIGHT,
            },
            "total_questions": total_questions,
            "questions_solved_independently": independent_count,
            "questions_resolved_after_hints": resolved_after_hint_count,
            "total_hints_used": len(hint_interactions),
            "deductions": {
                "hint_progression_deduction": round(total_deduction, 2),
                "compilation_error_deduction": round(ce_penalty, 2),
            },
            "bonuses": {
                "effective_utilization_bonus": round(total_effective_bonus, 2),
                "independent_solving_bonus": round(independent_bonus, 2),
            },
            "normalized_coding_score": normalized_coding_score,
            "raw_efficiency_score": efficiency_score,
        }

        return {
            "coding_score": normalized_coding_score,
            "ai_efficiency_score": efficiency_score,
            "final_score": final_score,
            "formula_version": FORMULA_VERSION,
            "formula_description": "Final Score = 80% Coding Score + 20% AI Efficiency Score (v1.0)",
            "scoring_components": scoring_components,
        }

