# 个性化旅游系统 Java 重构 — 开发日志 10

---

## 📅 2026-05-04 第十次开发：Agent 服务多 Agent 架构重构、日记自动生成、SQLite 持久化与会话管理修复

### 🎯 本次目标

本轮是对 Python agent 服务的一次深度重构，核心目标 4 个：

1. 将单一大 orchestrator 重构为多 Agent 架构（ChatAgent + DiaryAgent）；
2. 实现完整的日记自动生成流水线（图片识别 → 要素提取 → 正文撰写 → 润色 → 持久化）；
3. 用 SQLite 替换进程内内存字典，解决会话重启丢失问题；
4. 修复前端"新建聊天后历史对话丢失"的 bug。

---

## ✅ 本轮完成的功能与改动

### 1. 多 Agent 架构重构

**旧架构：** 单一 `orchestrator.py`（~335 行），所有意图处理（路线、日记、推荐、闲聊）混杂在一起，工具调用通过硬编码 if-else 分发。

**新架构（仿 hermes-agent 核心模式）：**

```
agent-service/app/
├── agent/
│   ├── base_agent.py       ← Agent 抽象基类（ABC）
│   ├── dispatcher.py       ← 意图分发器，注册/路由/生命周期管理
│   ├── chat_agent.py       ← 主对话 Agent（路线规划/推荐/闲聊，工具集模式）
│   ├── diary_agent.py      ← 日记生成 Agent（独立子Agent，异步执行）
│   ├── llm_client.py       ← LLM 抽象层（已修复 API key 泄露 bug）
│   └── prompts.py          ← 提示词集中管理
├── tools/
│   └── registry.py         ← 工具注册表（装饰器注册，仿 hermes 单例模式）
├── db/
│   └── sqlite_store.py     ← SQLite 持久化存储
└── main.py                 ← FastAPI 路由入口
```

**核心设计决策：**

- **混合模式**：ChatAgent 使用工具集模式（注册 tool → LLM function calling），适合短交互；DiaryAgent 使用独立子 Agent 模式（多阶段异步流水线），适合耗时 10-30s 的长任务。
- **意图路由**：`Dispatcher.detect_intent()` → LLM 分类（可用时）→ 关键词规则（降级）→ 路由到对应 Agent。
- **Agent 基类**：统一接口 `process(message, context) → AgentResponse`，新增 Agent 只需继承 `BaseAgent` 并注册到 Dispatcher。

新增文件：

- `agent-service/app/agent/base_agent.py`
- `agent-service/app/agent/dispatcher.py`
- `agent-service/app/agent/chat_agent.py`
- `agent-service/app/agent/diary_agent.py`
- `agent-service/app/tools/registry.py`

重点修改：

- `agent-service/app/agent/orchestrator.py` — 保留兼容，修复 `_llm_available()` 返回 API key 字符串的严重 bug

---

### 2. 日记自动生成（DiaryAgent）

**5 阶段异步流水线：**

| 阶段 | 进度 | 说明 |
|------|------|------|
| 图片理解 | 0% → 30% | 多模态 LLM 识别上传图片中的景点、美食、活动 |
| 要素提取 | 30% → 50% | 从文本 + 图片描述中提取结构化要素（地点/活动/心情/亮点） |
| 正文撰写 | 50% → 80% | 基于要素按风格（小红书/随笔/攻略）生成日记正文 |
| 润色定稿 | 80% → 95% | 修正语句，添加 #话题标签 |
| 持久化 | 95% → 100% | 通过 Java 后端 `/api/diaries` 保存到 MySQL |

**输入支持：**

- 纯文本："今天去了西湖，吃了东坡肉"
- 图片 + 文字：上传照片 + 口述经历
- 三种风格：小红书（活泼 emoji 短句）、随笔（文艺叙事）、攻略（实用 tips）

**异步交互模式：**

```
POST /agent/diary/generate → { task_id, status: "pending" }
GET /agent/diary/status/{task_id} → { status, progress, message, result? }
```

前端通过轮询（每 2s）获取进度，完成后展示最终日记。

新增文件：

- `agent-service/app/agent/diary_agent.py`

重点修改：

- `agent-service/app/tools/tourism_api.py` — 新增 `create_diary()` 方法
- `agent-service/app/schemas.py` — 新增 `DiaryTaskStatus`、`DiaryGenerateRequest/Response`
- `agent-service/app/main.py` — 新增日记状态轮询端点

---

### 3. SQLite 会话持久化

**旧方案：** 会话存储在进程内 `dict`（`SessionStore._sessions: dict`），服务重启全部丢失。

**新方案：** 仿 hermes-agent `SessionDB` 设计，SQLite WAL 模式。

**数据库结构：**

```sql
CREATE TABLE sessions (
    session_id  TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    title       TEXT NOT NULL DEFAULT '新对话',
    preview     TEXT NOT NULL DEFAULT '',
    mode        TEXT NOT NULL DEFAULT 'travel_assistant',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    role        TEXT NOT NULL,
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
```

**关键特性：**

- **WAL 模式**：支持并发读写，写入不阻塞读取
- **用户隔离**：`session_id + user_id` 双重校验，防止跨用户串读
- **级联删除**：删除 session 自动清理 messages
- **线程安全**：`threading.Lock` 保护写操作
- **绝对路径**：DB 文件路径基于 `agent-service/data/agent_sessions.db`，不依赖 CWD
- **Trace 兼容**：保留 `agent_trace.jsonl` 写入

新增文件：

- `agent-service/app/db/__init__.py`
- `agent-service/app/db/sqlite_store.py`

验证结果：

- ✅ 服务重启后所有会话和消息完整保留
- ✅ 用户 A 无法访问用户 B 的会话
- ✅ DELETE 会话后级联清理消息

