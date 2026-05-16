# Agent 系统重构设计说明

> 2026-05-12，基于全量源码审查 + docs/DESIGN_IMPROVEMENTS.md + docs/INNOVATION_IDEAS.md

---

## 一、现状诊断

### 1.1 架构问题

当前 agent 存在**端点绕过统一编排**的问题，核心能力未接通：

```
main.py
  /agent/chat ──→ dispatcher.py (唯一编排入口, SessionDB)
  /agent/diary/generate ──→ 直接调 DiaryAgent（绕过 Dispatcher，trace 手动拼接）
  /agent/route/plan ──→ 直接调 build_route_outline()（绕过 Dispatcher，无意图分类）
```

### 1.2 五个具体缺陷

| # | 缺陷 | 位置 | 影响 |
|---|------|------|------|
| 1 | ChatAgent 工具注册但未传 LLM | `chat_agent.py:127` | function calling 是死代码，LLM 编造回复 |
| 2 | 路线规划未走统一编排 | `route_planner.py` + `main.py` | `/agent/route/plan` 绕过 Dispatcher，trace 记录硬编码 |
| 3 | 流式未接通 | `llm_client.py` → agent 层 | `chat_stream()` 实现了但无人使用 |
| 4 | main.py 端点绕过路由 | `main.py:113-172` | diary/route 直接调 Agent/工具函数，绕过了 Dispatcher 的意图分类和 trace |
| 5 | DiaryAgent 用 Thread + 任务状态存内存 | `diary_agent.py:85` | 非异步，服务重启后 `_TASK_STATUS` dict 丢失所有任务 |
| — | (已修复) 两套编排器 | `orchestrator.py` 已删除 | dispatcher.py 是唯一编排入口 |
| — | (已修复) 两套会话存储 | `memory.py` 已删除 | sqlite_store.py (SessionDB) 是唯一存储 |

### 1.3 代码重复

`_get_llm()` / `_llm_available()` 在 dispatcher、chat_agent、diary_agent 各有一份拷贝（共 3 处）。意图/兴趣提取逻辑在 dispatcher、chat_agent、route_planner 中重复实现。JSON 解析正则 `r"\{[^{}]*\}"` 在 `llm_client.py` 和 `diary_agent.py` 各有一份，且该正则有 bug：无法匹配嵌套 JSON 对象。

---

## 二、重构目标

### 2.1 修复类（来自 IMPROVEMENT_PLAN P0/P1）

1. **Function calling 真实化** — ChatAgent 工具传入 LLM，多轮 tool_call 循环（修复缺陷 #1）
2. **路线规划真实化** — RouteAgent 走 Dispatcher 统一编排，调用 Java 导航 API（修复缺陷 #2）
3. **流式响应** — SSE 逐 token 推送，含 tool_call 中间事件（修复缺陷 #3）
4. **统一编排** — Dispatcher 为唯一入口，main.py 所有端点统一走 dispatch（修复缺陷 #4）
5. **异步化** — DiaryAgent → asyncio + 多模态修复，任务状态持久化 SQLite（修复缺陷 #5）

### 2.2 创新类（来自 DESIGN_IMPROVEMENTS + INNOVATION_IDEAS）

| 功能 | 来源 | 一句话 |
|------|------|--------|
| **出游搭子** | 创新四 | 预设搭子 + 用户自定义性格 + 偏好记忆，本质 system prompt 切换 |
| **扔骰子旅行** | 创新一 | 随机微任务生成，基于位置+美食+场所拼接 |
| **旅行人格分析** | 改进 2.2 | Spotify Wrapped 式旅行画像（美食猎人/摄影漫游者/文化探索者等） |
| **"此刻出发"场景推荐** | 改进 2.4 | 时间+位置+天气驱动即时推送 |
| **旅行回忆生成** | 改进 2.3 | 时间范围聚合日记+照片+路线→可分享卡片 |


---

## 三、目标架构

### 3.1 Agent 全景图（重构后共 7 个 Agent）

