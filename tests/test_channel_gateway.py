from __future__ import annotations

import base64
import hashlib
import hmac
from email.message import EmailMessage

import pytest

from channel_gateway.app.agent_client import AgentClient
from channel_gateway.app.channels.email_polling import extract_plain_text, parse_email_message
from channel_gateway.app.channels.microsoft_graph_email import (
    graph_message_text,
    graph_message_to_inbound,
    validate_graph_notification_client_state,
)
from channel_gateway.app.channels.telegram import parse_telegram_update
from channel_gateway.app.channels.whatsapp_twilio import parse_twilio_form, validate_twilio_signature
from channel_gateway.app.config import Settings
from channel_gateway.app.formatters import format_artifact_summary
from channel_gateway.app.schemas import ChatRequest
from channel_gateway.app.session_store import ChannelSessionStore


def test_parse_telegram_update_extracts_text_message() -> None:
    inbound = parse_telegram_update(
        {
            "message": {
                "message_id": 42,
                "text": "find flights",
                "chat": {"id": 12345},
            }
        }
    )

    assert inbound is not None
    assert inbound.channel == "telegram"
    assert inbound.external_user_id == "12345"
    assert inbound.external_message_id == "42"
    assert inbound.text == "find flights"


def test_parse_twilio_form_extracts_whatsapp_message() -> None:
    inbound = parse_twilio_form(
        {
            "From": "whatsapp:+15551234567",
            "To": "whatsapp:+15557654321",
            "Body": "hello",
            "MessageSid": "SM123",
        }
    )

    assert inbound.channel == "whatsapp"
    assert inbound.external_user_id == "+15551234567"
    assert inbound.external_message_id == "SM123"
    assert inbound.text == "hello"


def test_validate_twilio_signature() -> None:
    url = "https://example.com/webhooks/whatsapp/twilio"
    params = {"Body": "hello", "From": "whatsapp:+15551234567"}
    token = "secret"
    signed = url + "".join(f"{key}{params[key]}" for key in sorted(params))
    signature = base64.b64encode(hmac.new(token.encode(), signed.encode(), hashlib.sha1).digest()).decode()

    assert validate_twilio_signature(url, params, signature, token)
    assert not validate_twilio_signature(url, params, "wrong", token)


def test_email_plain_text_extraction_and_parse() -> None:
    message = EmailMessage()
    message["From"] = "Ada <ada@example.com>"
    message["Subject"] = "Flights"
    message["Message-ID"] = "<msg-1@example.com>"
    message.set_content("Please find flights")

    assert extract_plain_text(message) == "Please find flights"
    inbound = parse_email_message(message, "uid-1")
    assert inbound.external_user_id == "ada@example.com"
    assert inbound.external_message_id == "<msg-1@example.com>"
    assert inbound.text == "Please find flights"


def test_graph_message_to_inbound_extracts_sender_and_html_body() -> None:
    inbound = graph_message_to_inbound(
        {
            "id": "graph-id-1",
            "internetMessageId": "<msg-1@example.com>",
            "conversationId": "conversation-1",
            "subject": "Flights",
            "from": {"emailAddress": {"address": "ada@example.com"}},
            "body": {"contentType": "html", "content": "<p>Hello<br>Find flights</p>"},
        },
        Settings(microsoft_mailbox="aiva@travog.com"),
    )

    assert inbound.channel == "email"
    assert inbound.external_user_id == "ada@example.com"
    assert inbound.external_message_id == "<msg-1@example.com>"
    assert inbound.thread_id == "conversation-1"
    assert inbound.text == "Hello\nFind flights"
    assert inbound.metadata["source"] == "microsoft_graph"


def test_graph_message_text_falls_back_to_body_preview() -> None:
    assert graph_message_text({"bodyPreview": "Short preview"}) == "Short preview"


def test_graph_notification_client_state_validation() -> None:
    assert validate_graph_notification_client_state({"clientState": "secret"}, "secret")
    assert not validate_graph_notification_client_state({"clientState": "wrong"}, "secret")
    assert validate_graph_notification_client_state({}, "")


@pytest.mark.asyncio
async def test_session_store_creates_reuses_and_resets_session(tmp_path) -> None:
    store = ChannelSessionStore(f"sqlite+aiosqlite:///{tmp_path / 'gateway.db'}")
    await store.initialize()

    assert await store.get_session_id(channel="telegram", external_user_id="1", thread_id="1") is None
    await store.upsert_session_id(
        channel="telegram",
        external_user_id="1",
        thread_id="1",
        agent_session_id="agent-session-1",
    )
    assert (
        await store.get_session_id(channel="telegram", external_user_id="1", thread_id="1")
        == "agent-session-1"
    )
    assert await store.mark_message_started(channel="telegram", external_message_id="42")
    assert not await store.mark_message_started(channel="telegram", external_message_id="42")
    await store.reset_session(channel="telegram", external_user_id="1", thread_id="1")
    assert await store.get_session_id(channel="telegram", external_user_id="1", thread_id="1") is None
    await store.set_value("subscription_id", "sub-1")
    assert await store.get_value("subscription_id") == "sub-1"


def test_formatter_limits_result_items() -> None:
    text = format_artifact_summary(
        {
            "summary": {
                "offers": [
                    {"airline": "A", "price": 100},
                    {"airline": "B", "price": 200},
                    {"airline": "C", "price": 300},
                ]
            }
        },
        result_limit=2,
    )

    assert "1. A | 100" in text
    assert "2. B | 200" in text
    assert "C | 300" not in text


@pytest.mark.asyncio
async def test_agent_client_sends_chat_turn_request(monkeypatch) -> None:
    captured = {}

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {"session_id": "s1", "agent": "root", "message": "ok", "events": [], "artifacts": []}

    class FakeAsyncClient:
        def __init__(self, timeout):
            captured["timeout"] = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def post(self, url, json):
            captured["url"] = url
            captured["json"] = json
            return FakeResponse()

    monkeypatch.setattr("channel_gateway.app.agent_client.httpx.AsyncClient", FakeAsyncClient)

    client = AgentClient(Settings(agent_api_base_url="http://agent.local/api", agent_api_timeout_seconds=9))
    response = await client.run_turn(
        request=ChatRequest(
            message="Hi",
            user_id="telegram:1",
            agent="root",
        )
    )

    assert captured["timeout"] == 9
    assert captured["url"] == "http://agent.local/api/chat/turn"
    assert captured["json"]["user_id"] == "telegram:1"
    assert response.message == "ok"
