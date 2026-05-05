from __future__ import annotations

from datetime import datetime

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.agent import init_agents
from app.agent.diary_agent import get_task_status
from app.config import settings
from app.db.sqlite_store import session_db
from app.schemas import (
    ChatRequest,
    ChatResponse,
    DiaryGenerateRequest,
    DiaryGenerateResponse,
    DiaryTaskStatus,
    HealthResponse,
    SessionDeleteRequest,
    SessionDetail,
    SessionRenameRequest,
    SessionSummary,
)

# 初始化 Agent
dispatcher = init_agents()

app = FastAPI(title="Personalized Travel Agent", version=settings.agent_version)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== 健康检查 ====================


@app.get("/health", response_model=HealthResponse)
@app.get("/agent/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        agent_name=settings.agent_name,
        version=settings.agent_version,
        timestamp=datetime.utcnow(),
        agents=dispatcher.list_agents(),
    )


# ==================== 会话管理 ====================


@app.get("/agent/sessions", response_model=list[SessionSummary])
def list_sessions(user_id: str = Query(default="anonymous")) -> list[SessionSummary]:
    sessions = session_db.list_sessions(user_id)
    return [SessionSummary(**s) for s in sessions]


@app.get("/agent/sessions/{session_id}", response_model=SessionDetail)
def get_session(session_id: str, user_id: str = Query(default="anonymous")) -> SessionDetail:
    session = session_db.get_session(user_id, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")
    return SessionDetail(**session)


@app.delete("/agent/sessions/{session_id}")
def delete_session(session_id: str, user_id: str = Query(default="anonymous")) -> dict:
    deleted = session_db.delete_session(user_id, session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="session not found")
    return {"ok": True}


@app.put("/agent/sessions/{session_id}/rename")
def rename_session(session_id: str, request: SessionRenameRequest) -> dict:
    updated = session_db.rename_session(request.user_id, session_id, request.title)
    if not updated:
        raise HTTPException(status_code=404, detail="session not found")
    return {"ok": True}


# ==================== 聊天 ====================


@app.post("/agent/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    try:
        result = dispatcher.process_chat(
            user_id=request.user_id,
            message=request.message,
            session_id=request.session_id,
            mode=request.mode,
            metadata=request.metadata,
        )
        return ChatResponse(
            session=SessionDetail(**result["session"]),
            reply=result["reply"],
        )
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))


# ==================== 日记生成 ====================


@app.post("/agent/diary/generate", response_model=DiaryGenerateResponse)
def diary_generate(request: DiaryGenerateRequest) -> DiaryGenerateResponse:
    """图片日记生成骨架接口。"""
    return generate_diary(request.user_id, request.prompt, request.images)


@app.post("/agent/route/plan", response_model=RoutePlanResponse)
def route_plan(request: RoutePlanRequest) -> RoutePlanResponse:
    """自然语言路线规划骨架接口。"""
    return plan_route(request.user_id, request.requirement)
