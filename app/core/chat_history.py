from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Column, DateTime, Integer, MetaData, String, Table, Text, desc, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import get_settings

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(UTC)


class ChatHistoryStore:
    def __init__(self) -> None:
        self._engine = create_async_engine(get_settings().database_url, future=True)
        self._metadata = MetaData()
        self.sessions = Table(
            "chat_history_sessions",
            self._metadata,
            Column("id", String, primary_key=True),
            Column("user_id", String, nullable=False, index=True),
            Column("agent_id", String, nullable=False),
            Column("title", String, nullable=False, default="New chat"),
            Column("status", String, nullable=False, default="active"),
            Column("prompt_tokens", Integer, nullable=False, default=0),
            Column("completion_tokens", Integer, nullable=False, default=0),
            Column("total_tokens", Integer, nullable=False, default=0),
            Column("created_at", DateTime(timezone=True), nullable=False),
            Column("updated_at", DateTime(timezone=True), nullable=False),
        )
        self.messages = Table(
            "chat_history_messages",
            self._metadata,
            Column("id", Integer, primary_key=True, autoincrement=True),
            Column("session_id", String, nullable=False, index=True),
            Column("user_id", String, nullable=False, index=True),
            Column("agent_id", String, nullable=False),
            Column("role", String, nullable=False),
            Column("event_type", String, nullable=False),
            Column("text", Text, nullable=False, default=""),
            Column("artifact_id", String),
            Column("component", String),
            Column("payload", JSON, nullable=False, default=dict),
            Column("created_at", DateTime(timezone=True), nullable=False),
        )

    async def initialize(self) -> None:
        try:
            async with self._engine.begin() as connection:
                await connection.run_sync(self._metadata.create_all)
        except Exception:
            logger.exception("Chat history database initialization failed")

    async def upsert_session(self, *, session_id: str, user_id: str, agent_id: str, title: str) -> None:
        now = _now()
        values = {
            "id": session_id,
            "user_id": user_id,
            "agent_id": agent_id,
            "title": title[:120] or "New chat",
            "status": "active",
            "created_at": now,
            "updated_at": now,
        }
        async with self._engine.begin() as connection:
            await connection.execute(
                insert(self.sessions)
                .values(**values)
                .on_conflict_do_nothing(index_elements=["id"])
            )
            await connection.execute(
                update(self.sessions)
                .where(self.sessions.c.id == session_id)
                .values(agent_id=agent_id, status="active", updated_at=now)
            )

    async def finish_session(self, *, session_id: str, status: str) -> None:
        async with self._engine.begin() as connection:
            await connection.execute(
                update(self.sessions)
                .where(self.sessions.c.id == session_id)
                .values(status=status, updated_at=_now())
            )

    async def add_message(
        self,
        *,
        session_id: str,
        user_id: str,
        agent_id: str,
        role: str,
        event_type: str,
        text: str = "",
        payload: dict[str, Any] | None = None,
        artifact_id: str | None = None,
        component: str | None = None,
    ) -> None:
        now = _now()
        async with self._engine.begin() as connection:
            await connection.execute(
                insert(self.messages).values(
                    session_id=session_id,
                    user_id=user_id,
                    agent_id=agent_id,
                    role=role,
                    event_type=event_type,
                    text=text,
                    payload=payload or {},
                    artifact_id=artifact_id,
                    component=component,
                    created_at=now,
                )
            )
            await connection.execute(
                update(self.sessions)
                .where(self.sessions.c.id == session_id)
                .values(updated_at=now)
            )

    async def add_token_usage(
        self,
        *,
        session_id: str,
        prompt_tokens: int,
        completion_tokens: int,
        total_tokens: int,
    ) -> None:
        async with self._engine.begin() as connection:
            row = (
                await connection.execute(
                    select(
                        self.sessions.c.prompt_tokens,
                        self.sessions.c.completion_tokens,
                        self.sessions.c.total_tokens,
                    ).where(self.sessions.c.id == session_id)
                )
            ).mappings().first()
            if row is None:
                return
            await connection.execute(
                update(self.sessions)
                .where(self.sessions.c.id == session_id)
                .values(
                    prompt_tokens=row["prompt_tokens"] + max(prompt_tokens, 0),
                    completion_tokens=row["completion_tokens"] + max(completion_tokens, 0),
                    total_tokens=row["total_tokens"] + max(total_tokens or prompt_tokens + completion_tokens, 0),
                    updated_at=_now(),
                )
            )

    async def list_sessions(self, *, user_id: str, limit: int = 30) -> list[dict[str, Any]]:
        async with self._engine.begin() as connection:
            rows = (
                await connection.execute(
                    select(self.sessions)
                    .where(self.sessions.c.user_id == user_id)
                    .order_by(desc(self.sessions.c.updated_at))
                    .limit(limit)
                )
            ).mappings().all()
        return [self._serialize(dict(row)) for row in rows]

    async def get_session(self, *, user_id: str, session_id: str) -> dict[str, Any] | None:
        async with self._engine.begin() as connection:
            session = (
                await connection.execute(
                    select(self.sessions).where(
                        self.sessions.c.id == session_id,
                        self.sessions.c.user_id == user_id,
                    )
                )
            ).mappings().first()
            if session is None:
                return None
            messages = (
                await connection.execute(
                    select(self.messages)
                    .where(self.messages.c.session_id == session_id, self.messages.c.user_id == user_id)
                    .order_by(self.messages.c.id)
                )
            ).mappings().all()
        return {
            **self._serialize(dict(session)),
            "messages": [self._serialize(dict(row)) for row in messages],
        }

    def _serialize(self, value: dict[str, Any]) -> dict[str, Any]:
        for key, item in list(value.items()):
            if isinstance(item, datetime):
                value[key] = item.isoformat()
        return value


chat_history_store = ChatHistoryStore()
