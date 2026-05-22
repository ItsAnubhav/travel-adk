from typing import Any, Literal

from pydantic import BaseModel, Field


ControlStatus = Literal["enabled", "disabled", "maintenance"]
ToolKind = Literal["builtin", "mcp", "api", "function"]


class StatusUpdateRequest(BaseModel):
    status: ControlStatus
    admin_user_id: str = "local-admin"


class ToolCreateRequest(BaseModel):
    id: str = Field(pattern=r"^[a-zA-Z0-9_.-]+$")
    name: str = Field(min_length=1)
    description: str = ""
    kind: ToolKind
    config: dict[str, Any] = Field(default_factory=dict)
    curl_command: str | None = None
    auth_secret_ref: str | None = None
    admin_user_id: str = "local-admin"
