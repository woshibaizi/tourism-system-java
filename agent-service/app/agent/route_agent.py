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
你需要输出一个完整的行程规划。如果之前已经通过工具获取了真实数据，请基于真实数据编排。
最终回复必须是以下 JSON 格式（只返回 JSON，不要其他文字）：

{
  "title": "行程标题",
  "timeline": [
    {"time": "09:00", "activity": "活动描述", "place": "地点名称", "duration": "90min", "walk": "12min", "cost": "¥35"}
  ],
  "total_distance": "4.2km",
  "total_time": "6h",
  "total_cost": "¥180",
  "highlights": ["亮点1", "亮点2"],
  "tips": ["小贴士1"]
}

要求：
- timeline 至少有 4 个节点（含出发和返程）
- 每段标注步行时间和大致花费
- 总时间控制在用户给定的时长范围内
- 时间安排合理（含用餐时间）
- tips 给出 2-3 条实用建议
"""


class RouteAgent(BaseAgent):
    """智能一日游路线规划 Agent。"""

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
            description="基于用户偏好和预算，智能推荐景点/场所",
            parameters={
                "type": "object",
                "properties": {
                    "interests": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "兴趣标签列表: 拍照/美食/文化/休闲",
                    },
                    "budget": {"type": "string", "description": "预算范围"},
                },
                "required": ["interests"],
            },
        )
        def recommend_places(interests: list[str], budget: str = "") -> str:
            prefs: dict[str, Any] = {"interests": interests}
            if budget:
                prefs["budget"] = budget
            places = tourism_api_client.recommend_places(prefs)
            if not places:
                return "暂无推荐数据"
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
        )
        def plan_shortest_path(from_place: str, to_place: str) -> str:
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
        )
        def get_foods_by_place(place_name: str) -> str:
            place_id = _resolve_place_id(place_name)
            if not place_id:
                return f"未找到场所: {place_name}"
            foods = tourism_api_client.get_foods_by_place(place_id)
            if not foods:
                return f"{place_name}附近暂无美食数据"
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
        return registry.get_definitions()

    def can_handle(self, intent: str) -> bool:
        return intent == "plan_trip_route"

    def process(self, message: str, context: AgentContext) -> AgentResponse:
        if llm_available():
            return self._process_with_llm(message, context)
        return self._process_with_rules(message, context)

    def _process_with_llm(self, message: str, context: AgentContext) -> AgentResponse:
        client = get_llm()
        assert client is not None

        # 提取槽位信息
        slots = context.metadata.get("intent_slots", {})
        destination = slots.get("destination", "未指定")
        duration = slots.get("days", 1)
        interests = slots.get("interests", [])
        pace = slots.get("pace", "适中")

        # 构建上下文注入的系统消息
        context_hint = (
            f"用户需求: {message}\n"
            f"目的地: {destination}, 时长: {duration}天, 兴趣: {interests or '未指定'}, 节奏: {pace}\n"
            "请先用工具获取候选地点、路径和美食数据，再基于真实数据编排行程。"
        )

        msgs: list[dict[str, Any]] = [
            {"role": "system", "content": ROUTE_PLAN_PROMPT + "\n\n" + ROUTE_OUTPUT_PROMPT},
            {"role": "user", "content": context_hint},
        ]

        tools = registry.get_definitions()
        tools_used: list[str] = []
        tool_latencies: list[dict[str, Any]] = []

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
                # 解析最终输出为结构化 JSON
                parsed = _parse_itinerary(result.content or "")
                return AgentResponse(
                    content=result.content or "",
                    intent="plan_trip_route",
                    suggestions=parsed.get("highlights", []),
                    tools_used=tools_used if tools_used else ["llm"],
                    metadata={
                        "itinerary": parsed,
                        "tool_latencies": tool_latencies,
                    },
                )

        # 超轮次，强制生成最终回复
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
                "max_rounds_reached": True,
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
