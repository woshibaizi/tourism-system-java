"""
意图分发器 — 意图识别 → Agent 路由 → 统一响应。

防御纵深：所有 outgoing 响应在 dispatcher 层经过最后一道 DSML/XML 清洗，
确保无论子 Agent 内部发生什么，raw invoke XML 都不会泄露到前端。
"""

from __future__ import annotations

import logging
import re
import uuid
from typing import Any


def _safety_strip_dsml(text: str) -> str:
    """最后一道防线：清除文本中的 DSML/XML 工具调用标签（全角 + ASCII 双模式）。

    使用与 llm_client._strip_dsml_from_content 完全相同的字符常量和模式。
    """
    if not text:
        return text
    has_dsml = any(marker in text for marker in ('invoke', 'DSML', '｜', '／'))
    if not has_dsml:
        return text

    FW = '｜'   # ｜ fullwidth vertical bar (DeepSeek 可能输出 1-2 个)
    FS = '／'   # ／ fullwidth solidus

    # 1. 全角 DSML 信封 — 匹配 1-2 个 FW（DeepSeek 输出不稳定）
    text = re.sub(
        r'<'+FW+r'{1,2}DSML'+FW+r'{1,2}tool_calls>.*?'+r'<'+FS+r'{1,2}DSML'+FW+r'{1,2}tool_calls>',
        '', text, flags=re.DOTALL,
    )
    # 2. 全角 DSML invoke 独立标签
    text = re.sub(
        r'<'+FW+r'{1,2}DSML'+FW+r'{1,2}invoke name="[^"]*">.*?'+r'<'+FS+r'{1,2}DSML'+FW+r'{1,2}invoke>',
        '', text, flags=re.DOTALL,
    )
    # 3. ASCII DSML 信封
    text = re.sub(r'<DSML\s+function_calls>.*?</DSML\s+function_calls>', '', text, flags=re.DOTALL)
    # 4. ASCII invoke 独立标签
    text = re.sub(r'<invoke\s+name="[^"]*"\s*>.*?</invoke\s*>', '', text, flags=re.DOTALL)
    # 5. 清理残留
    text = re.sub(r'<parameter\s+[^>]*>.*?</parameter\s*>', '', text, flags=re.DOTALL)

    return text.strip()


