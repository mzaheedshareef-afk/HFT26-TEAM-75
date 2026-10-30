from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, model_validator


class PublicTestCaseSchema(BaseModel):
    test_case_id: str = Field(default_factory=lambda: "tc_pub_1")
    input: str
    expected_output: str
    explanation: Optional[str] = None


class HiddenTestCaseSchema(BaseModel):
    test_case_id: str = Field(default_factory=lambda: "tc_hid_1")
    input: str
    expected_output: str
    weight: float = 1.0


class QuestionConstraintsSchema(BaseModel):
    time_limit_ms: int = 2000
    memory_limit_mb: int = 256
    additional_notes: List[str] = Field(default_factory=list)


class GeneratedQuestionSchema(BaseModel):
    question_id: str
    title: str
    description: str
    difficulty: str = "medium"
    topic: str = "Algorithms & Data Structures"
    domain: Optional[str] = None
    target_skill: Optional[str] = None
    constraints: Union[List[str], QuestionConstraintsSchema] = Field(default_factory=list)
    examples: List[Dict[str, Any]] = Field(default_factory=list)
    public_test_cases: Optional[List[Dict[str, Any]]] = None
    allowed_languages: List[str] = Field(
        default_factory=lambda: ["python", "javascript", "typescript", "java", "cpp"]
    )
    starter_code: Dict[str, str] = Field(default_factory=dict)
    # Server-only fields (hidden from candidate responses)
    hidden_test_cases: List[Dict[str, Any]] = Field(default_factory=list)
    reference_solution: Optional[str] = None
    time_limit_seconds: float = 2.0
    memory_limit_mb: int = 256
    order_index: int = 1

    @model_validator(mode="after")
    def sync_aliases(self) -> "GeneratedQuestionSchema":
        if not self.domain:
            self.domain = self.topic
        if not self.public_test_cases and self.examples:
            self.public_test_cases = self.examples
        elif not self.examples and self.public_test_cases:
            self.examples = self.public_test_cases
        return self

    def to_candidate_dict(self) -> Dict[str, Any]:
        """
        Returns a clean dictionary safe for frontend display.
        Strictly strips hidden_test_cases and reference_solution.
        """
        constraints_list = (
            self.constraints
            if isinstance(self.constraints, list)
            else [
                f"Time limit: {self.constraints.time_limit_ms}ms",
                f"Memory limit: {self.constraints.memory_limit_mb}MB",
            ] + self.constraints.additional_notes
        )

        examples_list = self.examples or self.public_test_cases or []

        return {
            "question_id": self.question_id,
            "id": self.question_id,
            "order_index": self.order_index,
            "title": self.title,
            "description": self.description,
            "difficulty": self.difficulty,
            "topic": self.topic,
            "domain": self.domain or self.topic,
            "target_skill": self.target_skill or self.topic,
            "constraints": constraints_list,
            "examples": examples_list,
            "public_test_cases": examples_list,
            "sample_test_cases": examples_list,
            "allowed_languages": self.allowed_languages,
            "starter_code": self.starter_code,
            "time_limit_seconds": self.time_limit_seconds,
            "memory_limit_mb": self.memory_limit_mb,
        }

    def to_database_dict(self, assessment_id: str) -> Dict[str, Any]:
        """Returns complete question data including server-side hidden test cases."""
        return {
            "id": self.question_id,
            "assessment_id": assessment_id,
            "order_index": self.order_index,
            "title": self.title,
            "description": self.description,
            "difficulty": self.difficulty.lower(),
            "category": self.topic,
            "target_skill": self.target_skill or self.topic,
            "starter_code": self.starter_code,
            "sample_test_cases": self.examples or self.public_test_cases or [],
            "hidden_test_cases": self.hidden_test_cases or [],
            "reference_solution": self.reference_solution,
            "time_limit_seconds": self.time_limit_seconds,
            "memory_limit_mb": self.memory_limit_mb,
            "validation_status": "validated",
        }


class GeneratedAssessmentSchema(BaseModel):
    title: str = "Personalized Technical Assessment"
    duration_minutes: int = 60
    difficulty: str = "medium"
    target_role: str = "Software Engineer"
    questions: List[GeneratedQuestionSchema]
    portfolio_id: Optional[str] = None
    user_id: Optional[str] = None

    @model_validator(mode="after")
    def validate_question_count(self) -> "GeneratedAssessmentSchema":
        if not self.questions or len(self.questions) == 0:
            raise ValueError("Generated assessment must contain at least one question.")
        return self


class AssessmentGenerateRequest(BaseModel):
    portfolio_id: Optional[str] = None
    target_role: Optional[str] = "Software Engineer"
    difficulty_preference: Optional[str] = "medium"
    question_count: Optional[int] = 3


class AssessmentSummary(BaseModel):
    id: str
    user_id: str
    portfolio_id: Optional[str] = None
    title: str
    target_role: str
    difficulty: str
    status: str
    total_time_limit_minutes: int
    duration_minutes: int
    question_count: int
    created_at: str
    completed_at: Optional[str] = None


class AssessmentDetailResponse(BaseModel):
    id: str
    user_id: str
    portfolio_id: Optional[str] = None
    title: str
    target_role: str
    difficulty: str
    status: str
    duration_minutes: int
    total_time_limit_minutes: int
    duration_seconds: int
    question_count: int
    questions: List[Dict[str, Any]]
    created_at: str
    completed_at: Optional[str] = None


class AssessmentApiResponse(BaseModel):
    success: bool = True
    assessment: Optional[Dict[str, Any]] = None
    session: Optional[Dict[str, Any]] = None
    message: Optional[str] = None
