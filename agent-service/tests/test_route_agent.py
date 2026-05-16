"""
RouteAgent 测试 — 路线规划 + 工具注册 + 规则降级。

不需要 LLM API key，测试工具注册和降级路径。
"""

from __future__ import annotations

import pytest

from app.agent.route_agent import RouteAgent, _parse_itinerary, _resolve_place_id
from app.agent.base_agent import AgentContext
from app.tools.registry import registry


class TestRouteAgentBasics:
    """测试 RouteAgent 基本属性。"""

    def test_name(self):
        agent = RouteAgent()
        assert agent.name == "route"

    def test_can_handle_route_intent(self):
        agent = RouteAgent()
        assert agent.can_handle("plan_trip_route")

    def test_cannot_handle_other_intents(self):
        agent = RouteAgent()
        assert not agent.can_handle("general_chat")
        assert not agent.can_handle("generate_diary")
        assert not agent.can_handle("recommend_place")

    def test_get_system_prompt(self):
        agent = RouteAgent()
        prompt = agent.get_system_prompt()
        assert "路线规划" in prompt

    def test_get_tools_returns_list(self):
        agent = RouteAgent()
        tools = agent.get_tools()
        assert isinstance(tools, list)
        # RouteAgent 的工具在全局 registry 中，包括 ChatAgent 的工具
        tool_names = [t["function"]["name"] for t in tools]
        assert "recommend_places" in tool_names
        assert "plan_shortest_path" in tool_names
        assert "plan_multi_dest" in tool_names
        assert "get_foods_by_place" in tool_names
        assert "get_nearest_facilities" in tool_names


class TestRouteAgentRuleFallback:
    """测试 RouteAgent 降级路径。"""

    def test_process_without_llm(self):
        agent = RouteAgent()
        ctx = AgentContext(
            user_id="u1", session_id="s1",
            metadata={
                "intent": "plan_trip_route",
                "intent_slots": {"destination": "杭州", "days": 1, "interests": ["拍照"]},
            },
        )
        resp = agent.process("周末在杭州玩一天，喜欢拍照", ctx)
        assert resp.intent == "plan_trip_route"
        assert resp.content
        assert len(resp.tools_used) > 0

    def test_process_with_slots(self):
        agent = RouteAgent()
        ctx = AgentContext(
            user_id="u1", session_id="s1",
            metadata={
                "intent": "plan_trip_route",
                "intent_slots": {"destination": "校园", "days": 0.5, "interests": ["美食"]},
            },
        )
        resp = agent.process("半天逛校园吃美食", ctx)
        assert resp.intent == "plan_trip_route"
        metadata = resp.metadata
        assert "itinerary" in metadata or "fallback" in metadata or "tool_latencies" in metadata


class TestParseItinerary:
    """测试行程 JSON 解析。"""

    def test_parse_valid_json(self):
        text = '{"title": "杭州一日游", "timeline": [], "total_distance": "5km"}'
        result = _parse_itinerary(text)
        assert result["title"] == "杭州一日游"
        assert result["total_distance"] == "5km"

    def test_parse_json_with_text_around(self):
        text = '好的，这是你的行程：\n{"title": "一日游", "timeline": [{"time": "09:00", "activity": "出发"}]}\n祝旅途愉快！'
        result = _parse_itinerary(text)
        assert result["title"] == "一日游"
        assert len(result["timeline"]) == 1

    def test_parse_no_json(self):
        text = "抱歉，无法规划路线"
        result = _parse_itinerary(text)
        assert result.get("raw") == text

    def test_parse_invalid_json(self):
        text = "{broken json"
        result = _parse_itinerary(text)
        assert "raw" in result


class TestToolsRegistered:
    """检查 RouteAgent 注册了正确的工具。"""

    def test_route_tools_have_proper_schemas(self):
        agent = RouteAgent()
        tools = {t["function"]["name"]: t for t in agent.get_tools()}
        # recommend_places 需要 interests
        rec = tools.get("recommend_places")
        assert rec is not None
        assert "interests" in rec["function"]["parameters"].get("required", [])
        # plan_shortest_path 需要 from_place 和 to_place
        psp = tools.get("plan_shortest_path")
        assert psp is not None
        required = psp["function"]["parameters"].get("required", [])
        assert "from_place" in required
        assert "to_place" in required
        # plan_multi_dest 需要 place_names
        pmd = tools.get("plan_multi_dest")
        assert pmd is not None
        assert "place_names" in pmd["function"]["parameters"].get("required", [])


class TestToolDispatch:
    """测试 RouteAgent 工具调用。"""

    def test_recommend_places_dispatch(self):
        result = registry.dispatch("recommend_places", {"interests": ["拍照", "美食"]})
        import json
        parsed = json.loads(result)
        # 即使后端不可用也应该返回 ok 或错误结构
        assert "ok" in parsed

    def test_plan_multi_dest_dispatch(self):
        result = registry.dispatch("plan_multi_dest", {"place_names": ["西湖", "雷峰塔"]})
        import json
        parsed = json.loads(result)
        assert "ok" in parsed
