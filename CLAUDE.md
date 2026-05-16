# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

个性化旅游系统 — a full-stack tourism platform with Spring Boot backend, React frontend, iOS SwiftUI client, and Python FastAPI agent service. Backend handles A* path planning, indoor navigation, Huffman compression, AC-automaton text filtering, recommendation/sorting algorithms, and full CRUD for places, diaries, foods, and facilities.

## Quick-start shortcuts

When the user says **"启动后端"** or **"启动前端"** or **"启动agent"** or **"启动所有服务"**, run the script directly — no exploration needed:

```bash
# Start backend (port 8080)
bash scripts/start-backend.sh

# Start frontend (port 5173)
bash scripts/start-frontend.sh

# Start agent (port 9000)
bash scripts/start-agent.sh

# Start all services
bash scripts/start-all.sh

# Stop all
bash scripts/stop-all.sh
```

## Manual build & run

```bash
# Backend
cd tourism-system-java && mvn spring-boot:run

# Tests
mvn test

# Frontend
cd frontend
npm run dev        # dev server
npm run build      # production build
npm run lint       # eslint

# Agent
cd agent-service
pip install -e .
cp .env.example .env  # 编辑 .env 填入 LLM_API_KEY
uvicorn app.main:app --reload --host 0.0.0.0 --port 9000

# Agent tests
cd agent-service && python -m pytest tests/ -v

# iOS app
cd TourismSystemApp
xcodebuild -project TourismSystemApp.xcodeproj -scheme TourismSystemApp \
  -destination 'platform=iOS Simulator,name=iPhone 17' build
```

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Spring Boot 3.3.5, MyBatis-Plus 3.5.8, MySQL 8, Redis (Lettuce), JGraphT 1.5.2 |
| Agent | Python FastAPI, Uvicorn, Pydantic v2 (port 9000) |
| Auth | Spring Security + JWT (jjwt 0.12.6) |
| API docs | Springdoc OpenAPI 2.6.0 (Swagger UI at `/swagger-ui.html`) |
| Frontend | Vite + React + Ant Design + Axios |
| iOS | SwiftUI, MapKit |
| Algorithms | A*, Dijkstra, TSP (NN/DP/SA/GA), Huffman, AC automaton, TF-IDF, Top-K sorting |
| Test | H2 in-memory DB, MockMvc |

## Agent LLM 配置

Agent 通过统一的 `llm_client` 接口支持多种大模型，切换模型只需改 `.env` 环境变量。

| 配置项 | 说明 |
|--------|------|
| `LLM_PROVIDER` | `openai_compatible`（默认）或 `anthropic` |
| `LLM_MODEL` | 模型名，如 `gpt-4o`, `deepseek-chat`, `claude-opus-4-7` |
| `LLM_API_KEY` | API 密钥 |
| `LLM_BASE_URL` | API 地址（OpenAI 兼容接口可自定义） |

**未配置 LLM_API_KEY 时自动降级为规则模式**，不影响服务正常启动。

核心文件：

| 文件 | 作用 |
|------|------|
| `agent-service/app/agent/dispatcher.py` | 统一调度器：意图路由 → Agent 分发 → SSE 流式输出 |
| `agent-service/app/agent/base_agent.py` | Agent 基类：统一的 process / can_handle / get_tools 接口 |
| `agent-service/app/agent/llm_client.py` | 统一 LLM 接口：`BaseLLMProvider` → `OpenAICompatibleProvider` / `AnthropicProvider`，含 vision 支持 |
| `agent-service/app/core/intent.py` | 意图分类器：10 种意图，LLM + 关键词规则双模式 |
| `agent-service/app/agent/prompts.py` | 提示词集中管理（系统/路线/日记/反向推荐 + 6 种搭子人格） |
| `agent-service/app/db/sqlite_store.py` | SQLite WAL 持久化：SessionDB / UserBuddyDB / TaskDB |
| `agent-service/app/tools/registry.py` | ToolRegistry 单例：OpenAI function calling 格式工具注册/分发 |
| `agent-service/app/tools/tourism_api.py` | Java 后端 HTTP 客户端 |
| `agent-service/app/config.py` | LLM 配置字段 |
| `agent-service/.env.example` | 环境变量模板 |

### Agent 清单（8 个）

| Agent | Intent | 说明 |
|-------|--------|------|
| ChatAgent | `plan_trip_route`, `recommend_place`, `general_chat`, `search_place`, `reverse_recommend` | 主对话 Agent，支持 6 种出游搭子人格 + 工具调用 ReAct 循环 |
| RouteAgent | `plan_trip_route` | 路线规划 Agent（优先级高于 ChatAgent），5 工具 + 4 轮 LLM 规划 |
| DiaryAgent | `generate_diary` | 日记生成 Agent，5 阶段异步流水线（图片理解→要素提取→正文→润色→持久化） |
| SceneAgent | `scene_recommend` | "此刻出发"场景推荐，5 条时间/天气规则 |
| DiceAgent | `dice_adventure` | 扔骰子随机微任务，8 模板池 + 真实数据槽位填充 |
| PersonaAgent | `analyze_personality` | 旅行人格分析，5 种人格类型 + 规则引擎分类 |
| MemoryAgent | `generate_memory` | 旅行回忆聚合，委托 DiaryAgent 共享文本生成函数 |
| *待扩展* | — | 继承 `BaseAgent`，注册到 `init_agents()` 即可 |

