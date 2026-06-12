# Agent 架构优化升级方案

**撰写日期**: 2026-06-12  
**状态**: 基于 2026-06-11 / 2026-06-12 多轮深度诊断的整合方案  
**关联文档**:  
- `AGENT_ARCHITECTURE_ANALYSIS.md` — Agent 系统架构全景分析  
- `BUG-REPORT-ROUTE-PLANNING.md` — 路线规划第一轮 Bug 分析  
- `BUG-REPORT-ROUTE-PLANNING-DEEP.md` — 路线规划第二轮深度 Bug 分析  
- `BUG-REPORT-MULTI-POINT-NAV.md` — Java 后端 TSP 算法 7 个 Bug 分析  
- `AGENT-PLAN/DEEP_AGENT_ROADMAP.md` — 项目整体 Agent 路线图

---

## 一、问题总览：单层 Agent 已越过能力边界

### 1.1 症状

用户在 Agent 对话中进行路线规划（如"帮我规划杭州沿西湖绕一整圈的游玩路线"）时，系统表现出三类严重问题：

| 症状 | 表现 | 发生频率 |
|------|------|---------|
| **工具调用错误** | 调用 `search_places("杭州")` 而非 `recommend_places({interests:[...]})` | 高频 |
| **死循环追问** | 系统反复问"你想去哪里玩？"但用户已明确提供目的地 | Bug #1 未修复前 100% |
| **参数污染** | LLM 将地名 `"杭州""西湖"` 混入 `interests` 参数导致推荐结果偏差 | 高频 |

### 1.2 根因：单层 Agent 承担了过多认知负荷

当前 `ChatAgent` **一个 Agent 同时承担 11 种以上职责**：

```
ChatAgent 职责清单:
├── 通用闲聊引导           ← SYSTEM_PROMPT (含14个工具速查表)
├── 路线规划               ← ROUTE_PLAN_PROMPT (仅 route intent 注入)
├── 日记生成               ← CONVERSATIONAL_DIARY_PROMPT + DIARY_GENERATE_PROMPT
├── 反向推荐               ← REVERSE_RECOMMEND_PROMPT
├── 出游搭子人格注入 (6种)  ← load_buddy_prompt()
├── 图片理解               ← _process_with_images()
├── 风格推荐               ← _suggest_creative_style()
├── 风格确认状态机          ← _pending_style_confirm
├── 游记提议检测            ← _analyze_diary_potential()
├── 日记修改检测            ← _detect_diary_modification()
├── 周边搜索               ← search_surroundings 等 3 个工具
└── 小红书草稿              ← xiaohongshu_search_notes 工具
```

**关键指标**：
- `SYSTEM_PROMPT` + `ROUTE_PLAN_PROMPT` + 工具定义 ≈ **3000+ tokens** 一次性注入
- 全局 `ToolRegistry` 注册了 **14+ 个工具**，存在大量语义重叠 (`search_places` vs `recommend_places` vs `get_hot_places`)
- Prompt 中的"工具速查表"与 RouteAgent 白名单**互相矛盾**（prompt 引用 `route_plan` 但实际工具名为 `plan_multi_dest`）

---

## 二、当前架构诊断：7 个架构级缺陷

### 2.1 调用链路

```
前端 / App
  │  POST /agent/chat/stream
  ▼
Dispatcher (process_chat_stream)
  │
  ├─ 1. classify_intent(message)
  │     ├─ _keyword_override()  → 强信号关键词强制覆盖
  │     ├─ _llm_classify()      → LLM 意图分类 (6 种意图)
  │     └─ _rule_classify()     → 关键词规则降级
  │
  ├─ 2. shouldAsk && missing && conf<0.4 → 追问拦截
  │
  ├─ 3. _intent_agent_map[intent] → agent_name
  │     plan_trip_route → "route"  (RouteAgent 注册在后，覆盖 ChatAgent)
  │
  └─ 4. if hasattr(agent, "stream_process")  → ChatAgent (有)
       else                                    → RouteAgent (无，走同步)
```

