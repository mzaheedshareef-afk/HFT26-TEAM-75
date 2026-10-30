"""
Sandbox Execution & Grading Contract Tests (Phase 5 Preparation)
Role: Testing & Integration Developer (Vasil)
Project: Portfolio-Driven Adaptive Coding & Technical Assessment Platform
Team: HFT26-TEAM-75

This test suite verifies:
1. Question Schema Validation (sample_question.json)
2. Algorithmic Correctness of Reference Solution across all Public & Hidden test cases
3. Deterministic Grading Engine calculation (pass rate, scoring weights, stdout trimming)
4. AI Efficiency Scoring heuristic contract (AST complexity analysis)
5. Security Policy Enforcement Specification (detecting forbidden syscalls/modules)
"""

import ast
import json
import os
import subprocess
import sys
import pytest

QUESTION_FILE = os.path.join(os.path.dirname(__file__), "sample_question.json")

@pytest.fixture(scope="module")
def question_data():
    with open(QUESTION_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

class TestQuestionAndSandboxContract:
    """Verifies Phase 5 Execution Engine Contracts."""

    def test_question_schema_integrity(self, question_data):
        """Verify that question JSON conforms to required schema fields."""
        required_keys = [
            "question_id", "title", "description", "constraints",
            "public_test_cases", "hidden_test_cases", "reference_solution"
        ]
        for key in required_keys:
            assert key in question_data, f"Missing required question key: {key}"

        assert len(question_data["public_test_cases"]) >= 2, "Must contain at least 2 public cases"
        assert len(question_data["hidden_test_cases"]) >= 3, "Must contain at least 3 hidden cases"

    def test_reference_solution_passes_all_cases(self, question_data):
        """
        Verify that reference solution produces exact expected outputs
        for all public and hidden test cases.
        """
        code = question_data["reference_solution"]["code"]
        all_cases = question_data["public_test_cases"] + question_data["hidden_test_cases"]

        for case in all_cases:
            proc = subprocess.run(
                [sys.executable, "-c", code],
                input=case["input"],
                text=True,
                capture_output=True,
                timeout=3.0
            )
            assert proc.returncode == 0, f"Reference solution crashed on test case {case['test_case_id']}: {proc.stderr}"
            actual_output = proc.stdout.strip()
            expected_output = case["expected_output"].strip()
            assert actual_output == expected_output, (
                f"Mismatch on {case['test_case_id']}! Expected '{expected_output}', got '{actual_output}'"
            )

    def test_deterministic_grading_calculator(self, question_data):
        """
        Verify the grading engine scoring algorithm:
        Score = (Sum of weights of passed hidden tests / Total weight) * 100
        """
        hidden_cases = question_data["hidden_test_cases"]
        total_weight = sum(c.get("weight", 20) for c in hidden_cases)
        assert total_weight == 100, f"Hidden test cases weights must sum to 100, got {total_weight}"

        # Simulate 4 out of 5 tests passing
        passed_cases = hidden_cases[:4]
        earned_score = sum(c.get("weight", 20) for c in passed_cases)
        deterministic_score = (earned_score / total_weight) * 100
        assert deterministic_score == 80.0

    def test_ast_efficiency_scoring_detection(self, question_data):
        """
        Verify that AST parser detects nested loops in suboptimal solutions
        versus single loops in reference solutions for AI Efficiency scoring.
        """
        ref_code = question_data["reference_solution"]["code"]
        subopt_code = question_data["suboptimal_solution"]["code"]

        def count_loop_nesting(source_code: str) -> int:
            tree = ast.parse(source_code)
            max_depth = 0

            def walk_nodes(node, current_depth):
                nonlocal max_depth
                is_loop = isinstance(node, (ast.For, ast.While))
                new_depth = current_depth + 1 if is_loop else current_depth
                max_depth = max(max_depth, new_depth)
                for child in ast.iter_child_nodes(node):
                    walk_nodes(child, new_depth)

            walk_nodes(tree, 0)
            return max_depth

        ref_depth = count_loop_nesting(ref_code)
        subopt_depth = count_loop_nesting(subopt_code)

        assert ref_depth == 1, f"Reference solution should have loop depth 1, got {ref_depth}"
        assert subopt_depth == 2, f"Suboptimal solution should have nested loop depth 2, got {subopt_depth}"

    def test_malicious_code_detection_contract(self, question_data):
        """
        Verify that the pre-execution static analysis catches obvious dangerous calls
        before dispatching to the Docker sandbox.
        """
        forbidden_modules = {"os", "sys", "subprocess", "socket", "urllib", "requests", "shutil"}

        for sample in question_data.get("malicious_test_samples", []):
            tree = ast.parse(sample["code"])
            imported_modules = set()
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        imported_modules.add(alias.name.split('.')[0])
                elif isinstance(node, ast.ImportFrom):
                    if node.module:
                        imported_modules.add(node.module.split('.')[0])

            # In sandbox policy, dangerous imports are flagged or isolated
            if sample["name"] in ["fork_bomb_attempt", "file_system_escape_attempt", "network_exfiltration_attempt"]:
                flagged = bool(imported_modules.intersection(forbidden_modules))
                assert flagged or "open" in sample["code"], f"Failed to flag malicious sample {sample['name']}"
