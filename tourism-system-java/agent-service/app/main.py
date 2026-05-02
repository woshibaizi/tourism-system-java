from __future__ import annotations

from datetime import datetime

from fastapi import FastAPI, HTTPException, Query

from app.agent.memory import session_store
from app.agent.orchestrator import generate_diary, plan_route, process_chat
from app.config import settings
from app.schemas import ChatRequest, ChatResponse, DiaryGenerateRequest, DiaryGenerateResponse, HealthResponse, RoutePlanRequest, RoutePlanResponse, SessionDetail, SessionSummary


app = FastAPI(title="Personalized Travel Agent", version=settings.agent_version)


@app.get("/health", response_model=HealthResponse)
@app.get("/agent/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """供 Java 代理层或部署探针检查 Python agent 是否可用。"""
    return HealthResponse(
        status="ok",
        agent_name=settings.agent_name,
        version=settings.agent_version,
        timestamp=datetime.utcnow(),
    )


@app.get("/agent/sessions", response_model=list[SessionSummary])
def list_sessions(user_id: str = Query(default="anonymous")) -> list[SessionSummary]:
    """返回指定用户的会话摘要列表。"""
    return session_store.list_sessions(user_id)


@app.get("/agent/sessions/{session_id}", response_model=SessionDetail)
def get_session(session_id: str, user_id: str = Query(default="anonymous")) -> SessionDetail:
    """按用户与会话双条件读取详情，防止跨用户读取。"""
    session = session_store.get_session(user_id, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")
    return session


@app.post("/agent/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    """统一聊天入口。"""
    try:
        return process_chat(request)
    except ValueError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error


@app.post("/agent/diary/generate", response_model=DiaryGenerateResponse)
def diary_generate(request: DiaryGenerateRequest) -> DiaryGenerateResponse:
    """图片日记生成骨架接口。"""
    return generate_diary(request.user_id, request.prompt, request.images)


@app.post("/agent/route/plan", response_model=RoutePlanResponse)
def route_plan(request: RoutePlanRequest) -> RoutePlanResponse:
    """自然语言路线规划骨架接口。"""
    return plan_route(request.user_id, request.requirement)