```
                         FastAPI (main.py)
                              │
                         Dispatcher
                    (唯一编排入口 + 意图路由)
                              │
        ┌─────────┬───────────┼───────────┬──────────┬──────────┬──────────┐
        │         │           │           │          │          │          │
   ChatAgent  RouteAgent  DiaryAgent  DiceAgent PersonaAgt MemoryAgt SceneAgent
   (对话+搭子)  (一日游)    (日记生成)  (扔骰子)  (人格分析) (旅行回忆) (此刻出发)
        │         │           │           │          │          │          │
        └─────────┴───────────┴───────────┴──────────┴──────────┴──────────┘
                                    │
                              ToolRegistry
                            (统一工具注册表)
                                    │
                              tourism_api.py
                            (Java 后端 API 客户端)
```

### 3.2 Agent 职责一览

| Agent | 意图 | 工具数 | 优先级 | 说明 |
|-------|------|--------|--------|------|
| **ChatAgent** | `general_chat`, `recommend_place` | 5 | P0 | 主对话 + 出游搭子切换 + function calling |
| **RouteAgent** | `plan_trip_route` | 8 | P0 | 智能一日游规划，真实路径计算 |
| **DiaryAgent** | `generate_diary` | 3 | P0 | 5 阶段日记生成（小红书/随笔/攻略） |
| **DiceAgent** | `dice_adventure` | 4 | P1 | 随机微任务生成器 |
| **PersonaAgent** | `analyze_personality` | 2 | P1 | 旅行人格分析 + 画像卡片 |
| **MemoryAgent** | `generate_memory` | 3 | P2 | 旅行回忆聚合生成 |
| **SceneAgent** | `scene_recommend` | 4 | P1 | "此刻出发"场景即时推荐 |
### 3.3 模块目录

```
agent-service/app/
├── main.py
├── config.py / schemas.py
├── core/
│   ├── llm.py                  # 统一 LLM 入口（消除 4 处重复）
│   └── intent.py               # 统一意图分类（消除 3 处重复）
├── agent/
│   ├── base_agent.py           # 抽象基类
│   ├── dispatcher.py           # 唯一编排器
│   ├── chat_agent.py           # 主对话 + 出游搭子
│   ├── route_agent.py          # 智能一日游
│   ├── diary_agent.py          # 日记生成
│   ├── dice_agent.py           # 扔骰子冒险
│   ├── persona_agent.py        # 旅行人格分析
│   ├── memory_agent.py         # 旅行回忆聚合
│   ├── scene_agent.py          # 场景即时推荐
│   └── prompts.py              # 所有提示词 + 搭子模板集中管理
├── tools/
│   ├── registry.py             # 工具注册表
│   ├── tourism_api.py          # Java API 客户端（扩展至 15+ 方法）
│   ├── route_planner.py        # 真实路线规划
│   └── image_diary.py          # 图片日记
├── db/
│   └── sqlite_store.py         # SessionDB + TaskDB
└── data/traces/
```

### 3.4 意图体系（共 9 种）

| intent | 路由目标 | 触发关键词 |
|--------|----------|-----------|
| `general_chat` | ChatAgent | 兜底 |
| `recommend_place` | ChatAgent | 推荐/好吃的/好玩的/附近 |
| `plan_trip_route` | RouteAgent | 路线/行程/导航/规划/一日游 |
| `generate_diary` | DiaryAgent | 日记/游记/文案 |
| `dice_adventure` | DiceAgent | 扔骰子/随机/冒险/摇一摇 |
| `analyze_personality` | PersonaAgent | 旅行人格/我的画像/旅行报告 |
| `generate_memory` | MemoryAgent | 旅行回忆/年度总结/回顾 |
| `scene_recommend` | SceneAgent | 现在去哪/此刻/出发/当下 |
| `reverse_recommend` | ChatAgent | 别去/劝退/避雷/踩坑 |

---

## 四、基础设施层设计

### 4.1 `core/llm.py` — 统一 LLM 入口

消除当前 4 处重复的 `_get_llm()` / `_llm_available()`。底层 `llm_client.py` 的 `BaseLLMProvider` / `OpenAICompatibleProvider` / `AnthropicProvider` 保持不变。

`BaseLLMProvider.chat()` 签名扩展：

```python
@dataclass
class ToolCall:
    id: str
    name: str
    args: dict

@dataclass
class ChatResult:
    content: str | None       # 当 tool_calls 非空时 content 为 None（LLM 只发起工具调用，未生成文本）
    tool_calls: list[ToolCall] | None  # 无工具调用时为 None

# 新增 tools 参数，返回 ChatResult 替代 str
def chat(self, messages, *, tools=None, temperature, max_tokens, stop) -> ChatResult:
```

