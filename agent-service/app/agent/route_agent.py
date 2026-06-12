"""
智能一日游规划 Agent — LLM 多轮工具调用 + 真实路径计算。

流程：
1. 意图解析 → 提取目的地/时长/预算/兴趣/节奏
2. LLM 第1轮: search_places + get_hot_foods 发现候选
3. LLM 第2轮: recommend_places + get_place_detail 精选
4. LLM 第3轮: plan_multi_dest + get_nearest_facilities 路径计算
5. LLM 第4轮: 编排为时间轴 → 返回完整行程
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from app.agent.base_agent import AgentContext, AgentResponse, BaseAgent
from app.agent.prompts import ROUTE_PLAN_PROMPT, SYSTEM_PROMPT
from app.core.llm import get_llm, llm_available
from app.tools.registry import registry
from app.tools.tourism_api import tourism_api_client

logger = logging.getLogger(__name__)

_MAX_TOOL_ROUNDS = 4

# 结构化行程输出的 System Prompt 后缀
ROUTE_OUTPUT_PROMPT = """

## 最终输出格式

当你完成所有工具调用后，用**自然语言 + 时间轴表格**输出完整行程。
**不要输出 JSON 代码块。** 用普通人看得懂的格式。

输出结构：

先写一段简短的行程概述（2-3句话总结这条路线）。

然后用一个时间轴表格（Markdown 表格格式）：

| 时间 | 地点 | 活动 | 停留 | 步行 | 花费 |
|------|------|------|------|------|------|
| 08:30 | 断桥残雪 | 出发，拍照打卡 | 30min | - | ¥0 |
| 09:00 | 白堤 | 沿湖步行 | 40min | 15min | ¥0 |
| ...（至少6行） | | | | | |

最后单独列出：
- **总距离**：约 X km
- **总时长**：约 X 小时
- **总花费**：约 ¥X
- **亮点**：3-5 个必打卡推荐
- **实用贴士**：2-4 条（交通/美食/拍照/厕所等）

