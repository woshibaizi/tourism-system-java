# Agent 系统架构全景分析

## 概览

`agent-service/` 是一个 Python FastAPI 服务，作为"旅游个性化助手"的 AI 编排层。它位于 Java Spring Boot 后端和前端之间，负责 **意图理解 → Agent路由 → 工具调用 → 响应生成** 的完整链路。

---

## 1. 整体分层架构

```
┌─────────────────────────────────────────────────┐
│                  FastAPI 入口                     │
│   main.py  — 26 个 HTTP 端点                     │
├─────────────────────────────────────────────────┤
│               Dispatcher 调度层                   │
│   dispatcher.py  — 意图路由 + Agent分派 + trace   │
├──────────┬──────────┬──────────┬────────────────┤
│ ChatAgent│RouteAgent│DiaryAgent│ SceneAgent      │
│ (主对话) │ (路线)   │ (日记)   │ (此刻出发)       │
├──────────┼──────────┼──────────┼────────────────┤
│DiceAgent │PersonaAgt│MemoryAgt │ BaseAgent(ABC) │
│ (扔骰子) │ (人格)   │ (回忆)   │                 │
├──────────┴──────────┴──────────┴────────────────┤
│              LLM 基础设施层                       │
│   model_router.py  — 文本/视觉模型路由             │
│   llm_client.py    — OpenAI / Anthropic 双provider │
│   llm.py           — 统一 LLM 入口 + 降级开关       │
├─────────────────────────────────────────────────┤
│              工具 & 技能层                        │
│   registry.py     — ToolRegistry 单例（装饰器注册） │
│   tourism_api.py  — Java 后端 HTTP 客户端          │
│   xhs_tool.py     — 小红书搜索工具注册              │
│   xhs_scraper.py  — 小红书数据抓取/热度计算         │
│   xhs_client.py   — XhsSkills vendored API 封装    │
├─────────────────────────────────────────────────┤
│              持久化层                             │
│   sqlite_store.py — SessionDB / BuddyDB / TaskDB  │
│   agent_trace.jsonl — trace 日志                  │
└─────────────────────────────────────────────────┘
```

---

## 2. 人格系统 (Personality / 出游搭子)

### 2.1 实现文件：`app/agent/prompts.py`

**6 种预设出游搭子人格**（`BUDDY_PRESETS`，第 207-266 行）：

| ID | 名称 | 人格特征 |
|---|---|---|
| `toxic_guide` | 毒舌导游 | 退休老导游，刻薄但推荐靠谱，"又去那儿？除了人头还能看到什么？" |
| `literary_cat` | 文艺流浪猫 | 自称在西湖边活了三百年的猫，慵懒哲思，"这条路乾隆走过苏轼走过喵" |
| `special_forces` | 特种兵教官 | 军事化旅行指挥官，精确到分钟，"0715到达！0716拍照！0717转移——跑步走！" |
| `failed_poet` | 失意诗人 | 什么都想赋诗一首但水平很差，打油诗风格，抑郁但搞笑 |
| `shy_junior` | 暗恋学妹 | 全程用校园暗恋视角说话，害羞细腻，带内心OS |
| `beijing_laoye` | 北京老大爷 | 京腔京韵，自带相声感，"您猜怎么着""得嘞"，爱和北京地标对比 |

### 2.2 人格加载机制

**`load_buddy_prompt(user_id, buddy_id)`** （第 272-285 行）：
- 优先：从 `BuddyDB` 查询用户**自定义搭子**（personality + speaking_style）
- 其次：从 `BUDDY_PRESETS` 取预设
- 默认：`toxic_guide`

### 2.3 人格注入时机

**ChatAgent.get_system_prompt()** （`chat_agent.py` 第 389-395 行）：

```python
def get_system_prompt(self, context):
    if context and context.metadata:
        buddy_id = context.metadata.get("buddy_id")
        if buddy_id:
            return load_buddy_prompt(context.user_id, buddy_id)
    return SYSTEM_PROMPT
```

**日记生成也可复用搭子人格**：`_load_buddy_personality()` 在 `diary_agent.py` 中查找用户偏好分数最高的搭子，将其人格注入日记风格 prompt。

### 2.4 搭子 CRUD API

| 端点 | 功能 |
|---|---|
| `GET /agent/user/buddy` | 列出所有搭子（预设 + 自定义） |
| `PUT /agent/user/buddy` | 创建/更新自定义搭子 |
| `DELETE /agent/user/buddy/{id}` | 删除自定义搭子 |
| `POST /agent/user/buddy/{id}/use` | 使用搭子，增加偏好分数 |

---

## 3. Prompt 系统

### 3.1 实现文件：`app/agent/prompts.py`

**系统级 Prompt**（7 个）：

