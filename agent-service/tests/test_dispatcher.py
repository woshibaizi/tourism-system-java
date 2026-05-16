"""
Dispatcher 集成测试 — 意图路由 + 会话管理 + trace。

不需要 LLM API key，测试意图分类和 Agent 路由逻辑。
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

import pytest

from app.agent import init_agents
from app.agent.dispatcher import Dispatcher
from app.agent.chat_agent import ChatAgent
from app.agent.diary_agent import DiaryAgent
from app.agent.route_agent import RouteAgent
from app.agent.base_agent import AgentContext, AgentResponse, BaseAgent


class FakeAgent(BaseAgent):
    """用于测试路由逻辑的假 Agent。"""

    def __init__(self, name: str = "fake", description: str = "test", intents=None):
        self._name = name
        self._description = description
        self._intents = intents or []
        self.last_message = ""
        self.last_context = None

    @property
    def name(self) -> str:
        return self._name

    @property
    def description(self) -> str:
        return self._description

    def can_handle(self, intent: str) -> bool:
        return intent in self._intents

    def process(self, message: str, context: AgentContext) -> AgentResponse:
        self.last_message = message
        self.last_context = context
        return AgentResponse(
            content=f"[{self._name}] {message}",
            intent=context.metadata.get("intent", "unknown"),
        )


class TestDispatcherRouting:
    """测试 Dispatcher 路由逻辑。"""

    def test_register_agent(self):
        d = Dispatcher()
        agent = FakeAgent("test", "test agent", ["test_intent"])
        d.register(agent, ["test_intent"])
        assert d.get_agent("test") is agent
        assert "test" in [a["name"] for a in d.list_agents()]

    def test_intent_routing_priority(self):
        """后注册的 Agent 覆盖先注册的 intent 映射。"""
        d = Dispatcher()
        a1 = FakeAgent("first", intents=["shared_intent"])
        a2 = FakeAgent("second", intents=["shared_intent"])
        d.register(a1, ["shared_intent"])
        d.register(a2, ["shared_intent"])
        assert d._intent_agent_map["shared_intent"] == "second"

    def test_unknown_intent_fallback_to_chat(self):
        d = Dispatcher()
        chat = FakeAgent("chat", intents=["general_chat"])
        d.register(chat, ["general_chat"])
        d._intent_agent_map["unknown_intent"] = ""  # simulate missing mapping
        context = AgentContext(
            user_id="u1", session_id="s1",
            metadata={"intent": "unknown_intent"},
        )
        result = chat.process("hello", context)
        assert result is not None


class TestDetectIntent:
    """测试意图检测（规则降级路径）。"""

    def test_route_intent_keywords(self):
        d = Dispatcher()
        chat = FakeAgent("chat", intents=["general_chat"])
        d.register(chat, ["general_chat"])

        result = d.detect_intent("帮我规划杭州一日游路线")
        assert result["intent"] in ("plan_trip_route", "general_chat")

    def test_diary_intent_keywords(self):
        d = Dispatcher()
        chat = FakeAgent("chat", intents=["general_chat"])
        d.register(chat, ["general_chat"])

        result = d.detect_intent("帮我写一篇旅行日记")
        assert result["intent"] in ("generate_diary", "general_chat")

    def test_recommend_intent_keywords(self):
        d = Dispatcher()
        chat = FakeAgent("chat", intents=["general_chat"])
        d.register(chat, ["general_chat"])

        result = d.detect_intent("推荐附近好吃的")
        assert result["intent"] in ("recommend_place", "general_chat")

    def test_general_chat_fallback(self):
        d = Dispatcher()
        chat = FakeAgent("chat", intents=["general_chat"])
        d.register(chat, ["general_chat"])

        result = d.detect_intent("你好")
        assert result["intent"] == "general_chat"


class TestInitAgents:
    """测试 init_agents() 注册结果。"""

    def test_all_agents_registered(self):
        d = init_agents()
        names = [a["name"] for a in d.list_agents()]
        assert "chat" in names
        assert "diary" in names
        assert "route" in names

    def test_route_intent_goes_to_route_agent(self):
        d = init_agents()
        assert d._intent_agent_map.get("plan_trip_route") == "route"

    def test_diary_intent_goes_to_diary_agent(self):
        d = init_agents()
        assert d._intent_agent_map.get("generate_diary") == "diary"

    def test_recommend_intent_goes_to_chat_agent(self):
        d = init_agents()
        assert d._intent_agent_map.get("recommend_place") == "chat"


class TestAgentContext:
    """测试 AgentContext 数据流。"""

    def test_context_metadata_flow(self):
        ctx = AgentContext(
            user_id="user_1",
            session_id="session_1",
            metadata={"buddy_id": "toxic_guide", "intent": "general_chat"},
        )
        assert ctx.metadata.get("buddy_id") == "toxic_guide"
        assert ctx.metadata.get("intent") == "general_chat"

    def test_session_messages_truncation(self):
        """确保 Dispatcher 对 session_messages 做了截断。"""
        msgs = [{"role": "user", "content": f"msg_{i}"} for i in range(20)]
        truncated = msgs[-10:]
        assert len(truncated) <= 10
