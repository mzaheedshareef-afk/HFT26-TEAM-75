"""
Pydantic Schemas for Recruiter & Company Discovery, Shortlisting and Comparison.
Role: Testing & Integration Lead (Vasil)
Project: Portfolio-Driven Adaptive Coding & Technical Assessment Platform
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# =============================================================
# 1. Company Profile Schemas
# =============================================================

class CompanyProfileResponse(BaseModel):
    id: str
    company_name: str
    official_email: str
    industry: Optional[str] = None
    website: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    company_size: Optional[str] = None
    role: str = "company"
    created_at: str
    updated_at: str


class UpdateCompanyProfileRequest(BaseModel):
    company_name: Optional[str] = Field(None, min_length=2, max_length=120)
    industry: Optional[str] = Field(None, max_length=100)
    website: Optional[str] = Field(None, max_length=200)
    location: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    company_size: Optional[str] = Field(None, max_length=50)


# =============================================================
# 2. Candidate Discovery Schemas
# =============================================================

class CandidateSummary(BaseModel):
    student_id: str
    share_id: str
    public_name: str
    headline: Optional[str] = None
    bio: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)
    projects_count: int = 0
    highest_score: Optional[float] = None
    average_score: Optional[float] = None
    coding_score: Optional[float] = None
    ai_efficiency_score: Optional[float] = None
    completed_assessments: int = 0
    consistency_score: Optional[float] = None
    improvement_delta: Optional[float] = None
    is_shortlisted: bool = False
    updated_at: str


class CandidateSearchResponse(BaseModel):
    success: bool = True
    total: int
    page: int
    limit: int
    total_pages: int
    candidates: List[CandidateSummary]


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
    share_id: str
    public_name: str
    headline: Optional[str] = None
    summary: Optional[str] = None
    self_reported: SelfReportedPortfolio
    verified_assessment: VerifiedAssessmentData
    is_shortlisted: bool = False
    recruiter_notes: Optional[str] = None
    shortlisted_at: Optional[str] = None
    member_since: str


# =============================================================
# 4. Shortlist Schemas
# =============================================================

class AddShortlistRequest(BaseModel):
    notes: Optional[str] = Field(None, max_length=2000)


class UpdateShortlistNotesRequest(BaseModel):
    notes: str = Field(..., max_length=2000)


class ShortlistItem(BaseModel):
    id: str
    student_id: str
    candidate: CandidateSummary
    notes: Optional[str] = None
    created_at: str
    updated_at: str
    is_visible: bool = True


class ShortlistResponse(BaseModel):
    success: bool = True
    total: int
    shortlist: List[ShortlistItem]


# =============================================================
# 5. Candidate Comparison Schemas
# =============================================================

class CompareCandidatesRequest(BaseModel):
    student_ids: List[str] = Field(..., min_length=2, max_length=4)


class CandidateComparisonItem(BaseModel):
    student_id: str
    public_name: str
    headline: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)
    projects_count: int = 0
    highest_score: Optional[float] = None
    average_score: Optional[float] = None
    coding_score: Optional[float] = None
    ai_efficiency_score: Optional[float] = None
    completed_assessments: int = 0
    consistency_score: Optional[float] = None
    improvement_delta: Optional[float] = None
    topic_strengths: List[str] = Field(default_factory=list)
    difficulty_distribution: Dict[str, Any] = Field(default_factory=dict)


class CompareCandidatesResponse(BaseModel):
    success: bool = True
    candidate_count: int
    common_skills: List[str] = Field(default_factory=list)
    all_unique_skills: List[str] = Field(default_factory=list)
    metric_leaders: Dict[str, Any] = Field(default_factory=dict)
    candidates: List[CandidateComparisonItem]


# =============================================================
# 6. Recruiter Dashboard Schemas
# =============================================================

class RecruiterDashboardResponse(BaseModel):
    success: bool = True
    total_accessible_candidates: int
    total_shortlisted_candidates: int
    recent_shortlist_activity: List[ShortlistItem]
    top_available_skills: List[Dict[str, Any]]
    platform_average_score: float
    score_distribution: Dict[str, int]
