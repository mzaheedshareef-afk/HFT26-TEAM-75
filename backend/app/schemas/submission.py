"""
Submission & Execution Pydantic Schemas
Defines request and response models for code execution, submissions, and grading.
Aligned across Zaheed's Frontend and Vasil's Docker Sandbox Execution Engine.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, model_validator


class CodeRunRequest(BaseModel):
    source_code: Optional[str] = Field(None, description="Student code to run")
    code: Optional[str] = Field(None, description="Alias for source_code")
    language: str = Field(..., description="Programming language: python, cpp, java")
    question_id: str = Field(..., description="Target question ID")
    assessment_id: Optional[str] = Field(None, description="Assessment context ID")
    custom_input: Optional[str] = Field(None, description="Optional custom stdin input")

    @model_validator(mode="after")
    def resolve_code_field(self) -> "CodeRunRequest":
        if not self.source_code and self.code:
            self.source_code = self.code
        elif not self.code and self.source_code:
            self.code = self.source_code
        return self


class TestCaseOutputSchema(BaseModel):
    test_case_id: str
    status: str
    verdict: Optional[str] = None
    passed: bool
    input: Optional[str] = None
    expected_output: Optional[str] = None
    actual_output: Optional[str] = None
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    error_message: Optional[str] = None
    execution_time_ms: float = 0.0
    memory_used_mb: float = 0.0
    is_hidden: bool = False
    weight: Optional[float] = 1.0


class CodeRunResponse(BaseModel):
    success: bool = True
    language: str
    question_id: str
    overall_verdict: Optional[str] = None
    status: Optional[str] = None
    total_test_cases: int
    total_count: Optional[int] = None
    passed_test_cases: int
    passed_count: Optional[int] = None
    failed_test_cases: int
    failed_count: Optional[int] = None
    total_time_ms: Optional[float] = 0.0
    memory_used_mb: Optional[float] = 0.0
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    compile_error: Optional[str] = None
    compilation_error: Optional[str] = None
    timed_out: Optional[bool] = False
    test_results: List[Dict[str, Any]] = Field(default_factory=list)
    results: List[Dict[str, Any]] = Field(default_factory=list)


class CodeSubmitRequest(BaseModel):
    source_code: Optional[str] = Field(None, description="Candidate source code")
    code: Optional[str] = Field(None, description="Alias for source_code")
    language: str = Field(..., description="Programming language: python, cpp, java")
    question_id: str = Field(..., description="Question ID being submitted")
    assessment_id: str = Field(..., description="Assessment session ID")
    elapsed_seconds: Optional[int] = Field(None, description="Elapsed time in seconds")
    hints_used: Optional[int] = Field(None, description="Count of hints used")

    @model_validator(mode="after")
    def resolve_code_field(self) -> "CodeSubmitRequest":
        if not self.source_code and self.code:
            self.source_code = self.code
        elif not self.code and self.source_code:
            self.code = self.source_code
        return self


class CodeSubmitResponse(BaseModel):
    success: bool = True
    submission_id: str
    assessment_id: str
    question_id: str
    status: str
    verdict: Optional[str] = None
    overall_verdict: Optional[str] = None
    score: float
    deterministic_score: Optional[float] = None
    overall_score: Optional[float] = None
    is_accepted: bool
    passed_tests: int
    failed_tests: int
    total_tests: int
    execution_time_ms: Optional[float] = 0.0
    memory_used_mb: Optional[float] = 0.0
    public_test_cases: List[Dict[str, Any]] = Field(default_factory=list)
    hidden_test_cases: List[Dict[str, Any]] = Field(default_factory=list)
    efficiency: Optional[Dict[str, Any]] = None
    summary: Optional[Dict[str, Any]] = None
    run_results: Optional[Dict[str, Any]] = None
    created_at: str
    submitted_at: Optional[str] = None


class SubmissionDetailResponse(BaseModel):
    success: bool = True
    submission: Optional[Dict[str, Any]] = None
    summary: Optional[Dict[str, Any]] = None


class AssessmentCompleteRequest(BaseModel):
    elapsed_seconds: Optional[int] = None
    total_hints_used: Optional[int] = None


class AssessmentResultsResponse(BaseModel):
    success: bool = True
    results: Dict[str, Any]
