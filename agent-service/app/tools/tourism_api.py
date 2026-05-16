from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.config import settings


@dataclass
class TourismApiClient:
    """最小 Java 主系统客户端，供 Python agent 拉取基础业务数据。"""

    base_url: str = settings.backend_base_url
    timeout_ms: int = settings.backend_timeout_ms

    # ==================== 场所 ====================

    def get_places(self, size: int = 6) -> list[dict[str, Any]]:
        query = urlencode({"page": 1, "size": size})
        try:
            payload = self._get_json(f"/api/places?{query}")
        except URLError:
            return []
        records = payload.get("data", {}).get("records")
        if isinstance(records, list):
            return records
        return []

    def search_places(self, keyword: str, place_type: str | None = None) -> list[dict[str, Any]]:
        """搜索场所，支持关键词和类型筛选。"""
        params: dict[str, Any] = {"keyword": keyword}
        if place_type:
            params["type"] = place_type
        query = urlencode(params)
        try:
            payload = self._get_json(f"/api/places/search?{query}")
        except URLError:
            return []
        data = payload.get("data")
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "records" in data:
            return data["records"]
        return []

    def get_place_detail(self, place_id: str) -> dict[str, Any]:
        """获取场所详情。"""
        try:
            payload = self._get_json(f"/api/places/{place_id}")
        except URLError:
            return {}
        return payload.get("data", {})

    def recommend_places(self, preferences: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        """基于偏好推荐场所。"""
        body = json.dumps(preferences or {}).encode("utf-8")
        try:
            payload = self._post_json("/api/places/recommend", body)
        except URLError:
            return []
        data = payload.get("data")
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "records" in data:
            return data["records"]
        return []

    def get_hot_places(self, size: int = 10) -> list[dict[str, Any]]:
        """获取热门场所。"""
        query = urlencode({"size": size})
        try:
            payload = self._get_json(f"/api/places/hot?{query}")
        except URLError:
            return []
        data = payload.get("data")
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "records" in data:
            return data["records"]
        return []

    # ==================== 导航 ====================

    def plan_route_single(
        self, from_id: str, to_id: str, strategy: str = "shortest"
    ) -> dict[str, Any]:
        """单目标最短路径规划。"""
        body = json.dumps({
            "sourceId": from_id,
            "targetId": to_id,
            "strategy": strategy,
        }).encode("utf-8")
        try:
            payload = self._post_json("/api/navigation/shortest-path", body)
        except URLError:
            return {}
        return payload.get("data", {})

    def plan_route_multi(
        self, place_ids: list[str], strategy: str = "nearest_neighbor"
    ) -> dict[str, Any]:
        """多目标路径规划 (TSP)。"""
        body = json.dumps({
            "placeIds": place_ids,
            "strategy": strategy,
        }).encode("utf-8")
        try:
            payload = self._post_json("/api/navigation/multi-destination", body)
        except URLError:
            return {}
        return payload.get("data", {})

    # ==================== 美食 ====================

    def get_foods(self, size: int = 10) -> list[dict[str, Any]]:
        """获取美食列表。"""
        query = urlencode({"page": 1, "size": size})
        try:
            payload = self._get_json(f"/api/foods?{query}")
        except URLError:
            return []
        records = payload.get("data", {}).get("records")
        if isinstance(records, list):
            return records
        return []

    def get_foods_by_place(self, place_id: str) -> list[dict[str, Any]]:
        """获取指定场所附近的美食。"""
        try:
            payload = self._get_json(f"/api/foods/place/{place_id}")
        except URLError:
            return []
        data = payload.get("data")
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "records" in data:
            return data["records"]
        return []

    def get_hot_foods(self, size: int = 10) -> list[dict[str, Any]]:
        """获取热门美食。"""
        query = urlencode({"size": size})
        try:
            payload = self._get_json(f"/api/foods/popular?{query}")
        except URLError:
            return []
        data = payload.get("data")
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "records" in data:
            return data["records"]
        return []

    def get_foods_by_cuisine(self, cuisine: str) -> list[dict[str, Any]]:
        """按菜系查询美食。"""
        try:
            payload = self._get_json(f"/api/foods/cuisine/{cuisine}")
        except URLError:
            return []
        data = payload.get("data")
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "records" in data:
            return data["records"]
        return []

    # ==================== 设施 ====================

    def get_facilities_by_place(self, place_id: str) -> list[dict[str, Any]]:
        """获取指定场所的设施列表。"""
        try:
            payload = self._get_json(f"/api/facilities/place/{place_id}")
        except URLError:
            return []
        data = payload.get("data")
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "records" in data:
            return data["records"]
        return []

    def get_nearest_facilities(
        self, lat: float, lng: float, facility_type: str | None = None
    ) -> list[dict[str, Any]]:
        """获取最近设施 (LBS)。"""
        body = json.dumps({
            "latitude": lat,
            "longitude": lng,
            "type": facility_type,
        }).encode("utf-8")
        try:
            payload = self._post_json("/api/facilities/nearest", body)
        except URLError:
            return []
        data = payload.get("data")
        if isinstance(data, list):
            return data
        return []

    # ==================== 用户行为 ====================

    def get_user_behavior(self, user_id: str) -> dict[str, Any]:
        """获取用户行为数据（浏览/偏好）。"""
        try:
            payload = self._get_json(f"/api/users/{user_id}/behavior")
        except URLError:
            return {}
        return payload.get("data", {})

    def get_user_ratings(self, user_id: str) -> list[dict[str, Any]]:
        """获取用户评分记录。"""
        try:
            payload = self._get_json(f"/api/users/{user_id}/ratings")
        except URLError:
            return []
        data = payload.get("data")
        if isinstance(data, list):
            return data
        return []

    # ==================== 统计 ====================

    def get_stats(self) -> dict[str, Any]:
        """获取系统统计数据。"""
        try:
            payload = self._get_json("/api/stats")
        except URLError:
            return {}
        return payload.get("data", {})

    # ==================== 日记 ====================

    def create_diary(
        self,
        title: str,
        content: str,
        user_id: str,
        images: list[str] | None = None,
        tags: list[str] | None = None,
        place_id: str = "",
    ) -> dict[str, Any]:
        """调用 Java 后端创建旅行日记。"""
        body = json.dumps({
            "title": title,
            "content": content,
            "authorId": user_id,
            "images": images or [],
            "tags": tags or [],
            "placeId": place_id,
        }).encode("utf-8")
        try:
            return self._post_json("/api/diaries", body)
        except URLError:
            return {}

    # ==================== 内部 HTTP ====================

    def _get_json(self, path: str) -> dict[str, Any]:
        request = Request(f"{self.base_url}{path}", headers={"Accept": "application/json"})
        with urlopen(request, timeout=self.timeout_ms / 1000) as response:
            return json.loads(response.read().decode("utf-8"))

    def _post_json(self, path: str, body: bytes) -> dict[str, Any]:
        request = Request(
            f"{self.base_url}{path}",
            data=body,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        with urlopen(request, timeout=self.timeout_ms / 1000) as response:
            return json.loads(response.read().decode("utf-8"))


tourism_api_client = TourismApiClient()