### 2.2 7 个缺陷详述

#### 🔴 缺陷 1：ToolRegistry 全局单例，无所有权隔离

**文件**: `agent-service/app/tools/registry.py`

所有 Agent 注册的工具都存入同一张表：

```python
class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, ToolDef] = {}   # 14+ 个工具全部混在一起
```

| Agent | 注册的工具 |
|-------|----------|
| ChatAgent | `search_places`, `get_place_detail`, `get_hot_places`, `get_hot_foods`, `get_foods_by_cuisine`, `search_surroundings`, `get_surroundings_by_place`, `get_surrounding_hot` |
| RouteAgent | `recommend_places`, `plan_shortest_path`, `plan_multi_dest`, `get_foods_by_place`, `get_nearest_facilities` |

当任一 Agent 调用 `registry.get_definitions()` 时，返回**全部 14+ 个工具**。RouteAgent 通过 `_ROUTE_TOOL_NAMES` 白名单做了过滤，但 **ChatAgent 完全没有过滤机制**。

**影响**: 当 ChatAgent 接手路线规划请求时，LLM 看到 14 个工具 + SYSTEM_PROMPT 的"工具速查表"引导，倾向于选择 `search_places` 而非 `recommend_places`。

---

#### 🔴 缺陷 2：两个 Agent 竞争同一 Intent，流式通道不一致

**文件**: `agent-service/app/agent/__init__.py`

```python
dispatcher.register(ChatAgent(), intents=["plan_trip_route", ...])   # 先注册
dispatcher.register(RouteAgent(), intents=["plan_trip_route"])       # 后注册，覆盖
```

路由表 `_intent_agent_map["plan_trip_route"]` = `"route"` → 正确。

**但 RouteAgent 没有 `stream_process` 方法**。Dispatcher 检测到无此方法后走同步模式，用户看不到中间的工具调用过程，只能等待最终结果，体验差且难以调试。

---

#### 🔴 缺陷 3：SYSTEM_PROMPT 和 ROUTE_PLAN_PROMPT 方向冲突

| 用户意图 | SYSTEM_PROMPT 指引 (ChatAgent) | ROUTE_PLAN_PROMPT 指引 (RouteAgent) |
|----------|-------------------------------|-------------------------------------|
| 查地点/推荐 | → `search_places` | → `recommend_places` |
| 路线规划 | → `route_plan` (工具名不存在!) | → `plan_multi_dest` |
| 美食 | → `get_hot_foods` | → `get_foods_by_place` |

ChatAgent 的 prompt 引用了一个**不存在的工具名 `route_plan`**，而实际注册的是 `plan_multi_dest`。这是 prompt 和工具注册之间的**契约断裂**。

---

#### 🔴 缺陷 4：Intent 降级路径存在 slot 丢失风险

**文件**: `agent-service/app/core/intent.py`

```python
# 当 LLM 返回的 JSON intent 不在 AVAILABLE_INTENTS 中时
safe = client._parse_json_safely(result.content or "", AVAILABLE_INTENTS)
raw_json = {
    "intent": safe["intent"],       # ← 丢失了 slots / missingSlots
    "confidence": safe.get("confidence", 0.1),  # ← 丢失了真实置信度
}
```

`_parse_json_safely` 只返回 `intent`、`confidence`、`missing_context` 三个字段。走这条降级路径时，**slots、missingSlots、shouldAskClarifyingQuestion 全部丢失**，进而触发安全兜底 → `destination` 被判定为缺失 → 强制追问。

---

#### 🟡 缺陷 5：RouteAgent 渐进式工具暴露过于激进

**文件**: `agent-service/app/agent/route_agent.py`

```python
_first_step_tool_names = {"recommend_places"}  # 第1轮只暴露 1 个工具
```

