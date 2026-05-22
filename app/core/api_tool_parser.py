from __future__ import annotations

import json
import shlex
from typing import Any
from urllib.parse import parse_qsl, urlsplit


def parse_curl_command(command: str) -> dict[str, Any]:
    tokens = shlex.split(command.strip())
    if not tokens or tokens[0] != "curl":
        raise ValueError("API tool curl command must start with curl")

    method = ""
    headers: dict[str, str] = {}
    query_params: dict[str, str] = {}
    payload: Any = None
    payload_raw = ""
    url = ""
    auth: dict[str, Any] | None = None
    timeout_ms = 30000

    index = 1
    while index < len(tokens):
        token = tokens[index]
        if token in {"-X", "--request"}:
            method = _next_value(tokens, index, token).upper()
            index += 2
            continue
        if token.startswith("-X") and len(token) > 2:
            method = token[2:].upper()
            index += 1
            continue
        if token in {"-H", "--header"}:
            name, value = _parse_header(_next_value(tokens, index, token))
            headers[name] = value
            index += 2
            continue
        if token in {"-d", "--data", "--data-raw", "--data-binary", "--data-ascii"}:
            payload_raw = _next_value(tokens, index, token)
            payload = _parse_payload(payload_raw)
            if not method:
                method = "POST"
            index += 2
            continue
        if token.startswith("--url"):
            if token == "--url":
                url = _next_value(tokens, index, token)
                index += 2
            else:
                url = token.split("=", 1)[1]
                index += 1
            continue
        if token in {"-u", "--user"}:
            username, password = _parse_basic_auth(_next_value(tokens, index, token))
            auth = {"type": "basic", "username": username, "password_present": bool(password)}
            index += 2
            continue
        if token in {"--connect-timeout", "--max-time"}:
            timeout_ms = int(float(_next_value(tokens, index, token)) * 1000)
            index += 2
            continue
        if token.startswith("http://") or token.startswith("https://"):
            url = token
        index += 1

    if not url:
        raise ValueError("API tool curl command must include an http or https URL")

    parsed_url = urlsplit(url)
    if parsed_url.query:
        query_params = dict(parse_qsl(parsed_url.query, keep_blank_values=True))

    if "authorization" in {key.lower() for key in headers} and auth is None:
        auth = _auth_from_authorization_header(headers)

    return {
        "source": "curl",
        "method": method or "GET",
        "url": url,
        "headers": headers,
        "query_params": query_params,
        "payload": payload,
        "payload_raw": payload_raw,
        "auth": auth,
        "timeout_ms": timeout_ms,
    }


def _next_value(tokens: list[str], index: int, flag: str) -> str:
    try:
        return tokens[index + 1]
    except IndexError as exc:
        raise ValueError(f"{flag} requires a value") from exc


def _parse_header(value: str) -> tuple[str, str]:
    if ":" not in value:
        raise ValueError(f"Invalid header: {value}")
    name, header_value = value.split(":", 1)
    return name.strip(), header_value.strip()


def _parse_payload(value: str) -> Any:
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return value


def _parse_basic_auth(value: str) -> tuple[str, str]:
    username, _, password = value.partition(":")
    return username, password


def _auth_from_authorization_header(headers: dict[str, str]) -> dict[str, Any] | None:
    for name, value in headers.items():
        if name.lower() != "authorization":
            continue
        scheme, _, token = value.partition(" ")
        if scheme.lower() == "bearer" and token:
            return {"type": "bearer", "token_present": True}
        if scheme.lower() == "basic" and token:
            return {"type": "basic", "token_present": True}
    return None
