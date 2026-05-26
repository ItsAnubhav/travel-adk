from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    app_name: str
    app_env: str
    log_level: str
    openai_api_key: str = Field(
        validation_alias=AliasChoices("OPENAI_API_KEY", "OPENAPI_KEY", "OPENAI_KEY"),
    )
    adk_model: str
    database_url: str
    backend_cors_origins: str
    auth_api_base_url: str
    rag_embedding_model: str = "openai/text-embedding-3-small"
    rag_embedding_dimension: int = 1536
    rag_top_k: int = 5
    rag_max_upload_mb: int = 25

    @property
    def effective_llm_model(self) -> str:
        return self.adk_model

    @property
    def cors_origins(self) -> list[str]:
        return [item.strip() for item in self.backend_cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
