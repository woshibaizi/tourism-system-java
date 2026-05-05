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
