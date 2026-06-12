# 🔧 路线规划功能修复方案

**日期**: 2026-06-11  
**关联 Bug**: `BUG-REPORT-ROUTE-PLANNING.md`  
**目标**: 修复路线规划 100% 不可用的 Bug，同时解决 Agent 间工具冲突问题

---

## 一、当前架构中的冲突点

在开始修复前，需要理解当前架构中的 3 个关键冲突/耦合点：

### 冲突 1：双 Agent 共享全局 ToolRegistry

```
                    ┌─────────────────────────┐
                    │    ToolRegistry (单例)    │
                    │   _tools: dict[str, ...] │
                    └──────────┬──────────────┘
                               │ 所有 Agent 共用
          ┌────────────────────┼────────────────────┐
          │                    │                    │
  ChatAgent 注册 (8 tools)  RouteAgent 注册 (5)  XHS 注册 (1)
  - search_places           - recommend_places    - xiaohongshu_
  - get_place_detail        - plan_shortest_path    search_notes
  - get_hot_places          - plan_multi_dest
  - get_hot_foods           - get_foods_by_place
  - get_foods_by_cuisine    - get_nearest_facilities
  - search_surroundings
  - get_surroundings_by_place
  - get_surrounding_hot
```

**风险**：RouteAgent 获得 ChatAgent 的全部 8 个工具，LLM 面对 14 个工具选项可能产生"工具选择混乱"。例如路线规划场景中，LLM 可能错误调用 `search_surroundings` 而非 `recommend_places`。

### 冲突 2：双 Agent 注册同一 Intent

```python
# agent/__init__.py
dispatcher.register(ChatAgent(), intents=["plan_trip_route", ...])  # 先注册
dispatcher.register(RouteAgent(), intents=["plan_trip_route"])       # 后注册，覆盖
```

`_intent_agent_map["plan_trip_route"]` 被 RouteAgent 覆盖。RouteAgent 的阻塞比 ChatAgent 多（`destination == "未指定"` 硬阻断），ChatAgent 没有这个阻断。

**风险**：RouteAgent 更"脆弱"，任何 slot 缺失都会硬阻断，而 ChatAgent 会走 LLM 自然追问。如果路由到 RouteAgent 但其阻塞被触发，用户永远得不到帮助。

### 冲突 3：Dispatcher 与 Agent 双重校验

```
用户消息
  → intent.py: classify_intent()        # 第1层校验：slots 提取 + missingSlots 判断
    → dispatcher.py: shouldAsk 检查      # 第2层校验：拦截条件
      → route_agent.py: destination 检查 # 第3层校验：agent 内部再拦截
```

三层校验中任意一层误判，都会阻断流程。当前 Bug 中第 1 层（_parse_json_safely 丢弃 slots）触发了第 2 层的拦截，即使修复第 1 层，第 3 层仍然存在。

---

## 二、修复方案总览

```
修复优先级:  P0 > P1 > P2

P0: [intent.py]          修复 _llm_classify 中 slots 丢失 — 核心 Bug
P1: [intent.py]          消解 Dispatcher 层的重复校验
P2: [route_agent.py]     移除 RouteAgent 的硬阻断
P3: [intent.py]          扩展规则降级路径的目的地识别
P4: [agent/__init__.py]  工具隔离优化（可选，建议后续版本）
```

---

## 三、具体修改方案

### P0 — 修复 `_llm_classify` 中 LLM 返回的 slots 被丢弃

**文件**: `agent-service/app/core/intent.py`  
**函数**: `_llm_classify()` (第 33-63 行)

**问题**：`_parse_json_safely` 只提取 `intent`/`confidence`/`missing_context`，丢弃了 `slots`/`missingSlots` 等字段。

**修复**：直接从 LLM 原始 JSON 解析完整字段，不再经过 `_parse_json_safely` 的字段过滤。

