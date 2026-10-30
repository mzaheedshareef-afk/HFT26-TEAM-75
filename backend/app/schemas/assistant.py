"""
AI Assistant & Progressive Hint Pydantic Schemas
Defines request and response structures for progressive AI hints and interaction tracking.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class AiHintRequest(BaseModel):
    assessment_id: Optional[str] = Field(None, description="Contextual assessment session ID")
    question_id: Optional[str] = Field(None, description="Target question ID")
    hint_level: Optional[int] = Field(1, ge=1, le=3, description="Requested progressive hint level (1, 2, or 3)")
    question_title: Optional[str] = Field(None, description="Title of the question")
    language: Optional[str] = Field("python", description="Programming language context")
    current_code: Optional[str] = Field(None, description="Candidate code draft for context")
    previous_hints: Optional[List[str]] = Field(default_factory=list, description="Previously received hint texts")
    allow_solution: Optional[bool] = Field(False, description="Strictly rejected if true")

    @field_validator("hint_level")
    @classmethod
    def validate_hint_level(cls, v: Optional[int]) -> int:
        if v is not None and v not in (1, 2, 3):
            raise ValueError("hint_level must be 1, 2, or 3.")
        return v or 1


class AiHintItem(BaseModel):
    hint_id: str
    id: Optional[str] = None
    assessment_id: Optional[str] = None
    question_id: str
    hint_level: int
    level: Optional[int] = None
    category_label: str
    category: Optional[str] = None
    content: str
    hint_text: str
    sanitized_redacted: bool = False
    created_at: str


class AiHintResponse(BaseModel):
    success: bool = True
    hint: AiHintItem
    hint_text: str
    level: int
    hint_level: int
    sanitized_redacted: bool = False
    created_at: str


class HintUsageStats(BaseModel):
    total_hints_requested: int
    hints_by_level: Dict[str, int]
    questions_with_hints: int
    max_hints_per_question: int = 3
    history: List[AiHintItem] = Field(default_factory=list)

