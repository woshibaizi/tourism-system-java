# 简历级个性化旅游 Agent 深度路线图

目标不是“做一个能聊天的旅游助手”，而是做一个能证明你理解 Agent 工程全链路的项目。这个项目最终应该能讲清楚七件事：

1. 如何做端到端意图识别和任务分解。
2. 如何把业务能力封装成 MCP tools/resources/prompts。
3. 如何管理多轮对话记忆，而不是只把历史消息全塞进 prompt。
4. 如何评测端到端 Agent，而不是只看一次 demo 成不成功。
5. 多 Agent 场景下如何 routing、协作、失败回退。
6. 如何用 monitor agent 观察线上表现并自动发现问题。
7. 工具调用失败、检索召回差、规划不合理时如何定位和优化。

## 1. 项目定位

建议把项目命名成类似：

```text
TravelMind Agent Platform
```

一句话介绍：

```text
一个面向个性化旅游场景的多模态、多工具、多 Agent 系统，支持图片生成旅行日记、对话式路线规划、小红书草稿同步、长期用户偏好记忆、MCP 工具生态、端到端自动评测与在线表现监控。
```

简历里不要只写“调用大模型实现旅游助手”。要写成：

```text
设计并实现 Java + Python 分布式 Agent 架构，将旅游业务 API、图片日记生成、路线规划、小红书同步封装为 MCP 工具；构建意图识别、记忆检索、多 Agent routing、端到端评测和在线 monitor 闭环。
```

## 2. 最终架构

```text
前端 / App
  |
  v
Spring Boot Tourism Backend
  |-- 用户、登录、图片、日记、景点、路线、行为数据
  |
  v
Python Agent Runtime
  |-- Intent Router
  |-- Memory Manager
  |-- Planner Agent
  |-- Diary Agent
  |-- Route Agent
  |-- Publisher Agent
  |-- Monitor Agent
  |
  v
MCP Layer
  |-- tourism_search_places
  |-- tourism_recommend_places
  |-- tourism_plan_route
  |-- diary_create
  |-- diary_search
  |-- xiaohongshu_create_draft
  |-- xiaohongshu_publish_note
  |
  v
Evaluation + Observability
  |-- offline eval dataset
  |-- tool-call trace
  |-- failure replay
  |-- monitor report
```

Java 继续做业务系统。Python 负责 Agent 编排。MCP 是工具协议层。评测和监控是项目深度的核心，不是附属功能。

## 3. 阶段拆解

### 阶段 A：先打通最小闭环

目标：做出能跑的 Agent，不追求复杂。

需要实现：

- `agent-service` FastAPI 服务。
- `/agent/chat` 统一入口。
- `/agent/diary/generate` 图片 + prompt 生成日记。
- `/agent/route/plan` 自然语言生成路线。
- Java 新增 `AgentController` 调 Python。

验收标准：

- 一次图片日记请求能从前端走到 Java，再到 Python，再保存回 Java。
- 一次路线规划请求能调用现有 Java 景点和路径规划接口。
- 每次请求保存 trace：用户输入、意图、调用工具、工具返回、最终答案、耗时。

这一阶段的关键不是智能程度，而是让链路可观测。

### 阶段 B：做端到端意图识别

不要只让模型自由发挥。需要设计明确的 intent schema。

建议意图集合：

```text
generate_diary_from_images
plan_trip_route
search_place
recommend_place
modify_existing_diary
publish_to_xiaohongshu
ask_followup_question
general_travel_chat
unsupported_or_unsafe
```

每次识别输出固定 JSON：

```json
{
  "intent": "plan_trip_route",
  "confidence": 0.86,
  "slots": {
    "destination": "杭州",
    "days": 3,
    "budget": "medium",
    "interests": ["拍照", "美食"],
    "transport": "walk_and_public_transport"
  },
  "missingSlots": ["startDate"],
  "shouldAskClarifyingQuestion": true,
  "clarifyingQuestion": "你打算哪一天出发？"
}
```

实现要点：

- 用结构化输出约束模型。
- 低置信度时不直接调用工具，而是追问。
- 将 intent 识别和业务执行分开，方便评测。
- 给每个意图准备 30 到 50 条测试样例。

评测指标：

- intent accuracy
- macro F1
- slot extraction F1
- clarification precision
- unsupported intent recall

简历亮点：

```text
构建旅游 Agent 意图识别数据集与结构化 router，支持 9 类业务意图、slot 抽取、低置信度追问和端到端评测。
```

### 阶段 C：把 MCP 做扎实

