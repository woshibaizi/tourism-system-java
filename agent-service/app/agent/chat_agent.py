"""
主对话 Agent — 处理路线规划、地点推荐、闲聊。
支持 6 种预设出游搭子 + 用户自定义搭子实时切换。
使用 function calling 闭环：LLM 可主动调用工具获取真实数据。
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from app.agent.base_agent import AgentContext, AgentResponse, BaseAgent
from app.agent.prompts import (
    DIARY_GENERATE_PROMPT,
    REVERSE_RECOMMEND_PROMPT,
    ROUTE_PLAN_PROMPT,
    SYSTEM_PROMPT,
    load_buddy_prompt,
)
from app.core.llm import get_llm, llm_available
from app.tools.registry import registry
from app.tools.tourism_api import tourism_api_client

logger = logging.getLogger(__name__)

_MAX_TOOL_ROUNDS = 3


class ChatAgent(BaseAgent):
    """主对话 Agent，处理日常对话和工具调用。支持出游搭子人格切换。"""

    @property
    def name(self) -> str:
        return "chat"

    @property
    def description(self) -> str:
        return "主对话助手：路线规划、地点推荐、信息查询、闲聊 + 出游搭子"

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
            results = tourism_api_client.search_places(keyword, place_type or None)
            if not results:
                return f"没有找到与'{keyword}'相关的地点"
            names = [f"{r['name']}: {r.get('description', '')[:60]}" for r in results[:5] if r.get("name")]
            return "\n".join(names) if names else f"没有找到与'{keyword}'相关的地点"

        @registry.register(
            name="get_place_detail",
            description="获取指定地点的详细信息（需提供地点名称或ID）",
            parameters={
                "type": "object",
                "properties": {
                    "place_name": {"type": "string", "description": "地点名称"},
                },
                "required": ["place_name"],
            },
        )
        def get_place_detail(place_name: str) -> str:
            places = tourism_api_client.get_places(50)
            for p in places:
                if p.get("name") == place_name:
                    return (
                        f"名称: {p['name']}\n"
                        f"描述: {p.get('description', '暂无')}\n"
                        f"类型: {p.get('type', '未知')}\n"
                        f"评分: {p.get('rating', '暂无')}"
                    )
            return f"未找到地点: {place_name}"

        @registry.register(
            name="get_hot_places",
            description="获取热门景点列表",
            parameters={
                "type": "object",
                "properties": {"size": {"type": "integer", "description": "返回数量，默认10"}},
                "required": [],
            },
        )
        def get_hot_places(size: int = 10) -> str:
            places = tourism_api_client.get_hot_places(size)
            if not places:
                return "暂无热门地点数据"
            names = [f"{p.get('name', '未知')} (评分: {p.get('rating', 'N/A')})" for p in places[:size] if p.get("name")]
            return "\n".join(f"- {n}" for n in names) if names else "暂无热门地点数据"

        @registry.register(
            name="get_hot_foods",
            description="获取热门美食列表",
            parameters={
                "type": "object",
                "properties": {"size": {"type": "integer", "description": "返回数量，默认10"}},
                "required": [],
            },
        )
        def get_hot_foods(size: int = 10) -> str:
            foods = tourism_api_client.get_hot_foods(size)
            if not foods:
                return "暂无热门美食数据"
            names = [f"{f.get('name', '未知')} (¥{f.get('price', 'N/A')})" for f in foods[:size] if f.get("name")]
            return "\n".join(f"- {n}" for n in names) if names else "暂无热门美食数据"

        @registry.register(
            name="get_foods_by_cuisine",
            description="按菜系查询美食",
            parameters={
                "type": "object",
                "properties": {
                    "cuisine": {"type": "string", "description": "菜系: 川菜/粤菜/日料/西餐/小吃等"},
                },
                "required": ["cuisine"],
            },
        )
        def get_foods_by_cuisine(cuisine: str) -> str:
            foods = tourism_api_client.get_foods_by_cuisine(cuisine)
            if not foods:
                return f"没有找到'{cuisine}'相关的美食"
            names = [f"{f.get('name', '未知')}: {f.get('description', '')[:50]}" for f in foods[:8] if f.get("name")]
            return "\n".join(names) if names else f"没有找到'{cuisine}'相关的美食"

    def get_system_prompt(self, context: AgentContext | None = None) -> str:
        """返回该 Agent 的系统提示词，支持出游搭子人格注入。"""
        if context and context.metadata:
            buddy_id = context.metadata.get("buddy_id")
            if buddy_id:
                return load_buddy_prompt(context.user_id, buddy_id)
        return SYSTEM_PROMPT

    def get_tools(self) -> list[dict[str, Any]]:
        return registry.get_definitions()

    def can_handle(self, intent: str) -> bool:
        return intent in ("plan_trip_route", "recommend_place", "general_chat", "search_place", "reverse_recommend")

    def process(self, message: str, context: AgentContext) -> AgentResponse:
        if llm_available():
            return self._process_with_llm(message, context)
        return self._process_with_rules(message, context)

    def _process_with_llm(self, message: str, context: AgentContext) -> AgentResponse:
        client = get_llm()
        assert client is not None

        # 搭子人格注入
        system = self.get_system_prompt(context)
        intent = context.metadata.get("intent", self._detect_intent_from_message(message))

        # 意图特定的引导 prompt
        sys_prompt = {
            "plan_trip_route": ROUTE_PLAN_PROMPT,
            "generate_diary": DIARY_GENERATE_PROMPT,
            "reverse_recommend": REVERSE_RECOMMEND_PROMPT,
        }.get(intent, system)

        msgs: list[dict[str, Any]] = [{"role": "system", "content": sys_prompt}]
        for m in context.session_messages[-6:]:
            msgs.append({"role": m.get("role", "user"), "content": m.get("content", "")})
        msgs.append({"role": "user", "content": message})

        tools = registry.get_definitions()
        tools_used: list[str] = []
        tool_latencies: list[dict[str, Any]] = []

        # 多轮 tool calling 循环 (ReAct 模式，max 3 轮)
        for round_num in range(_MAX_TOOL_ROUNDS):
            result = client.chat(msgs, tools=tools if tools else None)

            if result.tool_calls:
                msgs.append({
                    "role": "assistant",
                    "content": result.content or None,
                    "tool_calls": result.tool_calls,
                })

                for tc in result.tool_calls:
                    func = tc["function"]
                    tool_name = func["name"]
                    try:
                        args = json.loads(func["arguments"])
                    except json.JSONDecodeError:
                        args = {}

                    t0 = time.time()
                    tool_result = registry.dispatch(tool_name, args)
                    elapsed_ms = int((time.time() - t0) * 1000)

                    tools_used.append(tool_name)
                    tool_latencies.append({"tool": tool_name, "latency_ms": elapsed_ms})

                    msgs.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": tool_result,
                    })
            else:
                return AgentResponse(
                    content=result.content or "",
                    intent=intent,
                    suggestions=_extract_highlights(result.content or ""),
                    tools_used=tools_used if tools_used else ["llm"],
                    metadata={"tool_latencies": tool_latencies, "buddy_id": context.metadata.get("buddy_id")} if tool_latencies or context.metadata.get("buddy_id") else {},
                )

        # 超过最大轮次，强制 LLM 生成最终回复
        final_result = client.chat(msgs)
        return AgentResponse(
            content=final_result.content or "",
            intent=intent,
            suggestions=_extract_highlights(final_result.content or ""),
            tools_used=tools_used if tools_used else ["llm"],
            metadata={"tool_latencies": tool_latencies, "max_rounds_reached": True, "buddy_id": context.metadata.get("buddy_id")} if tool_latencies else {},
        )

    def _process_with_rules(self, message: str, context: AgentContext) -> AgentResponse:
        intent = context.metadata.get("intent", self._detect_intent_from_message(message))

        if intent == "reverse_recommend":
            return self._reverse_recommend_rules()

        places = tourism_api_client.get_places()
        names = [p.get("name") for p in places if p.get("name")]
        suggestions = names[:5] if names else ["路线规划", "地点推荐", "日记草稿"]
        content = (
            "我是个性化旅游助手，可以帮你规划路线、推荐地点、生成旅行日记。\n\n"
            f"可以试试这些热门地点：{'、'.join(suggestions)}"
        )
        return AgentResponse(
            content=content,
            intent="general_chat",
            suggestions=suggestions,
            tools_used=["rule_fallback"],
        )

    def _reverse_recommend_rules(self) -> AgentResponse:
        """规则模式下的反向推荐：基于常见踩坑经验给出劝退建议。"""
        import random as _rand
        avoid_templates = [
            ("大中午去户外景点", "中午12-14点阳光最烈，拍照不好看人也累，建议早上或傍晚去"),
            ("只在景区门口吃饭", "景区门口餐厅通常又贵又一般，走远两条街往往有惊喜"),
            ("节假日热门打卡点", "节假日人挤人，排队一小时拍照一分钟，平日体验好太多"),
            ("盲目跟风网红店", "网红店不一定适合你，看看本地人常去的老店更靠谱"),
            ("下雨天去露天景点", "雨天路滑，露天景点体验打折扣，不如换成室内展馆"),
        ]
        avoids = _rand.sample(avoid_templates, min(3, len(avoid_templates)))
        content = "🚫 旅行避雷指南\n\n"
        for what, why in avoids:
            content += f"⚠ **{what}**\n  {why}\n\n"
        content += "记住：旅行的意义不是打卡，是找到属于你自己的节奏。"
        return AgentResponse(
            content=content,
            intent="reverse_recommend",
            suggestions=["推荐适合我的地方", "看看冷门宝藏", "规划一条轻松路线"],
            tools_used=["rule_fallback"],
        )

    async def stream_process(self, message: str, context: AgentContext):
        """
        流式处理 — 异步生成器，逐 token/tool_call/tool_result 产出 SSE 事件。
        工具调用轮次走同步 chat()，最终回复走 chat_stream() 逐 token。
        """
        client = get_llm()
        if not client:
            yield {"event": "done", "data": {"content": "LLM 不可用，请稍后重试", "intent": "general_chat", "suggestions": []}}
            return

        system = self.get_system_prompt(context)
        intent = context.metadata.get("intent", self._detect_intent_from_message(message))
        sys_prompt = {
            "plan_trip_route": ROUTE_PLAN_PROMPT,
            "generate_diary": DIARY_GENERATE_PROMPT,
            "reverse_recommend": REVERSE_RECOMMEND_PROMPT,
        }.get(intent, system)

        msgs: list[dict[str, Any]] = [{"role": "system", "content": sys_prompt}]
        for m in context.session_messages[-6:]:
            msgs.append({"role": m.get("role", "user"), "content": m.get("content", "")})
        msgs.append({"role": "user", "content": message})

        tools = registry.get_definitions()
        tools_used: list[str] = []

        for round_num in range(_MAX_TOOL_ROUNDS):
            import asyncio as _asyncio
            result = await _asyncio.to_thread(client.chat, msgs, tools=tools if tools else None)

            if result.tool_calls:
                msgs.append({
                    "role": "assistant",
                    "content": result.content or None,
                    "tool_calls": result.tool_calls,
                })

                for tc in result.tool_calls:
                    func = tc["function"]
                    tool_name = func["name"]
                    try:
                        args = json.loads(func["arguments"])
                    except json.JSONDecodeError:
                        args = {}

                    yield {
                        "event": "tool_call",
                        "data": {"name": tool_name, "args": args},
                    }

                    tool_result = await _asyncio.to_thread(registry.dispatch, tool_name, args)
                    tools_used.append(tool_name)

                    yield {
                        "event": "tool_result",
                        "data": {"name": tool_name, "result": tool_result},
                    }

                    msgs.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": tool_result,
                    })
            else:
                # 最终回复走流式输出
                tokens = await _asyncio.to_thread(_collect_stream, client, msgs)
                for token in tokens:
                    yield {"event": "token", "data": {"content": token}}

                full_content = "".join(tokens)
                yield {
                    "event": "done",
                    "data": {
                        "content": full_content,
                        "intent": intent,
                        "trace_id": context.session_id or "",
                        "suggestions": _extract_highlights(full_content),
                        "tools_used": tools_used if tools_used else ["llm"],
                    },
                }
                return

        # 超最大轮次，用非流式最终回复
        final = await _asyncio.to_thread(client.chat, msgs)
        full_content = final.content or ""
        yield {
            "event": "done",
            "data": {
                "content": full_content,
                "intent": intent,
                "trace_id": context.session_id or "",
                "suggestions": _extract_highlights(full_content),
                "tools_used": tools_used if tools_used else ["llm"],
                "max_rounds_reached": True,
            },
        }

    def _detect_intent_from_message(self, message: str) -> str:
        if any(kw in message for kw in ["路线", "行程", "导航", "怎么走", "规划"]):
            return "plan_trip_route"
        if any(kw in message for kw in ["日记", "游记", "文案"]):
            return "generate_diary"
        if any(kw in message for kw in ["别去", "劝退", "避雷", "踩坑"]):
            return "reverse_recommend"
        if any(kw in message for kw in ["推荐", "好吃的", "好玩的", "附近"]):
            return "recommend_place"
        return "general_chat"


def _extract_highlights(text: str) -> list[str]:
    suggestions: list[str] = []
    for line in text.split("\n"):
        line = line.strip()
        if line and len(line) < 30:
            cleaned = line.lstrip("0123456789. -•#").strip()
            if 2 < len(cleaned) < 20:
                suggestions.append(cleaned)
    return suggestions[:5] if suggestions else ["试试其他问题"]


def _collect_stream(client, msgs) -> list[str]:
    """在后台线程中收集所有流式 token，避免阻塞事件循环。"""
    return list(client.chat_stream(msgs))


def _safe_json(text: str) -> bool:
    """检查字符串是否可安全解析为 JSON 对象。"""
    import json as _json
    try:
        _json.loads(text)
        return True
    except (_json.JSONDecodeError, TypeError, ValueError):
        return False
