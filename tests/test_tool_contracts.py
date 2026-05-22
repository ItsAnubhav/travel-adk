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
