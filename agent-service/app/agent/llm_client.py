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
import logging
import re
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Iterator
from xml.etree import ElementTree

from app.config import settings

logger = logging.getLogger(__name__)


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


def _parse_dsml_tool_calls(
    content: str,
    valid_tool_names: set[str] | None = None,
) -> list[dict[str, Any]] | None:
    """Parse DeepSeek DSML XML tool calls into standard OpenAI tool_calls format.

    DeepSeek uses fullwidth pipe (U+FF5C) and slash (U+FF0F) as XML delimiters.
    Actual format from traces: <｜DSML｜tool_calls>...</／DSML｜tool_calls>
    Also handles ASCII <DSML function_calls> and standalone <invoke> tags.

    Args:
        content: Raw LLM response text.
        valid_tool_names: If provided, only tool names in this set are accepted.
            Names not in the set are logged and skipped.
            If None or empty, ALL extracted tool names are rejected (no tools available).
    """
    import re as _re
    FW = '｜'  # fullwidth vertical bar
    FS = '／'  # fullwidth solidus

    # 归一化：None → 空集合，统一走白名单拒绝逻辑
    if valid_tool_names is None:
        valid_tool_names = set()

    tool_calls: list[dict[str, Any]] = []
    rejected_names: list[str] = []

    # Pattern 1: fullwidth DSML format from DeepSeek
    # FW{1,2} handles DeepSeek output instability: sometimes 1, sometimes 2 fullwidth bars
    p1_invoke = _re.compile(
        r'<' + FW + r'{1,2}DSML' + FW + r'{1,2}invoke name="([^"]+)">'
        + r'(.*?)'
        + r'<' + FS + r'{1,2}DSML' + FW + r'{1,2}invoke>',
        _re.DOTALL,
    )
    for tool_name, params_xml in p1_invoke.findall(content):
        if not tool_name:
            continue
        if tool_name not in valid_tool_names:
            rejected_names.append(tool_name)
            continue
        args = _parse_dsml_params_fullwidth(params_xml)
        tool_calls.append(_make_tc(tool_name, args))

    if rejected_names:
        logger.warning(
            "DSML 解析: 拒绝 %d 个不在白名单中的工具调用: %s",
            len(rejected_names), rejected_names,
        )

    if tool_calls:
        return tool_calls

    # Pattern 2: ASCII DSML wrapper
    rejected_names.clear()
    m = _re.search(r'<DSML\s+function_calls>(.*?)</DSML\s+function_calls>', content, _re.DOTALL)
    section = m.group(1) if m else (content if '<invoke name="' in content else '')

    if section:
        for tool_name, params_xml in _re.findall(
            r'<invoke\s+name="([^"]+)"\s*>(.*?)</invoke\s*>', section, _re.DOTALL,
        ):
            if not tool_name:
                continue
            if tool_name not in valid_tool_names:
                rejected_names.append(tool_name)
                continue
            args = _parse_dsml_params_ascii(params_xml)
            tool_calls.append(_make_tc(tool_name, args))

    if rejected_names:
        logger.warning(
            "DSML 解析: 拒绝 %d 个不在白名单中的工具调用: %s",
            len(rejected_names), rejected_names,
        )

    # ═══ DSML 解析完全失败时记录原始内容供调试 ═══
    if not tool_calls and ('DSML' in content or 'invoke' in content):
        valid_preview = list(valid_tool_names)[:10] if valid_tool_names else '无-无工具可用'
        logger.warning(
            "DSML 解析失败！检测到 DSML/invoke 关键词但无法提取有效 tool_calls。"
            "白名单校验(valid_tools=%s). 原始内容 (前500字符): %s",
            valid_preview, content[:500],
        )

    return tool_calls if tool_calls else None


def _make_tc(name: str, args: dict) -> dict:
    return {"id": f"dsml_{uuid.uuid4().hex[:16]}", "type": "function",
            "function": {"name": name, "arguments": json.dumps(args, ensure_ascii=False)}}


