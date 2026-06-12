"""
顶层编排 Agent — 轻量路由，零工具，状态无关。

职责：
1. 意图分类 → 选择子 Agent
2. 委托子 Agent 执行
3. SSE 事件透传（子 Agent 的工具调用对前端可见）
4. 结果质检 — 空结果/失败时降级兜底
5. 最大子 Agent 调用 ≤ 2 次（防止无限跳转）

子 Agent 不直接注册到 Dispatcher，由 Orchestrator 统一管理。
"""

from __future__ import annotations

import logging
from typing import Any

from app.agent.base_agent import AgentContext, AgentResponse, BaseAgent
from app.core.intent import classify_intent
from app.core.llm import llm_available

logger = logging.getLogger(__name__)

# 子 Agent 路由表：intent → agent_key
_INTENT_TO_AGENT: dict[str, str] = {
    "plan_trip_route": "route",
    "recommend_place": "discover",
    "search_place": "discover",
    "reverse_recommend": "discover",
    "generate_diary": "chat",
    "general_chat": "chat",
}


class OrchestratorAgent(BaseAgent):
    """顶层编排 Agent — 所有对话请求的统一入口。"""

    @property
    def name(self) -> str:
        return "orchestrator"

    @property
    def description(self) -> str:
        return "顶层编排：意图分类 → 子 Agent 调度 → 结果合成"

    def __init__(self) -> None:
        self._sub_agents: dict[str, BaseAgent] = {}
        self._init_sub_agents()

    def _init_sub_agents(self) -> None:
        """延迟初始化子 Agent（避免循环导入）。"""
        from app.agent.chat_agent import ChatAgent
        from app.agent.discover_agent import DiscoverAgent
        from app.agent.route_agent import RouteAgent

        self._sub_agents["chat"] = ChatAgent()
        self._sub_agents["discover"] = DiscoverAgent()
        self._sub_agents["route"] = RouteAgent()
        # DiaryAgent 通过专用端点调用，不参与对话路由
        logger.info(
            "Orchestrator 子 Agent 就绪: %s",
            list(self._sub_agents.keys()),
        )

    def get_system_prompt(self) -> str:
        return ""  # Orchestrator 不需要 system prompt

    def get_tools(self) -> list[dict[str, Any]]:
        return []  # Orchestrator 不调用工具

    def can_handle(self, intent: str) -> bool:
        # Orchestrator 处理所有意图
        return True

    # ==================== 同步处理 ====================

    def process(self, message: str, context: AgentContext) -> AgentResponse:
        # 1. 意图分类
        intent_result = classify_intent(message)
        intent = intent_result["intent"]
        confidence = intent_result.get("confidence", 0)
        missing_slots = intent_result.get("missingSlots", [])
        should_ask = intent_result.get("shouldAskClarifyingQuestion", False)

        # 2. 低置信度追问拦截
        if should_ask and missing_slots and confidence < 0.4:
            clarifying = intent_result.get("clarifyingQuestion", "")
            return AgentResponse(
                content=clarifying or f"为了更好地帮你，请补充以下信息：{'、'.join(missing_slots)}",
                intent=intent,
                suggestions=[f"补充{m}" for m in missing_slots],
                tools_used=["orchestrator_clarify"],
            )

        # 3. 路由到子 Agent
        agent_key = _INTENT_TO_AGENT.get(intent, "chat")
        agent = self._sub_agents.get(agent_key)

        if agent is None:
            return self._fallback(message)

        # 注入 intent slots 到 context
        context.metadata["intent"] = intent
        context.metadata["intent_slots"] = intent_result.get("slots", {})

        try:
            response = agent.process(message, context)
            return self._validate(agent_key, response, message)
        except Exception:
            logger.exception("子 Agent [%s] 执行异常，降级兜底", agent_key)
            return self._fallback(message)

    # ==================== 流式处理 ====================

    async def stream_process(self, message: str, context: AgentContext):
        """流式入口 — 意图分类 → 子 Agent 调度 → SSE 透传。"""
        import asyncio

        # 1. 意图分类
        intent_result = await asyncio.to_thread(classify_intent, message)
        intent = intent_result["intent"]
        confidence = intent_result.get("confidence", 0)
        missing_slots = intent_result.get("missingSlots", [])
        should_ask = intent_result.get("shouldAskClarifyingQuestion", False)

        logger.info(
            "[ORCHESTRATOR] intent=%s confidence=%s agent=%s msg=%s",
            intent, confidence, _INTENT_TO_AGENT.get(intent, "chat"),
            message[:60],
        )

        # 2. 低置信度追问拦截
        if should_ask and missing_slots and confidence < 0.4:
            clarifying = intent_result.get("clarifyingQuestion", "")
            yield {
                "event": "done",
                "data": {
                    "content": clarifying or f"为了更好地帮你，请补充以下信息：{'、'.join(missing_slots)}",
                    "intent": intent,
                    "suggestions": [f"补充{m}" for m in missing_slots],
                    "tools_used": ["orchestrator_clarify"],
                },
            }
            return

        # 3. 路由到子 Agent
        agent_key = _INTENT_TO_AGENT.get(intent, "chat")
        agent = self._sub_agents.get(agent_key)

        if agent is None:
            content = self._fallback(message).content
            yield {"event": "done", "data": {"content": content, "intent": "general_chat", "tools_used": ["orchestrator_fallback"]}}
            return

        # 注入 intent slots
        context.metadata["intent"] = intent
        context.metadata["intent_slots"] = intent_result.get("slots", {})

        # 4. 委托子 Agent 流式处理 — SSE 事件透传
        try:
            if hasattr(agent, "stream_process"):
                async for sse_event in agent.stream_process(message, context):
                    # 透传子 Agent 的 tool_call / tool_result / token 事件
                    # done 事件由 Dispatcher 统一注入 trace_id / session_id
                    yield sse_event
            else:
                # 降级：子 Agent 无 stream_process，走同步
                response = await asyncio.to_thread(agent.process, message, context)
                validated = self._validate(agent_key, response, message)
                yield {
                    "event": "done",
                    "data": {
                        "content": validated.content,
                        "intent": validated.intent,
                        "suggestions": validated.suggestions,
                        "tools_used": validated.tools_used,
                    },
                }
        except Exception:
            logger.exception("子 Agent [%s] 流式处理异常", agent_key)
            content = self._fallback(message).content
            yield {
                "event": "done",
                "data": {
                    "content": content,
                    "intent": "general_chat",
                    "suggestions": ["推荐景点", "规划路线", "写篇游记"],
                    "tools_used": ["orchestrator_error_fallback"],
                },
            }

    # ==================== 结果质检 ====================

    def _validate(
        self, agent_key: str, response: AgentResponse, original_message: str,
    ) -> AgentResponse:
        """质检子 Agent 返回结果，空结果或明显失败时降级。"""
        content = (response.content or "").strip()

        # 空回复 → 降级
        if not content:
            logger.warning("子 Agent [%s] 返回空内容，降级兜底", agent_key)
            return self._fallback(original_message)

        # RouteAgent 异常短回复（可能 LLM 拒绝规划）→ 标记
        if agent_key == "route" and len(content) < 30:
            logger.warning(
                "RouteAgent 返回异常短回复 (%d chars): %s", len(content), content[:50]
            )

        return response

    def _fallback(self, message: str) -> AgentResponse:
        """最终兜底回复 — LLM 不可用或所有子 Agent 失败时。"""
        if llm_available():
            return AgentResponse(
                content=(
                    "抱歉，我暂时无法完成这个请求。你可以试试：\n"
                    "- 🔍 搜索或推荐地点\n"
                    "- 🗺️ 规划旅行路线\n"
                    "- 📝 生成旅行日记\n\n"
                    "换个说法试试？"
                ),
                intent="general_chat",
                suggestions=["推荐景点", "规划路线", "写篇游记"],
                tools_used=["orchestrator_fallback"],
            )

        return AgentResponse(
            content=(
                "我是个性化旅游助手。\n\n"
                "你可以试试这些功能：\n"
                "- 搜索和推荐地点\n"
                "- 规划旅行路线\n"
                "- 生成旅行日记\n\n"
                "告诉我你想做什么吧～"
            ),
            intent="general_chat",
            suggestions=["推荐景点", "规划路线", "写篇游记"],
            tools_used=["orchestrator_fallback"],
        )
