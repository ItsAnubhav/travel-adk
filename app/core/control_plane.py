from __future__ import annotations

import asyncio
import logging
from collections import deque
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from typing import Any, Literal

from sqlalchemy import JSON, Column, DateTime, Integer, MetaData, String, Table, Text, desc, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import get_settings


logger = logging.getLogger(__name__)


ControlStatus = Literal["enabled", "disabled", "maintenance"]
ToolKind = Literal["builtin", "mcp", "api", "function"]
SessionStatus = Literal["active", "idle", "ended", "failed"]
InvocationStatus = Literal["running", "success", "failed"]


def _now() -> datetime:
    return datetime.now(UTC)


def _iso(value: datetime) -> str:
    return value.isoformat()


def StringColumn(name: str, *, primary_key: bool = False) -> Column:
    return Column(name, String, primary_key=primary_key)


def TextColumn(name: str) -> Column:
    return Column(name, Text, nullable=False, default="")


def JsonColumn(name: str) -> Column:
    return Column(name, JSON, nullable=False, default=dict)


def DateTimeColumn(name: str) -> Column:
    return Column(name, DateTime(timezone=True), nullable=False)


@dataclass
class AgentRecord:
    id: str
    name: str
    description: str
    status: ControlStatus = "enabled"
    version: str = "local"
    config: dict[str, Any] = field(default_factory=dict)
    updated_at: datetime = field(default_factory=_now)


@dataclass
class ToolRecord:
    id: str
    name: str
    description: str
    kind: ToolKind = "builtin"
    status: ControlStatus = "enabled"
    config: dict[str, Any] = field(default_factory=dict)
    auth_secret_ref: str | None = None
    updated_at: datetime = field(default_factory=_now)


@dataclass
class SessionRecord:
    id: str
    user_id: str
    agent_id: str
    status: SessionStatus = "active"
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    started_at: datetime = field(default_factory=_now)
    last_seen_at: datetime = field(default_factory=_now)


@dataclass
class ToolInvocationRecord:
    id: str
    session_id: str
    tool_id: str
    status: InvocationStatus = "running"
    started_at: datetime = field(default_factory=_now)
    completed_at: datetime | None = None
    latency_ms: int | None = None
    error_message: str | None = None


@dataclass
class AuditRecord:
    id: int
    admin_user_id: str
    action: str
    target_type: str
    target_id: str
    before: dict[str, Any] | None
    after: dict[str, Any] | None
    created_at: datetime = field(default_factory=_now)


class AdminConnectionManager:
    def __init__(self) -> None:
        self._clients: set[Any] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: Any) -> None:
        await websocket.accept()
        async with self._lock:
            self._clients.add(websocket)

    async def disconnect(self, websocket: Any) -> None:
        async with self._lock:
            self._clients.discard(websocket)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        async with self._lock:
            clients = list(self._clients)
        for websocket in clients:
            try:
                await websocket.send_json(payload)
            except Exception:
                await self.disconnect(websocket)


