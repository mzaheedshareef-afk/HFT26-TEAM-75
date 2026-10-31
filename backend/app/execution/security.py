"""
Execution Security Engine
Validates language support, source code constraints, and pre-execution static security.
"""

import ast
import re
from typing import Dict, List, Optional, Set, Tuple

from backend.app.core.security import AuthException

SUPPORTED_LANGUAGES = {
    "python": ["python", "py", "python3"],
    "cpp": ["cpp", "c++", "cxx"],
    "java": ["java"],
}

MAX_CODE_SIZE_BYTES = 64 * 1024  # 64 KB
MAX_TIMEOUT_SECONDS = 10.0
DEFAULT_TIMEOUT_SECONDS = 2.0
DEFAULT_MEMORY_LIMIT_MB = 256
MAX_OUTPUT_LENGTH_BYTES = 1024 * 1024  # 1 MB


class ExecutionSecurityException(AuthException):
    """Base exception for execution security violations."""
    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(code=code, message=message, status_code=status_code)


class UnsupportedLanguageError(ExecutionSecurityException):
    def __init__(self, language: str):
        super().__init__(
            code="UNSUPPORTED_LANGUAGE",
            message=f"Programming language '{language}' is not supported. Supported languages: Python, C++, Java.",
            status_code=400,
        )


class InvalidSourceCodeError(ExecutionSecurityException):
    def __init__(self, message: str):
        super().__init__(
            code="INVALID_SOURCE_CODE",
            message=message,
            status_code=400,
        )


class SecurityViolationError(ExecutionSecurityException):
    def __init__(self, message: str):
        super().__init__(
            code="SECURITY_VIOLATION",
            message=message,
            status_code=400,
        )


class DockerUnavailableError(ExecutionSecurityException):
    def __init__(self, message: str = "Docker execution sandbox is currently unavailable. Ensure the Docker daemon is running."):
        super().__init__(
            code="DOCKER_UNAVAILABLE",
            message=message,
            status_code=503,
        )


class DockerSdkMissingError(ExecutionSecurityException):
    def __init__(self, message: str = "Python Docker SDK is not installed in the backend environment. Run 'pip install docker'."):
        super().__init__(
            code="DOCKER_SDK_MISSING",
            message=message,
            status_code=503,
        )


class ExecutionImageNotFoundError(ExecutionSecurityException):
    def __init__(self, message: str = "Required sandbox Docker image is not available."):
        super().__init__(
            code="IMAGE_NOT_FOUND",
            message=message,
            status_code=503,
        )


class ContainerCreationError(ExecutionSecurityException):
    def __init__(self, message: str = "Failed to create isolated execution container."):
        super().__init__(
            code="CONTAINER_CREATION_FAILED",
            message=message,
            status_code=500,
        )


class ContainerStartupError(ExecutionSecurityException):
    def __init__(self, message: str = "Failed to start isolated execution container."):
        super().__init__(
            code="CONTAINER_STARTUP_FAILED",
            message=message,
            status_code=500,
        )


class ExecutionSecurityValidator:
    """Zero-trust validation gate for submitted code prior to container sandbox execution."""

    @classmethod
    def normalize_language(cls, language: Optional[str]) -> str:
        """Normalizes and verifies language identifier."""
        if not language or not language.strip():
            raise UnsupportedLanguageError("unknown")

        lang_clean = language.strip().lower()
        for canonical, aliases in SUPPORTED_LANGUAGES.items():
            if lang_clean == canonical or lang_clean in aliases:
                return canonical

        raise UnsupportedLanguageError(language)

    @classmethod
    def validate_source_code(cls, source_code: Optional[str], language: str) -> str:
        """
        Validates source code size, non-emptiness, and basic formatting.
        Returns cleaned source code string.
        """
        if source_code is None or not source_code.strip():
            raise InvalidSourceCodeError("Source code cannot be empty.")

        code_bytes = source_code.encode("utf-8")
        if len(code_bytes) > MAX_CODE_SIZE_BYTES:
            raise InvalidSourceCodeError(
                f"Source code size ({len(code_bytes)} bytes) exceeds maximum limit of {MAX_CODE_SIZE_BYTES} bytes."
            )

        # Check for null bytes / binary payloads
        if "\x00" in source_code:
            raise SecurityViolationError("Null bytes detected in source code.")

        return source_code

    @classmethod
    def static_analysis_python(cls, source_code: str) -> Tuple[bool, Optional[str]]:
        """
        Static AST scan for Python code to detect syntax errors or blatant malicious constructs.
        Returns (is_valid, error_message).
        """
        try:
            tree = ast.parse(source_code)
        except SyntaxError as se:
            return False, f"SyntaxError at line {se.lineno}: {se.msg}"
        except Exception as e:
            return False, f"Code parsing error: {e}"

        # Static security heuristics (defense-in-depth before container isolation)
        forbidden_modules = {"pty", "ctypes"}
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    root_mod = alias.name.split(".")[0]
                    if root_mod in forbidden_modules:
                        return False, f"Security Violation: Import of forbidden module '{root_mod}'"
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    root_mod = node.module.split(".")[0]
                    if root_mod in forbidden_modules:
                        return False, f"Security Violation: Import of forbidden module '{root_mod}'"

        return True, None

    @classmethod
    def static_analysis_cpp(cls, source_code: str) -> Tuple[bool, Optional[str]]:
        """Static scan for C++ code."""
        if "__asm__" in source_code or "asm volatile" in source_code:
            return False, "Security Violation: Inline assembly is prohibited."
        return True, None

    @classmethod
    def static_analysis_java(cls, source_code: str) -> Tuple[bool, Optional[str]]:
        """Static scan for Java code."""
        return True, None

    @classmethod
    def run_pre_execution_checks(cls, source_code: str, language: str) -> str:
        """
        Executes complete pre-execution validation gate.
        Returns canonical language.
        """
        canonical_lang = cls.normalize_language(language)
        cleaned_code = cls.validate_source_code(source_code, canonical_lang)

        if canonical_lang == "python":
            valid, err = cls.static_analysis_python(cleaned_code)
            if not valid:
                raise SecurityViolationError(err or "Static validation failed.")
        elif canonical_lang == "cpp":
            valid, err = cls.static_analysis_cpp(cleaned_code)
            if not valid:
                raise SecurityViolationError(err or "Static validation failed.")
        elif canonical_lang == "java":
            valid, err = cls.static_analysis_java(cleaned_code)
            if not valid:
                raise SecurityViolationError(err or "Static validation failed.")

        return canonical_lang
