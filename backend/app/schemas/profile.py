"""
Student Public Profile & Sharing Pydantic Schemas
Defines request and response structures for authenticated profile management and public sharing.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class ProfileUpdateRequest(BaseModel):
    public_name: Optional[str] = Field(None, min_length=2, max_length=100)
    headline: Optional[str] = Field(None, max_length=150)
    bio: Optional[str] = Field(None, max_length=1000)
    skills: Optional[List[str]] = None
    technologies: Optional[List[str]] = None
    projects: Optional[List[Dict[str, Any]]] = None
    portfolio_highlights: Optional[List[Dict[str, Any]]] = None


class ProfileVisibilityRequest(BaseModel):
    visibility: str = Field(..., description="'public' or 'private'")

    @field_validator("visibility")
    @classmethod
    def validate_visibility(cls, v: str) -> str:
        clean = v.strip().lower()
        if clean not in ("public", "private"):
            raise ValueError("Visibility must be either 'public' or 'private'.")
        return clean


class StudentProfileMeResponse(BaseModel):
    success: bool = True
    id: str
    user_id: str
    full_name: str
    public_name: str
    headline: Optional[str] = None
    bio: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)
    projects: List[Dict[str, Any]] = Field(default_factory=list)
    portfolio_highlights: List[Dict[str, Any]] = Field(default_factory=list)
    verified_achievements: List[Dict[str, Any]] = Field(default_factory=list)
    performance_summary: Dict[str, Any] = Field(default_factory=dict)
    visibility: str = "private"
    share_id: str
    share_url: str
    created_at: str
    updated_at: str


class PublicStudentProfileView(BaseModel):
    success: bool = True
    share_id: str
    public_name: str
    headline: Optional[str] = None
    bio: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)
    projects: List[Dict[str, Any]] = Field(default_factory=list)
    portfolio_highlights: List[Dict[str, Any]] = Field(default_factory=list)
    verified_achievements: List[Dict[str, Any]] = Field(default_factory=list)
    performance_summary: Dict[str, Any] = Field(default_factory=dict)
    member_since: str

