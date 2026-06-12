"""
模型路由器 — 根据任务类型自动选择最合适的模型。

路由规则（优先级从高到低）：
1. 请求包含图片且 HYBRID_MODE=true → 视觉模型（Qwen VL）
2. intent=generate_diary + 有图片 → 视觉模型
3. 纯文本任务 → 文本模型（DeepSeek）

降级策略：
- 视觉模型 API Key 未配置 → 文本模型
- HYBRID_MODE=false → 全部走文本模型
- 视觉模型调用失败 → 文本模型兜底

用法:
    from app.core.model_router import model_router

    # 自动路由
    result = model_router.chat_with_auto_route(messages, intent="general_chat")

    # 强制使用视觉模型
    client = model_router.vision_client
    result = client.chat(messages)

    # 检查视觉能力
    if model_router.vision_available():
        ...
"""

from __future__ import annotations

import logging
from typing import Any

from app.agent.llm_client import (
    BaseLLMProvider,
    OpenAICompatibleProvider,
)
from app.config import settings

logger = logging.getLogger(__name__)


# 需要视觉能力的意图集合
VISION_INTENTS = frozenset({
    "generate_diary",       # 日记生成常伴随图片
    "analyze_image",        # 显式图片分析
    "identify_place",       # 图片识别地点
    "identify_food",        # 图片识别美食
})


class ModelRouter:
    """管理多个 LLM 实例，按任务特征路由到合适的模型。

    核心设计：
    - text_client:   处理纯文本任务（对话、推理、工具调用）
    - vision_client: 处理图片理解任务（多模态分析）
    - 路由逻辑对调用方透明，由 route() 自动决策
    """

    def __init__(self):
        self._text_client: BaseLLMProvider | None = None
        self._vision_client: BaseLLMProvider | None = None

    # ==================== 客户端获取 ====================

    @property
    def text_client(self) -> BaseLLMProvider:
        """文本模型客户端（懒加载，单例）。

        优先级: TEXT_LLM_API_KEY > LLM_API_KEY（兼容旧配置）
        """
        if self._text_client is None:
            api_key = settings.text_api_key or settings.llm_api_key
            base_url = settings.text_base_url or settings.llm_base_url
            model = settings.text_model or settings.llm_model

            logger.info(
                "初始化文本模型: model=%s base_url=%s",
                model, base_url,
            )
            self._text_client = OpenAICompatibleProvider(
                api_key=api_key,
                base_url=base_url,
                model=model,
                timeout_ms=settings.llm_timeout_ms,
            )
        return self._text_client

    @property
    def vision_client(self) -> BaseLLMProvider | None:
        """视觉模型客户端（懒加载，可能为 None）。

        不可用时返回 None，调用方需处理降级。
        """
        if not settings.hybrid_mode:
            return None

        if self._vision_client is None:
            api_key = settings.vision_api_key or settings.llm_api_key
            if not api_key:
                logger.warning(
                    "视觉模型 API Key 未配置（VISION_LLM_API_KEY 和 LLM_API_KEY 均为空），"
                    "图片理解功能不可用"
                )
                return None

            model = settings.vision_model
            base_url = settings.vision_base_url

            try:
                self._vision_client = OpenAICompatibleProvider(
                    api_key=api_key,
                    base_url=base_url,
                    model=model,
                    timeout_ms=settings.llm_timeout_ms,
                )
                logger.info("初始化视觉模型: model=%s base_url=%s", model, base_url)
            except Exception as e:
                logger.error("视觉模型初始化失败: %s", e)
                return None

        return self._vision_client

    def vision_available(self) -> bool:
        """视觉模型是否可用。"""
        return self.vision_client is not None

    # ==================== 路由逻辑 ====================

    def route(
        self,
        messages: list[dict[str, Any]] | None = None,
        intent: str = "",
        has_images: bool = False,
    ) -> BaseLLMProvider:
        """根据任务特征选择最合适的模型。

        Args:
            messages: 消息列表（可选，用于检测 content 中是否含图片）
            intent: 意图类型
            has_images: 是否包含图片

        Returns:
            合适的 LLM provider

        路由规则:
            1. has_images=True 且有视觉模型 → vision_client
            2. intent 在视觉意图集合中 → vision_client
            3. 其他 → text_client
        """
        # 检测消息中是否包含图片（image_url content blocks）
        if not has_images and messages:
            has_images = self._detect_images_in_messages(messages)

        needs_vision = has_images or intent in VISION_INTENTS

        if needs_vision and self.vision_client is not None:
            logger.debug(
                "路由 → 视觉模型 (%s) | intent=%s has_images=%s",
                settings.vision_model, intent, has_images,
            )
            return self.vision_client

        logger.debug(
            "路由 → 文本模型 (%s) | intent=%s has_images=%s vision_available=%s",
            settings.text_model or settings.llm_model,
            intent, has_images, self.vision_available(),
        )
        return self.text_client

    def chat_with_auto_route(
        self,
        messages: list[dict[str, Any]],
        *,
        intent: str = "",
        has_images: bool = False,
        temperature: float | None = None,
        max_tokens: int | None = None,
        stop: list[str] | None = None,
        tools: list[dict[str, Any]] | None = None,
    ):
        """自动路由并调用 LLM — 对调用方完全透明。

        用法同 BaseLLMProvider.chat()，自动选择文本或视觉模型。
        """
        client = self.route(messages, intent, has_images)
        return client.chat(
            messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stop=stop,
            tools=tools,
        )

    # ==================== 辅助方法 ====================

    @staticmethod
    def _detect_images_in_messages(messages: list[dict[str, Any]]) -> bool:
        """检测消息列表中是否包含 image_url content blocks。"""
        for msg in messages:
            content = msg.get("content")
            if isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "image_url":
                        return True
            elif isinstance(content, dict):
                if content.get("type") == "image_url":
                    return True
        return False


# ==================== 全局单例 ====================

model_router = ModelRouter()
