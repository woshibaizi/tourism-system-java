from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import json
import uuid

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.agent import init_agents
from app.agent.diary_agent import DiaryAgent, get_task_status
from app.agent.prompts import BUDDY_PRESETS, get_buddy_list
from app.config import settings
from app.db.sqlite_store import buddy_db, session_db, task_db
from app.schemas import (
    BuddyProfile,
    ChatRequest,
    ChatResponse,
    CreateBuddyRequest,
    DiaryGenerateRequest,
    DiaryGenerateResponse,
    DiaryPublishRequest,
    DiaryPublishResponse,
    DiaryRegenerateRequest,
    DiaryTaskStatus,
    DiaryPolishRequest,
    DiaryPolishResponse,
    DiarySuggestTitleRequest,
    DiarySuggestTitleResponse,
    DiaryExtractTagsRequest,
    DiaryExtractTagsResponse,
    DiaryDescribeImagesRequest,
    DiaryDescribeImagesResponse,
    HealthResponse,
    RoutePlanRequest,
    RoutePlanResponse,
    SessionDetail,
    SessionRenameRequest,
    SessionSummary,
    StylePrefsResponse,
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
        # 合并 images 到 metadata，让 Agent 能感知图片
        metadata = {**(request.metadata or {})}
        if request.images:
            metadata["images"] = request.images
        # 纯图片无文字时，使用默认 prompt
        message = request.message.strip() if request.message else ""
        if not message and request.images:
            message = "请描述这些图片的内容，识别地点、场景或美食"
        result = dispatcher.process_chat(
            user_id=request.user_id,
            message=message,
            session_id=request.session_id,
            mode=request.mode,
            metadata=metadata,
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
            # 合并 images 到 metadata
            metadata = {**(request.metadata or {})}
            if request.images:
                metadata["images"] = request.images
            # 纯图片无文字时，使用默认 prompt
            message = request.message.strip() if request.message else ""
            if not message and request.images:
                message = "请描述这些图片的内容，识别地点、场景或美食"
            async for event in dispatcher.process_chat_stream(
                user_id=request.user_id,
                message=message,
                session_id=request.session_id,
                mode=request.mode,
                metadata=metadata,
            ):
                event_type = event.get("event", "done")
                event_data = event.get("data", {})
                # ═══ 最外层防线: done 事件的 content 强制清洗 ═══
                if event_type == "done" and event_data.get("content"):
                    import re as _mw_re
                    FW = '｜'; FS = '／'
                    c = event_data["content"]
                    if any(m in c for m in ('invoke', 'DSML', FW, FS)):
                        # 匹配单或双全角竖线 (DeepSeek 输出格式不稳定)
                        c = _mw_re.sub(r'<'+FW+r'{1,2}DSML'+FW+r'{1,2}tool_calls>.*?'+r'<'+FS+r'{1,2}DSML'+FW+r'{1,2}tool_calls>', '', c, flags=_mw_re.DOTALL)
                        c = _mw_re.sub(r'<'+FW+r'{1,2}DSML'+FW+r'{1,2}invoke name="[^"]*">.*?'+r'<'+FS+r'{1,2}DSML'+FW+r'{1,2}invoke>', '', c, flags=_mw_re.DOTALL)
                        c = _mw_re.sub(r'<DSML\s+function_calls>.*?</DSML\s+function_calls>', '', c, flags=_mw_re.DOTALL)
                        c = _mw_re.sub(r'<invoke\s+name="[^"]*"\s*>.*?</invoke\s*>', '', c, flags=_mw_re.DOTALL)
                        c = c.strip()
                        event_data["content"] = c
                data = json.dumps(event_data, ensure_ascii=False)
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
    """启动图片日记生成异步任务。前端通过 GET /agent/diary/status/{task_id} 轮询进度。

    支持两种风格指定方式（向后兼容）：
    - style: 简单字符串（如 "小红书"、"朋友圈"）
    - styleProfile: 结构化 StyleProfile 对象（优先于 style）
    """
    # 构建 metadata：style_profile 优先于 style
    metadata: dict[str, Any] = {
        "images": request.images,
        "style": request.style,
        **(request.metadata or {}),
    }
    if request.style_profile is not None:
        # 将 Pydantic 模型转为 dict（使用 Python 字段名，非 camelCase alias）
        profile_dict = request.style_profile.model_dump(by_alias=False, exclude_none=True)
        metadata["style_profile"] = profile_dict
        # 如果 style_profile 中有 preset，同步更新 style 字符串
        if profile_dict.get("preset"):
            metadata["style"] = profile_dict["preset"]

    # 直接调用 DiaryAgent（不走 Dispatcher 路由，因为聊天中的 generate_diary 由 ChatAgent 处理）
    agent = _get_diary_agent()
    from app.agent.base_agent import AgentContext
    context = AgentContext(
        user_id=request.user_id,
        session_id=None,
        session_messages=[],
        metadata=metadata,
    )
    response = agent.process(request.prompt, context)
    task_id = response.metadata.get("task_id", "")
    return DiaryGenerateResponse(
        task_id=task_id,
        status="running",
        progress=0,
        message=response.content,
    )


@app.get("/agent/diary/status/{task_id}", response_model=DiaryTaskStatus)
def diary_status(task_id: str) -> DiaryTaskStatus:
    """轮询日记生成进度。"""
    status = get_task_status(task_id)
    if status is None:
        raise HTTPException(status_code=404, detail="task not found")
    return DiaryTaskStatus(**status)


@app.post("/agent/diary/regenerate", response_model=DiaryGenerateResponse)
def diary_regenerate(request: DiaryRegenerateRequest) -> DiaryGenerateResponse:
    """换风格重新生成日记。复用已有图片分析和要素提取，直接从正文撰写阶段开始。

    返回新的 task_id，前端通过 GET /agent/diary/status/{task_id} 轮询进度。
    """
    diary_agent = dispatcher.get_agent("diary")
    if diary_agent is None or not isinstance(diary_agent, DiaryAgent):
        raise HTTPException(status_code=503, detail="日记 Agent 未就绪")

    # 构建 style_profile
    style_profile: dict[str, Any] | None = None
    if request.style_profile is not None:
        style_profile = request.style_profile.model_dump(by_alias=False, exclude_none=True)

    response = diary_agent.regenerate(
        user_id=request.user_id,
        original_task_id=request.original_task_id,
        style=request.style,
        style_profile=style_profile,
    )
    task_id = response.metadata.get("task_id", "")
    return DiaryGenerateResponse(
        task_id=task_id,
        status="running",
        progress=0,
        message=response.content,
    )


# ==================== 轻量级 AI 写作辅助 ====================


def _get_diary_agent() -> DiaryAgent:
    """获取 DiaryAgent 实例，未就绪时抛出 503。"""
    agent = dispatcher.get_agent("diary")
    if agent is None or not isinstance(agent, DiaryAgent):
        raise HTTPException(status_code=503, detail="日记 Agent 未就绪")
    return agent


@app.post("/agent/diary/polish", response_model=DiaryPolishResponse)
def diary_polish(request: DiaryPolishRequest) -> DiaryPolishResponse:
    """AI 润色已有旅行笔记。"""
    agent = _get_diary_agent()
    polished = agent.polish_text(request.content, request.style_hint)
    return DiaryPolishResponse(polished=polished)


@app.post("/agent/diary/suggest-title", response_model=DiarySuggestTitleResponse)
def diary_suggest_title(request: DiarySuggestTitleRequest) -> DiarySuggestTitleResponse:
    """AI 根据内容生成标题候选。"""
    agent = _get_diary_agent()
    titles = agent.suggest_titles(request.content, request.count)
    return DiarySuggestTitleResponse(titles=titles)


@app.post("/agent/diary/extract-tags", response_model=DiaryExtractTagsResponse)
def diary_extract_tags(request: DiaryExtractTagsRequest) -> DiaryExtractTagsResponse:
    """AI 从内容中提取标签。"""
    agent = _get_diary_agent()
    tags = agent.extract_tags(request.content, request.count)
    return DiaryExtractTagsResponse(tags=tags)


@app.post("/agent/diary/describe-images", response_model=DiaryDescribeImagesResponse)
def diary_describe_images(request: DiaryDescribeImagesRequest) -> DiaryDescribeImagesResponse:
    """AI 图生文——分析图片并生成文字描述。"""
    agent = _get_diary_agent()
    descriptions = agent.describe_images(request.images)
    return DiaryDescribeImagesResponse(descriptions=descriptions)


@app.get("/agent/user/style-prefs", response_model=StylePrefsResponse)
def get_style_prefs(user_id: str = Query(default="anonymous")) -> StylePrefsResponse:
    """获取用户上次使用的风格偏好。"""
    profile = task_db.get_preference(user_id, "last_style_profile")
    last_style = "小红书"
    if profile and profile.get("preset"):
        last_style = profile["preset"]
    elif profile and profile.get("tone"):
        last_style = "自定义"
    return StylePrefsResponse(
        user_id=user_id,
        style_profile=profile,
        last_style=last_style,
    )


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


# ==================== 对话式游记生成 & 一键发布 ====================


@app.post("/agent/diary/generate-from-chat", response_model=DiaryGenerateResponse)
def diary_generate_from_chat(request: ChatRequest) -> DiaryGenerateResponse:
    """
    从对话历史中生成游记（对话式）— 不同于 /agent/diary/generate（填表式）。

    从会话历史中提取旅行相关素材，调用 DiaryAgent 生成完整游记。
    返回 task_id 用于轮询进度，或直接同步返回结果。
    """
    diary_agent = _get_diary_agent()
    session_id = request.session_id

    # 获取会话历史消息
    session_messages: list[dict[str, Any]] = []
    if session_id:
        session = session_db.get_session(request.user_id, session_id)
        if session:
            session_messages = [
                {"role": m["role"], "content": m["content"]}
                for m in (session.get("messages") or [])[-30:]
            ]

    style = request.metadata.get("style", "小红书") if request.metadata else "小红书"
    style_profile = request.metadata.get("style_profile") if request.metadata else None

    result = diary_agent.generate_from_conversation(
        user_id=request.user_id,
        session_messages=session_messages,
        style=style,
        style_profile=style_profile,
        user_message=request.message,
        extra_images=request.images if request.images else None,
    )

    if result.get("success"):
        return DiaryGenerateResponse(
            task_id=f"conv_{uuid.uuid4().hex[:12]}",
            status="completed",
            progress=100,
            message=f"日记《{result.get('title', '')}》已生成，可以一键发布或继续修改",
        )
    else:
        return DiaryGenerateResponse(
            task_id="",
            status="failed",
            progress=0,
            message=result.get("error", "生成失败"),
        )


@app.post("/agent/diary/publish", response_model=DiaryPublishResponse)
def diary_publish(request: DiaryPublishRequest) -> DiaryPublishResponse:
    """
    一键发布：将对话中生成的游记保存到 Java 后端数据库。

    用户在前端看到游记卡片，点击「一键发布」→ 此接口 → POST /api/diaries → 日记入库。
    """
    import uuid as _uuid

    diary_agent = _get_diary_agent()
    result = diary_agent.publish_diary(
        user_id=request.user_id,
        title=request.title,
        content=request.content,
        images=request.images,
        tags=request.tags,
        place_id=request.place_id,
        style=request.style,
    )

    return DiaryPublishResponse(
        diary_id=result.get("diary_id", ""),
        success=result.get("success", False),
        title=result.get("title", request.title),
        error=result.get("error"),
    )


# ==================== 小红书内容抓取 ====================


@app.get("/agent/xhs/search")
def xhs_search_notes(
    query: str = Query(description="搜索关键词"),
    num: int = Query(default=10, description="返回数量"),
):
    """搜索小红书热门笔记（Agent Tool 端点 + 调试接口）。

    系统级 Cookie 从 .env 读取，仅支持只读搜索操作。
    """
    from app.tools.xhs_scraper import quick_search

    result = quick_search(query, num=num)
    return {"ok": True, "data": result}


# ==================== 小红书账号验证 ====================


@app.post("/agent/xhs/validate")
def xhs_validate(body: dict):
    """验证小红书 Cookie 是否有效。

    body: {"cookies_str": "a1=...; web_session=..."}
    → {"ok": true, "data": {"xhs_user_id": "...", "xhs_username": "草莓味旅行家", "xhs_avatar": "..."}}
    """
    from app.skills.xhs_client import XHSClient
    cookies_str = (body or {}).get("cookies_str", "")
    if not cookies_str:
        return {"ok": False, "error": "cookies_str 不能为空"}
    client = XHSClient()
    return client.validate_cookie(cookies_str)


# ==================== 小红书发布 ====================


@app.post("/agent/xhs/publish")
def xhs_publish(body: dict):
    """发布日记到小红书。

    body: {
        "diary_id": "diary_001",
        "title": "...",
        "content": "...",
        "tags": [...],
        "images": [...],
        "place_name": "...",
        "cookies_str": "..."  (Java 解密后传入)
    }
    """
    from app.skills.xhs_client import XHSClient
    from app.tools.xhs_scraper import _adapt_diary_to_note_info

    try:
        cookies_str = (body or {}).get("cookies_str", "")
        if not cookies_str:
            return {"ok": False, "error": "cookies_str 不能为空", "code": "NO_COOKIE"}

        # 适配: TravelDiary → noteInfo
        note_info, error = _adapt_diary_to_note_info(body)
        if error:
            return {"ok": False, "error": error, "code": "ADAPT_ERROR"}

        # 发布
        client = XHSClient()
        result = client.publish_note(note_info, cookies_str)

        if not result.get("ok"):
            return {
                "ok": False,
                "error": result.get("error", "发布失败"),
                "code": result.get("code", "PUBLISH_FAILED"),
            }

        return {
            "ok": True,
            "note_id": result.get("data", {}).get("note_id", ""),
            "publish_url": f"https://www.xiaohongshu.com/explore/{result.get('data', {}).get('note_id', '')}",
        }
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception("xhs_publish failed")
        return {"ok": False, "error": str(e), "code": "PUBLISH_ERROR"}


@app.post("/agent/xhs/refresh-place")
def xhs_refresh_place(
    place_name: str = Query(description="景点名称"),
    place_id: str = Query(description="景点 ID"),
    place_type: str = Query(default="general", description="景点类型"),
):
    """按需刷新指定景点的小红书热度数据。

    用于: 运营后台手动触发 / 场所详情页首次访问时异步调用。
    """
    import logging
    import traceback
    log = logging.getLogger(__name__)

    try:
        from app.tools.xhs_scraper import refresh_place_xhs_data
        result = refresh_place_xhs_data(
            place_name=place_name,
            place_id=place_id,
            place_type=place_type,
        )
        return result
    except ImportError as e:
        log.error("XHS scraper import failed: %s\n%s", e, traceback.format_exc())
        return {
            "ok": False,
            "error": f"小红书抓取模块未就绪: {e}",
            "code": "XHS_IMPORT_ERROR",
            "place_id": place_id,
        }
    except Exception as e:
        log.error("XHS refresh failed for %s: %s\n%s", place_id, e, traceback.format_exc())
        return {
            "ok": False,
            "error": f"小红书数据抓取失败: {e}",
            "code": "XHS_REFRESH_ERROR",
            "place_id": place_id,
        }
