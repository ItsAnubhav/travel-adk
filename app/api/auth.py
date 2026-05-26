from __future__ import annotations

import base64
import hashlib
import hmac
import json
from pathlib import Path
import time

import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.config import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])

DEV_LOGIN_RESPONSE_PATH = Path(__file__).resolve().parent / "dev_login_response.json"
DEV_JWT_SECRET = b"dev-only-secret"


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _decode_jwt_payload(token: str) -> dict:
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        return json.loads(base64.urlsafe_b64decode(payload.encode("ascii")))
    except Exception:
        return {}


def _encode_dev_jwt(claims: dict) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    signing_input = ".".join(
        [
            _b64url(json.dumps(header, separators=(",", ":")).encode("utf-8")),
            _b64url(json.dumps(claims, separators=(",", ":")).encode("utf-8")),
        ]
    )
    signature = hmac.new(DEV_JWT_SECRET, signing_input.encode("ascii"), hashlib.sha256).digest()
    return f"{signing_input}.{_b64url(signature)}"


def _dev_bypass_response() -> dict:
    payload = json.loads(DEV_LOGIN_RESPONSE_PATH.read_text())
    data = payload.get("data")
    if not isinstance(data, dict):
        return payload

    now = int(time.time())
    access_claims = _decode_jwt_payload(str(data.get("accessToken", "")))
    access_claims.update({"iat": now, "nbf": now, "exp": now + 60 * 60})
    data["accessToken"] = _encode_dev_jwt(access_claims)

    refresh_claims = _decode_jwt_payload(str(data.get("refreshToken", ""))) or access_claims.copy()
    refresh_claims.update({"iat": now, "nbf": now, "exp": now + 7 * 24 * 60 * 60})
    data["refreshToken"] = _encode_dev_jwt(refresh_claims)
    data["accessTokenExpiresIn"] = "60 minutes"
    data["refreshTokenExpiresIn"] = "7 days"
    return payload


class LoginRequest(BaseModel):
    companyId: str = ""
    accountNo: str = ""
    userName: str
    password: str
    source: str = "SBT"


class RefreshRequest(BaseModel):
    refreshToken: str


@router.post("/login")
async def login(request: LoginRequest) -> dict:
    settings = get_settings()

    if settings.auth_api_base_url:
        base_url = settings.auth_api_base_url.rstrip("/")
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{base_url}/forge/api/v1/auth/jwt/login",
                json={**request.model_dump(), "accountNo": ""},
            )
        try:
            payload = response.json()
        except ValueError:
            payload = {"success": False, "message": response.text or "Login failed"}
        return JSONResponse(status_code=response.status_code, content=payload)

    return _dev_bypass_response()


@router.post("/refresh")
async def refresh(request: RefreshRequest) -> dict:
    settings = get_settings()

    if settings.auth_api_base_url:
        base_url = settings.auth_api_base_url.rstrip("/")
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{base_url}/forge/api/v1/auth/jwt/refresh",
                json=request.model_dump(),
            )
        try:
            payload = response.json()
        except ValueError:
            payload = {"success": False, "message": response.text or "Refresh failed"}
        return JSONResponse(status_code=response.status_code, content=payload)

    return _dev_bypass_response()
