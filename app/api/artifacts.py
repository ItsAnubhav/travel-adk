from fastapi import APIRouter, HTTPException

from app.schemas.chat import UIArtifactResponse
from app.ui_artifacts.store import ui_artifact_store

router = APIRouter(prefix="/artifacts", tags=["artifacts"])


@router.get("/{artifact_id}", response_model=UIArtifactResponse)
async def get_ui_artifact(artifact_id: str) -> UIArtifactResponse:
    artifact = ui_artifact_store.get(artifact_id)
    if artifact is None:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return UIArtifactResponse(
        artifact_id=artifact_id,
        component=artifact.component,
        summary=artifact.summary,
        payload=artifact.payload,
    )
