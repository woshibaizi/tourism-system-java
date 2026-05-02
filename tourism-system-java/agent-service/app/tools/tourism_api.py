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
        """
        拉取少量场所数据作为闲聊兜底提示。

        这里只读调用，不带鉴权；如果 Java 服务不可用，直接降级为空列表。
        """
        query = urlencode({"page": 1, "size": size})
        try:
            payload = self._get_json(f"/api/places?{query}")
        except URLError:
            return []

        records = payload.get("data", {}).get("records")
        if isinstance(records, list):
            return records
        return []

    def _get_json(self, path: str) -> dict[str, Any]:
        """执行最轻量的 GET 请求并解析 JSON。"""
        request = Request(f"{self.base_url}{path}", headers={"Accept": "application/json"})
        with urlopen(request, timeout=self.timeout_ms / 1000) as response:
            return json.loads(response.read().decode("utf-8"))


tourism_api_client = TourismApiClient()
