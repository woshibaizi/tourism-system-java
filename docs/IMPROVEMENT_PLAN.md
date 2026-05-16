# 个性化旅游系统 — 不足分析与优化改进计划

> 2026-05-11，基于 `FUNCTION_CATALOG.md` + 全部 10 期 DEV_LOG + 源码审查

---

## 总览

按优先级分四级：**P0 阻塞发布** → **P1 影响体验** → **P2 架构债务** → **P3 远期规划**。

每个问题都包含：现象 → 根因 → 建议方案 → 预期收益。

---

## P0 — 阻塞发布的质量问题

### P0-1：前端 9 处 "missing endpoint" 静默降级，掩盖后端故障

**现象**：`api.js` 中定义了 `isMissingEndpointError` 函数，匹配 404/405/501 状态码后不抛异常，而是走前端本地排序/过滤/搜索逻辑，返回 `successResult` 伪成功。共 9 处调用点：

| 函数 | 降级行为 |
|------|----------|
| `recommendPlaces` | 404→hot 接口→前端排序 |
| `sortPlaces` | 404→hot/top-rated→前端排序 |
| `getBuildingsByPlace` | 404→全量列表+前端过滤 |
| `getNearestFacilities` | 404→前端计算直线距离 |
| `calculateShortestRoute` | 404→`failResult("未实现", 501)` |
| `calculateMultiDestinationRoute` | 404→`failResult("未实现", 501)` |
| `searchDiaries` | 404→前端全量匹配搜索 |
| `recommendDiaries` | 404→hot→前端排序 |
| `statsAPI.getStats` | 404→前端聚合计数 |

**风险**：如果后端某个接口因 bug 崩了返回 500→502，这条链路正常抛错；但如果后端接口被误删/路由重命名返回 404，页面将**静默退化到前端兜底逻辑**，数据可能不准确，而开发者完全感知不到。

**建议方案**：
1. 逐一确认 9 个 canonical API 均已正确实现且 Swagger 可达
2. 为每个 API 补齐一个 H2 集成测试锁定契约存在
3. 全部确认后，将 `isMissingEndpointError` 改为直接 throw（只保留真正需要兼容的旧端点 fallback）
4. 在 CI 中加一条 `curl` smoke：启动后端后对 canonical API 逐个请求，任一个返回 404 则构建失败

**预期收益**：杜绝"前端伪成功"，故障可观测。

---

### P0-2：后端集成测试仅 16 个 case，大量业务闭环无覆盖

**现象**：5 个测试类，共 16 个 `@Test` 方法，覆盖范围严重不足。

| 测试类 | case 数 | 覆盖域 |
|--------|---------|--------|
| `TourismApplicationTests` | 1 | 上下文加载 |
| `NavigationFacilityIntegrationTests` | 7 | 路径规划+设施排序+高德配置 |
| `DiaryAlgorithmIntegrationTests` | 4 | 日记搜索/评分/压缩/敏感词 |
| `IndoorNavigationIntegrationTests` | 3 | 室内导航 |
| `AgentServiceTests` | 1 | Agent 服务 |

完全缺失的测试：
- **认证流程**：login/register/token 过期/JWT 伪造
- **场所 CRUD**：分页、搜索、推荐、排序、评分
- **日记 CRUD**：创建/更新/删除、压缩存储验证
- **美食模块**：全部接口
- **用户行为**：浏览记录、评分回刷
- **AIGC 链路**：上传、生成、格式验证
- **错误契约**：参数校验、业务异常、鉴权拒绝的返回格式

**建议方案**：
1. 按 `REQUIREMENTS_API_TEST_MATRIX.md` 的"待补测"项逐个补齐
2. 优先补：认证（P0）、美食（P0）、日记 CRUD（P0）、AIGC 契约（P1）
3. 每个 Controller 至少 1 个正常路径 + 1 个异常路径
4. 目标：从 16 个 case 推到 40+ 个 case

