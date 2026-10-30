from datetime import datetime, timezone
import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


GITHUB_URL_REGEX = re.compile(
    r"^https?://(www\.)?github\.com/[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)?/?$"
)


class SkillItemSchema(BaseModel):
    name: str
    category: str = "language"
    proficiency: Optional[str] = "intermediate"
    years_of_experience: Optional[float] = 1.0


class ProjectItemSchema(BaseModel):
    title: str
    description: str
    tech_stack: List[str] = Field(default_factory=list)
    repo_url: Optional[str] = None
    live_url: Optional[str] = None
    highlights: Optional[List[str]] = Field(default_factory=list)


class PortfolioUploadJsonRequest(BaseModel):
    github_url: Optional[str] = None
    githubUrl: Optional[str] = None
    primary_languages: Optional[List[str]] = None
    primaryLanguages: Optional[List[str]] = None
    frameworks: Optional[List[str]] = Field(default_factory=list)
    notes: Optional[str] = None
    portfolio_notes: Optional[str] = None
    portfolioNotes: Optional[str] = None
    headline: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[List[SkillItemSchema]] = None
    projects: Optional[List[ProjectItemSchema]] = None

    def get_github_url(self) -> str:
        url = self.github_url or self.githubUrl or ""
        return url.strip()

    def get_languages(self) -> List[str]:
        langs = self.primary_languages or self.primaryLanguages or []
        if not langs and self.skills:
            langs = [s.name for s in self.skills if s.category == "language"]
        return [l.strip() for l in langs if l and l.strip()]

    def get_frameworks(self) -> List[str]:
        fw = self.frameworks or []
        if not fw and self.skills:
            fw = [s.name for s in self.skills if s.category == "framework"]
        return [f.strip() for f in fw if f and f.strip()]

    def get_notes(self) -> Optional[str]:
        return self.notes or self.portfolio_notes or self.portfolioNotes or self.bio or None


class RepositorySummary(BaseModel):
    name: str
    url: str
    primaryLanguage: Optional[str] = None
    stars: Optional[int] = 0
    description: Optional[str] = None


class PortfolioProfileResponse(BaseModel):
    id: str
    userId: Optional[str] = Field(default=None, alias="user_id")
    githubUrl: str = Field(alias="github_url")
    resumeFileName: Optional[str] = Field(default=None, alias="resume_file_name")
    projectArchiveName: Optional[str] = Field(default=None, alias="project_archive_name")
    primaryLanguages: List[str] = Field(alias="primary_languages")
    frameworks: List[str] = Field(default_factory=list)
    status: str = "ready"
    updatedAt: str = Field(alias="updated_at")
    repositories: List[RepositorySummary] = Field(default_factory=list)
    summaryNote: Optional[str] = Field(default=None, alias="summary_note")
    experience_level: str = "intermediate"
    recommended_tracks: List[str] = Field(default_factory=list)

    model_config = {
        "populate_by_name": True,
        "serialize_by_alias": False,
    }

    def to_dict(self) -> Dict[str, Any]:
        """Returns dictionary containing both camelCase and snake_case keys for seamless frontend interop."""
        return {
            "id": self.id,
            "user_id": self.userId or self.id,
            "userId": self.userId or self.id,
            "github_url": self.githubUrl,
            "githubUrl": self.githubUrl,
            "resume_file_name": self.resumeFileName,
            "resumeFileName": self.resumeFileName,
            "project_archive_name": self.projectArchiveName,
            "projectArchiveName": self.projectArchiveName,
            "primary_languages": self.primaryLanguages,
            "primaryLanguages": self.primaryLanguages,
            "frameworks": self.frameworks,
            "status": self.status,
            "updated_at": self.updatedAt,
            "updatedAt": self.updatedAt,
            "repositories": [r.model_dump() for r in self.repositories],
            "summary_note": self.summaryNote,
            "summaryNote": self.summaryNote,
            "experience_level": self.experience_level,
            "recommended_tracks": self.recommended_tracks,
        }


class PortfolioApiResponse(BaseModel):
    success: bool = True
    portfolio: Optional[Dict[str, Any]] = None
    message: Optional[str] = None
