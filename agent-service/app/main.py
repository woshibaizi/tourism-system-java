from __future__ import annotations

from datetime import datetime, timezone

import json

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.agent import init_agents
from app.agent.diary_agent import get_task_status
from app.agent.prompts import BUDDY_PRESETS, get_buddy_list
from app.config import settings
from app.db.sqlite_store import buddy_db, session_db
from app.schemas import (
    BuddyProfile,
    ChatRequest,
    ChatResponse,
    CreateBuddyRequest,
    DiaryGenerateRequest,
    DiaryGenerateResponse,
    DiaryTaskStatus,
    HealthResponse,
    RoutePlanRequest,
    RoutePlanResponse,
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
        timestamp=datetime.now(tz=timezone.utc),
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


@app.get("/agent/user/buddy", response_model=list[BuddyProfile])
def list_buddies(user_id: str = Query(default="anonymous")) -> list[BuddyProfile]:
    """获取用户可用的所有搭子（预设 + 自定义）。"""
    presets = get_buddy_list()
    result: list[BuddyProfile] = []
    for p in presets:
        result.append(BuddyProfile(
            id=p["id"], name=p["name"],
            personality=BUDDY_PRESETS.get(p["id"], {}).get("prompt", ""),
            is_preset=True, preference_score=0,
        ))
    customs = buddy_db.list_buddies(user_id)
    for c in customs:
        result.append(BuddyProfile(
            id=c["buddy_id"], name=c["name"],
            personality=c.get("personality", ""),
            speaking_style=c.get("speaking_style", ""),
            is_preset=False, preference_score=c.get("preference_score", 0),
        ))
    return result


@app.put("/agent/user/buddy", response_model=BuddyProfile)
def upsert_buddy(request: CreateBuddyRequest) -> BuddyProfile:
    """创建或更新自定义出游搭子。传入 buddyId 则更新，否则新建。"""
    import uuid as _uuid
    buddy_id = request.buddy_id or f"custom_{_uuid.uuid4().hex[:12]}"
    row = buddy_db.upsert_buddy(
        user_id=request.user_id, buddy_id=buddy_id,
        name=request.name, personality=request.personality,
        speaking_style=request.speaking_style,
    )
    return BuddyProfile(
        id=row["buddy_id"], name=row["name"],
        personality=row.get("personality", ""),
        speaking_style=row.get("speaking_style", ""),
        is_preset=False, preference_score=row.get("preference_score", 0),
    )


@app.delete("/agent/user/buddy/{buddy_id}")
def delete_buddy(buddy_id: str, user_id: str = Query(default="anonymous")) -> dict:
    deleted = buddy_db.delete_buddy(user_id, buddy_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="buddy not found")
    return {"ok": True}


@app.post("/agent/user/buddy/{buddy_id}/use")
def use_buddy(buddy_id: str, user_id: str = Query(default="anonymous")) -> dict:
    """用户选择/对话使用某个搭子后，增加偏好分数。"""
    buddy_db.update_preference(user_id, buddy_id, delta=1.0)
    return {"ok": True, "buddy_id": buddy_id}


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


@app.post("/agent/chat/stream")
async def chat_stream(request: ChatRequest):
    """
    流式聊天端点 — SSE（Server-Sent Events）。

    事件类型:
    - token:        LLM 逐 token 输出     data: {"content": "杭州"}
    - tool_call:    LLM 发起工具调用       data: {"name": "search_places", "args": {...}}
    - tool_result:  工具执行结果           data: {"name": "search_places", "result": "..."}
    - done:         对话结束               data: {"content": "...", "intent": "...", "suggestions": [...]}
    - error:        异常                   data: {"message": "..."}
    """

    async def event_generator():
        try:
            async for event in dispatcher.process_chat_stream(
                user_id=request.user_id,
                message=request.message,
                session_id=request.session_id,
                mode=request.mode,
                metadata=request.metadata,
            ):
                event_type = event.get("event", "done")
                data = json.dumps(event.get("data", {}), ensure_ascii=False)
                yield f"event: {event_type}\ndata: {data}\n\n"
        except Exception as e:
            import logging
            logging.getLogger(__name__).exception("SSE stream error")
            yield f"event: error\ndata: {json.dumps({'message': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ==================== 日记生成 ====================


@app.post("/agent/diary/generate", response_model=DiaryGenerateResponse)
def diary_generate(request: DiaryGenerateRequest) -> DiaryGenerateResponse:
    """启动图片日记生成异步任务。前端通过 GET /agent/diary/status/{task_id} 轮询进度。"""
    result = dispatcher.process_with_intent(
        user_id=request.user_id,
        message=request.prompt,
        forced_intent="generate_diary",
        metadata={
            "images": request.images,
            "style": request.style,
            **(request.metadata or {}),
        },
    )
    reply = result["reply"]
    task_id = reply.get("metadata", {}).get("task_id", "")
    return DiaryGenerateResponse(
        task_id=task_id,
        status="running",
        progress=0,
        message=reply["content"],
    )


@app.get("/agent/diary/status/{task_id}", response_model=DiaryTaskStatus)
def diary_status(task_id: str) -> DiaryTaskStatus:
    """轮询日记生成进度。"""
    status = get_task_status(task_id)
    if status is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="task not found")
    return DiaryTaskStatus(**status)


@app.post("/agent/route/plan", response_model=RoutePlanResponse)
def route_plan(request: RoutePlanRequest) -> RoutePlanResponse:
    """自然语言路线规划 — 统一走 Dispatcher 编排。"""
    response = dispatcher.process_with_intent(
        user_id=request.user_id,
        message=request.requirement,
        forced_intent="plan_trip_route",
    )
    reply = response["reply"]
    # RouteAgent 返回的 metadata.itinerary 包含结构化行程
    itinerary = reply.get("metadata", {}).get("itinerary", {})
    return RoutePlanResponse(
        status="ok",
        result={
            "summary": reply["content"],
            "itinerary": itinerary,
            "tools_used": reply.get("tools_used", []),
            "trace_id": reply.get("trace_id", ""),
        },
    )
