from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])


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
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{settings.auth_api_base_url}/auth/login",
                json=request.model_dump(),
            )
        if not response.is_success:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json()

    # Dev bypass — accepts any credentials, returns a minimal valid token structure
    return {
        "success": True,
        "message": "Dev bypass login",
        "decoded_token_data": {
            "company_id": request.companyId,
            "subagent_id": "dev",
            "sa_user_id": "dev",
            "user_name": request.userName,
        },
        "data": {
            "accessToken": "dev-token",
            "refreshToken": "dev-refresh-token",
            "accessTokenExpiresIn": "86400",
            "refreshTokenExpiresIn": "604800",
            "uid": "dev",
            "subAgentId": "dev",
            "saUserId": "dev",
            "corporateId": request.companyId,
        },
    }


@router.post("/refresh")
async def refresh(request: RefreshRequest) -> dict:
    settings = get_settings()

    if settings.auth_api_base_url:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{settings.auth_api_base_url}/auth/refresh",
                json=request.model_dump(),
            )
        if not response.is_success:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json()

    return {
        "success": True,
        "message": "Dev bypass refresh",
        "decoded_token_data": {
            "company_id": "dev",
            "subagent_id": "dev",
            "sa_user_id": "dev",
            "user_name": "dev",
        },
        "data": {
            "accessToken": "dev-token",
            "refreshToken": "dev-refresh-token",
            "accessTokenExpiresIn": "86400",
            "refreshTokenExpiresIn": "604800",
            "uid": "dev",
            "subAgentId": "dev",
            "saUserId": "dev",
            "corporateId": "dev",
        },
    }
