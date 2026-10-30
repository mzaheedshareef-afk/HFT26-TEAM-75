"""
Guarded AI Assistant & Progressive Hint Engine
Orchestrates progressive, non-spoiling AI hints via Featherless AI with server-side solution leak protection.
"""

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from backend.app.ai_engine.featherless_client import (
    FeatherlessError,
    featherless_client,
)
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

CODE_DECLARATION_PATTERN = re.compile(
    r"\b(def\s+\w+\s*\(|class\s+\w+[:\s{]|function\s+\w+\s*\(|public\s+static\s+void\s+main|int\s+main\s*\(|#include\s*<)",
    re.IGNORECASE,
)

HINT_LEVEL_LABELS = {
    1: {
        "title": "Level 1 · Conceptual Intuition",
        "category": "conceptual",
        "focus": "High-level problem framing, mental models, and key mathematical/logical invariants without implementation details.",
    },
    2: {
        "title": "Level 2 · Data Structure & Strategy",
        "category": "strategy",
        "focus": "Recommended data structures, algorithmic paradigms (two-pointer, sliding window, memoization), and step-by-step decomposition.",
    },
    3: {
        "title": "Level 3 · Edge Cases & Optimization",
        "category": "optimization",
        "focus": "Boundary conditions, empty/overflow inputs, Big-O time and space complexity trade-offs.",
    },
}


