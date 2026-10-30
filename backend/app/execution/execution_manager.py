"""
Execution Manager
Orchestrates test case evaluation against Docker sandboxes.
Captures timing, memory, compiler output, and output comparisons.
"""

from dataclasses import asdict, dataclass
import logging
from typing import Any, Dict, List, Optional

from backend.app.execution.docker_runner import DockerRunner, RawExecutionResult
from backend.app.execution.security import (
    DEFAULT_MEMORY_LIMIT_MB,
    DEFAULT_TIMEOUT_SECONDS,
    ExecutionSecurityValidator,
)
from backend.app.execution.comparator import compare_outputs

logger = logging.getLogger(__name__)


@dataclass
class TestCaseResult:
    test_case_id: str
    status: str  # ACCEPTED, WRONG_ANSWER, TIME_LIMIT_EXCEEDED, MEMORY_LIMIT_EXCEEDED, COMPILATION_ERROR, RUNTIME_ERROR
    passed: bool
    input: str
    expected_output: str
    actual_output: str
    error_message: Optional[str] = None
    execution_time_ms: float = 0.0
    memory_used_mb: float = 0.0
    weight: float = 1.0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def to_candidate_dict(self, is_hidden: bool = False) -> Dict[str, Any]:
        """
        Formats test case result for candidate frontend.
        Hidden test cases NEVER expose input, expected_output, or actual_output.
        """
        if is_hidden:
            return {
                "test_case_id": self.test_case_id,
                "status": self.status,
                "passed": self.passed,
                "execution_time_ms": round(self.execution_time_ms, 2),
                "is_hidden": True,
            }
        return {
            "test_case_id": self.test_case_id,
            "status": self.status,
            "passed": self.passed,
            "input": self.input,
            "expected_output": self.expected_output,
            "actual_output": self.actual_output,
            "error_message": self.error_message,
            "execution_time_ms": round(self.execution_time_ms, 2),
            "is_hidden": False,
        }


class ExecutionManager:
    """Manages batch test runs and compilation/runtime error handling."""

    @classmethod
    def execute_test_suite(
        cls,
        source_code: str,
        language: str,
        test_cases: List[Dict[str, Any]],
        time_limit_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        memory_limit_mb: int = DEFAULT_MEMORY_LIMIT_MB,
    ) -> List[TestCaseResult]:
        """
        Executes source code sequentially against each test case.
        Fast-fails on compilation error.
        """
        results: List[TestCaseResult] = []

        if not test_cases:
            return results

        # Static security check
        canonical_lang = ExecutionSecurityValidator.run_pre_execution_checks(source_code, language)

        for tc in test_cases:
            tc_id = str(tc.get("test_case_id", f"tc_{len(results) + 1}"))
            tc_input = str(tc.get("input", ""))
            tc_expected = str(tc.get("expected_output", ""))
            tc_weight = float(tc.get("weight", 1.0))

            raw_res: RawExecutionResult = DockerRunner.run_code(
                source_code=source_code,
                language=canonical_lang,
                stdin_data=tc_input,
                time_limit_seconds=time_limit_seconds,
                memory_limit_mb=memory_limit_mb,
            )

            # Check compilation error
            if raw_res.status == "COMPILATION_ERROR":
                err_msg = raw_res.error_message or raw_res.stderr or "Compilation failed."
                results.append(TestCaseResult(
                    test_case_id=tc_id,
                    status="COMPILATION_ERROR",
                    passed=False,
                    input=tc_input,
                    expected_output=tc_expected,
                    actual_output="",
                    error_message=err_msg,
                    execution_time_ms=raw_res.execution_time_ms,
                    weight=tc_weight,
                ))
                # If compilation failed once, mark remaining tests as compilation error as well
                for remaining_tc in test_cases[len(results):]:
                    results.append(TestCaseResult(
                        test_case_id=str(remaining_tc.get("test_case_id", f"tc_{len(results) + 1}")),
                        status="COMPILATION_ERROR",
                        passed=False,
                        input=str(remaining_tc.get("input", "")),
                        expected_output=str(remaining_tc.get("expected_output", "")),
                        actual_output="",
                        error_message="Skipped due to compilation error.",
                        execution_time_ms=0.0,
                        weight=float(remaining_tc.get("weight", 1.0)),
                    ))
                break

            # Handle execution outcomes
            if raw_res.status == "TIME_LIMIT_EXCEEDED":
                results.append(TestCaseResult(
                    test_case_id=tc_id,
                    status="TIME_LIMIT_EXCEEDED",
                    passed=False,
                    input=tc_input,
                    expected_output=tc_expected,
                    actual_output="",
                    error_message=f"Time limit of {time_limit_seconds}s exceeded.",
                    execution_time_ms=raw_res.execution_time_ms,
                    weight=tc_weight,
                ))
            elif raw_res.status == "MEMORY_LIMIT_EXCEEDED":
                results.append(TestCaseResult(
                    test_case_id=tc_id,
                    status="MEMORY_LIMIT_EXCEEDED",
                    passed=False,
                    input=tc_input,
                    expected_output=tc_expected,
                    actual_output="",
                    error_message=f"Memory limit of {memory_limit_mb}MB exceeded.",
                    execution_time_ms=raw_res.execution_time_ms,
                    weight=tc_weight,
                ))
            elif raw_res.status == "RUNTIME_ERROR":
                results.append(TestCaseResult(
                    test_case_id=tc_id,
                    status="RUNTIME_ERROR",
                    passed=False,
                    input=tc_input,
                    expected_output=tc_expected,
                    actual_output=raw_res.stdout,
                    error_message=raw_res.error_message or raw_res.stderr,
                    execution_time_ms=raw_res.execution_time_ms,
                    weight=tc_weight,
                ))
            elif raw_res.status == "OUTPUT_LIMIT_EXCEEDED":
                results.append(TestCaseResult(
                    test_case_id=tc_id,
                    status="OUTPUT_LIMIT_EXCEEDED",
                    passed=False,
                    input=tc_input,
                    expected_output=tc_expected,
                    actual_output=raw_res.stdout,
                    error_message="Output limit exceeded (1MB).",
                    execution_time_ms=raw_res.execution_time_ms,
                    weight=tc_weight,
                ))
            else:
                # Compare stdout with expected output
                matches = compare_outputs(raw_res.stdout, tc_expected)
                status = "ACCEPTED" if matches else "WRONG_ANSWER"
                results.append(TestCaseResult(
                    test_case_id=tc_id,
                    status=status,
                    passed=matches,
                    input=tc_input,
                    expected_output=tc_expected,
                    actual_output=raw_res.stdout.strip(),
                    execution_time_ms=raw_res.execution_time_ms,
                    weight=tc_weight,
                ))

        return results