### Agent API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/agent/health` | 健康检查 + Agent 列表 |
| POST | `/agent/chat` | 同步对话 |
| POST | `/agent/chat/stream` | SSE 流式对话（token/tool_call/tool_result/done/error） |
| GET/PUT/DELETE | `/agent/user/buddy` | 出游搭子 CRUD |
| POST | `/agent/user/buddy/{id}/use` | 记录搭子使用，递增偏好分数 |
| POST | `/agent/diary/generate` | 启动日记生成任务 |
| GET | `/agent/diary/status/{task_id}` | 轮询日记生成进度 |
| POST | `/agent/route/plan` | 自然语言路线规划 |
| GET/DELETE | `/agent/sessions` | 会话管理 |

扩展新 provider：继承 `BaseLLMProvider`，实现 `chat()` / `chat_stream()`，在 `create_llm_provider()` 中注册即可。

## API response format

All endpoints return `Result<T>`: `{"code": 200, "message": "success", "data": ...}`. Code `500` on error. The frontend `api.js` normalizes via `normalizeEnvelope()` and includes legacy fallback logic for missing endpoints.

## API layering

- **Canonical API**: `/api/navigation/*`, `/api/places/*`, `/api/diaries/*`, `/api/foods`, `/api/facilities/*`, `/api/auth/*`
- **Legacy/compat**: `/api/routes/*` (→ use `/api/navigation/*`), `/api/indoor/*` (→ use `/api/navigation/indoor*`)
- **Algorithm/demo**: `/api/algorithm/*` — only for debug/auxiliary, not for business pages

Full mapping in `DEV-PLAN/REQUIREMENTS_API_TEST_MATRIX.md`.

## Backend architecture

```
com/tourism/
├── algorithm/     ← A*, Dijkstra, TSP, Huffman, AC automaton, TF-IDF, recommendation, Top-K
├── config/        ← Security, Redis, Swagger, MyBatis-Plus, WebMVC
├── controller/    ← REST endpoints
├── security/      ← JWT filter + UserDetailsService
├── service/       ← Business logic interfaces
├── service/impl/  ← Business logic implementations
├── mapper/        ← MyBatis-Plus mappers (DB layer)
├── model/
│   ├── entity/    ← 8 DB tables: SpotPlace, SpotBuilding, SpotFacility, SpotRoadEdge, SpotFood, TravelDiary, SysUser, UserBehavior
│   ├── dto/       ← Request bodies (LoginDTO, RegisterDTO)
│   └── vo/        ← Response views (LoginVO, PlaceDetailVO, UserProfileVO)
├── exception/     ← GlobalExceptionHandler
└── utils/         ← Result, GeoUtils, JWT utils, JsonUtils
```

Entity IDs are String-based (`"place_001"`, `"diary_001"`). JSON-array fields (keywords, features, images, tags, interests) are stored as TEXT and parsed/deserialized at boundaries.

## Controllers

| Controller | Base path | Key endpoints |
|---|---|---|
| AuthController | `/api/auth` | login, register, me |
| PlaceController | `/api/places` | list, detail, search, hot, top-rated, recommend, sort, rate |
| DiaryController | `/api/diaries` | list, detail, CRUD, search, recommend, rate |
| NavigationController | `/api/navigation` | shortest-path, mixed-vehicle-path, multi-destination, indoor*, reload-graph |
| FacilityController | `/api/facilities` | list, detail, byPlace, search, nearby (LBS), nearest (path-distance) |
| FoodController | `/api/foods` | search, byPlace, byCuisine, popular, cuisines, detail |
| MediaController | `/api/upload`, `/api/aigc` | image/video upload, convert-to-video |
| UserController | `/api/users` | list, detail, update, behavior, views, ratings |
| AlgorithmController | `/api/algorithm` | search, recommend, compress, decompress, filter-text, sort |
| StatsController | `/api/stats` | system statistics |
| BuildingController | `/api/buildings` | building list/search/detail |
| LegacyNavigationController | `/api/routes`, `/api/indoor` | Legacy compat only |

## Frontend architecture

`frontend/src/services/api.js` is the single source of truth for all API calls. It handles:
- JWT token injection via Axios interceptor
- Response normalization (`normalizeEnvelope`, `unwrapPageRecords`)
- Legacy fallback logic for 404/405/501 endpoints (to be removed per release criteria)

Key pages: `HomePage`, `PlacesPage`, `PlaceDetailPage`, `DiariesPage`, `DiaryDetailPage`, `RoutePage`, `FacilityQueryPage`, `FoodSearchPage`, `IndoorNavigationPage`, `AIGCPage`, `StatsPage`, `LoginPage`.

## iOS app

SwiftUI app at `TourismSystemApp/` with 4 tabs: 景点, 路线, 日记, 我的.
API services in `Services/` mirror the frontend's `api.js` structure. ViewModels in `ViewModels/` handle async data loading via `@MainActor`. All Codable models in `Models/` match the Java entities.

## Test baseline

Tests use `src/test/resources/schema.sql` + `data.sql` for H2 in-memory setup. Key integration test files:
- `NavigationFacilityIntegrationTests` — path planning + facility queries
- `DiaryAlgorithmIntegrationTests` — diary search, rate, compression
- `IndoorNavigationIntegrationTests` — indoor nav

## DEV-PLAN directory

Sequential development logs (`DEV_LOG01` through `DEV_LOG07`) document the full build-up of the system. `REQUIREMENTS_API_TEST_MATRIX.md` is the architecture acceptance matrix mapping requirements → pages → canonical APIs → test evidence.



Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
