"""
Submission & Execution Pydantic Schemas
Defines request and response models for code execution, submissions, and grading.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CodeRunRequest(BaseModel):
    source_code: str = Field(..., description="Student code to run")
    language: str = Field(..., description="Programming language: python, cpp, java")
    question_id: str = Field(..., description="Target question ID")
    assessment_id: Optional[str] = Field(None, description="Assessment context ID")
    custom_input: Optional[str] = Field(None, description="Optional custom stdin input")


class TestCaseOutputSchema(BaseModel):
    test_case_id: str
    status: str
    passed: bool
    input: Optional[str] = None
    expected_output: Optional[str] = None
    actual_output: Optional[str] = None
    error_message: Optional[str] = None
    execution_time_ms: float = 0.0
    is_hidden: bool = False


class CodeRunResponse(BaseModel):
    success: bool = True
    language: str
    question_id: str
    total_test_cases: int
    passed_test_cases: int
    failed_test_cases: int
    test_results: List[Dict[str, Any]]


class CodeSubmitRequest(BaseModel):
    source_code: str = Field(..., description="Candidate source code")
    language: str = Field(..., description="Programming language: python, cpp, java")
    question_id: str = Field(..., description="Question ID being submitted")
    assessment_id: str = Field(..., description="Assessment session ID")


class CodeSubmitResponse(BaseModel):
    success: bool = True
    submission_id: str
    assessment_id: str
    question_id: str
    status: str
    score: float
    is_accepted: bool
    passed_tests: int
    failed_tests: int
    total_tests: int
    public_test_cases: List[Dict[str, Any]]
    hidden_test_cases: List[Dict[str, Any]]
    efficiency: Optional[Dict[str, Any]] = None
    created_at: str


class SubmissionDetailResponse(BaseModel):
    success: bool = True
    submission: Dict[str, Any]


class AssessmentResultsResponse(BaseModel):
    success: bool = True
    results: Dict[str, Any]
