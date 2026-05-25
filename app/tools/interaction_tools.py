from typing import Any

from google.adk.tools import ToolContext

from app.tools.tool_contracts import compact_error, compact_success, ui_tool_payload
from app.ui_artifacts.store import ui_artifact_store


async def ask_user_choice(
    question: str,
    options: list[str],
    allow_free_text: bool = True,
    ui_display: str = "chat",
    tool_context: ToolContext | None = None,
) -> dict[str, Any]:
    """Ask the user to pick one of `options`. Use when the user must disambiguate or confirm.

    The user's selection arrives as their next chat message. After calling this tool,
    do not invoke other tools or assume which option was chosen — wait for the next turn.
    """
    del tool_context
    q = (question or "").strip()
    cleaned_options = [str(o).strip() for o in (options or []) if str(o).strip()]
    if not q:
        return compact_error("question is required")
    if not cleaned_options:
        return compact_error("at least one option is required")

    payload = {
        "question": q,
        "options": cleaned_options,
        "allow_free_text": bool(allow_free_text),
    }
    artifact_id = ui_artifact_store.put(
        "user_choice_prompt",
        payload,
        summary={"question": q, "option_count": len(cleaned_options)},
    )
    return compact_success(
        "Awaiting user selection",
        ui_tool_payload(
            "user_choice_prompt",
            artifact_id,
            ui_display=ui_display,
            question=q,
            options=cleaned_options,
            allow_free_text=bool(allow_free_text),
        ),
    )
