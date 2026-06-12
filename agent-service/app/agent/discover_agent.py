"""
旅游信息发现 Agent — 搜索、推荐、周边查询、小红书热点。

从 ChatAgent 拆出，专注单一职责：帮助用户发现旅游相关信息。
使用 Agent 作用域隔离的工具集，不接触路线规划或日记生成。
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from app.agent.base_agent import AgentContext, AgentResponse, BaseAgent
from app.agent.prompts import DISCOVER_PROMPT
from app.core.llm import get_llm, llm_available
from app.tools.registry import registry
from app.tools.tourism_api import tourism_api_client

logger = logging.getLogger(__name__)

_MAX_TOOL_ROUNDS = 3


class DiscoverAgent(BaseAgent):
    """旅游信息发现专家 — 搜索、推荐、周边查询。"""

    @property
    def name(self) -> str:
        return "discover"

    @property
    def description(self) -> str:
        return "旅游信息发现专家：地点搜索、美食推荐、周边查询、小红书热点"

    def __init__(self) -> None:
        self._register_tools()

    def _register_tools(self) -> None:
        # ── 地点工具 ──────────────────────────────

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
            agent_name="discover",
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
            agent_name="discover",
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
            agent_name="discover",
        )
        def get_hot_places(size: int = 10) -> str:
            places = tourism_api_client.get_hot_places(size)
            if not places:
                return "暂无热门地点数据"
            names = [f"{p.get('name', '未知')} (评分: {p.get('rating', 'N/A')})" for p in places[:size] if p.get("name")]
            return "\n".join(f"- {n}" for n in names) if names else "暂无热门地点数据"

        # ── 美食工具 ──────────────────────────────

        @registry.register(
            name="get_hot_foods",
            description="获取热门美食列表",
            parameters={
                "type": "object",
                "properties": {"size": {"type": "integer", "description": "返回数量，默认10"}},
                "required": [],
            },
            agent_name="discover",
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
            agent_name="discover",
        )
        def get_foods_by_cuisine(cuisine: str) -> str:
            foods = tourism_api_client.get_foods_by_cuisine(cuisine)
            if not foods:
                return f"没有找到'{cuisine}'相关的美食"
            names = [f"{f.get('name', '未知')}: {f.get('description', '')[:50]}" for f in foods[:8] if f.get("name")]
            return "\n".join(names) if names else f"没有找到'{cuisine}'相关的美食"

        # ── 周边工具 ──────────────────────────────

        @registry.register(
            name="search_surroundings",
            description=(
                "搜索校园或景区周边的商户和服务设施。"
                "当用户询问'XX附近有什么好吃的/好玩的/住宿/购物'时使用。"
                "返回周边商户名称、类型、距离、评分、描述等信息。"
            ),
            parameters={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "搜索关键词，如'火锅''奶茶''酒店''KTV'等。不传则返回全部周边商户"},
                    "place_name": {"type": "string", "description": "校园或景区名称，用于限定搜索范围"},
                },
                "required": [],
            },
            agent_name="discover",
        )
        def search_surroundings(query: str = "", place_name: str = "") -> str:
            place_id = None
            if place_name:
                places = tourism_api_client.get_places(100)
                for p in places:
                    if p.get("name") == place_name or place_name in (p.get("name") or ""):
                        place_id = p.get("id")
                        break
            results = tourism_api_client.search_surroundings(query, place_id)
            if not results:
                scope = f"{place_name}附近" if place_name else "周边"
                return f"没有在{scope}找到与'{query}'相关的商户"
            items = []
            for r in results[:8]:
                name = r.get("name", "未知")
                rtype = r.get("type", "")
                dist = r.get("distanceMeters")
                dist_str = f"{dist}m" if dist and dist < 1000 else f"{dist / 1000:.1f}km" if dist else ""
                rating = r.get("rating", 0)
                price = r.get("priceRange", "")
                desc = (r.get("description", "") or "")[:60]
                line = f"- {name}"
                extras = []
                if rtype: extras.append(_surrounding_type_label(rtype))
                if dist_str: extras.append(dist_str)
                if rating: extras.append(f"★{rating}")
                if price: extras.append(price)
                if extras: line += f" ({', '.join(extras)})"
                if desc: line += f" — {desc}"
                items.append(line)
            return "\n".join(items) if items else "暂无结果"

        @registry.register(
            name="get_surroundings_by_place",
            description=(
                "获取指定校园/景区周边的商户和服务设施列表。"
                "当用户询问'XX周边都有什么'时使用。"
                "可按类型筛选：restaurant(美食)/shopping(购物)/entertainment(娱乐)/hotel(住宿)/transport(交通)/service(服务)。"
            ),
            parameters={
                "type": "object",
                "properties": {
                    "place_name": {"type": "string", "description": "校园或景区名称"},
                    "surrounding_type": {"type": "string", "description": "商户类型，不传则返回全部"},
                },
                "required": ["place_name"],
            },
            agent_name="discover",
        )
        def get_surroundings_by_place(place_name: str, surrounding_type: str = "") -> str:
            places = tourism_api_client.get_places(100)
            place_id = None
            for p in places:
                if p.get("name") == place_name or place_name in (p.get("name") or ""):
                    place_id = p.get("id")
                    break
            if not place_id:
                return f"未找到地点: {place_name}"

            if surrounding_type:
                results = tourism_api_client.get_surroundings_by_place(place_id, surrounding_type)
            else:
                results = tourism_api_client.get_surroundings_by_place(place_id)

            if not results:
                type_label = _surrounding_type_label(surrounding_type) if surrounding_type else "周边"
                return f"{place_name}{type_label}暂无数据"

            by_type = {}
            for r in results:
                t = r.get("type", "other")
                by_type.setdefault(t, []).append(r)

            lines = [f"{place_name}周边商户 ({len(results)}家):", ""]
            for t, items in sorted(by_type.items()):
                label = _surrounding_type_label(t)
                lines.append(f"【{label}】({len(items)}家)")
                for r in items[:5]:
                    name = r.get("name", "未知")
                    dist = r.get("distanceMeters")
                    dist_str = f"{dist}m" if dist and dist < 1000 else f"{dist / 1000:.1f}km" if dist else ""
                    price = r.get("priceRange", "")
                    extras = f" ({dist_str})" if dist_str else ""
                    extras += f" {price}" if price else ""
                    lines.append(f"  - {name}{extras}")
                if len(items) > 5:
                    lines.append(f"  ... 还有{len(items) - 5}家")
                lines.append("")
            return "\n".join(lines)

        @registry.register(
            name="get_surrounding_hot",
            description="获取热门周边商户推荐",
            parameters={
                "type": "object",
                "properties": {"size": {"type": "integer", "description": "返回数量，默认10"}},
                "required": [],
            },
            agent_name="discover",
        )
        def get_surrounding_hot(size: int = 10) -> str:
            results = tourism_api_client.get_hot_surroundings(size)
            if not results:
                return "暂无热门周边数据"
            items = [f"- {r.get('name', '未知')} ({_surrounding_type_label(r.get('type', ''))})" for r in results[:size] if r.get("name")]
            return "\n".join(items) if items else "暂无热门周边数据"

    # ==================== Agent 接口 ====================

    def get_system_prompt(self, context: AgentContext | None = None) -> str:
        return DISCOVER_PROMPT

    def get_tools(self) -> list[dict[str, Any]]:
        return registry.get_definitions_for_agent(self.name)

    def can_handle(self, intent: str) -> bool:
        return intent in ("recommend_place", "search_place", "reverse_recommend")

    def process(self, message: str, context: AgentContext) -> AgentResponse:
        if llm_available():
            return self._process_with_llm(message, context)
        return self._process_with_rules(message, context)

    def _process_with_llm(self, message: str, context: AgentContext) -> AgentResponse:
        client = get_llm()
        assert client is not None

        system = self.get_system_prompt(context)
        intent = context.metadata.get("intent", "recommend_place")

        # 反向推荐使用专用 prompt
        if intent == "reverse_recommend":
            from app.agent.prompts import REVERSE_RECOMMEND_PROMPT
            system = REVERSE_RECOMMEND_PROMPT

        # 提前初始化，供 XHS 预取和后续 tool_call 共用
        xhs_results_raw: list[str] = []

        # === XHS 信号检测：命中时预取小红书数据注入 system prompt + 前端卡片 ===
        xhs_query = _xhs_signal_query(message)
        if xhs_query:
            try:
                from app.tools.xhs_tool import xiaohongshu_search_notes_fn
                xhs_raw = xiaohongshu_search_notes_fn(query=xhs_query, num=10)
                xhs_results_raw.append(xhs_raw)  # 供前端 XHS 卡片渲染
                xhs_summary = _format_xhs_for_prompt(xhs_raw)
                if xhs_summary:
                    system += f"\n\n{xhs_summary}"
                logger.info("XHS 预取成功 (query=%s, notes_in_prompt=%s)",
                           xhs_query, bool(xhs_summary))
            except Exception:
                logger.exception("XHS 预取失败，继续正常流程")

        msgs: list[dict[str, Any]] = [{"role": "system", "content": system}]
        for m in context.session_messages[-6:]:
            msgs.append({"role": m.get("role", "user"), "content": m.get("content", "")})
        msgs.append({"role": "user", "content": message})

        tools_used: list[str] = []
        tool_latencies: list[dict[str, Any]] = []

        # ═══════════════════════════════════════════════════════════════════
        # Round 0: CODE 预取 — 检测"附近/周边"信号，直接调用周边工具
        # ═══════════════════════════════════════════════════════════════════
        surround_hint = _detect_surrounding_query(message)
        if surround_hint:
            place_name = surround_hint["place_name"]
            query = surround_hint["query"]
            logger.info("DiscoverAgent 检测到周边查询信号(sync): place=%s query=%s", place_name, query)

            t0 = time.time()
            surround_result = registry.dispatch("search_surroundings", {
                "place_name": place_name, "query": query,
            })
            elapsed = int((time.time() - t0) * 1000)
            tools_used.append("search_surroundings")
            tool_latencies.append({"tool": "search_surroundings", "latency_ms": elapsed})
            # 插入匹配的 assistant 消息（API 要求 tool 消息前必须有对应的 assistant tool_calls）
            msgs.append({
                "role": "assistant",
                "content": None,
                "tool_calls": [{
                    "id": "code_surround0",
                    "type": "function",
                    "function": {
                        "name": "search_surroundings",
                        "arguments": json.dumps({"place_name": place_name, "query": query}, ensure_ascii=False),
                    },
                }],
            })
            msgs.append({"role": "tool", "tool_call_id": "code_surround0", "content": surround_result})

        # ─── 原有 LLM 工具选择逻辑 ───
        tools = self.get_tools()
        # P2: Intent-Capability 映射 — conversational 意图不携带 tools，防止 LLM 幻觉工具调用
        from app.core.intent import intent_requires_tools
        if not intent_requires_tools(intent):
            logger.info("Intent '%s' 为 conversational 类型，不携带 tools", intent)
            tools = []

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

                    if tool_name == "xiaohongshu_search_notes":
                        xhs_results_raw.append(tool_result)

                    msgs.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": tool_result,
                    })
            else:
                extra_meta: dict[str, Any] = {}
                if tool_latencies:
                    extra_meta["tool_latencies"] = tool_latencies
                if xhs_results_raw:
                    extra_meta["xhsNotes"] = _extract_xhs_notes_from_tool_results(xhs_results_raw)

                return AgentResponse(
                    content=result.content or "",
                    intent=intent,
                    suggestions=_extract_highlights(result.content or ""),
                    tools_used=tools_used if tools_used else ["llm"],
                    metadata=extra_meta,
                )

        # 超最大轮次，强制生成最终回复
        final = client.chat(msgs)
        # 双重保险：inline regex 清理 LLM 残留的 DSML/XML（全角+ASCII双模式）
        final_text = final.content or ""
        if final_text and ('invoke' in final_text or 'DSML' in final_text or '｜' in final_text):
            import re as _re
            FW = '｜'; FS = '／'
            # FW{1,2} handles DeepSeek 1-2 fullwidth bar instability
            final_text = _re.sub(r'<' + FW + r'{1,2}DSML' + FW + r'{1,2}tool_calls>.*?' + r'<' + FS + r'{1,2}DSML' + FW + r'{1,2}tool_calls>', '', final_text, flags=_re.DOTALL)
            final_text = _re.sub(r'<' + FW + r'{1,2}DSML' + FW + r'{1,2}invoke name="[^"]*">.*?' + r'<' + FS + r'{1,2}DSML' + FW + r'{1,2}invoke>', '', final_text, flags=_re.DOTALL)
            final_text = _re.sub(r'<DSML\s+function_calls>.*?</DSML\s+function_calls>', '', final_text, flags=_re.DOTALL)
            final_text = _re.sub(r'<invoke\s+name="[^"]*"\s*>.*?</invoke\s*>', '', final_text, flags=_re.DOTALL).strip()
        extra_meta_final: dict[str, Any] = {"max_rounds_reached": True}
        if tool_latencies:
            extra_meta_final["tool_latencies"] = tool_latencies
        if xhs_results_raw:
            extra_meta_final["xhsNotes"] = _extract_xhs_notes_from_tool_results(xhs_results_raw)

        return AgentResponse(
            content=final_text,
            intent=intent,
            suggestions=_extract_highlights(final_text),
            tools_used=tools_used if tools_used else ["llm"],
            metadata=extra_meta_final,
        )

    def _process_with_rules(self, message: str, context: AgentContext) -> AgentResponse:
        intent = context.metadata.get("intent", "recommend_place")

        if intent == "reverse_recommend":
            return self._reverse_recommend_rules()

        places = tourism_api_client.get_places()
        names = [p.get("name") for p in places if p.get("name")]
        suggestions = names[:5] if names else ["热门景点", "周边美食", "小红书热点"]

        return AgentResponse(
            content=f"我是旅游信息发现助手，可以帮你搜索地点、推荐美食、查询周边。\n\n热门地点：{'、'.join(suggestions)}",
            intent="general_chat",
            suggestions=suggestions,
            tools_used=["rule_fallback"],
        )

    def _reverse_recommend_rules(self) -> AgentResponse:
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

    # ==================== 流式处理 ====================

    async def stream_process(self, message: str, context: AgentContext):
        """流式处理 — SSE 事件生成器。"""
        client = get_llm()
        if not client:
            yield {"event": "done", "data": {"content": "LLM 不可用，请稍后重试", "intent": "general_chat", "suggestions": []}}
            return

        system = self.get_system_prompt(context)
        intent = context.metadata.get("intent", "recommend_place")

        if intent == "reverse_recommend":
            from app.agent.prompts import REVERSE_RECOMMEND_PROMPT
            system = REVERSE_RECOMMEND_PROMPT

        # 提前初始化，供 XHS 预取和后续 tool_call 共用
        xhs_results_raw: list[str] = []

        # === XHS 信号检测：命中时预取小红书数据注入 system prompt + 前端卡片 ===
        xhs_query_stream = _xhs_signal_query(message)
        if xhs_query_stream:
            try:
                import asyncio
                from app.tools.xhs_tool import xiaohongshu_search_notes_fn
                xhs_raw_stream = await asyncio.to_thread(
                    xiaohongshu_search_notes_fn, query=xhs_query_stream, num=10,
                )
                xhs_results_raw.append(xhs_raw_stream)  # 供前端 XHS 卡片渲染
                xhs_summary_stream = _format_xhs_for_prompt(xhs_raw_stream)
                if xhs_summary_stream:
                    system += f"\n\n{xhs_summary_stream}"
                logger.info("XHS 预取成功 (stream, query=%s)", xhs_query_stream)
            except Exception:
                logger.exception("XHS 预取失败 (stream)，继续正常流程")

        msgs: list[dict[str, Any]] = [{"role": "system", "content": system}]
        for m in context.session_messages[-6:]:
            msgs.append({"role": m.get("role", "user"), "content": m.get("content", "")})
        msgs.append({"role": "user", "content": message})

        tools_used: list[str] = []

        # ═══════════════════════════════════════════════════════════════════
        # Round 0: CODE 预取 — 检测"附近/周边"信号，直接调用周边工具
        # （类似 RouteAgent 的 Round 0/1 预取模式）
        # LLM（尤其 DeepSeek）在工具选择时容易选错 search_places，
        # 这里用代码保证周边查询一定走正确的工具。
        # ═══════════════════════════════════════════════════════════════════
        surround_hint = _detect_surrounding_query(message)
        if surround_hint:
            place_name = surround_hint["place_name"]
            query = surround_hint["query"]
            logger.info("DiscoverAgent 检测到周边查询信号: place=%s query=%s", place_name, query)

            t0 = time.time()
            surround_result = registry.dispatch("search_surroundings", {
                "place_name": place_name, "query": query,
            })
            elapsed = int((time.time() - t0) * 1000)
            tools_used.append("search_surroundings")
            logger.info("DiscoverAgent Round 0: search_surroundings 预取完成 (elapsed=%dms)", elapsed)

            yield {"event": "tool_call", "data": {"name": "search_surroundings",
                    "args": {"place_name": place_name, "query": query}}}
            yield {"event": "tool_result", "data": {"name": "search_surroundings", "result": surround_result}}

            # 插入匹配的 assistant 消息（API 要求 tool 消息前必须有对应的 assistant tool_calls）
            msgs.append({
                "role": "assistant",
                "content": None,
                "tool_calls": [{
                    "id": "code_surround0",
                    "type": "function",
                    "function": {
                        "name": "search_surroundings",
                        "arguments": json.dumps({"place_name": place_name, "query": query}, ensure_ascii=False),
                    },
                }],
            })
            msgs.append({"role": "tool", "tool_call_id": "code_surround0", "content": surround_result})

        # ─── 原有 LLM 工具选择逻辑 ───
        tools = self.get_tools()
        # P2: Intent-Capability 映射 — conversational 意图不携带 tools
        from app.core.intent import intent_requires_tools
        if not intent_requires_tools(intent):
            logger.info("Intent '%s' 为 conversational 类型，不携带 tools (stream)", intent)
            tools = []

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

                    yield {"event": "tool_call", "data": {"name": tool_name, "args": args}}

                    tool_result = await _asyncio.to_thread(registry.dispatch, tool_name, args)
                    tools_used.append(tool_name)

                    if tool_name == "xiaohongshu_search_notes":
                        xhs_results_raw.append(tool_result)

                    yield {"event": "tool_result", "data": {"name": tool_name, "result": tool_result}}

                    msgs.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": tool_result,
                    })
            else:
                # 流式输出最终回复
                from app.agent.chat_agent import _collect_stream
                tokens = await _asyncio.to_thread(_collect_stream, client, msgs)
                for token in tokens:
                    yield {"event": "token", "data": {"content": token}}

                full_content = "".join(tokens)
                done_meta: dict[str, Any] = {}
                if xhs_results_raw:
                    done_meta["xhsNotes"] = _extract_xhs_notes_from_tool_results(xhs_results_raw)

                yield {
                    "event": "done",
                    "data": {
                        "content": full_content,
                        "intent": intent,
                        "trace_id": context.session_id or "",
                        "suggestions": _extract_highlights(full_content),
                        "tools_used": tools_used if tools_used else ["llm"],
                        **done_meta,
                    },
                }
                return

        # 超最大轮次
        final = await _asyncio.to_thread(client.chat, msgs)
        # 双重保险：inline regex 清理 LLM 残留的 DSML/XML（全角+ASCII双模式）
        full_content = final.content or ""
        if full_content and ('invoke' in full_content or 'DSML' in full_content or '｜' in full_content):
            import re as _re2
            FW = '｜'  # ｜
            FS = '／'  # ／
            # FW{1,2} handles DeepSeek 1-2 fullwidth bar instability
            full_content = _re2.sub(r'<' + FW + r'{1,2}DSML' + FW + r'{1,2}tool_calls>.*?' + r'<' + FS + r'{1,2}DSML' + FW + r'{1,2}tool_calls>', '', full_content, flags=_re2.DOTALL)
            full_content = _re2.sub(r'<' + FW + r'{1,2}DSML' + FW + r'{1,2}invoke name="[^"]*">.*?' + r'<' + FS + r'{1,2}DSML' + FW + r'{1,2}invoke>', '', full_content, flags=_re2.DOTALL)
            full_content = _re2.sub(r'<DSML\s+function_calls>.*?</DSML\s+function_calls>', '', full_content, flags=_re2.DOTALL)
            full_content = _re2.sub(r'<invoke\s+name="[^"]*"\s*>.*?</invoke\s*>', '', full_content, flags=_re2.DOTALL).strip()
            logger.warning("DiscoverAgent stream max_rounds: stripped DSML")
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


# ==================== 工具函数（从 chat_agent.py 复用）====================


def _extract_xhs_notes_from_tool_results(tool_results: list[str]) -> list[dict[str, Any]]:
    """从 xiaohongshu_search_notes 工具调用结果中提取结构化笔记数据。"""
    notes: list[dict[str, Any]] = []
    seen: set[str] = set()
    for result_str in tool_results:
        try:
            data = json.loads(result_str)
            inner = data.get("data", data)
            if isinstance(inner, str):
                inner = json.loads(inner)
            for note in inner.get("notes", []):
                nid = note.get("note_id", "")
                if nid and nid not in seen:
                    seen.add(nid)
                    notes.append({
                        "note_id": nid,
                        "title": note.get("title", ""),
                        "cover": note.get("cover", ""),
                        "likes": note.get("likes", 0),
                        "collects": note.get("collects", 0),
                        "comments": note.get("comments", 0),
                        "url": note.get("url", ""),
                        "author": note.get("author", {}),
                        "tags": note.get("tags", []),
                    })
        except (json.JSONDecodeError, TypeError, KeyError):
            continue
    return notes


def _extract_highlights(text: str) -> list[str]:
    suggestions: list[str] = []
    for line in text.split("\n"):
        line = line.strip()
        if line and len(line) < 30:
            cleaned = line.lstrip("0123456789. -•#").strip()
            if 2 < len(cleaned) < 20:
                suggestions.append(cleaned)
    return suggestions[:5] if suggestions else ["试试其他问题"]


def _surrounding_type_label(t: str) -> str:
    labels = {
        "restaurant": "美食", "shopping": "购物", "entertainment": "娱乐",
        "hotel": "住宿", "transport": "交通", "service": "服务",
    }
    return labels.get(t, t)


# ==================== XHS 信号检测 ====================

# 三级 XHS 信号词：命中任一即触发预取
_XHS_EXPLICIT = ["小红书", "xhs", "XHS", "小红薯"]
_XHS_RECENCY = ["最近火", "最近流行", "最近热门", "最近很火", "最近有什么", "最近有啥",
                "最近去", "最近哪个", "最近哪些", "这段时间", "最近比较火"]
_XHS_SOCIAL = ["网红打卡", "网红", "种草", "爆火", "刷屏", "必打卡", "热门打卡",
               "火起来", "火了", "值得去吗"]

# 从消息中清洗掉的噪声词（长词优先，避免部分匹配误删）
_XHS_NOISE_WORDS = sorted(
    _XHS_EXPLICIT + _XHS_RECENCY + _XHS_SOCIAL + [
        "有哪些", "什么", "怎么样", "值得去吗", "推荐", "告诉我",
        "有没有", "能不能", "可以", "帮我", "我想", "想知道",
        "比较", "最近", "的", "吗", "呢", "啊", "吧", "呀",
        "搜一下", "帮我查", "查一下", "找一下", "看看", "问一下",
    ],
    key=len, reverse=True,
)


def _xhs_signal_query(message: str) -> str | None:
    """如果消息包含小红书相关信号，返回清洗后的搜索 query；否则返回 None。

    三级信号：
    - 明确信号（100% 触发）：小红书 / xhs / 小红薯
    - 时效信号：最近火 / 最近流行 / 最近热门 等
    - 社交信号：网红 / 种草 / 爆火 / 值得去吗 等
    """
    has_explicit = any(kw in message for kw in _XHS_EXPLICIT)
    has_recency = any(kw in message for kw in _XHS_RECENCY)
    has_social = any(kw in message for kw in _XHS_SOCIAL)

    if not (has_explicit or has_recency or has_social):
        return None

    # 清洗消息提取搜索词
    query = message
    for w in _XHS_NOISE_WORDS:
        query = query.replace(w, "")

    import re
    query = re.sub(r'[，。！？、\s,!"?]+', ' ', query).strip()

    if len(query) < 2:
        return message.strip()  # 兜底用原始消息

    return query


def _format_xhs_for_prompt(raw_json: str) -> str:
    """将 XHS 搜索结果 JSON 格式化为 LLM 可读的 prompt 片段。"""
    import json as _json

    try:
        data = _json.loads(raw_json)
        notes = data.get("notes", [])
        if not notes:
            return ""

        lines = ["[系统预取 — 小红书实时热门笔记]", ""]
        for i, note in enumerate(notes[:8], 1):
            title = note.get("title", "无标题")
            likes = note.get("likes", 0)
            collects = note.get("collects", 0)
            tags = note.get("tags", [])
            tag_str = " ".join(f"#{t}" for t in tags[:5]) if tags else ""
            engagement = ""
            if likes or collects:
                parts = []
                if likes:
                    parts.append(f"👍{likes}")
                if collects:
                    parts.append(f"⭐{collects}")
                engagement = f" ({', '.join(parts)})"
            lines.append(f"{i}. {title}{engagement}")
            if tag_str:
                lines.append(f"   {tag_str}")

        lines.append("")
        lines.append("请优先使用以上小红书热门数据来回答用户问题，引用具体的笔记内容和热度信息。")
        return "\n".join(lines)
    except (_json.JSONDecodeError, TypeError, KeyError):
        return ""


# ==================== 周边查询信号检测 ====================


def _detect_surrounding_query(message: str) -> dict[str, str] | None:
    """检测用户消息是否包含"附近/周边"查询信号，并提取地名和搜索意图。

    当检测到信号时返回 {"place_name": "...", "query": "..."}，
    调用方直接用返回结果预调用 search_surroundings，不依赖 LLM 工具选择。

    未检测到时返回 None。
    """
    # 必须同时包含 地点参考 + 附近/周边语义
    has_nearby = any(kw in message for kw in ["附近", "周边", "周围", "边上", "旁边", "一带"])
    if not has_nearby:
        return None

    # 提取地点名（优先匹配已知景点/校园/地标）
    place_name = ""
    _CAMPUS_KEYWORDS = [
        # 北京高校
        "北京邮电大学", "北邮", "北京师范大学", "北师大", "北京电影学院", "北电",
        "北京大学", "北大", "清华大学", "清华", "中国人民大学", "人大",
        "北京航空航天大学", "北航", "北京理工大学", "北理工",
        "中央财经大学", "央财", "中国传媒大学", "中传", "北京外国语大学", "北外",
        "北京交通大学", "北交大", "北京科技大学", "北科大",
        # 地标
        "故宫", "天安门", "颐和园", "天坛", "北海", "三里屯", "国贸",
        "外滩", "东方明珠", "西湖", "雷峰塔", "灵隐寺",
        # 通用
        "校园", "校区", "景区", "公园", "广场", "商场", "火车站", "机场",
    ]
    for kw in sorted(_CAMPUS_KEYWORDS, key=len, reverse=True):
        if kw in message:
            place_name = kw
            break

    # 如果不在已知列表中，尝试用正则从"XX附近"模式提取
    if not place_name:
        import re as _re
        m = _re.search(r'([一-龥]{2,10})(?:附近|周边|周围|边上|旁边|一带)', message)
        if m:
            place_name = m.group(1)

    if not place_name:
        return None  # 有"附近"信号但提取不到地名，让 LLM 自己追问

    # 提取搜索意图作为 query（默认空字符串 = 全部类型）
    query = ""
    _QUERY_SIGNALS: dict[str, list[str]] = {
        "美食": ["好吃", "美食", "吃", "餐厅", "饭店", "火锅", "烧烤", "奶茶", "咖啡", "甜品", "小吃", "面"],
        "娱乐": ["好玩", "玩", "娱乐", "KTV", "电影", "密室", "剧本杀", "酒吧", "夜市"],
        "购物": ["购物", "买", "商场", "超市", "逛街", "衣服", "鞋"],
        "住宿": ["住宿", "酒店", "住", "宾馆", "民宿"],
        "拍照": ["拍照", "打卡", "摄影", "网红", "好看"],
    }
    for cat, signals in _QUERY_SIGNALS.items():
        if any(s in message for s in signals):
            query = cat
            break

    return {"place_name": place_name, "query": query}