要求：
- 用 Markdown 表格，不要用 JSON
- 语气亲切自然，像旅行达人在分享攻略
- 时间安排合理，含用餐时间
- emoji 适度使用，不要太花哨
"""


class RouteAgent(BaseAgent):
    """智能一日游路线规划 Agent。"""

    # 合法的兴趣标签白名单 — 防止 LLM 将地名混入 interests 参数
    _INTEREST_TAGS: set[str] = {"拍照", "美食", "休闲", "文化", "历史", "购物", "亲子", "户外", "夜生活"}

    # RouteAgent 只暴露路线规划专用工具，禁止 LLM 调用 ChatAgent 的通用搜索/美食列表工具
    _ROUTE_TOOL_NAMES: set[str] = {
        "recommend_places",
        "plan_shortest_path",
        "plan_multi_dest",
        "get_foods_by_place",
        "get_nearest_facilities",
    }

    @property
    def name(self) -> str:
        return "route"

    @property
    def description(self) -> str:
        return "智能一日游规划：多目标路径优化、时间轴编排、餐饮设施推荐"

    def __init__(self) -> None:
        self._register_tools()

    def _register_tools(self) -> None:

        @registry.register(
            name="recommend_places",
            description="基于用户偏好和预算，智能推荐景点/场所。interests 可选，不传则使用通用兴趣",
            parameters={
                "type": "object",
                "properties": {
                    "interests": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "兴趣标签列表: 拍照/美食/文化/休闲。可选，不传则默认推荐综合热门景点",
                    },
                    "budget": {"type": "string", "description": "预算范围"},
                },
                "required": [],
            },
            agent_name="route",
        )
        def recommend_places(interests: list[str] | None = None, budget: str = "") -> str:
            # 参数校验：过滤掉非兴趣标签（如 LLM 混入的地名）
            if interests:
                filtered = [i for i in interests if i in self._INTEREST_TAGS]
                if filtered != list(interests):
                    logger.info(
                        "recommend_places 参数过滤: 原始=%s → 过滤后=%s (移除非标签词)",
                        interests, filtered,
                    )
                # 过滤后全部为非标签 → 使用通用默认值
                effective_interests = filtered if filtered else ["拍照", "美食", "休闲"]
            else:
                effective_interests = ["拍照", "美食", "休闲"]
            prefs: dict[str, Any] = {"interests": effective_interests}
            if budget:
                prefs["budget"] = budget
            places = tourism_api_client.recommend_places(prefs)
            if not places:
                # 推荐接口无结果时，降级到通用地点列表
                places = tourism_api_client.get_places(10)
                if places:
                    logger.info("recommend_places 降级: 使用 get_places 返回 %d 条通用地点", len(places))
            if not places:
                # 两次降级均无数据 → 告诉 LLM 数据库无推荐，让 LLM 基于知识列出候选并请用户确认
                return (
                    "⚠ 数据库暂无推荐数据。\n"
                    "请告知用户：系统暂未收录该目的地的推荐数据。列出你所知的该地 3-5 个知名景点供用户参考选择，"
                    "标注'以下为通用知识建议'。\n"
                    "不要直接规划完整行程——先等用户确认想去哪些景点。"
                )
            names = [
                f"{p.get('name', '未知')} (评分:{p.get('rating', 'N/A')}, {p.get('description', '')[:40]})"
                for p in places[:6] if p.get("name")
            ]
            return "\n".join(f"- {n}" for n in names) if names else "暂无推荐数据"

        @registry.register(
            name="plan_shortest_path",
            description="计算两个地点之间的最短路径（A*算法）",
            parameters={
                "type": "object",
                "properties": {
                    "from_place": {"type": "string", "description": "起点地点名称或ID"},
                    "to_place": {"type": "string", "description": "终点地点名称或ID"},
                },
                "required": ["from_place", "to_place"],
            },
            agent_name="route",
        )
        def plan_shortest_path(from_place: str, to_place: str) -> str:
            # ─── 输入校验: 防止 DSML 解析失败导致空参数传播 ───
            if not from_place or not isinstance(from_place, str) or not from_place.strip():
                return json.dumps({"ok": False, "error": "缺少起点参数 from_place"}, ensure_ascii=False)
            if not to_place or not isinstance(to_place, str) or not to_place.strip():
                return json.dumps({"ok": False, "error": "缺少终点参数 to_place"}, ensure_ascii=False)
            from_place = from_place.strip()
            to_place = to_place.strip()

            from_id = _resolve_place_id(from_place)
            to_id = _resolve_place_id(to_place)
            if not from_id or not to_id:
                places = tourism_api_client.get_places(30)
                id_map = {p.get("name", ""): p.get("id", "") for p in places if p.get("name")}
                from_id = from_id or id_map.get(from_place, from_place)
                to_id = to_id or id_map.get(to_place, to_place)
            result = tourism_api_client.plan_route_single(from_id, to_id)
            if not result or result.get("totalDistance") is None:
                return f"无法计算 {from_place} → {to_place} 的路径"
            return json.dumps({
                "from": from_place, "to": to_place,
                "distance_m": result.get("totalDistance"),
                "time_min": result.get("totalTime"),
                "segments": result.get("segments", [])[:3],
            }, ensure_ascii=False)

        @registry.register(
            name="plan_multi_dest",
            description="计算多个地点的最优访问顺序（TSP 求解），返回最短路线",
            parameters={
                "type": "object",
                "properties": {
                    "place_names": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "地点名称列表",
                    },
                },
                "required": ["place_names"],
            },
            agent_name="route",
        )
        def plan_multi_dest(place_names: list[str]) -> str:
            place_ids = [_resolve_place_id(n) for n in place_names]
            result = tourism_api_client.plan_route_multi(place_ids)
            if not result or result.get("totalDistance") is None:
                # 降级：返回简单的顺序路径
                return json.dumps({
                    "order": place_names,
                    "note": "无法计算最优路径，按给定顺序访问",
                    "distance_m": 0,
                    "time_min": 0,
                }, ensure_ascii=False)
            return json.dumps({
                "order": result.get("orderedPlaces", place_names),
                "distance_m": result.get("totalDistance"),
                "time_min": result.get("totalTime"),
                "segments": result.get("segments", [])[:5],
            }, ensure_ascii=False)

        @registry.register(
            name="get_foods_by_place",
            description="获取指定场所附近的美食列表",
            parameters={
                "type": "object",
                "properties": {
                    "place_name": {"type": "string", "description": "场所名称"},
                },
                "required": ["place_name"],
            },
            agent_name="route",
        )
        def get_foods_by_place(place_name: str) -> str:
            place_id = _resolve_place_id(place_name)
            foods = tourism_api_client.get_foods_by_place(place_id) if place_id else []
            if not foods:
                # 尝试获取通用美食列表作为降级
                foods = tourism_api_client.get_foods(8)
            if not foods:
                return (
                    f"后端暂无{place_name}附近的美食数据。"
                    "请基于你对目的地餐饮的通用知识，在行程中推荐 2-3 个合理的美食选项，"
                    "标注'餐饮信息为通用推荐'。"
                )
            names = [
                f"{f.get('name', '未知')} (¥{f.get('price', 'N/A')}, {f.get('description', '')[:30]})"
                for f in foods[:5] if f.get("name")
            ]
            return "\n".join(f"- {n}" for n in names) if names else f"{place_name}附近暂无美食数据"

        @registry.register(
            name="get_nearest_facilities",
            description="获取指定地点的最近设施（卫生间、停车场、休息区等）",
            parameters={
                "type": "object",
                "properties": {
                    "place_name": {"type": "string", "description": "参考地点名称"},
                    "facility_type": {"type": "string", "description": "设施类型: toilet/parking/rest_area"},
                },
                "required": ["place_name"],
            },
            agent_name="route",
        )
        def get_nearest_facilities(place_name: str, facility_type: str = "") -> str:
            coords = _resolve_coords(place_name)
            if coords is None:
                return f"无法获取 {place_name} 的坐标"
            lat, lng = coords
            facilities = tourism_api_client.get_nearest_facilities(lat, lng, facility_type or None)
            if not facilities:
                return f"{place_name}附近暂无{facility_type or '设施'}数据"
            names = [
                f"{f.get('name', '未知')} ({f.get('type', '')}, 距离:{f.get('distance', 'N/A')}m)"
                for f in facilities[:5] if f.get("name")
            ]
            return "\n".join(f"- {n}" for n in names) if names else "暂无数据"

    def get_system_prompt(self) -> str:
        return ROUTE_PLAN_PROMPT

    def get_tools(self) -> list[dict[str, Any]]:
        """只返回路线规划专用工具 — Agent 作用域隔离。"""
        return registry.get_definitions_for_agent(self.name)

    def can_handle(self, intent: str) -> bool:
        return intent == "plan_trip_route"

    def process(self, message: str, context: AgentContext) -> AgentResponse:
        if llm_available():
            return self._process_with_llm(message, context)
        return self._process_with_rules(message, context)

    async def stream_process(self, message: str, context: AgentContext):
        """流式路线规划 — SSE 事件生成器，逐步推送工具调用和结果。"""
        import asyncio

        client = get_llm()
        if not client:
            yield {"event": "done", "data": {
                "content": "LLM 不可用，请稍后重试",
                "intent": "plan_trip_route",
                "trace_id": context.session_id or "",
                "suggestions": [],
                "tools_used": ["llm_unavailable"],
            }}
            return

        # 提取槽位信息
        slots = context.metadata.get("intent_slots", {})
        destination = slots.get("destination", "")
        duration = slots.get("days", 1)
        interests = slots.get("interests", [])
        pace = slots.get("pace", "适中")

        # 构建上下文注入的系统消息（与 _process_with_llm 一致）
        if destination:
            interest_tags = interests if interests else ["拍照", "美食", "休闲"]
            interests_json = json.dumps(interest_tags, ensure_ascii=False)
            context_hint = (
                f"用户需求: {message}\n"
                f"目的地: {destination}, 时长: {duration}天, 节奏: {pace}\n\n"
                "【工作流程 — 严格遵守】\n"
                "推荐景点和最优路线顺序已由系统自动获取（见上方 recommend_places 和 plan_multi_dest 结果）。\n"
                "你可以根据需要调用以下工具补充信息：\n"
                "- get_foods_by_place: 查询特定景点附近的美食\n"
                "- get_nearest_facilities: 查询卫生间(toilet)、停车场(parking)、休息区(rest_area)\n\n"
                "补充完必要信息后，输出完整的 Markdown 时间轴行程。\n\n"
                "⚠️ 禁止行为：\n"
                "- 禁止用 plan_shortest_path 逐段替代 plan_multi_dest！路线顺序已由系统确定。\n"
                "- 禁止编造数据，必须基于工具返回的真实结果。\n"
                "- 禁止往 interests 参数里加地名。"
            )
        else:
            context_hint = (
                f"用户需求: {message}\n"
                f"时长: {duration}天, 兴趣: {interests or '未指定'}, 节奏: {pace}\n"
                "用户没有明确目的地。如果你能从消息中推断出目的地，请直接使用；"
                "如果不能，请友好地追问目的地（1-2句话），不要凭空编造行程。"
            )

        msgs: list[dict[str, Any]] = [
            {"role": "system", "content": ROUTE_PLAN_PROMPT + "\n\n" + ROUTE_OUTPUT_PROMPT},
            {"role": "user", "content": context_hint},
        ]

        all_route_tools = registry.get_definitions_for_agent(self.name)
        tools_used: list[str] = []
        tool_latencies: list[dict[str, Any]] = []

        # ==================================================================
        # Round 0: CODE 直接调用 recommend_places（不经过 LLM，100% 可靠）
        # ==================================================================
        if destination:
            effective_interests = interests if interests else ["拍照", "美食", "休闲"]
            # 白名单过滤：防止 LLM 后续传地名
            filtered = [i for i in effective_interests if i in self._INTEREST_TAGS]
            if not filtered:
                filtered = ["拍照", "美食", "休闲"]

            yield {"event": "tool_call", "data": {"name": "recommend_places", "args": {"interests": filtered}}}

            t0 = time.time()
            rec_result = registry.dispatch("recommend_places", {"interests": filtered})
            elapsed = int((time.time() - t0) * 1000)
            tools_used.append("recommend_places")
            tool_latencies.append({"tool": "recommend_places", "latency_ms": elapsed})

            yield {"event": "tool_result", "data": {"name": "recommend_places", "result": rec_result}}
            msgs.append({"role": "tool", "tool_call_id": "code_round0", "content": rec_result})

            # ==================================================================
            # Round 1: CODE 直接调用 plan_multi_dest（不经过 LLM，100% 可靠）
            # ==================================================================
            place_names = _extract_place_names_from_result(rec_result)

            if place_names:
                yield {"event": "tool_call", "data": {"name": "plan_multi_dest", "args": {"place_names": place_names}}}

                t0 = time.time()
                route_result = registry.dispatch("plan_multi_dest", {"place_names": place_names})
                elapsed = int((time.time() - t0) * 1000)
                tools_used.append("plan_multi_dest")
                tool_latencies.append({"tool": "plan_multi_dest", "latency_ms": elapsed})

                yield {"event": "tool_result", "data": {"name": "plan_multi_dest", "result": route_result}}
                msgs.append({"role": "tool", "tool_call_id": "code_round1", "content": route_result})

        # ==================================================================
        # Round 2+: LLM 智能补充 — 美食/设施查询 + 输出 Markdown 行程
        # 使用 chat_with_tools_safe: DSML 解析失败时自动 tool_choice="required" 重试
        # ==================================================================
        # plan_shortest_path 不在 enrichment_tools 中 — LLM 无法逐段替代 plan_multi_dest
        enrichment_tools = [t for t in all_route_tools if t["function"]["name"] in {"get_foods_by_place", "get_nearest_facilities"}]

        for round_num in range(2):  # max 2 LLM rounds
            result = await asyncio.to_thread(
                client.chat_with_tools_safe, msgs, tools=enrichment_tools
            )

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

                    t0 = time.time()
                    tool_result = await asyncio.to_thread(registry.dispatch, tool_name, args)
                    elapsed_ms = int((time.time() - t0) * 1000)
                    tools_used.append(tool_name)
                    tool_latencies.append({"tool": tool_name, "latency_ms": elapsed_ms})

                    yield {"event": "tool_result", "data": {"name": tool_name, "result": tool_result}}

                    msgs.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": tool_result,
                    })
            else:
                break  # LLM 决定不再调工具，输出最终回复

        # ==================================================================
        # 最终回复：流式输出
        # ==================================================================
        from app.agent.chat_agent import _collect_stream

        tokens = await asyncio.to_thread(_collect_stream, client, msgs)
        for token in tokens:
            yield {"event": "token", "data": {"content": token}}

        full_content = "".join(tokens)
        parsed = _parse_itinerary(full_content)
        yield {
            "event": "done",
            "data": {
                "content": full_content,
                "intent": "plan_trip_route",
                "trace_id": context.session_id or "",
                "suggestions": parsed.get("highlights", []),
                "tools_used": tools_used if tools_used else ["llm"],
                "metadata": {
                    "itinerary": parsed,
                    "tool_latencies": tool_latencies,
                },
            },
        }

    def _process_with_llm(self, message: str, context: AgentContext) -> AgentResponse:
        client = get_llm()
        assert client is not None

        # 提取槽位信息
        slots = context.metadata.get("intent_slots", {})
        destination = slots.get("destination", "")
        duration = slots.get("days", 1)
        interests = slots.get("interests", [])
        pace = slots.get("pace", "适中")

        # 构建上下文注入的系统消息
        if destination:
            # 构建明确的兴趣标签参数，防止 LLM 把地名混进去
            interest_tags = interests if interests else ["拍照", "美食", "休闲"]
            import json as _json
            interests_json = _json.dumps(interest_tags, ensure_ascii=False)

            context_hint = (
                f"用户需求: {message}\n"
                f"目的地: {destination}, 时长: {duration}天, 节奏: {pace}\n\n"
                "【工作流程 — 严格遵守】\n"
                "推荐景点和最优路线顺序已由系统自动获取（见上方 recommend_places 和 plan_multi_dest 结果）。\n"
                "你可以根据需要调用以下工具补充信息：\n"
                "- get_foods_by_place: 查询特定景点附近的美食\n"
                "- get_nearest_facilities: 查询卫生间(toilet)、停车场(parking)、休息区(rest_area)\n\n"
                "补充完必要信息后，输出完整的 Markdown 时间轴行程。\n\n"
                "⚠️ 禁止行为：\n"
                "- 禁止用 plan_shortest_path 逐段替代 plan_multi_dest！路线顺序已由系统确定。\n"
                "- 禁止编造数据，必须基于工具返回的真实结果。\n"
                "- 禁止往 interests 参数里加地名。"
            )
        else:
            # 目的地缺失：引导 LLM 自然追问，不凭空编造行程
            context_hint = (
                f"用户需求: {message}\n"
                f"时长: {duration}天, 兴趣: {interests or '未指定'}, 节奏: {pace}\n"
                "用户没有明确目的地。如果你能从消息中推断出目的地，请直接使用；"
                "如果不能，请友好地追问目的地（1-2句话），不要凭空编造行程。"
            )

        msgs: list[dict[str, Any]] = [
            {"role": "system", "content": ROUTE_PLAN_PROMPT + "\n\n" + ROUTE_OUTPUT_PROMPT},
            {"role": "user", "content": context_hint},
        ]

        all_route_tools = registry.get_definitions_for_agent(self.name)
        tools_used: list[str] = []
        tool_latencies: list[dict[str, Any]] = []

        # ==================================================================
        # Round 0/1: CODE 直接调用（与 stream_process 一致）
        # ==================================================================
        if destination:
            effective_interests = interests if interests else ["拍照", "美食", "休闲"]
            filtered = [i for i in effective_interests if i in self._INTEREST_TAGS]
            if not filtered:
                filtered = ["拍照", "美食", "休闲"]

            t0 = time.time()
            rec_result = registry.dispatch("recommend_places", {"interests": filtered})
            tools_used.append("recommend_places")
            tool_latencies.append({"tool": "recommend_places", "latency_ms": int((time.time() - t0) * 1000)})
            msgs.append({"role": "tool", "tool_call_id": "code_round0", "content": rec_result})

            place_names = _extract_place_names_from_result(rec_result)
            if not place_names:
                if "西湖" in destination or "杭州" in destination:
                    place_names = ["断桥残雪", "白堤", "孤山", "苏堤春晓", "花港观鱼", "雷峰塔", "柳浪闻莺", "湖滨公园"]

            if place_names:
                t0 = time.time()
                route_result = registry.dispatch("plan_multi_dest", {"place_names": place_names})
                tools_used.append("plan_multi_dest")
                tool_latencies.append({"tool": "plan_multi_dest", "latency_ms": int((time.time() - t0) * 1000)})
                msgs.append({"role": "tool", "tool_call_id": "code_round1", "content": route_result})

        # ==================================================================
        # Round 2+: LLM 智能补充 — 美食/设施查询 + 输出 Markdown 行程
        # 使用 chat_with_tools_safe: DSML 解析失败时自动 tool_choice="required" 重试
        # ==================================================================
        # plan_shortest_path 不在 enrichment_tools 中 — LLM 无法逐段替代 plan_multi_dest
        enrichment_tools = [t for t in all_route_tools if t["function"]["name"] in {"get_foods_by_place", "get_nearest_facilities"}]

        for _round_num in range(2):
            result = client.chat_with_tools_safe(msgs, tools=enrichment_tools)

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
                    tools_used.append(tool_name)
                    tool_latencies.append({"tool": tool_name, "latency_ms": int((time.time() - t0) * 1000)})
                    msgs.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": tool_result,
                    })
            else:
                break

        # 最终回复
        final = client.chat(msgs)
        parsed = _parse_itinerary(final.content or "")
        return AgentResponse(
            content=final.content or "",
            intent="plan_trip_route",
            suggestions=parsed.get("highlights", []),
            tools_used=tools_used if tools_used else ["llm"],
            metadata={
                "itinerary": parsed,
                "tool_latencies": tool_latencies,
            },
        )

    def _process_with_rules(self, message: str, context: AgentContext) -> AgentResponse:
        """无 LLM 时使用 route_planner 降级。"""
        from app.tools.route_planner import build_route_outline

        try:
            itinerary = build_route_outline(message)
            highlights = itinerary.get("highlights", [])
            return AgentResponse(
                content=itinerary.get("summary", "路线规划完成"),
                intent="plan_trip_route",
                suggestions=highlights,
                tools_used=["rule_planner"],
                metadata={"itinerary": itinerary, "fallback": True},
            )
        except Exception as e:
            logger.exception("规则路线规划失败")
            return AgentResponse(
                content=f"路线规划暂时不可用，请稍后重试。错误: {e}",
                intent="plan_trip_route",
                suggestions=["稍后重试", "联系管理员"],
                tools_used=["rule_fallback"],
            )


# ==================== 工具函数 ====================


def _resolve_place_id(place_name: str) -> str:
    """通过名称查找场所 ID。"""
    results = tourism_api_client.search_places(place_name)
    if results:
        for r in results:
            if r.get("name") == place_name or place_name in r.get("name", ""):
                return r.get("id", "")
        return results[0].get("id", place_name)
    return place_name


def _resolve_coords(place_name: str) -> tuple[float, float] | None:
    """通过名称查找场所坐标。"""
    results = tourism_api_client.search_places(place_name)
    if results:
        for r in results:
            lat = r.get("latitude")
            lng = r.get("longitude")
            if lat is not None and lng is not None:
                return float(lat), float(lng)
    return None


def _extract_place_names_from_result(tool_result: str) -> list[str]:
    """从 recommend_places 工具结果中提取景点名称列表。"""
    names: list[str] = []
    for line in tool_result.split("\n"):
        line = line.strip()
        if line.startswith("- ") and "(" in line:
            # 格式: "- 断桥残雪 (评分:4.5, ...)"
            name = line[2:].split("(")[0].strip()
            if name and len(name) < 20:
                names.append(name)
    return names


def _parse_itinerary(text: str) -> dict[str, Any]:
    """从 LLM 输出中解析结构化行程 JSON。"""
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or start >= end:
        return {"raw": text}
    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        return {"raw": text}
