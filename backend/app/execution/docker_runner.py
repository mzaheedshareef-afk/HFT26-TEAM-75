"""
Docker Sandbox Runner
Spawns secure, isolated, ephemeral Docker containers to execute untrusted code.
Enforces non-root user, network disabled, CPU/memory limits, read-only FS, and strict cleanup.
Supports Python Docker SDK and CLI on Windows and Linux.
"""

from dataclasses import dataclass
import logging
import os
import re
import shutil
import subprocess
import tempfile
import time
from typing import Any, Callable, Dict, List, Optional, Set
import uuid

from backend.app.core.config import settings
from backend.app.execution.security import (
    DEFAULT_MEMORY_LIMIT_MB,
    DEFAULT_TIMEOUT_SECONDS,
    MAX_OUTPUT_LENGTH_BYTES,
    ContainerCreationError,
    ContainerStartupError,
    DockerSdkMissingError,
    DockerUnavailableError,
    ExecutionImageNotFoundError,
)

logger = logging.getLogger(__name__)

# Configurable Docker images per language
DOCKER_IMAGES = {
    "python": os.getenv("DOCKER_IMAGE_PYTHON", getattr(settings, "DOCKER_IMAGE_PYTHON", "python:3.12-slim")),
    "cpp": os.getenv("DOCKER_IMAGE_CPP", getattr(settings, "DOCKER_IMAGE_CPP", "gcc:13-bookworm")),
    "java": os.getenv("DOCKER_IMAGE_JAVA", getattr(settings, "DOCKER_IMAGE_JAVA", "openjdk:17-slim")),
}

# Source code filenames per language
SOURCE_FILENAMES = {
    "python": "solution.py",
    "cpp": "solution.cpp",
    "java": "Solution.java",
}


def detect_java_class_name(source_code: str) -> str:
    """Extracts public class name or class name with main method from Java code."""
    m = re.search(r"public\s+class\s+([A-Za-z0-9_]+)", source_code)
    if m:
        return m.group(1)
    m = re.search(r"class\s+([A-Za-z0-9_]+)", source_code)
    if m:
        return m.group(1)
    return "Solution"