```python
def _llm_classify(message: str) -> dict[str, Any]:
    from app.agent.prompts import INTENT_CLASSIFY_PROMPT
    from app.agent.llm_client import _extract_json  # ← 复用已有的 JSON 解析

    client = get_llm()
    assert client is not None
    labels = "\n".join(f"- {k}: {v}" for k, v in AVAILABLE_INTENTS.items())
    messages = [
        {
            "role": "system",
            "content": f"{INTENT_CLASSIFY_PROMPT}\n\n当前可用的意图列表：\n{labels}",
        },
        {"role": "user", "content": message},
    ]
    result = client.chat(messages, temperature=0.0, max_tokens=512)

    # ─── 修复点：直接解析 LLM 完整 JSON，不经过 _parse_json_safely 字段过滤 ───
    raw_json = _extract_json(result.content or "")

    # 验证 intent 有效性
    if not raw_json or raw_json.get("intent") not in AVAILABLE_INTENTS:
        # 降级：LLM 返回格式异常时，借用 _parse_json_safely 做容错意图识别
        safe = client._parse_json_safely(result.content or "", AVAILABLE_INTENTS)
        raw_json = {"intent": safe["intent"], "confidence": safe.get("confidence", 0.1)}

    # 从 LLM 完整 JSON 构建 parsed，保留所有字段
    parsed: dict[str, Any] = {
        "intent": raw_json.get("intent", "general_chat"),
        "confidence": float(raw_json.get("confidence", 0.5)),
        "slots": raw_json.get("slots", {}),
        "missingSlots": raw_json.get("missingSlots", []),
        "shouldAskClarifyingQuestion": raw_json.get(
            "shouldAskClarifyingQuestion",
            float(raw_json.get("confidence", 0)) < 0.65,
        ),
        "clarifyingQuestion": raw_json.get("clarifyingQuestion", ""),
    }

    # ─── 安全兜底（保留，逻辑不变，但现在 slots 有真实数据） ───
    if parsed.get("intent") == "plan_trip_route":
        slots = parsed.get("slots", {})
        if not slots.get("destination"):
            parsed.setdefault("missingSlots", [])
            if "destination" not in parsed["missingSlots"]:
                parsed["missingSlots"].append("destination")
            parsed["shouldAskClarifyingQuestion"] = True
            if not parsed.get("clarifyingQuestion"):
                parsed["clarifyingQuestion"] = (
                    "你想去哪里玩？告诉我目的地，我帮你规划最佳路线～"
                )

    return parsed
```

**影响范围**：仅 `_llm_classify()`，不影响 `BaseLLMProvider.classify_intent()`（那个方法仍返回 `missing_context` 格式，其调用方不依赖 slots）。

**回归风险**：低。`_parse_json_safely` 仅在此处被调用，其他模块（`classify_intent()`）使用的是 `BaseLLMProvider` 实例上的同名方法，签名和返回值不变。

---

### P1 — 消解 Dispatcher 层的重复校验

**文件**: `agent-service/app/agent/dispatcher.py`  
**方法**: `process_chat()` (第 134-147 行) 和 `process_chat_stream()` (第 271-292 行)

**问题**：当 `shouldAskClarifyingQuestion=True` 且 `missingSlots` 非空时，Dispatcher 直接返回追问，Agent 完全不参与。这剥夺了 Agent 利用对话历史或更智能方式追问的能力。

**修复**：仅在低置信度 **且** LLM 明确建议追问时才拦截，给 Agent 主动处理的机会。

```python
# dispatcher.py process_chat() 第 134 行附近

# 修改前
if should_ask and missing_slots:
    ...

# 修改后
# 只在 LLM 明确要求追问且置信度很低时才拦截，否则交给 Agent 处理
if should_ask and missing_slots and confidence < 0.4:
    ...
```

> **设计权衡**：置信度阈值 `0.4` 是建议值，含义是"LLM 自己也拿不准意图"时才拦截。如果 LLM 高置信度判定为 `plan_trip_route` 但缺 destination，说明 LLM 认为用户确实是在问路线但信息不全，此时让 Agent 去追问会更自然（Agent 可以用对话历史补全信息）。