| Prompt | 用途 |
|---|---|
| `SYSTEM_PROMPT` | 旅游助手基础指令，包含"工作流程必须遵守"的强制规则 |
| `INTENT_CLASSIFY_PROMPT` | 意图分类器指令（10 种意图 + 槽位说明 + JSON 输出格式） |
| `ROUTE_PLAN_PROMPT` | 路线规划专家指令 |
| `DIARY_GENERATE_PROMPT` | 日记文案写手指令（6 种风格描述） |
| `REVERSE_RECOMMEND_PROMPT` | 反向推荐/避雷专家指令 |
| `CONVERSATIONAL_DIARY_PROMPT` | 对话式游记生成指令（含风格确认流程） |
| `DIARY_MATERIAL_EXTRACT_PROMPT` | 对话素材提取指令（JSON 结构化输出） |

**追问降级模板**（LLM 不可用时）：
- `ROUTE_FOLLOW_UP`：路线追问
- `DIARY_FOLLOW_UP`：日记追问

### 3.2 风格参数系统 (StyleProfile)

**实现文件**：`app/schemas.py` 第 67-123 行，`diary_agent.py` 第 675-871 行

**8 维度可组合参数**：

| 维度 | 可选值 |
|---|---|
| `tone` (语气) | 活泼/文艺/幽默/毒舌/温暖/冷静/热血/随性 |
| `length` (篇幅) | short/medium/long |
| `emoji_density` | none/low/medium/high |
| `paragraph_style` | short/normal/flow |
| `person` (人称) | first/second/third |
| `focus_on` (侧重) | 风景/美食/人文/打卡/攻略 |
| `hashtag_count` | 0-10 |
| `custom_prompt` | 自由文本，优先级最高 |

**7 种预设风格** (`PRESET_DEFAULTS`)：小红书、朋友圈、游记、随笔、攻略、回忆、幽默吐槽

**风格 Prompt 构建器** `build_style_prompt()` （第 767-871 行）分三种模式：
1. **自述模式**（有 `custom_prompt`）→ 直接作为风格指令，不加载任何预设
2. **搭子模式**（`use_buddy=true`）→ 加载用户偏好最高的搭子人格
3. **调参模式**（默认）→ 预设默认值 + 显式参数覆盖

---

## 4. 意图分类系统

### 4.1 实现文件：`app/core/intent.py`

**10 种意图**：

| Intent | 中文含义 | 路由目标 Agent |
|---|---|---|
| `plan_trip_route` | 路线规划 | ChatAgent / RouteAgent |
| `generate_diary` | 生成旅行日记 | DiaryAgent / ChatAgent |
| `recommend_place` | 地点推荐 | ChatAgent |
| `search_place` | 搜索地点 | ChatAgent |
| `dice_adventure` | 扔骰子冒险 | DiceAgent |
| `analyze_personality` | 旅行人格分析 | PersonaAgent |
| `generate_memory` | 旅行回忆生成 | MemoryAgent |
| `scene_recommend` | 此刻出发推荐 | SceneAgent |
| `reverse_recommend` | 反向推荐 | ChatAgent |
| `general_chat` | 闲聊/其他 | ChatAgent (fallback) |

### 4.2 双模式分类

```
classify_intent(message)
  ├── LLM 可用 → _llm_classify()  (temperature=0.0, 结构化 JSON 输出)
  └── LLM 不可用 → _rule_classify() (关键词规则)
```

**LLM 模式**：使用 `INTENT_CLASSIFY_PROMPT`，要求返回结构化 JSON：

```json
{
  "intent": "...",
  "confidence": 0.86,
  "slots": {...},
  "missingSlots": ["..."],
  "shouldAskClarifyingQuestion": true,
  "clarifyingQuestion": "..."
}
```

**关键安全兜底**（第 56-66 行）：
- `plan_trip_route` 意图下 `destination` 缺失时**强制追问**
- 置信度 < 0.65 时设置追问标志

### 4.3 Agent 意图映射

**`app/agent/__init__.py`** 中的注册：

| Agent | 注册的意图 |
|---|---|
| `ChatAgent` | plan_trip_route, recommend_place, general_chat, search_place, reverse_recommend, generate_diary |
| `RouteAgent` | plan_trip_route（优先级更高，后注册覆盖前者的映射） |
| `DiaryAgent` | 空意图列表（仅通过专用端点 `/agent/diary/*` 直接调用） |
| `SceneAgent` | scene_recommend |
| `DiceAgent` | dice_adventure |
| `PersonaAgent` | analyze_personality |
| `MemoryAgent` | generate_memory |

**注意**：`plan_trip_route` 被两个 Agent 注册。Dispatcher 使用最后注册的映射（`RouteAgent` 优先），但 ChatAgent 也被注册为降级。

