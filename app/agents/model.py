import os

from google.adk.models.lite_llm import LiteLlm

from app.config import get_settings


def openai_model() -> LiteLlm:
    """Return the configured OpenAI model through ADK's LiteLLM adapter."""
    settings = get_settings()
    if settings.openai_api_key:
        os.environ["OPENAI_API_KEY"] = settings.openai_api_key
    return LiteLlm(model=settings.adk_model)
