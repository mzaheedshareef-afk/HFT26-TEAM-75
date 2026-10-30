"""
Student Public Profile & Sharing Pydantic Schemas
Defines request and response structures for authenticated profile management and public sharing.
Supports aliases (display_name/public_name, summary/bio, share_slug/share_id) for frontend integration.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


class ProfileUpdateRequest(BaseModel):
    public_name: Optional[str] = Field(None, min_length=2, max_length=100)
    display_name: Optional[str] = Field(None, min_length=2, max_length=100)
    headline: Optional[str] = Field(None, max_length=150)
    bio: Optional[str] = Field(None, max_length=1000)
    summary: Optional[str] = Field(None, max_length=1000)
    skills: Optional[List[str]] = None
    technologies: Optional[List[str]] = None
    projects: Optional[List[Dict[str, Any]]] = None
    portfolio_highlights: Optional[List[Dict[str, Any]]] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None

    @model_validator(mode="after")
    def resolve_aliases(self) -> "ProfileUpdateRequest":
        if not self.public_name and self.display_name:
            self.public_name = self.display_name
        elif not self.display_name and self.public_name:
            self.display_name = self.public_name
        if not self.bio and self.summary:
            self.bio = self.summary
        elif not self.summary and self.bio:
            self.summary = self.bio
        return self


class ProfileVisibilityRequest(BaseModel):
    visibility: Optional[str] = Field(None, description="'public' or 'private'")
    is_sharing_enabled: Optional[bool] = Field(None, description="Toggle sharing boolean")

    @model_validator(mode="after")
    def resolve_visibility(self) -> "ProfileVisibilityRequest":
        if not self.visibility:
            if self.is_sharing_enabled is True:
                self.visibility = "public"
            elif self.is_sharing_enabled is False:
                self.visibility = "private"
            else:
                self.visibility = "private"
        else:
            clean = self.visibility.strip().lower()
            if clean not in ("public", "private"):
                raise ValueError("Visibility must be either 'public' or 'private'.")
            self.visibility = clean
        return self


class StudentProfileMeResponse(BaseModel):
    success: bool = True
    id: str
    user_id: str
    full_name: str
    public_name: str
    display_name: Optional[str] = None
    headline: Optional[str] = None
    bio: Optional[str] = None
    summary: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)
    projects: List[Dict[str, Any]] = Field(default_factory=list)
    portfolio_highlights: List[Dict[str, Any]] = Field(default_factory=list)
    verified_achievements: List[Dict[str, Any]] = Field(default_factory=list)
    performance_summary: Dict[str, Any] = Field(default_factory=dict)
    consistency: Optional[Dict[str, Any]] = None
    improvement: Optional[Dict[str, Any]] = None
    visibility: str = "private"
    is_sharing_enabled: bool = False
    share_id: str
    share_slug: Optional[str] = None
    share_url: str
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    created_at: str
    updated_at: str


class PublicStudentProfileView(BaseModel):
    success: bool = True
    share_id: str
    share_slug: Optional[str] = None
    public_name: str
    display_name: Optional[str] = None
    headline: Optional[str] = None
    bio: Optional[str] = None
    summary: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)
    projects: List[Dict[str, Any]] = Field(default_factory=list)
    portfolio_highlights: List[Dict[str, Any]] = Field(default_factory=list)
    verified_achievements: List[Dict[str, Any]] = Field(default_factory=list)
    performance_summary: Dict[str, Any] = Field(default_factory=dict)
    consistency: Optional[Dict[str, Any]] = None
    improvement: Optional[Dict[str, Any]] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    member_since: str
