from typing import Any, Literal

from pydantic import BaseModel, Field

UIDisplayTarget = Literal["chat", "split_view"]


class UIToolEnvelope(BaseModel):
    type: Literal["ui_component"] = "ui_component"
    ui_component: str
    artifact_id: str
    ui_display: UIDisplayTarget = "chat"
    summary: dict[str, Any] = Field(default_factory=dict)


def normalize_ui_display(value: str | None) -> UIDisplayTarget:
    return "split_view" if value == "split_view" else "chat"


def ui_tool_payload(
    ui_component: str,
    artifact_id: str,
    *,
    ui_display: str | None = "chat",
    **extra: Any,
) -> dict[str, Any]:
    return {
        "ui_component": ui_component,
        "artifact_id": artifact_id,
        "ui_display": normalize_ui_display(ui_display),
        **extra,
    }


def compact_success(message: str, data: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"ok": True, "message": message, "data": data or {}}


def compact_error(message: str, details: Any = None) -> dict[str, Any]:
    body: dict[str, Any] = {"ok": False, "message": message}
    if details is not None:
        body["details"] = details
    return body