def _collect_session_images(session: dict[str, Any], current_images: list[str]) -> list[str]:
    """收集会话中所有用户消息的图片，合并去重后返回。

    用于日记生成时自动包含对话历史上传过的图片。
    """
    all_images: list[str] = list(current_images)
    seen: set[str] = set(all_images)
    for msg in session.get("messages", []):
        if msg.get("role") != "user":
            continue
        msg_images = msg.get("images")
        if not msg_images:
            continue
        if not isinstance(msg_images, list):
            logger.warning("消息 images 字段格式异常，预期 list: %s", type(msg_images))
            continue
        for img in msg_images:
            if img and isinstance(img, str) and img not in seen:
                all_images.append(img)
                seen.add(img)
    return all_images

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

        # 低置信度追问（仅置信度 < 0.4 时在 Dispatcher 层拦截，否则交给 Agent 处理）
        if should_ask and missing_slots and confidence < 0.4:
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

        # 持久化消息（含图片路径 + 日记卡片元数据）
        user_images = (metadata or {}).get("images", [])
        # 日记生成时：收集对话历史中所有用户发过的图片
        all_session_images = _collect_session_images(session, user_images)
        assistant_meta: dict[str, Any] = {}
        if response.metadata:
            if response.metadata.get("diary_card"):
                assistant_meta["diaryCard"] = True
                assistant_meta["diary_style"] = response.metadata.get("diary_style", "")
                # 始终注入 serverImages（即使为空），防止前端回退到仅含当前消息的图片列表
                assistant_meta["serverImages"] = all_session_images or []
            # xhsNotes 与 diary_card 解耦 — 任何时候有小红书搜索结果都持久化
            if response.metadata.get("xhsNotes"):
                assistant_meta["xhsNotes"] = response.metadata["xhsNotes"]
        updated_session = session_db.append_messages(
            sid, message, response.content,
            user_images=user_images if user_images else None,
            assistant_metadata=assistant_meta if assistant_meta else None,
        )

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

        reply_metadata = dict(response.metadata) if response.metadata else {}
        if response.metadata.get("diary_card"):
            reply_metadata["serverImages"] = all_session_images or []

        return {
            "session": updated_session,
            "reply": {
                "content": _safety_strip_dsml(response.content),
                "intent": response.intent,
                "trace_id": trace_id,
                "suggestions": response.suggestions,
                "tools_used": response.tools_used,
                "metadata": reply_metadata,
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

        # ======== 请求级 trace：每一步路由决策 ========
        agent_name = self._intent_agent_map.get(intent, "chat")
        route_agent_exists = "route" in self._agents
        logger.info(
            "[TRACE %s] msg='%s' intent=%s confidence=%s slots=%s missing=%s shouldAsk=%s "
            "agent_name=%s route_in_agents=%s agents=%s intent_map=%s",
            trace_id, message[:60], intent, confidence,
            intent_result.get("slots", {}), missing_slots, should_ask,
            agent_name, route_agent_exists,
            list(self._agents.keys()), dict(self._intent_agent_map),
        )
        # ======== trace 结束 ========

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

        # 低置信度追问（仅置信度 < 0.4 时在 Dispatcher 层拦截，否则交给 Agent 处理）
        if should_ask and missing_slots and confidence < 0.4:
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

        # 提前收集对话历史图片（日记生成时使用）
        user_images = (metadata or {}).get("images", [])
        all_session_images = _collect_session_images(session, user_images)

        full_content = ""
        _stream_done_meta: dict[str, Any] = {}
        if agent and hasattr(agent, "stream_process"):
            async for sse_event in agent.stream_process(message, context):
                if sse_event["event"] == "token":
                    full_content += sse_event["data"].get("content", "")
                elif sse_event["event"] == "done":
                    full_content = sse_event["data"].get("content", full_content)
                    # 最后一道防线：清理全角 + ASCII DSML/XML
                    full_content = _safety_strip_dsml(full_content)
                    sse_event["data"]["content"] = full_content
                    sse_event["data"]["trace_id"] = trace_id
                    sse_event["data"]["session_id"] = sid
                    sse_event["data"]["session"] = _session_summary(session)
                    # 注入对话历史图片，确保前端首次渲染日记卡片就有图片
                    # 使用 done 事件中的实际 diary_card 标志，而非 dispatcher 本地 intent
                    # （agent 内部可能将 intent 改为 generate_diary，如 _pending_style_confirm 流程）
                    # 始终注入 serverImages（即使为空数组），防止前端回退到仅含当前消息图片的 serverImagePaths
                    if sse_event["data"].get("diary_card"):
                        sse_event["data"]["serverImages"] = all_session_images or []
                    # 捕获 diary_card / xhsNotes 等元数据，用于持久化
                    _stream_done_meta = {
                        k: v for k, v in sse_event["data"].items()
                        if k in ("diary_card", "diary_style", "isDiaryCard", "serverImages", "xhsNotes")
                    }
                elif sse_event["event"] == "error":
                    pass
                yield sse_event
        elif agent:
            # 降级：无流式能力的 Agent 走同步模式
            response = await asyncio.to_thread(agent.process, message, context)
            full_content = _safety_strip_dsml(response.content)
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

        # 持久化消息（含图片路径 + 日记卡片元数据）
        # 提取 diary_card 等前端元数据，确保切换会话后卡片不消失
        assistant_meta = {}
        if _stream_done_meta:
            if _stream_done_meta.get("diary_card"):
                assistant_meta["diaryCard"] = True
                assistant_meta["diary_style"] = _stream_done_meta.get("diary_style", "")
                # 始终存储 serverImages（即使为空数组），确保卡片重载后图片不丢失
                assistant_meta["serverImages"] = all_session_images or []
            # xhsNotes 与 diary_card 解耦 — 任何时候有小红书搜索结果都持久化
            if _stream_done_meta.get("xhsNotes"):
                assistant_meta["xhsNotes"] = _stream_done_meta["xhsNotes"]
        await asyncio.to_thread(
            session_db.append_messages, sid, message, full_content,
            user_images=user_images if user_images else None,
            assistant_metadata=assistant_meta if assistant_meta else None,
        )

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
