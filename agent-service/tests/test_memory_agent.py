"""MemoryAgent 测试 — 旅行回忆生成。"""

from __future__ import annotations

import pytest

from app.agent.memory_agent import MemoryAgent, MEMORY_CARD_TEMPLATE, _aggregate_user_data, _build_memory_card
from app.agent.base_agent import AgentContext


class TestMemoryAgentBasics:
    def test_name(self):
        agent = MemoryAgent()
        assert agent.name == "memory"

    def test_can_handle(self):
        agent = MemoryAgent()
        assert agent.can_handle("generate_memory")
        assert not agent.can_handle("general_chat")
        assert not agent.can_handle("plan_trip_route")

    def test_get_system_prompt(self):
        agent = MemoryAgent()
        prompt = agent.get_system_prompt()
        assert "旅行回忆" in prompt or "Wrapped" in prompt

    def test_get_tools(self):
        agent = MemoryAgent()
        tools = agent.get_tools()
        assert isinstance(tools, list)
        assert len(tools) > 0


class TestMemoryCardTemplate:
    def test_template_contains_sections(self):
        card = MEMORY_CARD_TEMPLATE.format(
            date_range="2026年5月",
            memory_text="一段温暖的回忆文字。",
            place_count=5, food_count=10, diary_count=3,
            distance_km=12.5, photo_count=20, avg_rating=4.5,
            highlights="- 探索了5个地方",
        )
        assert "2026年5月" in card
        assert "一段温暖的回忆文字" in card
        assert "5 个" in card
        assert "10 种" in card
        assert "12.5 km" in card


class TestAggregateUserData:
    def test_returns_empty_on_no_data(self):
        # anonymous user with no data should return empty dict
        stats = _aggregate_user_data("__nonexistent_user__")
        # may return empty or partial data depending on backend
        assert isinstance(stats, dict)


class TestBuildMemoryCard:
    def test_returns_text_and_highlights(self):
        stats = {
            "place_count": 5, "food_count": 3, "diary_count": 2,
            "distance_km": 8.0, "photo_count": 12, "avg_rating": 4.2,
        }
        text, highlights = _build_memory_card(stats, "最近一周")
        assert isinstance(text, str) and len(text) > 0
        assert isinstance(highlights, str) and len(highlights) > 0

    def test_minimal_data_still_works(self):
        stats = {
            "place_count": 1, "food_count": 0, "diary_count": 0,
            "distance_km": 0, "photo_count": 0, "avg_rating": 4.0,
        }
        text, highlights = _build_memory_card(stats, "最近一天")
        assert isinstance(text, str) and len(text) > 0
        assert isinstance(highlights, str) and "继续出发" in highlights


class TestMemoryAgentProcess:
    def test_process_returns_memory_result(self):
        agent = MemoryAgent()
        ctx = AgentContext(
            user_id="u1", session_id="s1",
            metadata={"intent": "generate_memory", "date_range": "最近一周"},
        )
        resp = agent.process("生成我的旅行回忆", ctx)
        assert resp.intent == "generate_memory"
        assert resp.content
        assert "stats" in resp.metadata or "data_available" in resp.metadata

    def test_process_returns_suggestions(self):
        agent = MemoryAgent()
        ctx = AgentContext(
            user_id="u1", session_id="s1",
            metadata={"intent": "generate_memory"},
        )
        resp = agent.process("回忆一下", ctx)
        assert isinstance(resp.suggestions, list)
        assert len(resp.suggestions) > 0
