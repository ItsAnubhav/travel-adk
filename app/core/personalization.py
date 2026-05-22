from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

from sqlalchemy import Column, DateTime, Float, MetaData, String, Table, Text, select, update
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.config import get_settings

metadata = MetaData()

user_profiles = Table(
    "user_profiles",
    metadata,
    Column("user_id", String(128), primary_key=True),
    Column("profile_json", JSONB, nullable=False, default=dict),
    Column("source", String(64), nullable=False, default="frontend"),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

user_preferences = Table(
    "user_preferences",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("user_id", String(128), nullable=False, index=True),
    Column("category", String(80), nullable=False),
    Column("key", String(120), nullable=False),
    Column("value_json", JSONB, nullable=False),
    Column("confidence", Float, nullable=False, default=0.8),
    Column("status", String(24), nullable=False, default="pending"),
    Column("source", String(64), nullable=False, default="agent"),
    Column("source_text", Text, nullable=False, default=""),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
    Column("confirmed_at", DateTime(timezone=True), nullable=True),
)


class PersonalizationService:
    """DB-backed user profile and preference store."""

    def __init__(self, database_url: str):
        self._engine: AsyncEngine = create_async_engine(database_url)
        self._init_lock = asyncio.Lock()
        self._initialized = False

    async def _ensure_tables(self) -> None:
        if self._initialized:
            return
        async with self._init_lock:
            if self._initialized:
                return
            async with self._engine.begin() as conn:
                await conn.run_sync(metadata.create_all)
            self._initialized = True

    async def upsert_profile(
        self,
        user_id: str,
        profile: dict[str, Any],
        source: str = "frontend",
    ) -> None:
        if not user_id or not profile:
            return
        await self._ensure_tables()
        now = _utcnow()
        async with self._engine.begin() as conn:
            existing = await conn.execute(
                select(user_profiles.c.user_id).where(user_profiles.c.user_id == user_id)
            )
            if existing.scalar_one_or_none():
                await conn.execute(
                    update(user_profiles)
                    .where(user_profiles.c.user_id == user_id)
                    .values(profile_json=profile, source=source, updated_at=now)
                )
            else:
                await conn.execute(
                    user_profiles.insert().values(
                        user_id=user_id,
                        profile_json=profile,
                        source=source,
                        created_at=now,
                        updated_at=now,
                    )
                )

    async def get_profile(self, user_id: str) -> dict[str, Any]:
        if not user_id:
            return {}
        await self._ensure_tables()
        async with self._engine.connect() as conn:
            result = await conn.execute(
                select(user_profiles.c.profile_json).where(user_profiles.c.user_id == user_id)
            )
            profile = result.scalar_one_or_none()
        return profile if isinstance(profile, dict) else {}

    async def create_preference(
        self,
        user_id: str,
        category: str,
        key: str,
        value: Any,
        confidence: float = 0.8,
        source: str = "agent",
        source_text: str = "",
        status: str = "pending",
    ) -> dict[str, Any]:
        await self._ensure_tables()
        now = _utcnow()
        preference_id = str(uuid.uuid4())
        row = {
            "id": preference_id,
            "user_id": user_id,
            "category": category.strip(),
            "key": key.strip(),
            "value_json": value,
            "confidence": max(0.0, min(float(confidence), 1.0)),
            "status": status,
            "source": source,
            "source_text": source_text.strip(),
            "created_at": now,
            "updated_at": now,
            "confirmed_at": now if status == "active" else None,
        }
        async with self._engine.begin() as conn:
            await conn.execute(user_preferences.insert().values(**row))
        return _serialize_preference(row)

    async def list_preferences(self, user_id: str, status: str = "active") -> list[dict[str, Any]]:
        if not user_id:
            return []
        await self._ensure_tables()
        query = select(user_preferences).where(user_preferences.c.user_id == user_id)
        if status:
            query = query.where(user_preferences.c.status == status)
        query = query.order_by(user_preferences.c.updated_at.desc())
        async with self._engine.connect() as conn:
            result = await conn.execute(query)
            rows = result.mappings().all()
        return [_serialize_preference(dict(row)) for row in rows]

    async def set_preference_status(
        self,
        preference_id: str,
        user_id: str,
        status: str,
    ) -> dict[str, Any] | None:
        await self._ensure_tables()
        now = _utcnow()
        values: dict[str, Any] = {"status": status, "updated_at": now}
        if status == "active":
            values["confirmed_at"] = now
        async with self._engine.begin() as conn:
            await conn.execute(
                update(user_preferences)
                .where(user_preferences.c.id == preference_id)
                .where(user_preferences.c.user_id == user_id)
                .values(**values)
            )
            result = await conn.execute(
                select(user_preferences)
                .where(user_preferences.c.id == preference_id)
                .where(user_preferences.c.user_id == user_id)
            )
            row = result.mappings().one_or_none()
        return _serialize_preference(dict(row)) if row else None

    async def load_agent_context(self, user_id: str) -> dict[str, Any]:
        profile, preferences = await asyncio.gather(
            self.get_profile(user_id),
            self.list_preferences(user_id, status="active"),
        )
        return {"profile": profile, "preferences": preferences}


def format_agent_personalization(context: dict[str, Any]) -> str:
    profile = context.get("profile") if isinstance(context, dict) else None
    preferences = context.get("preferences") if isinstance(context, dict) else None
    lines: list[str] = []
    if isinstance(profile, dict) and profile:
        compact_profile = {
            key: value
            for key, value in profile.items()
            if key.lower() not in {"access_token", "refresh_token", "token", "password"}
        }
        if compact_profile:
            lines.append(f"profile={compact_profile}")
    if isinstance(preferences, list) and preferences:
        pref_bits = [
            f"{item.get('category')}.{item.get('key')}={item.get('value')}"
            for item in preferences[:20]
        ]
        lines.append("preferences=" + "; ".join(pref_bits))
    return "\n".join(lines)


def _serialize_preference(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row.get("id"),
        "user_id": row.get("user_id"),
        "category": row.get("category"),
        "key": row.get("key"),
        "value": row.get("value_json"),
        "confidence": row.get("confidence"),
        "status": row.get("status"),
        "source": row.get("source"),
        "source_text": row.get("source_text"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
        "confirmed_at": row.get("confirmed_at"),
    }


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@lru_cache
def get_personalization_service() -> PersonalizationService:
    return PersonalizationService(get_settings().database_url)
