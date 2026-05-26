from google.adk.events.event_actions import EventActions

from app.tools.flight_tools import flight_search_tool
from app.tools.tool_contracts import UIToolEnvelope, ui_tool_payload


def test_ui_tool_envelope_shape() -> None:
    envelope = UIToolEnvelope(
        ui_component="flight_search_results",
        artifact_id="artifact-1",
        summary={"offers": 12},
    )

    assert envelope.model_dump()["type"] == "ui_component"
    assert envelope.artifact_id == "artifact-1"
    assert envelope.ui_display == "chat"


def test_ui_tool_payload_allows_split_view() -> None:
    payload = ui_tool_payload(
        "booking_details",
        "artifact-2",
        ui_display="split_view",
        new_access_token="token-1",
    )

    assert payload["ui_display"] == "split_view"
    assert payload["new_access_token"] == "token-1"


def test_ui_tool_payload_defaults_invalid_display_to_chat() -> None:
    payload = ui_tool_payload("expense_report", "artifact-3", ui_display="modal")

    assert payload["ui_display"] == "chat"


async def test_flight_search_tool_opens_flight_test_page() -> None:
    class DummyToolContext:
        actions = EventActions()

    tool_context = DummyToolContext()
    result = await flight_search_tool(
        origin="del",
        destination="lhr",
        depart_date="2026-07-23",
        return_date="2026-07-27",
        trip_type="RT",
        cabin="business",
        adults=2,
        carriers=["ek"],
        tool_context=tool_context,
    )

    assert result["ok"] is True
    assert tool_context.actions.skip_summarization is True
    assert result["data"]["ui_component"] == "flight_test_page"
    assert result["data"]["frontend_only"] is True
    assert result["data"]["search_request"] == {
        "origin": "DEL",
        "destination": "LHR",
        "depart_date": "2026-07-23",
        "return_date": "2026-07-27",
        "trip_type": "RT",
        "cabin": "business",
        "pax": {"adults": 2, "children": 0, "infants": 0},
        "currency": "AED",
        "dep_country_code": "",
        "arr_country_code": "",
        "carriers": ["EK"],
    }
