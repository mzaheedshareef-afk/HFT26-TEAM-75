import ast
import logging
from typing import Any, Dict, List, Tuple

from backend.app.schemas.assessment import GeneratedAssessmentSchema, GeneratedQuestionSchema

logger = logging.getLogger(__name__)


class QuestionValidationError(Exception):
    """Raised when generated question or assessment fails sanity/security checks."""
    pass


def validate_python_syntax(code_str: str, label: str = "code") -> Tuple[bool, str]:
    """Validates that a Python snippet parses cleanly into an AST without syntax errors."""
    if not code_str or not code_str.strip():
        return False, f"{label} is empty"
    try:
        ast.parse(code_str)
        return True, ""
    except SyntaxError as err:
        return False, f"Syntax error in {label}: {err}"


def validate_single_question(question: GeneratedQuestionSchema) -> List[str]:
    """
    Performs zero-trust verification on an individual generated question.
    Returns a list of validation failure error strings (empty if valid).
    """
    errors: List[str] = []

    # 1. Content checks
    if not question.title or len(question.title.strip()) < 3:
        errors.append(f"Question '{question.question_id}' title is too short or missing.")
    if not question.description or len(question.description.strip()) < 15:
        errors.append(f"Question '{question.question_id}' description lacks detail.")

    # 2. Example / public test case checks
    examples = question.examples or question.public_test_cases or []
    if len(examples) == 0:
        errors.append(f"Question '{question.question_id}' must provide at least 1 public test example.")
    for idx, ex in enumerate(examples):
        if not isinstance(ex, dict) or "input" not in ex or "expected_output" not in ex:
            errors.append(f"Question '{question.question_id}' example {idx + 1} is missing input or expected_output.")

    # 3. Starter code syntax validation
    if question.starter_code and isinstance(question.starter_code, dict):
        python_starter = question.starter_code.get("python")
        if python_starter:
            is_valid, msg = validate_python_syntax(python_starter, "starter_code['python']")
            if not is_valid:
                errors.append(f"Question '{question.question_id}': {msg}")

    # 4. Reference solution syntax validation (if present)
    if question.reference_solution:
        is_valid, msg = validate_python_syntax(question.reference_solution, "reference_solution")
        if not is_valid:
            errors.append(f"Question '{question.question_id}': {msg}")

    # 5. Hidden test cases check
    if question.hidden_test_cases:
        for idx, htc in enumerate(question.hidden_test_cases):
            if not isinstance(htc, dict) or "input" not in htc or "expected_output" not in htc:
                errors.append(f"Question '{question.question_id}' hidden test case {idx + 1} is malformed.")

    return errors


def validate_generated_assessment(assessment: GeneratedAssessmentSchema) -> None:
    """
    Performs comprehensive zero-trust validation on an entire generated assessment.
    Raises QuestionValidationError if any requirement is violated.
    """
    if not assessment.questions or len(assessment.questions) < 1:
        raise QuestionValidationError("Assessment must have at least one question.")

    all_errors: List[str] = []
    seen_ids = set()

    for idx, q in enumerate(assessment.questions):
        q.order_index = idx + 1
        if q.question_id in seen_ids:
            q.question_id = f"q{idx + 1}"
        seen_ids.add(q.question_id)

        q_errors = validate_single_question(q)
        all_errors.extend(q_errors)

    if all_errors:
        error_msg = "; ".join(all_errors)
        logger.warning("Assessment validation failed: %s", error_msg)
        raise QuestionValidationError(f"Generated assessment failed validation: {error_msg}")


def sanitize_assessment_for_candidate(
    assessment_dict: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Strictly removes all hidden test cases and reference solutions from assessment
    and individual question dicts before sending across the wire to the candidate.
    """
    sanitized = dict(assessment_dict)
    if "questions" in sanitized and isinstance(sanitized["questions"], list):
        clean_questions = []
        for q in sanitized["questions"]:
            if isinstance(q, dict):
                clean_q = dict(q)
                clean_q.pop("hidden_test_cases", None)
                clean_q.pop("reference_solution", None)
                clean_questions.append(clean_q)
            else:
                clean_questions.append(q)
        sanitized["questions"] = clean_questions

    # Strip any stray root secrets
    sanitized.pop("reference_solutions", None)
    sanitized.pop("hidden_tests", None)
    return sanitized
