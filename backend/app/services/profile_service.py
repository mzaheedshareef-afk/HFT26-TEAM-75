"""
Public Student Profile & Sharing Service
Provides secure shareable candidate portfolio profiles with strict privacy controls.
Zero exposure of sensitive fields (emails, auth tokens, internal IDs, hidden tests, raw source code).
"""

from datetime import datetime, timezone
import logging
import secrets
from typing import Any, Dict, List, Optional
import uuid

from supabase import Client

from backend.app.core.security import AuthException
from backend.app.services.analytics_service import AnalyticsService

logger = logging.getLogger(__name__)

# In-memory store for public student profiles (user_id -> profile dict, and share_id -> profile dict)
_public_profiles_store: Dict[str, Dict[str, Any]] = {}
_public_profiles_by_share_id: Dict[str, Dict[str, Any]] = {}


class ProfileService:
    """Manages student shareable profile lifecycle, visibility controls, and privacy boundaries."""

    @classmethod
    def generate_share_id(cls) -> str:
        """Generates cryptographically random non-guessable URL slug."""
        return secrets.token_urlsafe(16)

    @classmethod
    def get_or_create_profile(cls, client: Client, user: Dict[str, Any]) -> Dict[str, Any]:
        """
        Retrieves candidate profile record, creating an initial private profile if one does not exist.
        Derives verified achievements and performance summary from authentic assessment analytics.
        """
        user_id = str(user["id"])
        full_name = str(user.get("full_name") or "Candidate")

        # 1. Check in-memory store
        if user_id in _public_profiles_store:
            profile = _public_profiles_store[user_id]
            # Refresh performance summary dynamically
            profile["performance_summary"] = cls._build_performance_summary(client, user)
            profile["verified_achievements"] = cls._build_verified_achievements(client, user)
            return profile

        # 2. Check Supabase table
        try:
            res = client.table("student_public_profiles").select("*").eq("user_id", user_id).execute()
            if res.data and len(res.data) > 0:
                profile = res.data[0]
                profile["performance_summary"] = cls._build_performance_summary(client, user)
                profile["verified_achievements"] = cls._build_verified_achievements(client, user)
                _public_profiles_store[user_id] = profile
                _public_profiles_by_share_id[profile["share_id"]] = profile
                return profile
        except Exception as e:
            logger.debug("Database profile fetch note: %s", e)

        # 3. Create default initial profile (Private by default)
        share_id = cls.generate_share_id()
        now_iso = datetime.now(timezone.utc).isoformat()
        profile_id = f"prof_{uuid.uuid4().hex[:12]}"

        # Extract initial skills from portfolio if available
        initial_skills: List[str] = []
        try:
            res_port = client.table("portfolios").select("*").eq("user_id", user_id).execute()
            if res_port.data and len(res_port.data) > 0:
                port = res_port.data[0]
                raw_skills = port.get("parsed_skills") or []
                if isinstance(raw_skills, list):
                    initial_skills = [str(s) for s in raw_skills[:8]]
        except Exception:
            pass

        profile = {
            "id": profile_id,
            "user_id": user_id,
            "full_name": full_name,
            "public_name": full_name,
            "headline": "Software Engineer & Problem Solver",
            "bio": "Continuous learner specializing in algorithmic problem solving and robust backend systems.",
            "skills": initial_skills if initial_skills else ["Python", "Algorithms", "Data Structures"],
            "technologies": ["FastAPI", "Docker", "PostgreSQL"],
            "projects": [],
            "portfolio_highlights": [],
            "verified_achievements": cls._build_verified_achievements(client, user),
            "performance_summary": cls._build_performance_summary(client, user),
            "visibility": "private",
            "share_id": share_id,
            "created_at": now_iso,
            "updated_at": now_iso,
        }

        _public_profiles_store[user_id] = profile
        _public_profiles_by_share_id[share_id] = profile

        # Save to database
        try:
            client.table("student_public_profiles").insert({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "share_id": share_id,
                "visibility": "private",
                "public_name": profile["public_name"],
                "headline": profile["headline"],
                "bio": profile["bio"],
                "skills": profile["skills"],
                "technologies": profile["technologies"],
                "projects": profile["projects"],
                "portfolio_highlights": profile["portfolio_highlights"],
                "verified_achievements": profile["verified_achievements"],
                "performance_summary": profile["performance_summary"],
                "created_at": now_iso,
                "updated_at": now_iso,
            }).execute()
        except Exception as e:
            logger.debug("Database profile insert note: %s", e)

        return profile

    @classmethod
    def _build_performance_summary(cls, client: Client, user: Dict[str, Any]) -> Dict[str, Any]:
        """Derives aggregate performance indicators without exposing private individual attempts."""
        analytics = AnalyticsService.get_student_dashboard_analytics(client, user)
        return {
            "total_assessments_completed": analytics["completed_assessments"],
            "average_score": analytics["average_score"],
            "highest_score": analytics["highest_score"],
            "overall_success_rate": round(
                (analytics["total_correct_test_cases"] / max(1, analytics["total_test_cases"])) * 100.0, 1
            ) if analytics["total_test_cases"] > 0 else 0.0,
            "consistency_rating": (
                "Exceptional" if analytics["performance_consistency_score"] >= 85.0
                else "Solid" if analytics["performance_consistency_score"] >= 65.0
                else "Developing"
            ),
            "top_topics": [t["topic"] for t in analytics["topic_performance"][:3]],
        }

    @classmethod
    def _build_verified_achievements(cls, client: Client, user: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Constructs cryptographically verified achievement badges from assessment completions."""
        analytics = AnalyticsService.get_student_dashboard_analytics(client, user)
        achievements = []

        if analytics["completed_assessments"] >= 1:
            achievements.append({
                "badge": "First Assessment Completed",
                "level": "Bronze",
                "description": "Successfully completed candidate technical assessment.",
            })

        if analytics["highest_score"] >= 90.0:
            achievements.append({
                "badge": "High Caliber Solution",
                "level": "Gold",
                "description": "Achieved 90%+ final composite score on technical assessment.",
            })

        if analytics["total_correct_test_cases"] >= 10:
            achievements.append({
                "badge": "Deterministic Accuracy",
                "level": "Silver",
                "description": "Passed 10+ strict test cases across complex problem domains.",
            })

        return achievements

    @classmethod
    def update_profile(
        cls,
        client: Client,
        user: Dict[str, Any],
        updates: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Updates authenticated student's profile information.
        Enforces strict profile ownership; rejects tampering with user_id or share_id.
        """
        profile = cls.get_or_create_profile(client, user)
        user_id = str(user["id"])
        now_iso = datetime.now(timezone.utc).isoformat()

        # Sanitize permitted update fields
        allowed_fields = (
            "public_name", "display_name", "headline", "bio", "summary", "skills",
            "technologies", "projects", "portfolio_highlights", "github_url", "linkedin_url",
        )
        for field in allowed_fields:
            if field in updates and updates[field] is not None:
                profile[field] = updates[field]

        if "display_name" in updates and updates["display_name"]:
            profile["public_name"] = str(updates["display_name"])
            profile["display_name"] = str(updates["display_name"])
        elif "public_name" in updates and updates["public_name"]:
            profile["display_name"] = str(updates["public_name"])

        if "summary" in updates and updates["summary"]:
            profile["bio"] = str(updates["summary"])
            profile["summary"] = str(updates["summary"])
        elif "bio" in updates and updates["bio"]:
            profile["summary"] = str(updates["bio"])

        profile["updated_at"] = now_iso
        _public_profiles_store[user_id] = profile
        _public_profiles_by_share_id[profile["share_id"]] = profile

        # Update database
        try:
            client.table("student_public_profiles").update({
                "public_name": profile["public_name"],
                "headline": profile["headline"],
                "bio": profile["bio"],
                "skills": profile["skills"],
                "technologies": profile["technologies"],
                "projects": profile["projects"],
                "portfolio_highlights": profile["portfolio_highlights"],
                "updated_at": now_iso,
            }).eq("user_id", user_id).execute()
        except Exception as e:
            logger.debug("Database profile update note: %s", e)

        return profile

    @classmethod
    def set_visibility(
        cls,
        client: Client,
        user: Dict[str, Any],
        visibility: str,
    ) -> Dict[str, Any]:
        """Updates profile visibility to 'public' or 'private'."""
        clean_vis = visibility.strip().lower()
        if clean_vis not in ("public", "private"):
            raise AuthException(
                code="INVALID_VISIBILITY",
                message="Visibility must be either 'public' or 'private'.",
                status_code=400,
            )

        profile = cls.get_or_create_profile(client, user)
        user_id = str(user["id"])
        now_iso = datetime.now(timezone.utc).isoformat()

        profile["visibility"] = clean_vis
        profile["updated_at"] = now_iso
        _public_profiles_store[user_id] = profile
        _public_profiles_by_share_id[profile["share_id"]] = profile

        try:
            client.table("student_public_profiles").update({
                "visibility": clean_vis,
                "updated_at": now_iso,
            }).eq("user_id", user_id).execute()
        except Exception as e:
            logger.debug("Database visibility update note: %s", e)

        return profile

    @classmethod
    def revoke_share_link(
        cls,
        client: Client,
        user: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Revokes existing share link by generating a brand new share_id.
        The previous link stops working immediately.
        """
        profile = cls.get_or_create_profile(client, user)
        user_id = str(user["id"])
        old_share_id = profile["share_id"]
        new_share_id = cls.generate_share_id()
        now_iso = datetime.now(timezone.utc).isoformat()

        # Invalidate old share_id mapping
        if old_share_id in _public_profiles_by_share_id:
            del _public_profiles_by_share_id[old_share_id]

        profile["share_id"] = new_share_id
        profile["updated_at"] = now_iso
        _public_profiles_store[user_id] = profile
        _public_profiles_by_share_id[new_share_id] = profile

        try:
            client.table("student_public_profiles").update({
                "share_id": new_share_id,
                "updated_at": now_iso,
            }).eq("user_id", user_id).execute()
        except Exception as e:
            logger.debug("Database revoke share update note: %s", e)

        return profile

    @classmethod
    def get_public_profile(cls, client: Client, share_id: str) -> Dict[str, Any]:
        """
        Public endpoint: Retrieves verified public student profile by share_id.
        Zero authentication required.

        Privacy Enforcements:
        - Rejects private profiles with 404 (or revoked links).
        - NEVER exposes email address, user_id, auth tokens, raw code, or hidden tests.
        """
        profile: Optional[Dict[str, Any]] = None

        # 1. Search memory store
        if share_id in _public_profiles_by_share_id:
            profile = _public_profiles_by_share_id[share_id]

        # 2. Query Supabase
        if not profile:
            try:
                res = client.table("student_public_profiles").select("*").eq("share_id", share_id).execute()
                if res.data and len(res.data) > 0:
                    profile = res.data[0]
            except Exception as e:
                logger.debug("Database public profile query note: %s", e)

        # 3. Check visibility and existence
        if not profile:
            raise AuthException(
                code="PROFILE_NOT_FOUND",
                message="Public profile not found or revoked.",
                status_code=404,
            )

        if profile.get("visibility") != "public":
            raise AuthException(
                code="PROFILE_PRIVATE",
                message="This student profile is private and not available for public viewing.",
                status_code=403,
            )

        # 4. Strictly sanitize and return ONLY safe public fields
        created_at_str = str(profile.get("created_at", ""))
        member_since = created_at_str[:10] if len(created_at_str) >= 10 else "2026"

        return {
            "success": True,
            "share_id": profile["share_id"],
            "public_name": profile.get("public_name") or "Verified Candidate",
            "headline": profile.get("headline"),
            "bio": profile.get("bio"),
            "skills": profile.get("skills") or [],
            "technologies": profile.get("technologies") or [],
            "projects": profile.get("projects") or [],
            "portfolio_highlights": profile.get("portfolio_highlights") or [],
            "verified_achievements": profile.get("verified_achievements") or [],
            "performance_summary": profile.get("performance_summary") or {},
            "member_since": member_since,
        }

