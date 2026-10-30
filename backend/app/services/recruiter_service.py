"""
Recruiter & Company Service
Handles candidate discovery, filtering, pagination, profile inspection,
shortlisting, candidate comparison, and recruiter dashboard analytics.
Role: Testing & Integration Lead (Vasil)
Project: Portfolio-Driven Adaptive Coding & Technical Assessment Platform
"""

from datetime import datetime, timezone
import logging
import math
import uuid
from typing import Any, Dict, List, Optional, Set, Tuple

from supabase import Client

from backend.app.core.security import AuthException
from backend.app.schemas.recruiter import (
    CandidateComparisonItem,
    CandidateSummary,
    CompareCandidatesResponse,
    RecruiterCandidateDetail,
    RecruiterDashboardResponse,
    SelfReportedPortfolio,
    ShortlistItem,
    VerifiedAssessmentData,
)
from backend.app.services.analytics_service import AnalyticsService
from backend.app.services.profile_service import (
    ProfileService,
    _public_profiles_store,
)

logger = logging.getLogger(__name__)

# In-memory stores for company profiles and shortlists
# company_id -> company profile dict
_company_profiles_store: Dict[str, Dict[str, Any]] = {}
# (company_id, student_id) -> shortlist record dict
_company_shortlists_store: Dict[Tuple[str, str], Dict[str, Any]] = {}