或者更保守的方案：仅对 `plan_trip_route` 意图放过，交给 RouteAgent 处理：

```python
# 路线规划意图的追问交给 Agent 做，不再在 Dispatcher 层拦截
if should_ask and missing_slots:
    # plan_trip_route 和 generate_diary 由 Agent 自己追问
    if intent in ("plan_trip_route", "generate_diary"):
        pass  # 不拦截，由 Agent 自行处理
    else:
        # 其他意图保持原拦截逻辑
        ...
```

**建议采用第一种方案**（置信度阈值），因为它更通用。

---

### P2 — 移除 RouteAgent 硬阻断，改为 LLM 自然追问

**文件**: `agent-service/app/agent/route_agent.py`  
**方法**: `RouteAgent._process_with_llm()` (第 227-320 行)

**问题**：第 239-245 行有硬阻断 `destination == "未指定"` 时直接返回追问文案。这绕过了 LLM 的理解能力——LLM 可能从对话上下文推断目的地，或在多轮对话中自然追问。

**修复**：移除硬阻断，让 LLM 自行决定是追问还是规划。

```python
# route_agent.py _process_with_llm() 第 232-245 行

# 修改前
slots = context.metadata.get("intent_slots", {})
destination = slots.get("destination", "未指定")
duration = slots.get("days", 1)
interests = slots.get("interests", [])
pace = slots.get("pace", "适中")

# 目的地缺失时不走 LLM，直接追问，避免 LLM 幻觉
if destination == "未指定":
    return AgentResponse(
        content="你想去哪里玩呢？告诉我目的地和可用时长，我帮你规划最佳路线～",
        ...
    )

# 修改后
slots = context.metadata.get("intent_slots", {})
destination = slots.get("destination", "")  # 空字符串而非 "未指定"
duration = slots.get("days", 1)
interests = slots.get("interests", [])
pace = slots.get("pace", "适中")

# 构建上下文提示，让 LLM 决定如何处理
if destination:
    context_hint = (
        f"用户需求: {message}\n"
        f"目的地: {destination}, 时长: {duration}天, 兴趣: {interests or '未指定'}, 节奏: {pace}\n"
        "请先用工具获取候选地点、路径和美食数据，再基于真实数据编排行程。"
    )
else:
    # 目的地缺失：指示 LLM 用自然语言追问，不要凭空编造行程
    context_hint = (
        f"用户需求: {message}\n"
        f"时长: {duration}天, 兴趣: {interests or '未指定'}, 节奏: {pace}\n"
        "⚠️ 用户没有明确目的地。请友好地追问目的地（1-2句），不要编造行程。"
        "如果用户提到了具体地名但没有被提取为 destination，请使用用户提到的地名。"
    )
```

**关键变化**：
- `destination` 默认值从 `"未指定"` 改为 `""`（空字符串），由 LLM 通过 context_hint 自然处理
- 移除硬编码的 `AgentResponse` 返回
- 当 destination 缺失时，通过 prompt 引导 LLM 追问，而非代码强制阻断

**设计理由**：
- LLM 有上下文理解能力，可以判断用户是否真的没提供目的地
- 如果用户消息里含糊地提到了地名，LLM 可能直接使用它
- 自然追问比固定文案更友好、有变化

---

### P3 — 扩展规则降级路径的目的地识别

**文件**: `agent-service/app/core/intent.py`  
**函数**: `extract_route_slots()` (第 126-140 行)

**问题**：硬编码目的地列表只有 5 个关键词 `["杭州", "西湖", "校园", "景区", "公园"]`，其他目的地全部无法被识别。

**修复方案 A（轻量）**：扩展关键词列表，覆盖常见旅游目的地。

