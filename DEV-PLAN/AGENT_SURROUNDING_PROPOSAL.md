# Agent 周边搜索集成 — 工作流分析与方案

## 一、当前 Agent 架构

### 1.1 请求处理全流程

```
用户消息
    │
    ▼
Dispatcher.process_chat()
    │
    ├─ classify_intent(message)          ← LLM或规则分类
    │     └─ 返回: {intent, confidence, slots, ...}
    │
    ├─ 构建 AgentContext
    │     └─ context.metadata["intent"] = intent_result["intent"]  ← 意图透传
    │
    ├─ 路由到 Agent (by intent)
    │     └─ ChatAgent: plan_trip_route, recommend_place, general_chat, search_place, reverse_recommend, generate_diary
    │
    ▼
ChatAgent.process(message, context)
    │
    ├─ 前置拦截: 日记提议/风格确认/日记修改/图片  ← 这些都返回early
    │
    └─ _process_with_llm(message, context)   ← 核心LLM流程
           │
           ├─ intent = context.metadata.get("intent", fallback_detect)
           │
           ├─ 选择 System Prompt:
           │     plan_trip_route → ROUTE_PLAN_PROMPT
           │     generate_diary  → CONVERSATIONAL_DIARY_PROMPT
           │     reverse_recommend → REVERSE_RECOMMEND_PROMPT
           │     recommend_place → SYSTEM_PROMPT (默认)  ← ⚠️ 没有专用prompt
           │     search_place    → SYSTEM_PROMPT (默认)  ← ⚠️ 没有专用prompt
           │     general_chat    → SYSTEM_PROMPT (默认)
           │
           ├─ tools = registry.get_definitions()  ← 所有注册工具
           │
           └─ ReAct循环 (max 3轮):
                  LLM.chat(msgs, tools=tools)
                    ├─ 有 tool_calls → 执行工具 → 结果注入 → 继续循环
                    └─ 无 tool_calls → 直接返回LLM回复
```

### 1.2 已有工具清单 (ChatAgent 注册)

| 工具名 | 功能 | LLM是否主动调用 |
|--------|------|:---:|
| `search_places` | 搜索景点 | ✅ 有时 |
| `get_place_detail` | 地点详情 | ✅ 有时 |
| `get_hot_places` | 热门景点 | ✅ 有时 |
| `get_hot_foods` | 热门美食 | ✅ 有时 |
| `get_foods_by_cuisine` | 按菜系查美食 | ✅ 有时 |
| `search_surroundings` | **周边搜索 (NEW)** | ❌ 不调用 |
| `get_surroundings_by_place` | **周边列表 (NEW)** | ❌ 不调用 |
| `get_surrounding_hot` | **热门周边 (NEW)** | ❌ 不调用 |
| `xiaohongshu_search_notes` | 小红书搜索 | ✅ 有时 |

### 1.3 意图分类逻辑

**LLM分类器** (`_llm_classify`): 调用 DeepSeek 模型做意图分类
- 可能返回: recommend_place, search_place, general_chat 等
- "北邮附近有什么好吃的火锅" → 大概率被分为 `general_chat`（LLM没识别出"周边"意图）

**规则分类器** (`_rule_classify`): 关键词匹配
```python
if any(kw in message for kw in ["推荐", "好吃的", "好玩的", "附近", "有什么"]):
    return "recommend_place"  # 正确!
```
- "北邮附近有什么好吃的火锅" → `recommend_place` ✅

---

## 二、问题根因

### 问题: LLM 不调用周边工具

**根因1: System Prompt 没有针对性**
当 intent 为 `recommend_place` 或 `search_place` 时，用的是默认 `SYSTEM_PROMPT`（一个通用旅游助手介绍）。LLM 看到这个 prompt 的第一反应是**介绍自己**，而不是**调用工具查数据**。

**根因2: DeepSeek 的工具调用倾向弱**
DeepSeek 模型对工具调用的倾向性不如 GPT-4。即使给了工具定义，它在没有强力引导的情况下倾向于直接回答而不是调用工具。

**根因3: 工具数量多，LLM 选择困难**
ChatAgent 注册了 9 个工具。LLM 需要在多个工具中选择正确的那个，容易选择困难或干脆不选。

### 关键发现: 周围其他工具也基本不被主动调用

