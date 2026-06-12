"""
工具注册表 — 仿 hermes-agent 单例模式。

装饰器注册工具函数，自动发现，支持 OpenAI function calling 格式输出。
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass, field
from typing import Any, Callable

logger = logging.getLogger(__name__)


@dataclass
class ToolDef:
    name: str
    description: str
    parameters: dict[str, Any]
    fn: Callable[..., str]

    def to_openai_schema(self) -> dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


class ToolRegistry:
    """线程安全的工具注册表单例，支持 Agent 作用域隔离。"""

    def __init__(self) -> None:
        self._tools: dict[str, ToolDef] = {}
        self._agent_tools: dict[str, set[str]] = {}  # agent_name → {tool_names}
        self._lock = threading.RLock()

    def register(
        self,
        name: str,
        description: str,
        parameters: dict[str, Any],
        agent_name: str | None = None,
    ) -> Callable[[Callable[..., str]], Callable[..., str]]:
        """装饰器：注册工具函数。agent_name 非空时将工具绑定到指定 Agent。"""

        def decorator(fn: Callable[..., str]) -> Callable[..., str]:
            with self._lock:
                self._tools[name] = ToolDef(
                    name=name,
                    description=description,
                    parameters=parameters,
                    fn=fn,
                )
                if agent_name:
                    self._agent_tools.setdefault(agent_name, set()).add(name)
            logger.debug("工具已注册: %s (agent=%s)", name, agent_name or "global")
            return fn

        return decorator

    def get_definitions(self) -> list[dict[str, Any]]:
        """返回 OpenAI function calling 格式的全部工具列表（向后兼容）。"""
        with self._lock:
            return [t.to_openai_schema() for t in self._tools.values()]

    def get_definitions_for_agent(self, agent_name: str) -> list[dict[str, Any]]:
        """只返回该 Agent 有权使用的工具定义。"""
        with self._lock:
            allowed = self._agent_tools.get(agent_name, set())
            if not allowed:
                return []
            return [
                t.to_openai_schema()
                for name, t in self._tools.items()
                if name in allowed
            ]

    def get_tool_names(self) -> list[str]:
        with self._lock:
            return list(self._tools.keys())

    def get_tool_names_for_agent(self, agent_name: str) -> list[str]:
        """返回该 Agent 有权使用的工具名列表。"""
        with self._lock:
            return sorted(self._agent_tools.get(agent_name, set()))

    def dispatch(self, name: str, args: dict[str, Any]) -> str:
        """执行工具调用，返回 JSON 字符串结果。自动修正 DeepSeek 参数名偏差。"""
        with self._lock:
            tool = self._tools.get(name)
        if tool is None:
            return _tool_error(f"未知工具: {name}")

        # 参数名归一化：DeepSeek 常发明错误参数名
        args = self._normalize_args(name, args, tool.parameters)

        try:
            result = tool.fn(**args)
            return _tool_result(result)
        except Exception as e:
            logger.exception("工具 %s 执行失败", name)
            return _tool_error(str(e))

    @staticmethod
    def _normalize_args(name: str, args: dict[str, Any], schema: dict[str, Any]) -> dict[str, Any]:
        """修正 DeepSeek 模型的参数名偏差。

        支持多候选映射：LLM 常用一个参数名（如 location）表达不同语义，
        按优先级依次尝试候选目标，匹配到 schema 中存在的参数名即停止。
        """
        props = schema.get("properties", {})
        if not props:
            return args

        valid_names = set(props.keys())
        normalized: dict[str, Any] = {}

        # 多候选映射：LLM 常用名 → [候选目标参数名（按优先级排序）]
        # 第一个匹配到 valid_names 的候选被采用
        RENAMES: dict[str, list[str]] = {
            "place":          ["place_name"],
            "start":          ["from_place"],
            "start_place":    ["from_place"],
            "origin":         ["from_place"],
            "end":            ["to_place"],
            "end_place":      ["to_place"],
            "destination":    ["to_place"],
            "destinations":   ["place_names"],
            # location 语义歧义消除：
            #   周边工具(place_name/query) → place_name 优先
            #   地点搜索(keyword)          → keyword 降级
            "location":       ["place_name", "query", "keyword"],
            "query":          ["keyword", "query", "place_name"],
            "size":           ["size"],
        }

        for k, v in args.items():
            if k in valid_names:
                normalized[k] = v
            elif k in RENAMES:
                candidates = RENAMES[k]
                matched = False
                for candidate in candidates:
                    if candidate in valid_names:
                        logger.info("参数名修正: %s.%s → %s", name, k, candidate)
                        normalized[candidate] = v
                        matched = True
                        break
                if not matched:
                    # 所有候选都不匹配 → 保留原样，让函数自己报错
                    normalized[k] = v
                    logger.debug("参数名修正: %s.%s 无匹配候选（valid=%s），保留原样",
                                name, k, sorted(valid_names))
            else:
                # 不在映射表中 → 保留原样
                normalized[k] = v

        return normalized

    def list_tools(self) -> list[dict[str, Any]]:
        """列出所有已注册工具（名称 + 描述，供调试用）。"""
        with self._lock:
            return [
                {"name": t.name, "description": t.description}
                for t in self._tools.values()
            ]


def _tool_result(data: str) -> str:
    import json as _json

    return _json.dumps({"ok": True, "data": data}, ensure_ascii=False)


def _tool_error(error: str) -> str:
    import json as _json

    return _json.dumps({"ok": False, "error": error}, ensure_ascii=False)


# 全局单例
registry = ToolRegistry()
