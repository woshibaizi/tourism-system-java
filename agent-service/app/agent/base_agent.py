"""
Agent 基类 — 所有 Agent 必须实现的统一接口。
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class AgentResponse:
    """Agent 处理结果的统一结构。"""

    content: str
    intent: str
    suggestions: list[str] = field(default_factory=list)
    tools_used: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentContext:
    """Agent 执行上下文。"""

    user_id: str
    session_id: str
    session_messages: list[dict[str, str]] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


class BaseAgent(ABC):
    """所有 Agent 的抽象基类。"""

    @property
    @abstractmethod
    def name(self) -> str:
        """Agent 唯一名称。"""
        ...

    @property
    @abstractmethod
    def description(self) -> str:
        """Agent 能力描述。"""
        ...

    @abstractmethod
    def process(self, message: str, context: AgentContext) -> AgentResponse:
        """处理用户消息，返回统一响应。"""
        ...

    def get_system_prompt(self) -> str:
        """返回该 Agent 的系统提示词，子类可覆盖。"""
        return ""

    def get_tools(self) -> list[dict[str, Any]]:
        """返回该 Agent 可用的工具定义（OpenAI function calling 格式）。"""
        return []

    def can_handle(self, intent: str) -> bool:
        """判断该 Agent 是否能处理给定的意图。"""
        return False