**语义约束**：`content` 和 `tool_calls` 互斥 —— LLM 响应要么是文本回复（`content` 有值，`tool_calls=None`），要么是工具调用请求（`tool_calls` 有值，`content=None`）。调用方必须先检查 `tool_calls` 再决定是否使用 `content`。

### 4.2 `core/intent.py` — 统一意图分类

9 种意图的 LLM 分类 + 关键词规则降级，唯一实现。返回统一结构：

```python
{"intent": "plan_trip_route", "confidence": 0.9, "missing_context": []}
```

### 4.3 LLM 客户端扩展（function calling 支持）

`OpenAICompatibleProvider` 解析 `response.choices[0].message.tool_calls`，`AnthropicProvider` 解析 `response.content` 中的 `tool_use` 块，统一为 `ChatResult`。

### 4.4 `tools/tourism_api.py` — 扩展至 15+ 方法

| 方法 | Java API | 调用方 |
|------|----------|--------|
| `search_places(kw, type)` | `GET /api/places/search` | Chat/Route/Dice |
| `get_place_detail(id)` | `GET /api/places/{id}` | Chat/Route |
| `get_hot_places()` | `GET /api/places/hot` | Chat/Dice |
| `recommend_places(prefs)` | `POST /api/places/recommend` | Route/Scene |
| `get_foods_by_place(id)` | `GET /api/foods/place/{id}` | Route/Scene |
| `get_hot_foods()` | `GET /api/foods/popular` | Chat/Route |
| `get_foods_by_cuisine(c)` | `GET /api/foods/cuisine/{c}` | Chat |
| `get_facilities_by_place(id)` | `GET /api/facilities/place/{id}` | Route |
| `get_nearest_facilities(lat,lng,t)` | `POST /api/facilities/nearest` | Scene/Dice |
| `plan_shortest_path(from,to,s)` | `POST /api/navigation/shortest-path` | Route/Dice |
| `plan_multi_dest(places)` | `POST /api/navigation/multi-destination` | Route |
| `create_diary(...)` | `POST /api/diaries` | Diary/Memory |
| `get_user_behavior(uid)` | `GET /api/users/{id}/behavior` | Persona/Memory/Scene |
| `get_user_ratings(uid)` | `GET /api/users/{id}/ratings` | Persona |
| `get_stats()` | `GET /api/stats` | Persona |

> **位置与天气数据来源**：SceneAgent 和 DiceAgent 依赖用户位置和天气，但 Java 后端无独立的位置/天气服务。采用 **前端传参** 方案：`ChatRequest.metadata` 中携带 `{lat, lng, weather}`，Agent 从 context 读取。后期可接入高德天气 API。

---

## 五、ChatAgent — 主对话 + 出游搭子

### 5.1 核心能力

带完整 function calling 循环的主对话 Agent，支持 5 种预设出游搭子 + 用户自定义搭子实时切换。

### 5.2 注册工具

| 工具 | 功能 |
|------|------|
| `search_places` | 关键词搜索场所 |
| `get_place_detail` | 获取场所详情 |
| `get_hot_places` | 热门场所列表 |
| `get_hot_foods` | 热门美食列表 |
| `get_foods_by_cuisine` | 按菜系查美食 |

### 5.3 Function Calling 循环（修复缺陷 #1）

```
用户消息 → client.chat(msgs, tools=[...])
  → LLM 返回 tool_calls: [search_places(keyword="西湖")]
  → registry.dispatch("search_places", {keyword: "西湖"})
  → 结果回传 LLM → LLM 基于真实数据生成回复
```

### 5.4 出游搭子 — 选择/自定义旅行陪伴人格

#### 概念

将 AI 助手包装为"出游搭子"——一个有性格的虚拟旅伴。用户可以从预设搭子中选择，也可以**自定义创建**自己的搭子（设定名字、性格、说话风格），系统记住用户偏好。

本质是 system prompt 切换 + 用户偏好持久化。

#### 预设搭子模板

| 搭子 | system prompt 核心设定 |
|-----|----------------------|
| **毒舌导游** | 退休老导游，看不惯网红打卡，语气刻薄但推荐靠谱 |
| **文艺流浪猫** | 一只自称在西湖边活了三百年的猫，以猫视角叙事 |
| **特种兵教官** | 军事化旅行指挥官，精确到分钟，用命令口吻 |
| **失意诗人** | 什么都想赋诗一首但水平很差，打油诗风格 |
| **暗恋学妹** | 全程用校园暗恋视角说话，害羞、细腻、记得细节 |
| **北京老大爷** | 地地道道北京大爷，四九城活地图，京腔京韵自带相声感 |

