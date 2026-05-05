"""
主对话 Agent — 处理路线规划、地点推荐、闲聊。

使用工具集模式：通过工具注册表加载路线/景点/推荐工具。
"""

from __future__ import annotations

import logging
from typing import Any

from app.agent.base_agent import AgentContext, AgentResponse, BaseAgent
from app.agent.prompts import DIARY_GENERATE_PROMPT, ROUTE_PLAN_PROMPT, SYSTEM_PROMPT
from app.tools.registry import registry
from app.tools.tourism_api import tourism_api_client

logger = logging.getLogger(__name__)


class ChatAgent(BaseAgent):
    """主对话 Agent，处理日常对话和工具调用。"""

    @property
    def name(self) -> str:
        return "chat"

    @property
    def description(self) -> str:
        return "主对话助手：路线规划、地点推荐、信息查询、闲聊"

    def __init__(self) -> None:
        self._register_tools()

    def _register_tools(self) -> None:
        @registry.register(
            name="search_places",
            description="搜索景点/地点，支持关键词和类型筛选",
            parameters={
                "type": "object",
                "properties": {
                    "keyword": {"type": "string", "description": "搜索关键词"},
                    "place_type": {"type": "string", "description": "地点类型: spot/food/facility"},
                },
                "required": ["keyword"],
            },
        )
        def search_places(keyword: str, place_type: str = "spot") -> str:
            places = tourism_api_client.get_places()
            results = [
                p for p in places
                if keyword.lower() in (p.get("name", "") + p.get("description", "")).lower()
            ]
            if not results:
                return f"没有找到与'{keyword}'相关的地点"
            names = [f"{r['name']}: {r.get('description', '')[:60]}" for r in results[:5] if r.get("name")]
            return "\n".join(names)

        @registry.register(
            name="get_place_detail",
            description="获取指定地点的详细信息",
            parameters={
                "type": "object",
                "properties": {
                    "place_name": {"type": "string", "description": "地点名称"},
                },
                "required": ["place_name"],
            },
        )
        def get_place_detail(place_name: str) -> str:
            places = tourism_api_client.get_places()
            for p in places:
                if p.get("name") == place_name:
                    return (
                        f"名称: {p['name']}\n"
                        f"描述: {p.get('description', '暂无')}\n"
                        f"类型: {p.get('type', '未知')}"
                    )
            return f"未找到地点: {place_name}"

        @registry.register(
            name="get_hot_places",
            description="获取热门景点列表",
            parameters={
                "type": "object",
                "properties": {},
                "required": [],
            },
        )
        def get_hot_places() -> str:
            places = tourism_api_client.get_places()
            names = [p.get("name", "未知") for p in places[:10] if p.get("name")]
            return "\n".join(f"- {n}" for n in names) if names else "暂无热门地点数据"

    def get_system_prompt(self) -> str:
        return SYSTEM_PROMPT

    def get_tools(self) -> list[dict[str, Any]]:
        return registry.get_definitions()

    def can_handle(self, intent: str) -> bool:
        return intent in ("plan_trip_route", "recommend_place", "general_chat")

    def process(self, message: str, context: AgentContext) -> AgentResponse:
        if _llm_available():
            return self._process_with_llm(message, context)
        return self._process_with_rules(message, context)

    def _process_with_llm(self, message: str, context: AgentContext) -> AgentResponse:
        client = _get_llm()
        assert client is not None

        system = self.get_system_prompt()
        prompt_map = {
            "plan_trip_route": ROUTE_PLAN_PROMPT,
            "generate_diary": DIARY_GENERATE_PROMPT,
        }

        # 根据最近意图选择提示词
        recent_intent = self._detect_intent_from_message(message)
        sys_prompt = prompt_map.get(recent_intent, system)

        msgs: list[dict[str, str]] = [{"role": "system", "content": sys_prompt}]
        for m in context.session_messages[-6:]:
            msgs.append({"role": m.get("role", "user"), "content": m.get("content", "")})
        msgs.append({"role": "user", "content": message})

        content = client.chat(msgs)
        suggestions = _extract_highlights(content)
        return AgentResponse(
            content=content,
            intent=recent_intent,
            suggestions=suggestions,
            tools_used=["llm"],
        )

    def _process_with_rules(self, message: str, context: AgentContext) -> AgentResponse:
        places = tourism_api_client.get_places()
        names = [p.get("name") for p in places if p.get("name")]
        suggestions = names[:5] if names else ["路线规划", "地点推荐", "日记草稿"]
        content = (
            f"我是个性化旅游助手，可以帮你规划路线、推荐地点、生成旅行日记。\n\n"
            f"可以试试这些热门地点：{'、'.join(suggestions)}"
        )
        return AgentResponse(
            content=content,
            intent="general_chat",
            suggestions=suggestions,
            tools_used=["rule_fallback"],
        )

    def _detect_intent_from_message(self, message: str) -> str:
        if any(kw in message for kw in ["路线", "行程", "导航", "怎么走", "规划"]):
            return "plan_trip_route"
        if any(kw in message for kw in ["日记", "游记", "文案"]):
            return "generate_diary"
        return "general_chat"


# 延迟加载 LLM 客户端
_llm_client: Any = None


def _get_llm():
    global _llm_client
    if _llm_client is None:
        try:
            from app.agent.llm_client import llm_client as client
            _llm_client = client
        except ImportError:
            _llm_client = False
    return _llm_client if _llm_client is not False else None


def _llm_available() -> bool:
    from app.config import settings
    client = _get_llm()
    return client is not None and bool(settings.llm_api_key)


def _extract_highlights(text: str) -> list[str]:
    suggestions: list[str] = []
    for line in text.split("\n"):
        line = line.strip()
        if line and len(line) < 30:
            cleaned = line.lstrip("0123456789. -•#").strip()
            if 2 < len(cleaned) < 20:
                suggestions.append(cleaned)
    return suggestions[:5] if suggestions else ["试试其他问题"]
