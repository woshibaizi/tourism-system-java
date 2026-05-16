from __future__ import annotations

import logging
from typing import Any

from app.tools.tourism_api import tourism_api_client

logger = logging.getLogger(__name__)


def build_diary_draft(
    prompt: str,
    images: list[str] | None = None,
    user_id: str = "anonymous",
    style: str = "小红书",
    place_id: str = "",
) -> dict[str, Any]:
    """
    创建日记草稿并持久化到 Java 后端。

    DiaryAgent 通过此函数将 LLM 生成的日记正文保存到 MySQL。
    """
    tags = _extract_tags(prompt)
    result = tourism_api_client.create_diary(
        title=prompt[:30] or "旅行日记",
        content=f"[{style}风格] {prompt}",
        user_id=user_id,
        images=images or [],
        tags=tags,
        place_id=place_id,
    )
    if result:
        return {"ok": True, "diary": result.get("data", result)}
    return {"ok": False, "error": "diary creation failed"}


def _extract_tags(prompt: str) -> list[str]:
    tags = []
    for kw in ["校园", "旅行", "美食", "拍照", "散步", "日记", "杭州", "西湖"]:
        if kw in prompt:
            tags.append(kw)
    return tags[:5] if tags else ["旅行", "日记"]
