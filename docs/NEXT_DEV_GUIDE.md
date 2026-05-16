# 个性化旅游系统 — 后续开发指南

> 2026-05-11，整合 DESIGN_IMPROVEMENTS / IMPROVEMENT_PLAN / INNOVATION_IDEAS 三份文档

---

## 阶段总览

```
第 1-2 周  紧急修复    消灭 P0 阻塞项 + 现有设计缺陷
第 3-4 周  体验升级    Agent 流式 + 智能行程规划 + 场景推荐
第 5-6 周  创新功能    NPC 人格 + 赛博算命 + 发疯文学 + 旅行人格
第 7-8 周  架构整顿    api.js 拆分 + CI/CD + 测试补齐 + 可观测性
第 9 周+   远期探索    陌生人路线交换 + 掷骰子旅行 + iOS App
```

---

## 第一阶段：紧急修复（第 1-2 周）

### 1.1 删除前端 9 处静默降级 ★★★ 最高优先

**问题**：`api.js` 中 `isMissingEndpointError` 对 404/405/501 不抛错而是走前端兜底，后端接口挂了开发者感知不到。

**行动**：
- [ ] 逐一确认 9 个 canonical API 在 Swagger 上可达
- [ ] 每个 API 补 1 条 H2 集成测试
- [ ] 全部确认后将 `isMissingEndpointError` 改为直接 throw
- [ ] CI 加 `curl` smoke：对 canonical API 逐个请求，404 则构建失败

### 1.2 修复 ChatAgent 工具调用链路 ★★★

**问题**：`chat_agent.py` 注册了 3 个 tool 定义，但 `_process_with_llm()` 调 LLM 时没传 `tools` 参数，function calling 从未生效。

**行动**：
- [ ] `llm_client.chat()` 增加 `tools` 参数支持
- [ ] ChatAgent 将 `registry.get_definitions()` 传入 LLM 请求
- [ ] LLM 返回 tool_call 时由 `registry.dispatch()` 执行
- [ ] 工具结果回传 LLM 做最终回复（ReAct 循环）

### 1.3 修复路线规划工具调用真实 API ★★★

**问题**：`route_planner.py` 的 `build_route_outline()` 是硬编码占位，没接 Java 后端的 A*/Dijkstra/TSP。

**行动**：
- [ ] `route_planner.py` 调用 Java 后端 `/api/navigation/shortest-path` 和 `/api/navigation/multi-destination`
- [ ] 返回真实路径、距离、时间

### 1.4 补齐测试缺口 ★★★

**后端**（从 16 个 case → 40+）：
- [ ] 认证流程：login/register/token 过期/JWT 伪造
- [ ] 美食模块：列表/搜索/菜系过滤/排序
- [ ] 日记 CRUD：创建/更新/删除
- [ ] AIGC 链路：上传、生成、格式校验
- [ ] 每个 Controller 至少 1 正常 + 1 异常路径

**Agent**（从 1 个 test → 4 个）：
- [ ] `test_dispatcher.py`：9 类意图各 3-5 条用例
- [ ] `test_diary_agent.py`：mock LLM，验证 5 阶段流水线
- [ ] `test_chat_agent.py`：验证 tool calling + 降级规则
- [ ] `test_api.py`：FastAPI TestClient 对所有 `/agent/*` 做 contract test

### 1.5 其他小修

- [ ] AIGC 接口校验 `outputFormat`，不支持时返回明确错误 + `actualFormat` 字段
- [ ] `npm run lint` 清零，CI 中加 lint 阻断
- [ ] 确认 Agent 已切换到 `SessionDB`，删除 `memory.py` 中旧 `SessionStore`

---

## 第二阶段：体验升级（第 3-4 周）

### 2.1 智能一日游规划器 ★★★★★

**一句话**：输入"在杭州玩一天，预算 500，喜欢拍照和美食"，输出带时间轴的完整行程。

**编排流程**：
```
用户输入 → Dispatcher 提取 slot(地点/时长/预算/兴趣)
  → /api/places/recommend 获取候选景点
  → /api/foods 获取候选餐饮
  → /api/navigation/multi-destination 计算最优顺序
  → 编排为时间轴（09:00→09:30 景点A → 11:30 午餐 → ...）
```