#### 自定义搭子

用户可通过 `PUT /agent/user/buddy` 创建/更新自己的搭子：

```json
{
  "name": "退休老干部",
  "personality": "说话喜欢用'当年我们那时候...'开头，动不动就忆苦思甜",
  "speaking_style": "每句话不超过30字，喜欢用句号。不用网络用语。"
}
```

创建后返回 `buddy_id`，后续对话传 `metadata.buddy_id` 即可启用。自定义搭子存储在 `user_buddy` 表中，按 `user_id` 隔离。

#### 偏好记忆

ChatAgent 在每次对话结束后，从用户对搭子的反馈（切换频率、对话时长、主动评价）中学习偏好：

- 用户长期使用某个搭子 → 下次自动选中
- 用户频繁切换 → 在首页提供快捷切换入口
- 偏好评级写入 `user_buddy.preference_score`

prompts.py 中维护预设模板 + 动态加载自定义搭子：

```python
# 预设搭子
BUDDY_PRESETS = {
    "toxic_guide": "你是一位退休老导游，看不惯一切网红打卡点。语气刻薄...",
    "literary_cat": "你是一只自称在西湖边活了三百年的猫。用猫的视角说话...",
    "special_forces": "你是一位军事化旅行指挥官。精确到分钟，用命令口吻...",
    "failed_poet": "你是一位什么都想赋诗一首但水平很差的诗人。打油诗风格...",
    "shy_junior": "你是一个暗恋学长/学姐的学妹。害羞、细腻...",
    "beijing_laoye": "你是一位地地道道的北京老大爷，在四九城活了大半辈子。说话带京腔...",
}

def load_buddy_prompt(user_id: str, buddy_id: str | None) -> str:
    """加载搭子 system prompt：优先自定义搭子，其次预设，最后默认"""
    if buddy_id and buddy_id not in BUDDY_PRESETS:
        custom = UserBuddyDB.get(user_id, buddy_id)
        if custom:
            return custom.to_system_prompt()
    return BUDDY_PRESETS.get(buddy_id, DEFAULT_SYSTEM_PROMPT)
```

#### 数据表

```sql
CREATE TABLE IF NOT EXISTS user_buddy (
    buddy_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    personality TEXT NOT NULL,
    speaking_style TEXT,
    preference_score REAL DEFAULT 0,
    is_preset BOOLEAN DEFAULT FALSE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```


---

## 六、RouteAgent — 智能一日游规划器

### 6.1 来源

`DESIGN_IMPROVEMENTS.md §2.1` P0 最高优先级。自然语言需求 → 带时间轴完整行程。

### 6.2 注册工具（8 个）

| 工具 | 功能 | Java API |
|------|------|----------|
| `search_places` | 按兴趣搜索候选景点 | `GET /api/places/search` |
| `get_place_detail` | 地点详情（坐标/评分/描述） | `GET /api/places/{id}` |
| `recommend_places` | 基于偏好加权推荐 | `POST /api/places/recommend` |
| `plan_shortest_path` | 单段路径（A*） | `POST /api/navigation/shortest-path` |
| `plan_multi_dest` | 多目标最优顺序（TSP） | `POST /api/navigation/multi-destination` |
| `get_hot_foods` | 热门美食 | `GET /api/foods/popular` |
| `get_foods_by_place` | 场所附近美食 | `GET /api/foods/place/{id}` |
| `get_nearest_facilities` | 最近设施 | `POST /api/facilities/nearest` |

### 6.3 处理流程

```
用户: "周末在杭州玩一天，预算500，喜欢拍照和美食"
  → RouteAgent
    → LLM第1轮: search_places("拍照景点") + get_hot_foods()
    → LLM第2轮: recommend_places({interests:["拍照","美食"],budget:500})
    → LLM第3轮: plan_multi_dest(selected_places)
    → LLM第4轮: 编排为时间轴 → 返回完整行程
```

输出结构：