---

## 5. Agent 体系（8 个 Agent）

### 5.1 基类 — `BaseAgent`

**文件**：`app/agent/base_agent.py`

**统一接口**：

```python
class BaseAgent(ABC):
    name: str          # 唯一标识
    description: str   # 能力描述
    process(message, context) -> AgentResponse  # 核心处理方法
    get_system_prompt() -> str  # 系统提示词
    get_tools() -> list[dict]   # OpenAI function calling 工具定义
    can_handle(intent) -> bool  # 是否处理给定意图
```

**标准数据结构**：
- `AgentContext`：user_id, session_id, session_messages, metadata
- `AgentResponse`：content, intent, suggestions, tools_used, metadata

---

### 5.2 ChatAgent — 主对话 Agent

**文件**：`app/agent/chat_agent.py`（1408 行，最复杂）

**核心能力**：
1. **工具调用 ReAct 循环**（最多 3 轮）：LLM → tool_call → 执行 → tool_result → LLM → ... → 最终回复
2. **出游搭子人格注入**：通过 `get_system_prompt()` 动态加载
3. **图片理解**：视觉模型分析 → 结果注入日记生成流程
4. **主动游记提议**：检测对话素材信号（地点/美食/拍照/感受），自动提议生成
5. **日记风格推荐**：LLM 分析对话语气 → 推荐 3 个创意风格
6. **日记修改检测**：编辑关键词 → `_handle_diary_modification()`
7. **SSE 流式输出**：`stream_process()` 异步生成器

**ChatAgent 注册的工具**（8 个内置 + 外部注册）：
- `search_places` / `get_place_detail` / `get_hot_places` / `get_hot_foods` / `get_foods_by_cuisine`
- `search_surroundings` / `get_surroundings_by_place` / `get_surrounding_hot`

**处理流程决策树**：

```
process(message, context)
  ├── 接受日记提议? → _process_with_images / _process_with_llm
  ├── 待确认风格?  → 解析用户回复 → 注入风格 → _process_with_llm
  ├── 日记修改?     → _handle_diary_modification
  ├── 有图片?       → _process_with_images (视觉模型)
  ├── LLM 可用?     → _process_with_llm (ReAct 循环)
  └── LLM 不可用?   → _process_with_rules (降级规则)
```

**实例状态字典**（内存中，服务重启丢失）：

| 字典 | 用途 |
|---|---|
| `_diary_proposals` | 每个会话已提议游记次数（最多 2 次） |
| `_pending_style_confirm` | 待确认风格的会话 → 推荐风格 |
| `_last_diary` | 最近生成的游记内容（用于修改检测） |
| `_diary_image_descs` | 图片理解缓存（跨轮次保持） |

---

### 5.3 RouteAgent — 路线规划 Agent

**文件**：`app/agent/route_agent.py`

**核心能力**：4 轮 LLM 多工具调用

1. 第 1 轮：`search_places` + `get_hot_foods` 发现候选
2. 第 2 轮：`recommend_places` + `get_place_detail` 精选
3. 第 3 轮：`plan_multi_dest` + `get_nearest_facilities` 路径计算
4. 第 4 轮：编排为时间轴 → 返回结构化 JSON

**注册的工具**（5 个）：
- `recommend_places` / `plan_shortest_path` / `plan_multi_dest` / `get_foods_by_place` / `get_nearest_facilities`

**安全机制**：目的地缺失时直接追问，不走 LLM 避免幻觉

**结构化输出要求**：

```json
{
  "title": "行程标题",
  "timeline": [
    {"time": "09:00", "activity": "...", "place": "...", "duration": "90min", "walk": "12min", "cost": "¥35"}
  ],
  "total_distance": "4.2km",
  "total_time": "6h",
  "total_cost": "¥180",
  "highlights": ["亮点1", "亮点2"],
  "tips": ["小贴士1"]
}
```

---

### 5.4 DiaryAgent — 日记生成 Agent

**文件**：`app/agent/diary_agent.py`（1005 行）

**核心能力**：

**A. 异步 5 阶段流水线**：

```
图片理解(0-30%) → 要素提取(30-50%) → 正文撰写(50-80%) → 润色定稿(80-95%) → 持久化(95-100%)
```

每阶段通过 `task_db.update_task()` 更新进度，前端轮询 `GET /agent/diary/status/{task_id}`

**B. 换风格重新生成**（`regenerate()`）：
复用已有图片理解和要素提取结果，直接从阶段 3 开始

**C. 轻量级 AI 写作辅助**（4 个同步方法）：
- `polish_text()` — AI 润色已有文本
- `suggest_titles()` — 生成标题候选
- `extract_tags()` — 提取关键词标签
- `describe_images()` — 图生文描述

