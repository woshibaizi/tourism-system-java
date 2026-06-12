from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ==================== 消息与会话 ====================


class ChatMessage(BaseModel):
    model_config = {"extra": "allow", "populate_by_name": True}

    role: str
    content: str
    created_at: str
    images: list[str] | None = None  # 图片 URL 列表（用户消息含图片时）
    metadata: dict[str, Any] | None = None  # 前端元数据（diaryCard / diary_style / serverImages 等）


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
    message: str = Field(default="", min_length=0, max_length=4000)  # 允许空消息（纯图片时）
    session_id: str | None = Field(default=None, alias="sessionId")
    mode: str = Field(default="travel_assistant")
    metadata: dict[str, Any] = Field(default_factory=dict)
    images: list[str] = Field(default_factory=list)  # 图片 URL 列表，支持多模态对话


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


# ==================== 风格定义 ====================

VALID_TONES = {"活泼", "文艺", "幽默", "毒舌", "温暖", "冷静", "热血", "随性"}
VALID_LENGTHS = {"short", "medium", "long"}
VALID_EMOJI_DENSITIES = {"none", "low", "medium", "high"}
VALID_PARAGRAPH_STYLES = {"short", "normal", "flow"}
VALID_PERSONS = {"first", "second", "third"}
VALID_FOCUS_AREAS = {"风景", "美食", "人文", "打卡", "攻略"}
VALID_PRESETS = {"小红书", "朋友圈", "游记", "随笔", "攻略", "回忆", "幽默吐槽", "自定义"}


class StyleProfile(BaseModel):
    """结构化风格参数模型 — 8 维度可组合、可自定义。

    所有字段均为可选：未指定时使用预设模板的默认值，
    或系统全局默认值（小红书活泼风）。
    """
    preset: str | None = Field(
        default=None,
        description="预设风格模板名称，为空表示纯自定义组合",
    )
    tone: str | None = Field(
        default=None,
        description=f"语气控制: {'/'.join(sorted(VALID_TONES))}",
    )
    length: str | None = Field(
        default=None,
        description=f"篇幅控制: {'/'.join(sorted(VALID_LENGTHS))}",
    )
    emoji_density: str | None = Field(
        default=None, alias="emojiDensity",
        description=f"emoji 使用频率: {'/'.join(sorted(VALID_EMOJI_DENSITIES))}",
    )
    paragraph_style: str | None = Field(
        default=None, alias="paragraphStyle",
        description=f"段落风格: {'/'.join(sorted(VALID_PARAGRAPH_STYLES))}",
    )
    person: str | None = Field(
        default=None,
        description=f"人称视角: {'/'.join(sorted(VALID_PERSONS))}",
    )
    focus_on: list[str] | None = Field(
        default=None, alias="focusOn",
        description=f"内容侧重 (可多选): {'/'.join(sorted(VALID_FOCUS_AREAS))}",
    )
    hashtag_count: int | None = Field(
        default=None, alias="hashtagCount", ge=0, le=10,
        description="话题标签数量，0 表示不添加标签",
    )
    custom_prompt: str | None = Field(
        default=None, alias="customPrompt", max_length=2000,
        description="自由文本风格描述，优先级最高",
    )
    use_buddy: bool = Field(
        default=False, alias="useBuddy",
        description="是否复用当前出游搭子的人格风格",
    )

    model_config = {"populate_by_name": True}


# ==================== 日记生成 ====================


class DiaryGenerateRequest(BaseModel):
    model_config = {"populate_by_name": True}

    user_id: str = Field(default="anonymous", alias="userId")
    prompt: str = Field(default="", max_length=4000)
    images: list[str] = Field(default_factory=list, max_length=6)
    style: str = Field(default="小红书")
    style_profile: StyleProfile | None = Field(
        default=None, alias="styleProfile",
        description="结构化风格参数（优先于 style 字段）",
    )
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


class DiaryRegenerateRequest(BaseModel):
    model_config = {"populate_by_name": True}

    user_id: str = Field(default="anonymous", alias="userId")
    original_task_id: str = Field(..., alias="originalTaskId")
    style: str = Field(default="小红书")
    style_profile: StyleProfile | None = Field(
        default=None, alias="styleProfile",
    )


class StylePrefsResponse(BaseModel):
    user_id: str
    style_profile: dict[str, Any] | None = None
    last_style: str = "小红书"


# ==================== 轻量级 AI 写作辅助 ====================


class DiaryPolishRequest(BaseModel):
    """AI 润色已有文本"""
    model_config = {"populate_by_name": True}

    user_id: str = Field(default="anonymous", alias="userId")
    content: str = Field(..., min_length=1, max_length=10000)
    style_hint: str | None = Field(default=None, alias="styleHint", max_length=500)


class DiaryPolishResponse(BaseModel):
    polished: str  # 润色后文本


class DiarySuggestTitleRequest(BaseModel):
    """AI 根据内容生成标题候选"""
    model_config = {"populate_by_name": True}

    user_id: str = Field(default="anonymous", alias="userId")
    content: str = Field(..., min_length=1, max_length=10000)
    count: int = Field(default=3, ge=1, le=5)


class DiarySuggestTitleResponse(BaseModel):
    titles: list[str]


class DiaryExtractTagsRequest(BaseModel):
    """AI 从内容提取标签"""
    model_config = {"populate_by_name": True}

    user_id: str = Field(default="anonymous", alias="userId")
    content: str = Field(..., min_length=1, max_length=10000)
    count: int = Field(default=5, ge=1, le=10)


class DiaryExtractTagsResponse(BaseModel):
    tags: list[str]


class DiaryDescribeImagesRequest(BaseModel):
    """AI 图生文"""
    model_config = {"populate_by_name": True}

    user_id: str = Field(default="anonymous", alias="userId")
    images: list[str] = Field(..., min_length=1, max_length=6)


class DiaryDescribeImagesResponse(BaseModel):
    descriptions: list[str]  # 每张图片一段描述


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


class DiaryPublishRequest(BaseModel):
    """对话式游记一键发布"""
    model_config = {"populate_by_name": True}

    user_id: str = Field(default="anonymous", alias="userId")
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1, max_length=50000)
    images: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    place_id: str = Field(default="", alias="placeId")
    style: str = Field(default="小红书")
    session_id: str | None = Field(default=None, alias="sessionId")


class DiaryPublishResponse(BaseModel):
    diary_id: str = ""
    success: bool = False
    title: str = ""
    error: str | None = None


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
