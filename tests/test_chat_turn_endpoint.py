from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import chat as chat_api


@dataclass
class FakeChatResult:
    session_id: str
    agent: str
    message: str
    events: list[dict[str, Any]] = field(default_factory=list)
    artifacts: list[dict[str, Any]] = field(default_factory=list)


def test_chat_turn_endpoint_returns_collected_response(monkeypatch) -> None:
    async def fake_run_chat_turn(request):
        return FakeChatResult(
            session_id=request.session_id or "session-1",
            agent=request.agent,
            message="Hello from the agent",
            events=[{"event": "message", "data": {"text": "Hello from the agent", "final": True}}],
            artifacts=[{"artifact_id": "artifact-1", "ui_component": "flight_search_results"}],
        )

    monkeypatch.setattr(chat_api, "run_chat_turn", fake_run_chat_turn)
    app = FastAPI()
    app.include_router(chat_api.router, prefix="/api")
    client = TestClient(app)

    response = client.post(
        "/api/chat/turn",
        json={"message": "Hi", "user_id": "telegram:1", "agent": "root"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "session_id": "session-1",
        "agent": "root",
        "message": "Hello from the agent",
        "events": [{"event": "message", "data": {"text": "Hello from the agent", "final": True}}],
        "artifacts": [{"artifact_id": "artifact-1", "ui_component": "flight_search_results"}],
    }


def test_chat_stream_endpoint_still_emits_sse(monkeypatch) -> None:
    async def fake_stream_chat_events(_request):
        yield {"event": "session", "data": {"session_id": "session-1", "agent": "root"}}
        yield {"event": "message", "data": {"text": "Hello", "final": True}}
        yield {"event": "done", "data": {"session_id": "session-1"}}

    monkeypatch.setattr(chat_api, "stream_chat_events", fake_stream_chat_events)
    app = FastAPI()
    app.include_router(chat_api.router, prefix="/api")
    client = TestClient(app)

    response = client.post("/api/chat/stream", json={"message": "Hi", "agent": "root"})

    assert response.status_code == 200
    assert "event: session" in response.text
    assert "event: message" in response.text
    assert "event: done" in response.text
