from datetime import datetime, timezone
import json
import logging
import os
import re
from typing import Any, Dict, List, Optional, Tuple
import uuid

from fastapi import UploadFile
from supabase import Client

from backend.app.core.security import AuthException
from backend.app.schemas.portfolio import (
    GITHUB_URL_REGEX,
    PortfolioProfileResponse,
    RepositorySummary,
)

logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB

# In-memory fast cache to supplement Supabase storage during tests & high concurrency
_portfolio_memory_store: Dict[str, Dict[str, Any]] = {}
_portfolio_id_index: Dict[str, str] = {}  # portfolio_id -> user_id


def validate_portfolio_inputs(
    github_url: str,
    primary_languages: List[str],
    resume_file: Optional[UploadFile] = None,
    project_archive: Optional[UploadFile] = None,
) -> None:
    """Strictly validates portfolio submission fields."""
    if not github_url or not github_url.strip():
        raise AuthException(
            code="MISSING_FIELDS",
            message="GitHub profile or repository URL is required.",
            status_code=422,
        )

    clean_url = github_url.strip()
    if not GITHUB_URL_REGEX.match(clean_url):
        raise AuthException(
            code="INVALID_GITHUB_URL",
            message="Please enter a valid GitHub URL (e.g., https://github.com/username or https://github.com/username/repo).",
            status_code=422,
        )

    if not primary_languages or len([l for l in primary_languages if l and l.strip()]) == 0:
        raise AuthException(
            code="MISSING_FIELDS",
            message="At least one primary programming language must be selected.",
            status_code=422,
        )

    for f in [resume_file, project_archive]:
        if f is not None and hasattr(f, "size") and f.size and f.size > MAX_FILE_SIZE:
            raise AuthException(
                code="PAYLOAD_TOO_LARGE",
                message=f"Uploaded file '{f.filename}' exceeds maximum allowed size of 15MB.",
                status_code=413,
            )


def analyze_portfolio_skills(
    languages: List[str],
    frameworks: List[str],
    notes: Optional[str] = None,
) -> Tuple[str, List[str], List[Dict[str, Any]]]:
    """
    Heuristic engine that analyzes candidate technical stack:
    - Calculates experience tier (beginner, intermediate, advanced, expert)
    - Recommends adaptive assessment tracks
    - Generates repository summaries
    """
    norm_langs = [l.lower() for l in languages]
    norm_fw = [f.lower() for f in frameworks]

    # Calculate experience level
    total_tech = len(languages) + len(frameworks)
    if total_tech >= 6:
        exp_level = "advanced"
    elif total_tech >= 3:
        exp_level = "intermediate"
    else:
        exp_level = "beginner"

    # Derive assessment tracks
    tracks = []
    if "python" in norm_langs or "fastapi" in norm_fw or "django" in norm_fw:
        tracks.append("Backend Architecture with FastAPI & Async Systems")
    if "typescript" in norm_langs or "javascript" in norm_langs or "react" in norm_fw:
        tracks.append("Modern Full-Stack Engineering & React Architecture")
    if "sql" in norm_langs or "postgresql" in norm_fw:
        tracks.append("Database Concurrency, Indexing & Data Modeling")
    if "c++" in norm_langs or "go" in norm_langs or "rust" in norm_langs:
        tracks.append("High-Performance Systems & Concurrent Programming")

    if not tracks:
        tracks.append("Algorithms, Concurrency & High-Throughput Systems")

    return exp_level, tracks, []


