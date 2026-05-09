"""
统一大模型调用接口。

支持两种 provider:
- openai_compatible: OpenAI / DeepSeek / Qwen / 本地模型 等兼容接口
- anthropic: Anthropic Claude API

所有 provider 暴露相同的方法签名，切换模型只需改环境变量，
不需要改动 orchestrator 业务代码。

用法:
    from app.agent.llm_client import llm_client
    reply = llm_client.chat([
        {"role": "system", "content": "你是旅游助手"},
        {"role": "user", "content": "帮我规划杭州一日游"},
    ])
"""

from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod
from typing import Any, Iterator

from app.config import settings


# ======================== 抽象接口 ========================


class BaseLLMProvider(ABC):
    """所有 provider 必须实现的统一接口。"""

    @abstractmethod
    def chat(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        stop: list[str] | None = None,
    ) -> str:
        """发送消息，返回模型回复文本。"""
        ...

    @abstractmethod
    def chat_stream(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        stop: list[str] | None = None,
    ) -> Iterator[str]:
        """流式版本，逐 chunk yield 文本增量。"""
        ...

    def classify_intent(
        self,
        message: str,
        intents: dict[str, str],
        *,
        system_prompt: str = "",
    ) -> dict[str, Any]:
        """
        意图分类快捷方法。
        intents 格式: {"plan_trip_route": "路线规划", "generate_diary": "生成日记", ...}
        返回 {"intent": "...", "confidence": 0.9, "missing_context": [...]}
        """
        labels = "\n".join(f"- {k}: {v}" for k, v in intents.items())
        full_messages = [
            {
                "role": "system",
                "content": (
                    f"{system_prompt}\n\n"
                    f"你需要把用户消息归类到以下意图之一（只返回 JSON，不要其他文字）：\n{labels}\n\n"
                    '返回格式：{{"intent": "意图key", "confidence": 0.0-1.0, '
                    '"missing_context": ["缺失的关键信息"]}}\n'
                    '如果用户信息足够完成该意图，missing_context 为空数组。'
                ),
            },
            {"role": "user", "content": message},
        ]
        raw = self.chat(full_messages, temperature=0.0, max_tokens=256)
        return self._parse_json_safely(raw, intents)

    def _parse_json_safely(self, raw: str, intents: dict[str, str]) -> dict[str, Any]:
        """容错解析模型返回的 JSON，避免非 JSON 输出导致崩溃。"""
        # 尝试提取 {...} 块
        match = re.search(r"\{[^{}]*\}", raw, re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group())
                if parsed.get("intent") in intents:
                    return {
                        "intent": parsed["intent"],
                        "confidence": float(parsed.get("confidence", 0.5)),
                        "missing_context": parsed.get("missing_context", []),
                    }
            except (json.JSONDecodeError, TypeError):
                pass
        # 降级：在 message 中搜索 intent key
        for key in intents:
            if key in raw:
                return {"intent": key, "confidence": 0.5, "missing_context": []}
        return {"intent": "general_chat", "confidence": 0.1, "missing_context": []}


# ======================== OpenAI 兼容实现 ========================


class OpenAICompatibleProvider(BaseLLMProvider):
    """
    兼容 OpenAI Chat Completions API 的 provider。
    适用于: OpenAI / DeepSeek / Qwen / 智谱 / vLLM / Ollama 等。
    """

    def __init__(
        self,
        api_key: str,
        base_url: str,
        model: str,
        timeout_ms: int = 30000,
    ):
        try:
            from openai import OpenAI
        except ImportError:
            raise ImportError(
                "openai 库未安装，请执行: pip install openai"
            )
        self._model = model
        self._client = OpenAI(
            api_key=api_key,
            base_url=base_url,
            timeout=timeout_ms / 1000.0,
        )

    def _build_kwargs(
        self,
        temperature: float | None,
        max_tokens: int | None,
        stop: list[str] | None,
    ) -> dict[str, Any]:
        kwargs: dict[str, Any] = {
            "model": self._model,
            "temperature": temperature if temperature is not None else settings.llm_temperature,
            "max_tokens": max_tokens or settings.llm_max_tokens,
        }
        if stop:
            kwargs["stop"] = stop
        return kwargs

    def chat(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        stop: list[str] | None = None,
    ) -> str:
        kwargs = self._build_kwargs(temperature, max_tokens, stop)
        resp = self._client.chat.completions.create(messages=messages, **kwargs)
        return resp.choices[0].message.content or ""

    def chat_stream(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        stop: list[str] | None = None,
    ) -> Iterator[str]:
        kwargs = self._build_kwargs(temperature, max_tokens, stop)
        kwargs["stream"] = True
        stream = self._client.chat.completions.create(messages=messages, **kwargs)
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta


# ======================== Anthropic 实现 ========================


class AnthropicProvider(BaseLLMProvider):
    """Anthropic Claude API provider。"""

    def __init__(
        self,
        api_key: str,
        model: str,
        timeout_ms: int = 30000,
    ):
        try:
            from anthropic import Anthropic
        except ImportError:
            raise ImportError(
                "anthropic 库未安装，请执行: pip install anthropic"
            )
        self._model = model
        self._client = Anthropic(
            api_key=api_key,
            timeout=timeout_ms / 1000.0,
        )

    def chat(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        stop: list[str] | None = None,
    ) -> str:
        system, user_messages = self._split_messages(messages)
        kwargs: dict[str, Any] = {
            "model": self._model,
            "messages": user_messages,
            "max_tokens": max_tokens or settings.llm_max_tokens,
            "temperature": temperature if temperature is not None else settings.llm_temperature,
        }
        if system:
            kwargs["system"] = system
        if stop:
            kwargs["stop_sequences"] = stop
        resp = self._client.messages.create(**kwargs)
        return resp.content[0].text

    def chat_stream(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        stop: list[str] | None = None,
    ) -> Iterator[str]:
        system, user_messages = self._split_messages(messages)
        kwargs: dict[str, Any] = {
            "model": self._model,
            "messages": user_messages,
            "max_tokens": max_tokens or settings.llm_max_tokens,
            "temperature": temperature if temperature is not None else settings.llm_temperature,
        }
        if system:
            kwargs["system"] = system
        if stop:
            kwargs["stop_sequences"] = stop
        with self._client.messages.stream(**kwargs) as stream:
            for text in stream.text_stream:
                yield text

    def _split_messages(
        self, messages: list[dict[str, str]]
    ) -> tuple[str, list[dict[str, str]]]:
        """Anthropic API 的 system 是独立参数，需要从 messages 中分离出来。"""
        system_parts: list[str] = []
        user_messages: list[dict[str, str]] = []
        for msg in messages:
            if msg["role"] == "system":
                system_parts.append(msg["content"])
            else:
                user_messages.append(msg)
        return "\n\n".join(system_parts), user_messages


# ======================== 工厂函数 ========================


def create_llm_provider() -> BaseLLMProvider:
    """根据配置创建对应的 LLM provider 实例。"""
    provider_type = settings.llm_provider.lower()

    if provider_type == "anthropic":
        return AnthropicProvider(
            api_key=settings.llm_api_key,
            model=settings.llm_model,
            timeout_ms=settings.llm_timeout_ms,
        )

    # 默认: openai_compatible
    return OpenAICompatibleProvider(
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
        model=settings.llm_model,
        timeout_ms=settings.llm_timeout_ms,
    )


# 模块级单例，业务代码直接 import 使用
llm_client: BaseLLMProvider = create_llm_provider()
