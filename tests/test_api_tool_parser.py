from app.core.api_tool_parser import parse_curl_command


def test_parse_curl_command_with_headers_payload_query_and_bearer_auth() -> None:
    config = parse_curl_command(
        """curl -X POST 'https://api.example.com/search?limit=10' \
        -H 'Authorization: Bearer test-token' \
        -H 'Content-Type: application/json' \
        -d '{"origin":"DEL","destination":"BOM"}'"""
    )

    assert config["method"] == "POST"
    assert config["url"] == "https://api.example.com/search?limit=10"
    assert config["headers"]["Content-Type"] == "application/json"
    assert config["query_params"] == {"limit": "10"}
    assert config["payload"] == {"origin": "DEL", "destination": "BOM"}
    assert config["auth"] == {"type": "bearer", "token_present": True}


def test_parse_curl_command_defaults_to_get() -> None:
    config = parse_curl_command("curl https://api.example.com/ping")

    assert config["method"] == "GET"
    assert config["payload"] is None
