from app.core.chat_service import _personalized_message, _request_state_delta


def test_personalized_message_includes_logged_in_user_name() -> None:
    message = _personalized_message(
        "What holidays do I have?",
        {"user_name": "Anubhav", "company_id": "QLABS12345", "source": "SBT"},
        {},
    )

    assert "Private user context" in message
    assert "user_name=Anubhav" in message
    assert "company_id=QLABS12345" in message
    assert "User message:\nWhat holidays do I have?" in message


def test_request_state_delta_promotes_frontend_user_name_to_name() -> None:
    state = _request_state_delta(
        "user-1",
        {"user_name": "Anubhav"},
        {},
    )

    assert state["name"] == "Anubhav"