def _parse_dsml_params_fullwidth(params_xml: str) -> dict[str, Any]:
    FW = '｜'; FS = '／'
    args: dict[str, Any] = {}

    # 两步解析法：先匹配完整的 parameter 块，再从 opening tag 中提取属性。
    # 这样无论属性顺序如何（name 前还是 string 前）都能正确解析。
    # FW{1,2} handles DeepSeek output instability: sometimes 1, sometimes 2 fullwidth bars
    block_re = re.compile(
        r'<' + FW + r'{1,2}DSML' + FW + r'{1,2}parameter(\s+[^>]*)>'
        + r'(.*?)'
        + r'<' + FS + r'{1,2}DSML' + FW + r'{1,2}parameter>',
        re.DOTALL,
    )
    for attrs_str, val in block_re.findall(params_xml):
        name_m = re.search(r'name="([^"]+)"', attrs_str)
        if not name_m:
            continue
        name = name_m.group(1)
        string_m = re.search(r'string="(true|false)"', attrs_str)
        is_str = string_m.group(1) == "true" if string_m else True  # 缺 string 默认按字符串
        val = val.strip()
        args[name] = val if is_str else (_safe_json(val) if _safe_json(val) is not None else val)

    return args


def _parse_dsml_params_ascii(params_xml: str) -> dict[str, Any]:
    args: dict[str, Any] = {}

    # 两步解析法：先匹配完整的 parameter 块，再从 opening tag 中提取属性。
    # 这样无论属性顺序如何（name 前还是 string 前）都能正确解析。
    block_re = re.compile(
        r'<parameter(\s+[^>]*)>'
        r'(.*?)'
        r'</parameter\s*>',
        re.DOTALL,
    )
    for attrs_str, val in block_re.findall(params_xml):
        name_m = re.search(r'name="([^"]+)"', attrs_str)
        if not name_m:
            continue
        name = name_m.group(1)
        string_m = re.search(r'string="(true|false)"', attrs_str)
        is_str = string_m.group(1) == "true" if string_m else True  # 缺 string 默认按字符串
        val = val.strip()
        args[name] = val if is_str else (_safe_json(val) if _safe_json(val) is not None else val)

    return args


def _safe_json(s: str) -> Any | None:
    try: return json.loads(s)
    except: return None


def _classify_response_type(content: str) -> str:
    """两阶段解析的第一阶段：分类 LLM 响应类型。

    Returns:
        "structured_dsml": 有完整 DSML 信封标签，是正式的工具调用请求
        "suspicious_inline": 有 invoke 标签但无 DSML 信封，可能是 LLM 在对话中幻觉出的工具调用
        "conversational": 纯对话文本，无任何工具调用标记
    """
    FW = '｜'; FS = '／'

    # 检测是否有任何工具调用标记
    # FW{1,2} regex to handle DeepSeek 1-2 fullwidth bar instability
    import re as _re_cls
    has_fullwidth_dsml = bool(_re_cls.search(
        r'<' + FW + r'{1,2}DSML' + FW + r'{1,2}(?:tool_calls|invoke)', content,
    ))
    has_ascii_dsml = '<DSML' in content
    has_invoke = 'invoke' in content and ('<invoke' in content or FW + 'invoke' in content)
    has_fw_invoke = bool(_re_cls.search(
        r'<' + FW + r'{1,2}(?:DSML' + FW + r'{1,2})?invoke', content,
    ))

    if not (has_fullwidth_dsml or has_ascii_dsml or has_invoke or has_fw_invoke):
        return "conversational"

    # 有完整的 DSML 信封 → 正式工具调用
    if has_ascii_dsml and '<DSML' in content and 'function_calls>' in content:
        return "structured_dsml"
    if has_fullwidth_dsml and _re_cls.search(
        r'<' + FW + r'{1,2}DSML' + FW + r'{1,2}(?:tool_calls>|invoke)', content,
    ):
        return "structured_dsml"

    # 有 invoke 但没有信封 → 可疑（LLM 在对话中幻觉出工具调用格式）
    if has_invoke or has_fw_invoke:
        return "suspicious_inline"

    return "conversational"


