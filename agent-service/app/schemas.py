from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ==================== 消息与会话 ====================


class ChatMessage(BaseModel):
    role: str
    content: str
    created_at: str


class SessionSummary(BaseModel):
    session_id: str
    user_id: str
    title: str
    preview: str
    mode: str
    updated_at: str
    created_at: str
    message_count: int


class SessionDetail(SessionSummary):
    messages: list[ChatMessage] = Field(default_factory=list)


# ==================== 聊天请求/响应 ====================


class ChatRequest(BaseModel):
    model_config = {"populate_by_name": True}

    user_id: str = Field(default="anonymous", min_length=1, alias="userId")
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: str | None = Field(default=None, alias="sessionId")
    mode: str = Field(default="travel_assistant")
    metadata: dict[str, Any] = Field(default_factory=dict)


class ChatReply(BaseModel):
    content: str
    intent: str
    trace_id: str
    suggestions: list[str] = Field(default_factory=list)
    tools_used: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ChatResponse(BaseModel):
    session: SessionDetail
    reply: ChatReply


# ==================== 日记生成 ====================


class DiaryGenerateRequest(BaseModel):
    model_config = {"populate_by_name": True}

    user_id: str = Field(default="anonymous", alias="userId")
    prompt: str = Field(default="", max_length=4000)
    images: list[str] = Field(default_factory=list, max_length=6)
    style: str = Field(default="小红书")
    metadata: dict[str, Any] = Field(default_factory=dict)


class DiaryTaskStatus(BaseModel):
    task_id: str
    status: str  # pending / running / completed / failed
    progress: int
    message: str
    result: dict[str, Any] | None = None
    error: str | None = None


class DiaryGenerateResponse(BaseModel):
    task_id: str
    status: str
    progress: int
    message: str


# ==================== 健康检查 ====================


class HealthResponse(BaseModel):
    status: str
    agent_name: str
    version: str
    timestamp: datetime
    agents: list[dict[str, Any]] = Field(default_factory=list)


# ==================== 会话管理 ====================


class SessionRenameRequest(BaseModel):
    user_id: str = Field(default="anonymous", alias="userId")
    title: str = Field(..., min_length=1, max_length=50)


class SessionDeleteRequest(BaseModel):
    user_id: str = Field(default="anonymous", alias="userId")


# ==================== 意图识别 ====================


class IntentSlots(BaseModel):
    destination: str | None = None
    days: float | None = None
    budget: str | None = None
    interests: list[str] = Field(default_factory=list)
    transport: str | None = None
    pace: str | None = None
    images: bool | None = None
    location: str | None = None
    style: str | None = None
    preference: str | None = None
    keyword: str | None = None
    place_type: str | None = None


class IntentResult(BaseModel):
    intent: str
    confidence: float
    slots: dict[str, Any] = Field(default_factory=dict)
    missing_slots: list[str] = Field(default_factory=list, alias="missingSlots")
    should_ask_clarifying_question: bool = Field(default=False, alias="shouldAskClarifyingQuestion")
    clarifying_question: str = Field(default="", alias="clarifyingQuestion")


# ==================== 路线规划 ====================


class RoutePlanRequest(BaseModel):
    model_config = {"populate_by_name": True}

    user_id: str = Field(default="anonymous", alias="userId")
    requirement: str = Field(..., min_length=1, max_length=4000)


class RoutePlanResponse(BaseModel):
    status: str
    result: dict[str, Any] = Field(default_factory=dict)


# ==================== 出游搭子 ====================


class BuddyProfile(BaseModel):
    id: str
    name: str
    personality: str = ""
    speaking_style: str = ""
    is_preset: bool = False
    preference_score: float = 0


class CreateBuddyRequest(BaseModel):
    user_id: str = Field(default="anonymous", alias="userId")
    buddy_id: str | None = Field(default=None, alias="buddyId")
    name: str = Field(..., min_length=1, max_length=20)
    personality: str = Field(default="", max_length=500)
    speaking_style: str = Field(default="", max_length=500)