```json
{
  "title": "杭州一日游 · 拍照美食专线",
  "timeline": [
    {"time": "09:00", "activity": "出发", "place": "出发点"},
    {"time": "09:30", "activity": "游览", "place": "西湖", "duration": "90min", "walk": "12min"},
    {"time": "11:30", "activity": "午餐", "place": "第三食堂", "cost": "¥35", "walk": "8min"}
  ],
  "total_distance": "4.2km",
  "total_time": "6h",
  "total_cost": "¥180",
  "segments": [...]
}
```

---

## 七、DiaryAgent — 日记生成

### 7.1 核心改动

1. **修复多模态图片理解**（前置条件）—— 当前 `_understand_images()` 把图片 URL 当纯文本传给 LLM，LLM 看不到图片像素。需扩展 `LLMClient` 支持 vision content blocks：
   - OpenAI：`{"type": "image_url", "image_url": {"url": "..."}}`
   - Anthropic：`{"type": "image", "source": {"type": "url", "url": "..."}}`
2. `threading.Thread` → `asyncio.create_task`（修复缺陷 #5）
3. 任务状态从内存 dict → SQLite tasks 表持久化
4. 保持 5 阶段异步流水线不变

### 7.2 日记风格

| 风格 | 说明 | 触发词 |
|------|------|--------|
| **小红书**（原有） | 活泼口语化，emoji，短句分段，#话题标签 | 小红书/分享 |
| **随笔**（原有） | 文艺细腻，叙事性强，段落流畅 | 随笔/游记 |
| **攻略**（原有） | 实用条理，时间/路线/花费明确 | 攻略/指南 |

统一入口：`POST /agent/diary/generate`，`metadata.style` 参数选择风格。

---

## 八、DiceAgent — 扔骰子旅行（来自创新一）

### 8.1 概念

用户摇一摇/点按钮 → 系统生成随机"微任务"。任务基于当前位置周边的真实场所和美食，拼接而成。

### 8.2 注册工具

| 工具 | 功能 |
|------|------|
| `get_nearby_places` | 获取附近场所 |
| `get_nearby_foods` | 获取附近美食 |
| `get_random_task_template` | 随机选取任务模板 |
| `plan_shortest_path` | 计算到达任务地点的路径 |

### 8.3 任务模板池

```
任务模板（LLM 从模板池中选一个 + 真实地点拼接）：
- 找到离你最近的 [场所类型]，拍下 [特征]
- 去吃一份你没吃过的 [菜系]
- 用三个 emoji 记录此刻心情并写一句话
- 走向 [方向] 遇到的第一个 [颜色] 招牌的店
- 跟路上遇到的第一个人说一句 [随机台词]
- 找到 [场所] 里最丑的建筑并合影
```

系统根据当前位置拉取真实场所数据，将模板槽位填充为具体地点名。

### 8.4 输出

```json
{
  "dice_value": 3,
  "task": "找到离你最近的一棵树，拍下树影",
  "then": "然后去吃一份你没吃过的口味的冰淇淋",
  "note": "用三个emoji记录此刻心情并写一句话",
  "time_limit_minutes": 30,
  "penalty": "超时请发朋友圈说'我输了'",
  "share_card_url": "/api/share/dice/task_abc123"
}
```

---

## 九、PersonaAgent — 旅行人格分析（来自改进 2.2）

### 9.1 概念

Spotify Wrapped 式的旅行画像。从 `user_behavior` 表聚合用户行为特征，用规则引擎映射到人格类型。

### 9.2 人格类型

| 人格 | 特征规则 | 推荐策略 |
|------|----------|----------|
| **美食猎人** | 浏览美食占比 > 40%，评分偏重口味 | 优先推荐高评分美食 + 新开餐厅 |
| **摄影漫游者** | 偏好景区，评分含"拍照""好看" | 推荐拍照点 + 日落时段路线 |
| **文化探索者** | 偏好博物馆、历史建筑 | 推荐文化场所 + 相关日记 |
| **高效打卡族** | 一日多目标、路线紧凑 | 推荐高密度区域 + 最优路线 |
| **悠闲度假派** | 节奏慢、评分高但数量少 | 推荐安静场所 + 咖啡馆 |

### 9.3 注册工具

| 工具 | 功能 |
|------|------|
| `analyze_user_behavior` | 从后端拉取行为数据并聚合特征向量 |
| `generate_persona_card` | LLM 基于特征生成人格描述 + 推荐语 |

### 9.4 输出

