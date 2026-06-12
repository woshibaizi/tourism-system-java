"""
小红书内容抓取工具 — 按需刷新景点热度数据。

用法:
    from app.tools.xhs_scraper import refresh_place_xhs_data

    result = refresh_place_xhs_data(
        place_name="杭州西湖",
        place_id="place_001",
        place_type="scenic",
    )
    # → {"ok": True, "trending_score": 45200, "note_count": 87, ...}
"""

from __future__ import annotations

import json
import logging
from collections import Counter
from datetime import datetime, timedelta
from typing import Any

from app.skills.xhs_client import XHSClient

logger = logging.getLogger(__name__)

# ─── 关键词生成 ──────────────────────────────────────────────────────────────

TYPE_KEYWORDS: dict[str, list[str]] = {
    "general": ["攻略", "打卡", "值得去吗"],
    "food": ["美食", "必吃", "推荐"],
    "scenic": ["攻略", "拍照", "最佳时间"],
    "campus": ["攻略", "打卡", "参观"],
    "park": ["攻略", "打卡", "拍照"],
}


def generate_search_queries(place_name: str, place_type: str = "general") -> list[str]:
    """根据景点名和类型生成搜索关键词组。

    Args:
        place_name: 景点名，如 "杭州西湖"
        place_type: 景点类型 (general/food/scenic/campus/park)

    Returns:
        搜索关键词列表，最多 4 组
    """
    queries = [place_name]
    suffixes = TYPE_KEYWORDS.get(place_type, ["攻略", "打卡"])
    for suffix in suffixes[:3]:
        queries.append(f"{place_name} {suffix}")
    return queries


# ─── 热度计算 ────────────────────────────────────────────────────────────────


def calculate_trending_score(notes: list[dict[str, Any]]) -> int:
    """综合热度 = Σ(点赞×0.5 + 收藏×1.5 + 评论×1.0)

    收藏权重最高（代表"mark了以后去"）。
    """
    total = 0.0
    for note in notes:
        total += note.get("likes", 0) * 0.5
        total += note.get("collects", 0) * 1.5
        total += note.get("comments", 0) * 1.0
    return int(total)


def aggregate_tags(notes: list[dict[str, Any]], top_n: int = 10) -> list[str]:
    """从所有笔记的标签中统计 Top N 高频标签."""
    counter: Counter = Counter()
    for note in notes:
        for tag in note.get("tags", []):
            if tag:
                counter[tag] += 1
    return [tag for tag, _ in counter.most_common(top_n)]


def aggregate_keywords(notes: list[dict[str, Any]], top_n: int = 10) -> list[str]:
    """从标题中提取高频关键词."""
    counter: Counter = Counter()
    for note in notes:
        title = note.get("title", "")
        # 简单分词：按常见分隔符切分
        for seg in title.replace("｜", " ").replace("|", " ").replace("·", " ").split():
            seg = seg.strip().rstrip("。，！？,!?…").rstrip(")")
            if len(seg) >= 2 and len(seg) <= 8:
                counter[seg] += 1
    return [kw for kw, _ in counter.most_common(top_n)]


# ─── 核心抓取流程 ────────────────────────────────────────────────────────────