class PortfolioService:
    @staticmethod
    def ensure_storage_bucket(client: Client) -> None:
        """Ensures the portfolios storage bucket exists in Supabase."""
        try:
            buckets = client.storage.list_buckets()
            bucket_names = [b.name for b in buckets] if buckets else []
            if "portfolios" not in bucket_names:
                client.storage.create_bucket("portfolios", options={"public": False})
                logger.info("Created 'portfolios' Supabase storage bucket.")
        except Exception as e:
            logger.debug(f"Storage bucket verification note: {e}")

    @classmethod
    def save_portfolio(
        cls,
        client: Client,
        user_id: str,
        github_url: str,
        primary_languages: List[str],
        frameworks: List[str],
        notes: Optional[str] = None,
        resume_filename: Optional[str] = None,
        resume_bytes: Optional[bytes] = None,
        archive_filename: Optional[str] = None,
        archive_bytes: Optional[bytes] = None,
        dsa_topics_solved: Optional[List[str]] = None,
        preferred_domain: Optional[str] = None,
        skills: Optional[List[Dict[str, Any]]] = None,
        projects: Optional[List[Dict[str, Any]]] = None,
        version: str = "1.0",
    ) -> Dict[str, Any]:
        """
        Saves portfolio record into Supabase Storage and database table.
        """
        cls.ensure_storage_bucket(client)

        # Upload files to Supabase Storage if provided
        if resume_filename and resume_bytes:
            try:
                storage_path = f"{user_id}/resume_{resume_filename}"
                client.storage.from_("portfolios").upload(
                    path=storage_path,
                    file=resume_bytes,
                    file_options={"upsert": "true"},
                )
            except Exception as e:
                logger.warning(f"Could not persist resume file in storage: {e}")

        if archive_filename and archive_bytes:
            try:
                storage_path = f"{user_id}/project_{archive_filename}"
                client.storage.from_("portfolios").upload(
                    path=storage_path,
                    file=archive_bytes,
                    file_options={"upsert": "true"},
                )
            except Exception as e:
                logger.warning(f"Could not persist project archive in storage: {e}")

        # Analyze portfolio
        exp_level, tracks, _ = analyze_portfolio_skills(primary_languages, frameworks, notes)

        # Build repository preview from GitHub URL
        clean_url = github_url.strip().rstrip("/")
        repo_name = clean_url.split("/")[-1] if "/" in clean_url else "main-portfolio"
        repositories = [
            {
                "name": repo_name,
                "url": clean_url,
                "primaryLanguage": primary_languages[0] if primary_languages else "Python",
                "stars": 0,
                "description": f"Target repository for automated assessment calibration.",
            }
        ]

        # Check existing portfolio id if available
        portfolio_id = _portfolio_memory_store.get(user_id, {}).get("id") or str(uuid.uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()

        clean_dsa = [str(t).strip() for t in (dsa_topics_solved or []) if t and str(t).strip()]
        resolved_domain = (preferred_domain or "Backend Development").strip()

        record = {
            "id": portfolio_id,
            "user_id": user_id,
            "userId": user_id,
            "github_url": clean_url,
            "githubUrl": clean_url,
            "primary_languages": primary_languages,
            "primaryLanguages": primary_languages,
            "frameworks": frameworks,
            "status": "ready",
            "updated_at": now_iso,
            "updatedAt": now_iso,
            "resume_file_name": resume_filename,
            "resumeFileName": resume_filename,
            "project_archive_name": archive_filename,
            "projectArchiveName": archive_filename,
            "summary_note": notes,
            "summaryNote": notes,
            "experience_level": exp_level,
            "recommended_tracks": tracks,
            "repositories": repositories,
            "dsa_topics_solved": clean_dsa,
            "dsa_topics": clean_dsa,
            "dsaTopics": clean_dsa,
            "preferred_domain": resolved_domain,
            "domain": resolved_domain,
            "skills": skills or [],
            "projects": projects or [],
            "version": version,
        }

        # Persist to Supabase Storage as portfolio.json
        try:
            portfolio_json_bytes = json.dumps(record).encode("utf-8")
            client.storage.from_("portfolios").upload(
                path=f"{user_id}/portfolio.json",
                file=portfolio_json_bytes,
                file_options={"content-type": "application/json", "upsert": "true"},
            )
            logger.info(f"Persisted portfolio to Supabase storage for user {user_id}")
        except Exception as e:
            logger.warning(f"Storage write note for user {user_id}: {e}")

        # Try to persist to Supabase Database table if table exists
        try:
            db_payload = {
                "id": portfolio_id,
                "user_id": user_id,
                "headline": notes[:100] if notes else f"{exp_level.capitalize()} Developer",
                "bio": notes,
                "github_username": repo_name,
                "experience_level": exp_level,
                "raw_json": record,
                "parsed_skills": primary_languages + frameworks,
                "parsed_projects": repositories,
                "recommended_tracks": tracks,
                "updated_at": now_iso,
            }
            client.table("portfolios").upsert(db_payload).execute()
            logger.info(f"Upserted portfolio into public.portfolios table for user {user_id}")
        except Exception as e:
            logger.debug(f"Database table portfolios write skipped or handled: {e}")

        # Store in fast memory cache
        _portfolio_memory_store[user_id] = record
        _portfolio_id_index[portfolio_id] = user_id

        return record

    @classmethod
    def get_portfolio_for_user(cls, client: Client, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves portfolio for candidate by user_id from database, storage, or cache.
        """
        # 1. Try memory cache
        if user_id in _portfolio_memory_store:
            return _portfolio_memory_store[user_id]

        # 2. Try Supabase Storage
        try:
            cls.ensure_storage_bucket(client)
            raw = client.storage.from_("portfolios").download(f"{user_id}/portfolio.json")
            if raw:
                record = json.loads(raw.decode("utf-8"))
                _portfolio_memory_store[user_id] = record
                _portfolio_id_index[record["id"]] = user_id
                return record
        except Exception as e:
            logger.debug(f"Storage download not found for user {user_id}: {e}")

        # 3. Try Supabase Database table
        try:
            res = client.table("portfolios").select("*").eq("user_id", user_id).execute()
            if res.data and len(res.data) > 0:
                raw_json = res.data[0].get("raw_json")
                if raw_json and isinstance(raw_json, dict):
                    _portfolio_memory_store[user_id] = raw_json
                    _portfolio_id_index[raw_json.get("id", "")] = user_id
                    return raw_json
        except Exception as e:
            logger.debug(f"Database query portfolios note: {e}")

        return None

    @classmethod
    def get_portfolio_by_id(
        cls,
        client: Client,
        portfolio_id: str,
        requesting_user: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Retrieves portfolio by portfolio_id with strict authorization checks:
        - Students can only access their own portfolio.
        - Companies / Recruiters can access any student's portfolio.
        """
        req_user_id = str(requesting_user.get("id"))
        req_role = str(requesting_user.get("role"))

        # Look up user_id from index or query
        target_user_id = _portfolio_id_index.get(portfolio_id)
        portfolio = None

        if target_user_id:
            portfolio = cls.get_portfolio_for_user(client, target_user_id)

        if not portfolio:
            # Query memory store
            for uid, p in _portfolio_memory_store.items():
                if p.get("id") == portfolio_id:
                    portfolio = p
                    target_user_id = uid
                    break

        if not portfolio:
            # Try database table
            try:
                res = client.table("portfolios").select("*").eq("id", portfolio_id).execute()
                if res.data and len(res.data) > 0:
                    portfolio = res.data[0].get("raw_json")
                    target_user_id = res.data[0].get("user_id")
            except Exception:
                pass

        if not portfolio:
            raise AuthException(
                code="PORTFOLIO_NOT_FOUND",
                message="Portfolio record not found.",
                status_code=404,
            )

        # Authorization check: Student can only access their own portfolio
        portfolio_owner_id = str(portfolio.get("user_id") or target_user_id)
        if req_role != "company" and portfolio_owner_id != req_user_id:
            raise AuthException(
                code="UNAUTHORIZED_ACCESS",
                message="Access forbidden: You do not have permission to access another student's portfolio.",
                status_code=403,
            )

        return portfolio
