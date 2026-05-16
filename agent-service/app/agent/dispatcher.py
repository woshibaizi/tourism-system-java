"""
意图分发器 — 意图识别 → Agent 路由 → 统一响应。
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from app.agent.base_agent import AgentContext, AgentResponse, BaseAgent
from app.agent.prompts import DIARY_FOLLOW_UP, ROUTE_FOLLOW_UP
from app.core.intent import classify_intent
from app.core.llm import llm_available
from app.db.sqlite_store import session_db

logger = logging.getLogger(__name__)


def _session_summary(session: dict[str, Any]) -> dict[str, Any]:
    """Build a lightweight session summary for SSE done events."""
    msgs = session.get("messages") or []
    first = msgs[0].get("content", "")[:30] if msgs else ""
    last = msgs[-1].get("content", "")[:40] if msgs else ""
    return {
        "sessionId": session.get("session_id", ""),
        "title": session.get("title") or first or "新对话",
        "preview": last,
        "mode": session.get("mode", "travel_assistant"),
        "messageCount": len(msgs),
        "createdAt": session.get("created_at"),
        "updatedAt": session.get("updated_at"),
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
        """意图识别 + 槽位抽取。"""
        return classify_intent(message)

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
        confidence = intent_result.get("confidence", 0)
        missing_slots = intent_result.get("missingSlots", [])
        should_ask = intent_result.get("shouldAskClarifyingQuestion", False)
        clarifying_question = intent_result.get("clarifyingQuestion", "")

        # 构建 Agent 上下文
        context = AgentContext(
            user_id=user_id,
            session_id=sid,
            session_messages=[
                {"role": m["role"], "content": m["content"]}
                for m in session_messages[-10:]
            ] if session_messages else [],
            metadata={
                **(metadata or {}),
                "intent": intent,
                "intent_slots": intent_result.get("slots", {}),
            },
        )

        # 低置信度追问
        if should_ask and missing_slots:
            follow_up_map = {
                "plan_trip_route": ROUTE_FOLLOW_UP,
                "generate_diary": DIARY_FOLLOW_UP,
            }
            reply_content = clarifying_question or follow_up_map.get(
                intent, f"为了更好地帮你，请补充以下信息：{'、'.join(missing_slots)}"
            )
            response = AgentResponse(
                content=reply_content,
                intent=intent,
                suggestions=[f"补充{m}" for m in missing_slots],
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

        # 写入 trace（含增强字段）
        session_db.append_trace({
            "trace_id": trace_id,
            "user_id": user_id,
            "session_id": sid,
            "intent": intent,
            "confidence": confidence,
            "router_decision": self._intent_agent_map.get(intent, "fallback"),
            "slots": intent_result.get("slots", {}),
            "llm_mode": bool(llm_available()),
            "message": message,
            "reply": response.content,
            "tools_used": response.tools_used,
            "tool_latencies": response.metadata.get("tool_latencies", []),
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


    async def process_chat_stream(
        self,
        user_id: str,
        message: str,
        session_id: str | None,
        mode: str = "travel_assistant",
        metadata: dict[str, Any] | None = None,
    ):
        """
        流式聊天入口 — 异步生成器，逐 SSE 事件产出。
        事件格式: {"event": "token"|"tool_call"|"tool_result"|"done"|"error", "data": {...}}
        """
        import asyncio

        trace_id = f"trace_{uuid.uuid4().hex[:12]}"

        try:
            session = await asyncio.to_thread(
                session_db.create_or_get_session,
                user_id=user_id,
                session_id=session_id,
                mode=mode,
                first_message=message,
            )
        except PermissionError as e:
            yield {"event": "error", "data": {"message": "非法会话访问"}}
            return

        sid = session["session_id"]
        session_messages = session.get("messages", [])

        # 意图识别
        intent_result = await asyncio.to_thread(self.detect_intent, message)
        intent = intent_result["intent"]
        confidence = intent_result.get("confidence", 0)
        missing_slots = intent_result.get("missingSlots", [])
        should_ask = intent_result.get("shouldAskClarifyingQuestion", False)
        clarifying_question = intent_result.get("clarifyingQuestion", "")

        context = AgentContext(
            user_id=user_id,
            session_id=sid,
            session_messages=[
                {"role": m["role"], "content": m["content"]}
                for m in session_messages[-10:]
            ] if session_messages else [],
            metadata={
                **(metadata or {}),
                "intent": intent,
                "intent_slots": intent_result.get("slots", {}),
            },
        )

        # 低置信度追问
        if should_ask and missing_slots:
            follow_up_map = {
                "plan_trip_route": ROUTE_FOLLOW_UP,
                "generate_diary": DIARY_FOLLOW_UP,
            }
            reply_content = clarifying_question or follow_up_map.get(
                intent, f"为了更好地帮你，请补充以下信息：{'、'.join(missing_slots)}"
            )
            yield {
                "event": "done",
                "data": {
                    "content": reply_content,
                    "intent": intent,
                    "trace_id": trace_id,
                    "session_id": sid,
                    "session": _session_summary(session),
                    "suggestions": [f"补充{m}" for m in missing_slots],
                    "tools_used": ["intent_classifier"],
                },
            }
            await asyncio.to_thread(session_db.append_messages, sid, message, reply_content)
            return

        # 路由到 Agent 流式处理
        agent_name = self._intent_agent_map.get(intent, "chat")
        agent = self._agents.get(agent_name, self._agents.get("chat"))

        full_content = ""
        if agent and hasattr(agent, "stream_process"):
            async for sse_event in agent.stream_process(message, context):
                if sse_event["event"] == "token":
                    full_content += sse_event["data"].get("content", "")
                elif sse_event["event"] == "done":
                    full_content = sse_event["data"].get("content", full_content)
                    sse_event["data"]["trace_id"] = trace_id
                    sse_event["data"]["session_id"] = sid
                    sse_event["data"]["session"] = _session_summary(session)
                elif sse_event["event"] == "error":
                    pass
                yield sse_event
        elif agent:
            # 降级：无流式能力的 Agent 走同步模式
            response = await asyncio.to_thread(agent.process, message, context)
            full_content = response.content
            yield {
                "event": "done",
                "data": {
                    "content": full_content,
                    "intent": response.intent,
                    "trace_id": trace_id,
                    "session_id": sid,
                    "session": _session_summary(session),
                    "suggestions": response.suggestions,
                    "tools_used": response.tools_used,
                },
            }
        else:
            yield {
                "event": "done",
                "data": {
                    "content": f"我是个性化旅游助手，可以帮你规划路线、推荐地点、生成旅行日记。你说的是：{message}",
                    "intent": "general_chat",
                    "trace_id": trace_id,
                    "session_id": sid,
                    "session": _session_summary(session),
                    "suggestions": ["路线规划", "地点推荐"],
                    "tools_used": ["fallback"],
                },
            }

        # 持久化消息
        await asyncio.to_thread(session_db.append_messages, sid, message, full_content)

        # 写入 trace
        await asyncio.to_thread(session_db.append_trace, {
            "trace_id": trace_id,
            "user_id": user_id,
            "session_id": sid,
            "intent": intent,
            "confidence": confidence,
            "router_decision": agent_name or "fallback",
            "slots": intent_result.get("slots", {}),
            "llm_mode": bool(llm_available()),
            "message": message,
            "reply": full_content,
            "tools_used": [],
            "metadata": metadata,
        })

    def process_with_intent(
        self,
        user_id: str,
        message: str,
        forced_intent: str,
        session_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """使用指定意图处理请求（跳过意图检测），用于 diary/route 等专用端点。"""
        trace_id = f"trace_{uuid.uuid4().hex[:12]}"
        intent = forced_intent
        confidence = 1.0

        context = AgentContext(
            user_id=user_id,
            session_id=session_id,
            session_messages=[],
            metadata={
                "intent": forced_intent,
                **(metadata or {}),
            },
        )

        agent_name = self._intent_agent_map.get(intent)
        if agent_name and agent_name in self._agents:
            agent = self._agents[agent_name]
            response = agent.process(message, context)
        else:
            chat_agent = self._agents.get("chat")
            if chat_agent:
                response = chat_agent.process(message, context)
            else:
                response = AgentResponse(
                    content=f"无法处理意图 {intent}: {message}",
                    intent="general_chat",
                    suggestions=[],
                    tools_used=["fallback"],
                )

        # 写入 trace
        session_db.append_trace({
            "trace_id": trace_id,
            "user_id": user_id,
            "session_id": session_id or "none",
            "intent": intent,
            "confidence": confidence,
            "router_decision": agent_name or "fallback",
            "slots": {},
            "llm_mode": bool(llm_available()),
            "message": message,
            "reply": response.content,
            "tools_used": response.tools_used,
            "tool_latencies": response.metadata.get("tool_latencies", []),
            "metadata": metadata,
        })

        return {
            "reply": {
                "content": response.content,
                "intent": response.intent,
                "trace_id": trace_id,
                "suggestions": response.suggestions,
                "tools_used": response.tools_used,
                "metadata": response.metadata,
            },
        }


# 全局单例
dispatcher = Dispatcher()
