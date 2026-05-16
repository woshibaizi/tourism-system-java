"""
统一 LLM 入口 — 所有 Agent 通过此模块获取 LLM 客户端。

消除 dispatcher/chat_agent/diary_agent 中 3 处重复的 _get_llm() / _llm_available()。
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

_llm_client: Any = None


def get_llm():
    """延迟加载 LLM 客户端单例。第一次成功后缓存，失败则缓存 False。"""
    global _llm_client
    if _llm_client is None:
        try:
            from app.agent.llm_client import get_llm_client

            _llm_client = get_llm_client()
        except Exception as e:
            logger.warning("LLM 客户端初始化失败，降级为规则模式: %s", e)
            _llm_client = False
    return _llm_client if _llm_client is not False else None


def llm_available() -> bool:
    """LLM 是否可用（客户端已初始化 且 配置了 API key）。"""
    from app.config import settings

    client = get_llm()
    return client is not None and bool(settings.llm_api_key)
