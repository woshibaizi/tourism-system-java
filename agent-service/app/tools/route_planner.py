from __future__ import annotations

import logging
from typing import Any

from app.tools.tourism_api import tourism_api_client

logger = logging.getLogger(__name__)


def build_route_outline(requirement: str) -> dict[str, Any]:
    """
    根据用户需求生成路线草案。

    流程：
    1. 从需求中提取关键词 → 搜索场所
    2. 推荐候选景点
    3. 多目标路径规划
    4. 拼接为结构化行程
    """
    places = _resolve_places(requirement)
    if not places:
        return {
            "summary": f"未找到与需求匹配的地点: {requirement[:30]}...",
            "days": [],
            "route": {"totalDistance": 0, "estimatedMinutes": 0},
        }

    # 多目标路径规划
    place_ids = [p["id"] for p in places if p.get("id")]
    route = {}
    if len(place_ids) >= 2:
        route = tourism_api_client.plan_route_multi(place_ids) or {}

    # 组装行程
    items = _build_itinerary_items(places, int(_infer_hours(requirement)))
    return {
        "summary": _build_summary(requirement, places, route),
        "days": [{"day": 1, "items": items}],
        "route": {
            "totalDistance": route.get("totalDistance", 0),
            "estimatedMinutes": route.get("totalTime", _infer_minutes(requirement)),
            "provider": "java_backend",
        },
        "highlights": [p.get("name", "") for p in places[:5] if p.get("name")],
    }


def _resolve_places(requirement: str) -> list[dict[str, Any]]:
    """从需求中提取关键词，搜索并推荐场所。"""
    # 尝试通过偏好推荐
    interests = _extract_interests(requirement)
    preferred = tourism_api_client.recommend_places({"interests": interests}) if interests else []
    if preferred:
        return preferred[:6]

    # 尝试关键词搜索
    for keyword in _extract_keywords(requirement):
        results = tourism_api_client.search_places(keyword)
        if results:
            return results[:6]

    # 兜底：热门场所
    return tourism_api_client.get_hot_places(6)


def _extract_keywords(requirement: str) -> list[str]:
    """简单关键词提取。"""
    candidates = ["校园", "景区", "公园", "博物馆", "杭州", "西湖", "图书馆", "食堂", "咖啡"]
    found = [kw for kw in candidates if kw in requirement]
    return found if found else [requirement[:4]]


def _extract_interests(requirement: str) -> list[str]:
    interests = []
    if any(w in requirement for w in ["拍照", "摄影", "好看"]):
        interests.append("拍照")
    if any(w in requirement for w in ["美食", "好吃", "吃", "甜品", "咖啡"]):
        interests.append("美食")
    if any(w in requirement for w in ["文化", "历史", "博物馆"]):
        interests.append("文化")
    if any(w in requirement for w in ["轻松", "休闲", "散步"]):
        interests.append("休闲")
    return interests


def _infer_hours(requirement: str) -> float:
    if "半天" in requirement:
        return 4
    if "一天" in requirement or "一日" in requirement:
        return 8
    if "两天" in requirement:
        return 16
    return 4


def _infer_minutes(requirement: str) -> int:
    if "半天" in requirement:
        return 180
    if "一天" in requirement or "一日" in requirement:
        return 360
    return 180


def _build_summary(requirement: str, places: list[dict[str, Any]], route: dict[str, Any]) -> str:
    count = len(places)
    names = [p.get("name", "未知") for p in places[:3] if p.get("name")]
    dist = route.get("totalDistance", 0)
    return f"为你规划了一条{'半天' if _infer_hours(requirement) <= 4 else '一日'}路线，共 {count} 个地点（{' → '.join(names)}），总路程约 {dist:.0f}m"


def _build_itinerary_items(places: list[dict[str, Any]], total_hours: float) -> list[dict[str, Any]]:
    if not places:
        return []
    minutes_per = max(40, int(total_hours * 60 / len(places)))
    items = []
    start_h, start_m = 9, 0
    for p in places:
        h, m = divmod(start_h * 60 + start_m, 60)
        items.append({
            "time": f"{h:02d}:{m:02d}",
            "placeId": p.get("id", ""),
            "placeName": p.get("name", "未知"),
            "reason": p.get("description", "")[:60] if p.get("description") else "推荐停留",
            "stayMinutes": min(minutes_per, 90),
        })
        start_m += minutes_per
        if start_m >= 60:
            start_h += start_m // 60
            start_m = start_m % 60
    return items
