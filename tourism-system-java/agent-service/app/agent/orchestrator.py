"""
对话编排器：意图识别 → 工具调度 → 回复生成。

两种运行模式（自动降级）：
1. LLM 模式: 配置了 LLM_API_KEY 时使用大模型做意图分类和回复生成
2. 规则模式: 没有配置 LLM 时使用关键词匹配 + 模板回复，保证基本可用
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from app.agent.memory import session_store
from app.agent.prompts import (
    DIARY_FOLLOW_UP,
    DIARY_GENERATE_PROMPT,
    INTENT_CLASSIFY_PROMPT,
    ROUTE_FOLLOW_UP,
    ROUTE_PLAN_PROMPT,
    SYSTEM_PROMPT,
)
from app.config import settings
from app.schemas import ChatReply, ChatRequest, ChatResponse, DiaryGenerateResponse, RoutePlanResponse
from app.tools.image_diary import build_diary_draft
from app.tools.route_planner import build_route_outline
from app.tools.skill_registry import list_available_skills
from app.tools.tourism_api import tourism_api_client

logger = logging.getLogger(__name__)

# 延迟加载 llm_client，避免没有安装 openai/anthropic 时启动失败
_llm_client: Any = None


def _get_llm():
    """延迟初始化 LLM 客户端。"""
    global _llm_client
    if _llm_client is None:
        try:
            from app.agent.llm_client import llm_client as client

            _llm_client = client
        except ImportError as e:
            logger.warning("LLM 客户端初始化失败，降级为规则模式: %s", e)
            _llm_client = False  # type: ignore
    return _llm_client if _llm_client is not False else None


def _llm_available() -> bool:
    """LLM 是否可用。"""
    client = _get_llm()
    return client is not None and settings.llm_api_key


# ======================== 意图识别 ========================


_AVAILABLE_INTENTS = {
    "plan_trip_route": "路线规划",
    "generate_diary": "生成旅行日记",
    "recommend_place": "地点推荐",
    "general_chat": "闲聊/其他",
}


def detect_intent(message: str) -> dict[str, Any]:
    """
    意图识别。LLM 可用时走模型分类，不可用时降级为关键词规则。
    返回: {"intent": str, "confidence": float, "missing_context": list[str]}
    """
    if _llm_available():
        return _llm_classify(message)

    # 降级：关键词规则
    return _rule_classify(message)


def _llm_classify(message: str) -> dict[str, Any]:
    """LLM 意图分类。"""
    client = _get_llm()
    assert client is not None
    return client.classify_intent(
        message,
        _AVAILABLE_INTENTS,
        system_prompt=INTENT_CLASSIFY_PROMPT,
    )


def _rule_classify(message: str) -> dict[str, Any]:
    """关键词规则降级。"""
    lowered = message.lower()
    # 路线/导航类
    if any(kw in message for kw in ["路线", "行程", "导航", "怎么走", "规划"]) or "route" in lowered:
        missing = []
        if not any(kw in message for kw in ["今天", "明天", "半天", "一天", "两天", "校园", "景区"]):
            missing.append("duration")
        if not any(kw in message for kw in ["校园", "景区", "西湖", "杭州", "从", "到"]):
            missing.append("destination")
        return {
            "intent": "plan_trip_route",
            "confidence": 0.6,
            "missing_context": missing,
        }
    # 日记类
    if any(kw in message for kw in ["日记", "游记", "文案", "小红书"]):
        missing = []
        if not any(kw in message for kw in ["图片", "照片", "图"]):
            missing.append("images")
        return {
            "intent": "generate_diary",
            "confidence": 0.7,
            "missing_context": missing,
        }
    # 推荐类
    if any(kw in message for kw in ["推荐", "好吃的", "好玩的", "附近", "有什么"]):
        return {"intent": "recommend_place", "confidence": 0.5, "missing_context": []}
    # 兜底
    return {"intent": "general_chat", "confidence": 0.3, "missing_context": []}


# ======================== 回复生成 ========================


def _build_route_reply(message: str, session_messages: list[dict]) -> tuple[str, list[str], list[str]]:
    """路线规划回复。LLM 可用时走模型，否则走模板。"""
    if _llm_available():
        client = _get_llm()
        assert client is not None
        msgs: list[dict[str, str]] = [{"role": "system", "content": ROUTE_PLAN_PROMPT}]
        # 注入最近几轮对话作为上下文
        for m in session_messages[-6:]:
            msgs.append({"role": m.get("role", "user"), "content": m.get("content", "")})
        msgs.append({"role": "user", "content": message})
        content = client.chat(msgs)
        return content, _extract_highlights(content), ["llm", "route_planner"]

    # 降级：模板回复
    route_plan = build_route_outline(message)
    content = (
        f"{route_plan['summary']}。\n\n"
        f"建议时长：约 {route_plan['estimated_minutes']} 分钟。\n"
        "你可以继续补充出发地点、预算和兴趣偏好，我再把它细化成逐时段路线。"
    )
    return content, route_plan["highlights"], ["rule_route_planner"]


def _build_diary_reply(message: str, session_messages: list[dict]) -> tuple[str, list[str], list[str]]:
    """日记生成回复。"""
    if _llm_available():
        client = _get_llm()
        assert client is not None
        msgs: list[dict[str, str]] = [{"role": "system", "content": DIARY_GENERATE_PROMPT}]
        for m in session_messages[-6:]:
            msgs.append({"role": m.get("role", "user"), "content": m.get("content", "")})
        msgs.append({"role": "user", "content": message})
        content = client.chat(msgs)
        return content, _extract_tags(content), ["llm", "image_diary"]

    # 降级：模板回复
    diary = build_diary_draft(message, [])
    content = (
        f"我先为你准备了一版日记草稿《{diary['title']}》。\n\n"
        f"{diary['content']}\n\n"
        "如果你继续上传图片或补充地点/心情，我可以再把它改成更像小红书或旅行随笔的风格。"
    )
    return content, diary["tags"], ["rule_image_diary"]


def _build_recommend_reply(message: str, session_messages: list[dict]) -> tuple[str, list[str], list[str]]:
    """推荐回复：优先使用 LLM，否则调用后端 API 拼结果。"""
    if _llm_available():
        client = _get_llm()
        assert client is not None
        places = tourism_api_client.get_places()
        place_info = "\n".join(
            f"- {p.get('name', '未知')}: {p.get('description', '')[:80]}"
            for p in places[:10]
            if p.get("name")
        )
        msgs: list[dict[str, str]] = [
            {
                "role": "system",
                "content": (
                    "你是旅游推荐专家。根据系统中已有的真实地点数据做推荐，不要编造不存在的景点。\n"
                    f"当前可用地点：\n{place_info}"
                ),
            },
            {"role": "user", "content": message},
        ]
        content = client.chat(msgs)
        return content, _extract_highlights(content), ["llm", "tourism_api"]

    # 降级：直接调用后端 API
    places = tourism_api_client.get_places()
    names = [p.get("name", "未知") for p in places if p.get("name")]
    suggestions = names[:5] if names else ["路线规划", "地点推荐", "日记草稿"]
    content = f"你可以尝试以下热门地点：{'、'.join(suggestions)}。告诉我你想去哪类地方？"
    return content, suggestions, ["tourism_api"]


def _build_general_reply(message: str, session_messages: list[dict]) -> tuple[str, list[str], list[str]]:
    """兜底闲聊回复。"""
    if _llm_available():
        client = _get_llm()
        assert client is not None
        msgs: list[dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT}]
        for m in session_messages[-6:]:
            msgs.append({"role": m.get("role", "user"), "content": m.get("content", "")})
        msgs.append({"role": "user", "content": message})
        content = client.chat(msgs)
        return content, _extract_highlights(content), ["llm"]

    places = tourism_api_client.get_places()
    names = [p.get("name") for p in places if p.get("name")]
    suggestions = names[:3] if names else ["路线规划", "地点推荐", "日记草稿"]
    content = (
        "我是个性化旅游助手，可以帮你规划路线、推荐地点、生成旅行日记。\n\n"
        f"你刚才说的是：{message}\n"
        f"可以试试这些热门地点：{'、'.join(suggestions)}"
    )
    return content, suggestions, ["rule_fallback"]


# ======================== 主流程 ========================


def process_chat(request: ChatRequest) -> ChatResponse:
    """统一聊天入口。"""
    trace_id = f"trace_{uuid.uuid4().hex[:12]}"
    try:
        session = session_store.create_or_get_session(
            user_id=request.user_id,
            session_id=request.session_id,
            mode=request.mode,
            first_message=request.message,
        )
    except PermissionError as error:
        raise ValueError("非法会话访问") from error

    # 收集最近消息作为 LLM 上下文
    session_messages = [
        {"role": m.role, "content": m.content}
        for m in session.messages[-10:]
    ] if session.messages else []

    intent_result = detect_intent(request.message)
    intent = intent_result["intent"]
    missing = intent_result.get("missing_context", [])

    if missing:
        # 缺关键信息时追问
        follow_up_map = {
            "plan_trip_route": ROUTE_FOLLOW_UP,
            "generate_diary": DIARY_FOLLOW_UP,
        }
        reply_content = follow_up_map.get(intent, f"为了更好地帮你，请补充以下信息：{'、'.join(missing)}")
        suggestions = [f"补充{m}" for m in missing]
        tools_used = ["intent_classifier"]
    elif intent == "plan_trip_route":
        reply_content, suggestions, tools_used = _build_route_reply(request.message, session_messages)
    elif intent == "generate_diary":
        reply_content, suggestions, tools_used = _build_diary_reply(request.message, session_messages)
    elif intent == "recommend_place":
        reply_content, suggestions, tools_used = _build_recommend_reply(request.message, session_messages)
    else:
        reply_content, suggestions, tools_used = _build_general_reply(request.message, session_messages)

    session_detail = session_store.append_messages(session, request.message, reply_content)
    session_store.append_trace(
        {
            "trace_id": trace_id,
            "system_prompt": SYSTEM_PROMPT,
            "user_id": request.user_id,
            "session_id": session_detail.session_id,
            "intent": intent,
            "confidence": intent_result.get("confidence", 0),
            "llm_mode": _llm_available(),
            "message": request.message,
            "reply": reply_content,
            "tools_used": tools_used,
            "skills_available": list_available_skills(),
            "metadata": request.metadata,
        }
    )

    return ChatResponse(
        session=session_detail,
        reply=ChatReply(
            content=reply_content,
            intent=intent,
            trace_id=trace_id,
            suggestions=suggestions,
            tools_used=tools_used,
        ),
    )


# ======================== 独立端点处理 ========================


def generate_diary(request_user_id: str, prompt: str, images: list[str]) -> DiaryGenerateResponse:
    diary = build_diary_draft(prompt, images)
    return DiaryGenerateResponse(**diary)


def plan_route(request_user_id: str, requirement: str) -> RoutePlanResponse:
    route = build_route_outline(requirement)
    return RoutePlanResponse(**route)


# ======================== 辅助函数 ========================


def _extract_highlights(text: str) -> list[str]:
    """从 LLM 回复中提取关键短语作为建议标签。"""
    suggestions: list[str] = []
    for line in text.split("\n"):
        line = line.strip()
        # 提取 "1. xxx" / "- xxx" / "• xxx" 格式的要点
        if line and len(line) < 30:
            cleaned = line.lstrip("0123456789. -•#").strip()
            if 2 < len(cleaned) < 20:
                suggestions.append(cleaned)
    return suggestions[:5] if suggestions else ["试试其他问题"]


def _extract_tags(text: str) -> list[str]:
    """从回复中提取 #话题标签。"""
    import re

    tags = re.findall(r"#(\w+)", text)
    return tags[:8] if tags else []