**D. 对话式游记生成**（`generate_from_conversation()`）：
从对话历史提取素材 → 生成日记，用于"一键生成"流程

**E. 一键发布**（`publish_diary()`）：
调用 Java 后端 `POST /api/diaries` 保存日记（8 秒超时兜底）

**风格 Prompt 系统**：`PRESET_DEFAULTS` (7 种) + `build_style_prompt()` + `_resolve_style_profile()` + `_generate_draft_content()` + `_polish_content()`

---

### 5.5 SceneAgent — 此刻出发推荐

**文件**：`app/agent/scene_agent.py`

**5 条时间/天气规则引擎** + LLM 润色：

| 规则 | 触发条件 | 推荐内容 |
|---|---|---|
| 午饭时间 | 11:00-13:00 | 附近食堂/餐厅正热闹，趁人不多赶紧占位 |
| 日落黄金时刻 | 16:00-18:00 + 晴天 | 光线柔和，拍照黄金时间 |
| 雨天好去处 | 天气含"雨/雪/阴" | 室内图书馆/咖啡馆/博物馆 |
| 清晨第一站 | 06:00-09:00 | 趁人少去热门景点打卡 |
| 夜游时光 | 19:00-22:00 | 夜市觅食/安静散步 |

位置和天气由前端通过 `metadata` 传入（lat/lng/weather）。

---

### 5.6 DiceAgent — 扔骰子冒险

**文件**：`app/agent/dice_agent.py`

**8 个随机微任务模板** + 真实数据槽位填充 + 🎲 掷骰 (1-6 点)

每个模板包含：task / then / note / time_limit_minutes / penalty

槽位填充器（`FILLERS`）：place_type / feature / cuisine / direction / color / number / activity / steps / target

LLM 可用时：在规则生成的基础上用 LLM 增强随机性。

---

### 5.7 PersonaAgent — 旅行人格分析

**文件**：`app/agent/persona_agent.py`

Spotify Wrapped 式画像，**5 种人格类型**：

| 人格 | 图标 | 判定规则 |
|---|---|---|
| 摄影漫游者 | 📷 | 关键词匹配：拍照/摄影/好看/风景/照片 |
| 文化探索者 | 🏛 | 关键词匹配：博物馆/历史/文化/古迹/展览 |
| 美食猎人 | 🍜 | food_ratio > 0.4 |
| 高效打卡族 | ⚡ | total_places ≥ 10 且 活跃时段 ≥ 3 |
| 悠闲度假派 | 🌿 | total_places > 0 且 < 6 |

数据来源：Java 后端 `/api/users/{id}/behavior` + `/api/users/{id}/ratings` + `/api/stats`

---

### 5.8 MemoryAgent — 旅行回忆聚合

**文件**：`app/agent/memory_agent.py`

从用户数据生成 Wrapped 式旅行回忆卡片，输出包含：记忆文案 + 📊 数据足迹 + 🏆 特别时刻

**委托 DiaryAgent 共享函数**：
- `_generate_draft_content()` — 生成回忆文案
- `_polish_content()` — 润色定稿

---

## 6. LLM 基础设施

### 6.1 实现文件

| 文件 | 职责 |
|---|---|
| `app/core/model_router.py` | 文本/视觉双模型路由 |
| `app/agent/llm_client.py` | OpenAI / Anthropic 双 provider 实现 |
| `app/core/llm.py` | 统一 LLM 入口 + 降级开关 |

### 6.2 三层抽象

```
get_llm() (llm.py)               — 统一入口，懒加载 + 降级
    ↓
ModelRouter (model_router.py)     — 文本/视觉双模型路由
    ↓
BaseLLMProvider (llm_client.py)   — 抽象接口
    ├── OpenAICompatibleProvider  — OpenAI/DeepSeek/Qwen/本地模型
    └── AnthropicProvider         — Claude API
```

### 6.3 ModelRouter 路由规则

```
route(intent, has_images, messages)
  ├── has_images=True 且 vision_client 可用 → vision_client
  ├── intent ∈ {generate_diary, analyze_image, identify_place, identify_food} → vision_client
  └── 其他 → text_client (DeepSeek)
```

### 6.4 配置体系（`.env` 环境变量）

```bash
LLM_PROVIDER          # openai_compatible / anthropic
LLM_MODEL             # gpt-4o / deepseek-chat / claude-opus-4-7
LLM_API_KEY           # API 密钥
LLM_BASE_URL          # 可自定义 API 地址（OpenAI 兼容接口）

HYBRID_MODE           # 混合模式开关（默认 true）
TEXT_LLM_MODEL        # 文本模型（默认 deepseek-chat）
TEXT_LLM_BASE_URL     # 文本模型 API 地址
TEXT_LLM_API_KEY      # 文本模型 API 密钥
VISION_LLM_MODEL      # 视觉模型（默认 qwen-vl-max）
VISION_LLM_BASE_URL   # 视觉模型 API 地址
VISION_LLM_API_KEY    # 视觉模型 API 密钥
```