class ControlPlane:
    def __init__(self) -> None:
        self.connections = AdminConnectionManager()
        self._lock = asyncio.Lock()
        self._engine = create_async_engine(get_settings().database_url, future=True)
        self._metadata = MetaData()
        self._agents_table = Table(
            "admin_agents",
            self._metadata,
            StringColumn("id", primary_key=True),
            StringColumn("name"),
            TextColumn("description"),
            StringColumn("status"),
            StringColumn("version"),
            JsonColumn("config"),
            DateTimeColumn("updated_at"),
        )
        self._tools_table = Table(
            "admin_tools",
            self._metadata,
            StringColumn("id", primary_key=True),
            StringColumn("name"),
            TextColumn("description"),
            StringColumn("kind"),
            StringColumn("status"),
            JsonColumn("config"),
            StringColumn("auth_secret_ref", primary_key=False),
            DateTimeColumn("updated_at"),
        )
        self._audit_table = Table(
            "admin_audit_logs",
            self._metadata,
            Column("id", Integer, primary_key=True),
            StringColumn("admin_user_id"),
            StringColumn("action"),
            StringColumn("target_type"),
            StringColumn("target_id"),
            JsonColumn("before"),
            JsonColumn("after"),
            DateTimeColumn("created_at"),
        )
        self._agents: dict[str, AgentRecord] = {}
        self._tools: dict[str, ToolRecord] = {}
        self._sessions: dict[str, SessionRecord] = {}
        self._users_seen_at: dict[str, datetime] = {}
        self._tool_invocations: dict[str, ToolInvocationRecord] = {}
        self._pending_tool_calls_by_session: dict[str, deque[str]] = {}
        self._audit_log: deque[AuditRecord] = deque(maxlen=100)
        self._audit_seq = 0
        self._seed_defaults()

    async def initialize(self) -> None:
        try:
            async with self._engine.begin() as connection:
                await connection.run_sync(self._metadata.create_all)
            await self._seed_database_defaults()
            await self._load_registry_from_database()
        except Exception:
            logger.exception("Admin control-plane database initialization failed; using in-memory defaults")

    def _seed_defaults(self) -> None:
        self._agents = {
            "root": AgentRecord(
                id="root",
                name="TravelOrchestrator",
                description="Routes users across flight, expense, booking, and preference workflows.",
            ),
            "flight": AgentRecord(
                id="flight",
                name="FlightAgent",
                description="Collects flight search requirements and preference-aware guidance.",
            ),
            "expense": AgentRecord(
                id="expense",
                name="ExpenseAgent",
                description="Handles trips, approvers, expense settings, and expense mutation tools.",
            ),
            "booking": AgentRecord(
                id="booking",
                name="BookingAgent",
                description="Retrieves bookings, fare rules, cancellation policy, and reissue policy.",
            ),
        }
        self._tools = {
            "get_user_preferences": ToolRecord(
                id="get_user_preferences",
                name="Get user preferences",
                description="Loads durable travel preferences for the active user.",
            ),
            "suggest_user_preference": ToolRecord(
                id="suggest_user_preference",
                name="Suggest user preference",
                description="Creates a pending preference when a user states a durable travel preference.",
            ),
            "search_company_documents": ToolRecord(
                id="search_company_documents",
                name="Search company documents",
                description="Searches uploaded company policy, HR, holiday, and manual documents.",
            ),
            "list_trip": ToolRecord(
                id="list_trip",
                name="List trips",
                description="Lists Travog trips visible to the authenticated user.",
            ),
            "get_trip_approvers": ToolRecord(
                id="get_trip_approvers",
                name="Get trip approvers",
                description="Fetches approvers for a Travog trip.",
            ),
            "send_trip_for_approval": ToolRecord(
                id="send_trip_for_approval",
                name="Send trip for approval",
                description="Submits a trip to selected approvers.",
            ),
            "list_expenses": ToolRecord(
                id="list_expenses",
                name="List expenses",
                description="Lists Travog expenses with optional filters.",
            ),
            "get_expense_settings": ToolRecord(
                id="get_expense_settings",
                name="Get expense settings",
                description="Loads expense categories, currencies, and policy settings.",
            ),
            "create_expense": ToolRecord(
                id="create_expense",
                name="Create expense",
                description="Creates a Travog expense.",
            ),
            "update_expense": ToolRecord(
                id="update_expense",
                name="Update expense",
                description="Updates an existing Travog expense.",
            ),
            "get_booking": ToolRecord(
                id="get_booking",
                name="Get booking",
                description="Retrieves booking details by booking reference.",
            ),
            "get_fare_rules": ToolRecord(
                id="get_fare_rules",
                name="Get fare rules",
                description="Retrieves fare rules for a flight from a booking.",
            ),
            "get_cancellation_policy": ToolRecord(
                id="get_cancellation_policy",
                name="Get cancellation policy",
                description="Retrieves cancellation policy details for a booking.",
            ),
            "get_reissue_policy": ToolRecord(
                id="get_reissue_policy",
                name="Get reissue policy",
                description="Retrieves reissue policy details for a booking.",
            ),
        }

    async def snapshot(self) -> dict[str, Any]:
        async with self._lock:
            return self._snapshot_locked()

    async def publish_snapshot(self) -> None:
        await self.connections.broadcast({"type": "snapshot", "data": await self.snapshot()})

    async def list_agents(self) -> list[dict[str, Any]]:
        async with self._lock:
            return [self._serialize(record) for record in self._agents.values()]

    async def list_tools(self) -> list[dict[str, Any]]:
        async with self._lock:
            return [self._serialize(record) for record in self._tools.values()]

    async def is_agent_enabled(self, agent_id: str) -> bool:
        async with self._lock:
            return self._agents.get(agent_id, AgentRecord(agent_id, agent_id, "")).status == "enabled"

    async def is_tool_enabled(self, tool_id: str) -> bool:
        async with self._lock:
            tool = self._tools.get(tool_id)
            return tool is None or tool.status == "enabled"

    async def update_agent_status(
        self,
        agent_id: str,
        status: ControlStatus,
        admin_user_id: str,
    ) -> AgentRecord:
        async with self._lock:
            record = self._agents[agent_id]
            before = self._serialize(record)
            record.status = status
            record.updated_at = _now()
            audit = self._audit_locked(
                admin_user_id,
                "agent.status.update",
                "agent",
                agent_id,
                before,
                self._serialize(record),
            )
        await self._persist_agent(record)
        await self._persist_audit(audit)
        await self.publish_snapshot()
        return record

    async def update_tool_status(
        self,
        tool_id: str,
        status: ControlStatus,
        admin_user_id: str,
    ) -> ToolRecord:
        async with self._lock:
            record = self._tools[tool_id]
            before = self._serialize(record)
            record.status = status
            record.updated_at = _now()
            audit = self._audit_locked(
                admin_user_id,
                "tool.status.update",
                "tool",
                tool_id,
                before,
                self._serialize(record),
            )
        await self._persist_tool(record)
        await self._persist_audit(audit)
        await self.publish_snapshot()
        return record

    async def register_tool(
        self,
        *,
        tool_id: str,
        name: str,
        description: str,
        kind: ToolKind,
        config: dict[str, Any],
        auth_secret_ref: str | None,
        admin_user_id: str,
    ) -> ToolRecord:
        async with self._lock:
            if tool_id in self._tools:
                raise ValueError(f"Tool {tool_id} already exists")
            record = ToolRecord(
                id=tool_id,
                name=name,
                description=description,
                kind=kind,
                status="disabled",
                config=config,
                auth_secret_ref=auth_secret_ref,
            )
            self._tools[tool_id] = record
            audit = self._audit_locked(
                admin_user_id,
                "tool.register",
                "tool",
                tool_id,
                None,
                self._serialize(record),
            )
        await self._persist_tool(record)
        await self._persist_audit(audit)
        await self.publish_snapshot()
        return record

    async def _seed_database_defaults(self) -> None:
        async with self._engine.begin() as connection:
            for record in self._agents.values():
                values = self._agent_db_values(record)
                await connection.execute(
                    insert(self._agents_table)
                    .values(**values)
                    .on_conflict_do_nothing(index_elements=["id"])
                )
            for record in self._tools.values():
                values = self._tool_db_values(record)
                await connection.execute(
                    insert(self._tools_table)
                    .values(**values)
                    .on_conflict_do_nothing(index_elements=["id"])
                )

    async def _load_registry_from_database(self) -> None:
        async with self._engine.begin() as connection:
            agent_rows = (await connection.execute(select(self._agents_table))).mappings().all()
            tool_rows = (await connection.execute(select(self._tools_table))).mappings().all()
            audit_rows = (
                await connection.execute(
                    select(self._audit_table).order_by(desc(self._audit_table.c.id)).limit(100)
                )
            ).mappings().all()

        async with self._lock:
            self._agents = {
                row["id"]: AgentRecord(
                    id=row["id"],
                    name=row["name"],
                    description=row["description"] or "",
                    status=row["status"],
                    version=row["version"] or "local",
                    config=row["config"] or {},
                    updated_at=row["updated_at"] or _now(),
                )
                for row in agent_rows
            }
            self._tools = {
                row["id"]: ToolRecord(
                    id=row["id"],
                    name=row["name"],
                    description=row["description"] or "",
                    kind=row["kind"] or "builtin",
                    status=row["status"],
                    config=row["config"] or {},
                    auth_secret_ref=row["auth_secret_ref"],
                    updated_at=row["updated_at"] or _now(),
                )
                for row in tool_rows
            }
            self._audit_log = deque(
                [
                    AuditRecord(
                        id=row["id"],
                        admin_user_id=row["admin_user_id"],
                        action=row["action"],
                        target_type=row["target_type"],
                        target_id=row["target_id"],
                        before=row["before"],
                        after=row["after"],
                        created_at=row["created_at"] or _now(),
                    )
                    for row in reversed(audit_rows)
                ],
                maxlen=100,
            )
            self._audit_seq = max((record.id for record in self._audit_log), default=0)

    async def _persist_agent(self, record: AgentRecord) -> None:
        try:
            db_values = self._agent_db_values(record)
            async with self._engine.begin() as connection:
                await connection.execute(
                    update(self._agents_table).where(self._agents_table.c.id == record.id).values(**db_values)
                )
        except Exception:
            logger.exception("Failed to persist admin agent %s", record.id)

    async def _persist_tool(self, record: ToolRecord) -> None:
        try:
            db_values = self._tool_db_values(record)
            async with self._engine.begin() as connection:
                await connection.execute(
                    insert(self._tools_table)
                    .values(**db_values)
                    .on_conflict_do_update(index_elements=["id"], set_=db_values)
                )
        except Exception:
            logger.exception("Failed to persist admin tool %s", record.id)

    async def _persist_audit(self, record: AuditRecord) -> None:
        try:
            values = {
                "id": record.id,
                "admin_user_id": record.admin_user_id,
                "action": record.action,
                "target_type": record.target_type,
                "target_id": record.target_id,
                "before": record.before,
                "after": record.after,
                "created_at": record.created_at,
            }
            async with self._engine.begin() as connection:
                await connection.execute(
                    insert(self._audit_table)
                    .values(**values)
                    .on_conflict_do_nothing(index_elements=["id"])
                )
        except Exception:
            logger.exception("Failed to persist admin audit event %s", record.id)

    async def mark_session_started(self, *, session_id: str, user_id: str, agent_id: str) -> None:
        async with self._lock:
            now = _now()
            self._users_seen_at[user_id] = now
            self._sessions[session_id] = SessionRecord(
                id=session_id,
                user_id=user_id,
                agent_id=agent_id,
                status="active",
                started_at=self._sessions.get(session_id, SessionRecord(session_id, user_id, agent_id)).started_at,
                last_seen_at=now,
            )
        await self.publish_snapshot()

    async def mark_session_done(self, *, session_id: str, status: SessionStatus = "ended") -> None:
        async with self._lock:
            record = self._sessions.get(session_id)
            if record:
                record.status = status
                record.last_seen_at = _now()
        await self.publish_snapshot()

    async def mark_tool_started(self, *, session_id: str, tool_id: str) -> str | None:
        async with self._lock:
            tool = self._tools.get(tool_id)
            if tool and tool.status != "enabled":
                return None
            invocation_id = f"{session_id}:{tool_id}:{len(self._tool_invocations) + 1}"
            self._tool_invocations[invocation_id] = ToolInvocationRecord(
                id=invocation_id,
                session_id=session_id,
                tool_id=tool_id,
            )
            self._pending_tool_calls_by_session.setdefault(session_id, deque()).append(invocation_id)
            session = self._sessions.get(session_id)
            if session:
                session.last_seen_at = _now()
        await self.publish_snapshot()
        return invocation_id

    async def mark_tool_done(
        self,
        *,
        session_id: str,
        status: InvocationStatus = "success",
        error_message: str | None = None,
    ) -> None:
        async with self._lock:
            queue = self._pending_tool_calls_by_session.get(session_id)
            invocation_id = queue.popleft() if queue else None
            if invocation_id:
                record = self._tool_invocations.get(invocation_id)
                if record:
                    record.status = status
                    record.completed_at = _now()
                    record.latency_ms = int(
                        (record.completed_at - record.started_at).total_seconds() * 1000
                    )
                    record.error_message = error_message
            session = self._sessions.get(session_id)
            if session:
                session.last_seen_at = _now()
        await self.publish_snapshot()

    async def mark_token_usage(
        self,
        *,
        session_id: str,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        total_tokens: int = 0,
    ) -> None:
        async with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                return
            session.prompt_tokens += max(prompt_tokens, 0)
            session.completion_tokens += max(completion_tokens, 0)
            session.total_tokens += max(total_tokens or prompt_tokens + completion_tokens, 0)
            session.last_seen_at = _now()
        await self.publish_snapshot()

    def _snapshot_locked(self) -> dict[str, Any]:
        active_sessions = [item for item in self._sessions.values() if item.status == "active"]
        running_tools = [item for item in self._tool_invocations.values() if item.status == "running"]
        total_tokens = sum(session.total_tokens for session in self._sessions.values())
        prompt_tokens = sum(session.prompt_tokens for session in self._sessions.values())
        completion_tokens = sum(session.completion_tokens for session in self._sessions.values())
        active_users = {
            session.user_id
            for session in active_sessions
            if (_now() - session.last_seen_at).total_seconds() <= 300
        }
        return {
            "metrics": {
                "agents_running": len({session.agent_id for session in active_sessions}),
                "tools_running": len(running_tools),
                "users_online": len(active_users),
                "active_sessions": len(active_sessions),
                "registered_agents": len(self._agents),
                "registered_tools": len(self._tools),
                "total_tokens": total_tokens,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
            },
            "agents": [self._serialize(record) for record in self._agents.values()],
            "tools": [self._serialize(record) for record in self._tools.values()],
            "sessions": [
                self._serialize(record)
                for record in sorted(self._sessions.values(), key=lambda item: item.last_seen_at, reverse=True)[:50]
            ],
            "tool_invocations": [
                self._serialize(record)
                for record in sorted(self._tool_invocations.values(), key=lambda item: item.started_at, reverse=True)[:50]
            ],
            "audit_log": [self._serialize(record) for record in list(self._audit_log)[-20:]],
        }

    def _audit_locked(
        self,
        admin_user_id: str,
        action: str,
        target_type: str,
        target_id: str,
        before: dict[str, Any] | None,
        after: dict[str, Any] | None,
    ) -> AuditRecord:
        self._audit_seq += 1
        record = AuditRecord(
            id=self._audit_seq,
            admin_user_id=admin_user_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            before=before,
            after=after,
        )
        self._audit_log.append(record)
        return record

    def _serialize(self, record: Any) -> dict[str, Any]:
        data = asdict(record)
        for key, value in list(data.items()):
            if isinstance(value, datetime):
                data[key] = _iso(value)
        return data

    def _agent_db_values(self, record: AgentRecord) -> dict[str, Any]:
        return {
            "id": record.id,
            "name": record.name,
            "description": record.description,
            "status": record.status,
            "version": record.version,
            "config": record.config,
            "updated_at": record.updated_at,
        }

    def _tool_db_values(self, record: ToolRecord) -> dict[str, Any]:
        return {
            "id": record.id,
            "name": record.name,
            "description": record.description,
            "kind": record.kind,
            "status": record.status,
            "config": record.config,
            "auth_secret_ref": record.auth_secret_ref,
            "updated_at": record.updated_at,
        }


control_plane = ControlPlane()
