"""
XHS 抓取工具单元测试

运行: cd agent-service && python -m pytest tests/test_xhs_scraper.py -v
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "app"))


@pytest.fixture
def mock_xhs_client():
    """Mock XHSClient 返回混合图文+视频笔记."""
    mock_notes = []
    for i in range(25):
        mock_notes.append({
            "note_id": f"note_{i:03d}",
            "note_type": "video" if i < 5 else "normal",  # 前 5 篇为视频
            "title": f"测试笔记 {i} 西湖攻略 打卡 美食",
            "desc": f"这是一篇测试笔记描述 {i}",
            "cover": f"https://example.com/cover_{i}.jpg",
            "likes": 10000 - i * 300,
            "collects": 5000 - i * 150,
            "comments": 500 - i * 15,
            "url": f"https://www.xiaohongshu.com/explore/note_{i:03d}",
            "author": {"name": f"用户{i}", "id": f"user_{i}"},
            "tags": ["西湖", "攻略", "打卡", "杭州旅游", f"标签{i}"],
        })

    with patch("app.tools.xhs_scraper.XHSClient") as mock_cls:
        mock_instance = MagicMock()
        mock_instance.search_notes.return_value = {
            "ok": True,
            "data": {"notes": mock_notes, "total": len(mock_notes)},
        }
        mock_cls.return_value = mock_instance
        yield mock_instance


class TestGenerateSearchQueries:
    def test_general_type(self):
        from app.tools.xhs_scraper import generate_search_queries
        queries = generate_search_queries("杭州西湖", "general")
        assert "杭州西湖" in queries
        assert "杭州西湖 攻略" in queries
        assert len(queries) <= 4

    def test_scenic_type(self):
        from app.tools.xhs_scraper import generate_search_queries
        queries = generate_search_queries("黄山", "scenic")
        assert "黄山 拍照" in queries

    def test_food_type(self):
        from app.tools.xhs_scraper import generate_search_queries
        queries = generate_search_queries("知味观", "food")
        assert "知味观 美食" in queries


class TestTrendingScore:
    def test_calculate(self):
        from app.tools.xhs_scraper import calculate_trending_score
        notes = [
            {"likes": 100, "collects": 50, "comments": 10},
            {"likes": 200, "collects": 30, "comments": 5},
        ]
        score = calculate_trending_score(notes)
        expected = int(100 * 0.5 + 50 * 1.5 + 10 * 1.0 + 200 * 0.5 + 30 * 1.5 + 5 * 1.0)
        assert score == expected

    def test_empty(self):
        from app.tools.xhs_scraper import calculate_trending_score
        assert calculate_trending_score([]) == 0


class TestAggregateTags:
    def test_aggregate(self):
        from app.tools.xhs_scraper import aggregate_tags
        notes = [
            {"tags": ["西湖", "攻略"]},
            {"tags": ["西湖", "打卡"]},
            {"tags": ["西湖", "美食"]},
        ]
        tags = aggregate_tags(notes, top_n=3)
        assert tags[0] == "西湖"
        assert len(tags) == 3

    def test_empty_tags(self):
        from app.tools.xhs_scraper import aggregate_tags
        assert aggregate_tags([]) == []


class TestRefreshPlaceXhsData:
    def test_success_flow(self, mock_xhs_client):
        from app.tools.xhs_scraper import refresh_place_xhs_data

        result = refresh_place_xhs_data(
            place_name="杭州西湖",
            place_id="place_001",
            place_type="scenic",
            max_notes=10,
        )

        assert result["ok"] is True
        assert result["place_id"] == "place_001"
        assert result["note_count"] == 25  # 25 unique notes
        assert result["trending_score"] > 0
        assert len(result["top_notes"]) == 10
        assert len(result["top_tags"]) > 0
        assert "trending_score" in result
        assert "cache_expires" in result

    def test_deduplication(self, mock_xhs_client):
        """验证去重 — 4 组关键词返回相同笔记，去重后只保留 1 份."""
        from app.tools.xhs_scraper import refresh_place_xhs_data
        result = refresh_place_xhs_data("test", "place_test", max_notes=20)
        assert result["note_count"] == 25  # 25 unique, not 100

    def test_empty_results(self, mock_xhs_client):
        """所有搜索均无结果."""
        mock_xhs_client.search_notes.return_value = {
            "ok": True,
            "data": {"notes": [], "total": 0},
        }
        from app.tools.xhs_scraper import refresh_place_xhs_data
        result = refresh_place_xhs_data("不存在的地点", "place_xxx")
        assert result["ok"] is False
        assert "error" in result

    def test_video_notes_preserved_in_top_notes(self, mock_xhs_client):
        """视频笔记的 note_type 应正确传递到 top_notes."""
        from app.tools.xhs_scraper import refresh_place_xhs_data
        result = refresh_place_xhs_data("西湖", "place_test", max_notes=10)
        assert result["ok"] is True
        # 前 5 篇是视频笔记（likes 最高），应在 top_notes 中
        video_count = sum(1 for n in result["top_notes"] if n["note_type"] == "video")
        normal_count = sum(1 for n in result["top_notes"] if n["note_type"] == "normal")
        assert video_count == 5
        assert normal_count == 5
        # 验证视频笔记封面 URL 正常
        for n in result["top_notes"]:
            assert n["cover"].startswith("https://example.com/cover_")


class TestQuickSearch:
    def test_quick_search(self, mock_xhs_client):
        from app.tools.xhs_scraper import quick_search
        result = quick_search("西湖", num=5)
        assert result["total"] == 25
        assert len(result["notes"]) == 5

    def test_quick_search_error(self, mock_xhs_client):
        mock_xhs_client.search_notes.return_value = {
            "ok": False,
            "error": "网络错误",
        }
        from app.tools.xhs_scraper import quick_search
        result = quick_search("test")
        assert result["total"] == 0
        assert "error" in result
