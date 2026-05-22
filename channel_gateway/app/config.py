from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    agent_api_base_url: str = "http://agent-api:8000/api"
    agent_api_timeout_seconds: float = 120
    default_agent: str = "root"
    channel_result_limit: int = 5
    public_app_url: str = "http://localhost:5173"
    public_gateway_url: str = "http://localhost:8010"
    gateway_database_url: str = (
        "postgresql+asyncpg://gateway:gateway_password@localhost:5433/channel_gateway"
    )

    telegram_bot_token: str = ""
    telegram_webhook_secret: str = ""

    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_whatsapp_from: str = "whatsapp:+0000000000"

    email_imap_host: str = ""
    email_imap_port: int = 993
    email_imap_user: str = ""
    email_imap_password: str = ""
    email_imap_folder: str = "INBOX"
    email_poll_interval_seconds: int = 30

    email_smtp_host: str = ""
    email_smtp_port: int = 587
    email_smtp_user: str = ""
    email_smtp_password: str = ""
    email_from: str = Field(default="", validation_alias="EMAIL_FROM")

    microsoft_tenant_id: str = ""
    microsoft_client_id: str = ""
    microsoft_client_secret: str = ""
    microsoft_mailbox: str = "aiva@travog.com"
    microsoft_webhook_client_state: str = ""
    microsoft_subscription_renewal_seconds: int = 3600


@lru_cache
def get_settings() -> Settings:
    return Settings()
