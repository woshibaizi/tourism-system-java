"""
WebSocket routes for real-time project updates.
"""

from __future__ import annotations

import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from project_store import get_project_owner, get_session_user

router = APIRouter()
active_connections: dict[str, list[WebSocket]] = {}


class ConnectionManager:
    async def connect(self, websocket: WebSocket, project_id: str):
        await websocket.accept()
        active_connections.setdefault(project_id, []).append(websocket)

    def disconnect(self, websocket: WebSocket, project_id: str):
        if project_id not in active_connections:
            return

        active_connections[project_id] = [
            current_socket for current_socket in active_connections[project_id] if current_socket != websocket
        ]
        if not active_connections[project_id]:
            del active_connections[project_id]

    async def broadcast(self, project_id: str, message: dict):
        if project_id not in active_connections:
            return

        data = json.dumps(message, ensure_ascii=False)
        disconnected: list[WebSocket] = []
        for websocket in active_connections[project_id]:
            try:
                await websocket.send_text(data)
            except Exception:
                disconnected.append(websocket)

        for websocket in disconnected:
            self.disconnect(websocket, project_id)


manager = ConnectionManager()


@router.websocket("/ws/project/{project_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: str):
    session_token = websocket.query_params.get("token")
    session_user = get_session_user(session_token)
    project_owner_id = get_project_owner(project_id)

    if not session_user or project_owner_id != session_user["id"]:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(websocket, project_id)

    try:
        await websocket.send_text(
            json.dumps(
                {
                    "type": "system",
                    "agent_role": "system",
                    "agent_name": "System",
                    "content": f"Connected to project {project_id}",
                    "stage": "init",
                    "msg_type": "system",
                },
                ensure_ascii=False,
            )
        )

        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            if message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

    except WebSocketDisconnect:
        manager.disconnect(websocket, project_id)
