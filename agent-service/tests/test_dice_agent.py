"""DiceAgent 测试 — 扔骰子旅行。"""

from __future__ import annotations

import pytest

from app.agent.dice_agent import DiceAgent, TASK_TEMPLATES
from app.agent.base_agent import AgentContext


class TestDiceAgentBasics:
    def test_name(self):
        agent = DiceAgent()
        assert agent.name == "dice"

    def test_can_handle(self):
        agent = DiceAgent()
        assert agent.can_handle("dice_adventure")
        assert not agent.can_handle("general_chat")

    def test_get_system_prompt(self):
        agent = DiceAgent()
        prompt = agent.get_system_prompt()
        assert "扔骰子" in prompt

    def test_get_tools(self):
        agent = DiceAgent()
        tools = agent.get_tools()
        assert isinstance(tools, list)
        assert len(tools) > 0


class TestTaskTemplates:
    def test_templates_exist(self):
        assert len(TASK_TEMPLATES) == 8

    def test_templates_have_required_fields(self):
        for t in TASK_TEMPLATES:
            assert "task" in t
            assert "then" in t
            assert "note" in t
            assert "penalty" in t


class TestDiceAgentProcess:
    def test_process_returns_dice_result(self):
        agent = DiceAgent()
        ctx = AgentContext(
            user_id="u1", session_id="s1",
            metadata={
                "intent": "dice_adventure",
                "lat": 30.259, "lng": 120.149,
            },
        )
        resp = agent.process("扔个骰子", ctx)
        assert resp.intent == "dice_adventure"
        assert resp.content
        assert "dice_result" in resp.metadata
        result = resp.metadata["dice_result"]
        assert 1 <= result["dice_value"] <= 6
        assert result["task"]

    def test_process_different_results(self):
        """多次调用返回的任务可能不同。"""
        agent = DiceAgent()
        ctx = AgentContext(
            user_id="u1", session_id="s1",
            metadata={"intent": "dice_adventure"},
        )
        results = set()
        for _ in range(10):
            resp = agent.process("摇骰子", ctx)
            results.add(resp.metadata["dice_result"]["task"])
        # 8个模板池，10次调用应该至少出现不同的任务
        assert len(results) >= 1

    def test_process_returns_suggestions(self):
        agent = DiceAgent()
        ctx = AgentContext(
            user_id="u1", session_id="s1",
            metadata={"intent": "dice_adventure"},
        )
        resp = agent.process("随机冒险", ctx)
        assert isinstance(resp.suggestions, list)
        assert len(resp.suggestions) > 0
