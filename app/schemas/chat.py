from typing import Any, Literal

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    user_id: str = "default-user"
    session_id: str | None = None
    agent: Literal["root", "flight", "expense", "booking"] = "root"
    context: dict[str, Any] = Field(default_factory=dict)


class SessionResponse(BaseModel):
    app_name: str
    user_id: str
    session_id: str


class ChatTurnResponse(BaseModel):
    session_id: str
    agent: str
    message: str = ""
    events: list[dict[str, Any]] = Field(default_factory=list)
    artifacts: list[dict[str, Any]] = Field(default_factory=list)


class ChatHistoryMessage(BaseModel):
    id: int
    session_id: str
    user_id: str
    agent_id: str
    role: str
    event_type: str
    text: str = ""
    artifact_id: str | None = None
    component: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: str


class ChatHistorySession(BaseModel):
    id: str
    user_id: str
    agent_id: str
    title: str
    status: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    created_at: str
    updated_at: str


class ChatHistorySessionDetail(ChatHistorySession):
    messages: list[ChatHistoryMessage] = Field(default_factory=list)


class UIArtifactResponse(BaseModel):
    artifact_id: str
    component: str
    summary: dict[str, Any]
    payload: Any