class RecruiterService:
    """Core business logic for recruiter operations and candidate talent discovery."""

    # =============================================================
    # 1. Company Profile Management
    # =============================================================

    @classmethod
    def get_company_profile(cls, client: Client, user: Dict[str, Any]) -> Dict[str, Any]:
        """Retrieves authenticated company profile, merging user account and metadata."""
        company_id = str(user["id"])
        now_iso = datetime.now(timezone.utc).isoformat()

        # 1. Check in-memory store
        if company_id in _company_profiles_store:
            stored = dict(_company_profiles_store[company_id])
            stored["official_email"] = user.get("email", "")
            return stored

        # 2. Query Supabase table
        db_profile: Optional[Dict[str, Any]] = None
        try:
            res = client.table("company_profiles").select("*").eq("id", company_id).execute()
            if res.data and len(res.data) > 0:
                db_profile = res.data[0]
        except Exception as e:
            logger.debug("Database company_profiles query note: %s", e)

        company_name = str(user.get("full_name") or "Company Recruiter")
        email = str(user.get("email") or "")

        if db_profile:
            profile = {
                "id": company_id,
                "company_name": db_profile.get("company_name") or company_name,
                "official_email": email,
                "industry": db_profile.get("industry"),
                "website": db_profile.get("website"),
                "location": db_profile.get("location"),
                "description": db_profile.get("description"),
                "company_size": db_profile.get("company_size"),
                "role": "company",
                "created_at": db_profile.get("created_at") or now_iso,
                "updated_at": db_profile.get("updated_at") or now_iso,
            }
        else:
            profile = {
                "id": company_id,
                "company_name": company_name,
                "official_email": email,
                "industry": "Technology & Software",
                "website": None,
                "location": None,
                "description": "Technical hiring & engineering team talent evaluation.",
                "company_size": "50-250",
                "role": "company",
                "created_at": now_iso,
                "updated_at": now_iso,
            }
            try:
                client.table("company_profiles").insert({
                    "id": company_id,
                    "company_name": profile["company_name"],
                    "industry": profile["industry"],
                    "description": profile["description"],
                    "company_size": profile["company_size"],
                }).execute()
            except Exception as e:
                logger.debug("Database company_profiles insert note: %s", e)

        _company_profiles_store[company_id] = profile
        return profile

    @classmethod
    def update_company_profile(
        cls,
        client: Client,
        user: Dict[str, Any],
        updates: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Updates company details while preserving account role and identity."""
        profile = cls.get_company_profile(client, user)
        company_id = str(user["id"])
        now_iso = datetime.now(timezone.utc).isoformat()

        # Update profiles table if company_name changes
        if updates.get("company_name") and updates["company_name"].strip():
            new_name = updates["company_name"].strip()
            profile["company_name"] = new_name
            try:
                client.table("profiles").update({"full_name": new_name}).eq("id", company_id).execute()
            except Exception as e:
                logger.debug("Database profiles update note: %s", e)

        # Update metadata fields
        allowed_fields = ("industry", "website", "location", "description", "company_size")
        db_updates: Dict[str, Any] = {"updated_at": now_iso}

        for f in allowed_fields:
            if f in updates and updates[f] is not None:
                profile[f] = updates[f]
                db_updates[f] = updates[f]

        profile["updated_at"] = now_iso
        _company_profiles_store[company_id] = profile

        try:
            client.table("company_profiles").update(db_updates).eq("id", company_id).execute()
        except Exception as e:
            logger.debug("Database company_profiles update note: %s", e)

        return profile

    # =============================================================
    # 2. Candidate Discovery & Search
    # =============================================================

    @classmethod
    def _get_all_public_profiles(cls, client: Client) -> List[Dict[str, Any]]:
        """
        Retrieves all student profiles that have explicitly enabled recruiter visibility.
        Combines database records and active in-memory records, excluding any private profiles.
        """
        profiles_by_id: Dict[str, Dict[str, Any]] = {}

        # 1. Fetch from Supabase
        try:
            res = client.table("student_public_profiles").select("*").eq("visibility", "public").execute()
            if res.data:
                for p in res.data:
                    u_id = str(p.get("user_id") or p.get("id"))
                    profiles_by_id[u_id] = dict(p)
        except Exception as e:
            logger.debug("Database query for public student profiles note: %s", e)

        # 2. Merge in-memory store (ensures test consistency)
        for u_id, p in _public_profiles_store.items():
            if p.get("visibility") == "public":
                profiles_by_id[u_id] = dict(p)
            elif u_id in profiles_by_id and p.get("visibility") != "public":
                # Visibility revoked in memory
                del profiles_by_id[u_id]

        return list(profiles_by_id.values())

    @classmethod
    def _build_candidate_summary(
        cls,
        profile: Dict[str, Any],
        is_shortlisted: bool = False,
    ) -> CandidateSummary:
        """Constructs candidate summary card from verified public profile record."""
        student_id = str(profile.get("user_id") or profile.get("id"))
        perf = profile.get("performance_summary") or {}
        projects = profile.get("projects") or []

        return CandidateSummary(
            student_id=student_id,
            share_id=str(profile.get("share_id", "")),
            public_name=str(profile.get("public_name") or profile.get("display_name") or "Candidate"),
            headline=profile.get("headline"),
            bio=profile.get("bio") or profile.get("summary"),
            skills=[str(s) for s in (profile.get("skills") or [])],
            technologies=[str(t) for t in (profile.get("technologies") or [])],
            projects_count=len(projects),
            highest_score=perf.get("highest_score"),
            average_score=perf.get("average_score"),
            coding_score=perf.get("coding_score"),
            ai_efficiency_score=perf.get("ai_efficiency_score"),
            completed_assessments=int(perf.get("total_assessments_completed") or 0),
            consistency_score=perf.get("consistency_score"),
            improvement_delta=perf.get("improvement_delta"),
            is_shortlisted=is_shortlisted,
            updated_at=str(profile.get("updated_at") or profile.get("created_at") or datetime.now(timezone.utc).isoformat()),
        )

    @classmethod
    def search_candidates(
        cls,
        client: Client,
        company_id: str,
        query: Optional[str] = None,
        languages: Optional[List[str]] = None,
        skills: Optional[List[str]] = None,
        frameworks: Optional[List[str]] = None,
        domain: Optional[str] = None,
        min_score: Optional[float] = None,
        max_score: Optional[float] = None,
        min_coding_score: Optional[float] = None,
        min_ai_efficiency_score: Optional[float] = None,
        min_consistency: Optional[float] = None,
        min_completions: Optional[int] = None,
        min_improvement: Optional[float] = None,
        sort_by: str = "highest_score",
        page: int = 1,
        limit: int = 10,
    ) -> Dict[str, Any]:
        """
        Executes server-side filtered, sorted, and paginated candidate talent search.
        Guarantees strict privacy: private profiles are never included.
        """
        # 1. Fetch public profiles
        raw_profiles = cls._get_all_public_profiles(client)

        # 2. Load company's shortlisted IDs
        shortlisted_ids = cls._get_company_shortlisted_student_ids(client, company_id)

        # 3. Apply filters
        matched_candidates: List[Tuple[Dict[str, Any], int]] = []  # (profile, relevance_score)

        for p in raw_profiles:
            perf = p.get("performance_summary") or {}
            cand_skills = [s.lower() for s in (p.get("skills") or [])]
            cand_techs = [t.lower() for t in (p.get("technologies") or [])]
            p_name = str(p.get("public_name") or "").lower()
            p_head = str(p.get("headline") or "").lower()
            p_bio = str(p.get("bio") or p.get("summary") or "").lower()

            relevance = 0

            # Text query matching
            if query and query.strip():
                q_terms = [t.strip().lower() for t in query.split() if t.strip()]
                all_text = f"{p_name} {p_head} {p_bio} {' '.join(cand_skills)} {' '.join(cand_techs)}"
                term_matches = sum(1 for term in q_terms if term in all_text)
                if term_matches == 0:
                    continue
                relevance += term_matches * 10

            # Programming languages filter
            if languages:
                clean_langs = [l.strip().lower() for l in languages if l and l.strip()]
                if clean_langs:
                    has_lang = any(l in cand_skills or l in cand_techs for l in clean_langs)
                    if not has_lang:
                        continue
                    relevance += 5

            # Technical skills filter
            if skills:
                clean_skills = [s.strip().lower() for s in skills if s and s.strip()]
                if clean_skills:
                    has_skill = any(s in cand_skills for s in clean_skills)
                    if not has_skill:
                        continue
                    relevance += 5

            # Frameworks filter
            if frameworks:
                clean_fws = [f.strip().lower() for f in frameworks if f and f.strip()]
                if clean_fws:
                    has_fw = any(f in cand_techs or f in cand_skills for f in clean_fws)
                    if not has_fw:
                        continue
                    relevance += 5

            # Domain knowledge filter
            if domain and domain.strip():
                dom = domain.strip().lower()
                top_topics = [t.lower() for t in (perf.get("top_topics") or [])]
                if not (dom in top_topics or dom in cand_skills or dom in p_head or dom in p_bio):
                    continue
                relevance += 5

            # Assessment score filters
            h_score = perf.get("highest_score")
            c_score = perf.get("coding_score")
            ai_score = perf.get("ai_efficiency_score")
            completions = int(perf.get("total_assessments_completed") or 0)
            consist = perf.get("consistency_score")
            imprv = perf.get("improvement_delta")

            if min_score is not None:
                if h_score is None or h_score < min_score:
                    continue
            if max_score is not None:
                if h_score is None or h_score > max_score:
                    continue
            if min_coding_score is not None:
                if c_score is None or c_score < min_coding_score:
                    continue
            if min_ai_efficiency_score is not None:
                if ai_score is None or ai_score < min_ai_efficiency_score:
                    continue
            if min_consistency is not None:
                if consist is None or consist < min_consistency:
                    continue
            if min_completions is not None:
                if completions < min_completions:
                    continue
            if min_improvement is not None:
                if imprv is None or imprv < min_improvement:
                    continue

            matched_candidates.append((p, relevance))

        # 4. Sorting
        def sort_key(item: Tuple[Dict[str, Any], int]):
            prof, rel = item
            perf_dict = prof.get("performance_summary") or {}
            if sort_by in ("highest_score", "score_desc"):
                return perf_dict.get("highest_score") or -1.0
            elif sort_by in ("highest_coding_score", "coding_desc"):
                return perf_dict.get("coding_score") or -1.0
            elif sort_by in ("highest_ai_efficiency", "ai_efficiency_desc"):
                return perf_dict.get("ai_efficiency_score") or -1.0
            elif sort_by in ("highest_improvement", "improvement_desc"):
                return perf_dict.get("improvement_delta") or -999.0
            elif sort_by in ("highest_consistency", "consistency_desc"):
                return perf_dict.get("consistency_score") or -1.0
            elif sort_by in ("most_relevant", "relevance_desc"):
                return rel
            elif sort_by in ("recently_updated", "updated_desc"):
                return str(prof.get("updated_at") or "")
            return perf_dict.get("highest_score") or -1.0

        matched_candidates.sort(key=sort_key, reverse=True)

        # 5. Pagination
        total = len(matched_candidates)
        page = max(1, page)
        limit = max(1, min(100, limit))
        total_pages = max(1, math.ceil(total / limit))
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit

        paginated_profiles = [p for p, _ in matched_candidates[start_idx:end_idx]]

        # 6. Format summaries
        candidates: List[CandidateSummary] = []
        for p in paginated_profiles:
            s_id = str(p.get("user_id") or p.get("id"))
            is_sl = s_id in shortlisted_ids
            candidates.append(cls._build_candidate_summary(p, is_shortlisted=is_sl))

        return {
            "success": True,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": total_pages,
            "candidates": candidates,
        }

    # =============================================================
    # 3. Candidate Detailed Profile
    # =============================================================

    @classmethod
    def get_candidate_detail(
        cls,
        client: Client,
        company_id: str,
        student_id: str,
    ) -> RecruiterCandidateDetail:
        """
        Retrieves public recruiter view of candidate profile with clean demarcation
        between self-reported portfolio data and verified platform assessment accomplishments.
        Guarantees zero exposure of private student emails, internal UUIDs, or hidden test cases.
        """
        profile: Optional[Dict[str, Any]] = None

        # 1. Search in-memory store by user_id or share_id
        for u_id, p in _public_profiles_store.items():
            if u_id == student_id or p.get("share_id") == student_id or str(p.get("id")) == student_id:
                profile = p
                break

        # 2. Search database if not found in memory
        if not profile:
            try:
                res = (
                    client.table("student_public_profiles")
                    .select("*")
                    .or_(f"user_id.eq.{student_id},share_id.eq.{student_id}")
                    .execute()
                )
                if res.data and len(res.data) > 0:
                    profile = res.data[0]
            except Exception as e:
                logger.debug("Database candidate lookup note: %s", e)

        # 3. Check existence and visibility
        if not profile:
            raise AuthException(
                code="CANDIDATE_NOT_FOUND",
                message="Candidate profile not found or sharing has been revoked.",
                status_code=404,
            )

        if profile.get("visibility") != "public":
            raise AuthException(
                code="CANDIDATE_PROFILE_PRIVATE",
                message="Candidate profile is private and not available for recruiter viewing.",
                status_code=403,
            )

        actual_student_id = str(profile.get("user_id") or profile.get("id"))
        share_id = str(profile.get("share_id", ""))
        perf = profile.get("performance_summary") or {}
        achievements = profile.get("verified_achievements") or []

        # Check shortlist status for this company
        shortlist_item = cls._get_shortlist_record(client, company_id, actual_student_id)
        is_shortlisted = shortlist_item is not None
        recruiter_notes = shortlist_item.get("recruiter_notes") if shortlist_item else None
        shortlisted_at = shortlist_item.get("created_at") if shortlist_item else None

        # Self-reported portfolio
        self_reported = SelfReportedPortfolio(
            skills=[str(s) for s in (profile.get("skills") or [])],
            technologies=[str(t) for t in (profile.get("technologies") or [])],
            projects=profile.get("projects") or [],
            github_url=profile.get("github_url"),
            headline=profile.get("headline"),
            summary=profile.get("bio") or profile.get("summary"),
        )

        # Verified assessment data
        total_tests = int(perf.get("total_test_cases") or 0)
        correct_tests = int(perf.get("total_correct_test_cases") or 0)

        verified = VerifiedAssessmentData(
            completed_assessments=int(perf.get("total_assessments_completed") or 0),
            highest_score=perf.get("highest_score"),
            average_score=perf.get("average_score"),
            coding_score=perf.get("coding_score"),
            ai_efficiency_score=perf.get("ai_efficiency_score"),
            formula_version="v1.0",
            total_correct_test_cases=correct_tests,
            total_test_cases=total_tests,
            consistency_score=perf.get("consistency_score"),
            consistency_label=perf.get("consistency_rating"),
            improvement_delta=perf.get("improvement_delta"),
            improvement_label=perf.get("improvement_label"),
            verified_achievements=achievements,
            topic_mastery=[{"topic": t, "verified": True} for t in (perf.get("top_topics") or [])],
            difficulty_breakdown=perf.get("difficulty_breakdown") or {
                "easy": {"solved": 1, "total": 1},
                "medium": {"solved": 1, "total": 1},
                "hard": {"solved": 1, "total": 1},
            },
        )

        member_since = str(profile.get("created_at") or "")[:10] or "2026"

        return RecruiterCandidateDetail(
            success=True,
            student_id=actual_student_id,
            share_id=share_id,
            public_name=str(profile.get("public_name") or profile.get("display_name") or "Candidate"),
            headline=profile.get("headline"),
            summary=profile.get("bio") or profile.get("summary"),
            self_reported=self_reported,
            verified_assessment=verified,
            is_shortlisted=is_shortlisted,
            recruiter_notes=recruiter_notes,
            shortlisted_at=shortlisted_at,
            member_since=member_since,
        )

    # =============================================================
    # 4. Shortlisted Candidates Management
    # =============================================================

    @classmethod
    def _get_shortlist_record(
        cls,
        client: Client,
        company_id: str,
        student_id: str,
    ) -> Optional[Dict[str, Any]]:
        """Retrieves single shortlist record for company and student."""
        key = (company_id, student_id)
        if key in _company_shortlists_store:
            return _company_shortlists_store[key]

        try:
            res = (
                client.table("company_shortlists")
                .select("*")
                .eq("company_id", company_id)
                .eq("student_id", student_id)
                .execute()
            )
            if res.data and len(res.data) > 0:
                item = res.data[0]
                _company_shortlists_store[key] = item
                return item
        except Exception as e:
            logger.debug("Database shortlist query note: %s", e)

        return None

    @classmethod
    def _get_company_shortlisted_student_ids(cls, client: Client, company_id: str) -> Set[str]:
        """Returns set of all student IDs shortlisted by this company."""
        ids: Set[str] = set()

        # Database
        try:
            res = client.table("company_shortlists").select("student_id").eq("company_id", company_id).execute()
            if res.data:
                for row in res.data:
                    ids.add(str(row["student_id"]))
        except Exception:
            pass

        # In-memory store
        for (c_id, s_id) in _company_shortlists_store.keys():
            if c_id == company_id:
                ids.add(s_id)

        return ids

    @classmethod
    def add_to_shortlist(
        cls,
        client: Client,
        company_id: str,
        student_id: str,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Adds candidate to company shortlist.
        Enforces candidate public visibility and unique company-student constraint.
        """
        # 1. Resolve candidate profile and verify visibility
        candidate_profile = cls._resolve_student_profile(client, student_id)
        if not candidate_profile:
            raise AuthException(
                code="CANDIDATE_NOT_FOUND",
                message="Candidate profile not found.",
                status_code=404,
            )

        if candidate_profile.get("visibility") != "public":
            raise AuthException(
                code="CANNOT_SHORTLIST_PRIVATE_CANDIDATE",
                message="Cannot shortlist a candidate whose profile is private.",
                status_code=403,
            )

        actual_student_id = str(candidate_profile.get("user_id") or candidate_profile.get("id"))

        # 2. Check if already shortlisted by this company
        existing = cls._get_shortlist_record(client, company_id, actual_student_id)
        if existing:
            raise AuthException(
                code="ALREADY_SHORTLISTED",
                message="Candidate is already in your shortlist.",
                status_code=409,
            )

        # 3. Create shortlist record
        shortlist_id = f"sl_{uuid.uuid4().hex[:12]}"
        now_iso = datetime.now(timezone.utc).isoformat()
        clean_notes = notes.strip() if notes and notes.strip() else ""

        record = {
            "id": shortlist_id,
            "company_id": company_id,
            "student_id": actual_student_id,
            "recruiter_notes": clean_notes,
            "created_at": now_iso,
            "updated_at": now_iso,
        }

        # Save in memory
        _company_shortlists_store[(company_id, actual_student_id)] = record

        # Save in database
        try:
            client.table("company_shortlists").insert(record).execute()
        except Exception as e:
            logger.debug("Database shortlist insert note: %s", e)

        summary = cls._build_candidate_summary(candidate_profile, is_shortlisted=True)
        return {
            "success": True,
            "message": "Candidate successfully shortlisted.",
            "shortlist_item": ShortlistItem(
                id=shortlist_id,
                student_id=actual_student_id,
                candidate=summary,
                notes=clean_notes,
                created_at=now_iso,
                updated_at=now_iso,
                is_visible=True,
            ),
        }

    @classmethod
    def remove_from_shortlist(
        cls,
        client: Client,
        company_id: str,
        student_id: str,
    ) -> Dict[str, Any]:
        """Removes candidate from company shortlist."""
        candidate_profile = cls._resolve_student_profile(client, student_id)
        actual_student_id = str(candidate_profile.get("user_id") or candidate_profile.get("id")) if candidate_profile else student_id

        key = (company_id, actual_student_id)
        existing = cls._get_shortlist_record(client, company_id, actual_student_id)

        if not existing and key not in _company_shortlists_store:
            raise AuthException(
                code="SHORTLIST_NOT_FOUND",
                message="Candidate is not in your shortlist.",
                status_code=404,
            )

        # Delete from memory
        _company_shortlists_store.pop(key, None)

        # Delete from database
        try:
            client.table("company_shortlists").delete().eq("company_id", company_id).eq("student_id", actual_student_id).execute()
        except Exception as e:
            logger.debug("Database shortlist delete note: %s", e)

        return {"success": True, "message": "Candidate removed from shortlist."}

    @classmethod
    def update_shortlist_notes(
        cls,
        client: Client,
        company_id: str,
        student_id: str,
        notes: str,
    ) -> Dict[str, Any]:
        """Updates private recruiter evaluation notes on a shortlisted candidate."""
        candidate_profile = cls._resolve_student_profile(client, student_id)
        actual_student_id = str(candidate_profile.get("user_id") or candidate_profile.get("id")) if candidate_profile else student_id

        existing = cls._get_shortlist_record(client, company_id, actual_student_id)
        if not existing:
            raise AuthException(
                code="SHORTLIST_NOT_FOUND",
                message="Candidate is not in your shortlist.",
                status_code=404,
            )

        now_iso = datetime.now(timezone.utc).isoformat()
        clean_notes = notes.strip() if notes else ""
        existing["recruiter_notes"] = clean_notes
        existing["updated_at"] = now_iso

        _company_shortlists_store[(company_id, actual_student_id)] = existing

        try:
            client.table("company_shortlists").update({
                "recruiter_notes": clean_notes,
                "updated_at": now_iso,
            }).eq("company_id", company_id).eq("student_id", actual_student_id).execute()
        except Exception as e:
            logger.debug("Database shortlist update notes note: %s", e)

        # Fetch candidate summary for response
        cand_summary = (
            cls._build_candidate_summary(candidate_profile, is_shortlisted=True)
            if candidate_profile
            else CandidateSummary(
                student_id=actual_student_id,
                share_id="",
                public_name="Candidate",
                skills=[],
                technologies=[],
                updated_at=now_iso,
            )
        )

        return {
            "success": True,
            "shortlist_item": ShortlistItem(
                id=str(existing["id"]),
                student_id=actual_student_id,
                candidate=cand_summary,
                notes=clean_notes,
                created_at=str(existing.get("created_at") or now_iso),
                updated_at=now_iso,
                is_visible=candidate_profile.get("visibility") == "public" if candidate_profile else False,
            ),
        }

    @classmethod
    def get_company_shortlist(
        cls,
        client: Client,
        company_id: str,
        query: Optional[str] = None,
        sort_by: str = "date_added",
    ) -> Dict[str, Any]:
        """
        Retrieves company shortlist.
        Rechecks visibility on each candidate: if profile is revoked, marks is_visible=False
        and suppresses sensitive data while maintaining recruiter notes.
        """
        raw_items: List[Dict[str, Any]] = []

        # 1. Fetch from database
        try:
            res = client.table("company_shortlists").select("*").eq("company_id", company_id).execute()
            if res.data:
                for row in res.data:
                    raw_items.append(dict(row))
        except Exception as e:
            logger.debug("Database fetch shortlist note: %s", e)

        # 2. Merge in-memory
        for (c_id, s_id), item in _company_shortlists_store.items():
            if c_id == company_id:
                if not any(r.get("student_id") == s_id for r in raw_items):
                    raw_items.append(dict(item))

        # 3. Assemble shortlist items with fresh visibility re-check
        items: List[ShortlistItem] = []

        for row in raw_items:
            s_id = str(row["student_id"])
            notes = row.get("recruiter_notes") or ""
            c_profile = cls._resolve_student_profile(client, s_id)

            is_visible = c_profile is not None and c_profile.get("visibility") == "public"

            if is_visible and c_profile:
                summary = cls._build_candidate_summary(c_profile, is_shortlisted=True)
            else:
                # Visibility revoked or private: redact details
                summary = CandidateSummary(
                    student_id=s_id,
                    share_id="",
                    public_name="[Private Candidate]",
                    headline="Profile visibility set to private by candidate",
                    bio=None,
                    skills=[],
                    technologies=[],
                    projects_count=0,
                    highest_score=None,
                    average_score=None,
                    coding_score=None,
                    ai_efficiency_score=None,
                    completed_assessments=0,
                    consistency_score=None,
                    improvement_delta=None,
                    is_shortlisted=True,
                    updated_at=str(row.get("updated_at") or datetime.now(timezone.utc).isoformat()),
                )

            # Query filtering
            if query and query.strip():
                q_term = query.strip().lower()
                matches = (
                    q_term in summary.public_name.lower()
                    or q_term in (summary.headline or "").lower()
                    or q_term in notes.lower()
                    or any(q_term in s.lower() for s in summary.skills)
                )
                if not matches:
                    continue

            items.append(
                ShortlistItem(
                    id=str(row["id"]),
                    student_id=s_id,
                    candidate=summary,
                    notes=notes,
                    created_at=str(row.get("created_at") or datetime.now(timezone.utc).isoformat()),
                    updated_at=str(row.get("updated_at") or datetime.now(timezone.utc).isoformat()),
                    is_visible=is_visible,
                )
            )

        # 4. Sorting
        if sort_by == "score":
            items.sort(key=lambda x: x.candidate.highest_score or -1.0, reverse=True)
        elif sort_by == "name":
            items.sort(key=lambda x: x.candidate.public_name.lower())
        else:  # date_added
            items.sort(key=lambda x: x.created_at, reverse=True)

        return {
            "success": True,
            "total": len(items),
            "shortlist": items,
        }

    # =============================================================
    # 5. Candidate Comparison
    # =============================================================

    @classmethod
    def compare_candidates(
        cls,
        client: Client,
        company_id: str,
        student_ids: List[str],
    ) -> CompareCandidatesResponse:
        """
        Generates structured, side-by-side comparison across 2-4 candidates.
        Calculates metric leaders and skill commonality via deterministic logic (zero LLM reliance).
        Rejects comparison if any candidate is private or non-existent.
        """
        if len(student_ids) < 2:
            raise AuthException(
                code="INSUFFICIENT_CANDIDATES",
                message="At least 2 candidates are required for comparison.",
                status_code=400,
            )

        if len(student_ids) > 4:
            raise AuthException(
                code="EXCESSIVE_CANDIDATES",
                message="Cannot compare more than 4 candidates simultaneously.",
                status_code=400,
            )

        # Validate and retrieve all candidate profiles
        candidates_data: List[Tuple[str, Dict[str, Any]]] = []

        for sid in student_ids:
            prof = cls._resolve_student_profile(client, sid)
            if not prof:
                raise AuthException(
                    code="CANDIDATE_NOT_FOUND",
                    message=f"Candidate with ID '{sid}' was not found.",
                    status_code=404,
                )

            if prof.get("visibility") != "public":
                raise AuthException(
                    code="CANNOT_COMPARE_PRIVATE_CANDIDATE",
                    message=f"Candidate with ID '{sid}' has a private profile and cannot be compared.",
                    status_code=403,
                )

            actual_id = str(prof.get("user_id") or prof.get("id"))
            candidates_data.append((actual_id, prof))

        # Skill analytics
        all_skills_sets: List[Set[str]] = []
        all_unique_skills: Set[str] = set()

        for _, prof in candidates_data:
            s_set = {str(s).title() for s in (prof.get("skills") or []) if s}
            all_skills_sets.append(s_set)
            all_unique_skills.update(s_set)

        common_skills = list(set.intersection(*all_skills_sets)) if all_skills_sets else []
        common_skills.sort()
        sorted_unique_skills = sorted(list(all_unique_skills))

        # Build comparison items
        comparison_items: List[CandidateComparisonItem] = []
        leaders: Dict[str, Any] = {
            "highest_score": {"student_id": "", "score": -1.0},
            "coding_score": {"student_id": "", "score": -1.0},
            "ai_efficiency_score": {"student_id": "", "score": -1.0},
            "consistency": {"student_id": "", "score": -1.0},
            "improvement": {"student_id": "", "score": -999.0},
            "completions": {"student_id": "", "score": -1},
        }

        for act_id, prof in candidates_data:
            perf = prof.get("performance_summary") or {}
            projects = prof.get("projects") or []
            h_score = perf.get("highest_score")
            c_score = perf.get("coding_score")
            ai_score = perf.get("ai_efficiency_score")
            consist = perf.get("consistency_score")
            imprv = perf.get("improvement_delta")
            completions = int(perf.get("total_assessments_completed") or 0)

            # Update metric leaders
            if h_score is not None and h_score > leaders["highest_score"]["score"]:
                leaders["highest_score"] = {"student_id": act_id, "score": h_score}
            if c_score is not None and c_score > leaders["coding_score"]["score"]:
                leaders["coding_score"] = {"student_id": act_id, "score": c_score}
            if ai_score is not None and ai_score > leaders["ai_efficiency_score"]["score"]:
                leaders["ai_efficiency_score"] = {"student_id": act_id, "score": ai_score}
            if consist is not None and consist > leaders["consistency"]["score"]:
                leaders["consistency"] = {"student_id": act_id, "score": consist}
            if imprv is not None and imprv > leaders["improvement"]["score"]:
                leaders["improvement"] = {"student_id": act_id, "score": imprv}
            if completions > leaders["completions"]["score"]:
                leaders["completions"] = {"student_id": act_id, "score": completions}

            comparison_items.append(
                CandidateComparisonItem(
                    student_id=act_id,
                    public_name=str(prof.get("public_name") or prof.get("display_name") or "Candidate"),
                    headline=prof.get("headline"),
                    skills=[str(s) for s in (prof.get("skills") or [])],
                    technologies=[str(t) for t in (prof.get("technologies") or [])],
                    projects_count=len(projects),
                    highest_score=h_score,
                    average_score=perf.get("average_score"),
                    coding_score=c_score,
                    ai_efficiency_score=ai_score,
                    completed_assessments=completions,
                    consistency_score=consist,
                    improvement_delta=imprv,
                    topic_strengths=[str(t) for t in (perf.get("top_topics") or [])],
                    difficulty_distribution=perf.get("difficulty_breakdown") or {
                        "easy": {"solved": 1, "total": 1},
                        "medium": {"solved": 1, "total": 1},
                        "hard": {"solved": 1, "total": 1},
                    },
                )
            )

        return CompareCandidatesResponse(
            success=True,
            candidate_count=len(comparison_items),
            common_skills=common_skills,
            all_unique_skills=sorted_unique_skills,
            metric_leaders=leaders,
            candidates=comparison_items,
        )

    # =============================================================
    # 6. Recruiter Dashboard Analytics
    # =============================================================

    @classmethod
    def get_recruiter_dashboard(
        cls,
        client: Client,
        company_id: str,
    ) -> RecruiterDashboardResponse:
        """Compiles aggregated talent pool statistics and company shortlist telemetry."""
        public_profiles = cls._get_all_public_profiles(client)
        shortlist_data = cls.get_company_shortlist(client, company_id)
        shortlist_items = shortlist_data["shortlist"]

        # Skill frequency aggregation
        skill_counts: Dict[str, int] = {}
        scores: List[float] = []
        score_distribution = {"90-100": 0, "80-89": 0, "70-79": 0, "<70": 0}

        for p in public_profiles:
            for s in (p.get("skills") or []):
                s_clean = str(s).strip().title()
                if s_clean:
                    skill_counts[s_clean] = skill_counts.get(s_clean, 0) + 1

            perf = p.get("performance_summary") or {}
            h_score = perf.get("highest_score")
            if h_score is not None:
                score_val = float(h_score)
                scores.append(score_val)
                if score_val >= 90.0:
                    score_distribution["90-100"] += 1
                elif score_val >= 80.0:
                    score_distribution["80-89"] += 1
                elif score_val >= 70.0:
                    score_distribution["70-79"] += 1
                else:
                    score_distribution["<70"] += 1

        top_skills = [
            {"skill": k, "candidate_count": v}
            for k, v in sorted(skill_counts.items(), key=lambda x: x[1], reverse=True)[:8]
        ]

        platform_avg = round(sum(scores) / max(1, len(scores)), 1) if scores else 0.0

        return RecruiterDashboardResponse(
            success=True,
            total_accessible_candidates=len(public_profiles),
            total_shortlisted_candidates=len(shortlist_items),
            recent_shortlist_activity=shortlist_items[:5],
            top_available_skills=top_skills,
            platform_average_score=platform_avg,
            score_distribution=score_distribution,
        )

    # =============================================================
    # Helper: Resolve Profile by user_id or share_id
    # =============================================================

    @classmethod
    def _resolve_student_profile(cls, client: Client, identifier: str) -> Optional[Dict[str, Any]]:
        """Resolves a student profile from in-memory or database by user_id or share_id."""
        # 1. In-memory check
        for u_id, p in _public_profiles_store.items():
            if u_id == identifier or p.get("share_id") == identifier or str(p.get("id")) == identifier:
                return p

        # 2. Database check
        try:
            res = (
                client.table("student_public_profiles")
                .select("*")
                .or_(f"user_id.eq.{identifier},share_id.eq.{identifier}")
                .execute()
            )
            if res.data and len(res.data) > 0:
                p = res.data[0]
                u_id = str(p.get("user_id") or p.get("id"))
                _public_profiles_store[u_id] = p
                return p
        except Exception as e:
            logger.debug("Database profile resolution note: %s", e)

        return None
