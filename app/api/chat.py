from __future__ import annotations

import json
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

from app.config import get_settings
from app.core.chat_history import chat_history_store
from app.core.chat_service import run_chat_turn, session_service, stream_chat_events
from app.schemas.chat import (
    ChatHistorySession,
    ChatHistorySessionDetail,
    ChatRequest,
    ChatTurnResponse,
    SessionResponse,
)

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/sessions", response_model=SessionResponse)
async def create_session(user_id: str = "default-user") -> SessionResponse:
    settings = get_settings()
    session_id = str(uuid.uuid4())
    service = session_service()
    await service.create_session(
        app_name=settings.app_name,
        user_id=user_id,
        session_id=session_id,
        state={},
    )
    return SessionResponse(app_name=settings.app_name, user_id=user_id, session_id=session_id)


@router.get("/sessions", response_model=list[ChatHistorySession])
async def list_chat_sessions(user_id: str = "default-user") -> list[dict[str, Any]]:
    return await chat_history_store.list_sessions(user_id=user_id)


@router.get("/sessions/{session_id}", response_model=ChatHistorySessionDetail)
async def get_chat_session(session_id: str, user_id: str = "default-user") -> dict[str, Any]:
    session = await chat_history_store.get_session(user_id=user_id, session_id=session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    return session


@router.post("/stream")
async def stream_chat(request: ChatRequest) -> EventSourceResponse:
    async def events():
        async for payload in stream_chat_events(request):
            yield _sse(payload["event"], payload["data"])

    return EventSourceResponse(events())


@router.post("/turn", response_model=ChatTurnResponse)
async def chat_turn(request: ChatRequest) -> ChatTurnResponse:
    result = await run_chat_turn(request)
    return ChatTurnResponse(
        session_id=result.session_id,
        agent=result.agent,
        message=result.message,
        events=result.events,
        artifacts=result.artifacts,
    )


def _sse(event: str, data: dict[str, Any]) -> dict[str, str]:
    return {"event": event, "data": json.dumps(data, default=str)}