**预期收益**：发布有底气，重构不恐惧。

---

### P0-3：Agent 服务无自动化测试

**现象**：`agent-service/tests/` 下仅一个 `test_session_store.py`，DIaryAgent 5 阶段流水线、Dispatcher 意图路由、ChatAgent 工具调用、LLM 抽象层均无测试。

**风险**：Agent 是面向用户的前台服务，任何修改都可能无声破坏意图路由或日记生成质量。

**建议方案**：
1. 补 `test_dispatcher.py`：对 9 类意图各 3-5 条样例，验证 intent 分类正确
2. 补 `test_diary_agent.py`：mock LLM 返回，验证 5 阶段流水线状态机
3. 补 `test_chat_agent.py`：验证 tool calling 格式正确、降级规则模式触发
4. 补 `test_api.py`：FastAPI TestClient 对所有 `/agent/*` 端点做 contract test
5. 全部加入 `pytest` 并通过 CI

**预期收益**：Agent 改动可回归验证。

---

## P1 — 影响用户体验的问题

### P1-1：Agent 无流式响应，用户需等待完整回复

**现象**：`ChatAgent.chat()` 走的是同步完整回复，`llm_client.py` 中 `chat_stream()` 已实现但 agent 层未接入。用户发消息后需等待 3-15 秒才能看到完整回复。

**建议方案**：
1. `ChatAgent` 新增 `chat_stream()` 方法
2. FastAPI 路由改为 `StreamingResponse`，使用 SSE 逐 token 推送
3. 前端 `PersonalTravelAssistantPage` 接入 `EventSource` 或 fetch readable stream
4. 保留非流式模式作为 fallback（LLM 不支持 SSE 时）

**预期收益**：对话体验从"等待焦虑"变为"即时响应"。

---

### P1-2：校内导航"室内导航"标签页是占位 UI

**现象**：`CampusNavigationPage` 有两个 Tab——"学校内导航"已实现，"室内导航"是占位说明。用户从校园导航页面无法进入室内导航。

**建议方案**：
1. 接回 `IndoorNavigationAlgorithm` 和 `indoor_navigation.json` 数据
2. 实现楼层选择 → 房间列表 → 起终点 → 路径计算 → 步骤展示的完整交互
3. 校内导航和室内导航的拼接（从楼外某点到楼内某房间）可放到 P2

**预期收益**：室内导航从文档承诺变为可用功能。

---

### P1-3：AIGC 输出格式契约不明确

**现象**：`POST /api/aigc/convert-to-video` 接受 `outputFormat=mp4` 参数，但当前实现（`generate_aigc_gif.py`）只能输出 GIF。参数会静默被忽略，用户请求 mp4 收到 gif。

**建议方案**：
1. 后端校验 `outputFormat`：不支持时返回明确错误或自动降级并附带 warning 字段
2. 在 Swagger 上标注当前支持格式为 `["gif"]`
3. 在响应中增加 `actualFormat` 字段，让前端知道实际格式
4. 若要真正支持 mp4，需引入 FFmpeg 依赖

**预期收益**：API 契约可信。

---

### P1-4：前端 lint 不通过，历史遗留问题未清理

**现象**：`npm run lint` 仍有 ~5 个 react-hooks warning（DEV_LOG08/09 多次提到），虽然不影响构建，但作为发布门槛不应长期忽略。

**建议方案**：
1. 跑一次 `npm run lint -- --fix` 自动修复
2. 手动处理剩余的 exhaustive-deps warning
3. 在 `eslint.config.js` 中将 warning 提升为 error（对关键规则）
4. CI 中加 `npm run lint` 为阻断项

**预期收益**：代码风格一致，CI 可强制执行。

---

### P1-5：美食模块缺少评分/距离排序的端到端验证

**现象**：美食后端接口（`GET /api/foods?sortBy=rating|distance`）已实现，但 `REQUIREMENTS_API_TEST_MATRIX` 标记为"待补测"，实际前端使用情况也不清楚。

