"""
Docker Sandbox Runner
Spawns secure, isolated, ephemeral Docker containers to execute untrusted code.
Enforces non-root user, network disabled, CPU/memory limits, read-only FS, and strict cleanup.
"""

from dataclasses import dataclass
import logging
import os
import re
import shutil
import subprocess
import tempfile
import time
from typing import Any, Callable, Dict, List, Optional
import uuid

from backend.app.execution.security import (
    DEFAULT_MEMORY_LIMIT_MB,
    DEFAULT_TIMEOUT_SECONDS,
    MAX_OUTPUT_LENGTH_BYTES,
    DockerUnavailableError,
)

logger = logging.getLogger(__name__)

# Configurable Docker images per language
DOCKER_IMAGES = {
    "python": os.getenv("DOCKER_IMAGE_PYTHON", "python:3.12-slim"),
    "cpp": os.getenv("DOCKER_IMAGE_CPP", "gcc:13-bookworm"),
    "java": os.getenv("DOCKER_IMAGE_JAVA", "openjdk:17-slim"),
}

# Source code filenames per language
SOURCE_FILENAMES = {
    "python": "solution.py",
    "cpp": "solution.cpp",
    "java": "Solution.java",
}

def detect_java_class_name(source_code: str) -> str:
    """Extracts public class name or class name with main method from Java code."""
    m = re.search(r'public\s+class\s+([A-Za-z0-9_]+)', source_code)
    if m:
        return m.group(1)
    m = re.search(r'class\s+([A-Za-z0-9_]+)', source_code)
    if m:
        return m.group(1)
    return "Solution"


# Override flag for testing Docker unavailability
_docker_available_override: Optional[bool] = None
# Mock runner callable for isolated unit testing
_custom_runner_hook: Optional[Callable[..., "RawExecutionResult"]] = None


@dataclass
class RawExecutionResult:
    status: str  # SUCCESS, COMPILATION_ERROR, RUNTIME_ERROR, TIME_LIMIT_EXCEEDED, MEMORY_LIMIT_EXCEEDED, OUTPUT_LIMIT_EXCEEDED, DOCKER_UNAVAILABLE
    stdout: str
    stderr: str
    exit_code: int
    execution_time_ms: float
    memory_used_mb: float
    error_message: Optional[str] = None


def set_docker_available_override(override: Optional[bool]) -> None:
    """Allows tests to simulate Docker daemon down / CLI not installed."""
    global _docker_available_override
    _docker_available_override = override


def set_custom_runner_hook(hook: Optional[Callable[..., "RawExecutionResult"]]) -> None:
    """Allows testing harnesses to inject mock runners for isolated verification."""
    global _custom_runner_hook
    _custom_runner_hook = hook