---

### 4. 前端聊天页面修复与增强

**Bug 修复：**

| Bug | 根因 | 修复 |
|-----|------|------|
| 新建聊天后历史对话丢失 | `handleSelectSession` 只从本地 sessions 数组（仅摘要，无 messages）读取，从未调用 `getAgentSession(id)` | 改为异步调用后端 API 获取完整消息 |
| 点击历史会话后消息空白 | 同上 | 显示 `<Spin />` 加载态，加载完成后回填消息列表 |

**新增功能：**

- **删除会话**：侧边栏会话项悬停时显示 × 按钮，点击删除（`DELETE /agent/sessions/{id}`）
- **加载指示**：切换会话时显示 `<Spin />` 加载动画

重点修改：

- `frontend/src/pages/PersonalTravelAssistantPage.jsx`
- `frontend/src/App.css` — 新增 `.assistant-session-delete` 样式
- `frontend/src/services/api.js` — `agentAPI` 层兼容新字段 `metadata`

---

### 5. 安全修复

| 严重程度 | 问题 | 文件 | 修复 |
|----------|------|------|------|
| **严重** | `_llm_available()` 返回 API key 字符串，每轮对话写入 trace 文件 | `orchestrator.py:51-54` | 改为 `bool(settings.llm_api_key)` |
| **高** | `.env.example` 包含真实 API key | `.env.example` | 替换为 `your-api-key-here` |
| **中** | trace 包含完整 system prompt，增长过快 | `dispatcher.py` | 不再写入完整 prompt |

---

## 🧩 架构决策

### 1. 工具集 vs 独立 Agent 的边界

- **ChatAgent（工具集模式）**：适合短交互（查路线、推荐景点、闲聊），一轮 LLM 调用完成。工具通过 `ToolRegistry` 注册为 OpenAI function calling 格式。
- **DiaryAgent（独立子 Agent）**：适合长任务（多阶段 LLM 调用链），通过 `threading.Thread` 后台异步执行，`/diary/status/{id}` 轮询进度。

选择标准：如果任务耗时 > 3s 或需要 3+ 轮 LLM 调用，走独立 Agent；否则走工具集。

### 2. SQLite vs MySQL vs Redis

选择 SQLite 的理由：
- Agent 是单实例 Python 进程，不需要分布式共享存储
- 零运维：一个文件搞定，不需要配数据源、连接池
- hermes-agent 验证过的生产级方案（WAL + FTS5）
- 后续可替换：接口抽象（`SessionDB`），改成 Redis/MySQL 只需换实现

### 3. 前端会话生命周期

```
新建聊天 → POST /agent/chat (session_id=null) → 后端创建新 session
切换会话 → GET /agent/sessions/{id} → 加载完整消息列表
继续对话 → POST /agent/chat (session_id=xxx) → 追加消息
删除会话 → DELETE /agent/sessions/{id} → 级联清理
```

---

## 📋 API 变更清单

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/agent/health` | 健康检查（新增 agents 列表字段） |
| `GET` | `/agent/sessions` | 会话列表（摘要，不含消息） |
| `GET` | `/agent/sessions/{id}` | 会话详情（含完整消息流） |
| `DELETE` | `/agent/sessions/{id}` | 删除会话（**新增**） |
| `PUT` | `/agent/sessions/{id}/rename` | 重命名会话（**新增**） |
| `POST` | `/agent/chat` | 聊天入口（reply 新增 `metadata` 字段） |
| `POST` | `/agent/diary/generate` | 启动日记生成任务（返回 `task_id`） |
| `GET` | `/agent/diary/status/{task_id}` | 轮询日记生成进度（**新增**） |

---

## 🧪 测试验证

所有测试通过 `curl` 手动集成测试：

- ✅ 多 Agent 注册与路由
- ✅ 聊天创建会话、追加消息
- ✅ 会话列表、详情、删除
- ✅ 跨用户隔离（用户 A 无法访问用户 B 的会话）
- ✅ 服务重启后数据完整保留
- ✅ 日记异步生成与进度轮询
- ✅ 新建聊天不覆盖旧会话（3 个独立 session 并存）
- ✅ 前端 API 字段兼容（snake_case ↔ camelCase 双向归一化）

---

## 📁 文件变更总览

| 操作 | 文件 |
|------|------|
| **新增** | `agent-service/app/db/__init__.py` |
| **新增** | `agent-service/app/db/sqlite_store.py` |
| **新增** | `agent-service/app/agent/base_agent.py` |
| **新增** | `agent-service/app/agent/dispatcher.py` |
| **新增** | `agent-service/app/agent/chat_agent.py` |
| **新增** | `agent-service/app/agent/diary_agent.py` |
| **新增** | `agent-service/app/tools/registry.py` |
| **修改** | `agent-service/app/agent/__init__.py` |
| **修改** | `agent-service/app/agent/orchestrator.py` |
| **修改** | `agent-service/app/main.py` |
| **修改** | `agent-service/app/schemas.py` |
| **修改** | `agent-service/app/tools/tourism_api.py` |
| **修改** | `agent-service/.env.example` |
| **修改** | `frontend/src/pages/PersonalTravelAssistantPage.jsx` |
| **修改** | `frontend/src/App.css` |

---

## 🔜 下一步建议

1. **流式响应**：ChatAgent 接入 `chat_stream()`，前端 SSE 逐字显示
2. **WebSocket 推送**：日记生成进度通过 WebSocket 推送替代轮询
3. **Agent 记忆系统**：跨会话的用户偏好记忆（"我喜欢安静的地方"）
4. **更多 Agent**：行程规划 Agent（多日行程优化）、翻译 Agent（多语言）
5. **前端日记页**：日记生成结果预览 + 一键发布到日记列表
