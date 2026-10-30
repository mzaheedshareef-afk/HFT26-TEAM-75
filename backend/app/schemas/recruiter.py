"""
Pydantic Schemas for Recruiter & Company Discovery, Shortlisting and Comparison.
Role: Testing & Integration Lead (Vasil)
Project: Portfolio-Driven Adaptive Coding & Technical Assessment Platform
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, model_validator


# =============================================================
# 1. Company Profile Schemas
# =============================================================

class CompanyProfileResponse(BaseModel):
    id: str
    company_id: Optional[str] = None
    company_name: str
    official_email: str
    industry: Optional[str] = None
    website: Optional[str] = None
    website_url: Optional[str] = None
    location: Optional[str] = None
    headquarters: Optional[str] = None
    description: Optional[str] = None
    company_size: Optional[str] = None
    hiring_domains: List[str] = Field(default_factory=list)
    target_roles: List[str] = Field(default_factory=list)
    preferred_languages: List[str] = Field(default_factory=list)
    default_discovery_view: str = "cards"
    notification_preferences: Dict[str, bool] = Field(
        default_factory=lambda: {
            "shortlist_alerts": True,
            "weekly_talent_digest": True,
            "assessment_completion_updates": True,
        }
    )
    role: str = "company"
    created_at: str
    updated_at: str

    @model_validator(mode="after")
    def populate_aliases(self):
        if not self.company_id:
            self.company_id = self.id
        if not self.website_url:
            self.website_url = self.website or ""
        if not self.headquarters:
            self.headquarters = self.location or ""
        return self


class UpdateCompanyProfileRequest(BaseModel):
    company_name: Optional[str] = Field(None, min_length=2, max_length=120)
    name: Optional[str] = Field(None, max_length=120)
    industry: Optional[str] = Field(None, max_length=100)
    website: Optional[str] = Field(None, max_length=200)
    website_url: Optional[str] = Field(None, max_length=200)
    location: Optional[str] = Field(None, max_length=100)
    headquarters: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    company_size: Optional[str] = Field(None, max_length=50)
    hiring_domains: Optional[List[str]] = None
    target_roles: Optional[List[str]] = None
    preferred_languages: Optional[List[str]] = None

    @model_validator(mode="after")
    def sync_name_and_location(self):
        if not self.company_name and self.name:
            self.company_name = self.name
        if not self.location and self.headquarters:
            self.location = self.headquarters
        if not self.website and self.website_url:
            self.website = self.website_url
        return self


class CompanySettingsUpdateRequest(BaseModel):
    default_discovery_view: Optional[str] = "cards"
    notification_preferences: Optional[Dict[str, bool]] = None


# =============================================================
# 2. Candidate Discovery Schemas
# =============================================================

class CandidateSummary(BaseModel):
    student_id: str
    candidate_id: Optional[str] = None
    share_id: str
    public_name: str
    display_name: Optional[str] = None
    headline: Optional[str] = None
    bio: Optional[str] = None
    summary: Optional[str] = None
    experience_level: Optional[str] = "2 Years Experience"
    skills: List[str] = Field(default_factory=list)
    technical_skills: List[str] = Field(default_factory=list)
    programming_languages: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)
    frameworks: List[str] = Field(default_factory=list)
    domains: List[str] = Field(default_factory=list)
    projects_count: int = 0
    projects: List[Dict[str, Any]] = Field(default_factory=list)
    portfolio_available: bool = True
    portfolio_github_url: Optional[str] = None
    portfolio_highlights: List[str] = Field(default_factory=list)
    highest_score: Optional[float] = None
    average_score: Optional[float] = None
    overall_score: Optional[float] = None
    coding_score: Optional[float] = None
    ai_efficiency_score: Optional[float] = None
    completed_assessments: int = 0
    assessments_completed: int = 0
    difficulty_level: str = "Medium"
    consistency_score: Optional[float] = None
    consistency_label: str = "Solid"
    improvement_delta: Optional[float] = None
    improvement_trend: str = "steady"
    improvement_label: str = "+0.0%"
    topic_performance: List[Any] = Field(default_factory=list)
    difficulty_performance: List[Any] = Field(default_factory=list)
    verified_achievements: List[Any] = Field(default_factory=list)
    is_shortlisted: bool = False
    updated_at: str

    @model_validator(mode="after")
    def sync_aliases(self):
        if not self.candidate_id:
            self.candidate_id = self.student_id
        if not self.display_name:
            self.display_name = self.public_name
        if not self.summary:
            self.summary = self.bio or ""
        if not self.bio:
            self.bio = self.summary
        if not self.overall_score:
            self.overall_score = self.highest_score or self.average_score
        if not self.assessments_completed:
            self.assessments_completed = self.completed_assessments
        if not self.technical_skills:
            self.technical_skills = list(self.skills)
        if not self.programming_languages:
            self.programming_languages = [
                s for s in self.skills if s.lower() in ("python", "c++", "java", "typescript", "javascript", "go", "rust")
            ] or list(self.skills[:2])
        if not self.frameworks:
            self.frameworks = list(self.technologies)
        return self


class CandidateSearchResponse(BaseModel):
    success: bool = True
    total: int
    page: int
    limit: int
    page_size: Optional[int] = None
    total_pages: int
    candidates: List[CandidateSummary]
    items: Optional[List[CandidateSummary]] = None

    @model_validator(mode="after")
    def sync_search_fields(self):
        if self.page_size is None:
            self.page_size = self.limit
        if self.items is None:
            self.items = self.candidates
        return self


# =============================================================
# 3. Candidate Detailed Profile Schemas
# =============================================================

class SelfReportedPortfolio(BaseModel):
    skills: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)
    projects: List[Dict[str, Any]] = Field(default_factory=list)
    github_url: Optional[str] = None
    headline: Optional[str] = None
    summary: Optional[str] = None


class VerifiedAssessmentData(BaseModel):
    completed_assessments: int = 0
    highest_score: Optional[float] = None
    average_score: Optional[float] = None
    coding_score: Optional[float] = None
    ai_efficiency_score: Optional[float] = None
    formula_version: str = "v1.0"
    total_correct_test_cases: int = 0
    total_test_cases: int = 0
    consistency_score: Optional[float] = None
    consistency_label: Optional[str] = None
    improvement_delta: Optional[float] = None
    improvement_label: Optional[str] = None
    verified_achievements: List[Dict[str, Any]] = Field(default_factory=list)
    topic_mastery: List[Dict[str, Any]] = Field(default_factory=list)
    difficulty_breakdown: Dict[str, Any] = Field(default_factory=dict)


class RecruiterCandidateDetail(BaseModel):
    success: bool = True
    student_id: str
    candidate_id: Optional[str] = None
    share_id: str
    public_name: str
    display_name: Optional[str] = None
    headline: Optional[str] = None
    summary: Optional[str] = None
    self_reported: SelfReportedPortfolio
    verified_assessment: VerifiedAssessmentData
    is_shortlisted: bool = False
    recruiter_notes: Optional[str] = None
    shortlisted_at: Optional[str] = None
    member_since: str
    # Top-level helper properties for direct frontend display
    programming_languages: List[str] = Field(default_factory=list)
    technical_skills: List[str] = Field(default_factory=list)
    frameworks: List[str] = Field(default_factory=list)
    projects: List[Dict[str, Any]] = Field(default_factory=list)
    portfolio_available: bool = True
    portfolio_github_url: Optional[str] = None
    portfolio_highlights: List[str] = Field(default_factory=list)
    assessments_completed: int = 0
    overall_score: Optional[float] = None
    highest_score: Optional[float] = None
    coding_score: Optional[float] = None
    ai_efficiency_score: Optional[float] = None
    difficulty_level: str = "Medium"
    consistency_score: Optional[float] = None
    consistency_label: str = "Solid"
    improvement_delta: Optional[float] = None
    improvement_trend: str = "steady"
    improvement_label: str = "+0.0%"
    topic_performance: List[Any] = Field(default_factory=list)
    difficulty_performance: List[Any] = Field(default_factory=list)
    verified_achievements: List[Any] = Field(default_factory=list)
    updated_at: Optional[str] = None

    @model_validator(mode="after")
    def sync_detail_fields(self):
        if not self.candidate_id:
            self.candidate_id = self.student_id
        if not self.display_name:
            self.display_name = self.public_name
        if not self.technical_skills:
            self.technical_skills = list(self.self_reported.skills)
        if not self.programming_languages:
            self.programming_languages = [
                s for s in self.self_reported.skills if s.lower() in ("python", "c++", "java", "typescript", "javascript", "go", "rust")
            ] or list(self.self_reported.skills[:2])
        if not self.frameworks:
            self.frameworks = list(self.self_reported.technologies)
        if not self.projects:
            self.projects = list(self.self_reported.projects)
        if not self.portfolio_github_url:
            self.portfolio_github_url = self.self_reported.github_url
        if not self.overall_score:
            self.overall_score = self.verified_assessment.average_score or self.verified_assessment.highest_score
        if not self.highest_score:
            self.highest_score = self.verified_assessment.highest_score
        if not self.coding_score:
            self.coding_score = self.verified_assessment.coding_score
        if not self.ai_efficiency_score:
            self.ai_efficiency_score = self.verified_assessment.ai_efficiency_score
        if not self.assessments_completed:
            self.assessments_completed = self.verified_assessment.completed_assessments
        if not self.verified_achievements:
            self.verified_achievements = list(self.verified_assessment.verified_achievements)
        if not self.topic_performance:
            self.topic_performance = list(self.verified_assessment.topic_mastery)
        return self


# =============================================================
# 4. Shortlist Schemas
# =============================================================

class AddShortlistRequest(BaseModel):
    candidateId: Optional[str] = None
    candidate_id: Optional[str] = None
    student_id: Optional[str] = None
    privateNotes: Optional[str] = None
    private_notes: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=2000)

    @model_validator(mode="after")
    def resolve_fields(self):
        resolved_note = self.notes or self.private_notes or self.privateNotes
        self.notes = resolved_note
        self.private_notes = resolved_note
        return self


class UpdateShortlistNotesRequest(BaseModel):
    private_notes: Optional[str] = None
    privateNotes: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=2000)

    @model_validator(mode="after")
    def resolve_notes(self):
        res = self.notes if self.notes is not None else (self.private_notes if self.private_notes is not None else self.privateNotes)
        self.notes = res or ""
        self.private_notes = res or ""
        return self


class ShortlistItem(BaseModel):
    id: str
    shortlist_id: Optional[str] = None
    company_id: Optional[str] = None
    student_id: str
    candidate_id: Optional[str] = None
    candidate: CandidateSummary
    notes: Optional[str] = None
    private_notes: Optional[str] = None
    created_at: str
    added_at: Optional[str] = None
    updated_at: str
    is_visible: bool = True

    @model_validator(mode="after")
    def sync_shortlist_item(self):
        if not self.shortlist_id:
            self.shortlist_id = self.id
        if not self.candidate_id:
            self.candidate_id = self.student_id
        if not self.private_notes:
            self.private_notes = self.notes or ""
        if not self.notes:
            self.notes = self.private_notes
        if not self.added_at:
            self.added_at = self.created_at
        return self


class ShortlistResponse(BaseModel):
    success: bool = True
    total: int
    shortlist: List[ShortlistItem]
    items: Optional[List[ShortlistItem]] = None

    @model_validator(mode="after")
    def sync_shortlist_list(self):
        if self.items is None:
            self.items = self.shortlist
        return self


# =============================================================
# 5. Candidate Comparison Schemas
# =============================================================

class CompareCandidatesRequest(BaseModel):
    student_ids: Optional[List[str]] = None
    candidate_ids: Optional[List[str]] = None

    @model_validator(mode="after")
    def check_candidate_ids(self):
        ids = self.student_ids or self.candidate_ids or []
        if len(ids) < 2:
            raise ValueError("At least 2 candidates are required for comparison.")
        if len(ids) > 4:
            raise ValueError("Cannot compare more than 4 candidates simultaneously.")
        self.student_ids = ids
        self.candidate_ids = ids
        return self


class CandidateComparisonItem(BaseModel):
    student_id: str
    candidate_id: Optional[str] = None
    public_name: str
    display_name: Optional[str] = None
    headline: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    technical_skills: List[str] = Field(default_factory=list)
    programming_languages: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)
    frameworks: List[str] = Field(default_factory=list)
    projects_count: int = 0
    highest_score: Optional[float] = None
    average_score: Optional[float] = None
    overall_score: Optional[float] = None
    coding_score: Optional[float] = None
    ai_efficiency_score: Optional[float] = None
    completed_assessments: int = 0
    assessments_completed: int = 0
    consistency_score: Optional[float] = None
    consistency_label: str = "Solid"
    improvement_delta: Optional[float] = None
    improvement_trend: str = "steady"
    improvement_label: str = "+0.0%"
    topic_strengths: List[str] = Field(default_factory=list)
    difficulty_distribution: Dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def sync_comp_item(self):
        if not self.candidate_id:
            self.candidate_id = self.student_id
        if not self.display_name:
            self.display_name = self.public_name
        if not self.technical_skills:
            self.technical_skills = list(self.skills)
        if not self.programming_languages:
            self.programming_languages = [
                s for s in self.skills if s.lower() in ("python", "c++", "java", "typescript", "javascript", "go", "rust")
            ] or list(self.skills[:2])
        if not self.frameworks:
            self.frameworks = list(self.technologies)
        if not self.overall_score:
            self.overall_score = self.highest_score or self.average_score
        if not self.assessments_completed:
            self.assessments_completed = self.completed_assessments
        return self


class CompareCandidatesResponse(BaseModel):
    success: bool = True
    candidate_count: int
    common_skills: List[str] = Field(default_factory=list)
    all_unique_skills: List[str] = Field(default_factory=list)
    metric_leaders: Dict[str, Any] = Field(default_factory=dict)
    candidates: List[CandidateComparisonItem]


# =============================================================
# 6. Recruiter Dashboard & Saved Searches Schemas
# =============================================================

class SavedCandidateSearchRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    query_string: str = Field(..., max_length=500)
    filters_summary: str = Field(..., max_length=500)


class SavedCandidateSearchResponse(BaseModel):
    id: str
    name: str
    query_string: str
    filters_summary: str
    created_at: str


class RecruiterDashboardResponse(BaseModel):
    success: bool = True
    company_profile: Optional[CompanyProfileResponse] = None
    total_accessible_candidates: int
    total_available_candidates: Optional[int] = None
    total_shortlisted_candidates: int
    recent_shortlist_activity: List[ShortlistItem]
    recently_added_candidates: List[CandidateSummary] = Field(default_factory=list)
    shortlisted_candidates: List[ShortlistItem] = Field(default_factory=list)
    discovery_activity: List[Dict[str, Any]] = Field(default_factory=list)
    saved_searches: List[Dict[str, Any]] = Field(default_factory=list)
    top_available_skills: List[Dict[str, Any]]
    platform_average_score: float
    score_distribution: Dict[str, int]
    platform_statistics: Optional[Dict[str, Any]] = None

    @model_validator(mode="after")
    def sync_dashboard_fields(self):
        if self.total_available_candidates is None:
            self.total_available_candidates = self.total_accessible_candidates
        if not self.shortlisted_candidates:
            self.shortlisted_candidates = self.recent_shortlist_activity
        if self.platform_statistics is None:
            self.platform_statistics = {
                "total_verified_assessments": sum(self.score_distribution.values()),
                "average_assessment_score": self.platform_average_score,
                "average_coding_score": self.platform_average_score,
                "average_ai_efficiency_score": self.platform_average_score,
                "top_verified_skills": [s.get("skill") for s in self.top_available_skills if s.get("skill")],
            }
        return self
