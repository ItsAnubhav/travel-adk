from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    app_name: str = "adk-travel-agents"
    app_env: str = "local"
    log_level: str = "INFO"
    openai_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("OPENAI_API_KEY", "OPENAPI_KEY", "OPENAI_KEY"),
    )
    adk_model: str = "openai/gpt-5-mini"
    database_url: str = "postgresql+asyncpg://adk:adk_password@localhost:5432/adk_travel"
    backend_cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    auth_api_base_url: str = ""

    @property
    def effective_llm_model(self) -> str:
        return self.adk_model

    @property
    def cors_origins(self) -> list[str]:
        return [item.strip() for item in self.backend_cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
