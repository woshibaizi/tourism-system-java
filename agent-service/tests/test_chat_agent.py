"""
ChatAgent 测试 — 出游搭子 + function calling 降级 + 工具注册。

不需要 LLM API key，测试规则降级路径和搭子 prompt 加载。
"""

from __future__ import annotations

import pytest

from app.agent.chat_agent import ChatAgent
from app.agent.base_agent import AgentContext
from app.agent.prompts import (
    BUDDY_PRESETS,
    DEFAULT_BUDDY_ID,
    get_buddy_prompt,
    get_buddy_list,
    load_buddy_prompt,
)
from app.tools.registry import registry


class TestBuddyPrompts:
    """测试出游搭子 prompt 系统。"""

    def test_all_six_presets_exist(self):
        assert len(BUDDY_PRESETS) == 6
        expected = {"toxic_guide", "literary_cat", "special_forces", "failed_poet", "shy_junior", "beijing_laoye"}
        assert set(BUDDY_PRESETS.keys()) == expected

    def test_presets_have_name_and_prompt(self):
        for key, val in BUDDY_PRESETS.items():
            assert "name" in val, f"{key} missing name"
            assert "prompt" in val, f"{key} missing prompt"

    def test_get_buddy_prompt_known_id(self):
        prompt = get_buddy_prompt("toxic_guide")
        assert "退休老导游" in prompt

    def test_get_buddy_prompt_unknown_id_falls_to_default(self):
        prompt = get_buddy_prompt("nonexistent_buddy")
        assert prompt == BUDDY_PRESETS[DEFAULT_BUDDY_ID]["prompt"]

    def test_get_buddy_prompt_none_falls_to_default(self):
        prompt = get_buddy_prompt(None)
        assert prompt == BUDDY_PRESETS[DEFAULT_BUDDY_ID]["prompt"]

    def test_get_buddy_list_returns_six(self):
        lst = get_buddy_list()
        assert len(lst) == 6
        assert all("id" in item and "name" in item for item in lst)

    def test_load_buddy_prompt_preset(self):
        """load_buddy_prompt 对预设搭子返回对应 prompt。"""
        prompt = load_buddy_prompt("anonymous", "literary_cat")
        assert "三百年" in prompt

    def test_load_buddy_prompt_default(self):
        """无 buddy_id 时返回默认搭子。"""
        prompt = load_buddy_prompt("anonymous", None)
        assert "退休老导游" in prompt


class TestChatAgentBasics:
    """测试 ChatAgent 基本属性。"""

    def test_name(self):
        agent = ChatAgent()
        assert agent.name == "chat"

    def test_can_handle_intents(self):
        agent = ChatAgent()
        assert agent.can_handle("general_chat")
        assert agent.can_handle("recommend_place")
        assert agent.can_handle("plan_trip_route")
        assert agent.can_handle("search_place")
        assert agent.can_handle("reverse_recommend")

    def test_cannot_handle_unknown(self):
        agent = ChatAgent()
        assert not agent.can_handle("generate_diary")
        assert not agent.can_handle("dice_adventure")

    def test_get_system_prompt_default(self):
        agent = ChatAgent()
        prompt = agent.get_system_prompt()
        assert "个性化旅游助手" in prompt

    def test_get_system_prompt_with_buddy(self):
        agent = ChatAgent()
        ctx = AgentContext(
            user_id="u1", session_id="s1",
            metadata={"buddy_id": "beijing_laoye"},
        )
        prompt = agent.get_system_prompt(ctx)
        assert "北京老大爷" in prompt

    def test_get_system_prompt_no_context(self):
        agent = ChatAgent()
        prompt = agent.get_system_prompt()
        assert "个性化旅游助手" in prompt

    def test_get_tools_returns_list(self):
        agent = ChatAgent()
        tools = agent.get_tools()
        assert isinstance(tools, list)


class TestChatAgentRuleFallback:
    """测试 ChatAgent 规则降级和无 LLM 时的行为。"""

    def test_process_without_llm(self):
        agent = ChatAgent()
        ctx = AgentContext(user_id="u1", session_id="s1")
        resp = agent.process("你好", ctx)
        assert resp.intent == "general_chat"
        assert resp.content  # 确保有返回内容
        assert len(resp.tools_used) > 0

    def test_process_returns_suggestions(self):
        agent = ChatAgent()
        ctx = AgentContext(user_id="u1", session_id="s1")
        resp = agent.process("推荐好吃的", ctx)
        assert isinstance(resp.suggestions, list)

    def test_process_with_buddy_metadata(self):
        agent = ChatAgent()
        ctx = AgentContext(
            user_id="u1", session_id="s1",
            metadata={"buddy_id": "toxic_guide", "intent": "general_chat"},
        )
        resp = agent.process("杭州有什么好玩的", ctx)
        assert resp.intent in ("general_chat", "recommend_place")
        assert resp.content


class TestToolRegistry:
    """测试工具注册表。"""

    def test_tools_registered_by_chat_agent(self):
        agent = ChatAgent()
        tools = agent.get_tools()
        tool_names = [t["function"]["name"] for t in tools]
        assert "search_places" in tool_names
        assert "get_place_detail" in tool_names
        assert "get_hot_places" in tool_names
        assert "get_hot_foods" in tool_names
        assert "get_foods_by_cuisine" in tool_names

    def test_tool_definitions_have_required_fields(self):
        agent = ChatAgent()
        for tool_def in agent.get_tools():
            assert tool_def["type"] == "function"
            func = tool_def["function"]
            assert "name" in func
            assert "description" in func
            assert "parameters" in func

    def test_registry_dispatch_unknown_tool(self):
        import json
        result = registry.dispatch("no_such_tool", {})
        parsed = json.loads(result)
        assert parsed["ok"] is False

    def test_registry_list(self):
        tools = registry.list_tools()
        assert isinstance(tools, list)
        assert len(tools) > 0


class TestStreamProcess:
    """测试流式处理 async generator。"""

    async def test_stream_returns_done_event(self):
        agent = ChatAgent()
        ctx = AgentContext(user_id="u1", session_id="s1", metadata={"intent": "general_chat"})
        events = []
        async for event in agent.stream_process("你好", ctx):
            events.append(event)
        assert len(events) > 0
        assert events[-1]["event"] == "done"
        assert "content" in events[-1]["data"]

    async def test_stream_with_buddy(self):
        agent = ChatAgent()
        ctx = AgentContext(
            user_id="u1", session_id="s1",
            metadata={"buddy_id": "beijing_laoye", "intent": "general_chat"},
        )
        events = []
        async for event in agent.stream_process("北京有什么好玩的", ctx):
            events.append(event)
        assert events[-1]["event"] == "done"

    async def test_stream_without_llm_returns_done(self):
        """即使 LLM 不可用，stream 也返回 done 事件。"""
        agent = ChatAgent()
        ctx = AgentContext(user_id="u1", session_id="s1", metadata={"intent": "general_chat"})
        events = []
        async for event in agent.stream_process("你好", ctx):
            events.append(event)
        assert any(e["event"] == "done" for e in events)
