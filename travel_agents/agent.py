"""ADK web entrypoint.

Run from the repository root with:

    adk web . --session_service_uri postgresql+asyncpg://adk:adk_password@localhost:5432/adk_travel
"""

from app.agents.root import root_agent

__all__ = ["root_agent"]