def refresh_place_xhs_data(
    place_name: str,
    place_id: str,
    place_type: str = "general",
    max_notes: int = 10,
) -> dict[str, Any]:
    """按需刷新单个景点的小红书热度数据。

    流程:
    1. 生成多组搜索关键词
    2. 每组搜 30 篇笔记
    3. 按 note_id 去重
    4. 计算 trending_score、聚合 top_tags
    5. 排序取 Top N
    6. 返回结构化结果

    Args:
        place_name: 景点名称
        place_id: 景点在系统中的 ID
        place_type: 景点类型
        max_notes: 存储的 Top N 笔记数

    Returns:
        {"ok": True, "place_id": "...", "trending_score": ..., "note_count": ..., "top_notes": [...], "top_tags": [...]}
    """
    client = XHSClient()

    # 1. 生成搜索关键词
    queries = generate_search_queries(place_name, place_type)
    logger.info("开始抓取 XHS 数据: place=%s, queries=%s", place_name, queries)

    # 2. 多路搜索
    all_notes: list[dict[str, Any]] = []
    for query in queries:
        result = client.search_notes(query, num=30, sort="popularity_descending")
        if not result.get("ok"):
            logger.warning("XHS 搜索失败: query=%s, error=%s", query, result.get("error"))
            continue
        notes = result.get("data", {}).get("notes", [])
        # 过滤掉幽灵笔记：没有标题且没有互动数据的空条目
        notes = [
            n for n in notes
            if n.get("title") or n.get("likes", 0) > 0 or n.get("collects", 0) > 0
        ]
        all_notes.extend(notes)
        logger.debug("搜索 '%s' → %d 条笔记", query, len(notes))

    if not all_notes:
        return {
            "ok": False,
            "error": "所有搜索词均无结果",
            "place_id": place_id,
        }

    # 3. 按 note_id 去重
    seen: set[str] = set()
    unique_notes: list[dict[str, Any]] = []
    for note in all_notes:
        nid = note.get("note_id", "")
        if nid and nid not in seen:
            seen.add(nid)
            unique_notes.append(note)

    logger.info("去重后: %d 条笔记 (原始 %d 条)", len(unique_notes), len(all_notes))

    # 4. 计算衍生数据
    trending_score = calculate_trending_score(unique_notes)
    top_tags = aggregate_tags(unique_notes)
    top_keywords = aggregate_keywords(unique_notes)

    # 5. 排序取 Top N
    sorted_notes = sorted(
        unique_notes, key=lambda n: n.get("likes", 0), reverse=True
    )[:max_notes]

    # 精简笔记字段（只存元数据，不存正文全文、不下载图片）
    top_notes = [
        {
            "note_id": n.get("note_id", ""),
            "note_type": n.get("note_type", "normal"),
            "title": n.get("title", ""),
            "desc": (n.get("desc", "") or "")[:200],
            "cover": n.get("cover", ""),         # 封面图 URL 字符串
            "likes": n.get("likes", 0),
            "collects": n.get("collects", 0),
            "comments": n.get("comments", 0),
            "url": n.get("url", ""),
            "author": n.get("author", {}),
            "tags": n.get("tags", []),
        }
        for n in sorted_notes
    ]

    return {
        "ok": True,
        "place_id": place_id,
        "place_name": place_name,
        "trending_score": trending_score,
        "note_count": len(unique_notes),
        "top_notes": top_notes,
        "top_tags": top_tags,
        "top_keywords": top_keywords,
        "search_queries": queries,
        "cache_expires": (datetime.now() + timedelta(days=7)).isoformat(),
        "last_updated": datetime.now().isoformat(),
    }


# ─── 便捷函数 ────────────────────────────────────────────────────────────────


# ─── 日记适配 ────────────────────────────────────────────────────────────────


def _adapt_diary_to_note_info(body: dict) -> tuple[dict | None, str | None]:
    """将日记数据适配为 XhsSkills post_note 需要的 noteInfo 结构。

    Args:
        body: {"title", "content", "tags", "images", "place_name", "videos"}

    Returns:
        (noteInfo, None) 成功, (None, error_message) 失败
    """
    try:
        tags = body.get("tags", [])
        if isinstance(tags, str):
            import json
            tags = json.loads(tags)

        image_urls = body.get("images", [])
        if isinstance(image_urls, str):
            import json
            image_urls = json.loads(image_urls)

        video_urls = body.get("videos", [])
        if isinstance(video_urls, str):
            import json
            video_urls = json.loads(video_urls)

        media_type = "video" if video_urls else "image"

        note_info = {
            "title": body.get("title", "旅行日记"),
            "desc": body.get("content", ""),
            "postTime": None,
            "location": body.get("place_name"),
            "type": 0,       # 公开
            "media_type": media_type,
            "topics": tags,
        }

        if media_type == "image":
            if not image_urls:
                return None, "没有图片可以发布"
            # 图片 URL → 下载为 bytes
            note_info["images"] = _download_images(image_urls)
        else:
            note_info["video"] = _download_single(video_urls[0])

        return note_info, None
    except Exception as e:
        return None, str(e)


def _download_images(urls: list[str]) -> list[bytes]:
    """从 Java 服务器下载图片为 bytes."""
    import requests
    images = []
    for url in urls[:18]:  # 小红书限制最多 18 张
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        images.append(resp.content)
    return images


def _download_single(url: str) -> bytes:
    """下载单个文件为 bytes."""
    import requests
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return resp.content


def quick_search(
    query: str,
    num: int = 10,
) -> dict[str, Any]:
    """快速搜索小红书笔记（供 Agent Tool 使用）。

    与 refresh_place_xhs_data 的区别：
    - 不做多关键词组合，直接搜一个 query
    - 不做去重/聚合/排序（只做精简字段提取）
    - 适合 Agent 对话中的实时搜索

    Returns:
        {"notes": [...], "total": N}
    """
    client = XHSClient()
    result = client.search_notes(query, num=num, sort="popularity_descending")

    if not result.get("ok"):
        return {"notes": [], "total": 0, "error": result.get("error", "unknown")}

    notes = result.get("data", {}).get("notes", [])
    return {
        "notes": notes[:num],
        "total": result.get("data", {}).get("total", len(notes)),
    }
