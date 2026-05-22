from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any


@dataclass
class UIArtifact:
    component: str
    payload: Any
    summary: dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)


class UIArtifactStore:
    """Stores large tool payloads outside the LLM context.

    Local implementation is in-memory. Replace with Postgres/S3/Redis for multi-process
    deployments while preserving this interface.
    """

    def __init__(self) -> None:
        self._items: dict[str, UIArtifact] = {}

    def put(self, component: str, payload: Any, summary: dict[str, Any] | None = None) -> str:
        artifact_id = str(uuid.uuid4())
        self._items[artifact_id] = UIArtifact(
            component=component,
            payload=payload,
            summary=summary or {},
        )
        return artifact_id

    def get(self, artifact_id: str) -> UIArtifact | None:
        return self._items.get(artifact_id)


ui_artifact_store = UIArtifactStore()
