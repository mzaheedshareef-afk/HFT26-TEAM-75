import json
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, Header, Request, UploadFile, status
from fastapi.responses import JSONResponse
from supabase import Client

from backend.app.core.security import AuthException
from backend.app.database.supabase import get_supabase_client
from backend.app.schemas.portfolio import (
    PortfolioApiResponse,
    PortfolioUploadJsonRequest,
)
from backend.app.services.auth_service import AuthService
from backend.app.services.portfolio_service import (
    MAX_FILE_SIZE,
    PortfolioService,
    validate_portfolio_inputs,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def get_authenticated_user(
    authorization: Optional[str] = Header(None),
    client: Client = Depends(get_supabase_client),
) -> Dict[str, Any]:
    """Dependency to extract and cryptographically verify active user profile from Bearer token."""
    if not authorization or not authorization.strip():
        raise AuthException(
            code="UNAUTHORIZED",
            message="Authorization token header is missing",
            status_code=401,
        )
    return AuthService.get_current_user_profile(client, authorization)


@router.post(
    "/upload",
    response_model=PortfolioApiResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload candidate portfolio",
    description="Ingests candidate portfolio via multipart form data or JSON body, validates fields, and stores in Supabase.",
)
async def upload_portfolio(
    request: Request,
    authorization: Optional[str] = Header(None),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    # 1. Authenticate user
    current_user = get_authenticated_user(authorization, client)
    user_id = str(current_user.get("id"))
    user_role = str(current_user.get("role"))

    # 2. Enforce student role
    if user_role != "student":
        raise AuthException(
            code="ROLE_MISMATCH",
            message="Only registered students can upload portfolios. Company accounts cannot upload portfolios.",
            status_code=403,
        )

    # 3. Parse input: detect Multipart Form Data vs JSON Body
    content_type = request.headers.get("content-type", "")

    github_url = ""
    languages: List[str] = []
    frameworks: List[str] = []
    notes: Optional[str] = None
    resume_file_name: Optional[str] = None
    resume_bytes: Optional[bytes] = None
    archive_file_name: Optional[str] = None
    archive_bytes: Optional[bytes] = None
    dsa_topics_solved: List[str] = []
    preferred_domain: str = "Backend Development"
    skills: List[Dict[str, Any]] = []
    projects: List[Dict[str, Any]] = []

    if "multipart/form-data" in content_type:
        form = await request.form()
        github_url = str(form.get("github_url") or form.get("githubUrl") or "").strip()

        # Parse primary languages
        raw_langs = form.get("primary_languages") or form.get("primaryLanguages")
        if raw_langs:
            try:
                parsed_langs = json.loads(str(raw_langs))
                if isinstance(parsed_langs, list):
                    languages = [str(x) for x in parsed_langs if str(x).strip()]
                elif isinstance(parsed_langs, str):
                    languages = [parsed_langs.strip()]
            except Exception:
                languages = [x.strip() for x in str(raw_langs).split(",") if x.strip()]

        # Parse frameworks
        raw_fw = form.get("frameworks")
        if raw_fw:
            try:
                parsed_fw = json.loads(str(raw_fw))
                if isinstance(parsed_fw, list):
                    frameworks = [str(x) for x in parsed_fw if str(x).strip()]
                elif isinstance(parsed_fw, str):
                    frameworks = [parsed_fw.strip()]
            except Exception:
                frameworks = [x.strip() for x in str(raw_fw).split(",") if x.strip()]

        notes = str(form.get("notes") or form.get("portfolio_notes") or form.get("portfolioNotes") or "").strip() or None

        raw_dsa = form.get("dsa_topics_solved") or form.get("dsa_topics") or form.get("dsaTopics")
        if raw_dsa:
            try:
                parsed_dsa = json.loads(str(raw_dsa))
                if isinstance(parsed_dsa, list):
                    dsa_topics_solved = [str(x).strip() for x in parsed_dsa if str(x).strip()]
                elif isinstance(parsed_dsa, str):
                    dsa_topics_solved = [parsed_dsa.strip()]
            except Exception:
                dsa_topics_solved = [x.strip() for x in str(raw_dsa).split(",") if x.strip()]

        raw_domain = form.get("preferred_domain") or form.get("domain")
        if raw_domain:
            preferred_domain = str(raw_domain).strip()

        # Parse files
        resume_obj = form.get("resume_file")
        if resume_obj is not None and hasattr(resume_obj, "filename") and resume_obj.filename:
            resume_file_name = resume_obj.filename
            if hasattr(resume_obj, "read"):
                resume_bytes = await resume_obj.read()
                if len(resume_bytes) > MAX_FILE_SIZE:
                    raise AuthException(
                        code="PAYLOAD_TOO_LARGE",
                        message=f"Uploaded file '{resume_file_name}' exceeds maximum allowed size of 15MB.",
                        status_code=413,
                    )

        archive_obj = form.get("project_archive")
        if archive_obj is not None and hasattr(archive_obj, "filename") and archive_obj.filename:
            archive_file_name = archive_obj.filename
            if hasattr(archive_obj, "read"):
                archive_bytes = await archive_obj.read()
                if len(archive_bytes) > MAX_FILE_SIZE:
                    raise AuthException(
                        code="PAYLOAD_TOO_LARGE",
                        message=f"Uploaded file '{archive_file_name}' exceeds maximum allowed size of 15MB.",
                        status_code=413,
                    )
    else:
        # JSON body parsing
        try:
            body = await request.json()
        except Exception:
            body = {}

        if not body:
            raise AuthException(
                code="MISSING_FIELDS",
                message="Portfolio submission payload cannot be empty.",
                status_code=422,
            )

        json_req = PortfolioUploadJsonRequest(**body)
        github_url = json_req.get_github_url()
        languages = json_req.get_languages()
        frameworks = json_req.get_frameworks()
        notes = json_req.get_notes()
        dsa_topics_solved = json_req.get_dsa_topics()
        preferred_domain = json_req.get_preferred_domain()
        parsed_skills = []
        if json_req.skills:
            for s in json_req.skills:
                if hasattr(s, "model_dump"):
                    parsed_skills.append(s.model_dump())
                elif isinstance(s, dict):
                    parsed_skills.append(s)
                elif isinstance(s, str):
                    parsed_skills.append({"name": s, "category": "general", "proficiency": "intermediate"})
        skills = parsed_skills
        projects = [p.model_dump() for p in json_req.projects] if json_req.projects else []

    # 4. Strict validation
    validate_portfolio_inputs(github_url, languages)

    # 5. Save & Analyze via Service
    portfolio_record = PortfolioService.save_portfolio(
        client=client,
        user_id=user_id,
        github_url=github_url,
        primary_languages=languages,
        frameworks=frameworks,
        notes=notes,
        resume_filename=resume_file_name,
        resume_bytes=resume_bytes,
        archive_filename=archive_file_name,
        archive_bytes=archive_bytes,
        dsa_topics_solved=dsa_topics_solved,
        preferred_domain=preferred_domain,
        skills=skills,
        projects=projects,
    )

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "success": True,
            "portfolio": portfolio_record,
            "message": "Portfolio submitted successfully for adaptive assessment calibration.",
        },
    )


@router.get(
    "/me",
    summary="Get authenticated candidate's portfolio",
    description="Retrieves the portfolio profile for the currently authenticated student.",
)
def get_my_portfolio(
    authorization: Optional[str] = Header(None),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    current_user = get_authenticated_user(authorization, client)
    user_id = str(current_user.get("id"))

    portfolio = PortfolioService.get_portfolio_for_user(client, user_id)
    if not portfolio:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "success": False,
                "portfolio": None,
                "error": {
                    "code": "PORTFOLIO_NOT_FOUND",
                    "message": "No portfolio record found for this candidate.",
                },
            },
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "portfolio": portfolio,
        },
    )


@router.get(
    "/{portfolio_id}",
    summary="Get portfolio by ID",
    description="Retrieves a candidate portfolio by ID with student ownership and recruiter access checks.",
)
def get_portfolio_by_id(
    portfolio_id: str,
    authorization: Optional[str] = Header(None),
    client: Client = Depends(get_supabase_client),
) -> JSONResponse:
    current_user = get_authenticated_user(authorization, client)

    portfolio = PortfolioService.get_portfolio_by_id(client, portfolio_id, current_user)

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "portfolio": portfolio,
        },
    )
