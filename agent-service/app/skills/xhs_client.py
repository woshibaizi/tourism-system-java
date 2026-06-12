"""
XHSClient — 封装 XhsSkills 的 PC 端和 Creator 端 API，提供统一接口。

用法:
    from app.skills.xhs_client import XHSClient

    client = XHSClient()
    # 系统级 Cookie（只读公开数据）
    client = XHSClient(cookies_str=os.getenv("XHS_SYSTEM_COOKIES_STR"))

    # 搜索笔记
    result = client.search_notes("杭州西湖", num=20)
    # → {"ok": True, "notes": [...], "total": 120}

    # 获取笔记详情
    result = client.get_note_detail("https://www.xiaohongshu.com/explore/xxx?...")

    # 发布笔记（需要用户级 Cookie）
    result = client.publish_note(note_info={...}, cookies_str="...")

    # 验证 Cookie
    result = client.validate_cookie("a1=...; web_session=...")
    # → {"ok": True, "xhs_user_id": "...", "xhs_username": "..."}
"""

from __future__ import annotations

import json
import logging
import os
import sys
import threading
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ─── 定位 XhsSkills vendored runtime ────────────────────────────────────────
_SKILLS_DIR = Path(__file__).resolve().parent.parent.parent.parent  # agent-service/
_XHS_SCRIPTS_DIR = (
    _SKILLS_DIR.parent / "XhsSkills" / "skills" / "xhs-apis" / "scripts"
)
_XHS_RUNTIME_ROOT = _XHS_SCRIPTS_DIR / "runtime" / "spider_xhs_core"

_import_lock = threading.Lock()
_modules_loaded = False
_XHS_PC_APIS = None
_XHS_CREATOR_APIS = None
_trans_cookies = None


def _ensure_runtime_imported():
    """延迟导入 XhsSkills vendored runtime（线程安全）."""
    global _modules_loaded, _XHS_PC_APIS, _XHS_CREATOR_APIS, _trans_cookies

    if _modules_loaded:
        return

    with _import_lock:
        if _modules_loaded:
            return

        if not _XHS_RUNTIME_ROOT.exists():
            msg = (
                f"XhsSkills runtime not found at {_XHS_RUNTIME_ROOT}. "
                "Make sure XhsSkills is cloned to the parent directory of agent-service."
            )
            logger.error(msg)
            raise RuntimeError(msg)

        # 设置 NODE_PATH 让 execjs 找到 node_modules
        node_modules = _XHS_SCRIPTS_DIR / "node_modules"
        if node_modules.exists():
            existing = os.environ.get("NODE_PATH", "")
            os.environ["NODE_PATH"] = (
                str(node_modules)
                + (os.pathsep + existing if existing else "")
            )

        # 切换工作目录到 runtime 以便 execjs (Node.js) 能正确解析
        # ./static/ 下的 JS 文件相对路径。此切换为持久性的 —
        # 因为 JS 代码在后续 API 调用时才会通过 execjs 执行。
        os.chdir(str(_XHS_RUNTIME_ROOT))
        if str(_XHS_RUNTIME_ROOT) not in sys.path:
            sys.path.insert(0, str(_XHS_RUNTIME_ROOT))

        try:
            from apis.xhs_pc_apis import XHS_Apis
            from apis.xhs_creator_apis import XHS_Creator_Apis
            from xhs_utils.cookie_util import trans_cookies

            _XHS_PC_APIS = XHS_Apis
            _XHS_CREATOR_APIS = XHS_Creator_Apis
            _trans_cookies = trans_cookies
        except ImportError as e:
            msg = (
                f"Failed to import XhsSkills runtime modules: {e}. "
                "Ensure pip dependencies are installed: "
                "pip install execjs requests pycryptodome lxml beautifulsoup4"
            )
            logger.error(msg)
            raise RuntimeError(msg) from e

        _modules_loaded = True
        logger.info("XhsSkills runtime imported from %s", _XHS_RUNTIME_ROOT)


