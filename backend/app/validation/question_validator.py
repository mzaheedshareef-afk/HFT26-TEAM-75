"""
Comprehensive Zero-Trust Question & Task Validation Pipeline
Enforces:
- MCQ: Exactly 1 valid option from distinct choices, non-empty explanation, portfolio-aligned
- MSQ: At least 2 valid options from distinct choices, non-empty explanation, portfolio-aligned
- Coding:
  - Test A: Reference solution execution and 100% test pass confirmation
  - Test B: Starter code execution and confirmation of acceptance test failure (not pre-solved)
  - Test C: Test suite quality, uniqueness, and edge case presence
  - Test D: Security checks against dangerous calls, network sockets, and path traversal
  - Strict DSA topic whitelist compliance against candidate portfolio
Role: QA, Architecture & Security Lead
Project: Portfolio-Driven Adaptive Coding & Technical Assessment Platform
"""

import ast
from enum import Enum
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from backend.app.schemas.assessment import GeneratedAssessmentSchema, GeneratedQuestionSchema
from backend.app.validation.dsa_whitelist import validate_question_dsa_whitelist
from backend.app.validation.reference_validator import validate_reference_solution
from backend.app.validation.test_validator import (
    validate_starter_code_fails_tests,
    validate_test_suite_quality,
)

logger = logging.getLogger(__name__)


class TaskValidationStatus(str, Enum):
    GENERATED = "GENERATED"
    VALIDATING = "VALIDATING"
    VALIDATED = "VALIDATED"
    REJECTED = "REJECTED"
    FAILED = "FAILED"


class QuestionValidationError(Exception):
    """Raised when generated question or assessment fails sanity/security checks."""
    pass


FORBIDDEN_CALL_PATTERNS = [
    r"\bos\.(system|popen|spawn|exec|remove|unlink|rmdir)\b",
    r"\bsubprocess\.(run|Popen|call|check_output)\b",
    r"\b(pty|commands)\b",
    r"\bsocket\.(socket|connect|bind)\b",
    r"\b(urllib\.request|requests|http\.client)\b",
    r"\b(open\s*\(\s*['\"]/(etc|var|proc|sys|root|home|tmp/docker\.sock))",
    r"\b(docker\.sock|/var/run/docker\.sock)\b",
    r"\bctypes\b",
]


def validate_security_operations(code_str: str, label: str = "code") -> Tuple[bool, str]:
    """
    Test D: Static AST and regex inspection for dangerous operations.
    Blocks subprocess, networking, shell execution, and unauthorized host filesystem traversal.
    """
    if not code_str:
        return True, ""

    for pat in FORBIDDEN_CALL_PATTERNS:
        if re.search(pat, code_str, re.IGNORECASE):
            return False, f"Forbidden security operation detected in {label}: matches pattern '{pat}'"

    # AST check for imports
    try:
        tree = ast.parse(code_str)
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name in ("subprocess", "socket", "ctypes", "pty", "commands"):
                        return False, f"Dangerous import '{alias.name}' detected in {label}."
            elif isinstance(node, ast.ImportFrom):
                if node.module in ("subprocess", "socket", "ctypes", "pty", "commands"):
                    return False, f"Dangerous import from '{node.module}' detected in {label}."
    except SyntaxError:
        pass  # Syntax validation handles this separately

    return True, ""


def validate_python_syntax(code_str: str, label: str = "code") -> Tuple[bool, str]:
    """Validates that a Python snippet parses cleanly into an AST without syntax errors."""
    if not code_str or not code_str.strip():
        return False, f"{label} is empty"
    try:
        ast.parse(code_str)
        return True, ""
    except SyntaxError as err:
        return False, f"Syntax error in {label}: {err}"


def validate_mcq_task(question: GeneratedQuestionSchema) -> Tuple[bool, List[str]]:
    """
    Validates an MCQ question:
    - 4 options by default (at least 2 distinct options required)
    - All options have unique IDs and distinct texts
    - Exactly 1 correct answer referencing a valid option ID
    - Explanation is present and non-empty
    """
    errors: List[str] = []
    if not question.options or len(question.options) < 2:
        errors.append(f"MCQ '{question.question_id}' must have at least 2 options (has {len(question.options or [])}).")
        return False, errors

    option_ids = set()
    option_texts = set()
    for opt in question.options:
        opt_id = opt.id.strip().upper() if hasattr(opt, "id") else str(opt.get("id", "")).strip().upper()
        opt_text = opt.text.strip().lower() if hasattr(opt, "text") else str(opt.get("text", "")).strip().lower()

        if not opt_id:
            errors.append(f"MCQ '{question.question_id}' option missing ID.")
        elif opt_id in option_ids:
            errors.append(f"MCQ '{question.question_id}' has duplicate option ID '{opt_id}'.")
        option_ids.add(opt_id)

        if not opt_text:
            errors.append(f"MCQ '{question.question_id}' option text is empty.")
        elif opt_text in option_texts:
            errors.append(f"MCQ '{question.question_id}' has duplicate option content.")
        option_texts.add(opt_text)

    # Exactly one correct answer
    correct = str(question.correct_answer or "").strip().upper()
    if not correct:
        errors.append(f"MCQ '{question.question_id}' is missing a correct answer.")
    elif correct not in option_ids:
        errors.append(f"MCQ '{question.question_id}' correct answer '{correct}' not found in option IDs: {sorted(list(option_ids))}.")

    if not question.explanation or len(question.explanation.strip()) < 10:
        errors.append(f"MCQ '{question.question_id}' explanation is missing or too brief.")

    return len(errors) == 0, errors