```python
_KNOWN_DESTINATIONS = [
    # 浙江
    "杭州", "西湖", "雷峰塔", "灵隐寺", "千岛湖", "乌镇", "西塘",
    # 北京
    "故宫", "长城", "天安门", "颐和园", "天坛", "北海",
    # 上海
    "外滩", "东方明珠", "迪士尼", "豫园", "南京路",
    # 其他热门
    "三亚", "丽江", "大理", "桂林", "张家界", "黄山", "泰山",
    "兵马俑", "鼓浪屿", "洪崖洞", "宽窄巷子",
    # 通用
    "校园", "校区", "大学", "景区", "公园", "古镇", "老街", "博物馆",
]
```

**修复方案 B（推荐，更通用）**：使用 jieba 分词 + 简单地名识别。

```python
def extract_route_slots(message: str) -> dict[str, Any]:
    slots: dict[str, Any] = {}
    
    # 尝试精确匹配已知目的地
    for dest_kw in _KNOWN_DESTINATIONS:
        if dest_kw in message:
            slots["destination"] = dest_kw
            break
    
    # 如果精确匹配失败，尝试提取 "去XX" "在XX" "到XX" 等模式
    if not slots.get("destination"):
        import re
        patterns = [
            r'去([一-龥]{2,6})(?:玩|逛|旅游|看|拍|吃)',
            r'在([一-龥]{2,6})(?:玩|逛|旅游)',
            r'到([一-龥]{2,6})(?:玩|逛|旅游)',
        ]
        for pattern in patterns:
            match = re.search(pattern, message)
            if match:
                slots["destination"] = match.group(1)
                break
    
    # ... 其余不变
```

**建议**：采用方案 A+B 组合，先精确匹配再模式提取。

---

### P4（可选）— 工具隔离优化

**文件**: `agent-service/app/agent/__init__.py` / `chat_agent.py` / `route_agent.py`

**问题**：RouteAgent 和 ChatAgent 共享全局 ToolRegistry，RouteAgent 能调用本不应使用的 `search_surroundings` 等工具。

**方案**：无需改动 — 当前设计是合理的。路线规划中 LLM 可能需要先用 `search_places` 查找候选点，再用 `recommend_places` 筛选。全部工具可用给了 LLM 最大灵活性。

> 真正需要关注的是 **prompt 引导**。RouteAgent 的 system prompt (`ROUTE_PLAN_PROMPT`) 应明确告诉 LLM 哪些工具适合路线规划场景，让 LLM 自己做出正确的工具选择。

**建议改进 ROUTE_PLAN_PROMPT**：

```python
ROUTE_PLAN_PROMPT = """
你是旅游路线规划专家。根据用户的出行需求，给出清晰、实用的路线建议。

## 可用工具（按使用优先级排序）

**路线规划专用工具**（优先使用）:
- recommend_places: 基于兴趣和预算推荐景点
- plan_multi_dest: 计算多目标最优访问顺序（TSP）
- plan_shortest_path: 计算两点之间最短路径
- get_foods_by_place: 查询景点附近美食
- get_nearest_facilities: 查询最近设施（卫生间、停车等）

**辅助工具**（按需使用）:
- search_places: 搜索特定地点
- get_place_detail: 获取地点详情

## 工作流程

1. 如果用户没给目的地，**友好追问**（不要用工具，直接文字回复）
2. 用 recommend_places 获取候选景点（基于用户兴趣）
3. 用 get_foods_by_place 补充美食信息
4. 用 plan_multi_dest 计算最优路线顺序
5. 用 plan_shortest_path 计算关键段距离和时间
6. 编排为时间轴行程并返回

要求：
1. 先复述理解用户需求
2. 给出推荐的游览顺序和路线
3. 标注每段的大致步行时间
4. 补充实用小贴士（最佳拍照点、厕所位置、餐饮推荐等）
""".strip()
```

---

## 四、修复后的完整调用链路