**依赖**：1.2（ChatAgent 工具调用）和 1.3（路线规划）修复后自然可达。

**前端**：垂直时间轴 + 地点卡片 + 交通方式 + 耗时 + 花费估算，支持拖拽调整顺序后自动重算路线。

### 2.2 Agent 流式响应

**问题**：当前同步完整回复，用户等 3-15 秒。`llm_client.chat_stream()` 已实现但 Agent 层未接入。

**行动**：
- [ ] `ChatAgent` 新增 `chat_stream()` 方法
- [ ] FastAPI 路由改为 `StreamingResponse`，SSE 逐 token 推送
- [ ] 前端 `PersonalTravelAssistantPage` 接入 `EventSource` / fetch readable stream
- [ ] 保留非流式 fallback

### 2.3 场景化即时推荐（"此刻出发"）

**一句话**：根据时间、位置、天气推荐"现在最适合做的事"。

| 触发条件 | 推荐内容 |
|----------|----------|
| 11:30，距食堂 500m | "午饭时间，麻辣香锅 4.8★，步行 4 分钟" |
| 17:30，晴天，近湖边 | "日落前一小时，湖心亭最佳拍照点" |
| 14:00，下雨 | "图书馆咖啡厅的提拉米苏很受欢迎" |

**实现**：前端获取位置 + 时间 → 后端推荐算法增加"场景相关性"权重 → 首页卡片轮播。

### 2.4 首页个性化

**问题**：所有用户看到相同首页。

**行动**：
- [ ] 基于 `user_behavior` 表为每个用户生成"猜你喜欢"
- [ ] "继续探索"——最近浏览过地方的同类推荐
- [ ] 登录用户与游客看到不同首页

### 2.5 小体验修复

- [ ] 室内导航从占位 UI 接入 `IndoorNavigationAlgorithm`
- [ ] 美食与场所页面数据打通（场所详情页展示附近美食，美食页展示所在场所）
- [ ] 日记编辑器加 AI 辅助按钮（润色/生成标题/续写）
- [ ] 统计页面从 7 个数字升级为含趋势和用户个人维度

---

## 第三阶段：创新功能（第 5-6 周）

### 3.1 NPC 人格切换 ★★★★★ 改动最小，效果最炸

**核心**：只改 system prompt，零后端改动。

| 人格 | 风格 |
|------|------|
| 毒舌导游 | "又去断桥？除了人头还能看到什么？听我的，去茅家埠。" |
| 文艺流浪猫 | "喵。这条路乾隆走过，苏轼走过，现在轮到你了。" |
| 特种兵教官 | "0715 到达！0716 拍照！0717 转移——跑步走！" |
| 失意诗人 | "啊！食堂！你是饥饿的终点，卡路里的起点..." |
| 暗恋你的学妹 | "学长今天去图书馆了吗...那个位置阳光会在下午三点照到桌角..." |

**行动**：`prompts.py` 新增 5 组 system prompt + 前端角色选择 UI + 切换角色时清空上下文。

### 3.2 旅行发疯文学生成器

**核心**：DiaryAgent 换 prompt 模板，用互联网语体写游记。

风格：发疯文学 / 废话文学 / 咯噔文学 / 舔狗文学，一键复制或生成分享卡片。

**行动**：替换 DiaryAgent prompt + 前端风格选择器 + `html2canvas` 生成分享图。

### 3.3 赛博算命（用迷信包装推荐）

**核心**：黄历风格 UI，底层是推荐算法。"宜/忌"根据用户偏好反推，"幸运方向"是随机选附近高分地点。

**传播钩子**：每日运势卡片可分享，朋友扫码看自己的运势。

### 3.4 旅行人格分析

**核心**：基于 `user_behavior` 聚合行为特征 → 规则引擎映射到 5 种人格 → 影响推荐策略。

| 人格 | 特征 | 推荐策略 |
|------|------|----------|
| 美食猎人 | 评分偏向美食、浏览大量餐厅 | 优先高评分美食 |
| 摄影漫游者 | 偏好景区、"拍照""好看"关键词 | 推荐拍照点 |
| 文化探索者 | 偏好博物馆、历史建筑 | 推荐文化场所 |
| 高效打卡族 | 一日多目标、路程紧凑 | 推荐高密度区域 |
| 悠闲度假派 | 节奏慢、评分高但数量少 | 推荐安静场所 |

