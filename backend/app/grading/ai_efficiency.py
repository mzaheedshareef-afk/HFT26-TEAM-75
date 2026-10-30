"""
AI & Algorithmic Efficiency Scoring Engine
Evaluates time/space complexity via static AST parsing and optional guarded LLM feedback.
This does NOT affect deterministic correctness grading.
"""

import ast
import logging
from typing import Any, Dict, Optional

from backend.app.ai_engine.featherless_client import featherless_client
from backend.app.core.config import settings

logger = logging.getLogger(__name__)


class AIEfficiencyEvaluator:
    """Calculates algorithmic efficiency and complexity estimates."""

    @classmethod
    def analyze_python_ast_complexity(cls, source_code: str) -> Dict[str, Any]:
        """
        Analyzes Python Abstract Syntax Tree to estimate loop nesting and complexity.
        """
        try:
            tree = ast.parse(source_code)
        except Exception:
            return {
                "detected_time_complexity": "Unknown",
                "detected_space_complexity": "Unknown",
                "max_loop_depth": 0,
                "notes": "Syntax parsing failed for AST analysis.",
            }

        max_loop_depth = 0

        def traverse(node: ast.AST, depth: int) -> None:
            nonlocal max_loop_depth
            is_loop = isinstance(node, (ast.For, ast.While))
            current_depth = depth + 1 if is_loop else depth
            max_loop_depth = max(max_loop_depth, current_depth)
            for child in ast.iter_child_nodes(node):
                traverse(child, current_depth)

        traverse(tree, 0)

        # Estimate Big-O time complexity based on loop nesting
        if max_loop_depth == 0:
            time_comp = "O(1)"
        elif max_loop_depth == 1:
            time_comp = "O(N)"
        elif max_loop_depth == 2:
            time_comp = "O(N^2)"
        else:
            time_comp = f"O(N^{max_loop_depth})"

        # Check for dict or set instantiation / comprehension for space complexity
        has_hashmap = False
        for node in ast.walk(tree):
            if isinstance(node, (ast.Dict, ast.Set, ast.DictComp, ast.SetComp, ast.List, ast.ListComp)):
                has_hashmap = True
                break

        space_comp = "O(N)" if has_hashmap else "O(1)"

        return {
            "detected_time_complexity": time_comp,
            "detected_space_complexity": space_comp,
            "max_loop_depth": max_loop_depth,
            "notes": f"Estimated complexity based on loop depth of {max_loop_depth}.",
        }

    @classmethod
    def evaluate_efficiency(
        cls,
        source_code: str,
        language: str,
        problem_title: str = "Coding Task",
    ) -> Dict[str, Any]:
        """
        Computes code efficiency and cleanliness feedback.
        Guarantees fast fallback if LLM is unavailable or offline.
        """
        ast_result = {}
        if language == "python":
            ast_result = cls.analyze_python_ast_complexity(source_code)
        else:
            ast_result = {
                "detected_time_complexity": "O(N)",
                "detected_space_complexity": "O(N)",
                "max_loop_depth": 1,
                "notes": f"Standard complexity heuristic for {language}.",
            }

        detected_time = ast_result.get("detected_time_complexity", "O(N)")
        detected_space = ast_result.get("detected_space_complexity", "O(N)")

        # Attempt optional Featherless LLM call for qualitative feedback if API key is configured
        qualitative_feedback = f"Algorithmic complexity evaluated as {detected_time} time and {detected_space} space."
        api_key = settings.FEATHERLESS_API_KEY
        if api_key and api_key not in ("placeholder-featherless-key", "placeholder", "test-key"):
            try:
                prompt = (
                    f"Evaluate the following {language} code for problem '{problem_title}'.\n"
                    f"Provide concise feedback (1-2 sentences) on its time and space efficiency.\n\n"
                    f"Code:\n{source_code[:1000]}"
                )
                response = featherless_client.chat_completion(
                    messages=[
                        {"role": "system", "content": "You are a concise algorithm evaluator."},
                        {"role": "user", "content": prompt},
                    ],
                    max_tokens=150,
                    temperature=0.2,
                )
                llm_text = response.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                if llm_text:
                    qualitative_feedback = llm_text
            except Exception:
                # LLM offline / mocked; keep deterministic heuristic
                pass

        return {
            "detected_time_complexity": detected_time,
            "detected_space_complexity": detected_space,
            "max_loop_depth": ast_result.get("max_loop_depth", 1),
            "feedback": qualitative_feedback,
        }