# ─── 辅助函数 ────────────────────────────────────────────────────────────────


def _ok(data: Any = None, **extra) -> dict[str, Any]:
    """构建统一成功响应."""
    result: dict[str, Any] = {"ok": True}
    if data is not None:
        result["data"] = data
    result.update(extra)
    return result


def _to_int(value: Any) -> int:
    """安全转换为 int，兼容 XHS API 返回的字符串类型."""
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str) and value.strip():
        try:
            return int(value)
        except (ValueError, TypeError):
            pass
    return 0


def _err(error: str, code: str = "UNKNOWN", retryable: bool = False) -> dict[str, Any]:
    """构建统一错误响应."""
    return {
        "ok": False,
        "error": error,
        "code": code,
        "retryable": retryable,
    }


# ─── XHSClient ───────────────────────────────────────────────────────────────


class XHSClient:
    """封装 XhsSkills PC + Creator API 的统一客户端。

    支持两种 Cookie 级别：
    1. 系统 Cookie（.env XHS_SYSTEM_COOKIES_STR）— 只读操作
    2. 用户 Cookie（方法参数 cookies_str）— 发布操作
    """

    def __init__(self, cookies_str: str | None = None):
        """初始化客户端。

        Args:
            cookies_str: 默认使用的 Cookie 字符串。
                         为 None 时从环境变量 XHS_SYSTEM_COOKIES_STR 读取。
        """
        _ensure_runtime_imported()
        self._default_cookies = cookies_str or os.getenv(
            "XHS_SYSTEM_COOKIES_STR", ""
        )
        self._pc = _XHS_PC_APIS()
        self._creator = _XHS_CREATOR_APIS()
        self._trans = _trans_cookies

    @property
    def default_cookies(self) -> str:
        return self._default_cookies

    # ── Cookie 验证 ────────────────────────────────────────────────────

    def validate_cookie(
        self, cookies_str: str | None = None
    ) -> dict[str, Any]:
        """验证 Cookie 是否有效。

        先尝试 v2 接口 (/api/sns/web/v2/user/me)，失败则回退 v1
        (/api/sns/web/v1/user/selfinfo)，返回小红书用户信息。
        """
        try:
            ck = cookies_str or self._default_cookies
            if not ck:
                return _err("未提供 Cookie", code="NO_COOKIE")

            # 优先尝试 v2 接口（权限要求更宽松）
            success, msg, data = self._pc.get_user_self_info2(ck)
            if not success:
                logger.info("v2 validation failed (%s), trying v1 fallback", msg)
                # 回退到 v1 接口
                success, msg, data = self._pc.get_user_self_info(ck)
            if not success:
                return _err(f"Cookie 无效: {msg}", code="INVALID_COOKIE")
            user = (data or {}).get("data", {})
            return _ok({
                "xhs_user_id": user.get("id", ""),
                "xhs_username": user.get("nickname", ""),
                "xhs_avatar": user.get("avatar", ""),
            })
        except Exception as e:
            logger.exception("validate_cookie failed")
            return _err(str(e), code="VALIDATION_ERROR")

    # ── 搜索 ───────────────────────────────────────────────────────────

    def search_notes(
        self,
        query: str,
        num: int = 20,
        sort: str = "popularity_descending",
        note_type: str = "all",
        cookies_str: str | None = None,
    ) -> dict[str, Any]:
        """搜索小红书笔记。

        Args:
            query: 搜索关键词
            num: 返回数量
            sort: 排序方式 (general/time/popularity/comment/collect_descending)
            note_type: 笔记类型 (all/video/normal)
            cookies_str: 覆盖默认 Cookie

        Returns:
            {"ok": True, "notes": [...], "total": N}
        """
        sort_map = {
            "general": 0,
            "time_descending": 1,
            "popularity_descending": 2,
            "comment_descending": 3,
            "collect_descending": 4,
        }
        note_type_map = {"all": 0, "video": 1, "normal": 2}

        try:
            ck = cookies_str or self._default_cookies
            if not ck:
                return _err("未提供 Cookie", code="NO_COOKIE")

            success, msg, notes = self._pc.search_some_note(
                query,
                num,
                ck,
                sort_type_choice=sort_map.get(sort, 0),
                note_type=note_type_map.get(note_type, 0),
            )

            if not success:
                return _err(msg, code="SEARCH_FAILED")

            # 提取标准化字段
            extracted = []
            for n in (notes or []):
                # XHS API 返回结构:
                #   item["id"]          → note_id (顶层!)
                #   item["xsec_token"]  → xsec_token (顶层!)
                #   item["note_card"]   → 真实数据 (display_title, interact_info, user, cover...)
                # 注意: note_card 内部没有 id 字段, note_id 在 item 顶层
                if not isinstance(n, dict):
                    continue

                card = n.get("note_card", {}) or {}
                if not isinstance(card, dict):
                    card = {}

                # note_id 在顶层 item["id"]; fallback 到 card 内部
                note_id = n.get("id", "") or card.get("note_id", "")
                xsec_token = n.get("xsec_token", "")
                interact = card.get("interact_info", {}) or {}
                user = card.get("user", {}) or {}
                cover = card.get("cover", {}) or {}
                tags_raw = card.get("tag_list", []) or card.get("tags", []) or []

                extracted.append({
                    "note_id": note_id,
                    "note_type": "video" if card.get("type") == "video" else "normal",
                    "title": card.get("display_title", ""),
                    "desc": (card.get("desc", "") or "")[:200],
                    "cover": cover.get("url_default", cover.get("url", "")),
                    "likes": _to_int(interact.get("liked_count", interact.get("likedCount", 0))),
                    "collects": _to_int(interact.get("collected_count", interact.get("collectedCount", 0))),
                    "comments": _to_int(interact.get("comment_count", interact.get("commentCount", 0))),
                    "url": f"https://www.xiaohongshu.com/explore/{note_id}?xsec_token={xsec_token}" if note_id and xsec_token else f"https://www.xiaohongshu.com/explore/{note_id}" if note_id else "",
                    "author": {
                        "name": user.get("nickname", user.get("nick_name", "")),
                        "user_id": user.get("user_id", user.get("userId", "")),
                    },
                    "tags": [
                        t.get("name", t.get("tag_name", "")) if isinstance(t, dict) else str(t)
                        for t in tags_raw
                    ],
                })

            return _ok({"notes": extracted, "total": len(extracted)})
        except Exception as e:
            logger.exception("search_notes failed for query=%s", query)
            return _err(str(e), code="SEARCH_ERROR")

    def search_keywords(self, word: str, cookies_str: str | None = None) -> dict[str, Any]:
        """获取搜索关键词联想."""
        try:
            ck = cookies_str or self._default_cookies
            if not ck:
                return _err("未提供 Cookie", code="NO_COOKIE")
            success, msg, data = self._pc.get_search_keyword(word, ck)
            if not success:
                return _err(msg, code="SEARCH_KEYWORD_FAILED")
            return _ok(data)
        except Exception as e:
            logger.exception("search_keywords failed")
            return _err(str(e), code="SEARCH_KEYWORD_ERROR")

    # ── 笔记详情 ───────────────────────────────────────────────────────

    def get_note_detail(
        self, url: str, cookies_str: str | None = None
    ) -> dict[str, Any]:
        """获取笔记详情（含正文、图片、评论数等）。

        Args:
            url: 笔记 URL，如 https://www.xiaohongshu.com/explore/xxx?xsec_token=...
            cookies_str: 覆盖默认 Cookie

        Returns:
            {"ok": True, "note": {...}}
        """
        try:
            ck = cookies_str or self._default_cookies
            if not ck:
                return _err("未提供 Cookie", code="NO_COOKIE")
            success, msg, data = self._pc.get_note_info(url, ck)
            if not success:
                return _err(msg, code="GET_NOTE_FAILED")
            return _ok(data)
        except Exception as e:
            logger.exception("get_note_detail failed for url=%s", url)
            return _err(str(e), code="GET_NOTE_ERROR")

    def get_note_comments(
        self, url: str, cookies_str: str | None = None
    ) -> dict[str, Any]:
        """获取笔记全部评论（含一级和二级评论）."""
        try:
            ck = cookies_str or self._default_cookies
            if not ck:
                return _err("未提供 Cookie", code="NO_COOKIE")
            success, msg, comments = self._pc.get_note_all_comment(url, ck)
            if not success:
                return _err(msg, code="GET_COMMENTS_FAILED")
            return _ok({"comments": comments, "total": len(comments or [])})
        except Exception as e:
            logger.exception("get_note_comments failed")
            return _err(str(e), code="GET_COMMENTS_ERROR")

    # ── 用户 ───────────────────────────────────────────────────────────

    def get_user_info(
        self, user_id: str, cookies_str: str | None = None
    ) -> dict[str, Any]:
        """获取小红书用户信息."""
        try:
            ck = cookies_str or self._default_cookies
            if not ck:
                return _err("未提供 Cookie", code="NO_COOKIE")
            success, msg, data = self._pc.get_user_info(user_id, ck)
            if not success:
                return _err(msg, code="GET_USER_FAILED")
            return _ok(data)
        except Exception as e:
            logger.exception("get_user_info failed")
            return _err(str(e), code="GET_USER_ERROR")

    def get_user_notes(
        self, user_url: str, cookies_str: str | None = None
    ) -> dict[str, Any]:
        """获取用户全部笔记."""
        try:
            ck = cookies_str or self._default_cookies
            if not ck:
                return _err("未提供 Cookie", code="NO_COOKIE")
            success, msg, notes = self._pc.get_user_all_notes(user_url, ck)
            if not success:
                return _err(msg, code="GET_USER_NOTES_FAILED")
            return _ok({"notes": notes, "total": len(notes or [])})
        except Exception as e:
            logger.exception("get_user_notes failed")
            return _err(str(e), code="GET_USER_NOTES_ERROR")

    # ── 无水印资源 ────────────────────────────────────────────────────

    def get_no_watermark_image(self, img_url: str) -> dict[str, Any]:
        """获取去水印图片 URL."""
        try:
            success, msg, url = self._pc.get_note_no_water_img(img_url)
            if not success:
                return _err(msg, code="NO_WATERMARK_FAILED")
            return _ok({"url": url})
        except Exception as e:
            logger.exception("get_no_watermark_image failed")
            return _err(str(e), code="NO_WATERMARK_ERROR")

    def get_no_watermark_video(self, note_id: str) -> dict[str, Any]:
        """获取去水印视频 URL."""
        try:
            success, msg, url = self._pc.get_note_no_water_video(note_id)
            if not success:
                return _err(msg, code="NO_WATERMARK_FAILED")
            return _ok({"url": url})
        except Exception as e:
            logger.exception("get_no_watermark_video failed")
            return _err(str(e), code="NO_WATERMARK_ERROR")

    # ── 创作者平台 ─────────────────────────────────────────────────────

    def publish_note(
        self, note_info: dict[str, Any], cookies_str: str
    ) -> dict[str, Any]:
        """发布笔记到小红书（创作者平台）。

        Args:
            note_info: 笔记信息字典，格式:
                {
                    "title": "标题",
                    "desc": "正文",
                    "location": "地点名" | None,
                    "type": 0,           # 0=公开, 1=私密
                    "media_type": "image" | "video",
                    "topics": ["话题1", "话题2"],
                    "images": [b"...", ...]  # 图片 bytes 列表
                    # 或
                    "video": b"..."          # 视频 bytes
                }
            cookies_str: 用户的创作者平台 Cookie

        Returns:
            {"ok": True, "note_id": "..."}
        """
        try:
            if not cookies_str:
                return _err("未提供 Cookie", code="NO_COOKIE")

            success, msg, result = self._creator.post_note(note_info, cookies_str)
            if not success:
                return _err(msg, code="PUBLISH_FAILED")

            note_id = ""
            if isinstance(result, dict):
                note_id = (
                    result.get("data", {}).get("note_id", "")
                    or result.get("data", {}).get("id", "")
                )

            return _ok({
                "note_id": note_id,
                "raw": result,
            })
        except Exception as e:
            logger.exception("publish_note failed")
            return _err(str(e), code="PUBLISH_ERROR")

    def search_topic(
        self, keyword: str, cookies_str: str
    ) -> dict[str, Any]:
        """搜索小红书话题（创作者平台）."""
        try:
            cookies = self._trans(cookies_str)
            success, msg, data = self._creator.get_topic(keyword, cookies)
            if not success:
                return _err(msg, code="TOPIC_SEARCH_FAILED")
            return _ok(data)
        except Exception as e:
            logger.exception("search_topic failed")
            return _err(str(e), code="TOPIC_SEARCH_ERROR")

    def search_location(
        self, keyword: str, cookies_str: str
    ) -> dict[str, Any]:
        """搜索小红书地点（创作者平台）."""
        try:
            cookies = self._trans(cookies_str)
            success, msg, data = self._creator.get_location_info(keyword, cookies)
            if not success:
                return _err(msg, code="LOCATION_SEARCH_FAILED")
            return _ok(data)
        except Exception as e:
            logger.exception("search_location failed")
            return _err(str(e), code="LOCATION_SEARCH_ERROR")

    # ── 首页推荐 ───────────────────────────────────────────────────────

    def get_feed_recommend(
        self,
        category: str = "homefeed_recommend",
        num: int = 20,
        cookies_str: str | None = None,
    ) -> dict[str, Any]:
        """获取首页推荐笔记."""
        try:
            ck = cookies_str or self._default_cookies
            if not ck:
                return _err("未提供 Cookie", code="NO_COOKIE")
            success, msg, notes = self._pc.get_homefeed_recommend_by_num(
                category, num, ck
            )
            if not success:
                return _err(msg, code="FEED_FAILED")
            return _ok({"notes": notes, "total": len(notes or [])})
        except Exception as e:
            logger.exception("get_feed_recommend failed")
            return _err(str(e), code="FEED_ERROR")

    # ── 可用方法列表 ───────────────────────────────────────────────────

    @staticmethod
    def list_methods() -> dict[str, Any]:
        """列出所有可用方法（用于调试和 Agent tool 注册）."""
        _ensure_runtime_imported()
        import inspect

        pc_methods = []
        for name, func in inspect.getmembers(_XHS_PC_APIS, predicate=inspect.isfunction):
            if not name.startswith("_"):
                sig = inspect.signature(func)
                pc_methods.append({
                    "name": name,
                    "params": [
                        str(p) for p in sig.parameters.values()
                        if p.name != "self"
                    ],
                })

        creator_methods = []
        for name, func in inspect.getmembers(
            _XHS_CREATOR_APIS, predicate=inspect.isfunction
        ):
            if not name.startswith("_"):
                sig = inspect.signature(func)
                creator_methods.append({
                    "name": name,
                    "params": [
                        str(p) for p in sig.parameters.values()
                        if p.name != "self"
                    ],
                })

        return _ok({
            "pc": sorted(pc_methods, key=lambda m: m["name"]),
            "creator": sorted(creator_methods, key=lambda m: m["name"]),
            "total": len(pc_methods) + len(creator_methods),
        })
