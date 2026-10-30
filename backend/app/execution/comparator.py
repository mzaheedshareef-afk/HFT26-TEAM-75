"""
Output Comparator & Normalizer
Normalizes whitespace and line endings, and deterministically compares candidate output with expected output.
"""

import math
from typing import Optional


def normalize_output(text: Optional[str]) -> str:
    """Normalizes whitespace and line endings for cross-platform deterministic comparison."""
    if text is None:
        return ""
    # Standardize line endings to \n
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    # Strip trailing whitespace on each line
    lines = [line.rstrip() for line in normalized.split("\n")]
    # Strip empty trailing lines
    while lines and not lines[-1]:
        lines.pop()
    # Strip empty leading lines
    while lines and not lines[0]:
        lines.pop(0)
    return "\n".join(lines)


def compare_single_token(tok_a: str, tok_b: str) -> bool:
    """Compares two string tokens, with floating-point tolerance if both are numeric."""
    if tok_a == tok_b:
        return True
    try:
        f_a = float(tok_a)
        f_b = float(tok_b)
        # 10^-6 tolerance
        return math.isclose(f_a, f_b, rel_tol=1e-6, abs_tol=1e-6)
    except ValueError:
        return False


def compare_outputs(actual: Optional[str], expected: Optional[str]) -> bool:
    """
    Deterministically compares candidate output against expected output.
    Rules:
    1. Exact string match after trimming trailing whitespace & newlines.
    2. Token-by-token comparison with floating-point tolerance (10^-6).
    """
    clean_actual = normalize_output(actual)
    clean_expected = normalize_output(expected)

    if clean_actual == clean_expected:
        return True

    # Token-by-token comparison
    actual_tokens = clean_actual.split()
    expected_tokens = clean_expected.split()

    if len(actual_tokens) != len(expected_tokens):
        return False

    return all(
        compare_single_token(a, e)
        for a, e in zip(actual_tokens, expected_tokens)
    )
