"""
小红书 Agent Tool — 注册到 ToolRegistry，供对话式 AI 调用。

工具:
    xiaohongshu_search_notes — 实时搜索小红书热门笔记
"""

from __future__ import annotations

import logging

from app.tools.registry import registry
from app.tools.xhs_scraper import quick_search

logger = logging.getLogger(__name__)


def register_xhs_tools() -> None:
    """将小红书相关工具注册到全局 ToolRegistry。"""
    registry.register(
        name="xiaohongshu_search_notes",
        description=(
            "搜索小红书上的热门笔记。"
            "当用户询问某个地点的最新玩法、当前热度、拍照机位、探店攻略时使用此工具。"
            "此工具返回实时搜索结果，适合回答时效性问题。"
        ),
        parameters={
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "搜索关键词，建议使用 '地点名 + 关键词' 格式，如 '杭州西湖 攻略'",
                },
                "num": {
                    "type": "integer",
                    "description": "返回笔记数量，默认 10，最大 20",
                    "default": 10,
                },
            },
            "required": ["query"],
        },
        agent_name="discover",
    )(xiaohongshu_search_notes_fn)

    logger.info("XHS Agent tools registered: xiaohongshu_search_notes")


def xiaohongshu_search_notes_fn(query: str, num: int = 10) -> str:
    """Tool 函数 — 搜索小红书笔记并返回 JSON 字符串。"""
    import json

    num = min(num, 20)  # 上限 20 条
    result = quick_search(query, num=num)

    if result.get("error"):
        return json.dumps(
            {
                "error": result["error"],
                "notes": result.get("notes", []),
                "total": 0,
            },
            ensure_ascii=False,
        )

    return json.dumps(
        {
            "notes": result["notes"][:num],
            "total": result["total"],
        },
        ensure_ascii=False,
    )
