from __future__ import annotations

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from app.core.api_tool_parser import parse_curl_command
from app.core.control_plane import control_plane
from app.schemas.admin import StatusUpdateRequest, ToolCreateRequest

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/dashboard")
async def dashboard_snapshot() -> dict:
    return await control_plane.snapshot()


@router.get("/agents")
async def list_agents() -> list[dict]:
    return await control_plane.list_agents()


@router.patch("/agents/{agent_id}")
async def update_agent(agent_id: str, request: StatusUpdateRequest) -> dict:
    try:
        record = await control_plane.update_agent_status(
            agent_id,
            request.status,
            request.admin_user_id,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found") from exc
    return control_plane._serialize(record)


@router.get("/tools")
async def list_tools() -> list[dict]:
    return await control_plane.list_tools()


@router.post("/tools", status_code=201)
async def create_tool(request: ToolCreateRequest) -> dict:
    try:
        config = _tool_config(request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        record = await control_plane.register_tool(
            tool_id=request.id,
            name=request.name,
            description=request.description,
            kind=request.kind,
            config=config,
            auth_secret_ref=request.auth_secret_ref,
            admin_user_id=request.admin_user_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return control_plane._serialize(record)


@router.patch("/tools/{tool_id}")
async def update_tool(tool_id: str, request: StatusUpdateRequest) -> dict:
    try:
        record = await control_plane.update_tool_status(
            tool_id,
            request.status,
            request.admin_user_id,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Tool {tool_id} not found") from exc
    return control_plane._serialize(record)


@router.websocket("/dashboard/ws")
async def dashboard_websocket(websocket: WebSocket) -> None:
    await control_plane.connections.connect(websocket)
    try:
        await websocket.send_json({"type": "snapshot", "data": await control_plane.snapshot()})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await control_plane.connections.disconnect(websocket)


def _tool_config(request: ToolCreateRequest) -> dict:
    if request.kind != "api":
        return request.config
    if not request.curl_command or not request.curl_command.strip():
        return request.config
    parsed = parse_curl_command(request.curl_command)
    return {
        **parsed,
        **request.config,
        "curl_command": request.curl_command,
    }