看 `_process_with_llm` 的 tools_used 输出，正常对话几乎总是 `["llm"]`（无工具调用）。说明**整个工具调用机制在实际使用中几乎不走**，不只是周边工具有问题。现有功能实际上依赖 LLM 自身的知识回答，不依赖工具调用。

---

## 三、推荐方案: 意图层注入 (不依赖 LLM 工具调用)

### 核心思路

**不指望 LLM 主动选工具。在 Dispatcher 层检测周边意图 → 直接调后端 API → 把结果注入到发给 LLM 的消息中。**

这样:
- 不修改 LLM 工具调用逻辑（不影响现有 6 个工具的注册和定义）
- 不改变 System Prompt 选择逻辑
- 对 `recommend_place`/`search_place` 意图生效
- 周边数据直接作为"系统预查询结果"附在用户消息后面

### 修改方案

#### 修改1: `Dispatcher.process_chat()` — 意图识别后预查询周边

```python
# 在 dispatch() 中, intent 分类之后, agent 调用之前:
# Line 111-131 之间插入:

# === 周边搜索预查询 (NEW) ===
surrounding_data: str | None = None
if intent in ("recommend_place", "search_place") and any(
    kw in message for kw in ["附近", "周边", "周围", "旁边", "边上"]
):
    surrounding_data = _prefetch_surroundings(message, intent)

# 注入到 context.metadata
if surrounding_data:
    context.metadata["surrounding_data"] = surrounding_data
```

#### 修改2: `ChatAgent._process_with_llm()` — 结果注入用户消息

```python
# 在构建 msgs 时 (line 536-540):
# 如果 context.metadata 有 surrounding_data, 附在用户消息后面

effective_message = message
sr_data = context.metadata.get("surrounding_data", "")
if sr_data:
    effective_message = (
        f"{message}\n\n"
        f"[系统已为你查询到以下周边信息, 请直接使用这些数据回答用户, 按类型整理展示]\n"
        f"{sr_data}"
    )
msgs.append({"role": "user", "content": effective_message})
```

#### 修改3: 新增辅助函数 `_prefetch_surroundings` (在 dispatcher.py 或独立 utils)

```python
def _prefetch_surroundings(message: str, intent: str) -> str | None:
    """从消息中提取地点名+品类, 调 backend API 获取周边数据, 返回格式化文本."""
    # 1. 检测消息中有"附近/周边"关键词 (已在上层判断)
    # 2. 从消息中提取品类: 火锅/奶茶/娱乐...
    # 3. 从消息中提取地点名: 北邮/故宫...
    # 4. 调 tourism_api_client.search_places() 获取 place_id
    # 5. 调 tourism_api_client.search_surroundings(query, place_id)
    # 6. 格式化结果: "- 商户名 (距离/评分/价格) — 描述"
    # 返回格式化文本 或 None
```

### 为什么这样更好

| 对比维度 | LLM工具调用方案 | 意图层注入方案 |
|----------|:---:|:---:|
| 依赖LLM行为 | 是 (不可控) | 否 |
| 影响现有工具 | 增加工具数量, 稀释选择 | 不影响工具列表 |
| 响应速度 | 需1-2轮工具调用 | 1次API调用, 直接返回 |
| 失败影响 | LLM可能忽略或乱调 | 静默降级, 不影响对话 |
| 维护成本 | 需调prompt | 不需要改prompt |

---

## 四、实施步骤

### Step 1: 新建 `agent-service/app/core/surrounding.py`

