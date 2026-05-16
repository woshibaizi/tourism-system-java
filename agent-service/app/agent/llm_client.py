"""
统一大模型调用接口。

支持两种 provider:
- openai_compatible: OpenAI / DeepSeek / Qwen / 本地模型 等兼容接口
- anthropic: Anthropic Claude API

所有 provider 暴露相同的方法签名，切换模型只需改环境变量。

用法:
    from app.agent.llm_client import get_llm_client
    client = get_llm_client()
    reply = client.chat([
        {"role": "system", "content": "你是旅游助手"},
        {"role": "user", "content": "帮我规划杭州一日游"},
    ])
"""

from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Iterator

from app.config import settings


# ======================== 数据结构 ========================


@dataclass
class ChatResult:
    """LLM 调用结果。content 和 tool_calls 互斥：调用方必须先检查 tool_calls。"""
    content: str | None  # tool_calls 非空时为 None
    tool_calls: list[dict[str, Any]] | None = None


def _extract_json(text: str) -> dict[str, Any] | None:
    """从 LLM 文本中提取 JSON 对象，支持嵌套结构。"""
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or start >= end:
        return None
    try:
        return json.loads(text[start:end + 1])
    except (json.JSONDecodeError, TypeError):
        return None


# ======================== Vision 工具函数 ========================


def build_vision_content(text: str, image_urls: list[str]) -> list[dict[str, Any]]:
    """构建多模态 vision content blocks（OpenAI 格式）。

    返回的 list 可直接作为 message["content"] 传入 chat()。
    Anthropic provider 内部会自动转换。
    """
    blocks: list[dict[str, Any]] = [{"type": "text", "text": text}]
    for url in image_urls:
        blocks.append({"type": "image_url", "image_url": {"url": url}})
    return blocks


def _convert_vision_to_anthropic(blocks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """将 OpenAI 格式的 vision content blocks 转为 Anthropic 格式。"""
    converted: list[dict[str, Any]] = []
    for block in blocks:
        if block.get("type") == "text":
            converted.append({"type": "text", "text": block["text"]})
        elif block.get("type") == "image_url":
            url = block.get("image_url", {}).get("url", "")
            converted.append({
                "type": "image",
                "source": {"type": "url", "url": url},
            })
        else:
            converted.append(block)
    return converted


# ======================== 抽象接口 ========================


class BaseLLMProvider(ABC):
    """所有 provider 必须实现的统一接口。"""

    @abstractmethod
    def chat(
        self,
        messages: list[dict[str, Any]],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        stop: list[str] | None = None,
        tools: list[dict[str, Any]] | None = None,
    ) -> ChatResult:
        """发送消息，返回 ChatResult（含 content 和可选 tool_calls）。"""
        ...

    @abstractmethod
    def chat_stream(
        self,
        messages: list[dict[str, Any]],
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
        result = self.chat(full_messages, temperature=0.0, max_tokens=256)
        return self._parse_json_safely(result.content or "", intents)

    def _parse_json_safely(self, raw: str, intents: dict[str, str]) -> dict[str, Any]:
        """容错解析模型返回的 JSON，支持嵌套结构。"""
        parsed = _extract_json(raw)
        if parsed and parsed.get("intent") in intents:
            return {
                "intent": parsed["intent"],
                "confidence": float(parsed.get("confidence", 0.5)),
                "missing_context": parsed.get("missing_context", []),
            }
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
        tools: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        kwargs: dict[str, Any] = {
            "model": self._model,
            "temperature": temperature if temperature is not None else settings.llm_temperature,
            "max_tokens": max_tokens or settings.llm_max_tokens,
        }
        if stop:
            kwargs["stop"] = stop
        if tools:
            kwargs["tools"] = tools
        return kwargs

    def chat(
        self,
        messages: list[dict[str, Any]],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        stop: list[str] | None = None,
        tools: list[dict[str, Any]] | None = None,
    ) -> ChatResult:
        kwargs = self._build_kwargs(temperature, max_tokens, stop, tools)
        resp = self._client.chat.completions.create(messages=messages, **kwargs)
        choice = resp.choices[0]
        if choice.message.tool_calls:
            tool_calls = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                }
                for tc in choice.message.tool_calls
            ]
            return ChatResult(content=None, tool_calls=tool_calls)
        return ChatResult(content=choice.message.content or "")

    def chat_stream(
        self,
        messages: list[dict[str, Any]],
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
        messages: list[dict[str, Any]],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        stop: list[str] | None = None,
        tools: list[dict[str, Any]] | None = None,
    ) -> ChatResult:
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
        if tools:
            kwargs["tools"] = self._to_anthropic_tools(tools)
        resp = self._client.messages.create(**kwargs)
        return self._parse_anthropic_response(resp)

    def chat_stream(
        self,
        messages: list[dict[str, Any]],
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
        self, messages: list[dict[str, Any]]
    ) -> tuple[str, list[dict[str, Any]]]:
        """Anthropic API 的 system 是独立参数，需要从 messages 中分离出来。"""
        system_parts: list[str] = []
        user_messages: list[dict[str, Any]] = []
        for msg in messages:
            if msg["role"] == "system":
                content = msg["content"]
                system_parts.append(content if isinstance(content, str) else str(content))
            elif isinstance(msg.get("content"), list):
                user_messages.append({
                    "role": msg["role"],
                    "content": _convert_vision_to_anthropic(msg["content"]),
                })
            else:
                user_messages.append(msg)
        return "\n\n".join(system_parts), user_messages

    @staticmethod
    def _to_anthropic_tools(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """将 OpenAI function calling schema 转为 Anthropic tool format。"""
        result: list[dict[str, Any]] = []
        for tool in tools:
            func = tool.get("function", tool)
            result.append({
                "name": func["name"],
                "description": func.get("description", ""),
                "input_schema": func.get("parameters", {"type": "object", "properties": {}, "required": []}),
            })
        return result

    @staticmethod
    def _parse_anthropic_response(resp) -> ChatResult:
        """解析 Anthropic 响应，提取文本和 tool_use 块。"""
        text_parts: list[str] = []
        tool_calls: list[dict[str, Any]] = []
        for block in resp.content:
            if block.type == "text":
                text_parts.append(block.text)
            elif block.type == "tool_use":
                tool_calls.append({
                    "id": block.id,
                    "type": "function",
                    "function": {
                        "name": block.name,
                        "arguments": json.dumps(block.input, ensure_ascii=False),
                    },
                })
        if tool_calls:
            return ChatResult(content=None, tool_calls=tool_calls)
        return ChatResult(content="\n".join(text_parts))


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


# 懒加载单例，避免 import 时即创建连接
_llm_client: BaseLLMProvider | None = None


def get_llm_client() -> BaseLLMProvider:
    """获取 LLM 客户端单例（懒加载，首次调用时才创建连接）。"""
    global _llm_client
    if _llm_client is None:
        _llm_client = create_llm_provider()
    return _llm_client