**建议方案**：
1. 补 `FoodIntegrationTests`：覆盖列表/搜索/菜系过滤/评分排序/距离排序
2. 前端 `FoodSearchPage` 验证排序按钮是否调用正确参数
3. 若距离排序依赖路径图，测试中需确认 fallback 到直线距离的路径

---

## P2 — 架构与技术债务

### P2-1：前端 api.js 体积膨胀，单文件承载过多职责

**现象**：`api.js` 约 1500+ 行，包含了所有 API 调用、响应归一化、fallback 逻辑、数据格式化。排查问题和新增接口都需要在这个文件中翻找。

**建议方案**：
1. 拆分为 `api/` 目录：
   ```
   api/
   ├── client.js          # axios 实例 + JWT 拦截器
   ├── normalize.js       # normalizeEnvelope, unwrapPageRecords
   ├── places.js          # 场所相关
   ├── navigation.js      # 导航相关
   ├── diaries.js         # 日记相关
   ├── foods.js           # 美食相关
   ├── agent.js           # Agent 相关
   └── index.js           # 统一导出
   ```
2. 拆分时同步删除所有 `isMissingEndpointError` fallback 分支
3. 每个文件导出纯函数，便于单元测试

**预期收益**：API 层可维护、可测试。

---

### P2-2：旧 `SessionStore`（内存字典）与 `SqliteStore` 并存，实际使用路径不明

**现象**：`memory.py` 中的 `SessionStore` 使用进程内 `dict`（注释写"后续替换"），`db/sqlite_store.py` 实现了 `SessionDB`（SQLite WAL），但 `main.py` 实际依赖哪个需要确认。两者并存增加了维护成本。

**建议方案**：
1. 确认 `main.py` 已切换到 `SessionDB`
2. 删除 `memory.py` 中的旧 `SessionStore` 类（或标记 deprecated）
3. 若 `memory.py` 的 `session_store` 单例仍被引用，全部迁移到 `SessionDB`

---

### P2-3：后端缺少 Service 层单元测试

**现象**：所有后端测试都是 `@SpringBootTest` 集成测试，启动完整 Spring 上下文 + H2 数据库。没有对单个 Service 或 Algorithm 类的纯单元测试。

**影响**：
- 集成测试启动慢（每次 10-20s）
- 难以覆盖边界条件和异常路径
- 算法类（如 TSP、Huffman、AC 自动机）更适合纯单元测试

**建议方案**：
1. 对 9 个算法类各写 3-5 个纯 JUnit 测试（不启动 Spring）
2. 对 Service 层写 Mockito mock Mapper 的单元测试
3. 保持集成测试用于跨层验证（Controller→Service→Mapper→DB）

---

### P2-4：Agent 无长期用户偏好记忆

**现象**：AGENT-PLAN 阶段 D 规划的四层记忆（短期会话/长期偏好/旅行事件/向量检索），当前只实现了第一层（会话存储）。用户每次对话都是"新用户"。

**建议方案**：
1. 从已有 `user_behavior` 表提取用户偏好（喜欢的场所类型、评分倾向）
2. 在 `memory.py` 中增加偏好读写方法
3. ChatAgent 处理请求时注入用户偏好到 system prompt
4. 每次对话后异步抽取新偏好（需用户确认机制防污染）

---

### P2-5：无 CI/CD 流水线

**现象**：项目没有 `.github/workflows/` 或其他 CI 配置。所有验证靠手动 `mvn test` 和 `npm run build`。

**建议方案**：
1. 加 GitHub Actions workflow：
   ```yaml
   - backend: mvn test
   - frontend: npm ci && npm run build && npm run lint
   - agent: pip install -e . && pytest
   ```
2. PR 合并前必须全部通过
3. 后续加 Docker 镜像构建与推送

---

### P2-6：日志与可观测性薄弱

