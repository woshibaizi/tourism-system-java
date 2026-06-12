"""
XHSClient 单元测试

运行: cd agent-service && python -m pytest tests/test_xhs_client.py -v
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Ensure app is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "app"))

# ─── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _clear_module_cache():
    """每次测试前清除 XhsSkills 模块缓存，确保 mock 生效."""
    keys = list(sys.modules.keys())
    for k in keys:
        if any(
            prefix in k
            for prefix in (
                "apis.",
                "xhs_utils.",
                "app.skills.xhs_client",
            )
        ):
            del sys.modules[k]
    # 重置 XHSClient 的模块加载标志
    import app.skills.xhs_client as xc

    xc._modules_loaded = False
    xc._XHS_PC_APIS = None
    xc._XHS_CREATOR_APIS = None
    xc._trans_cookies = None


@pytest.fixture
def mock_runtime():
    """Mock XhsSkills vendored runtime 模块."""
    mock_pc = MagicMock()
    mock_pc.return_value = mock_pc  # XHS_Apis() 返回自身

    mock_creator = MagicMock()
    mock_creator.return_value = mock_creator

    mock_trans = MagicMock()
    mock_trans.return_value = {"a1": "test_a1_value"}

    with patch.dict(sys.modules, {
        "apis.xhs_pc_apis": MagicMock(XHS_Apis=mock_pc),
        "apis.xhs_creator_apis": MagicMock(XHS_Creator_Apis=mock_creator),
        "xhs_utils.cookie_util": MagicMock(trans_cookies=mock_trans),
    }):
        yield {
            "pc": mock_pc,
            "creator": mock_creator,
            "trans": mock_trans,
        }


@pytest.fixture
def client(mock_runtime):
    """创建 XHSClient 实例（带系统 cookie）."""
    from app.skills.xhs_client import XHSClient
    return XHSClient(cookies_str="a1=test; web_session=test")


# ─── Module Import ───────────────────────────────────────────────────────────


class TestModuleImport:
    """测试模块导入和初始化."""

    def test_import_success(self, mock_runtime):
        """验证模块能正常导入."""
        from app.skills.xhs_client import XHSClient

        assert XHSClient is not None

    def test_client_instantiation(self, mock_runtime):
        """验证客户端实例化."""
        from app.skills.xhs_client import XHSClient

        client = XHSClient(cookies_str="a1=test; web_session=test")
        assert client._default_cookies == "a1=test; web_session=test"

    def test_client_env_cookie(self, mock_runtime, monkeypatch):
        """验证从环境变量读取 Cookie."""
        monkeypatch.setenv("XHS_SYSTEM_COOKIES_STR", "env_cookie=test")
        from app.skills.xhs_client import XHSClient

        client = XHSClient()
        assert client._default_cookies == "env_cookie=test"


# ─── Method Listing ──────────────────────────────────────────────────────────


class TestMethodListing:
    """测试 list_methods."""

    def test_list_methods_returns_valid_structure(self, mock_runtime):
        """验证返回结构正确（mock 环境下方法数为 0 也符合结构约定）."""
        from app.skills.xhs_client import XHSClient

        result = XHSClient.list_methods()
        assert result["ok"] is True
        assert "pc" in result["data"]
        assert "creator" in result["data"]
        assert "total" in result["data"]
        assert isinstance(result["data"]["total"], int)

    def test_list_methods_each_has_name_and_params(self, mock_runtime):
        """验证每个方法都有 name 和 params."""
        from app.skills.xhs_client import XHSClient

        result = XHSClient.list_methods()
        for namespace in ["pc", "creator"]:
            for method in result["data"][namespace]:
                assert "name" in method
                assert "params" in method
                assert isinstance(method["params"], list)


# ─── Search Notes ────────────────────────────────────────────────────────────


class TestSearchNotes:
    """测试搜索笔记."""

    def test_search_no_cookie(self, mock_runtime):
        """无 Cookie 时应返回错误."""
        from app.skills.xhs_client import XHSClient

        client = XHSClient(cookies_str="")
        result = client.search_notes("test")
        assert result["ok"] is False
        assert result["code"] == "NO_COOKIE"

    def test_search_success(self, mock_runtime, client):
        """成功搜索的响应格式（图文笔记）."""
        mock_note = {
            "noteCard": {
                "noteId": "note_001",
                "type": "normal",
                "displayTitle": "测试笔记",
                "desc": "这是一篇测试笔记内容",
                "cover": {"urlDefault": "https://example.com/cover.jpg"},
                "interactInfo": {
                    "likedCount": 100,
                    "collectedCount": 50,
                    "commentCount": 10,
                },
                "user": {"nickname": "测试用户", "userId": "user_001"},
                "tagList": [{"name": "旅行"}, {"name": "攻略"}],
            }
        }
        client._pc.search_some_note.return_value = (True, "success", [mock_note])

        result = client.search_notes("测试")
        assert result["ok"] is True
        assert result["data"]["total"] == 1
        note = result["data"]["notes"][0]
        assert note["note_id"] == "note_001"
        assert note["title"] == "测试笔记"
        assert note["likes"] == 100
        assert note["note_type"] == "normal"

    def test_search_video_note_type(self, mock_runtime, client):
        """视频笔记应标记 note_type=video."""
        mock_note = {
            "noteCard": {
                "noteId": "note_video_001",
                "type": "video",
                "displayTitle": "西湖日落延时",
                "desc": "绝美日落",
                "cover": {"urlDefault": "https://example.com/video_cover.jpg"},
                "interactInfo": {
                    "likedCount": 8900,
                    "collectedCount": 3200,
                    "commentCount": 456,
                },
                "user": {"nickname": "摄影师小王", "userId": "user_099"},
                "tagList": [{"name": "西湖"}, {"name": "日落"}, {"name": "延时"}],
            }
        }
        client._pc.search_some_note.return_value = (True, "success", [mock_note])

        result = client.search_notes("西湖 日落")
        assert result["ok"] is True
        note = result["data"]["notes"][0]
        assert note["note_type"] == "video"
        assert note["cover"] == "https://example.com/video_cover.jpg"

    def test_search_api_error(self, mock_runtime, client):
        """API 返回失败时正确处理."""
        client._pc.search_some_note.return_value = (False, "搜索失败", None)

        result = client.search_notes("test")
        assert result["ok"] is False
        assert result["code"] == "SEARCH_FAILED"


# ─── Get Note Detail ─────────────────────────────────────────────────────────


class TestGetNoteDetail:
    """测试获取笔记详情."""

    def test_get_note_detail_no_cookie(self, mock_runtime):
        from app.skills.xhs_client import XHSClient

        client = XHSClient(cookies_str="")
        result = client.get_note_detail("https://www.xiaohongshu.com/explore/xxx")
        assert result["ok"] is False
        assert result["code"] == "NO_COOKIE"

    def test_get_note_detail_success(self, mock_runtime, client):
        client._pc.get_note_info.return_value = (True, "success", {"data": {}})

        result = client.get_note_detail(
            "https://www.xiaohongshu.com/explore/xxx?xsec_token=abc"
        )
        assert result["ok"] is True


# ─── Cookie Validation ───────────────────────────────────────────────────────


class TestCookieValidation:
    """测试 Cookie 验证."""

    def test_validate_no_cookie(self, mock_runtime):
        from app.skills.xhs_client import XHSClient

        client = XHSClient(cookies_str="")
        result = client.validate_cookie()
        assert result["ok"] is False
        assert result["code"] == "NO_COOKIE"

    def test_validate_invalid_cookie(self, mock_runtime, client):
        client._pc.get_user_self_info.return_value = (False, "登录过期", None)

        result = client.validate_cookie("invalid_cookie")
        assert result["ok"] is False
        assert result["code"] == "INVALID_COOKIE"

    def test_validate_success(self, mock_runtime, client):
        client._pc.get_user_self_info.return_value = (
            True,
            "success",
            {"data": {"id": "user_xhs_001", "nickname": "测试用户", "avatar": ""}},
        )

        result = client.validate_cookie("valid_cookie")
        assert result["ok"] is True
        assert result["data"]["xhs_username"] == "测试用户"


# ─── Publish Note ────────────────────────────────────────────────────────────


class TestPublishNote:
    """测试发布笔记."""

    def test_publish_no_cookie(self, mock_runtime):
        from app.skills.xhs_client import XHSClient

        client = XHSClient()
        result = client.publish_note({}, "")
        assert result["ok"] is False
        assert result["code"] == "NO_COOKIE"

    def test_publish_success(self, mock_runtime, client):
        client._creator.post_note.return_value = (
            True,
            "发布成功",
            {"data": {"note_id": "note_pub_001"}},
        )

        note_info = {
            "title": "测试标题",
            "desc": "测试正文",
            "type": 0,
            "media_type": "image",
            "topics": ["旅行"],
            "images": [b"fake_image_bytes"],
        }
        result = client.publish_note(note_info, "valid_cookie")
        assert result["ok"] is True
        assert result["data"]["note_id"] == "note_pub_001"

    def test_publish_api_error(self, mock_runtime, client):
        client._creator.post_note.return_value = (False, "内容违规", None)

        result = client.publish_note({"title": "test"}, "valid_cookie")
        assert result["ok"] is False
        assert result["code"] == "PUBLISH_FAILED"
        assert "内容违规" in result["error"]


# ─── No Watermark ────────────────────────────────────────────────────────────


class TestNoWatermark:
    """测试去水印."""

    def test_image_no_watermark(self, mock_runtime, client):
        client._pc.get_note_no_water_img.return_value = (
            True,
            "成功",
            "https://ci.xiaohongshu.com/clean_img.jpg",
        )

        result = client.get_no_watermark_image(
            "https://sns-webpic-qc.xhscdn.com/xxx.jpg"
        )
        assert result["ok"] is True
        assert "ci.xiaohongshu.com" in result["data"]["url"]

    def test_video_no_watermark(self, mock_runtime, client):
        client._pc.get_note_no_water_video.return_value = (
            True,
            "成功",
            "https://example.com/video.mp4",
        )

        result = client.get_no_watermark_video("note_001")
        assert result["ok"] is True
        assert result["data"]["url"]


# ─── Error Response Format ───────────────────────────────────────────────────


class TestErrorResponseFormat:
    """验证所有错误响应格式一致."""

    def test_error_has_required_fields(self, mock_runtime):
        from app.skills.xhs_client import XHSClient

        client = XHSClient(cookies_str="")
        result = client.search_notes("test")

        assert "ok" in result
        assert result["ok"] is False
        assert "error" in result
        assert "code" in result
        assert "retryable" in result
        assert isinstance(result["retryable"], bool)