### 6.5 降级策略

```
LLM API Key 未配置
  → llm_available() 返回 False
    → 所有 Agent 走规则降级（关键词匹配 + 固定模板）

视觉模型未配置 或 HYBRID_MODE=false
  → model_router.vision_available() 返回 False
    → 图片处理返回降级文案

ModelRouter 初始化失败
  → get_llm() 缓存 False
    → 后续调用返回 None
```

### 6.6 Provider 转换

**OpenAI tool format → Anthropic tool format**（`llm_client.py` 第 340-350 行）：

```python
# OpenAI: {"type": "function", "function": {"name": "...", "parameters": {...}}}
# → Anthropic: {"name": "...", "description": "...", "input_schema": {...}}
```

**OpenAI vision format → Anthropic vision format**（`llm_client.py` 第 67-81 行）：

```python
# OpenAI: [{"type": "text", "text": "..."}, {"type": "image_url", "image_url": {"url": "..."}}]
# → Anthropic: [{"type": "text", "text": "..."}, {"type": "image", "source": {"type": "url", "url": "..."}}]
```

---

## 7. 工具系统 (Tool Calling)

### 7.1 实现文件：`app/tools/registry.py`

**装饰器注册模式**（线程安全）：

```python
@registry.register(name="search_places", description="...", parameters={...})
def search_places(keyword: str) -> str:
    ...
```

### 7.2 ToolRegistry 核心方法

| 方法 | 功能 |
|---|---|
| `register()` | 装饰器注册工具（线程安全 RLock） |
| `get_definitions()` | 输出 OpenAI function calling 格式工具列表 |
| `dispatch(name, args)` | 执行工具调用，返回 JSON 字符串 `{"ok": true, "data": "..."}` |
| `list_tools()` | 调试用工具清单 |

### 7.3 工具调用流程（ReAct 模式）

```
1. LLM 响应包含 tool_calls
2. Dispatcher/ChatAgent 识别 tool_calls
3. 解析 function.name + function.arguments (JSON)
4. registry.dispatch(name, args)
5. 结果作为 tool role 消息追加到对话历史
6. LLM 再次推理（含工具结果）
7. 最多 3 轮 (ChatAgent) / 4 轮 (RouteAgent)
8. 超轮次 → 强制生成最终回复
```

### 7.4 已注册工具总览（约 20 个）

| Agent | 工具名 | 功能 |
|---|---|---|
| ChatAgent | `search_places` | 搜索景点/地点 |
| ChatAgent | `get_place_detail` | 获取地点详情 |
| ChatAgent | `get_hot_places` | 热门景点列表 |
| ChatAgent | `get_hot_foods` | 热门美食列表 |
| ChatAgent | `get_foods_by_cuisine` | 按菜系查询美食 |
| ChatAgent | `search_surroundings` | 搜索周边商户 |
| ChatAgent | `get_surroundings_by_place` | 获取场所周边商户 |
| ChatAgent | `get_surrounding_hot` | 热门周边商户 |
| RouteAgent | `recommend_places` | 智能推荐景点 |
| RouteAgent | `plan_shortest_path` | A* 最短路径计算 |
| RouteAgent | `plan_multi_dest` | TSP 多目标路径 |
| RouteAgent | `get_foods_by_place` | 场所附近美食 |
| RouteAgent | `get_nearest_facilities` | 最近设施查询 |
| SceneAgent | `get_nearby_places` | 附近场所列表 |
| SceneAgent | `get_user_preferences` | 用户偏好数据 |
| DiceAgent | `get_nearby_places` | 附近场所列表 |
| DiceAgent | `get_nearby_foods` | 附近美食列表 |
| DiceAgent | `get_random_task_template` | 随机任务模板 |
| PersonaAgent | `analyze_user_behavior` | 用户行为分析 |
| MemoryAgent | `fetch_diaries_in_range` | 拉取时间范围内日记 |
| MemoryAgent | `fetch_behaviors_in_range` | 拉取用户行为数据 |
| MemoryAgent | `generate_memory_card` | LLM 生成回忆卡片 |
| XHS Tools | `xiaohongshu_search_notes` | 搜索小红书热门笔记 |

---

## 8. 调度器 (Dispatcher)

### 8.1 实现文件：`app/agent/dispatcher.py`

**三种处理入口**：

| 方法 | 用途 |
|---|---|
| `process_chat()` | 同步对话：意图识别 → 路由 → Agent处理 → 持久化 → trace |
| `process_chat_stream()` | 异步 SSE 流式：逐 token/tool_call/tool_result/done 事件 |
| `process_with_intent()` | 跳意图检测，强制指定 Intent（用于 `/agent/route/plan` 等专用端点） |