# Override flag for testing Docker unavailability
_docker_available_override: Optional[bool] = None
# Mock runner callable for isolated unit testing
_custom_runner_hook: Optional[Callable[..., "RawExecutionResult"]] = None
# Cached docker SDK client
_docker_client: Optional[Any] = None
# Cached set of verified local images
_verified_images: Set[str] = set()


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
    def get_docker_client(cls) -> Optional[Any]:
        """Returns initialized and verified Python Docker SDK client if available."""
        global _docker_client
        if _docker_client is not None:
            return _docker_client

        try:
            import docker
        except ImportError:
            logger.debug("Python docker SDK not installed.")
            return None

        docker_host = os.getenv("DOCKER_HOST") or getattr(settings, "DOCKER_HOST", None)
        try:
            if docker_host:
                client = docker.DockerClient(base_url=docker_host)
            else:
                client = docker.from_env()
            client.ping()
            _docker_client = client
            return _docker_client
        except Exception as e:
            logger.debug(f"Docker SDK default connection failed: {e}")
            if os.name == "nt" and not docker_host:
                try:
                    alt_client = docker.DockerClient(base_url="tcp://127.0.0.1:2375")
                    alt_client.ping()
                    _docker_client = alt_client
                    return _docker_client
                except Exception:
                    pass
            return None

    @classmethod
    def is_docker_available(cls) -> bool:
        """Checks if Docker daemon and runner infrastructure are reachable."""
        global _docker_available_override
        if _docker_available_override is not None:
            return _docker_available_override

        # 1. Check Python Docker SDK
        client = cls.get_docker_client()
        if client is not None:
            try:
                return bool(client.ping())
            except Exception:
                pass

        # 2. Fallback check Docker CLI
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
    def check_image_exists(cls, image_name: str) -> bool:
        """Checks if image exists in the local Docker daemon image cache."""
        if image_name in _verified_images:
            return True

        client = cls.get_docker_client()
        if client is not None:
            try:
                client.images.get(image_name)
                _verified_images.add(image_name)
                return True
            except Exception:
                pass

        if shutil.which("docker"):
            try:
                res = subprocess.run(
                    ["docker", "image", "inspect", image_name],
                    capture_output=True,
                    timeout=3.0,
                )
                if res.returncode == 0:
                    _verified_images.add(image_name)
                    return True
            except Exception:
                pass

        return False

    @classmethod
    def ensure_image(cls, language: str) -> str:
        """
        Verifies that the required execution image is available.
        Attempts to pull or build from local Dockerfiles if missing.
        """
        image_name = DOCKER_IMAGES.get(language, DOCKER_IMAGES["python"])
        if cls.check_image_exists(image_name):
            return image_name

        if not cls.is_docker_available():
            raise DockerUnavailableError(
                "Docker execution sandbox is currently unavailable. Ensure the Docker daemon is running."
            )

        logger.info(f"Sandbox image '{image_name}' not found locally. Attempting pull...")
        client = cls.get_docker_client()
        pulled = False

        if client is not None:
            try:
                client.images.pull(image_name)
                _verified_images.add(image_name)
                pulled = True
            except Exception as e:
                logger.warning(f"Could not pull '{image_name}' via Docker SDK: {e}")

        if not pulled and shutil.which("docker"):
            try:
                res = subprocess.run(
                    ["docker", "pull", image_name],
                    capture_output=True,
                    timeout=180.0,
                )
                if res.returncode == 0:
                    _verified_images.add(image_name)
                    pulled = True
            except Exception as e:
                logger.warning(f"Could not pull '{image_name}' via CLI: {e}")

        # Check if local Dockerfile exists in sandbox/docker/
        if not pulled:
            dockerfile_path = os.path.join(os.getcwd(), "sandbox", "docker", f"Dockerfile.{language}")
            if os.path.isfile(dockerfile_path) and shutil.which("docker"):
                logger.info(f"Building local image from {dockerfile_path}...")
                try:
                    res = subprocess.run(
                        ["docker", "build", "-t", image_name, "-f", dockerfile_path, "."],
                        capture_output=True,
                        timeout=300.0,
                    )
                    if res.returncode == 0:
                        _verified_images.add(image_name)
                        pulled = True
                except Exception as e:
                    logger.warning(f"Failed to build local sandbox image: {e}")

        if not pulled:
            raise ExecutionImageNotFoundError(
                f"Docker sandbox image '{image_name}' for language '{language}' is not available. "
                f"Please run 'docker pull {image_name}' or build from sandbox/docker/Dockerfile.{language}."
            )

        return image_name

    @classmethod
    def diagnose_docker(cls) -> Dict[str, Any]:
        """Provides a detailed diagnostic report of Docker daemon, SDK, and images."""
        global _docker_available_override

        sdk_installed = False
        sdk_version = None
        try:
            import docker
            sdk_installed = True
            sdk_version = getattr(docker, "__version__", "unknown")
        except ImportError:
            pass

        docker_path = shutil.which("docker")
        cli_installed = bool(docker_path)

        docker_available = cls.is_docker_available()
        client = cls.get_docker_client() if sdk_installed else None

        server_version = None
        os_version = None
        containers_running = 0
        endpoint = (
            os.getenv("DOCKER_HOST")
            or getattr(settings, "DOCKER_HOST", None)
            or ("npipe:////./pipe/docker_engine" if os.name == "nt" else "unix:///var/run/docker.sock")
        )

        images_status: Dict[str, bool] = {
            "python": False,
            "cpp": False,
            "java": False,
        }

        root_error = None
        if not sdk_installed and not cli_installed:
            root_error = "Python Docker SDK and Docker CLI are missing. Run 'pip install docker' and install Docker Desktop."
        elif not docker_available:
            if os.name == "nt":
                root_error = (
                    f"Docker daemon unreachable at '{endpoint}'. "
                    "Ensure Docker Desktop is running with Linux container support enabled."
                )
            else:
                root_error = f"Docker daemon unreachable at '{endpoint}'. Ensure docker service is running."
        else:
            if client is not None:
                try:
                    v = client.version()
                    server_version = v.get("Version")
                    os_version = v.get("Os")
                    containers_running = len(client.containers.list())
                    for lang, img in DOCKER_IMAGES.items():
                        images_status[lang] = cls.check_image_exists(img)
                except Exception as e:
                    root_error = f"Error retrieving daemon info: {e}"
            elif cli_installed:
                try:
                    res = subprocess.run(
                        ["docker", "version", "--format", "{{.Server.Version}}"],
                        capture_output=True,
                        text=True,
                        timeout=3.0,
                    )
                    if res.returncode == 0:
                        server_version = res.stdout.strip()
                    for lang, img in DOCKER_IMAGES.items():
                        images_status[lang] = cls.check_image_exists(img)
                except Exception as e:
                    root_error = f"Error retrieving CLI version: {e}"

        guidance = [
            "1. Install Docker Desktop for Windows: https://www.docker.com/products/docker-desktop",
            "2. Start Docker Desktop from the Start Menu.",
            "3. In Docker Desktop Settings: ensure WSL 2 / Linux container engine is running.",
            "4. Verify in PowerShell: run 'docker info'.",
            f"5. Pull required execution images:",
            f"   docker pull {DOCKER_IMAGES['python']}",
            f"   docker pull {DOCKER_IMAGES['cpp']}",
            f"   docker pull {DOCKER_IMAGES['java']}",
        ]

        return {
            "docker_available": docker_available,
            "sdk_installed": sdk_installed,
            "sdk_version": sdk_version,
            "cli_installed": cli_installed,
            "cli_path": docker_path,
            "daemon_running": docker_available,
            "endpoint": endpoint,
            "server_version": server_version,
            "operating_system": os_version or ("Windows" if os.name == "nt" else "Linux"),
            "containers_running": containers_running,
            "images": images_status,
            "error": root_error,
            "setup_guidance": guidance,
        }

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
        - --network none (strictly offline)
        - --memory / --memory-swap limit
        - --cpus limit (0.5)
        - --pids-limit (64)
        - --read-only filesystem
        - --tmpfs /tmp:rw,size=32m,noexec,nosuid
        - --cap-drop ALL
        - --security-opt no-new-privileges:true
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

        # Check if Python Docker SDK is present
        try:
            import docker  # noqa: F401
        except ImportError:
            if not shutil.which("docker"):
                raise DockerSdkMissingError(
                    "Python Docker SDK is not installed in backend environment and Docker CLI is not found."
                )

        if not cls.is_docker_available():
            raise DockerUnavailableError(
                "Docker execution sandbox is currently unavailable. Ensure the Docker daemon is running."
            )

        # Ensure image is present
        image = cls.ensure_image(language)

        container_id = f"hft26_box_{uuid.uuid4().hex[:12]}"
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
                cls._force_remove_container(container_id)

    @classmethod
    def _force_remove_container(cls, container_id: str) -> None:
        """Ensures container cleanup via SDK or CLI even after crashes, failures, or timeouts."""
        client = cls.get_docker_client()
        if client is not None:
            try:
                c = client.containers.get(container_id)
                c.remove(force=True)
                return
            except Exception:
                pass

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
        # Convert path to posix-friendly format for Docker volume mount
        mount_path = os.path.abspath(temp_dir).replace("\\", "/")
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
            "-v", f"{mount_path}:/sandbox:ro",
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
        mount_path = os.path.abspath(temp_dir).replace("\\", "/")
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
            "-v", f"{mount_path}:/sandbox:rw",
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
                timeout=15.0,
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
                execution_time_ms=15000.0,
                memory_used_mb=0.0,
                error_message="Compilation timed out.",
            )
        except Exception as e:
            cls._force_remove_container(compile_id)
            raise ContainerCreationError(f"Failed to initiate C++ compilation container: {e}")
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
            "-v", f"{mount_path}:/sandbox:ro",
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
        mount_path = os.path.abspath(temp_dir).replace("\\", "/")
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
            "-v", f"{mount_path}:/sandbox:rw",
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
                timeout=15.0,
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
                execution_time_ms=15000.0,
                memory_used_mb=0.0,
                error_message="Compilation timed out.",
            )
        except Exception as e:
            cls._force_remove_container(compile_id)
            raise ContainerCreationError(f"Failed to initiate Java compilation container: {e}")
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
            "-v", f"{mount_path}:/sandbox:ro",
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
