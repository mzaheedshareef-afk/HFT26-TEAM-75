from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, field_validator, model_validator


# -------------------------------------------------------------
# Base Responses
# -------------------------------------------------------------

class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail


class UserDetail(BaseModel):
    id: str
    name: str
    email: str
    role: str

    model_config = ConfigDict(from_attributes=True)


class AuthResponse(BaseModel):
    success: bool = True
    access_token: str
    token_type: str = "bearer"
    user: UserDetail


class MeResponse(BaseModel):
    success: bool = True
    user: UserDetail


# -------------------------------------------------------------
# Student Schemas
# -------------------------------------------------------------

class StudentRegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("full_name cannot be empty")
        return trimmed

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class StudentLoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


# -------------------------------------------------------------
# Company Schemas
# -------------------------------------------------------------

class CompanyRegisterRequest(BaseModel):
    company_name: str
    official_email: EmailStr
    password: str

    @field_validator("company_name")
    @classmethod
    def validate_company_name(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("company_name cannot be empty")
        return trimmed

    @field_validator("official_email")
    @classmethod
    def normalize_official_email(cls, v: str) -> str:
        return v.strip().lower()


class CompanyLoginRequest(BaseModel):
    email: Optional[EmailStr] = None
    official_email: Optional[EmailStr] = None
    password: str

    @model_validator(mode="after")
    def validate_email_presence(self):
        resolved_email = self.email or self.official_email
        if not resolved_email:
            raise ValueError("email or official_email is required")
        self.email = resolved_email.strip().lower()
        return self
