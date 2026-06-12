# AI 助手多模态模型优化方案

> **版本**: v1.0  
> **日期**: 2026-06-04  
> **现状**: DeepSeek (纯文本) → **目标**: 支持图片理解的多模态 AI 助手

---

## 目录

1. [现状分析](#1-现状分析)
2. [问题诊断](#2-问题诊断)
3. [方案对比](#3-方案对比)
4. [推荐方案：混合模型架构](#4-推荐方案混合模型架构)
5. [详细实施计划](#5-详细实施计划)
6. [成本估算](#6-成本估算)
7. [风险评估与缓解](#7-风险评估与缓解)
8. [验收标准](#8-验收标准)

---

## 1. 现状分析

### 1.1 当前架构

```
┌──────────┐     ┌─────────────────┐     ┌──────────────────┐
│  React   │────▶│  Spring Boot    │────▶│  Python Agent    │
│  Frontend│     │  (Port 8080)    │     │  FastAPI (:9000) │
└──────────┘     └─────────────────┘     └────────┬─────────┘
                                                   │
                                          ┌────────▼─────────┐
                                          │   LLM Client      │
                                          │  (llm_client.py)  │
                                          └────────┬─────────┘
                                                   │
                                   ┌───────────────┼───────────────┐
                                   │               │               │
                              OpenAICompat    Anthropic       (可扩展)
                                   │
                              ┌────▼────┐
                              │ DeepSeek│  ← 当前唯一使用
                              │ (纯文本) │
                              └─────────┘
```

### 1.2 已有但不可用的功能

代码中 **已经实现** 了多模态基础设施，但因 DeepSeek 不支持视觉而无法工作：

| 文件 | 功能 | 状态 |
|------|------|------|
| `llm_client.py:55-64` | `build_vision_content()` — 构建多模态 vision blocks | ✅ 已实现，🔴 不可用 |
| `llm_client.py:67-81` | `_convert_vision_to_anthropic()` — OpenAI→Anthropic 格式转换 | ✅ 已实现，🔴 不可用 |
| `diary_agent.py:328-365` | `_understand_images()` — 图片内容识别 | ✅ 已实现，🔴 不可用 |
| `diary_agent.py:90-99` | 日记生成 5 阶段流水线（阶段1=图片理解） | ✅ 已实现，🔴 不可用 |

### 1.3 关键发现

1. **架构已就绪**: `BaseLLMProvider` 抽象接口完整支持多 provider 切换
2. **Vision 管道已铺设**: `build_vision_content` 函数和 Anthropic 格式转换均已就绪
3. **仅需换模型**: 将 `LLM_MODEL` 从 `deepseek-chat` 改为 `qwen-vl-plus` 即可激活视觉功能
4. **降级机制完善**: 无 LLM 时自动降级为规则模式，不影响服务可用性

### 1.4 涉及图片的业务场景

| 场景 | 优先级 | 当前状态 | 期望效果 |
|------|--------|----------|----------|
| 📸 拍照生成游记 | 🔴 核心 | 图片被忽略，仅用文本 | 识别照片内容，生成精准游记 |
| 📍 图片识别地点 | 🔴 核心 | 不支持 | 识别地标建筑、景点，自动标注位置 |
| 🍜 美食识别 | 🟡 重要 | 不支持 | 识别菜品，推荐相似美食 |
| 🏛️ 建筑/景点识别 | 🟡 重要 | 不支持 | 识别校园/景区建筑，提供导览信息 |
| 🎨 风格参考图 | 🟢 增强 | 不支持 | 根据参考图风格调整游记文风 |

---

## 2. 问题诊断

### 2.1 DeepSeek 模型能力矩阵

| 能力 | deepseek-chat | deepseek-reasoner |
|------|:---:|:---:|
| 文本生成 | ✅ 优秀 | ✅ 优秀 |
| 代码生成 | ✅ 优秀 | ✅ 优秀 |
| 推理分析 | ✅ 良好 | ✅ 卓越 |
| 中文理解 | ✅ 优秀 | ✅ 优秀 |
| **图片理解** | ❌ 不支持 | ❌ 不支持 |
| **多模态输入** | ❌ 不支持 | ❌ 不支持 |
| 工具调用 | ✅ 支持 | ⚠️ 有限 |

### 2.2 核心痛点

```
用户上传旅行照片 → DiaryAgent._understand_images()
                         │
                         ▼
              build_vision_content(text, [image_url])
                         │
                         ▼
              client.chat(messages)  ← DeepSeek API
                         │
                         ▼
              ❌ API 返回错误/忽略图片
                         │
                         ▼
              日记仅基于文本生成，丢失图片信息
```

**后果**: 用户上传了在西湖拍的照片，AI 生成的游记完全不提西湖——因为根本"看不见"照片。

---

## 3. 方案对比

### 方案 A：全量迁移通义千问

将所有 LLM 调用从 DeepSeek 切换到通义千问（Qwen）。

```
所有请求 → Qwen (qwen-plus / qwen-max / qwen-vl-max)
```

| 维度 | 评估 |
|------|------|
| 🔧 改动量 | ⭐⭐⭐⭐⭐ 极小（改 `.env` 即可） |
| 🖼️ 图片能力 | ⭐⭐⭐⭐ qwen-vl-max 视觉能力强 |
| 📝 文本质量 | ⭐⭐⭐⭐ 中文优化，但对复杂推理略逊 DeepSeek |
| 💰 成本 | ⭐⭐⭐ Qwen 价格高于 DeepSeek |
| 🔒 厂商锁定 | ⭐⭐ 单一供应商风险 |
| 🧪 测试成本 | ⭐⭐⭐ 需要全面回归测试 |

**成本对比** (每百万 token, RMB):

| 模型 | 输入价格 | 输出价格 |
|------|----------|----------|
| deepseek-chat | ¥1.0 | ¥2.0 |
| qwen-plus | ¥2.0 | ¥6.0 |
| qwen-max | ¥20.0 | ¥60.0 |
| qwen-vl-plus (视觉) | ¥3.0 | ¥9.0 |
| qwen-vl-max (视觉) | ¥5.0 | ¥15.0 |

### 方案 B：混合模型架构 ⭐ 推荐

按任务类型路由到不同模型：文本任务用 DeepSeek，图片任务用 Qwen VL。

```
         ┌─────────────┐
         │  请求入口    │
         └──────┬──────┘
                │
         ┌──────▼──────┐
         │  意图识别    │  ← DeepSeek (或规则模式)
         └──────┬──────┘
                │
     ┌──────────┼──────────┐
     │          │          │
┌────▼────┐ ┌───▼────┐ ┌──▼─────┐
│文本任务 │ │图片任务│ │混合任务│
│DeepSeek│ │Qwen VL │ │路由分发│
└────────┘ └────────┘ └────────┘
```

| 维度 | 评估 |
|------|------|
| 🔧 改动量 | ⭐⭐⭐ 中等（需新增路由层） |
| 🖼️ 图片能力 | ⭐⭐⭐⭐⭐ Qwen VL 专注视觉 |
| 📝 文本质量 | ⭐⭐⭐⭐⭐ 保留 DeepSeek 文本优势 |
| 💰 成本 | ⭐⭐⭐⭐ 按需使用，文本仍走低价通道 |
| 🔒 厂商灵活性 | ⭐⭐⭐⭐⭐ 多供应商，可随时替换 |
| 🧪 可测试性 | ⭐⭐⭐⭐ 模型隔离，独立测试 |

### 方案 C：仅 Anthropic Claude

| 维度 | 评估 |
|------|------|
| 🔧 改动量 | ⭐⭐⭐⭐ 小（已有 AnthropicProvider） |
| 🖼️ 图片能力 | ⭐⭐⭐⭐⭐ Claude 视觉能力顶级 |
| 💰 成本 | ⭐⭐ Claude 价格较高 |
| 🌐 国内访问 | ⭐ 需要代理，延迟高 |

### 综合评分

| 维度 (权重) | 方案 A 全量Qwen | 方案 B 混合 ⭐ | 方案 C Claude |
|-------------|:---:|:---:|:---:|
| 改动成本 (20%) | 9 | 7 | 8 |
| 视觉能力 (25%) | 8 | 9 | 10 |
| 文本能力 (20%) | 7 | 9 | 9 |
| 运行成本 (15%) | 6 | 8 | 4 |
| 厂商灵活 (10%) | 4 | 10 | 3 |
| 国内可用 (10%) | 9 | 9 | 2 |
| **加权总分** | **7.35** | **8.60** | **6.55** |

> **结论：推荐方案 B（混合模型架构）**

---

## 4. 推荐方案：混合模型架构

### 4.1 核心设计理念

> **"文本对话用 DeepSeek，图片理解用 Qwen VL，各取所长"**

### 4.2 模型路由策略

```
                    ┌──────────────────────┐
                    │    ModelRouter        │
                    │  (新增路由层)          │
                    └──────────┬───────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
     ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
     │ has_images? │   │ intent=     │   │ intent=     │
     │ YES         │   │ generate_   │   │ plan_trip_  │
     │             │   │ diary       │   │ route       │
     └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
            │                  │                  │
     ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
     │  Qwen VL    │   │ has_images? │   │  DeepSeek   │
     │  (视觉模型)  │   │ YES→QwenVL │   │  (文本模型)  │
     │             │   │ NO →DeepSeek│   │             │
     └─────────────┘   └─────────────┘   └─────────────┘
```

### 4.3 模型职责划分

| 模型 | 职责 | 使用场景 |
|------|------|----------|
| **DeepSeek Chat** | 文本对话、推理、工具调用 | 闲聊、路线规划、地点推荐、意图识别、要素提取、文本润色 |
| **Qwen VL Plus** | 图片理解、多模态分析 | 照片地点识别、美食识别、建筑识别、图片描述生成 |
| **Qwen VL Max** | 高质量图片理解 (可选) | 复杂场景识别、精细图片分析（按需升级） |

### 4.4 新增/修改文件清单

```
agent-service/app/
├── core/
│   └── model_router.py          ← 🆕 模型路由层
├── agent/
│   ├── llm_client.py            ← 🔧 扩展：支持多模型实例
│   ├── diary_agent.py           ← 🔧 修改：图片理解走 Qwen VL
│   └── ...
├── config.py                    ← 🔧 扩展：新增 Qwen 模型配置
└── .env.example                 ← 🔧 更新：添加 Qwen 配置项
```

---

## 5. 详细实施计划

### 阶段 0：准备 (0.5 天)

#### 5.0.1 开通通义千问 API

1. 注册阿里云百炼平台账号
2. 开通 DashScope 模型服务
3. 获取 API Key
4. 申请 `qwen-vl-plus` 和 `qwen-plus` 模型权限

#### 5.0.2 验证可用性

```bash
# 测试 Qwen VL 视觉接口
curl -X POST https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-vl-plus",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "这张图片里有什么？"},
        {"type": "image_url", "image_url": {"url": "https://example.com/test.jpg"}}
      ]
    }]
  }'
```

### 阶段 1：配置层扩展 (0.5 天)

#### 5.1.1 扩展 `config.py`

新增多模型配置字段：

```python
# config.py 新增字段
@dataclass(frozen=True)
class Settings:
    # ... 现有字段保持不变 ...

    # ============ 多模型配置 ============

    # 文本模型（默认 DeepSeek）
    text_model: str = os.getenv("TEXT_LLM_MODEL", "deepseek-chat")
    text_base_url: str = os.getenv("TEXT_LLM_BASE_URL", "https://api.deepseek.com")
    text_api_key: str = os.getenv("TEXT_LLM_API_KEY", "")

    # 视觉模型（Qwen VL）
    vision_model: str = os.getenv("VISION_LLM_MODEL", "qwen-vl-plus")
    vision_base_url: str = os.getenv(
        "VISION_LLM_BASE_URL",
        "https://dashscope.aliyuncs.com/compatible-mode/v1",
    )
    vision_api_key: str = os.getenv("VISION_LLM_API_KEY", "")

    # 是否启用混合模式（关闭时全部走文本模型）
    hybrid_mode: bool = os.getenv("HYBRID_MODE", "true").lower() == "true"
```

#### 5.1.2 更新 `.env.example`

```bash
# ===== 文本模型配置（对话/推理/工具调用） =====
TEXT_LLM_MODEL=deepseek-chat
TEXT_LLM_BASE_URL=https://api.deepseek.com
TEXT_LLM_API_KEY=your-deepseek-api-key

# ===== 视觉模型配置（图片理解/多模态分析） =====
VISION_LLM_MODEL=qwen-vl-plus
VISION_LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
VISION_LLM_API_KEY=your-dashscope-api-key

# ===== 混合模式开关 =====
# true: 图片任务走视觉模型，文本任务走文本模型
# false: 所有任务走文本模型（降级模式）
HYBRID_MODE=true
```

### 阶段 2：模型路由层 (1 天)

#### 5.2.1 新增 `core/model_router.py`

```python
"""
模型路由器 — 根据任务类型自动选择最合适的模型。

路由规则：
1. 请求包含图片 → 视觉模型（Qwen VL）
2. intent=generate_diary + 有图片 → 视觉模型
3. 纯文本任务 → 文本模型（DeepSeek）
"""
from __future__ import annotations

import logging
from typing import Any

from app.agent.llm_client import (
    BaseLLMProvider,
    OpenAICompatibleProvider,
    build_vision_content,
)
from app.config import settings

logger = logging.getLogger(__name__)


class ModelRouter:
    """管理多个 LLM 实例，按任务特征路由到合适的模型。"""

    def __init__(self):
        self._text_client: BaseLLMProvider | None = None
        self._vision_client: BaseLLMProvider | None = None
        self._fallback_client: BaseLLMProvider | None = None

    @property
    def text_client(self) -> BaseLLMProvider:
        """文本模型客户端（懒加载）。"""
        if self._text_client is None:
            api_key = settings.text_api_key or settings.llm_api_key
            base_url = settings.text_base_url or settings.llm_base_url
            model = settings.text_model or settings.llm_model
            self._text_client = OpenAICompatibleProvider(
                api_key=api_key,
                base_url=base_url,
                model=model,
                timeout_ms=settings.llm_timeout_ms,
            )
            logger.info("文本模型已初始化: %s @ %s", model, base_url)
        return self._text_client

    @property
    def vision_client(self) -> BaseLLMProvider | None:
        """视觉模型客户端（懒加载，可能不可用）。"""
        if not settings.hybrid_mode:
            return None
        if self._vision_client is None:
            api_key = settings.vision_api_key or settings.llm_api_key
            if not api_key:
                logger.warning("视觉模型 API Key 未配置，图片理解将降级")
                return None
            self._vision_client = OpenAICompatibleProvider(
                api_key=api_key,
                base_url=settings.vision_base_url,
                model=settings.vision_model,
                timeout_ms=settings.llm_timeout_ms,
            )
            logger.info("视觉模型已初始化: %s", settings.vision_model)
        return self._vision_client

    def route(
        self,
        messages: list[dict[str, Any]],
        intent: str = "",
        has_images: bool = False,
    ) -> BaseLLMProvider:
        """
        根据任务特征选择最合适的模型。

        规则（优先级从高到低）：
        1. has_images=True → vision_client
        2. intent=generate_diary → vision_client（日记生成通常涉及图片）
        3. 其他 → text_client

        降级策略：vision_client 不可用时 → text_client
        """
        needs_vision = has_images or self._intent_needs_vision(intent)

        if needs_vision and self.vision_client is not None:
            logger.debug("路由到视觉模型: intent=%s, has_images=%s", intent, has_images)
            return self.vision_client

        logger.debug("路由到文本模型: intent=%s, has_images=%s", intent, has_images)
        return self.text_client

    @staticmethod
    def _intent_needs_vision(intent: str) -> bool:
        """判断意图是否需要视觉能力。"""
        vision_intents = {
            "generate_diary",       # 日记生成常伴随图片
            "analyze_image",        # 显式图片分析
            "identify_place",       # 图片识别地点
            "identify_food",        # 图片识别美食
        }
        return intent in vision_intents

    def vision_available(self) -> bool:
        """视觉模型是否可用。"""
        return self.vision_client is not None

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
        """自动路由并调用 LLM — 对调用方透明。"""
        client = self.route(messages, intent, has_images)
        return client.chat(
            messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stop=stop,
            tools=tools,
        )


# 全局单例
model_router = ModelRouter()
```

### 阶段 3：集成改造 (1 天)

#### 5.3.1 修改 `diary_agent.py` — 图片理解走视觉模型

`_understand_images()` 方法几乎不需要改，因为现有的 `build_vision_content()` + `client.chat()` 调用方式与 Qwen VL 完全兼容（OpenAI 格式）。只需要确保路由到视觉模型：

```python
# diary_agent.py 修改点

def _understand_images(self, images: list[str]) -> list[str]:
    """调用多模态 LLM 识别图片内容。"""
    if not images:
        return []

    # 检查视觉模型可用性
    from app.core.model_router import model_router
    if not model_router.vision_available():
        return [f"[图片 {i+1}]（视觉模型未配置，请手动描述）" for i in range(len(images))]

    from app.agent.llm_client import build_vision_content

    descriptions: list[str] = []
    client = model_router.vision_client  # ← 直接使用视觉模型

    for i, img_url in enumerate(images):
        try:
            msgs = [
                {
                    "role": "system",
                    "content": (
                        "你是一位旅行摄影师和地理专家，擅长从照片中识别景点、"
                        "建筑、美食和活动场景。请尽可能识别出具体地点名称。"
                    ),
                },
                {
                    "role": "user",
                    "content": build_vision_content(
                        "请详细描述这张旅行照片的内容，包括：\n"
                        "1. 拍摄地点/场景（如能识别具体地点请明确指出）\n"
                        "2. 画面中的主要事物（建筑、自然景观、食物、人物活动等）\n"
                        "3. 画面传达的氛围和情绪\n"
                        "4. 如果是知名景点/建筑/美食，请直接说出名称",
                        [img_url],
                    ),
                },
            ]
            result = client.chat(msgs, max_tokens=500)
            descriptions.append(result.content or "")
        except Exception as e:
            logger.warning("图片 %s 识别失败: %s", img_url, e)
            descriptions.append(f"[图片 {i+1}] 识别失败")

    return descriptions
```

#### 5.3.2 修改 `llm_client.py` — 保持向后兼容

`get_llm_client()` 保持不变，默认仍返回文本模型。视觉模型通过 `model_router` 独立获取。

#### 5.3.3 修改 `core/llm.py` — 保持向后兼容

```python
# core/llm.py — get_llm() 仍返回文本模型，现有代码无需改动
def get_llm():
    """返回文本 LLM 客户端（向后兼容）。"""
    global _llm_client
    if _llm_client is None:
        try:
            from app.core.model_router import model_router
            _llm_client = model_router.text_client
        except Exception as e:
            logger.warning("LLM 客户端初始化失败: %s", e)
            _llm_client = False
    return _llm_client if _llm_client is not False else None
```

### 阶段 4：高级功能增强 (2 天)

#### 5.4.1 图片地点识别 API

新增独立的图片地点识别端点，用于"拍照识地点"功能：

```python
# 新增工具: tools/image_place_recognition.py

async def identify_place_from_image(image_url: str) -> dict:
    """
    从图片中识别旅游地点。

    返回:
    {
        "place_name": "西湖",
        "confidence": 0.92,
        "location": {"lat": 30.23, "lng": 120.14},
        "category": "自然景观",
        "nearby_places": [...],    # 附近推荐
        "description": "..."
    }
    """
    client = model_router.vision_client
    msgs = [{
        "role": "user",
        "content": build_vision_content(
            "请识别这张照片中的旅游景点或地点..."
            "返回 JSON: {place_name, confidence, category, description}",
            [image_url],
        ),
    }]
    result = client.chat(msgs, max_tokens=500)
    return parse_json(result.content)
```

#### 5.4.2 美食识别增强

```python
# 新增工具: tools/image_food_recognition.py

async def identify_food_from_image(image_url: str) -> dict:
    """
    从图片中识别美食。

    返回:
    {
        "food_name": "东坡肉",
        "cuisine": "杭帮菜",
        "confidence": 0.88,
        "description": "...",
        "related_foods_in_system": [...]  # 从系统美食库匹配
    }
    """
```

#### 5.4.3 多图游记增强

利用 Qwen VL 的多图理解能力，支持一次上传多张图片生成完整游记：

```python
# diary_agent.py 增强

async def _understand_multiple_images(
    self, images: list[str], context: str = ""
) -> str:
    """
    一次理解多张图片的关系，生成连贯的旅行叙事。

    适用场景：用户上传了一天的旅行照片（3-5张），
    AI 按时间线/地点线串成一个完整故事。
    """
    content_blocks = [{"type": "text", "text": 
        "以下是用户一天旅行中按时间顺序拍摄的照片，"
        "请按照照片顺序，讲述这一天的旅行故事。"
        f"用户补充信息：{context}"
        "请注意照片之间的地点变化、活动转换和情绪起伏。"
    }]
    for url in images:
        content_blocks.append({
            "type": "image_url",
            "image_url": {"url": url}
        })

    client = model_router.vision_client
    result = client.chat([
        {"role": "system", "content": "你是一位旅行故事讲述者。"},
        {"role": "user", "content": content_blocks},
    ], max_tokens=2000)
    return result.content or ""
```

### 阶段 5：测试与验证 (1.5 天)

#### 5.5.1 单元测试

```python
# tests/test_model_router.py

class TestModelRouter:
    def test_route_text_task_to_deepseek(self):
        """纯文本请求应路由到文本模型"""
        ...

    def test_route_image_task_to_qwen_vl(self):
        """图片请求应路由到视觉模型"""
        ...

    def test_fallback_when_vision_unavailable(self):
        """视觉模型不可用时降级到文本模型"""
        ...

    def test_diary_intent_without_images(self):
        """日记生成无图片时，仍使用文本模型"""
        ...

    def test_hybrid_mode_disabled(self):
        """HYBRID_MODE=false 时全部走文本模型"""
        ...
```

#### 5.5.2 集成测试

```python
# tests/test_vision_integration.py

class TestVisionIntegration:
    async def test_image_understanding_with_qwen_vl(self):
        """端到端测试：上传图片 → 生成含图片内容的日记"""
        images = ["https://example.com/west_lake.jpg"]
        result = await diary_agent.process("写一篇西湖游记", images)
        assert "西湖" in result.content
        ...

    async def test_multi_image_storyline(self):
        """多张图片 → 按时间线生成连贯故事"""
        ...

    async def test_food_recognition(self):
        """上传美食图片 → 识别菜品名称"""
        ...

    async def test_place_identification(self):
        """上传景点图片 → 识别地点名称和位置"""
        ...
```

#### 5.5.3 回归测试

确保现有文本功能不受影响：

- ✅ 路线规划仍正常工作
- ✅ 纯文本对话仍正常
- ✅ 意图识别准确率不下降
- ✅ 工具调用链完整
- ✅ SSE 流式输出正常

### 阶段 6：前端适配 (1 天)

#### 6.1 图片上传组件增强

```tsx
// 前端增加「拍照识地点」入口
<ImageUpload
  onUpload={async (file) => {
    const place = await api.identifyPlaceFromImage(file);
    // 显示识别结果：地点名称、位置、推荐
    setRecognizedPlace(place);
  }}
  hint="上传景点照片，AI 帮你识别这是哪里"
/>
```

#### 6.2 日记生成页面增强

```tsx
// 日记生成页：支持拖拽多张图片
<DiaryGeneratePage>
  <ImageGrid 
    images={uploadedImages}
    onAnalyze={() => {
      // 显示每张图片的识别结果
      showImageDescriptions();
    }}
  />
  <StyleSelector />
  <GenerateButton />
</DiaryGeneratePage>
```

---

## 6. 成本估算

### 6.1 月度成本预估（中等使用量）

假设月均 5000 次请求，其中 20% 涉及图片：

| 任务类型 | 模型 | 月请求量 | 单次均价 | 月成本 |
|----------|------|----------|----------|--------|
| 文本对话 | deepseek-chat | 4,000 | ¥0.003 | ¥12 |
| 意图识别 | deepseek-chat | 4,000 | ¥0.001 | ¥4 |
| 文本要素提取 | deepseek-chat | 500 | ¥0.005 | ¥2.5 |
| 图片理解 | qwen-vl-plus | 1,000 | ¥0.015 | ¥15 |
| 日记生成(含图) | qwen-vl-plus | 200 | ¥0.02 | ¥4 |
| **合计** | | | | **≈ ¥37.5/月** |

> 对比方案 A（全量 Qwen VL Max）：约 ¥150-200/月  
> 混合方案可节省约 **75-80%** 成本

### 6.2 成本优化建议

1. **图片压缩**: 上传前压缩到 1024px，减少 token 消耗
2. **缓存策略**: 相同图片的识别结果缓存 24h
3. **分级模型**: 简单图片用 `qwen-vl-plus`，复杂场景才升级 `qwen-vl-max`
4. **按需启用**: `HYBRID_MODE=false` 可随时关闭视觉模型降本

---

## 7. 风险评估与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|:---:|:---:|------|
| Qwen VL API 不稳定 | 中 | 高 | 自动降级到文本模式 + 重试机制 |
| 图片识别准确率不达标 | 中 | 中 | 提示词优化 + 结合地点数据库校验 |
| DeepSeek API 和 Qwen 同时故障 | 低 | 高 | 保留规则模式兜底 |
| API 费用超预算 | 低 | 中 | 月度预算告警 + 用量监控 |
| 多模型导致排查困难 | 中 | 低 | trace 中记录 `model_used` 字段 |
| Qwen 图片识别带有幻觉 | 中 | 中 | 置信度阈值 + 地点数据库交叉验证 |

### 7.1 降级策略

```
视觉模型可用？
  ├── YES → 使用 Qwen VL 处理图片
  │          ├── 成功 → 返回识别结果
  │          └── 失败 → 重试 1 次
  │                     ├── 成功 → 返回
  │                     └── 失败 → 降级到纯文本模式
  │                                （返回 "[图片] 请手动描述"）
  └── NO  → 纯文本模式
             （返回 "[图片] 视觉模型未配置"）
```

---

## 8. 验收标准

### 8.1 功能验收

- [ ] 上传旅游照片（西湖/故宫/校园建筑），AI 能识别出具体地点名称
- [ ] 上传美食照片，AI 能识别菜品名称和类型
- [ ] 多张照片生成日记时，日记内容包含图片中识别的地点/食物/活动
- [ ] 纯文本对话（无图片）仍使用 DeepSeek，质量不下降
- [ ] 路线规划、地点推荐等文本功能功能正常
- [ ] `HYBRID_MODE=false` 时，全部降级为文本模式，服务可用

### 8.2 性能验收

- [ ] 图片识别响应时间 < 5 秒
- [ ] 文本对话响应时间无明显增加
- [ ] 日记生成总时长（含图片识别）< 15 秒

### 8.3 稳定性验收

- [ ] Qwen VL API 故障时自动降级，不阻塞服务
- [ ] 48 小时压测无内存泄漏
- [ ] 所有现有集成测试通过

### 8.4 成本验收

- [ ] 部署一周后月度成本在预算范围内
- [ ] trace 中记录了每次请求的 `model_used` 字段

---

## 附：实施时间线

```
Week 1:
  Day 1   ████ 阶段0: API 开通 + 阶段1: 配置扩展
  Day 2   ████ 阶段2: ModelRouter 开发 + 单元测试
  Day 3   ████ 阶段3: 集成改造 (diary_agent + llm_client)
  Day 4   ████ 阶段4: 图片识别 API + 美食识别
  Day 5   ████ 阶段5: 集成测试 + 回归测试

Week 2:
  Day 6-7 ████ 阶段6: 前端适配
  Day 8   ████ 灰度发布 + 监控
  Day 9   ████ 问题修复 + 优化
  Day 10  ████ 正式发布 + 文档更新
```

---

## 总结

**推荐方案**：混合模型架构（方案 B）

**核心策略**：DeepSeek 负责 80% 的文本任务（对话、推理、工具调用），Qwen VL 负责 20% 的图片任务（地点识别、美食识别、多图游记）。

**关键优势**：
1. 🎯 **精准解决痛点** — 图片理解从"不可用"变为"可用"
2. 💰 **成本可控** — 文本仍走低价 DeepSeek，视觉按需使用 Qwen VL
3. 🔧 **改动最小** — 现有架构已就绪，核心只需新增路由层
4. 🛡️ **风险可控** — 多级降级策略，任一模型故障不影响整体服务
5. 🔄 **灵活扩展** — 未来可无缝替换任一模型（如换 GPT-4o、Gemini 等）
