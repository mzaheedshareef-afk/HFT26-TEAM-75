import logging
import re
from typing import Any, Dict, List, Optional
import uuid

from backend.app.ai_engine.featherless_client import FeatherlessError, featherless_client

logger = logging.getLogger(__name__)

HINT_TIER_LABELS = {
    1: "Level 1 · Conceptual Intuition",
    2: "Level 2 · Data Structure & Strategy",
    3: "Level 3 · Edge Cases & Complexity",
}

FALLBACK_HINTS = {
    1: (
        "Focus on problem invariants and the core relationship between inputs. "
        "Consider whether a two-pointer technique, a frequency hash map, or a sliding window "
        "can reduce repeated computations from O(N^2) down to O(N)."
    ),
    2: (
        "Decompose the state: Track accumulated values or frequencies using an auxiliary dictionary/hash map. "
        "Maintain left and right boundary indices for contiguous ranges, advancing the right pointer to expand "
        "and advancing the left pointer whenever constraints are violated."
    ),
    3: (
        "Guard against boundary conditions: Check for empty input, single-element arrays, duplicate values, "
        "and maximum timestamp gaps. Ensure auxiliary space remains O(1) or O(K) without memory leaks."
    ),
}

CODE_DECLARATION_PATTERN = re.compile(
    r"\b(def\s+\w+\s*\(|class\s+\w+[:\s{]|function\s+\w+\s*\(|public\s+static\s+void\s+main|int\s+main\s*\(|#include\s*<)",
    re.IGNORECASE,
)


def sanitize_guarded_hint_text(raw_text: str) -> str:
    """
    Server-side leak-prevention guardrail.
    Ensures that complete code implementations or solution functions are never leaked.
    """
    clean = raw_text.strip()
    # Redact fenced code blocks with implementations
    def redact_block(match):
        code = match.group(1).strip()
        lines = [l for l in code.split("\n") if l.strip()]
        if len(lines) >= 3 or CODE_DECLARATION_PATTERN.search(code):
            return "[Code implementation redacted by Guarded AI Tutor — write the code yourself.]"
        return match.group(0)

    clean = re.sub(r"```[\w+-]*\n([\s\S]*?)```", redact_block, clean)
    return clean


class GuardedAssistantService:
    """
    Guarded AI Tutor providing progressive hints without leaking direct code solutions.
    """

    @classmethod
    def generate_hint(
        cls,
        question_id: str,
        question_title: Optional[str] = None,
        hint_level: int = 1,
        language: str = "python",
        current_code: Optional[str] = None,
        previous_hints: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Generates progressive, non-spoiling conceptual hint using Featherless AI
        with automatic fallback to curated domain guidance.
        """
        level = max(1, min(3, hint_level))
        tier_label = HINT_TIER_LABELS.get(level, f"Level {level} · Guidance")

        q_title = question_title or "the current technical question"
        prev_context = "\n".join([f"- {h}" for h in (previous_hints or [])])

        system_prompt = (
            "You are a Guarded Technical Assessment Tutor for a live coding interview. "
            "Your objective is to guide the candidate to solve the problem themselves without writing the solution for them.\n"
            f"You are providing {tier_label}.\n"
            "- Level 1: High-level problem intuition, pattern recognition, and conceptual framing. No code.\n"
            "- Level 2: Recommended data structures, algorithm strategy, and step-by-step logic. No complete functions.\n"
            "- Level 3: Edge cases, boundary invariants, and time/space complexity optimization advice.\n"
            "STRICT SECURITY DIRECTIVE: You must NEVER write full solution code, complete functions, or complete implementations. "
            "Keep hints concise, motivating, and purely pedagogical in plain English prose."
        )

        user_prompt = (
            f"Question: {q_title}\n"
            f"Programming Language: {language}\n"
            f"Requested Hint Level: {level} ({tier_label})\n"
        )
        if current_code and current_code.strip():
            user_prompt += f"Candidate's Current Attempt (inspect for direction only, do not fix directly):\n```\n{current_code[:600]}\n```\n"
        if prev_context:
            user_prompt += f"Previous hints already given to candidate:\n{prev_context}\n"

        user_prompt += "Provide a single concise hint paragraph strictly tailored to this level."

        content: Optional[str] = None

        try:
            logger.info("Requesting guarded hint level %d for question '%s'...", level, q_title)
            response = featherless_client.chat_completion(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,
                max_tokens=400,
            )
            choices = response.get("choices", [])
            if choices and isinstance(choices, list) and len(choices) > 0:
                raw_content = choices[0].get("message", {}).get("content", "").strip()
                if raw_content:
                    content = sanitize_guarded_hint_text(raw_content)
        except (FeatherlessError, Exception) as exc:
            logger.warning("Guarded assistant AI call failed (%s: %s). Activating pedagogical fallback.", type(exc).__name__, exc)

        if not content:
            # Fallback to high-quality curated hint
            base_fallback = FALLBACK_HINTS.get(level, FALLBACK_HINTS[1])
            content = f"Regarding {q_title}: {base_fallback}"

        hint_id = f"hint-{question_id}-lvl{level}-{uuid.uuid4().hex[:8]}"

        return {
            "hint_id": hint_id,
            "id": hint_id,
            "question_id": question_id,
            "level": level,
            "hint_level": level,
            "category_label": tier_label,
            "content": content,
            "hint_text": content,
            "message": content,
        }