```python
"""周边数据预查询 — 独立模块, 不依赖 agent 工具调用机制"""

from app.tools.tourism_api import tourism_api_client
import re

# 品类关键词映射
CATEGORY_MAP = {
    "火锅": "火锅", "烧烤": "烧烤", "奶茶": "奶茶", "咖啡": "咖啡",
    "小吃": "小吃", "日料": "日料", "KTV": "KTV", "唱歌": "KTV",
    "电影院": "电影院", "电影": "电影院", "酒店": "酒店", "住宿": "酒店",
    "超市": "超市", "便利店": "便利店", "商场": "商场",
    "地铁": "地铁", "公交": "公交",
}

# 地点名正则
PLACE_PATTERNS = [
    r'(北京邮电大学|北邮)', r'(清华大学|清华)', r'(北京大学|北大)',
    r'(故宫|故宫博物院)', r'(颐和园)', r'(八达岭|长城)',
    # ... 可扩展
]

def prefetch_surroundings(message: str) -> str | None:
    """预查询周边数据, 返回格式化文本或None"""
    # 1. 提取品类
    query = None
    for kw, mapped in CATEGORY_MAP.items():
        if kw in message:
            query = mapped
            break
    if not query:
        if any(k in message for k in ["好吃的", "美食", "吃"]): query = "美食"
        elif any(k in message for k in ["好玩的", "玩"]): query = "娱乐"
        else: query = message[:20]

    # 2. 提取地点名
    place_name = None
    for pat in PLACE_PATTERNS:
        m = re.search(pat, message)
        if m:
            place_name = m.group(1)
            break

    # 3. 获取 place_id
    place_id = None
    if place_name:
        places = tourism_api_client.get_places(100)
        for p in places:
            if place_name in (p.get("name") or ""):
                place_id = p.get("id")
                break

    # 4. 调周边API
    results = tourism_api_client.search_surroundings(query, place_id)
    if not results:
        return None

    # 5. 格式化
    lines = [f"已为{place_name or '您'}查询到{query}相关商户:\n"]
    for r in results[:8]:
        name = r.get("name", "")
        dist = r.get("distanceMeters", 0)
        dist_s = f"{dist}m" if dist < 1000 else f"{dist/1000:.1f}km"
        rating = r.get("rating", 0)
        price = r.get("priceRange", "")
        desc = (r.get("description", "") or "")[:50]
        line = f"- {name}"
        extras = f"{dist_s}, ★{rating}" if rating else dist_s
        if price: extras += f", {price}"
        line += f" ({extras})"
        if desc: line += f" — {desc}"
        lines.append(line)
    return "\n".join(lines)
```

### Step 2: 在 `ChatAgent.process()` 开头加入预查询

```python
def process(self, message: str, context: AgentContext) -> AgentResponse:
    images = context.metadata.get("images", [])
    sid = context.session_id or "__no_session__"

    # === 周边预查询 (NEW — 在日记/图片检测之前) ===
    if not images:
        nearby_kw = ["附近", "周边", "周围", "旁边", "边上"]
        if any(k in message for k in nearby_kw):
            from app.core.surrounding import prefetch_surroundings
            sr = prefetch_surroundings(message)
            if sr:
                # 把结果注入 metadata, 后续 _process_with_llm 会读取
                context.metadata["surrounding_data"] = sr

    # ... 原有代码继续 ...
```

### Step 3: 在 `_process_with_llm()` 中注入数据到 LLM 上下文

```python
# 在构建 msgs 之后 (line 536-540附近), 改一行:
msgs: list[dict[str, Any]] = [{"role": "system", "content": sys_prompt}]
for m in context.session_messages[-6:]:
    msgs.append({"role": m.get("role", "user"), "content": m.get("content", "")})

# === 注入周边数据 (NEW) ===
sr_data = context.metadata.get("surrounding_data", "")
effective_message = message
if sr_data:
    effective_message = f"{message}\n\n[系统预查询结果, 直接使用这些数据回答用户]\n{sr_data}"
msgs.append({"role": "user", "content": effective_message})

tools = registry.get_definitions()
# ... 后续 ReAct 循环不变 ...
```

### 可选的 System Prompt 优化

如果注入数据后 LLM 仍然不理睬, 可以在 SYSTEM_PROMPT 最后加一行:

```
重要: 如果用户消息中包含 [系统预查询结果], 直接使用其中的数据回答, 按类型分类展示, 不要自我介绍。
```

---

## 五、影响范围

| 文件 | 改动 | 风险 |
|------|------|------|
| `agent-service/app/core/surrounding.py` | **新建** | 无风险, 独立模块 |
| `agent-service/app/agent/chat_agent.py` | 加3行 process(), 加5行 _process_with_llm() | 低, 条件判断, 不影响其他意图 |
| `agent-service/app/agent/prompts.py` | 可选: 加1行提示 | 极低 |

**不影响**: dispatcher, 其他 agent, 现有工具注册, 现有 LLM 工具调用流程

---

## 六、测试用例

| 用户输入 | 预期 |
|----------|------|
| "北邮附近有什么好吃的火锅" | 返回北邮周边火锅商户列表 |
| "故宫附近有什么酒店" | 返回故宫周边酒店列表 |
| "帮我规划去西湖的路线" | 正常路线规划 (不触发周边) |
| "帮我写一篇游记" | 正常日记生成 (不触发周边) |
| "你好" | 正常打招呼 (不触发周边) |
| 后端API挂了 | 静默降级, 正常走LLM流程 |
