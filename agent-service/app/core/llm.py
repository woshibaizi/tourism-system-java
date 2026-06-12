"""
统一 LLM 入口 — 所有 Agent 通过此模块获取 LLM 客户端。

消除 dispatcher/chat_agent/diary_agent 中 3 处重复的 _get_llm() / _llm_available()。

v2.0: 接入 ModelRouter，支持文本/视觉模型自动路由。
- get_llm() 返回文本模型客户端（向后兼容）
- model_router 提供视觉模型和自动路由能力
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

_llm_client: Any = None


def get_llm():
    """返回文本 LLM 客户端（向后兼容）。

    内部使用 ModelRouter.text_client，首次调用时懒加载。
    失败时缓存 False，后续调用返回 None。
    """
    global _llm_client
    if _llm_client is None:
        try:
            from app.core.model_router import model_router

            _llm_client = model_router.text_client
            logger.info("文本 LLM 客户端已就绪")
        except Exception as e:
            logger.warning("LLM 客户端初始化失败，降级为规则模式: %s", e)
            _llm_client = False
    return _llm_client if _llm_client is not False else None


def get_vision_llm():
    """返回视觉 LLM 客户端（用于图片理解等任务）。

    可能返回 None（视觉模型未配置或不可用）。
    """
    try:
        from app.core.model_router import model_router

        return model_router.vision_client
    except Exception as e:
        logger.warning("视觉 LLM 客户端获取失败: %s", e)
        return None


def llm_available() -> bool:
    """LLM 是否可用（客户端已初始化 且 配置了 API key）。"""
    from app.config import settings

    client = get_llm()
    return client is not None and bool(settings.llm_api_key or settings.text_api_key)


def vision_available() -> bool:
    """视觉模型是否可用。"""
    try:
        from app.core.model_router import model_router

        return model_router.vision_available()
    except Exception:
        return False