```json
{
  "persona": "美食猎人",
  "description": "你的旅行词典里，'景点'的排名永远在'美食'后面。过去一个月你浏览了 23 家餐厅，最爱的菜系是川菜。",
  "stats": {
    "total_places_visited": 15,
    "total_foods_tried": 23,
    "favorite_cuisine": "川菜",
    "avg_rating_given": 4.2
  },
  "recommendation": "下次试试第二食堂的酸菜鱼，据说是新来的川菜师傅掌勺。",
  "share_card_url": "/api/share/persona/uid_001"
}
```

---

## 十、SceneAgent — "此刻出发"场景推荐（来自改进 2.4）

### 10.1 概念

根据当前时间 + 用户位置 + 天气 + 用户偏好，推荐"现在最适合做的事"。

### 10.2 场景规则（LLM 可覆盖）

| 触发条件 | 推荐 |
|----------|------|
| 11:00-13:00，距食堂 < 500m | 午餐推荐 + 排队预警 |
| 16:30-18:00，晴天，近湖/山 | 日落拍照点推荐 |
| 雨天，任意时间 | 室内场所推荐（图书馆咖啡厅/博物馆） |
| 周末上午，用户喜欢拍照 | 人少的拍照点推荐 |
| 用户首次打开 | 欢迎 + 3 个必去地点 |

### 10.3 注册工具

| 工具 | 功能 |
|------|------|
| `get_current_weather` | 获取当前天气（可用高德 API 或前端传） |
| `get_user_location` | 获取用户当前位置 |
| `get_nearby_places` | 拉取附近场所 |
| `get_user_preferences` | 拉取用户偏好数据 |

---

## 十一、MemoryAgent — 旅行回忆生成（来自改进 2.3）

### 11.1 概念

用户选择时间范围 → 聚合日记 + 照片 + 浏览记录 + 导航路径 → 生成图文并茂的"旅行回忆"卡片。

利用 DiaryAgent 的 5 阶段流水线生成总结文字，叠加图片 + 路线可视化 → 输出可分享卡片。

### 11.2 注册工具

| 工具 | 功能 |
|------|------|
| `fetch_diaries_in_range` | 拉取时间范围内的日记 |
| `fetch_behaviors_in_range` | 拉取浏览/评分记录 |
| `generate_memory_card` | LLM 聚合生成回忆文本 + 卡片数据 |

---

## 十二、流式响应 + SSE

### 12.1 新增端点

```python
@app.post("/agent/chat/stream")
async def chat_stream(request: ChatRequest):
    return StreamingResponse(
        dispatcher.process_chat_stream(request),
        media_type="text/event-stream",
    )
```

### 12.2 SSE 事件类型

```
event: token          # LLM 逐 token 输出
data: {"content": "杭州", "trace_id": "..."}

event: tool_call      # LLM 发起工具调用（中间过程可见）
data: {"name": "search_places", "args": {"keyword": "西湖"}}

event: tool_result    # 工具执行结果（中间过程可见）
data: {"name": "search_places", "result": "西湖: 5A级..."}

event: done           # 对话结束
data: {"intent": "plan_trip_route", "suggestions": [...], "trace_id": "..."}

event: error          # 异常
data: {"message": "LLM 超时"}
```

流式模式下，用户能看到 AI 的"思考过程"——调了什么工具、拿到了什么数据、基于数据做了什么判断，信任度高于同步黑盒回复。

---

## 十三、会话 + 任务持久化

### 13.1 删除 memory.py

`memory.py` 中的 `SessionStore`（内存 dict）删除。所有会话操作走 `SessionDB`（SQLite WAL）。

### 13.2 tasks 表（新增）

DiaryAgent、DiceAgent、MemoryAgent 等异步 Agent 的任务状态统一存 SQLite：