def validate_msq_task(question: GeneratedQuestionSchema) -> Tuple[bool, List[str]]:
    """
    Validates an MSQ question:
    - Multiple answer options (at least 3 options)
    - All options distinct in ID and content
    - At least two valid correct answers
    - Every correct answer exists in options
    - Explanation is present and non-empty
    """
    errors: List[str] = []
    if not question.options or len(question.options) < 3:
        errors.append(f"MSQ '{question.question_id}' must have at least 3 options (has {len(question.options or [])}).")
        return False, errors

    option_ids = set()
    option_texts = set()
    for opt in question.options:
        opt_id = opt.id.strip().upper() if hasattr(opt, "id") else str(opt.get("id", "")).strip().upper()
        opt_text = opt.text.strip().lower() if hasattr(opt, "text") else str(opt.get("text", "")).strip().lower()

        if not opt_id:
            errors.append(f"MSQ '{question.question_id}' option missing ID.")
        elif opt_id in option_ids:
            errors.append(f"MSQ '{question.question_id}' duplicate option ID '{opt_id}'.")
        option_ids.add(opt_id)

        if not opt_text:
            errors.append(f"MSQ '{question.question_id}' option text is empty.")
        elif opt_text in option_texts:
            errors.append(f"MSQ '{question.question_id}' duplicate option content.")
        option_texts.add(opt_text)

    # At least two correct answers
    correct_list = [str(ans).strip().upper() for ans in (question.correct_answers or []) if str(ans).strip()]
    if len(correct_list) < 2:
        errors.append(f"MSQ '{question.question_id}' must have at least 2 correct answers (found {len(correct_list)}).")
    for ans in correct_list:
        if ans not in option_ids:
            errors.append(f"MSQ '{question.question_id}' correct answer '{ans}' not found in option IDs: {sorted(list(option_ids))}.")

    if not question.explanation or len(question.explanation.strip()) < 10:
        errors.append(f"MSQ '{question.question_id}' explanation is missing or too brief.")

    return len(errors) == 0, errors