```
用户消息 → intent.py: classify_intent()
  ├─ LLM 返回完整 JSON（含 slots/destination）
  ├─ _extract_json() 解析 → 保留所有字段
  ├─ slots = {"destination": "杭州", "days": 1, ...}   ← 修复 P0
  ├─ missingSlots = []  (destination 已提取到)
  └─ shouldAskClarifyingQuestion = False

    → dispatcher.py: process_chat()
      ├─ should_ask=False → 不拦截                  ← 优化 P1
      └─ 路由到 RouteAgent（_intent_agent_map["plan_trip_route"] = "route"）

        → route_agent.py: _process_with_llm()
          ├─ destination = "杭州" (非空)              ← 修复 P2
          ├─ 构建 context_hint（含真实目的地）
          ├─ 第1轮: LLM 调用 recommend_places
          ├─ 第2轮: LLM 调用 plan_multi_dest + get_foods_by_place
          ├─ 第3轮: LLM 调用 plan_shortest_path + get_nearest_facilities
          └─ 第4轮: LLM 编排为时间轴 → 返回结构化行程 JSON ✅
```

---

## 五、文件变更清单

| 优先级 | 文件 | 变更类型 | 行号范围 | 说明 |
|--------|------|----------|----------|------|
| **P0** | `app/core/intent.py` | 修改 | 33-63 | `_llm_classify()`: 直接从 LLM JSON 解析，不再依赖 `_parse_json_safely` |
| **P1** | `app/agent/dispatcher.py` | 修改 | 134, 271 | 放宽拦截条件，置信度 < 0.4 才拦截 |
| **P2** | `app/agent/route_agent.py` | 修改 | 232-256 | 移除 `destination` 硬阻断，改为 LLM 自然追问 |
| **P3** | `app/core/intent.py` | 修改 | 126-140 | `extract_route_slots()`: 扩展目的地关键词表 |
| **P4** | `app/agent/prompts.py` | 修改 | 77-88 | `ROUTE_PLAN_PROMPT`: 增加工具使用指南 |
| — | `app/agent/llm_client.py` | **不修改** | 144-157 | `_parse_json_safely` 保持不动，不破坏兼容性 |

---

## 六、测试验证清单

修复后需验证以下场景（建议按此顺序）：

| # | 场景 | 输入示例 | 期望行为 |
|---|------|----------|----------|
| 1 | 完整信息路线规划 | "帮我规划杭州一日游，喜欢拍照" | 返回结构化行程 JSON |
| 2 | 含目的地无时间 | "去西湖怎么玩" | LLM 追问可用时间，不返回固定文案 |
| 3 | 真的没说目的地 | "帮我规划路线" | LLM 追问目的地，自然语言 |
| 4 | 闲聊不触发 | "你好"、"今天星期几" | 走 general_chat，不走 route |
| 5 | 规则降级（无 LLM） | "半天校园逛一下" | 规则模式正常降级 |
| 6 | 含图片的路线请求 | 图片 + "这是哪里，帮我规划" | 不误判为 generate_diary |
| 7 | 流式端点 | SSE "周末去故宫" | 流式返回路线规划结果 |
| 8 | /agent/route/plan | 专用端点直接调用 | 正常返回行程 |

---

## 七、风险与回滚

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| LLM 在缺 destination 时编造行程 | 低 | 中 | P2 的 context_hint 有明确指令禁止编造 |
| _extract_json 导入周期依赖 | 低 | 低 | `_extract_json` 是 `llm_client.py` 的纯函数，无依赖 |
| Dispatcher 放宽拦截后其他意图受影响 | 低 | 低 | 只改 plan_trip_route 路径；P1 用置信度阈值保护 |
| 工具列表过大导致 LLM 选错工具 | 中 | 中 | P4 的 prompt 引导 + ROUTE_OUTPUT_PROMPT 约束 |

**回滚方案**：所有修改集中在 3 个文件（intent.py, dispatcher.py, route_agent.py），git revert 即可。prompts.py 的修改为纯文案，不影响逻辑。