MCP 不只是“能调用工具”。要体现协议设计能力。

按 MCP 概念拆：

- Resources：只读上下文，例如用户偏好、景点详情、历史日记摘要。
- Tools：会执行动作，例如路线规划、创建日记、生成小红书草稿。
- Prompts：可复用提示模板，例如“旅行日记生成模板”“路线规划模板”。

推荐 MCP tools：

```text
tourism_search_places
tourism_get_place_detail
tourism_recommend_places
tourism_plan_route
tourism_create_diary
tourism_search_diaries
xiaohongshu_create_draft
xiaohongshu_publish_note
```

每个 tool 都要有：

- 清晰 name。
- Pydantic input schema。
- Pydantic output schema。
- readOnly / destructive / idempotent 语义说明。
- 超时。
- 错误码。
- 可读错误信息。
- trace id。

示例错误返回设计：

```json
{
  "ok": false,
  "errorCode": "ROUTE_NO_PATH",
  "message": "没有找到从 A 到 B 的可达路线",
  "retryable": false,
  "suggestedAction": "请换一个起点或终点，或者改用高德地图 provider"
}
```

小红书工具必须谨慎：

- 默认只创建草稿，不直接发布。
- 发布前必须有 `userConfirmed=true`。
- 凭证只从环境变量或安全存储读取。
- 发布行为写 audit log。
- tool 描述里明确副作用。

简历亮点：

```text
基于 MCP 将旅游业务 API 和小红书发布能力标准化为 tools/resources/prompts，支持结构化 schema、工具安全标注、审计日志、错误回退和 Inspector 测试。
```

### 阶段 D：多轮对话记忆系统

不要把“记忆”做成简单拼接历史消息。建议分四层。

第一层：短期会话记忆

- 当前对话里的上下文。
- 存 Redis，过期时间比如 2 小时。
- 记录用户当前正在规划哪次旅行。

第二层：长期用户偏好

- 喜欢拍照、美食、轻松路线、预算范围、常用出行方式。
- 存 MySQL。
- 每次只更新明确偏好，不把模型猜测当事实。

第三层：旅行事件记忆

- 用户去过哪里、写过什么日记、给过什么评分。
- 可以从现有日记和行为表提取。

第四层：向量检索记忆

- 对历史日记、景点描述、用户偏好摘要做 embedding。
- 用于“还想要上次那种风格”“类似我之前去过的地方”。

Memory Manager 每轮做三件事：

```text
retrieve -> inject -> update
```

也就是：

1. 根据当前问题检索相关记忆。
2. 只把相关记忆注入 prompt。
3. 对本轮新信息做记忆抽取，必要时请求用户确认。

评测指标：

- memory hit rate：需要记忆的问题中，是否找到了正确记忆。
- personalization score：路线是否体现用户偏好。
- memory pollution rate：错误写入记忆的比例。
- token cost：记忆注入后 prompt 长度是否可控。

简历亮点：

```text
实现短期会话、长期偏好、旅行事件和向量记忆四层 Memory Manager，支持记忆检索、摘要压缩、用户确认写入和污染率评测。
```

### 阶段 E：多 Agent Routing

多 Agent 不要为了“多”而多。每个 Agent 要职责清楚。

建议角色：

```text
Router Agent
  判断意图、置信度、缺失信息、应该交给谁。

Diary Agent
  负责图片理解、日记生成、风格控制、标签生成。

Route Agent
  负责景点选择、路线工具调用、行程结构化。

Publisher Agent
  负责小红书草稿、发布确认、发布状态查询。

Critic Agent
  检查最终结果是否满足用户约束，有没有路线冲突。

Monitor Agent
  离线或在线分析 trace，发现失败模式。
```

Routing 策略分两版：

第一版：规则 + intent

```text
intent=generate_diary_from_images -> Diary Agent
intent=plan_trip_route -> Route Agent
intent=publish_to_xiaohongshu -> Publisher Agent
confidence<0.65 -> ask_followup_question
```

第二版：router model + policy

- 模型判断候选 Agent。
- policy 做安全限制。
- 高风险动作强制用户确认。
- 工具失败时交给 recovery policy。

需要记录 routing trace：

```json
{
  "requestId": "req_001",
  "routerDecision": "RouteAgent",
  "confidence": 0.82,
  "reason": "用户请求三天两晚路线规划，包含地点和兴趣",
  "fallbackUsed": false
}
```

评测指标：

- routing accuracy
- wrong-agent rate
- unnecessary-agent-hop rate
- average tool calls per task
- end-to-end success rate

