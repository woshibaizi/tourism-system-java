"""PersonaAgent 测试 — 旅行人格分析。"""

from __future__ import annotations

import pytest

from app.agent.persona_agent import PersonaAgent, PERSONA_TYPES
from app.agent.base_agent import AgentContext


class TestPersonaAgentBasics:
    def test_name(self):
        agent = PersonaAgent()
        assert agent.name == "persona"

    def test_can_handle(self):
        agent = PersonaAgent()
        assert agent.can_handle("analyze_personality")
        assert not agent.can_handle("general_chat")

    def test_get_system_prompt(self):
        agent = PersonaAgent()
        prompt = agent.get_system_prompt()
        assert "旅行人格" in prompt

    def test_get_tools(self):
        agent = PersonaAgent()
        tools = agent.get_tools()
        assert isinstance(tools, list)
        assert len(tools) > 0


class TestPersonaTypes:
    def test_all_five_types(self):
        assert len(PERSONA_TYPES) == 5
        expected = {"food_hunter", "photo_wanderer", "culture_explorer", "efficient_pacer", "leisure_dreamer"}
        assert set(PERSONA_TYPES.keys()) == expected

    def test_each_type_has_required_fields(self):
        for key, val in PERSONA_TYPES.items():
            assert "name" in val, f"{key} missing name"
            assert "icon" in val, f"{key} missing icon"
            assert "description_template" in val, f"{key} missing description_template"
            assert "recommendation" in val, f"{key} missing recommendation"


class TestPersonaClassification:
    def test_food_hunter_classification(self):
        features = {"total_places": 5, "total_foods": 20, "keywords": [], "active_hours": []}
        persona = PersonaAgent._classify_persona(features)
        assert persona["name"] == "美食猎人"

    def test_photo_wanderer_classification(self):
        features = {"total_places": 10, "total_foods": 5, "keywords": ["拍照", "风景", "好看"], "active_hours": []}
        persona = PersonaAgent._classify_persona(features)
        assert persona["name"] == "摄影漫游者"

    def test_culture_explorer_classification(self):
        features = {"total_places": 8, "total_foods": 8, "keywords": ["博物馆", "历史", "文化"], "active_hours": []}
        persona = PersonaAgent._classify_persona(features)
        assert persona["name"] == "文化探索者"

    def test_efficient_pacer_classification(self):
        features = {"total_places": 15, "total_foods": 10, "keywords": [], "active_hours": [8, 12, 16, 20]}
        persona = PersonaAgent._classify_persona(features)
        assert persona["name"] == "高效打卡族"

    def test_leisure_dreamer_classification(self):
        features = {"total_places": 3, "total_foods": 1, "keywords": [], "active_hours": []}
        persona = PersonaAgent._classify_persona(features)
        assert persona["name"] == "悠闲度假派"

    def test_default_fallback(self):
        features = {"total_places": 7, "total_foods": 7, "keywords": ["无特征"], "active_hours": []}
        persona = PersonaAgent._classify_persona(features)
        assert persona["name"] in [p["name"] for p in PERSONA_TYPES.values()]


class TestPersonaAgentProcess:
    def test_process_returns_persona_result(self):
        agent = PersonaAgent()
        ctx = AgentContext(
            user_id="u1", session_id="s1",
            metadata={"intent": "analyze_personality"},
        )
        resp = agent.process("分析我的旅行人格", ctx)
        assert resp.intent == "analyze_personality"
        assert resp.content
        assert "persona" in resp.metadata
        assert resp.metadata["persona"] in [p["name"] for p in PERSONA_TYPES.values()]

    def test_process_returns_suggestions(self):
        agent = PersonaAgent()
        ctx = AgentContext(
            user_id="u1", session_id="s1",
            metadata={"intent": "analyze_personality"},
        )
        resp = agent.process("我的旅行画像", ctx)
        assert isinstance(resp.suggestions, list)
        assert len(resp.suggestions) > 0
