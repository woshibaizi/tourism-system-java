"""
意图分发器 — 意图识别 → Agent 路由 → 统一响应。

LLM 可用时走模型分类，不可用时降级为关键词规则。
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from app.agent.base_agent import AgentContext, AgentResponse, BaseAgent
from app.agent.prompts import DIARY_FOLLOW_UP, INTENT_CLASSIFY_PROMPT, ROUTE_FOLLOW_UP
from app.db.sqlite_store import session_db

logger = logging.getLogger(__name__)

_AVAILABLE_INTENTS = {
    "plan_trip_route": "路线规划",
    "generate_diary": "生成旅行日记",
    "recommend_place": "地点推荐",
    "general_chat": "闲聊/其他",
}


class Dispatcher:
    """意图分发器，管理 Agent 注册和路由。"""

    def __init__(self) -> None:
        self._agents: dict[str, BaseAgent] = {}
        self._intent_agent_map: dict[str, str] = {}

    def register(self, agent: BaseAgent, intents: list[str]) -> None:
        """注册 Agent 及其可处理的意图列表。"""
        self._agents[agent.name] = agent
        for intent in intents:
            self._intent_agent_map[intent] = agent.name
        logger.info("Agent 已注册: %s → intents=%s", agent.name, intents)

    def get_agent(self, name: str) -> BaseAgent | None:
        return self._agents.get(name)

    def list_agents(self) -> list[dict[str, Any]]:
        return [
            {"name": a.name, "description": a.description}
            for a in self._agents.values()
        ]

    def detect_intent(self, message: str) -> dict[str, Any]:
        """意图识别。LLM 可用时走模型分类，否则关键词规则。"""
        if _llm_available():
            return _llm_classify(message)
        return _rule_classify(message)

    def process_chat(
        self,
        user_id: str,
        message: str,
        session_id: str | None,
        mode: str = "travel_assistant",
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """统一聊天入口。"""
        trace_id = f"trace_{uuid.uuid4().hex[:12]}"

        try:
            session = session_db.create_or_get_session(
                user_id=user_id,
                session_id=session_id,
                mode=mode,
                first_message=message,
            )
        except PermissionError as e:
            raise ValueError("非法会话访问") from e

        sid = session["session_id"]
        session_messages = session.get("messages", [])

        # 意图识别
        intent_result = self.detect_intent(message)
        intent = intent_result["intent"]
        missing = intent_result.get("missing_context", [])

        # 构建 Agent 上下文
        context = AgentContext(
            user_id=user_id,
            session_id=sid,
            session_messages=[
                {"role": m["role"], "content": m["content"]}
                for m in session_messages[-10:]
            ] if session_messages else [],
            metadata=metadata or {},
        )

        # 路由到 Agent
        if missing:
            follow_up_map = {
                "plan_trip_route": ROUTE_FOLLOW_UP,
                "generate_diary": DIARY_FOLLOW_UP,
            }
            reply_content = follow_up_map.get(intent, f"为了更好地帮你，请补充以下信息：{'、'.join(missing)}")
            response = AgentResponse(
                content=reply_content,
                intent=intent,
                suggestions=[f"补充{m}" for m in missing],
                tools_used=["intent_classifier"],
            )
        else:
            agent_name = self._intent_agent_map.get(intent)
            if agent_name and agent_name in self._agents:
                agent = self._agents[agent_name]
                response = agent.process(message, context)
            else:
                # 兜底：走闲聊
                chat_agent = self._agents.get("chat")
                if chat_agent:
                    response = chat_agent.process(message, context)
                else:
                    response = AgentResponse(
                        content=f"我是个性化旅游助手，可以帮你规划路线、推荐地点、生成旅行日记。你说的是：{message}",
                        intent="general_chat",
                        suggestions=["路线规划", "地点推荐", "日记草稿"],
                        tools_used=["fallback"],
                    )

        # 持久化消息
        updated_session = session_db.append_messages(sid, message, response.content)

        # 写入 trace
        session_db.append_trace({
            "trace_id": trace_id,
            "user_id": user_id,
            "session_id": sid,
            "intent": intent,
            "confidence": intent_result.get("confidence", 0),
            "llm_mode": bool(_llm_available()),
            "message": message,
            "reply": response.content,
            "tools_used": response.tools_used,
            "metadata": metadata,
        })

        return {
            "session": updated_session,
            "reply": {
                "content": response.content,
                "intent": response.intent,
                "trace_id": trace_id,
                "suggestions": response.suggestions,
                "tools_used": response.tools_used,
                "metadata": response.metadata,
            },
        }


# ==================== 意图识别 ====================

_llm_client: Any = None


def _get_llm():
    global _llm_client
    if _llm_client is None:
        try:
            from app.agent.llm_client import llm_client as client
            _llm_client = client
        except ImportError as e:
            logger.warning("LLM 客户端初始化失败，降级为规则模式: %s", e)
            _llm_client = False
    return _llm_client if _llm_client is not False else None


def _llm_available() -> bool:
    client = _get_llm()
    return client is not None and bool(settings.llm_api_key)


def _llm_classify(message: str) -> dict[str, Any]:
    client = _get_llm()
    assert client is not None
    return client.classify_intent(message, _AVAILABLE_INTENTS, system_prompt=INTENT_CLASSIFY_PROMPT)


def _rule_classify(message: str) -> dict[str, Any]:
    lowered = message.lower()
    if any(kw in message for kw in ["路线", "行程", "导航", "怎么走", "规划"]) or "route" in lowered:
        missing = []
        if not any(kw in message for kw in ["今天", "明天", "半天", "一天", "两天", "校园", "景区"]):
            missing.append("duration")
        if not any(kw in message for kw in ["校园", "景区", "西湖", "杭州", "从", "到"]):
            missing.append("destination")
        return {"intent": "plan_trip_route", "confidence": 0.6, "missing_context": missing}
    if any(kw in message for kw in ["日记", "游记", "文案", "小红书"]):
        missing = []
        if not any(kw in message for kw in ["图片", "照片", "图"]):
            missing.append("images")
        return {"intent": "generate_diary", "confidence": 0.7, "missing_context": missing}
    if any(kw in message for kw in ["推荐", "好吃的", "好玩的", "附近", "有什么"]):
        return {"intent": "recommend_place", "confidence": 0.5, "missing_context": []}
    return {"intent": "general_chat", "confidence": 0.3, "missing_context": []}


# 模块级延迟导入避免循环依赖
from app.config import settings  # noqa: E402

# 全局单例
dispatcher = Dispatcher()