def validate_single_task(
    question: GeneratedQuestionSchema,
    claimed_dsa_topics: Optional[List[str]] = None,
    language: str = "python",
) -> Dict[str, Any]:
    """
    Comprehensive Zero-Trust Pipeline for an individual task (MCQ, MSQ, or Coding):
    1. Schema & Content Validation
    2. Branching on Question Type:
       - MCQ: validate_mcq_task
       - MSQ: validate_msq_task
       - Coding: Tests A, B, C, D and DSA Whitelist
    """
    errors: List[str] = []

    # 1. Base content checks
    if not question.title or len(question.title.strip()) < 3:
        errors.append(f"Question '{question.question_id}' title is too short or missing.")
    if not question.description or len(question.description.strip()) < 15:
        errors.append(f"Question '{question.question_id}' description lacks detail.")

    q_type = getattr(question, "question_type", "coding")

    if q_type == "mcq":
        mcq_ok, mcq_errs = validate_mcq_task(question)
        if not mcq_ok:
            errors.extend(mcq_errs)
        final_status = TaskValidationStatus.VALIDATED if len(errors) == 0 else TaskValidationStatus.REJECTED
        return {
            "question_id": question.question_id,
            "title": question.title,
            "question_type": "mcq",
            "status": final_status.value,
            "is_valid": (len(errors) == 0),
            "errors": errors,
        }

    elif q_type == "msq":
        msq_ok, msq_errs = validate_msq_task(question)
        if not msq_ok:
            errors.extend(msq_errs)
        final_status = TaskValidationStatus.VALIDATED if len(errors) == 0 else TaskValidationStatus.REJECTED
        return {
            "question_id": question.question_id,
            "title": question.title,
            "question_type": "msq",
            "status": final_status.value,
            "is_valid": (len(errors) == 0),
            "errors": errors,
        }

    # -------------------------------------------------------------
    # Coding Task Validation Pipeline (Tests A, B, C, D + DSA Whitelist)
    # -------------------------------------------------------------
    task_lang = (question.allowed_languages[0] if question.allowed_languages else language or "python").lower()
    starter_dict = question.starter_code or {}
    task_starter = starter_dict.get(task_lang) or starter_dict.get("python") or (list(starter_dict.values())[0] if starter_dict else "")

    if not task_starter or not task_starter.strip():
        errors.append(f"Question '{question.question_id}': Starter code for language '{task_lang}' is empty or missing.")

    if task_lang == "python":
        if task_starter:
            is_valid, msg = validate_python_syntax(task_starter, "starter_code")
            if not is_valid:
                errors.append(f"Question '{question.question_id}': {msg}")

        if question.reference_solution:
            is_valid, msg = validate_python_syntax(question.reference_solution, "reference_solution")
            if not is_valid:
                errors.append(f"Question '{question.question_id}': {msg}")

        # Test D: Python Security Checks
        if task_starter:
            sec_ok, sec_msg = validate_security_operations(task_starter, "starter_code")
            if not sec_ok:
                errors.append(f"Question '{question.question_id}': {sec_msg}")

        if question.reference_solution:
            sec_ok, sec_msg = validate_security_operations(question.reference_solution, "reference_solution")
            if not sec_ok:
                errors.append(f"Question '{question.question_id}': {sec_msg}")
    else:
        # Non-Python languages (Java, C++, etc.)
        for label, code_str in [("starter_code", task_starter), ("reference_solution", question.reference_solution)]:
            if code_str:
                for pat in FORBIDDEN_CALL_PATTERNS:
                    if re.search(pat, code_str, re.IGNORECASE):
                        errors.append(f"Question '{question.question_id}': Forbidden security operation detected in {label}: matches pattern '{pat}'")
                if code_str.count("{") != code_str.count("}") or code_str.count("(") != code_str.count(")"):
                    errors.append(f"Question '{question.question_id}': Unbalanced braces/parentheses detected in {label}")

    # Strict DSA Whitelist Verification
    if claimed_dsa_topics is not None:
        dsa_ok, dsa_violations = validate_question_dsa_whitelist(
            title=question.title,
            description=question.description,
            topic=question.target_skill or question.topic,
            domain=question.domain,
            claimed_dsa_topics=claimed_dsa_topics,
        )
        if not dsa_ok:
            errors.extend([f"Question '{question.question_id}': {v}" for v in dsa_violations])

    # Test C: Test Suite Quality
    test_ok, test_violations = validate_test_suite_quality(question)
    if not test_ok:
        errors.extend([f"Question '{question.question_id}': {v}" for v in test_violations])

    # Test A: Reference Solution Validation
    ref_ok, ref_violations = validate_reference_solution(question, task_lang)
    if not ref_ok:
        errors.extend([f"Question '{question.question_id}': {v}" for v in ref_violations])

    # Test B: Starter Code Validation
    starter_ok, starter_violations = validate_starter_code_fails_tests(question, task_lang)
    if not starter_ok:
        errors.extend([f"Question '{question.question_id}': {v}" for v in starter_violations])

    final_status = TaskValidationStatus.VALIDATED if len(errors) == 0 else TaskValidationStatus.REJECTED

    return {
        "question_id": question.question_id,
        "title": question.title,
        "question_type": "coding",
        "status": final_status.value,
        "is_valid": (len(errors) == 0),
        "test_a_reference_passed": ref_ok,
        "test_b_starter_fails_passed": starter_ok,
        "test_c_quality_passed": test_ok,
        "test_d_security_passed": (len([e for e in errors if "Forbidden security operation" in e or "Dangerous import" in e]) == 0),
        "dsa_whitelist_passed": (len([e for e in errors if "un-claimed topic" in e]) == 0),
        "errors": errors,
    }


def validate_generated_assessment(
    assessment: GeneratedAssessmentSchema,
    claimed_dsa_topics: Optional[List[str]] = None,
    language: str = "python",
) -> None:
    """
    Performs comprehensive zero-trust validation on an entire generated assessment.
    Rejects the assessment if any task fails validation.
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

        q_lang = (q.allowed_languages[0] if q.allowed_languages else language or "python").lower()

        task_validation = validate_single_task(
            question=q,
            claimed_dsa_topics=claimed_dsa_topics,
            language=q_lang,
        )
        if not task_validation["is_valid"]:
            all_errors.extend(task_validation["errors"])

    if all_errors:
        error_msg = "; ".join(all_errors)
        logger.warning("Assessment validation failed: %s", error_msg)
        raise QuestionValidationError(f"Generated assessment failed validation: {error_msg}")


def sanitize_assessment_for_candidate(
    assessment_dict: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Strictly removes all hidden test cases, reference solutions, MCQ/MSQ correct answer keys,
    and explanations from assessment and individual question dicts before sending to candidate.
    """
    sanitized = dict(assessment_dict)
    if "questions" in sanitized and isinstance(sanitized["questions"], list):
        clean_questions = []
        for q in sanitized["questions"]:
            if isinstance(q, dict):
                clean_q = dict(q)
                clean_q.pop("hidden_test_cases", None)
                clean_q.pop("reference_solution", None)
                clean_q.pop("correct_answer", None)
                clean_q.pop("correct_answers", None)
                clean_q.pop("explanation", None)
                clean_questions.append(clean_q)
            else:
                clean_questions.append(q)
        sanitized["questions"] = clean_questions

    # Strip any stray root secrets
    sanitized.pop("reference_solutions", None)
    sanitized.pop("hidden_tests", None)
    sanitized.pop("answer_keys", None)
    return sanitized
