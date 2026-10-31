from datetime import datetime, timezone
import hashlib
from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field, model_validator


QuestionType = Literal["mcq", "msq", "coding"]


class QuestionOptionSchema(BaseModel):
    id: str = Field(description="Option identifier, e.g. A, B, C, D")
    text: str = Field(description="Option text content")


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
    question_type: QuestionType = "coding"
    title: str
    description: str
    difficulty: str = "medium"
    topic: str = "Algorithms & Data Structures"
    domain: Optional[str] = None
    target_skill: Optional[str] = None
    portfolio_skill_reference: Optional[str] = None
    marks: float = 2.0

    # MCQ and MSQ fields
    options: Optional[List[QuestionOptionSchema]] = None
    # Server-only answer keys (NEVER sent to candidate prior to assessment evaluation)
    correct_answer: Optional[str] = None       # For MCQ: e.g. "B"
    correct_answers: Optional[List[str]] = None # For MSQ: e.g. ["A", "C"]
    explanation: Optional[str] = None
    question_fingerprint: Optional[str] = None

    # Coding-specific fields
    constraints: Union[List[str], QuestionConstraintsSchema] = Field(default_factory=list)
    examples: List[Dict[str, Any]] = Field(default_factory=list)
    public_test_cases: Optional[List[Dict[str, Any]]] = None
    allowed_languages: List[str] = Field(
        default_factory=lambda: ["python", "javascript", "typescript", "java", "cpp"]
    )
    starter_code: Dict[str, str] = Field(default_factory=dict)
    # Server-only hidden test cases & reference solution
    hidden_test_cases: List[Dict[str, Any]] = Field(default_factory=list)
    reference_solution: Optional[str] = None
    time_limit_seconds: float = 2.0
    memory_limit_mb: int = 256
    order_index: int = 1

    @model_validator(mode="after")
    def sync_aliases_and_defaults(self) -> "GeneratedQuestionSchema":
        if not self.domain:
            self.domain = self.topic
        if not self.target_skill:
            self.target_skill = self.portfolio_skill_reference or self.topic
        if not self.portfolio_skill_reference:
            self.portfolio_skill_reference = self.target_skill
        if not self.public_test_cases and self.examples:
            self.public_test_cases = self.examples
        elif not self.examples and self.public_test_cases:
            self.examples = self.public_test_cases
        if not self.question_fingerprint:
            raw = f"{self.question_type}:{self.topic}:{self.title}:{self.description[:80]}"
            self.question_fingerprint = hashlib.sha256(raw.encode()).hexdigest()[:16]
        return self

    def to_candidate_dict(self) -> Dict[str, Any]:
        """
        Returns a sanitized dictionary safe for frontend display.
        Strictly strips correct_answer, correct_answers, explanation,
        hidden_test_cases, and reference_solution.
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

        data: Dict[str, Any] = {
            "question_id": self.question_id,
            "id": self.question_id,
            "question_type": self.question_type,
            "order_index": self.order_index,
            "title": self.title,
            "description": self.description,
            "difficulty": self.difficulty,
            "topic": self.topic,
            "domain": self.domain or self.topic,
            "target_skill": self.target_skill or self.topic,
            "portfolio_skill_reference": self.portfolio_skill_reference or self.target_skill,
            "marks": self.marks,
            "question_fingerprint": self.question_fingerprint,
        }

        if self.question_type in ("mcq", "msq"):
            data["options"] = [
                opt.model_dump() if hasattr(opt, "model_dump") else opt
                for opt in (self.options or [])
            ]
        else:
            # Coding question
            data.update({
                "constraints": constraints_list,
                "examples": examples_list,
                "public_test_cases": examples_list,
                "sample_test_cases": examples_list,
                "allowed_languages": self.allowed_languages,
                "starter_code": self.starter_code,
                "time_limit_seconds": self.time_limit_seconds,
                "memory_limit_mb": self.memory_limit_mb,
            })

        return data

    def to_database_dict(self, assessment_id: str) -> Dict[str, Any]:
        """Returns complete question data including server-side secret keys and solutions."""
        return {
            "id": self.question_id,
            "assessment_id": assessment_id,
            "question_type": self.question_type,
            "order_index": self.order_index,
            "title": self.title,
            "description": self.description,
            "difficulty": self.difficulty.lower(),
            "category": self.topic,
            "topic": self.topic,
            "target_skill": self.target_skill or self.topic,
            "portfolio_skill_reference": self.portfolio_skill_reference or self.target_skill,
            "marks": self.marks,
            "options": [
                opt.model_dump() if hasattr(opt, "model_dump") else opt
                for opt in (self.options or [])
            ] if self.options else None,
            "correct_answer": self.correct_answer,
            "correct_answers": self.correct_answers,
            "explanation": self.explanation,
            "question_fingerprint": self.question_fingerprint,
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
    mcq_count: int = 3
    msq_count: int = 2
    coding_count: int = 1

    @model_validator(mode="after")
    def validate_question_count(self) -> "GeneratedAssessmentSchema":
        if not self.questions or len(self.questions) == 0:
            raise ValueError("Generated assessment must contain at least one question.")
        return self


class AssessmentGenerateRequest(BaseModel):
    portfolio_id: Optional[str] = None
    target_role: Optional[str] = "Software Engineer"
    difficulty_preference: Optional[str] = "medium"
    question_count: Optional[int] = 6
    mcq_count: Optional[int] = 3
    msq_count: Optional[int] = 2
    coding_count: Optional[int] = 1


class AssessmentAnswerRequest(BaseModel):
    question_id: str
    selected_option: Optional[str] = None
    selected_options: Optional[List[str]] = None
    source_code: Optional[str] = None
    language: Optional[str] = None


class AssessmentSubmitRequest(BaseModel):
    answers: Optional[Dict[str, Any]] = None  # question_id -> answer payload


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
    mcq_count: int = 0
    msq_count: int = 0
    coding_count: int = 0
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
    mcq_count: int = 0
    msq_count: int = 0
    coding_count: int = 0
    questions: List[Dict[str, Any]]
    created_at: str
    completed_at: Optional[str] = None


class AssessmentApiResponse(BaseModel):
    success: bool = True
    assessment: Optional[Dict[str, Any]] = None
    session: Optional[Dict[str, Any]] = None
    message: Optional[str] = None
