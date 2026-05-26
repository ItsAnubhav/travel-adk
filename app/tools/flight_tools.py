from typing import Any

from google.adk.tools import ToolContext

from app.tools.tool_contracts import compact_error, compact_success, ui_tool_payload
from app.ui_artifacts.store import ui_artifact_store


_ALLOWED_TRIP_TYPES = {"OW", "RT"}
_ALLOWED_CABINS = {"economy", "premium_economy", "business", "first"}


def _airport_code(value: str) -> str:
    return str(value or "").strip().upper()[:3]


def _country_code(value: str) -> str:
    return str(value or "").strip().upper()[:2]


def _positive_int(value: int, fallback: int = 0) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return fallback


def _normalize_cabin(value: str) -> str:
    cabin = str(value or "economy").strip().lower().replace("-", "_")
    if cabin == "premium economy":
        cabin = "premium_economy"
    return cabin if cabin in _ALLOWED_CABINS else "economy"


def _normalize_trip_type(value: str, return_date: str) -> str:
    trip_type = str(value or ("RT" if return_date else "OW")).strip().upper()
    return trip_type if trip_type in _ALLOWED_TRIP_TYPES else "OW"


def _normalize_carriers(value: list[str] | None) -> list[str]:
    if not value:
        return []
    return [
        str(carrier).strip().upper()
        for carrier in value
        if str(carrier or "").strip()
    ]


async def flight_search_tool(
    origin: str,
    destination: str,
    depart_date: str,
    return_date: str = "",
    trip_type: str = "OW",
    cabin: str = "economy",
    adults: int = 1,
    children: int = 0,
    infants: int = 0,
    currency_code: str = "AED",
    dep_country_code: str = "",
    arr_country_code: str = "",
    carriers: list[str] | None = None,
    ui_display: str = "chat",
    tool_context: ToolContext | None = None,
) -> dict[str, Any]:
    """Open the flight search UI for the supplied route/date request.

    The frontend runs the AirShopping request and drives the remaining booking
    workflow, so this tool only packages the initial search parameters for the
    embedded flight test/result view.
    """
    if tool_context is not None:
        tool_context.actions.skip_summarization = True

    normalized_origin = _airport_code(origin)
    normalized_destination = _airport_code(destination)
    normalized_depart_date = str(depart_date or "").strip()
    normalized_return_date = str(return_date or "").strip()

    if not normalized_origin:
        return compact_error("origin is required")
    if not normalized_destination:
        return compact_error("destination is required")
    if not normalized_depart_date:
        return compact_error("depart_date is required")

    normalized_trip_type = _normalize_trip_type(trip_type, normalized_return_date)
    if normalized_trip_type == "RT" and not normalized_return_date:
        return compact_error("return_date is required for round-trip flight search")

    adult_count = max(1, _positive_int(adults, 1))
    child_count = _positive_int(children)
    infant_count = _positive_int(infants)
    normalized_currency = str(currency_code or "AED").strip().upper() or "AED"

    summary = {
        "origin": normalized_origin,
        "destination": normalized_destination,
        "depart_date": normalized_depart_date,
        "return_date": normalized_return_date or None,
        "trip_type": normalized_trip_type,
        "cabin": _normalize_cabin(cabin),
        "pax": {
            "adults": adult_count,
            "children": child_count,
            "infants": infant_count,
        },
        "currency": normalized_currency,
        "dep_country_code": _country_code(dep_country_code),
        "arr_country_code": _country_code(arr_country_code),
        "carriers": _normalize_carriers(carriers),
    }
    fallback_text = (
        f"Opening flight search for {summary['origin']} to {summary['destination']} "
        f"on {summary['depart_date']}."
    )

    artifact_id = ui_artifact_store.put(
        "flight_test_page",
        {"search_request": summary},
        summary={
            "title": fallback_text,
            "origin": summary["origin"],
            "destination": summary["destination"],
            "depart_date": summary["depart_date"],
            "return_date": summary["return_date"],
            "trip_type": summary["trip_type"],
            "cabin": summary["cabin"],
        },
    )
    return compact_success(
        fallback_text,
        ui_tool_payload(
            "flight_test_page",
            artifact_id,
            ui_display=ui_display,
            search_request=summary,
            frontend_only=True,
        ),
    )
