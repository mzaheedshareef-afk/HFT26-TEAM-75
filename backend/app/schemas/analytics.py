"""
Analytics & Historical Performance Pydantic Schemas
Defines request and response models for candidate assessment analytics and historical trends.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class AssessmentHistoryItem(BaseModel):
    assessment_id: str
    title: str
    difficulty: str = "medium"
    status: str
    completed_at: Optional[str] = None
    created_at: str
    coding_score: float
    ai_efficiency_score: float
    final_score: float
    formula_version: str = "v1.0"
    questions_count: int
    questions_passed: int
    correct_test_cases: int
    total_test_cases: int
    total_time_taken_seconds: Optional[float] = 0.0


class TopicPerformanceItem(BaseModel):
    topic: str
    total_questions: int
    questions_solved: int
    success_rate: float
    average_score: float


class DifficultyPerformanceItem(BaseModel):
    difficulty: str
    total_questions: int
    questions_solved: int
    success_rate: float
    average_score: float


class HistoricalTrendPoint(BaseModel):
    assessment_id: str
    title: str
    date: str
    coding_score: float
    ai_efficiency_score: float
    final_score: float
    completion_time_seconds: float


class StudentDashboardAnalytics(BaseModel):
    success: bool = True
    total_assessments: int
    completed_assessments: int
    average_score: float
    highest_score: float
    latest_final_score: Optional[float] = None
    total_correct_test_cases: int
    total_failed_test_cases: int
    total_test_cases: int
    average_completion_time_seconds: float
    topic_performance: List[TopicPerformanceItem] = Field(default_factory=list)
    difficulty_performance: List[DifficultyPerformanceItem] = Field(default_factory=list)
    improvement_delta: float = 0.0
    performance_consistency_score: float = 100.0
    historical_trends: List[HistoricalTrendPoint] = Field(default_factory=list)


class AssessmentResultAnalyticsResponse(BaseModel):
    success: bool = True
    assessment_id: str
    title: str
    status: str
    completed_at: Optional[str] = None
    candidate_name: Optional[str] = None
    domain: Optional[str] = None
    tier: Optional[str] = None
    duration_minutes: Optional[int] = 60
    outcome: Optional[str] = "PASS"
    coding_score: float
    ai_efficiency_score: float
    final_score: float
    formula_version: str = "v1.0"
    formula_description: str
    scoring_components: Dict[str, Any]
    questions_count: int
    questions_passed: int
    correct_test_cases: int
    failed_test_cases: int
    total_test_cases: int
    time_taken_seconds: float
    ai_metrics: Optional[Dict[str, Any]] = None
    claimed_skills: Optional[List[str]] = Field(default_factory=list)
    demonstrated_skills: Optional[List[str]] = Field(default_factory=list)
    unassessed_skills: Optional[List[str]] = Field(default_factory=list)
    question_performance: List[Dict[str, Any]] = Field(default_factory=list)

