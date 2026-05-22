from typing import Any

from google.adk.tools import ToolContext

from app.core.personalization import get_personalization_service
from app.tools.tool_contracts import compact_error, compact_success


def _user_id_from_context(tool_context: ToolContext | None) -> str:
    if tool_context is None:
        return ""
    value = tool_context.state.get("user_id")
    return value if isinstance(value, str) else ""


async def suggest_user_preference(
    category: str,
    key: str,
    value: Any,
    confidence: float = 0.8,
    source_text: str = "",
    tool_context: ToolContext | None = None,
) -> dict[str, Any]:
    """Create a pending travel preference suggestion for the current user."""
    user_id = _user_id_from_context(tool_context)
    if not user_id:
        return compact_error("Cannot suggest a preference without a user_id in session state")
    if not category.strip() or not key.strip():
        return compact_error("category and key are required")

    preference = await get_personalization_service().create_preference(
        user_id=user_id,
        category=category,
        key=key,
        value=value,
        confidence=confidence,
        source="agent",
        source_text=source_text,
        status="pending",
    )
    return compact_success(
        "Preference suggestion saved for confirmation",
        {"preference": preference},
    )


async def get_user_preferences(tool_context: ToolContext | None = None) -> dict[str, Any]:
    """Return active travel preferences for the current user."""
    user_id = _user_id_from_context(tool_context)
    if not user_id:
        return compact_error("Cannot load preferences without a user_id in session state")

    preferences = await get_personalization_service().list_preferences(user_id, status="active")
    return compact_success("User preferences loaded", {"preferences": preferences})