### 8.2 处理流程

```
用户消息
  → session_db.create_or_get_session()  (会话管理)
  → classify_intent()                    (意图识别)
  → 低置信度? → 追问模板                  (追问逻辑)
  → _intent_agent_map 查询               (Agent 路由)
  → Agent.process(message, context)      (Agent 处理)
  → session_db.append_messages()         (消息持久化)
  → session_db.append_trace()            (trace 写入)
  → 返回 {session, reply}                (统一响应)
```

### 8.3 会话图片收集

`_collect_session_images()` （第 12-32 行）：遍历会话中所有用户消息的图片字段，合并去重后返回。用于日记生成时自动包含对话历史上传过的所有图片。

---

## 9. 持久化系统

### 9.1 实现文件：`app/db/sqlite_store.py`

**三个数据库模块**（共享同一 SQLite 文件 `data/agent_sessions.db`）：

| 模块 | 表 | 用途 |
|---|---|---|
| `SessionDB` | sessions + messages | 对话会话和消息，支持 images JSON + metadata JSON |
| `UserBuddyDB` | user_buddy | 用户自定义出游搭子 + preference_score |
| `TaskDB` | tasks + user_preferences | 异步任务状态 + 用户风格偏好 |

**Trace 日志**：`data/traces/agent_trace.jsonl`（JSONL 格式，每条一行）

### 9.2 设计特点

- **WAL 模式**支持并发读
- **用户隔离**（session_id + user_id 双重校验，防止跨用户访问）
- **自动数据库迁移**（动态添加 images/metadata 列）
- **线程安全**（所有写操作持 `threading.Lock`）
- **消息持久化**支持图片路径（`images` JSON 字段）和前端元数据（`metadata` JSON 字段，含 diaryCard/diaryStyle/serverImages）

### 9.3 Trace 字段

```json
{
  "trace_id": "trace_abc123",
  "user_id": "1",
  "session_id": "session_xyz",
  "intent": "plan_trip_route",
  "confidence": 0.86,
  "router_decision": "route",
  "slots": {"destination": "杭州", "days": 1},
  "llm_mode": true,
  "message": "帮我规划杭州一日游",
  "reply": "...",
  "tools_used": ["search_places", "plan_multi_dest"],
  "tool_latencies": [{"tool": "search_places", "latency_ms": 230}],
  "metadata": {...}
}
```

---

## 10. 小红书 (XHS) 集成

### 10.1 三层封装

```
XHS API 端点 (main.py)
  ├── GET  /agent/xhs/search         → xhs_scraper.quick_search()
  ├── POST /agent/xhs/validate       → XHSClient.validate_cookie()
  ├── POST /agent/xhs/publish        → XHSClient.publish_note()
  └── POST /agent/xhs/refresh-place  → xhs_scraper.refresh_place_xhs_data()

XHS Agent Tool (xhs_tool.py)
  └── xiaohongshu_search_notes → 注册到 ToolRegistry (供对话中 LLM 调用)

XHSClient (xhs_client.py)
  ├── 系统 Cookie（.env XHS_SYSTEM_COOKIES_STR）— 只读操作
  └── 用户 Cookie（方法参数 cookies_str）— 发布操作

XhsSkills Vendored Runtime (XhsSkills/skills/xhs-apis/)
  ├── xhs_pc_apis.py (29 个 PC 端方法)
  ├── xhs_creator_apis.py (10 个创作者平台方法)
  └── static/*.js (Node.js execjs 签名文件)
```

### 10.2 热度计算

`calculate_trending_score()` = Σ(点赞×0.5 + 收藏×1.5 + 评论×1.0)
收藏权重最高（代表"mark了以后去"）。

`refresh_place_xhs_data()` 流程：
1. 生成多组搜索关键词（最多 4 组）
2. 每组搜 30 篇笔记
3. 按 note_id 去重
4. 计算 trending_score、聚合 top_tags/keywords
5. 排序取 Top N

### 10.3 安全机制

- 系统 Cookie 从 `.env` 读取（只读操作）
- 用户 Cookie 由前端传入（发布操作，Java 解密后转发）
- 发布前校验 Cookie 有效性（v2 → v1 自动回退）
- 错误响应标准化：`{ok, error, code, retryable}`
- 发布行为记录 audit log
- 图片下载超时 15 秒 / 视频下载超时 30 秒

---

## 11. SSE 流式事件系统

**事件类型**（5 种）：

