from typing import Any

from google.adk.tools import ToolContext

from app.core.dependencies import get_travog_booking_service
from app.tools.tool_contracts import compact_error, compact_success, ui_tool_payload
from app.ui_artifacts.store import ui_artifact_store


def _auth_from_context(
    access_token: str = "",
    refresh_token: str = "",
    tool_context: ToolContext | None = None,
) -> tuple[str, str]:
    if tool_context is None:
        return access_token, refresh_token

    state_access_token = tool_context.state.get("travog_access_token")
    state_refresh_token = tool_context.state.get("travog_refresh_token")

    return (
        access_token or (state_access_token if isinstance(state_access_token, str) else ""),
        refresh_token or (state_refresh_token if isinstance(state_refresh_token, str) else ""),
    )


async def get_booking(
    booking_ref: str,
    access_token: str = "",
    refresh_token: str = "",
    ui_display: str = "chat",
    tool_context: ToolContext | None = None,
) -> dict[str, Any]:
    """Fetch booking details by booking reference. Set ui_display to chat or split_view."""
    access_token, refresh_token = _auth_from_context(access_token, refresh_token, tool_context)
    if not access_token:
        return compact_error("Travog access token is missing. Open the app with ?access_token=YOUR_TOKEN.")
    if not str(booking_ref or "").strip():
        return compact_error("booking_ref is required")

    payload, new_token = await get_travog_booking_service().get_booking(
        access_token=access_token,
        booking_ref=booking_ref,
        refresh_token=refresh_token,
    )
    if payload is None:
        return compact_error("Booking lookup failed")

    artifact_id = ui_artifact_store.put(
        "booking_details",
        payload,
        summary={"booking_ref": booking_ref},
    )
    return compact_success(
        "Booking details ready",
        ui_tool_payload(
            "booking_details",
            artifact_id,
            ui_display=ui_display,
            new_access_token=new_token,
        ),
    )


async def get_fare_rules(
    flight_id: str,
    access_token: str = "",
    refresh_token: str = "",
    ui_display: str = "chat",
    tool_context: ToolContext | None = None,
) -> dict[str, Any]:
    """Fetch fare rules by flight_id. Set ui_display to chat or split_view."""
    access_token, refresh_token = _auth_from_context(access_token, refresh_token, tool_context)
    if not access_token:
        return compact_error("Travog access token is missing. Open the app with ?access_token=YOUR_TOKEN.")
    if not str(flight_id or "").strip():
        return compact_error("flight_id is required. Call get_booking first and use a flightId from booking details.")

    payload, new_token = await get_travog_booking_service().get_fare_rules(
        access_token=access_token,
        flight_id=flight_id,
        refresh_token=refresh_token,
    )
    if payload is None:
        return compact_error("Fare rules lookup failed")

    artifact_id = ui_artifact_store.put(
        "fare_rules",
        payload,
        summary={"flight_id": flight_id},
    )
    return compact_success(
        "Fare rules ready",
        ui_tool_payload(
            "fare_rules",
            artifact_id,
            ui_display=ui_display,
            new_access_token=new_token,
        ),
    )


async def get_cancellation_policy(booking_ref: str) -> dict[str, Any]:
    """Explain where cancellation policy lives for the supplied booking reference."""
    return compact_success(
        "Cancellation policy lookup queued",
        {
            "booking_ref": booking_ref,
            "next_step": "Wire this to the Travog cancellation endpoint when available.",
        },
    )


async def get_reissue_policy(booking_ref: str) -> dict[str, Any]:
    """Explain where reissue policy lives for the supplied booking reference."""
    return compact_success(
        "Reissue policy lookup queued",
        {
            "booking_ref": booking_ref,
            "next_step": "Wire this to the Travog reissue endpoint when available.",
        },
    )
