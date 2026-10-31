from contextlib import asynccontextmanager
import logging
from typing import Any
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.api.routes.auth import router as auth_router
from backend.app.api.routes.portfolio import router as portfolio_router
from backend.app.api.routes.assessment import router as assessment_router
from backend.app.api.routes.submissions import (
    code_router,
    submissions_router,
)
from backend.app.api.routes.assistant import (
    assistant_router,
    assessment_hint_router,
)
from backend.app.api.routes.analytics import router as analytics_router
from backend.app.api.routes.public_profile import (
    profile_router,
    public_profile_router,
)
from backend.app.api.routes.recruiter import (
    company_router,
    recruiter_router,
)

from backend.app.core.config import settings
from backend.app.core.security import AuthException
from backend.app.execution.security import ExecutionSecurityException

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("auth_app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup check
    logger.info("Initializing Backend Application with Secure Sandbox Execution...")
    yield
    # Shutdown
    logger.info("Backend Application shutting down.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Secure Code Execution & Automated Grading Backend for Portfolio-Driven Technical Assessment Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------------------------------------------
# Global Exception Handlers
# -------------------------------------------------------------

@app.exception_handler(ExecutionSecurityException)
async def execution_security_exception_handler(request: Request, exc: ExecutionSecurityException) -> JSONResponse:
    """Handles execution security errors (unsupported language, empty code, docker unavailable)."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.code,
                "message": exc.message,
            },
        },
    )


@app.exception_handler(AuthException)
async def auth_exception_handler(request: Request, exc: AuthException) -> JSONResponse:
    """Handles domain-specific authentication and authorization exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.code,
                "message": exc.message,
            },
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Formats Pydantic request validation errors into unified error contract."""
    errors = exc.errors()
    error_code = "VALIDATION_ERROR"
    messages = []

    for err in errors:
        loc = " -> ".join([str(x) for x in err.get("loc", []) if x != "body"])
        msg = err.get("msg", "Invalid value")
        err_type = err.get("type", "")

        if "missing" in err_type:
            error_code = "MISSING_FIELDS"
        elif "email" in err_type or "email" in loc.lower():
            error_code = "INVALID_EMAIL"

        if loc:
            messages.append(f"'{loc}': {msg}")
        else:
            messages.append(msg)

    combined_message = "; ".join(messages) if messages else "Invalid request payload"

    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": {
                "code": error_code,
                "message": combined_message,
            },
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Handles standard HTTPExceptions in the unified error format."""
    code = getattr(exc, "code", "HTTP_ERROR")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": code,
                "message": str(exc.detail),
            },
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all handler for unexpected internal server errors."""
    logger.exception(f"Unhandled server error: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred. Please try again later.",
            },
        },
    )


# -------------------------------------------------------------
# Base Health Endpoints
# -------------------------------------------------------------

@app.get("/", tags=["Health"])
def root() -> dict[str, Any]:
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/health", tags=["Health"])
def api_health_check() -> dict[str, Any]:
    """Global health verification endpoint for frontend and monitoring probes."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
    }


# -------------------------------------------------------------
# Include Routers
# -------------------------------------------------------------

app.include_router(
    auth_router,
    prefix="/api/auth",
    tags=["Authentication"],
)

app.include_router(
    portfolio_router,
    prefix="/api/portfolio",
    tags=["Portfolio"],
)

app.include_router(
    assessment_router,
    prefix="/api/assessment",
    tags=["Assessment"],
)

app.include_router(
    code_router,
    prefix="/api/code",
    tags=["Code Execution"],
)

app.include_router(
    submissions_router,
    prefix="/api/submissions",
    tags=["Submissions"],
)

app.include_router(
    assistant_router,
    prefix="/api/assistant",
    tags=["Guarded Assistant"],
)

app.include_router(
    assessment_hint_router,
    prefix="/api/assessment",
    tags=["Assessment Hints"],
)

app.include_router(
    analytics_router,
    prefix="/api/analytics",
    tags=["Analytics"],
)

app.include_router(
    profile_router,
    prefix="/api/profile",
    tags=["Student Profile"],
)

app.include_router(
    public_profile_router,
    prefix="/api/public/profile",
    tags=["Public Profile"],
)

app.include_router(
    public_profile_router,
    prefix="/api/public-profile",
    tags=["Public Profile"],
)

app.include_router(
    company_router,
    prefix="/api/company",
    tags=["Company Profile"],
)

app.include_router(
    recruiter_router,
    prefix="/api/recruiter",
    tags=["Recruiter"],
)