| Event | Data | 说明 |
|---|---|---|
| `token` | `{"content": "杭州"}` | LLM 逐 token 输出 |
| `tool_call` | `{"name": "search_places", "args": {...}}` | LLM 发起工具调用 |
| `tool_result` | `{"name": "search_places", "result": "..."}` | 工具执行结果 |
| `done` | `{"content": "...", "intent": "...", "suggestions": [...], "session": {...}, "diary_card": true}` | 对话结束 |
| `error` | `{"message": "..."}` | 异常 |

### 事件间状态传递

- `diary_card` / `diary_style` / `serverImages`：从 `done` 事件 data 提取 → 存入 `assistant_metadata` → 持久化到 messages 表 → 前端重载会话时恢复日记卡片

---

## 12. HTTP 端点全景（26 个）

### 健康检查 (2)

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/health`, `/agent/health` | 健康检查 + Agent 清单 |

### 会话管理 (4)

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/agent/sessions` | 列出用户会话 |
| GET | `/agent/sessions/{id}` | 获取会话详情（含消息历史） |
| DELETE | `/agent/sessions/{id}` | 删除会话 |
| PUT | `/agent/sessions/{id}/rename` | 重命名会话 |

### 出游搭子 (4)

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/agent/user/buddy` | 列出所有搭子 |
| PUT | `/agent/user/buddy` | 创建/更新自定义搭子 |
| DELETE | `/agent/user/buddy/{id}` | 删除自定义搭子 |
| POST | `/agent/user/buddy/{id}/use` | 使用搭子（+preference_score） |

### 对话 (2)

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/agent/chat` | 同步对话 |
| POST | `/agent/chat/stream` | SSE 流式对话 |

### 日记生成 (8)

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/agent/diary/generate` | 启动日记生成任务 |
| GET | `/agent/diary/status/{task_id}` | 轮询任务进度 |
| POST | `/agent/diary/regenerate` | 换风格重新生成 |
| POST | `/agent/diary/polish` | AI 润色已有文本 |
| POST | `/agent/diary/suggest-title` | 生成标题候选 |
| POST | `/agent/diary/extract-tags` | 提取标签 |
| POST | `/agent/diary/describe-images` | 图生文描述 |
| POST | `/agent/diary/generate-from-chat` | 对话式游记生成 |

### 发布 (1)

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/agent/diary/publish` | 一键发布到 Java 后端 |

### 路线 (1)

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/agent/route/plan` | 自然语言路线规划 |

### 用户偏好 (1)

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/agent/user/style-prefs` | 获取上次风格偏好 |

### 小红书 (4)

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/agent/xhs/search` | 搜索小红书笔记 |
| POST | `/agent/xhs/validate` | 验证 Cookie |
| POST | `/agent/xhs/publish` | 发布到小红书 |
| POST | `/agent/xhs/refresh-place` | 刷新景点小红书热度 |

---

## 13. 功能交叉分析 — 已知问题与复杂度

### 13.1 意图分类的重复实现

- **`core/intent.py`** 有 `classify_intent()`（10 种意图，LLM + 关键词规则双模式）
- **`chat_agent.py`** 有 `_detect_intent_from_message()`（6 种意图，更简化的关键词匹配）
- 两套逻辑不一致，执行路径取决于 `context.metadata` 中是否已有 intent

### 13.2 风格参数的多层覆盖

```
StyleProfile (Pydantic schema)
  → style_profile dict (camelCase keys)
    → _normalize_profile_keys() (camelCase → snake_case)
      → _resolve_style_profile() (合并 preset 默认值)
        → build_style_prompt() (8 维度组装)
```

管道过长，camelCase/snake_case 转换分散在 `diary_agent.py` 和 `main.py` 多处。`diary_style` 和 `diary_style_custom` 两个 metadata 字段在 ChatAgent 中需要手动管理。

### 13.3 工具注册的全局共享

- **所有 Agent 的工具注册到同一个 `ToolRegistry` 单例**
- ChatAgent 注册 8 个、RouteAgent 注册 5 个（与 ChatAgent 有重叠如 `get_foods_by_place`）
- SceneAgent、DiceAgent、PersonaAgent、MemoryAgent 各自注册
- XHS tools 在 `__init__.py` 中独立注册
- LLM 调用 `registry.get_definitions()` 时获取**全部已注册工具**，没有 Agent 级别的工具隔离

### 13.4 图片处理的重复路径

三条不同路径各有不同的图片 URL 转换逻辑：

| 路径 | 方法 | URL 处理 |
|---|---|---|
| 视觉模型直接回复 | `_process_with_images()` | base64 > HTTP URL > 相对路径拼接 |
| 仅理解图片 | `_understand_images_for_diary()` | base64 > HTTP URL（跳过相对路径） |
| 异步日记流程 | `DiaryAgent._understand_images()` | 直接传 URL，不做预处理 |

### 13.5 Diary 流程的分叉

- **ChatAgent** 生成日记：对话式，含风格确认 + 修改检测 + active 提议
- **DiaryAgent** 生成日记：填表式，5 阶段异步 + 轮询进度
- ChatAgent 处理 `intent=generate_diary` 但 DiaryAgent 注册为空 intent（仅专用端点调用）
- 两条路径的 prompt 系统不完全一致

### 13.6 LLM 客户端的多层包装

- `llm.py` 的 `get_llm()` → `model_router.text_client`（被所有 Agent 使用）
- `model_router.py` 的 `ModelRouter` → 管理 text/vision 双客户端
- `llm_client.py` 的 `get_llm_client()` → `create_llm_provider()`（几乎未被直接使用）
- 三处都有懒加载单例逻辑，冗余

### 13.7 ChatAgent 实例状态的内存管理

4 个实例字典（`_diary_proposals`, `_pending_style_confirm`, `_last_diary`, `_diary_image_descs`）全部存储在 ChatAgent 单例的内存中：

- **服务重启全丢**（与 SQLite 中的消息内容不同步）
- **多进程部署时不一致**（每个 worker 独立状态）
- **内存泄漏风险**（`_last_diary` 按 session_id 无限增长）

---

## 14. 总结：关键数据流

```
前端请求
  │
  ▼
