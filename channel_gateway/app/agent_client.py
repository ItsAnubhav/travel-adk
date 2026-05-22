from __future__ import annotations

import httpx

from channel_gateway.app.config import Settings
from channel_gateway.app.schemas import ChatRequest, ChatTurnResponse


class AgentClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def run_turn(self, request: ChatRequest) -> ChatTurnResponse:
        async with httpx.AsyncClient(timeout=self._settings.agent_api_timeout_seconds) as client:
            response = await client.post(
                f"{self._settings.agent_api_base_url.rstrip('/')}/chat/turn",
                json=request.model_dump(exclude_none=True),
            )
            response.raise_for_status()
            return ChatTurnResponse.model_validate(response.json())
