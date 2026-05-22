from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.personalization import get_personalization_service

router = APIRouter(prefix="/personalization", tags=["personalization"])


class PreferenceStatusResponse(BaseModel):
    preference: dict[str, Any]


class PendingPreferencesResponse(BaseModel):
    preferences: list[dict[str, Any]] = Field(default_factory=list)


@router.get("/preferences/pending", response_model=PendingPreferencesResponse)
async def list_pending_preferences(user_id: str) -> PendingPreferencesResponse:
    preferences = await get_personalization_service().list_preferences(user_id, status="pending")
    return PendingPreferencesResponse(preferences=preferences)


@router.post("/preferences/{preference_id}/accept", response_model=PreferenceStatusResponse)
async def accept_preference(preference_id: str, user_id: str) -> PreferenceStatusResponse:
    return await _set_status(preference_id, user_id, "active")


@router.post("/preferences/{preference_id}/reject", response_model=PreferenceStatusResponse)
async def reject_preference(preference_id: str, user_id: str) -> PreferenceStatusResponse:
    return await _set_status(preference_id, user_id, "rejected")


async def _set_status(
    preference_id: str,
    user_id: str,
    status: Literal["active", "rejected"],
) -> PreferenceStatusResponse:
    preference = await get_personalization_service().set_preference_status(
        preference_id=preference_id,
        user_id=user_id,
        status=status,
    )
    if preference is None:
        raise HTTPException(status_code=404, detail="Preference not found")
    return PreferenceStatusResponse(preference=preference)