def _extract_tool_names(tools: list[dict[str, Any]]) -> set[str]:
    """从 OpenAI function calling 格式的工具列表中提取工具名集合。

    用于 DSML 解析时的白名单校验，防止 LLM 幻觉出不存在的工具调用。
    """
    names: set[str] = set()
    for tool in tools:
        func = tool.get("function", tool)
        name = func.get("name", "")
        if name:
            names.add(name)
    return names


def _strip_dsml_from_content(content: str) -> str:
    FW = '｜'; FS = '／'
    # Fullwidth tool_calls envelope — FW{1,2} handles DeepSeek 1-2 bar instability
    content = re.sub(
        r'<' + FW + r'{1,2}DSML' + FW + r'{1,2}tool_calls>.*?' + r'<' + FS + r'{1,2}DSML' + FW + r'{1,2}tool_calls>',
        '', content, flags=re.DOTALL,
    )
    # ASCII DSML function_calls envelope
    content = re.sub(r'<DSML\s+function_calls>.*?</DSML\s+function_calls>', '', content, flags=re.DOTALL)
    # ASCII standalone invoke tags (without envelope)
    content = re.sub(r'<invoke\s+name="[^"]+"\s*>.*?</invoke\s*>', '', content, flags=re.DOTALL)
    # Fullwidth standalone invoke tags (without tool_calls envelope) — FW{1,2} handles DeepSeek instability
    content = re.sub(
        r'<' + FW + r'{1,2}DSML' + FW + r'{1,2}invoke name="[^"]*">'
        + r'.*?'
        + r'<' + FS + r'{1,2}DSML' + FW + r'{1,2}invoke>',
        '', content, flags=re.DOTALL,
    )
    return content.strip()


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
        tool_choice: str | None = None,
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
        if tool_choice and tools:
            kwargs["tool_choice"] = tool_choice
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

        # 1. 标准 OpenAI tool_calls
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

        raw_content = choice.message.content or ""

        # 2. 两阶段解析：先分类内容类型，再决定是否尝试 DSML 解析
        if tools:
            content_type = _classify_response_type(raw_content)
            valid_names = _extract_tool_names(tools)

            if content_type == "structured_dsml":
                # 有完整 DSML 信封 → 正式工具调用，正常解析
                dsml_calls = _parse_dsml_tool_calls(raw_content, valid_tool_names=valid_names)
                if dsml_calls:
                    clean_text = _strip_dsml_from_content(raw_content)
                    logger.info("DSML parsed: %d tool_calls extracted (validated against %d tools)",
                               len(dsml_calls), len(valid_names))
                    return ChatResult(
                        content=clean_text if clean_text else None,
                        tool_calls=dsml_calls,
                    )
            elif content_type == "suspicious_inline":
                # invoke 标签嵌入对话中 → 可能是 LLM 幻觉，仅尝试白名单内工具
                logger.warning(
                    "检测到嵌入式 invoke 标签（非标准 DSML 信封），疑似 LLM 幻觉。"
                    "仅尝试解析白名单内工具。原始内容(前200): %s",
                    raw_content[:200],
                )
                dsml_calls = _parse_dsml_tool_calls(raw_content, valid_tool_names=valid_names)
                if dsml_calls:
                    clean_text = _strip_dsml_from_content(raw_content)
                    logger.info(
                        "嵌入式 invoke 解析: %d tool_calls 通过白名单校验",
                        len(dsml_calls),
                    )
                    return ChatResult(
                        content=clean_text if clean_text else None,
                        tool_calls=dsml_calls,
                    )
                else:
                    # ═══ 关键修复: 工具调用解析失败时，必须清理 DSML 标签再返回 ═══
                    logger.info(
                        "嵌入式 invoke 解析: 所有工具名均未通过白名单校验，降级为纯文本回复"
                    )
                    cleaned = _strip_dsml_from_content(raw_content)
                    if cleaned != raw_content:
                        logger.info("DSML 标签已从返回内容中清理（%d → %d 字符）",
                                   len(raw_content), len(cleaned))
                    return ChatResult(content=cleaned)
            # else: "conversational" → 跳过 DSML，直接走纯文本回复

        # 3. 纯文本回复 — ═══ 关键修复: 始终清理可能残留的 DSML 标签 ═══
        cleaned_content = _strip_dsml_from_content(raw_content)
        if cleaned_content != raw_content:
            logger.info("DSML 标签已从纯文本回复中清理（%d → %d 字符）",
                       len(raw_content), len(cleaned_content))
        elif '<invoke' in raw_content:
            logger.warning("DSML 清理可能未生效: raw_len=%d clean_len=%d",
                       len(raw_content), len(cleaned_content))
        return ChatResult(content=cleaned_content)

    def chat_with_tools_safe(
        self,
        messages: list[dict[str, Any]],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        stop: list[str] | None = None,
        tools: list[dict[str, Any]] | None = None,
    ) -> ChatResult:
        """安全工具调用 — 多层防御，DSML 解析失败时自动重试。

        Layer 1: 正常调用（DSML 解析 + 原生 tool_calls 双路径）
        Layer 2: 怀疑 DSML 解析失败 → 用 tool_choice="required" 强制原生格式重试
        Layer 3: 重试仍失败 → 返回文本结果，由调用方降级处理

        用于 ChatAgent/DiscoverAgent 等需要在 LLM 轮次中调用工具的 Agent。
        RouteAgent 已改为纯代码驱动，不走此路径。
        """
        if not tools:
            return self.chat(messages, temperature=temperature, max_tokens=max_tokens, stop=stop)

        # ─── Layer 1: 正常调用 ───
        result = self.chat(messages, temperature=temperature, max_tokens=max_tokens, stop=stop, tools=tools)

        # 成功提取到 tool_calls → 直接返回
        if result.tool_calls:
            return result

        # ─── Layer 2: 检测 DSML 残留 → 强制原生格式重试 ───
        raw = (result.content or "")
        # 检查是否存在 DSML/fullwidth 特征字符（'｜' U+FF5C, '／' U+FF0F）
        dsml_suspect = ('DSML' in raw or 'invoke' in raw or '｜' in raw or '／' in raw)

        if dsml_suspect and tools:
            logger.warning(
                "chat_with_tools_safe: DSML 疑似残留但解析失败，用 tool_choice=required 重试。"
                "原始内容(前200): %s",
                raw[:200],
            )
            try:
                kwargs = self._build_kwargs(temperature, max_tokens, stop, tools, tool_choice="required")
                resp = self._client.chat.completions.create(messages=messages, **kwargs)
                choice = resp.choices[0]

                # 原生 tool_calls（最可靠路径）
                if choice.message.tool_calls:
                    tool_calls = [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                        }
                        for tc in choice.message.tool_calls
                    ]
                    logger.info("chat_with_tools_safe: 重试成功，获得 %d 个原生 tool_calls", len(tool_calls))
                    return ChatResult(content=None, tool_calls=tool_calls)

                # 重试后仍是 DSML → 再解析一次（可能格式稍有不同）
                retry_content = choice.message.content or ""
                valid_names = _extract_tool_names(tools)
                dsml_retry = _parse_dsml_tool_calls(retry_content, valid_tool_names=valid_names)
                if dsml_retry:
                    clean = _strip_dsml_from_content(retry_content)
                    logger.info("chat_with_tools_safe: 重试后 DSML 解析成功，%d 个 tool_calls", len(dsml_retry))
                    return ChatResult(content=clean if clean else None, tool_calls=dsml_retry)

            except Exception as e:
                logger.warning("chat_with_tools_safe: tool_choice=required 重试异常: %s", e)

        # ─── Layer 3: 兜底 — 返回纯文本，调用方自行降级 ───
        logger.warning("chat_with_tools_safe: 所有路径均失败，返回纯文本。调用方需降级处理。")
        # ═══ 关键修复: 清理可能残留的 DSML/XML 标签，防止泄露给用户 ═══
        if result.content and ('DSML' in result.content or 'invoke' in result.content
                                or '｜' in result.content or '／' in result.content):
            cleaned = _strip_dsml_from_content(result.content)
            if cleaned != result.content:
                logger.info("chat_with_tools_safe: Layer3 清理 DSML 标签（%d → %d 字符）",
                           len(result.content), len(cleaned))
                return ChatResult(content=cleaned, tool_calls=result.tool_calls)
        return result

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