FastAPI (main.py) ──── 直接端点 ──→ DiaryAgent / XHS API
  │                                    │
  ▼                                    ▼
Dispatcher.process_chat()         5阶段异步流水线
  │                                    │
  ├─ classify_intent()                ▼
  │   ├─ LLM 模式 (INTENT_CLASSIFY_PROMPT)    TaskDB 持久化
  │   └─ 规则模式 (_rule_classify)
  │
  ├─ Agent 路由 (_intent_agent_map)
  │   ├─ ChatAgent ──→ ReAct 3轮工具调用 ──→ SSE 流式输出
  │   ├─ RouteAgent ──→ ReAct 4轮规划 ──→ 结构化行程 JSON
  │   ├─ SceneAgent ──→ 规则引擎 + LLM 润色
  │   ├─ DiceAgent ──→ 随机模板 + 真实数据填充
  │   ├─ PersonaAgent ──→ 行为聚合 + 规则分类 + LLM 描述
  │   └─ MemoryAgent ──→ 数据聚合 + 委托DiaryAgent共享函数
  │
  ├─ 持久化 (SessionDB.append_messages)
  └─ Trace 写入 (agent_trace.jsonl)
```

---

## 15. 文件清单与职责矩阵

| 文件 | 行数(约) | 职责 |
|---|---|---|
| `app/main.py` | 614 | FastAPI 入口，26 个 HTTP 端点 |
| `app/config.py` | 83 | 环境变量配置 (Settings dataclass) |
| `app/schemas.py` | 334 | Pydantic 请求/响应模型 |
| `app/agent/__init__.py` | 41 | Agent 注册 + XHS Tool 注册 |
| `app/agent/base_agent.py` | 64 | Agent 基类 + AgentContext/AgentResponse |
| `app/agent/dispatcher.py` | 458 | 意图分发器，3 种处理入口 |
| `app/agent/chat_agent.py` | 1408 | 主对话 Agent (最复杂) |
| `app/agent/route_agent.py` | 382 | 路线规划 Agent |
| `app/agent/diary_agent.py` | 1005 | 日记生成 Agent |
| `app/agent/scene_agent.py` | 185 | 此刻出发推荐 Agent |
| `app/agent/dice_agent.py` | 308 | 扔骰子冒险 Agent |
| `app/agent/persona_agent.py` | 293 | 旅行人格分析 Agent |
| `app/agent/memory_agent.py` | 329 | 旅行回忆聚合 Agent |
| `app/agent/prompts.py` | 301 | 提示词集中管理 + 搭子人格 |
| `app/agent/llm_client.py` | 407 | OpenAI/Anthropic provider 实现 |
| `app/core/intent.py` | 186 | 意图分类器 (10 种意图) |
| `app/core/llm.py` | 70 | 统一 LLM 入口 + 降级开关 |
| `app/core/model_router.py` | 216 | 文本/视觉模型路由器 |
| `app/tools/registry.py` | 108 | ToolRegistry 装饰器注册表 |
| `app/tools/tourism_api.py` | 342 | Java 后端 HTTP 客户端 |
| `app/tools/xhs_tool.py` | 71 | 小红书 Agent Tool 注册 |
| `app/tools/xhs_scraper.py` | 305 | 小红书数据抓取/热度计算 |
| `app/skills/xhs_client.py` | 554 | XhsSkills vendored API 封装 |
| `app/db/sqlite_store.py` | 526 | SessionDB/BuddyDB/TaskDB |