**现象**：
- Java 后端依赖默认的 Spring Boot logging，没有结构化日志
- Agent 有 trace jsonl 但只记录了基本请求信息
- 没有统一的 request ID 贯穿 Java → Python → Java 调用链
- 没有 metrics/health check 端点（除 `/health` 外）

**建议方案**：
1. Java 侧引入 `Logback` MDC，每个请求生成 `X-Request-ID`
2. Java 调 Python Agent 时透传 `X-Request-ID`
3. Trace 记录增加结构化字段（latency、tool_calls、error_type）
4. 加 `/actuator/health`（Spring Boot Actuator）

---

## P3 — 远期规划

### P3-1：iOS App 仅有骨架

**现象**：`TourismSystemApp/` 有 4 Tab 基础结构，但实际 API 调用、数据模型映射、离线缓存均未实现。

**建议**：在 Web 端稳定后，按 Web 端 API 契约复刻 SwiftUI 版本，优先做景点浏览和路线查看两个 Tab。

---

### P3-2：Agent 无评测框架

**现象**：AGENT-PLAN 阶段 F 规划的 eval dataset + eval runner + 指标报告尚未开始。

**建议**：
1. 先建最小可用评测集（每种意图 20 条 case）
2. 实现 `eval_runner.py`：deterministic check + LLM-as-judge
3. 每次改 Agent 后跑 eval 看指标变化

---

### P3-3：前端包体积过大

**现象**：DEV_LOG05/06 多次提到 Vite build 有 chunk size 警告。Ant Design 全量引入是主要原因。

**建议方案**：
1. Ant Design 按需引入（tree-shaking）或换用更轻量的组件库
2. 路由级 lazy loading（`React.lazy` + `Suspense`）
3. 图片资源压缩 + WebP 格式

---

### P3-4：MCP 小红书同步未实现

**现象**：AGENT-PLAN 阶段 C 规划的小红书草稿/发布 MCP tool 未实现。`skill_registry.py` 和 `tools/` 目录已搭好框架但无实际对接代码。

**建议**：在 Agent 评测体系搭建后，按 MCP 规范实现 `xiaohongshu_create_draft` tool，先做 dry-run。

---

### P3-5：高德导航Provider测试覆盖不足

**现象**：当前自动化测试只覆盖"无高德 key → fallback 本地算法"场景。`GAODE_NAVIGATION_TEST_CHECKLIST.md` 列出的真实高德返回契约、超时回退、provider 统一映射等场景均未自动化。

**建议**：搭建高德 mock server（wiremock）后补全 provider switch 测试。

---

### P3-6：部分页面未完全迁移 Glass Frost 设计系统

**现象**：DEV_LOG09 提到 `ConcurrencyTestPage`、`DiaryDetailPage` 等页面的页头渐变未完全替换。

**建议**：做一次全局 CSS 变量 grep，确保所有硬编码颜色/渐变都被替换为 `--glass-*` 变量。

---

## 优先级汇总

| 优先级 | 数量 | 关键项 |
|--------|------|--------|
| P0 阻塞发布 | 3 | 前端 fallback 静默降级、后端测试缺口、Agent 零测试 |
| P1 影响体验 | 5 | Agent 流式、室内导航占位、AIGC 契约、lint、美食测试 |
| P2 架构债务 | 6 | api.js 拆分、SessionStore 清理、Service 单元测试、Agent 记忆、CI/CD、可观测性 |
| P3 远期规划 | 6 | iOS App、Agent 评测、包体积、MCP 小红书、高德测试、设计系统收尾 |

## 建议执行路径

**第一周（P0 收尾）**：删除前端 fallback + 补齐测试 + CI 流水线
**第二周（P1 体验）**：Agent 流式 + 室内导航 + AIGC 契约
**第三周（P2 架构）**：api.js 拆分 + 记忆系统 + 可观测性
**之后（P3）**：按需推进