class GuardedAIAssistant:
    """
    Guarded progressive AI tutor engine.
    Ensures that hints guide candidates without spoiling answers or leaking code solutions.
    """

    @classmethod
    def sanitize_hint_content(cls, raw_text: str) -> Tuple[str, bool]:
        """
        Server-side leak-prevention guardrail.
        Redacts complete function implementations or code dumps.
        Returns (sanitized_text, was_redacted).
        """
        redacted = False
        text = raw_text.strip()

        # 1. Redact multi-line or implementation code blocks
        def code_block_replacer(match: re.Match) -> str:
            nonlocal redacted
            code_body = match.group(1).strip()
            lines = [l.strip() for l in code_body.split("\n") if l.strip()]
            if len(lines) >= 3 or CODE_DECLARATION_PATTERN.search(code_body):
                redacted = True
                return "[Full code block redacted by Guarded AI Tutor — hints provide conceptual guidance only.]"
            return match.group(0)

        cleaned = re.sub(r"```[\w+-]*\n([\s\S]*?)```", code_block_replacer, text)

        # 2. Check for raw un-fenced code dumps
        lines = cleaned.split("\n")
        code_lines = [
            l for l in lines
            if CODE_DECLARATION_PATTERN.search(l) or re.match(r"^\s{2,}(return\s+|for\s+.+:|while\s+.+:|if\s+.+:)", l)
        ]
        if not redacted and len(code_lines) >= 4:
            redacted = True
            prose_lines = [
                l for l in lines
                if not CODE_DECLARATION_PATTERN.search(l) and not re.match(r"^\s{4,}\S", l)
            ]
            prose = "\n".join(prose_lines).strip()
            if prose:
                cleaned = f"{prose}\n\n[Implementation lines redacted by Guarded AI Tutor — write the solution code yourself.]"
            else:
                cleaned = "[Full solution implementation redacted by Guarded AI Tutor — hints provide conceptual guidance only.]"

        return cleaned.strip(), redacted

    @classmethod
    def generate_fallback_hint(
        cls,
        question_title: str,
        topic: str,
        difficulty: str,
        hint_level: int,
        language: str = "python",
    ) -> str:
        """
        Deterministic, curriculum-aligned progressive fallback hint.
        Invoked when upstream Featherless API is unreachable, times out, or returns invalid responses.
        """
        topic_clean = topic.strip().title() if topic else "Algorithm Design"
        title_clean = question_title.strip() if question_title else "the problem"

        if hint_level == 1:
            return (
                f"**Conceptual Direction for {title_clean}:**\n"
                f"Break this problem down into smaller sub-problems. Rather than thinking about complete state transitions all at once, "
                f"consider what invariant must hold true as you process the inputs sequentially. For {topic_clean}, check if the "
                f"input ordering guarantees a monotonic relationship or if previous results can be reused."
            )
        elif hint_level == 2:
            return (
                f"**Algorithmic Strategy ({topic_clean}):**\n"
                f"A brute-force search here will likely exceed time limits on larger inputs. Consider using an auxiliary data structure "
                f"(such as a hash map, deque, or prefix array) to achieve near O(1) lookups. "
                f"Walk through an example with 4-5 elements: at each index `i`, what minimum information from `0..i-1` do you need?"
            )
        else:
            return (
                f"**Edge Cases & Optimization:**\n"
                f"Before finalizing your solution, verify boundary conditions: empty sequences, duplicate values, extreme integer limits, "
                f"and single-element inputs. Aim for an optimal time complexity of O(N) or O(N log N) with O(N) auxiliary space. "
                f"Ensure your variable increments avoid off-by-one errors."
            )

    @classmethod
    def build_system_prompt(cls, hint_level: int) -> str:
        level_info = HINT_LEVEL_LABELS.get(hint_level, HINT_LEVEL_LABELS[1])
        return (
            "You are the Guarded AI Tutor for an advanced technical assessment platform.\n"
            f"Your objective: Deliver a {level_info['title']}.\n"
            f"Focus: {level_info['focus']}\n\n"
            "STRICT PEDAGOGICAL SAFETY RULES:\n"
            "1. NEVER output a full code solution, function body, or runnable script.\n"
            "2. NEVER reveal hidden test cases, expected outputs, or internal test assertions.\n"
            "3. If providing short syntax snippets, keep them to at most 1-2 generic conceptual lines (e.g. `hash_map[key] = val`).\n"
            "4. Encourage active problem-solving and algorithmic reasoning.\n"
            "5. Keep the hint concise (2-4 paragraphs maximum).\n"
        )

    @classmethod
    def build_user_prompt(
        cls,
        question_title: str,
        question_description: str,
        topic: str,
        difficulty: str,
        hint_level: int,
        language: str,
        current_code: Optional[str] = None,
        previous_hints: Optional[List[str]] = None,
    ) -> str:
        level_info = HINT_LEVEL_LABELS.get(hint_level, HINT_LEVEL_LABELS[1])
        prompt = (
            f"Question Title: {question_title}\n"
            f"Topic / Domain: {topic}\n"
            f"Difficulty: {difficulty}\n"
            f"Candidate Language: {language}\n\n"
            f"Question Description:\n{question_description}\n\n"
            f"Requested Hint Level: Level {hint_level} ({level_info['title']})\n"
        )

        if previous_hints:
            prompt += "\nPreviously Given Hints to this Candidate:\n"
            for idx, h in enumerate(previous_hints, 1):
                prompt += f"- Hint {idx}: {h[:150]}...\n"

        if current_code and current_code.strip():
            # Provide snippet of student code to diagnose misconceptions without writing fixes
            prompt += (
                f"\nCandidate's Current Draft (Diagnose conceptual gaps, DO NOT write their code):\n"
                f"```\n{current_code[:800]}\n```\n"
            )

        prompt += (
            f"\nPlease provide a progressive Level {hint_level} hint adhering strictly to all safety rules."
        )
        return prompt

    @classmethod
    def request_hint(
        cls,
        question_title: str,
        question_description: str,
        topic: str,
        difficulty: str,
        hint_level: int,
        language: str = "python",
        current_code: Optional[str] = None,
        previous_hints: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Generates progressive hint via Featherless AI with fallback protection and sanitization.
        """
        hint_level = max(1, min(3, hint_level))
        level_info = HINT_LEVEL_LABELS.get(hint_level, HINT_LEVEL_LABELS[1])

        # If Featherless key is missing or dummy test key, use immediate high-quality fallback
        api_key = settings.FEATHERLESS_API_KEY
        is_placeholder = not api_key or any(
            token in api_key.lower()
            for token in ("dummy", "test", "your-", "placeholder", "mock")
        )

        raw_hint_text: Optional[str] = None

        if not is_placeholder:
            system_prompt = cls.build_system_prompt(hint_level)
            user_prompt = cls.build_user_prompt(
                question_title=question_title,
                question_description=question_description,
                topic=topic,
                difficulty=difficulty,
                hint_level=hint_level,
                language=language,
                current_code=current_code,
                previous_hints=previous_hints,
            )

            try:
                resp = featherless_client.chat_completion(
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.3,
                    max_tokens=600,
                )
                choices = resp.get("choices", [])
                if choices and len(choices) > 0:
                    raw_hint_text = choices[0].get("message", {}).get("content", "")
            except FeatherlessError as fe:
                logger.warning("Featherless AI hint request failed: %s; using guarded fallback.", fe)
            except Exception as e:
                logger.error("Unexpected error contacting Featherless AI: %s; using guarded fallback.", e)

        if not raw_hint_text or not raw_hint_text.strip():
            raw_hint_text = cls.generate_fallback_hint(
                question_title=question_title,
                topic=topic,
                difficulty=difficulty,
                hint_level=hint_level,
                language=language,
            )

        sanitized_text, was_redacted = cls.sanitize_hint_content(raw_hint_text)

        return {
            "content": sanitized_text,
            "hint_text": sanitized_text,
            "category_label": level_info["title"],
            "category": level_info["category"],
            "hint_level": hint_level,
            "level": hint_level,
            "sanitized_redacted": was_redacted,
        }