如果 `recommend_places` 返回空数据（后端无推荐），LLM 在第 1 轮没有其他工具可选，只能终止 tool calling → 开始**凭空编造行程**。它不能调用 `search_places` 降级，因为该工具被 RouteAgent 白名单排除。

---

#### 🔴 缺陷 6：Java 后端 TSP 算法 7 个 Bug

**文件**: `src/main/java/com/tourism/algorithm/ShortestPathAlgorithm.java` (Bug #1)  
**文件**: `src/main/java/com/tourism/service/OutdoorRouteService.java` (Bug #2-#7)

| Bug | 位置 | 问题 | 严重度 |
|-----|------|------|--------|
| #1 | 4 个 TSP 算法 | `path.add(start)` 强制返回起点形成闭环 | 🔴 |
| #2 | `planOptimizedRoute()` | 完全忽略 `end` 参数 | 🔴 |
| #3 | `planMixedRoute()` | 相邻固定点间导航代码缺失 | 🔴 |
| #4 | `planMixedRoute()` | `totalTime` 始终为 0 | 🟡 |
| #5 | `planMixedRoute()` | TSP 块终点未包含在优化中 | 🟡 |
| #6 | `planSequentialRoute()` | 终点回环逻辑只有注释 | 🟢 |
| #7 | 所有模式 | 缺少 `mapPath`/`polylineCoordinates` 字段 | 🟡 |

即使 Agent 层正确调用了 `plan_multi_dest`，后端返回的是**闭环数据**（起点→途经点→起点），Agent 无法区分这是错误数据还是正确结果。

---

#### 🟡 缺陷 7：参数缺乏代码层校验

LLM 调用 `recommend_places(interests=["拍照","美食","休闲","杭州","西湖"])` 时，地名被混入兴趣标签。当前仅靠 prompt 约束（"不要往里加目的地名称"），但 prompt 本质是**建议**而非**强制**，LLM 随时可能偏离。

---

## 三、架构升级方案：从单层 Agent 到多 Agent 协作

### 3.1 目标架构

```
                        ┌─────────────────────┐
                        │   前端 iOS / React   │
                        └──────────┬──────────┘
                                   │ POST /agent/chat/stream
                                   ▼
                        ┌─────────────────────┐
                        │  OrchestratorAgent   │  ← 新增：顶层编排
                        │  (轻量，0 工具)       │
                        │                      │
                        │  职责:                │
                        │  1. 意图分类 (4 种)   │
                        │  2. 上下文聚合        │
                        │  3. 子 Agent 调度     │
                        │  4. 结果质检 + 合成   │
                        │  5. 追问兜底          │
                        │                      │
                        │  模型: 便宜快速模型    │
                        │  延迟: ~200ms         │
                        └──┬───────┬───────┬──┘
                           │       │       │
             ┌─────────────┘       │       └─────────────┐
             ▼                     ▼                     ▼
   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
   │  RouteAgent     │  │ DiscoverAgent   │  │  DiaryAgent     │
   │  (路线规划专家)  │  │ (发现推荐专家)   │  │ (日记生成专家)   │
   │                 │  │                 │  │                 │
   │ 工具 (5个):     │  │ 工具 (4个):     │  │ 工具 (1个):     │
   │ recommend_places│  │ search_places   │  │ vision_model    │
   │ plan_multi_dest │  │ get_hot_places  │  │                 │
   │ plan_shortest.. │  │ get_hot_foods   │  │ 能力:           │
   │ get_foods_by_.. │  │ get_place_detail│  │ 图片理解        │
   │ get_nearest_fac │  │                 │  │ 风格推荐        │
   │                 │  │ Prompt: ~500 tk │  │ 内容生成 + 润色 │
   │ Prompt: ~800 tk │  │                 │  │ Prompt: ~600 tk │
   │                 │  │                 │  │                 │
   │ 模型: 强推理     │  │ 模型: 标准      │  │ 模型: Vision    │
   └─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 3.2 核心设计原则

| 原则 | 说明 | 当前违反情况 |
|------|------|-------------|
| **1 Agent = 1 种认知负荷** | 每个 Agent 只做一件事 | ChatAgent 承担 11+ 种职责 |
| **工具所有权唯一** | 每个工具只属于一个 Agent | 14 个工具混在全局注册表 |
| **Prompt 静态专注** | 不根据 intent 动态注入不同 prompt | ChatAgent 根据 intent 切换 4 种 prompt |
| **Orchestrator 无状态** | 路由层不记对话状态、不调工具 | Dispatcher 混入追问逻辑和上下文管理 |
| **子 Agent 独立闭环** | 每个子 Agent 完成自己的 ReAct 循环 | ChatAgent ReAct 循环同时处理多种意图 |

### 3.3 各 Agent 职责定义

#### OrchestratorAgent（新增）

```
属性:
├── 工具数: 0
├── prompt 长度: ~400 tokens
├── 模型: gpt-4o-mini / claude-haiku (快速便宜)
├── stream_process: 有 (透传子 Agent 的 SSE 事件)
│
流程:
├── 1. 接收用户消息 + 对话摘要 (最近 3 轮)
├── 2. 意图分类 → 4 种路由结果:
│       plan_trip_route → RouteAgent
│       recommend_place / search_place / reverse_recommend → DiscoverAgent
│       generate_diary → DiaryAgent
│       general_chat → 直接回复 (无子 Agent)
├── 3. 委托子 Agent 执行 (传递精简 context)
├── 4. 判断任务完成度:
│       完成 → 透传结果
│       不完整 → 追问子 Agent 缺失信息
│       失败 → 降级到通用回复
└── 5. 限制最大跳转: ≤2 次子 Agent 调用
```

#### RouteAgent（重构）

```
改动:
├── 保留 _ROUTE_TOOL_NAMES 白名单机制 ✓
├── 新增 stream_process → SSE 推送每步进展
├── 去除 SYSTEM_PROMPT 中的工具速查表引用
├── prompt 简化为:
│     "你是旅游路线规划专家。你有 5 个工具可用。
│      第1步: recommend_places → 发现候选景点
│      第2步: plan_multi_dest → 最优访问顺序
│      第3步: get_foods_by_place → 沿途美食
│      第4步: 输出结构化行程表格"
├── 新增参数校验层 (拦截 interests 中的地名)
└── 从 _ROUTE_TOOL_NAMES 中移除不属于自己的工具引用
```

#### DiscoverAgent（拆分自 ChatAgent）

```
继承自 ChatAgent 的搜索/推荐功能:
├── 工具:
│   ├── search_places        ← 地点搜索
│   ├── get_hot_places       ← 热门景点
│   ├── get_hot_foods        ← 热门美食
│   ├── get_place_detail     ← 地点详情
│   ├── search_surroundings  ← 周边搜索
│   ├── get_surroundings_by_place
│   ├── get_surrounding_hot
│   └── xiaohongshu_search_notes ← 小红书搜索
│
├── prompt: "你是旅游信息发现专家...帮助用户搜索、发现、推荐目的地"
├── 不支持: 路线规划、日记生成、出游搭子
└── stream_process: 有 (继承 ChatAgent 实现)
```

#### DiaryAgent（增强）

```
改动:
├── 保持现有 5 阶段异步流水线
├── 支持 Orchestrator 对话路由 (不再仅限专用端点)
├── 从 ChatAgent 迁移风格协商逻辑:
│   ├── _suggest_creative_style()
│   ├── _pending_style_confirm
│   └── _detect_diary_modification()
└── ChatAgent 不再负责日记生成
```

#### ChatAgent（简化）

```
精简为:
├── 通用闲聊 (无工具调用)
├── 出游搭子人格注入
├── 游记主动提议检测 (触发后移交 DiaryAgent)
└── 工具数: 0 → 极简 prompt → 不再有工具冲突
```

---

## 四、典型调用流对比

### 4.1 用户: "帮我规划杭州沿西湖绕一整圈的游玩路线"

**当前 (单层)**:

```
用户消息
  → Intent 分类 (可能误判为 search_place)
  → ChatAgent SYSTEM_PROMPT:
      "用户问XX在哪 → search_places"
  → LLM 调用 search_places("杭州")    ← 错误工具
  → 返回一堆与路线无关的地点            ← 用户期望落空
```

**升级后 (多 Agent)**:

```
用户消息
  → OrchestratorAgent 意图分类:
      intent = plan_trip_route, confidence = 0.92
  → 路由到 RouteAgent
  → RouteAgent (stream_process):
      ┌─ SSE: tool_call → recommend_places(interests=["拍照","美食","休闲"])
      │                        ↑ 代码层参数校验过滤掉 "杭州""西湖"
      ├─ SSE: tool_result → [断桥残雪, 雷峰塔, 苏堤, 白堤, ...]
      ├─ SSE: tool_call → plan_multi_dest(["断桥残雪","白堤","苏堤","雷峰塔"])
      ├─ SSE: tool_result → {order: [...], distance: 10.8km}
      ├─ SSE: tool_call → get_foods_by_place("白堤") ...
      ├─ SSE: tool_result → [楼外楼, 知味观, ...]
      └─ SSE: done → Markdown 时间轴表格
  → Orchestrator 质检通过 → 返回用户
```

### 4.2 用户: "西湖附近有什么好吃的?"

**升级后**:

```
用户消息
  → OrchestratorAgent 意图分类:
      intent = recommend_place (或 search_place)
  → 路由到 DiscoverAgent
  → DiscoverAgent 调用 search_surroundings("美食", place_name="西湖")
  → 返回分类整理的美食列表
```

---

## 五、实施路线图

### Step 1: 工具注册表引入 Agent 作用域 (P0, ~2h)

**不改 Agent 结构**，先解决最根本的工具冲突问题。

**改动文件**: `registry.py`

```python
class ToolRegistry:
    def __init__(self):
        self._tools: dict[str, ToolDef] = {}
        self._agent_tools: dict[str, set[str]] = {}  # 新增: agent → {tool_names}

    def register_for_agent(self, agent_name: str, name: str, ...):
        """注册工具并绑定到指定 Agent。"""
        with self._lock:
            self._tools[name] = ToolDef(...)
            self._agent_tools.setdefault(agent_name, set()).add(name)

    def get_definitions_for_agent(self, agent_name: str) -> list[dict]:
        """只返回该 Agent 有权使用的工具。"""
        allowed = self._agent_tools.get(agent_name, set())
        return [
            t.to_openai_schema()
            for name, t in self._tools.items()
            if name in allowed
        ]
```

**验收标准**:
- RouteAgent 的 LLM 调用只收到 5 个工具定义
- ChatAgent 的 LLM 调用只收到 ChatAgent 自己的工具
- 现有所有 Agent 测试通过

---

### Step 2: 参数校验 + Prompt 修正 (P0, ~2h)

**改动文件**: `route_agent.py`, `prompts.py`

**2a. 修复 ChatAgent SYSTEM_PROMPT 的工具名错误**:

```diff
- 用户问"怎么去XX/路线/导航" → route_plan
+ 用户问"怎么去XX/路线/导航" → 请使用路线规划功能，由 RouteAgent 处理
```

**2b. RouteAgent 增加参数校验**:

```python
_INTEREST_TAGS = {"拍照", "美食", "休闲", "文化", "历史",
                  "购物", "亲子", "户外", "夜生活"}

def recommend_places(interests=None, budget=""):
    if interests:
        filtered = [i for i in interests if i in _INTEREST_TAGS]
        if not filtered:
            filtered = ["拍照", "美食", "休闲"]
    else:
        filtered = ["拍照", "美食", "休闲"]
    effective_interests = filtered
    ...
```

**2c. RouteAgent 增加参数校验日志**:

记录每次工具调用的原始参数和校验后参数，便于排查 LLM 幻觉。

**验收标准**:
- `interests=["拍照","美食","休闲","杭州","西湖"]` → 自动过滤为 `["拍照","美食","休闲"]`
- prompt 中的 `route_plan` 引用已修正

---

### Step 3: 拆分 ChatAgent → ChatAgent + DiscoverAgent (P1, ~3h)

**新增文件**: `agent-service/app/agent/discover_agent.py`

从 ChatAgent 抽取 7 个搜索/推荐工具到 DiscoverAgent：
- `search_places`, `get_hot_places`, `get_hot_foods`, `get_place_detail`
- `search_surroundings`, `get_surroundings_by_place`, `get_surrounding_hot`
- `xiaohongshu_search_notes`

ChatAgent 保留：
- 通用闲聊逻辑
- 出游搭子人格注入
- 游记主动提议检测（触发后移交 DiaryAgent）
- 日记修改检测（移交 DiaryAgent）

**验收标准**:
- 搜索/推荐类请求通过 DiscoverAgent 处理，不再经过 ChatAgent
- ChatAgent prompt 长度从 ~2000 tokens 降至 ~400 tokens
- 已有测试 + 新增 DiscoverAgent 单元测试通过

---

### Step 4: 新增 OrchestratorAgent (P1, ~4h)

**新增文件**: `agent-service/app/agent/orchestrator_agent.py`

```python
class OrchestratorAgent(BaseAgent):
    """
    顶层编排 Agent — 轻量路由，无工具。
    
    每轮对话: 意图分类 → 子 Agent 调度 → 结果合成
    """
    
    SPECIALISTS = {
        "route":    RouteAgent(),
        "discover": DiscoverAgent(),
        "diary":    DiaryAgent(),
    }
    
    async def process(self, message, context):
        intent = await self._classify_intent(message, context)
        specialist = self.SPECIALISTS.get(intent.agent_key)
        if specialist is None:
            return self._general_reply(message)
        result = await specialist.process(message, context)
        if self._needs_clarification(result):
            return self._ask_followup(result)
        return result
    
    async def stream_process(self, message, context):
        # 透传子 Agent 的 SSE 事件
        ...
```

**验收标准**:
- Orchestrator 意图分类准确率 ≥ 当前 Dispatcher 水平
- 子 Agent SSE 事件正确透传到前端
- 回退机制：子 Agent 失败时 Orchestrator 给出优雅降级回复

---

### Step 5: RouteAgent 增加 stream_process (P1, ~2h)

**改动文件**: `agent-service/app/agent/route_agent.py`

将现有的同步 ReAct 循环改造为异步生成器：

```python
async def stream_process(self, message, context):
    for round_num in range(_MAX_TOOL_ROUNDS):
        result = await self._llm_round(messages, tools, round_num)
        if result.tool_calls:
            for tc in result.tool_calls:
                yield {"event": "tool_call", "data": {...}}
                tool_result = await dispatch(tc)
                yield {"event": "tool_result", "data": {...}}
        else:
            yield {"event": "done", "data": {...}}
```

**验收标准**:
- 前端收到 `tool_call` / `tool_result` / `token` / `done` 完整 SSE 事件流
- 同步 `process()` 接口保持不变（向后兼容）

---

### Step 6: Java 后端 TSP 算法修复 (P0, ~4h)

按 `BUG-REPORT-MULTI-POINT-NAV.md` 的优先级逐项修复：

| 优先级 | Bug | 文件 | 修复说明 |
|--------|-----|------|---------|
| P0 | #1 闭环 | `ShortestPathAlgorithm.java` | 4 个 TSP 算法增加 `returnToStart` 参数，默认 false |
| P0 | #2 end 忽略 | `OutdoorRouteService.java` | `planOptimizedRoute()` 中将 `end` 加入 `destIds` |
| P0 | #3 空代码块 | `OutdoorRouteService.java` | 实现混合模式相邻固定点单段导航 |
| P1 | #4 totalTime=0 | `OutdoorRouteService.java` | 各分段累加 `totalTimeMinutes` |
| P1 | #5 TSP 块终点 | `OutdoorRouteService.java` | TSP 优化块包含下一个固定点 |
| P2 | #7 mapPath 缺失 | `OutdoorRouteService.java` | 添加 `polylineCoordinates` 字段 |

**验收标准**:
- 多点导航"智能优化"模式下，完整路线 `起点→途经点1→途经点2→...→终点` 可正常计算
- "混合模式"下，固定点 + 自由点混合场景路径完整
- 所有现有 Navigation 集成测试通过
- 新增回归测试覆盖 3 种导航模式

---

## 六、实施优先级矩阵

| 优先级 | 步骤 | 工作量 | 影响范围 | 独立可验证 |
|--------|------|--------|---------|-----------|
| **P0** | Step 1 — 工具作用域 | ~2h | 全局 | ✅ |
| **P0** | Step 2 — 参数校验 + Prompt | ~2h | RouteAgent + ChatAgent | ✅ |
| **P0** | Step 6 — TSP Bug 修复 | ~4h | Java 后端 | ✅ (独立于 Agent) |
| **P1** | Step 3 — 拆分 DiscoverAgent | ~3h | ChatAgent → 2 个 Agent | ✅ |
| **P1** | Step 4 — OrchestratorAgent | ~4h | 调度层 | 需 Step 1-3 完成 |
| **P1** | Step 5 — RouteAgent stream | ~2h | RouteAgent | ✅ |

**建议执行顺序**: Step 1 → Step 2 → Step 6 → Step 3 → Step 4 → Step 5

Step 1 和 Step 2 完全独立，可并行开发。Step 6 (Java 后端) 可并行进行。Step 1-3 完成后，Step 4 (Orchestrator) 才有完整的子 Agent 可调度。

---

## 七、风险评估与应对

| 风险 | 概率 | 应对策略 |
|------|------|---------|
| Orchestrator 增加一层延迟 | 中 | 使用便宜快速模型 (haiku/gpt-4o-mini)，意图分类 ~200ms，总计增加 <500ms |
| 子 Agent 间上下文丢失 | 中 | Orchestrator 维护共享 context，传递精简版对话历史给每个子 Agent |
| 多 Agent 反复跳转 | 低 | 硬限制最大跳转 ≤2 次，超过则直接合成当前结果 |
| RouteAgent stream_process 引入 bug | 低 | 保留同步 `process()` 作为降级路径，不影响现有功能 |
| 现有功能回归 | 中 | 每步独立验证 + 全量回归测试，Step 1-3 不改 API 对外行为 |

---

## 八、验收指标

| 指标 | 当前值 | 目标值 |
|------|--------|--------|
| 路线规划端到端成功率 | ~30% (估计) | ≥ 90% |
| Agent 单次处理工具调用错误率 | 高频 (search_places 替代 recommend_places) | ≤ 5% |
| SYSTEM_PROMPT token 数 (ChatAgent) | ~2000 tokens | ≤ 800 tokens |
| 子 Agent prompt token 数 | N/A (单 Agent) | ≤ 800 tokens |
| 意图分类准确率 | 未量化 | ≥ 90% |
| 多点导航智能优化模式可用性 | 100% 不可用 | 100% 可用 |
| 混合模式路径完整性 | 严重不完整 | 完整 |

---

## 九、迁移兼容性保证

1. **API 接口不变** — `/agent/chat/stream`、`/agent/route/plan` 等端点保持相同请求/响应格式
2. **向后兼容** — 同步 `process()` 方法不删除，作为 `stream_process` 的降级路径
3. **渐进发布** — 每步独立上线，通过 feature flag 控制是否启用新架构
4. **回滚路径** — Step 1-3 的改动可独立回滚，不影响系统整体可用性

---

*本文档将作为 Agent 架构升级的权威参考，后续实施过程中的偏差和调整应同步更新此文档。*