```sql
CREATE TABLE IF NOT EXISTS tasks (
    task_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    agent TEXT NOT NULL,           -- diary/dice/memory
    status TEXT NOT NULL DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    message TEXT,
    result TEXT,                   -- JSON
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

---

## 十四、实施计划

### 按优先级分 5 个 Phase

#### Phase 1: 基础设施修复 (P0, 3-4天)

| 步骤 | 内容 |
|------|------|
| 1.1 | 创建 `core/llm.py`，消除 3 处 `_get_llm()` 重复，统一 LLM 入口 |
| 1.2 | 创建 `core/intent.py`，统一 9 种意图分类，消除 dispatcher/chat_agent/route_planner 中的重复提取逻辑 |
| 1.3 | `BaseLLMProvider.chat()` 增加 `tools` 参数 + `ChatResult`（content/tool_calls 互斥语义） |
| 1.4 | 修复嵌套 JSON 解析正则 `r"\{[^{}]*\}"` → 支持嵌套对象 |
| 1.5 | `tourism_api.py` 扩展至 15+ 方法，增加美食/设施/行为/评分 API |
| 1.6 | `main.py` 所有端点统一走 Dispatcher，删除旁路调用 |
| 1.7 | CLI 回归：`chat()` 签名变更波及所有 Agent，全量验证 |

#### Phase 2: ChatAgent + RouteAgent (P0, 4-5天)

| 步骤 | 内容 |
|------|------|
| 2.1 | 重写 ChatAgent，实现 function calling 循环（ReAct 模式，max 3 轮） |
| 2.2 | ChatAgent 接入出游搭子（6 组预设 + 自定义 + user_buddy 表 + API） |
| 2.3 | 新增 RouteAgent，注册 8 个路线工具，LLM 多轮规划 |
| 2.4 | 路线规划真实调用 Java 导航 API（A*/Dijkstra/TSP），含错误回退 |
| 2.5 | 补 `test_chat_agent.py` + `test_route_agent.py` + `test_dispatcher.py` |

#### Phase 3: DiaryAgent + 流式 (P0, 3-4天)

| 步骤 | 内容 |
|------|------|
| 3.1 | 扩展 LLM client 支持 vision content blocks（修复多模态图片理解） |
| 3.2 | DiaryAgent Thread → asyncio.create_task，任务状态 SQLite 持久化 |
| 3.3 | Dispatcher + ChatAgent + RouteAgent 流式 SSE（5 种事件类型） |
| 3.4 | 前端接入 EventSource，展示 tool_call/tool_result 过渡 UI |
| 3.5 | 保留非流式 fallback（LLM 不支持 SSE 时） |

#### Phase 4: 创新 Agent (P1, 3-4天)

| Agent | 改动量 | 惊艳度 |
|-------|--------|--------|
| SceneAgent — "此刻出发" | 中（4 工具 + 场景规则，位置/天气前端传参） | ★★★★ |
| DiceAgent — 扔骰子旅行 | 中（4 工具 + 模板池，位置前端传参） | ★★★★★ |
| PersonaAgent — 旅行人格 | 小（2 工具 + 规则引擎 + 降级静态模板） | ★★★★★ |

#### Phase 5: 收尾 (P2, 2-3天)

| 项目 | 改动量 | 说明 |
|------|--------|------|
| MemoryAgent — 旅行回忆 | 中（聚合多数据源 + 委托 DiaryAgent 文本生成） | ★★★★ |
| 出游搭子偏好记忆完善 | 小（preference_score 更新逻辑 + user_buddy API） | ★★★★ |
| "别去了"反向推荐 | 小（规则 + ChatAgent 新增 reverse_recommend 意图） | ★★★ |
| CLAUDE.md 更新 | 微小（移除不存在的 orchestrator/memory 引用，更新架构图） | — |

---

## 十五、完整用户旅程（黄金路径）

把所有 Agent 串成一个演示场景：

```
1. 用户打开 App → 首页展示 PersonaAgent 生成的"旅行人格卡片"（美食猎人）
   + SceneAgent 的"此刻推荐"：午饭时间的食堂推荐

2. 用户选择"毒舌导游"搭子 → ChatAgent 用毒舌语气对话
   用户被逗笑，截图发群里
   → 用户尝试自定义搭子："退休老干部"风格，保存后下次自动选中

3. 用户点"智能行程规划" → RouteAgent 生成包含 4 景点 + 2 餐 + 步行路线的完整一日行程
   时间轴可拖拽调整，调整后自动重算路线

4. 用户扔骰子 → DiceAgent 给随机任务
   "找到校园里最丑的建筑并合影" → 用户执行并分享

5. 旅行结束 → MemoryAgent 自动生成旅行回忆
   "今天你走了 4.2km，被 AI 骂 3 次，和丑建筑合了影，麻辣香锅吃了中辣"
   → 一键生成小红书风格日记 → 分享

