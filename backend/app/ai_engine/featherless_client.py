import json
import logging
import time
from typing import Any, Dict, List, Optional
import httpx

from backend.app.core.config import settings

logger = logging.getLogger(__name__)


class FeatherlessError(Exception):
    """Base exception for Featherless AI client errors."""
    def __init__(self, message: str, status_code: Optional[int] = None, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}


class FeatherlessAuthError(FeatherlessError):
    """Raised when authentication fails (401/403)."""
    pass


class FeatherlessRateLimitError(FeatherlessError):
    """Raised when the API rate limit is exceeded (429)."""
    pass


class FeatherlessTimeoutError(FeatherlessError):
    """Raised when a request to Featherless times out."""
    pass


class FeatherlessAPIError(FeatherlessError):
    """Raised when Featherless API returns an unhandled HTTP error status."""
    pass


class FeatherlessMalformedResponseError(FeatherlessError):
    """Raised when response body cannot be parsed as valid JSON."""
    pass


def _mask_secret(secret: Optional[str]) -> str:
    """Masks secret keys for safe logging."""
    if not secret:
        return "<empty>"
    if len(secret) <= 8:
        return "***"
    return f"{secret[:4]}...{secret[-4:]}"


class FeatherlessClient:
    """
    Client for interacting with Featherless AI (OpenAI-compatible chat completion API).
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout: float = 30.0,
        max_retries: int = 1,
    ):
        self.api_key = api_key or settings.FEATHERLESS_API_KEY
        self.base_url = (base_url or settings.FEATHERLESS_BASE_URL).rstrip("/")
        self.model = model or settings.FEATHERLESS_MODEL
        self.timeout = timeout
        self.max_retries = max_retries

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "HFT26-AssessmentEngine/1.0",
        }

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 3500,
        response_format: Optional[Dict[str, str]] = None,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Synchronous chat completion with retry handling, rate limiting, and sanitized error logging.
        """
        url = f"{self.base_url}/chat/completions"
        target_model = model or self.model
        payload: Dict[str, Any] = {
            "model": target_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format:
            payload["response_format"] = response_format

        masked_key = _mask_secret(self.api_key)
        logger.info(
            "Calling Featherless AI chat completions: model=%s, endpoint=%s, key=%s",
            target_model,
            self.base_url,
            masked_key,
        )

        attempts = 0
        last_exception: Optional[Exception] = None

        while attempts <= self.max_retries:
            attempts += 1
            try:
                with httpx.Client(timeout=self.timeout) as client:
                    response = client.post(
                        url,
                        headers=self._get_headers(),
                        json=payload,
                    )

                if response.status_code == 200:
                    try:
                        return response.json()
                    except json.JSONDecodeError as exc:
                        raise FeatherlessMalformedResponseError(
                            f"Failed to decode response as JSON: {exc}",
                            status_code=200,
                        )

                # Handle specific HTTP error status codes
                if response.status_code in (401, 403):
                    logger.error(
                        "Featherless AI authentication failure (HTTP %d). Check FEATHERLESS_API_KEY.",
                        response.status_code,
                    )
                    raise FeatherlessAuthError(
                        "Authentication with Featherless AI failed. Please verify FEATHERLESS_API_KEY.",
                        status_code=response.status_code,
                    )

                if response.status_code == 429:
                    logger.warning(
                        "Featherless AI rate limit encountered (HTTP 429). Attempt %d/%d.",
                        attempts,
                        self.max_retries + 1,
                    )
                    if attempts <= self.max_retries:
                        time.sleep(1.5 * attempts)
                        continue
                    raise FeatherlessRateLimitError(
                        "Featherless AI rate limit exceeded. Please try again shortly.",
                        status_code=429,
                    )

                # Any other non-200 error
                logger.error(
                    "Featherless AI request failed with HTTP %d: %s",
                    response.status_code,
                    response.text[:300],
                )
                raise FeatherlessAPIError(
                    f"Featherless AI returned HTTP {response.status_code}: {response.text[:200]}",
                    status_code=response.status_code,
                )

            except httpx.TimeoutException as exc:
                logger.warning(
                    "Featherless AI request timed out after %.1fs (attempt %d/%d).",
                    self.timeout,
                    attempts,
                    self.max_retries + 1,
                )
                last_exception = FeatherlessTimeoutError(
                    f"Featherless AI request timed out after {self.timeout} seconds.",
                    status_code=504,
                )
                if attempts <= self.max_retries:
                    time.sleep(1.0)
                    continue
                raise last_exception

            except httpx.RequestError as exc:
                logger.error("Network communication error with Featherless AI: %s", exc)
                last_exception = FeatherlessAPIError(f"Network error connecting to Featherless AI: {exc}")
                if attempts <= self.max_retries:
                    time.sleep(1.0)
                    continue
                raise last_exception

        if last_exception:
            raise last_exception
        raise FeatherlessAPIError("Featherless AI call failed after retries.")

    async def async_chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 3500,
        response_format: Optional[Dict[str, str]] = None,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Asynchronous chat completion."""
        # For our FastAPI async endpoints, wraps client call cleanly
        return self.chat_completion(
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format=response_format,
            model=model,
        )


# Global singleton instance
featherless_client = FeatherlessClient()
