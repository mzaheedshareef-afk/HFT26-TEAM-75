from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # App Settings
    PROJECT_NAME: str = "Portfolio-Driven Adaptive Coding & Technical Assessment Platform"
    API_PREFIX: str = "/api"
    DEBUG: bool = False

    # Supabase Configuration
    SUPABASE_URL: str = "https://placeholder-project.supabase.co"
    SUPABASE_KEY: str = "placeholder-key"
    SUPABASE_JWT_SECRET: str = "placeholder-jwt-secret-min-32-chars-long"

    # Featherless AI Configuration
    FEATHERLESS_API_KEY: str = "placeholder-featherless-key"
    FEATHERLESS_BASE_URL: str = "https://api.featherless.ai/v1"
    FEATHERLESS_MODEL: str = "meta-llama/Meta-Llama-3.1-70B-Instruct"

    # Docker Sandbox Configuration
    DOCKER_SANDBOX_IMAGE: str = "python:3.12-slim"
    DOCKER_TIMEOUT_SECONDS: float = 2.0
    DOCKER_MEMORY_LIMIT_MB: int = 256

    # CORS Settings
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow",
    )


settings = Settings()