简历亮点：

```text
设计多 Agent routing 策略，结合 intent classifier、规则 policy 和 critic 校验，实现日记生成、路线规划、发布同步等任务的动态分派与失败回退。
```

### 阶段 F：端到端 Agent 评测

这是最能体现深度的部分。需要单独建 `agent-service/evals/`。

建议评测集：

```text
intent_eval.jsonl
slot_eval.jsonl
tool_routing_eval.jsonl
diary_generation_eval.jsonl
route_planning_eval.jsonl
memory_eval.jsonl
mcp_tool_eval.jsonl
end_to_end_eval.jsonl
```

端到端样例：

```json
{
  "caseId": "route_001",
  "userInput": "我周末想和朋友在校园玩半天，喜欢拍照和甜品，路线别太累",
  "expectedIntent": "plan_trip_route",
  "expectedSlots": {
    "duration": "half_day",
    "interests": ["拍照", "甜品"],
    "pace": "relaxed"
  },
  "expectedToolCalls": ["tourism_recommend_places", "tourism_plan_route"],
  "successCriteria": [
    "must_include_at_least_3_places",
    "must_consider_user_interests",
    "must_return_structured_itinerary",
    "must_not_publish_to_xiaohongshu"
  ]
}
```

评测方法分三类：

1. Deterministic checks：JSON schema、工具调用顺序、是否缺字段。
2. Rule-based checks：路线是否包含足够景点、是否符合预算、是否调用了正确工具。
3. LLM-as-judge：日记质量、个性化程度、路线解释质量。

最终报告要能输出：

```text
End-to-end success rate: 82.5%
Intent accuracy: 91.2%
Slot F1: 86.4%
Tool-call success rate: 88.7%
Memory hit rate: 76.3%
Average latency: 4.8s
Average token cost: 2.1k
Top failure: route planner missing food preference in multi-day trips
```

简历亮点：

```text
构建 Agent 离线评测框架，覆盖 intent、slot、routing、MCP tool、memory 和端到端任务，支持失败样例回放和指标趋势对比。
```

### 阶段 G：Monitor Agent 在线表现分析

Monitor Agent 不参与用户实时回答，主要看日志和 trace。

每次 Agent 调用都记录：

```text
request_id
user_id
intent
router_decision
memory_used
tool_calls
tool_latency
tool_errors
final_answer
user_feedback
fallback_count
created_at
```

Monitor Agent 每天或每 50 次请求分析一次：

- 哪些 intent 容易失败。
- 哪些工具超时多。
- 哪些检索召回差。
- 哪些答案被用户差评。
- 哪些请求频繁触发追问。
- 哪些 tool schema 让模型误用。

Monitor 输出报告：

```json
{
  "period": "2026-05-01",
  "summary": "路线规划任务失败率上升，主要原因是多目的地路径规划接口对无效 placeId 缺少可恢复错误。",
  "topFailures": [
    {
      "type": "TOOL_ARGUMENT_ERROR",
      "count": 12,
      "exampleRequestId": "req_123",
      "suggestedFix": "在 Route Agent 调用前增加 placeId 校验和名称到 ID 的解析工具"
    }
  ]
}
```

简历亮点：

```text
实现 Monitor Agent 对线上 trace 进行失败聚类、异常工具识别和优化建议生成，形成离线评测到线上监控的闭环。
```

### 阶段 H：工具调用失败和检索召回优化

常见问题要有系统性处理。

#### 问题 1：工具参数错

例如模型把景点名称传给只接受 `placeId` 的接口。

优化：

- 增加 `tourism_resolve_place_name` 工具。
- 工具 schema 里明确字段含义。
- 调用前做 Pydantic 校验。
- 失败后自动进行一次参数修复。

#### 问题 2：检索召回不全

例如用户说“适合拍照的地方”，只搜到了标题，没有搜到描述和标签。

优化：

- 混合检索：关键词 BM25 + embedding。
- 查询改写：把“适合拍照”扩展成“风景、打卡、夜景、建筑、湖边”。
- 多路召回：景点表、日记表、用户行为表一起召回。
- rerank：按用户偏好、距离、评分、开放时间重排。

#### 问题 3：工具返回太多

优化：

- 工具支持分页和 topK。
- 先返回摘要，再按需查详情。
- MCP resource 用于详情懒加载。

#### 问题 4：路线规划不符合用户偏好

优化：