class DockerRunner:
    """Executes untrusted code within locked-down ephemeral Docker containers."""

    @classmethod
    def is_docker_available(cls) -> bool:
        """Checks if Docker CLI and daemon are reachable."""
        global _docker_available_override
        if _docker_available_override is not None:
            return _docker_available_override

        docker_path = shutil.which("docker")
        if not docker_path:
            return False

        try:
            res = subprocess.run(
                ["docker", "info"],
                capture_output=True,
                timeout=3.0,
                text=True,
            )
            return res.returncode == 0
        except Exception:
            return False

    @classmethod
    def run_code(
        cls,
        source_code: str,
        language: str,
        stdin_data: str = "",
        time_limit_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        memory_limit_mb: int = DEFAULT_MEMORY_LIMIT_MB,
    ) -> RawExecutionResult:
        """
        Executes code inside a strictly isolated Docker container.
        
        Security guarantees:
        - --network none
        - --memory / --memory-swap limit
        - --cpus limit (0.5)
        - --pids-limit (64)
        - --read-only filesystem
        - --tmpfs /tmp:rw,size=32m,noexec,nosuid
        - --cap-drop ALL
        - --security-opt no-new-privileges
        - --user 1001:1001 (non-root)
        - Container destroyed via --rm and finally cleanup
        - Zero access to host secrets or environment variables
        """
        global _custom_runner_hook
        if _custom_runner_hook is not None:
            return _custom_runner_hook(
                source_code=source_code,
                language=language,
                stdin_data=stdin_data,
                time_limit_seconds=time_limit_seconds,
                memory_limit_mb=memory_limit_mb,
            )

        if not cls.is_docker_available():
            raise DockerUnavailableError(
                "Docker execution sandbox is currently unavailable. Ensure the Docker daemon is running."
            )

        container_id = f"hft26_box_{uuid.uuid4().hex[:12]}"
        image = DOCKER_IMAGES.get(language, DOCKER_IMAGES["python"])
        source_name = SOURCE_FILENAMES.get(language, "solution.txt")
        if language == "java":
            java_class = detect_java_class_name(source_code)
            source_name = f"{java_class}.java"

        # Create temporary isolated directory for source file
        with tempfile.TemporaryDirectory(prefix="hft_sandbox_") as temp_dir:
            source_path = os.path.join(temp_dir, source_name)
            with open(source_path, "w", encoding="utf-8") as f:
                f.write(source_code)

            try:
                if language == "python":
                    return cls._execute_python(
                        container_id=container_id,
                        image=image,
                        temp_dir=temp_dir,
                        source_name=source_name,
                        stdin_data=stdin_data,
                        time_limit_seconds=time_limit_seconds,
                        memory_limit_mb=memory_limit_mb,
                    )
                elif language == "cpp":
                    return cls._execute_cpp(
                        container_id=container_id,
                        image=image,
                        temp_dir=temp_dir,
                        source_name=source_name,
                        stdin_data=stdin_data,
                        time_limit_seconds=time_limit_seconds,
                        memory_limit_mb=memory_limit_mb,
                    )
                elif language == "java":
                    return cls._execute_java(
                        container_id=container_id,
                        image=image,
                        temp_dir=temp_dir,
                        source_name=source_name,
                        stdin_data=stdin_data,
                        time_limit_seconds=time_limit_seconds,
                        memory_limit_mb=memory_limit_mb,
                    )
                else:
                    return RawExecutionResult(
                        status="COMPILATION_ERROR",
                        stdout="",
                        stderr=f"Unsupported execution language: {language}",
                        exit_code=1,
                        execution_time_ms=0.0,
                        memory_used_mb=0.0,
                        error_message="Unsupported language",
                    )
            finally:
                # Guaranteed cleanup: Kill and remove container if still present
                cls._force_remove_container(container_id)

    @classmethod
    def _force_remove_container(cls, container_id: str) -> None:
        """Ensures container cleanup even after crashes, failures, or timeouts."""
        try:
            subprocess.run(
                ["docker", "rm", "-f", container_id],
                capture_output=True,
                timeout=5.0,
            )
        except Exception:
            pass

    @classmethod
    def _execute_python(
        cls,
        container_id: str,
        image: str,
        temp_dir: str,
        source_name: str,
        stdin_data: str,
        time_limit_seconds: float,
        memory_limit_mb: int,
    ) -> RawExecutionResult:
        """Executes Python code in isolated container."""
        docker_cmd = [
            "docker", "run",
            "--name", container_id,
            "--rm",
            "--network", "none",
            f"--memory={memory_limit_mb}m",
            f"--memory-swap={memory_limit_mb}m",
            "--cpus=0.5",
            "--pids-limit=64",
            "--read-only",
            "--tmpfs", "/tmp:rw,size=32m,noexec,nosuid",
            "--cap-drop", "ALL",
            "--security-opt", "no-new-privileges:true",
            "--user", "1001:1001",
            "-v", f"{os.path.abspath(temp_dir)}:/sandbox:ro",
            "-w", "/tmp",
            "-i",
            image,
            "python3", f"/sandbox/{source_name}",
        ]

        return cls._run_docker_subprocess(docker_cmd, container_id, stdin_data, time_limit_seconds)

    @classmethod
    def _execute_cpp(
        cls,
        container_id: str,
        image: str,
        temp_dir: str,
        source_name: str,
        stdin_data: str,
        time_limit_seconds: float,
        memory_limit_mb: int,
    ) -> RawExecutionResult:
        """Compiles and executes C++ in isolated container."""
        # Step 1: Compile in temp directory
        compile_id = f"{container_id}_cmp"
        compile_cmd = [
            "docker", "run",
            "--name", compile_id,
            "--rm",
            "--network", "none",
            "--memory=512m",
            "--cpus=1.0",
            "--pids-limit=64",
            "--cap-drop", "ALL",
            "--security-opt", "no-new-privileges:true",
            "-v", f"{os.path.abspath(temp_dir)}:/sandbox:rw",
            "-w", "/sandbox",
            image,
            "g++", "-O3", "-std=c++17", "-Wall", f"/sandbox/{source_name}", "-o", "/sandbox/solution",
        ]

        start_cmp = time.perf_counter()
        try:
            cmp_res = subprocess.run(
                compile_cmd,
                capture_output=True,
                text=True,
                timeout=10.0,
            )
            if cmp_res.returncode != 0:
                return RawExecutionResult(
                    status="COMPILATION_ERROR",
                    stdout=cmp_res.stdout[:MAX_OUTPUT_LENGTH_BYTES],
                    stderr=cmp_res.stderr[:MAX_OUTPUT_LENGTH_BYTES],
                    exit_code=cmp_res.returncode,
                    execution_time_ms=(time.perf_counter() - start_cmp) * 1000.0,
                    memory_used_mb=0.0,
                    error_message=f"Compilation error: {cmp_res.stderr.strip()}",
                )
        except subprocess.TimeoutExpired:
            cls._force_remove_container(compile_id)
            return RawExecutionResult(
                status="COMPILATION_ERROR",
                stdout="",
                stderr="Compilation timed out.",
                exit_code=1,
                execution_time_ms=10000.0,
                memory_used_mb=0.0,
                error_message="Compilation timed out.",
            )
        finally:
            cls._force_remove_container(compile_id)

        # Step 2: Execute compiled binary
        run_cmd = [
            "docker", "run",
            "--name", container_id,
            "--rm",
            "--network", "none",
            f"--memory={memory_limit_mb}m",
            f"--memory-swap={memory_limit_mb}m",
            "--cpus=0.5",
            "--pids-limit=64",
            "--read-only",
            "--tmpfs", "/tmp:rw,size=32m,noexec,nosuid",
            "--cap-drop", "ALL",
            "--security-opt", "no-new-privileges:true",
            "--user", "1001:1001",
            "-v", f"{os.path.abspath(temp_dir)}:/sandbox:ro",
            "-w", "/tmp",
            "-i",
            image,
            "/sandbox/solution",
        ]

        return cls._run_docker_subprocess(run_cmd, container_id, stdin_data, time_limit_seconds)

    @classmethod
    def _execute_java(
        cls,
        container_id: str,
        image: str,
        temp_dir: str,
        source_name: str,
        stdin_data: str,
        time_limit_seconds: float,
        memory_limit_mb: int,
    ) -> RawExecutionResult:
        """Compiles and executes Java in isolated container."""
        # Step 1: Compile Java source
        compile_id = f"{container_id}_cmp"
        compile_cmd = [
            "docker", "run",
            "--name", compile_id,
            "--rm",
            "--network", "none",
            "--memory=512m",
            "--cpus=1.0",
            "--pids-limit=64",
            "--cap-drop", "ALL",
            "--security-opt", "no-new-privileges:true",
            "-v", f"{os.path.abspath(temp_dir)}:/sandbox:rw",
            "-w", "/sandbox",
            image,
            "javac", f"/sandbox/{source_name}",
        ]

        start_cmp = time.perf_counter()
        try:
            cmp_res = subprocess.run(
                compile_cmd,
                capture_output=True,
                text=True,
                timeout=10.0,
            )
            if cmp_res.returncode != 0:
                return RawExecutionResult(
                    status="COMPILATION_ERROR",
                    stdout=cmp_res.stdout[:MAX_OUTPUT_LENGTH_BYTES],
                    stderr=cmp_res.stderr[:MAX_OUTPUT_LENGTH_BYTES],
                    exit_code=cmp_res.returncode,
                    execution_time_ms=(time.perf_counter() - start_cmp) * 1000.0,
                    memory_used_mb=0.0,
                    error_message=f"Compilation error: {cmp_res.stderr.strip()}",
                )
        except subprocess.TimeoutExpired:
            cls._force_remove_container(compile_id)
            return RawExecutionResult(
                status="COMPILATION_ERROR",
                stdout="",
                stderr="Compilation timed out.",
                exit_code=1,
                execution_time_ms=10000.0,
                memory_used_mb=0.0,
                error_message="Compilation timed out.",
            )
        finally:
            cls._force_remove_container(compile_id)

        # Step 2: Run Java class with memory cap
        run_cmd = [
            "docker", "run",
            "--name", container_id,
            "--rm",
            "--network", "none",
            f"--memory={memory_limit_mb}m",
            f"--memory-swap={memory_limit_mb}m",
            "--cpus=0.5",
            "--pids-limit=64",
            "--read-only",
            "--tmpfs", "/tmp:rw,size=32m,noexec,nosuid",
            "--cap-drop", "ALL",
            "--security-opt", "no-new-privileges:true",
            "--user", "1001:1001",
            "-v", f"{os.path.abspath(temp_dir)}:/sandbox:ro",
            "-w", "/tmp",
            "-i",
            image,
            "java", f"-Xmx{memory_limit_mb}m", "-Xss16m", "-cp", "/sandbox", os.path.splitext(source_name)[0],
        ]

        return cls._run_docker_subprocess(run_cmd, container_id, stdin_data, time_limit_seconds)

    @classmethod
    def _run_docker_subprocess(
        cls,
        docker_cmd: List[str],
        container_id: str,
        stdin_data: str,
        time_limit_seconds: float,
    ) -> RawExecutionResult:
        """Executes docker command with strict timeout, output caps, and cleanup."""
        start_time = time.perf_counter()
        try:
            proc = subprocess.run(
                docker_cmd,
                input=stdin_data,
                capture_output=True,
                text=True,
                timeout=time_limit_seconds,
            )
            elapsed_ms = (time.perf_counter() - start_time) * 1000.0

            stdout = proc.stdout
            stderr = proc.stderr

            # Check output size limits
            if len(stdout.encode("utf-8")) > MAX_OUTPUT_LENGTH_BYTES:
                return RawExecutionResult(
                    status="OUTPUT_LIMIT_EXCEEDED",
                    stdout=stdout[:1000] + "\n... [Output Truncated]",
                    stderr="Output size exceeded 1MB limit.",
                    exit_code=proc.returncode,
                    execution_time_ms=elapsed_ms,
                    memory_used_mb=0.0,
                    error_message="Output limit exceeded (1MB).",
                )

            # Linux OOM killer exit code is 137
            if proc.returncode == 137:
                return RawExecutionResult(
                    status="MEMORY_LIMIT_EXCEEDED",
                    stdout=stdout,
                    stderr=stderr or "Process was killed (Out of Memory).",
                    exit_code=137,
                    execution_time_ms=elapsed_ms,
                    memory_used_mb=0.0,
                    error_message="Memory limit exceeded.",
                )

            if proc.returncode != 0:
                return RawExecutionResult(
                    status="RUNTIME_ERROR",
                    stdout=stdout,
                    stderr=stderr,
                    exit_code=proc.returncode,
                    execution_time_ms=elapsed_ms,
                    memory_used_mb=0.0,
                    error_message=stderr.strip() or f"Process exited with non-zero status {proc.returncode}",
                )

            return RawExecutionResult(
                status="SUCCESS",
                stdout=stdout,
                stderr=stderr,
                exit_code=0,
                execution_time_ms=elapsed_ms,
                memory_used_mb=0.0,
            )

        except subprocess.TimeoutExpired:
            elapsed_ms = (time.perf_counter() - start_time) * 1000.0
            cls._force_remove_container(container_id)
            return RawExecutionResult(
                status="TIME_LIMIT_EXCEEDED",
                stdout="",
                stderr=f"Execution exceeded time limit of {time_limit_seconds}s.",
                exit_code=-1,
                execution_time_ms=elapsed_ms,
                memory_used_mb=0.0,
                error_message=f"Time limit exceeded ({time_limit_seconds}s).",
            )
        except Exception as e:
            elapsed_ms = (time.perf_counter() - start_time) * 1000.0
            cls._force_remove_container(container_id)
            return RawExecutionResult(
                status="RUNTIME_ERROR",
                stdout="",
                stderr=str(e),
                exit_code=-1,
                execution_time_ms=elapsed_ms,
                memory_used_mb=0.0,
                error_message=f"Container execution error: {e}",
            )
