"""SceneAgent 测试 — "此刻出发"场景推荐。"""

from __future__ import annotations

import pytest

from app.agent.scene_agent import SceneAgent, SCENE_RULES
from app.agent.base_agent import AgentContext


class TestSceneAgentBasics:
    def test_name(self):
        agent = SceneAgent()
        assert agent.name == "scene"

    def test_can_handle(self):
        agent = SceneAgent()
        assert agent.can_handle("scene_recommend")
        assert not agent.can_handle("general_chat")
        assert not agent.can_handle("plan_trip_route")

    def test_get_system_prompt(self):
        agent = SceneAgent()
        prompt = agent.get_system_prompt()
        assert "此刻出发" in prompt

    def test_get_tools(self):
        agent = SceneAgent()
        tools = agent.get_tools()
        assert isinstance(tools, list)
        assert len(tools) > 0


class TestSceneRules:
    def test_rules_registered(self):
        assert len(SCENE_RULES) == 5

    def test_lunch_rule_matches(self):
        condition, title, _detail = SCENE_RULES[0]
        assert condition({"hour": 12, "weather": "晴"})
        assert "午饭" in title

    def test_lunch_rule_no_match_evening(self):
        condition, _title, _detail = SCENE_RULES[0]
        assert not condition({"hour": 19, "weather": "晴"})

    def test_sunset_rule_matches(self):
        condition, title, _detail = SCENE_RULES[1]
        assert condition({"hour": 17, "weather": "晴"})
        assert "日落" in title

    def test_sunset_rule_no_match_rainy(self):
        condition, _title, _detail = SCENE_RULES[1]
        assert not condition({"hour": 17, "weather": "雨"})

    def test_rainy_rule_matches(self):
        condition, title, _detail = SCENE_RULES[2]
        assert condition({"hour": 12, "weather": "大雨"})
        assert "雨" in title

    def test_morning_rule_matches(self):
        condition, title, _detail = SCENE_RULES[3]
        assert condition({"hour": 8, "weather": "晴"})
        assert "清晨" in title

    def test_evening_rule_matches(self):
        condition, title, _detail = SCENE_RULES[4]
        assert condition({"hour": 20, "weather": "晴"})
        assert "夜游" in title


class TestSceneAgentProcess:
    def test_process_returns_recommendation(self):
        agent = SceneAgent()
        ctx = AgentContext(
            user_id="u1", session_id="s1",
            metadata={
                "intent": "scene_recommend",
                "lat": 30.259, "lng": 120.149, "weather": "晴",
            },
        )
        resp = agent.process("现在去哪", ctx)
        assert resp.intent == "scene_recommend"
        assert resp.content
        assert len(resp.suggestions) > 0

    def test_process_with_weather(self):
        agent = SceneAgent()
        ctx = AgentContext(
            user_id="u1", session_id="s1",
            metadata={
                "intent": "scene_recommend",
                "lat": 30.259, "lng": 120.149, "weather": "雨",
            },
        )
        resp = agent.process("下雨了去哪", ctx)
        assert resp.intent == "scene_recommend"
        assert resp.content