- 把用户偏好变成路线约束，例如 `pace=relaxed` 限制步行距离。
- Critic Agent 检查“是否太赶”“是否绕路”“是否包含兴趣点”。
- 如果不满足，Route Agent 重新规划。

#### 问题 5：发布工具高风险

优化：

- 分成草稿和发布两个工具。
- 发布必须用户确认。
- 记录 audit log。
- 失败时不重复发布，只查询状态。

## 4. 推荐技术栈

Python 侧：

- FastAPI：Agent HTTP 服务。
- Pydantic：schema、工具输入输出校验。
- httpx：调用 Java API。
- MCP Python SDK / FastMCP：MCP server/client。
- Redis：短期会话记忆。
- MySQL：长期用户偏好和 trace。
- 向量库：初期可用 Chroma 或 SQLite + embedding 表，后期再换 Milvus。
- pytest：单元测试和 eval runner。

Java 侧：

- Spring Boot 保持现有业务能力。
- 新增 `AgentController` 和 `AgentClient`。
- Agent 请求不直接绕过鉴权。
- 重要结果仍由 Java 保存到数据库。

## 5. 里程碑路线

### M1：可运行

- Python Agent 服务。
- Java 调 Python。
- 图片日记生成。
- 路线规划。
- trace 记录。

### M2：可解释

- intent router。
- slot 抽取。
- routing trace。
- 工具调用 trace。
- 低置信度追问。

### M3：可扩展

- MCP tools/resources/prompts。
- 小红书草稿 tool。
- 工具 schema 和错误码。
- MCP Inspector 测试。

### M4：可个性化

- 多层 memory。
- 用户偏好抽取。
- 记忆检索和注入。
- 记忆污染控制。

### M5：可评测

- eval dataset。
- eval runner。
- 指标报告。
- 失败样例回放。

### M6：可监控

- Monitor Agent。
- 线上 trace 分析。
- 失败聚类。
- 优化建议。

### M7：可展示

- README 架构图。
- Demo 视频脚本。
- 评测报告截图。
- 典型失败优化前后对比。
- 简历 bullet。

## 6. 最终仓库应该展示什么

建议最终文档结构：

```text
AGENT-PLAN/
  README.md
  DEEP_AGENT_ROADMAP.md
  EVAL_DESIGN.md
  MCP_TOOL_SPEC.md
  MEMORY_DESIGN.md
  MONITOR_AGENT_DESIGN.md

agent-service/
  app/
  evals/
  tests/
  README.md
```

项目 README 首页要展示：

- 一张架构图。
- 一段端到端 demo。
- 一张工具调用 trace。
- 一张 eval 指标表。
- 一张 monitor failure report。
- 一段“失败如何优化”的案例。

这比只写“实现了旅游助手”有含金量得多。

## 7. 推荐简历写法

可以写成 4 条：

```text
- 设计 Java + Python 分布式 Agent 架构，将旅游业务 API、路线规划、图片日记生成、小红书草稿同步封装为 MCP tools/resources/prompts，支持结构化 schema、工具安全标注和审计日志。
- 构建端到端意图识别与多 Agent routing 系统，覆盖 9 类旅游业务意图、slot 抽取、低置信度追问、工具选择和 critic 校验，记录完整 routing/tool trace。
- 实现多层记忆管理，包括 Redis 会话记忆、MySQL 用户偏好、旅行事件记忆和向量检索记忆，支持记忆检索、摘要压缩、用户确认写入和污染率评测。
- 建设 Agent 评测与 Monitor Agent 闭环，覆盖 intent accuracy、slot F1、tool-call success rate、memory hit rate、端到端成功率和线上失败聚类，并基于 trace 优化检索召回与工具错误回退。
```

## 8. 当前最应该先做什么

你现在不要一口气做全部。第一步只做 3 个东西：

1. `agent-service` 的 `/agent/chat` 统一入口。
2. intent router 的结构化输出。
3. trace 记录。

原因很简单：没有 trace，就没有评测；没有评测，就无法证明深度；没有 intent router，后面 MCP、memory、多 Agent 都会乱。

建议第一周目标：

```text
输入一句话
  -> 输出 intent JSON
  -> 选择 DiaryAgent 或 RouteAgent
  -> 调一个假工具
  -> 生成最终响应
  -> 保存 trace
  -> 跑 30 条 intent eval
```

这一步做好后，项目就从“调用大模型”变成了“Agent 工程系统”。

## 9. 官方资料参考

- MCP specification: https://modelcontextprotocol.io/specification/latest
- MCP tools: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- MCP Python SDK: https://github.com/modelcontextprotocol/python-sdk
