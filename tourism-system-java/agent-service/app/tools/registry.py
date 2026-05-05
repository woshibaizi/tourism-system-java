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
    """线程安全的工具注册表单例。"""

    def __init__(self) -> None:
        self._tools: dict[str, ToolDef] = {}
        self._lock = threading.RLock()

    def register(
        self,
        name: str,
        description: str,
        parameters: dict[str, Any],
    ) -> Callable[[Callable[..., str]], Callable[..., str]]:
        """装饰器：注册工具函数。"""

        def decorator(fn: Callable[..., str]) -> Callable[..., str]:
            with self._lock:
                self._tools[name] = ToolDef(
                    name=name,
                    description=description,
                    parameters=parameters,
                    fn=fn,
                )
            logger.debug("工具已注册: %s", name)
            return fn

        return decorator

    def get_definitions(self) -> list[dict[str, Any]]:
        """返回 OpenAI function calling 格式的工具列表。"""
        with self._lock:
            return [t.to_openai_schema() for t in self._tools.values()]

    def get_tool_names(self) -> list[str]:
        with self._lock:
            return list(self._tools.keys())

    def dispatch(self, name: str, args: dict[str, Any]) -> str:
        """执行工具调用，返回 JSON 字符串结果。"""
        with self._lock:
            tool = self._tools.get(name)
        if tool is None:
            return _tool_error(f"未知工具: {name}")
        try:
            result = tool.fn(**args)
            return _tool_result(result)
        except Exception as e:
            logger.exception("工具 %s 执行失败", name)
            return _tool_error(str(e))

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
