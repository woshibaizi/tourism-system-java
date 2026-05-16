"""
旅行回忆 Agent — 聚合用户旅行数据生成"旅行回忆"卡片。

流程：
1. 拉取时间范围内的日记、行为数据
2. 聚合统计（到访地点、美食、行走距离、照片数）
3. LLM 生成回忆文本（委托 diary_agent 的共享函数）
4. 返回结构化卡片数据
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from app.agent.base_agent import AgentContext, AgentResponse, BaseAgent
from app.agent.diary_agent import _generate_draft_content, _polish_content
from app.core.llm import get_llm, llm_available
from app.tools.registry import registry
from app.tools.tourism_api import tourism_api_client

logger = logging.getLogger(__name__)

MEMORY_CARD_TEMPLATE = """📸 旅行回忆 · {date_range}

{memory_text}

━━━━━━━━━━━━━━
📊 数据足迹
  🗺 到访地点: {place_count} 个
  🍽 品尝美食: {food_count} 种
  📝 记录日记: {diary_count} 篇
  🚶 行走距离: {distance_km} km
  📷 拍摄照片: {photo_count} 张
  ⭐ 平均评分: {avg_rating}

🏆 特别时刻
{highlights}
"""


class MemoryAgent(BaseAgent):
    """旅行回忆聚合 Agent — 从用户行为数据生成 Wrapped 式旅行回忆。"""

    @property
    def name(self) -> str:
        return "memory"

    @property
    def description(self) -> str:
        return "旅行回忆生成：聚合日记、行为、路线数据，生成专属旅行回忆卡片"

    def __init__(self) -> None:
        self._register_tools()

    def _register_tools(self) -> None:
        @registry.register(
            name="fetch_diaries_in_range",
            description="拉取指定时间范围内的旅行日记",
            parameters={
                "type": "object",
                "properties": {
                    "user_id": {"type": "string", "description": "用户 ID"},
                    "start_date": {"type": "string", "description": "开始日期 (YYYY-MM-DD)"},
                    "end_date": {"type": "string", "description": "结束日期 (YYYY-MM-DD)"},
                },
                "required": ["user_id"],
            },
        )
        def fetch_diaries_in_range(user_id: str, start_date: str = "", end_date: str = "") -> str:
            import json as _json
            try:
                payload = tourism_api_client._get_json(
                    f"/api/diaries?userId={user_id}&size=50"
                )
                records = payload.get("data", {}).get("records", [])
            except Exception:
                records = []
            return _json.dumps(records or [], ensure_ascii=False)

        @registry.register(
            name="fetch_behaviors_in_range",
            description="拉取用户行为数据（浏览、评分、导航记录）",
            parameters={
                "type": "object",
                "properties": {
                    "user_id": {"type": "string", "description": "用户 ID"},
                },
                "required": ["user_id"],
            },
        )
        def fetch_behaviors_in_range(user_id: str) -> str:
            import json as _json
            behavior = tourism_api_client.get_user_behavior(user_id)
            ratings = tourism_api_client.get_user_ratings(user_id)
            stats = tourism_api_client.get_stats()
            data = {
                "behavior": behavior or {},
                "ratings": ratings or [],
                "stats": stats or {},
            }
            return _json.dumps(data, ensure_ascii=False)

        @registry.register(
            name="generate_memory_card",
            description="LLM 聚合生成旅行回忆文本和卡片数据",
            parameters={
                "type": "object",
                "properties": {
                    "diaries_json": {"type": "string", "description": "JSON 格式的日记列表"},
                    "behaviors_json": {"type": "string", "description": "JSON 格式的行为数据"},
                    "date_range": {"type": "string", "description": "时间范围描述"},
                },
                "required": ["diaries_json", "behaviors_json", "date_range"],
            },
        )
        def generate_memory_card(diaries_json: str, behaviors_json: str, date_range: str) -> str:
            return _aggregate_and_generate(diaries_json, behaviors_json, date_range)

    def get_system_prompt(self) -> str:
        return (
            "你是旅行回忆生成专家，像 Spotify Wrapped 一样，"
            "把用户的旅行数据编织成温暖、有趣的年度/月度总结。"
            "用故事化的语言，突出那些让人会心一笑的细节。"
        )

    def get_tools(self) -> list[dict[str, Any]]:
        return registry.get_definitions()

    def can_handle(self, intent: str) -> bool:
        return intent == "generate_memory"

    def process(self, message: str, context: AgentContext) -> AgentResponse:
        user_id = context.user_id
        date_range = context.metadata.get("date_range", "最近一个月")

        # 聚合数据
        stats = _aggregate_user_data(user_id)

        if not stats:
            return AgentResponse(
                content="暂时还没有足够的旅行数据来生成回忆。\n先去探索世界吧，回来我帮你整理！",
                intent="generate_memory",
                suggestions=["去逛逛景点", "写篇旅行日记", "看看热门推荐"],
                tools_used=["rule_fallback"],
                metadata={"data_available": False},
            )

        # 生成回忆文本
        memory_text, highlights = _build_memory_card(stats, date_range)

        content = MEMORY_CARD_TEMPLATE.format(
            date_range=date_range,
            memory_text=memory_text,
            place_count=stats.get("place_count", 0),
            food_count=stats.get("food_count", 0),
            diary_count=stats.get("diary_count", 0),
            distance_km=stats.get("distance_km", 0),
            photo_count=stats.get("photo_count", 0),
            avg_rating=stats.get("avg_rating", 4.0),
            highlights=highlights,
        )

        return AgentResponse(
            content=content,
            intent="generate_memory",
            suggestions=["分享回忆卡片", "生成日记", "查看完整数据"],
            tools_used=["fetch_diaries_in_range", "fetch_behaviors_in_range"] + (["llm"] if llm_available() else []),
            metadata={
                "stats": stats,
                "date_range": date_range,
            },
        )


def _aggregate_user_data(user_id: str) -> dict[str, Any]:
    """聚合用户所有可用的旅行数据。"""
    stats: dict[str, Any] = {
        "place_count": 0,
        "food_count": 0,
        "diary_count": 0,
        "distance_km": 0,
        "photo_count": 0,
        "avg_rating": 4.0,
        "places": [],
        "foods": [],
        "diary_titles": [],
    }

    try:
        behavior = tourism_api_client.get_user_behavior(user_id)
        if behavior:
            stats["place_count"] = behavior.get("placeViews", 0)
            stats["food_count"] = behavior.get("foodViews", 0)
            stats["diary_count"] = behavior.get("diaryCount", 0)
            stats["distance_km"] = round(behavior.get("totalDistance", 0) / 1000, 1)
            stats["photo_count"] = behavior.get("photoCount", 0)
    except Exception:
        pass

    try:
        ratings = tourism_api_client.get_user_ratings(user_id)
        if ratings:
            vals = [r.get("rating", 0) for r in ratings if isinstance(r, dict)]
            if vals:
                stats["avg_rating"] = round(sum(vals) / len(vals), 1)
    except Exception:
        pass

    try:
        payload = tourism_api_client._get_json(f"/api/diaries?userId={user_id}&size=20")
        records = payload.get("data", {}).get("records", [])
        if isinstance(records, list):
            stats["diary_titles"] = [d.get("title", "") for d in records[:10] if d.get("title")]
    except Exception:
        pass

    try:
        places = tourism_api_client.get_places(10)
        stats["places"] = [p.get("name", "") for p in places[:5] if p.get("name")]
    except Exception:
        pass

    try:
        foods = tourism_api_client.get_hot_foods(10)
        stats["foods"] = [f.get("name", "") for f in foods[:5] if f.get("name")]
    except Exception:
        pass

    has_data = any([
        stats["place_count"] > 0,
        stats["food_count"] > 0,
        stats["diary_count"] > 0,
    ])
    return stats if has_data else {}


def _build_memory_card(stats: dict[str, Any], date_range: str) -> tuple[str, str]:
    """构建回忆卡片文字内容。LLM 可用时生成，否则使用模板。"""
    place_count = stats.get("place_count", 0)
    food_count = stats.get("food_count", 0)
    diary_count = stats.get("diary_count", 0)
    distance_km = stats.get("distance_km", 0)

    highlight_items: list[str] = []
    if place_count >= 10:
        highlight_items.append(f"  ⭐ 你是个真正的探索者，到访了 {place_count} 个地方")
    if food_count >= 10:
        highlight_items.append(f"  🍜 吃遍 {food_count} 种美食，味蕾的冒险从未停止")
    if diary_count >= 3:
        highlight_items.append(f"  ✍ 写下 {diary_count} 篇日记，用文字留下了旅途的印记")
    if distance_km >= 5:
        highlight_items.append(f"  🚶 走了 {distance_km} km，每一步都算数")

    if not highlight_items:
        highlight_items.append("  🌟 每一段旅程都值得被记住，继续出发吧")

    if llm_available():
        try:
            client = get_llm()
            if client:
                elements = {
                    "place": "多个地点",
                    "activity": "旅行探索",
                    "mood": "怀旧温暖",
                    "highlights": highlight_items,
                }
                prompt = (
                    f"为{date_range}的旅行经历生成一段温暖的回忆文字（3-4句），"
                    f"像翻看老照片一样娓娓道来。"
                )
                draft = _generate_draft_content(prompt, [], elements, "回忆")
                polished = _polish_content(draft, "回忆")
                memory_text = polished.get("content", draft.get("content", ""))
                highlights = "\n".join(highlight_items)
                return memory_text, highlights
        except Exception:
            pass

    # 规则降级
    memory_text = (
        f"在{date_range}里，你走过了{place_count}个地方，"
        f"品尝了{food_count}种美食，写了{diary_count}篇日记。"
        f"每一段路、每一顿饭、每一行字，都构成了独一无二的旅行故事。"
        f"翻开这些回忆，就像打开了一本专属的旅行相册。"
    )
    highlights = "\n".join(highlight_items)
    return memory_text, highlights


def _aggregate_and_generate(diaries_json: str, behaviors_json: str, date_range: str) -> str:
    """工具函数：解析数据并生成回忆卡片。"""
    import json as _json

    try:
        diaries = _json.loads(diaries_json)
    except _json.JSONDecodeError:
        diaries = []
    try:
        behaviors = _json.loads(behaviors_json)
    except _json.JSONDecodeError:
        behaviors = {}

    stats = {
        "place_count": behaviors.get("behavior", {}).get("placeViews", 0),
        "food_count": behaviors.get("behavior", {}).get("foodViews", 0),
        "diary_count": len(diaries) if isinstance(diaries, list) else 0,
        "distance_km": round(behaviors.get("behavior", {}).get("totalDistance", 0) / 1000, 1),
        "photo_count": behaviors.get("behavior", {}).get("photoCount", 0),
        "avg_rating": 4.0,
        "places": [],
        "foods": [],
        "diary_titles": [d.get("title", "") for d in (diaries if isinstance(diaries, list) else [])[:10] if d.get("title")],
    }

    memory_text, highlights = _build_memory_card(stats, date_range)
    return MEMORY_CARD_TEMPLATE.format(
        date_range=date_range,
        memory_text=memory_text,
        place_count=stats["place_count"],
        food_count=stats["food_count"],
        diary_count=stats["diary_count"],
        distance_km=stats["distance_km"],
        photo_count=stats["photo_count"],
        avg_rating=stats["avg_rating"],
        highlights=highlights,
    )