**决策**：用规则引擎而非 ML——当前 10 个测试用户，ML 无意义。规则可解释、开发快。

### 3.5 旅行回忆自动生成

**核心**：用户选时间范围 → 系统聚合日记/照片/地点/美食/步行距离 → DiaryAgent 生成总结文字 → 输出分享卡片或 GIF。

**前端**：DiariesPage 增加"生成旅行回忆"入口，预览确认后生成。

---

## 第四阶段：架构整顿（第 7-8 周）

### 4.1 api.js 拆分

`api.js`（~1500 行）拆为 `api/` 目录：
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
拆分时同步删除所有 `isMissingEndpointError` fallback。

### 4.2 CI/CD 流水线

- [ ] GitHub Actions：backend `mvn test` + frontend `npm ci && npm run build && npm run lint` + agent `pip install -e . && pytest`
- [ ] PR 合并前必须全部通过

### 4.3 Agent 用户偏好记忆

- [ ] 从 `user_behavior` 表提取用户偏好
- [ ] ChatAgent 处理请求时注入偏好到 system prompt
- [ ] 每次对话后异步抽取新偏好

### 4.4 可观测性

- [ ] Java 侧 Logback MDC，每个请求生成 `X-Request-ID`
- [ ] Java → Python Agent 透传 `X-Request-ID`
- [ ] Trace 记录增加结构化字段（latency、tool_calls、error_type）
- [ ] 加 `/actuator/health`

### 4.5 算法单元测试

- [ ] 9 个算法类各写 3-5 个纯 JUnit 测试（不启动 Spring）
- [ ] Service 层写 Mockito mock Mapper 的单元测试

---

## 第五阶段：远期探索（第 9 周+）

以下功能创新度高但优先级较低，视前面阶段的推进情况选择性投入：

| 功能 | 惊艳度 | 难度 | 简述 |
|------|--------|------|------|
| 陌生人路线交换 | ★★★★★ | ★★★ | 匿名分享路线到盲盒池，随机换回一条 |
| 扔骰子旅行 | ★★★★★ | ★★★ | 随机微任务生成器，"找到最近的树拍下树影" |
| 电子榨菜 | ★★★★ | ★★★ | 自动生成旅行碎片时间线（Stories 风格） |
| 旅行能量条 | ★★★★ | ★★ | 用"出片率/社死风险/还我妈生钱"替代 1-5 星 |
| 别去了 | ★★★ | ★★ | 反向推荐——哪些地方现在不该去 |
| 多人协作行程 | ★★★ | ★★★ | 共享行程 + 投票 + TSP 最优路线 |
| 校园 AR 语音导览 | ★★★ | ★★★★ | 接近建筑物时浏览器 TTS 自动播报 |
| 美食图谱 | ★★ | ★★★★ | 美食-美食相似矩阵 + 力导向图/雷达图 |
| iOS App | — | — | Web 稳定后复刻 SwiftUI 版 |

---

## 关键设计决策（已确定）

1. **智能行程规划粒度**：先做单天半日/一日规划，不做多日。单日完全基于现有数据，闭环可控。
2. **旅行人格计算方式**：用规则引擎，不选 ML。当前用户量不足以支撑模型训练。
3. **语音导览方式**：浏览器 `SpeechSynthesis` API，零成本、零延迟。
4. **旅行回忆输出格式**：首选用 `html2canvas` 生成可分享图片卡片，次选 GIF 动画。

---

## 进度追踪

| 阶段 | 时间 | 关键交付 | 状态 |
|------|------|----------|------|
| 第一阶段 | 第 1-2 周 | 静默降级清零 + ChatAgent 工具调用修复 + 测试从 16→40+ | ⬜ |
| 第二阶段 | 第 3-4 周 | 智能行程规划器 + Agent 流式 + 场景推荐上线 | ⬜ |
| 第三阶段 | 第 5-6 周 | NPC 人格 + 发疯文学 + 赛博算命 + 旅行人格 | ⬜ |
| 第四阶段 | 第 7-8 周 | api.js 拆分 + CI/CD + 可观测性 + Agent 记忆 | ⬜ |
| 第五阶段 | 第 9 周+ | 按优先级从远期列表中选取 | ⬜ |
