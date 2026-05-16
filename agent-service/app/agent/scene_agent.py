"""
此刻出发场景推荐 Agent — 时间+位置+天气驱动即时推荐。

场景规则引擎 + LLM 可覆盖。位置/天气由前端通过 metadata 传入。
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from app.agent.base_agent import AgentContext, AgentResponse, BaseAgent
from app.core.llm import get_llm, llm_available
from app.tools.registry import registry
from app.tools.tourism_api import tourism_api_client

logger = logging.getLogger(__name__)

# 场景规则： (条件函数, 推荐文案)
SCENE_RULES: list[tuple[callable, str, str]] = []


def _register_rule(condition, title: str, detail: str):
    SCENE_RULES.append((condition, title, detail))


def _build_scene_rules():
    """构建场景规则（延迟执行以避免导入时循环依赖）。"""
    if SCENE_RULES:
        return

    def lunch_rule(ctx: dict) -> bool:
        hour = ctx.get("hour", 12)
        return 11 <= hour <= 13

    _register_rule(lunch_rule, "午饭时间到！", "附近食堂/餐厅正热闹，趁人还不多赶紧去占位。要不要我帮你看看周边有什么好吃的？")

    def sunset_rule(ctx: dict) -> bool:
        hour = ctx.get("hour", 12)
        weather = ctx.get("weather", "晴")
        return 16 <= hour <= 18 and "晴" in weather

    _register_rule(sunset_rule, "日落黄金时刻", "现在是拍照的黄金时间！光线柔和，去湖边或高处拍几张，出片率极高。")

    def rainy_rule(ctx: dict) -> bool:
        weather = ctx.get("weather", "晴")
        return any(w in weather for w in ["雨", "雪", "阴"])

    _register_rule(rainy_rule, "雨天好去处", "外面天气不太好，不如去室内的图书馆、咖啡馆或博物馆逛逛，别有一番滋味。")

    def morning_rule(ctx: dict) -> bool:
        hour = ctx.get("hour", 12)
        return 6 <= hour <= 9

    _register_rule(morning_rule, "清晨第一站", "早起的鸟儿有虫吃！趁人少去热门景点打个卡，然后悠哉吃个早餐，完美开局。")

    def evening_rule(ctx: dict) -> bool:
        hour = ctx.get("hour", 18)
        return 19 <= hour <= 22

    _register_rule(evening_rule, "夜游时光", "晚上的校园/景区别有风味。找个安静的地方散散步，或者去夜市觅食，结束充实的一天。")


class SceneAgent(BaseAgent):
    """此刻出发 — 基于时间、位置、天气的场景即时推荐。"""

    @property
    def name(self) -> str:
        return "scene"

    @property
    def description(self) -> str:
        return "此刻出发场景推荐：根据时间和环境推荐当下最适合做的事"

    def __init__(self) -> None:
        _build_scene_rules()
        self._register_tools()

    def _register_tools(self) -> None:
        @registry.register(
            name="get_nearby_places",
            description="获取当前位置附近的场所列表",
            parameters={
                "type": "object",
                "properties": {
                    "lat": {"type": "number", "description": "纬度"},
                    "lng": {"type": "number", "description": "经度"},
                    "radius": {"type": "number", "description": "搜索半径（米），默认3000"},
                },
                "required": ["lat", "lng"],
            },
        )
        def get_nearby_places(lat: float, lng: float, radius: float = 3000) -> str:
            facilities = tourism_api_client.get_nearest_facilities(lat, lng)
            if not facilities:
                # 降级：返回热门场所
                places = tourism_api_client.get_hot_places(8)
                names = [p.get("name", "") for p in places if p.get("name")]
                return "\n".join(f"- {n}" for n in names) if names else "暂无附近地点数据"
            import json as _json
            return _json.dumps([
                {"name": f.get("name"), "type": f.get("type"), "distance": f.get("distance")}
                for f in facilities[:8]
            ], ensure_ascii=False)

        @registry.register(
            name="get_user_preferences",
            description="获取用户偏好和兴趣数据",
            parameters={
                "type": "object",
                "properties": {},
                "required": [],
            },
        )
        def get_user_preferences() -> str:
            return "用户偏好: 喜欢拍照、美食探索、轻松节奏"

    def get_system_prompt(self) -> str:
        return (
            "你是'此刻出发'场景推荐助手。根据用户当前的时间、位置、天气，"
            "推荐现在最适合做的事情。推荐要具体，包含地点名和简要理由。"
            "每次推荐 1-2 个最合适的选项即可。"
        )

    def get_tools(self) -> list[dict[str, Any]]:
        return registry.get_definitions()

    def can_handle(self, intent: str) -> bool:
        return intent == "scene_recommend"

    def process(self, message: str, context: AgentContext) -> AgentResponse:
        hour = self._get_hour()
        lat = context.metadata.get("lat", 30.259)
        lng = context.metadata.get("lng", 120.149)
        weather = context.metadata.get("weather", "晴")

        ctx = {"hour": hour, "lat": lat, "lng": lng, "weather": weather}

        # 规则引擎匹配
        matched = []
        for condition, title, detail in SCENE_RULES:
            try:
                if condition(ctx):
                    matched.append((title, detail))
            except Exception:
                pass

        if matched:
            title, detail = matched[0]
            recommendation = f"**{title}**\n\n{detail}"
        else:
            recommendation = "现在是个探索的好时机！打开地图看看附近有什么没去过的地方，或者来一次随机冒险吧。"

        # LLM 增强（如果有 LLM，用规则推荐作为上下文让 LLM 润色）
        if llm_available():
            client = get_llm()
            if client:
                try:
                    msgs = [
                        {"role": "system", "content": self.get_system_prompt()},
                        {"role": "user", "content": (
                            f"当前时间: {hour}:00\n天气: {weather}\n"
                            f"规则推荐: {recommendation}\n"
                            f"用户消息: {message}\n\n"
                            "请基于以上信息给出更具体的即时推荐，包含地点名称和原因。2-3句即可。"
                        )},
                    ]
                    result = client.chat(msgs, max_tokens=300)
                    recommendation = result.content or recommendation
                except Exception:
                    pass

        return AgentResponse(
            content=recommendation,
            intent="scene_recommend",
            suggestions=["看看附近", "随机冒险", "路线规划"],
            tools_used=["scene_rule_engine"] + (["llm"] if llm_available() else []),
            metadata={"scene_context": ctx},
        )

    @staticmethod
    def _get_hour() -> int:
        return datetime.now(tz=timezone.utc).hour + 8  # UTC+8 北京时间