6. 下次打开 → 系统记住用户偏好，自动选择上次的出游搭子
   → SceneAgent 根据时间和位置推送新的"此刻出发"推荐
```

---

## 十六、关键设计决策

| # | 决策 | 选型 | 理由 |
|---|------|------|------|
| 1 | Agent 框架 | 自己写编排循环 | Agent 数量少（7个），编排逻辑简单，不引入 LangChain 等重依赖 |
| 2 | 异步任务 | asyncio + SQLite | 单用户低频操作，不引入 Celery/Redis |
| 3 | 流式协议 | SSE | 单向推送，比 WebSocket 简单，原生 EventSource 自动重连 |
| 4 | 出游搭子 | system prompt 切换 + 用户自定义 + 偏好持久化 | 预设搭子零后端逻辑，自定义需 user_buddy 表 |
| 5 | 旅行人格 | 规则引擎 | 用户量小（<100），ML 模型无意义，规则可解释性强 |
| 6 | 工具注册 | 保持 ToolRegistry 装饰器 | 现有设计已足够好，只需扩工具数量 |

---

## 十七、实施补充说明

### 17.1 Agent 间协作边界

| 场景 | 协作方式 |
|------|----------|
| MemoryAgent 需要日记生成 | 委托 DiaryAgent 的生成模块（共享 `_generate_draft()` + `_polish()`），不重新实现 |
| SceneAgent 推荐 vs ChatAgent 推荐 | SceneAgent 优先（场景触发词明确时），意图 `scene_recommend` 优先级高于 `recommend_place` |
| DiceAgent 随机景点 | 调用 `get_nearby_places` + `get_random_task_template`，结果不进入路线规划 |
| PersonaAgent → 推荐联动 | PersonaAgent 分析完成后，将人格类型写入 `ChatRequest.metadata.persona`，ChatAgent/RouteAgent 据此调整推荐策略 |

### 17.2 错误处理统一策略

所有 Agent 的工具调用遵循三级回退：

```
工具调用 → 成功 → 继续
         → 失败(可重试) → 自动重试1次 → 仍失败 → fallback 到规则模式
         → 失败(不可重试) → fallback 到规则模式
```

降级规则模式下：
- ChatAgent：返回预设推荐列表
- RouteAgent：返回"请手动选择景点"提示
- DiaryAgent：返回错误提示 + 建议用户手动撰写
- DiceAgent/SceneAgent：返回通用推荐
- PersonaAgent：使用静态模板填充

### 17.3 API 兼容性

| 端点 | 兼容策略 |
|------|----------|
| `POST /agent/chat` | 保持契约不变，reply 新增 `metadata.buddy_id`、`metadata.trace_id` 字段 |
| `POST /agent/diary/generate` | 保持契约不变 |
| `GET /agent/diary/status/{id}` | 保持契约不变，底层从内存 dict 切到 SQLite tasks 表 |
| `POST /agent/route/plan` | 改为走 Dispatcher 统一编排，响应结构不变 |
| `POST /agent/chat/stream` | **新增**，SSE 端点 |
| `GET /agent/user/buddy` | **新增**，获取用户搭子 |
| `PUT /agent/user/buddy` | **新增**，创建/更新自定义搭子 |

### 17.4 嵌套 JSON 解析修复

当前 `r"\{[^{}]*\}"` 正则无法匹配嵌套 JSON。替换为从第一个 `{` 到最后一个 `}` 的提取：

```python
def _parse_json(text: str) -> dict | None:
    """从 LLM 文本中提取 JSON 对象，支持嵌套结构。"""
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or start >= end:
        return None
    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        return None
```

### 17.5 前端接入点

7 个 Agent 在前端的呈现方式：

| Agent | 前端入口 |
|-------|----------|
| ChatAgent | 旅游助手页面（已有），新增搭子选择器 |
| RouteAgent | 旅游助手页面内，"规划一日游"按钮触发 |
| DiaryAgent | 旅游助手页面内，"生成日记"按钮 + 日记页"AI 辅助"按钮 |
| DiceAgent | 旅游助手页面内，"扔骰子"按钮（浮动 ActionButton） |
| PersonaAgent | 首页/我的页面，"旅行人格"卡片 |
| SceneAgent | 首页"此刻出发"卡片（已有 SceneAgent 输出后替换） |
| MemoryAgent | 日记页"生成旅行回忆"入口 |
