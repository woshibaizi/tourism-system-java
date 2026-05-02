from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """单条聊天消息，前后端都会直接消费这个结构。"""

    role: str
    content: str
    created_at: datetime


class SessionSummary(BaseModel):
    """左侧历史会话列表使用的摘要结构。"""

    session_id: str
    user_id: str
    title: str
    preview: str
    mode: str
    updated_at: datetime
    created_at: datetime
    message_count: int


class SessionDetail(SessionSummary):
    """会话详情在摘要基础上补充完整消息流。"""

    messages: list[ChatMessage] = Field(default_factory=list)


class ChatRequest(BaseModel):
    """统一聊天入口的请求体。"""

    model_config = {"populate_by_name": True}

    user_id: str = Field(default="anonymous", min_length=1, alias="userId")
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: str | None = Field(default=None, alias="sessionId")
    mode: str = Field(default="travel_assistant")
    metadata: dict[str, Any] = Field(default_factory=dict)


class ChatReply(BaseModel):
    """单轮回复结果，包含回答文本和当前轮的路由信息。"""

    content: str
    intent: str
    trace_id: str
    suggestions: list[str] = Field(default_factory=list)
    tools_used: list[str] = Field(default_factory=list)


class ChatResponse(BaseModel):
    """聊天接口最终返回结构：会话详情 + 当前轮回复元信息。"""

    session: SessionDetail
    reply: ChatReply


class HealthResponse(BaseModel):
    """健康检查返回结构。"""

    status: str
    agent_name: str
    version: str
    timestamp: datetime


class RoutePlanRequest(BaseModel):
    """路线规划骨架接口的请求体。"""

    user_id: str = Field(..., min_length=1)
    requirement: str = Field(..., min_length=1, max_length=4000)


class DiaryGenerateRequest(BaseModel):
    """图片日记生成骨架接口的请求体。"""

    user_id: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1, max_length=4000)
    images: list[str] = Field(default_factory=list, max_length=6)


class DiaryGenerateResponse(BaseModel):
    """图片日记生成接口的返回结构。"""

    title: str
    content: str
    tags: list[str] = Field(default_factory=list)
    images: list[str] = Field(default_factory=list)


class RoutePlanResponse(BaseModel):
    """路线规划接口的返回结构。"""

    summary: str
    highlights: list[str] = Field(default_factory=list)
    estimated_minutes: int
