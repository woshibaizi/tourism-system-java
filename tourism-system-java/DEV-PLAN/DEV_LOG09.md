# 个性化旅游系统 Java 重构 — 开发日志 09

---

## 📅 2026-05-02 第九次开发：Agent 接入前端、全局 UI 重构、路径时间单位修复

### 🎯 本次目标

本轮核心是三步并进：

1. 把 Python agent 服务接入前端，交付"个性化旅游助手"页面；
2. 对前端做一次全局视觉升级，从分散的内联渐变迁移到统一的 Glass Frost 设计系统；
3. 修复后端路径算法里时间单位不一致的 bug。

---

## ✅ 本轮完成的功能与改动

### 1. 个性化旅游助手页面（Agent 前端接入）

新增 `PersonalTravelAssistantPage`，通过 Vite 代理将 `/api/agent` 请求转发到 Python FastAPI agent（port 9000）。

页面功能：

- **侧边栏**：用户信息、agent 在线状态指示灯、历史会话列表、新对话按钮
- **聊天区**：气泡式对话 UI（用户消息靠右、AI 消息靠左）、AI 思考中动画（三点脉冲）、Enter 发送 / Shift+Enter 换行
- **会话管理**：自动选中最近会话、支持切换历史对话、新对话重置

数据流：

- `getAgentHealth()` → 判断 agent 是否在线，离线时界面上显示"未连接"
- `getAgentSessions()` → 首次加载只拉摘要列表，不拉完整消息
- `getAgentSession(sessionId)` → 按需拉取详情（预留给后续从侧边栏恢复对话时用）
- `chatWithAgent(payload)` → 发送消息后后端返回完整 session + reply，前端直接回填消息列表

前端适配层在 `api.js` 新增四个标准化函数：

- `normalizeAgentMessage` — 收敛 `created_at` / `createdAt`
- `normalizeAgentSessionSummary` — 收敛 `session_id` / `sessionId`、`message_count` 等字段
- `normalizeAgentSessionDetail` — 在 summary 基础上增加消息数组标准化
- `normalizeAgentReply` — 收敛 `trace_id` / `traceId`、`tools_used` / `toolsUsed`

新增文件：

- `frontend/src/pages/PersonalTravelAssistantPage.jsx`

重点修改：

- `frontend/src/services/api.js` — agent API 层
- `frontend/src/App.jsx` — 新增"旅游助手"导航组、`/travel-assistant` 路由
- `frontend/vite.config.js` — `/api/agent` → port 9000 代理

---

### 2. 后端 Agent 配置补齐

在 `application.yml` 中新增 agent 服务连接配置：

```yaml
app:
  agent:
    base-url: ${TOURISM_AGENT_BASE_URL:http://127.0.0.1:9000}
    connect-timeout-ms: ${TOURISM_AGENT_CONNECT_TIMEOUT_MS:3000}
    read-timeout-ms: ${TOURISM_AGENT_READ_TIMEOUT_MS:15000}
```

测试配置也同步添加（超时设为 1000ms），避免测试环境连接超时等待过长。

修改文件：

- `src/main/resources/application.yml`
- `src/test/resources/application.yml`

---

### 3. 全局 UI 设计系统升级：Apple → Glass Frost

将整个前端的视觉风格从之前分散在各地的内联渐变（`linear-gradient(135deg, #667eea...)`）和零散的 CSS 变量，迁移到统一的新设计系统中。

#### 3.1 新 CSS 变量体系

在 `index.css` 的 `:root` 中定义：

| 分组 | 变量 | 用途 |
|------|------|------|
| 背景 | `--glass-bg`, `--glass-surface`, `--glass-surface-hover` | 页面/卡片/悬停底色 |
| 边框 | `--glass-border`, `--glass-border-strong` | 轻/强分割线 |
| 阴影 | `--glass-shadow`, `--glass-shadow-hover` | 静态/悬停态 |
| 模糊 | `--glass-blur: 18px` | 统一毛玻璃模糊半径 |
| 文字 | `--text-primary`, `--text-secondary`, `--text-tertiary` | 三档文字色阶 |
| 强调 | `--accent`, `--accent-hover`, `--accent-soft` | 品牌蓝与淡底 |
| 圆角 | `--radius-sm(10)`, `--radius-md(14)`, `--radius-lg(18)`, `--radius-pill(98)` | 四级圆角尺度 |

旧变量（`--apple-bg`, `--apple-text-primary` 等）全部移除。

#### 3.2 全局组件样式重写

对 Ant Design 组件做系统级覆盖：

- **Card**：毛玻璃背景 + 轻阴影 + 微悬停位移
- **Button**：透明玻璃底 + 移除所有蓝色 focus ring（使用 `::after` 伪元素隐藏和大量 `:focus` / `:focus-visible` 覆盖）
- **Input / Select / DatePicker**：玻璃底 + 去蓝色聚焦环
- **Dropdown**：毛玻璃弹出层 + 圆角项
- **Modal**：毛玻璃内容区 + 加深阴影
- **Table**：毛玻璃背景 + 圆角
- **Tag**：灰色淡底
- **Alert / Pagination**：统一圆角

#### 3.3 页面页头统一

以下页面的页头从 `linear-gradient` 硬切色背景迁移为统一的玻璃样式：

| 页面 | 改动 |
|------|------|
| HomePage | 去掉 `maxWidth: 1200` 限制 + 玻璃卡片替代内联样式 |
| CampusNavigationPage | 蓝绿渐变 → 玻璃页头 |
| DiariesPage | 紫蓝渐变 → 玻璃页头 |
| LocationSearchPage | 蓝青渐变 → 玻璃页头 |
| RoutePage | 蓝青渐变 → 玻璃页头 |
| StatsPage | 紫蓝渐变 → 玻璃页头 |
| DiaryDetailPage | 移除外层 `content-wrapper` class |
| PlaceDetailPage | 移除外层 `content-wrapper` class |
| DiaryManagementPage | 移除外层 `content-wrapper` class |
| ConcurrencyTestPage | 移除外层 `content-wrapper` class |

#### 3.4 App.css 重构

从 423 行精简到约 250 行，按功能模块组织：

- **Recommendation Badges**：三级推荐卡片边框/阴影（highly / recommended / might_like）
- **Facility Cards**：设施卡片悬停效果
- **Assistant Layout**：助手页面三栏布局（侧边栏 / 分割线 / 聊天区）
- **Chat Bubbles**：毛玻璃气泡样式、用户/AI 角色标签、时间戳、思考动画
- **Composer**：输入区域样式

#### 3.5 App.jsx 微调

- 移除顶部 `` 图标和 Apple 相关品牌元素
- 头部高度 72px → 64px
- 新增 `MessageOutlined` 图标导入
- 新增"旅游助手"导航分组（含 `/travel-assistant` 路由）
- "个人界面" → "个人中心"，简化描述文本
- 移除 `FireOutlined` / `HomeOutlined` / `Paragraph` 未使用导入

修改文件：

- `frontend/src/index.css`
- `frontend/src/App.css`
- `frontend/src/App.jsx`
- `frontend/src/pages/HomePage.jsx`
- `frontend/src/pages/CampusNavigationPage.jsx`
- `frontend/src/pages/DiariesPage.jsx`
- `frontend/src/pages/LocationSearchPage.jsx`
- `frontend/src/pages/RoutePage.jsx`
- `frontend/src/pages/StatsPage.jsx`
- `frontend/src/pages/DiaryDetailPage.jsx`
- `frontend/src/pages/PlaceDetailPage.jsx`
- `frontend/src/pages/DiaryManagementPage.jsx`
- `frontend/src/pages/ConcurrencyTestPage.jsx`

---

### 4. 后端路径算法时间单位修复

发现路径算法返回的 `time` 字段实际是秒，但前端一直当作分钟展示，导致路径时间显示严重偏大。

#### 4.1 ShortestPathAlgorithm 修复

- **速度计算单位修复**：`idealSpeed` 是 km/h，距离是米，之前直接用 `距离 / (km/h)` 得到的时间单位不正确。现在统一转换为 m/s：
  ```
  actualSpeedMs = idealSpeed * congestionRate * speedMultiplier * 1000 / 3600
  time = distance / actualSpeedMs  → 返回秒
  ```
- **边过滤加强**：忽略 `from == to` 的自环、两端都是 building 节点的边（building 之间不直接相连）
- **死代码清理**：移除旧版 hashCode-based 优先队列残留代码

#### 4.2 OutdoorRouteService 修复

- 所有时间统一从秒转换为分钟再返回给前端：
  - `totalTimeMinutes = totalTimeSeconds / 60.0`
  - `segments[i].time / 60.0`
  - `cost` 字段也改为分钟值

修改文件：

- `src/main/java/com/tourism/algorithm/ShortestPathAlgorithm.java`
- `src/main/java/com/tourism/service/OutdoorRouteService.java`

---

### 5. 工程完善

#### 5.1 stop-all.sh 补充 agent 端口

```bash
kill $(lsof -ti :9000) 2>/dev/null && echo "Agent stopped" || echo "Agent not running"
```

#### 5.2 CLAUDE.md 更新

- Project overview 补上 "Python FastAPI agent service"
- 新增 agent 启动命令和 LLM 配置说明
- 补充 `停止所有服务` / `启动agent` / `启动所有服务` 快捷键
- 新增 Agent LLM 配置表格和核心文件说明

修改文件：

- `scripts/stop-all.sh`
- `CLAUDE.md`

---

## 📄 本轮新增 / 重点修改文件

### 新增

- `frontend/src/pages/PersonalTravelAssistantPage.jsx`

### 重点修改

- `frontend/src/index.css` — 全局设计系统替换
- `frontend/src/App.css` — 精简重构
- `frontend/src/App.jsx` — agent 路由 + 导航
- `frontend/src/services/api.js` — agent API 层
- `frontend/vite.config.js` — agent 代理
- `frontend/src/pages/HomePage.jsx` — 玻璃风格迁移
- `frontend/src/pages/CampusNavigationPage.jsx` — 玻璃页头
- `frontend/src/pages/LocationSearchPage.jsx` — 玻璃页头
- `frontend/src/pages/DiariesPage.jsx` — 玻璃页头
- `frontend/src/pages/RoutePage.jsx` — 玻璃页头
- `frontend/src/pages/StatsPage.jsx` — 玻璃页头
- `frontend/src/pages/DiaryDetailPage.jsx` — 移除旧 class
- `frontend/src/pages/PlaceDetailPage.jsx` — 移除旧 class
- `frontend/src/pages/DiaryManagementPage.jsx` — 移除旧 class
- `frontend/src/pages/ConcurrencyTestPage.jsx` — 移除旧 class
- `src/main/java/com/tourism/algorithm/ShortestPathAlgorithm.java` — 速度修复 + 边过滤
- `src/main/java/com/tourism/service/OutdoorRouteService.java` — 时间转分钟
- `src/main/resources/application.yml` — agent 配置
- `src/test/resources/application.yml` — agent 测试配置
- `scripts/stop-all.sh` — agent 端口
- `CLAUDE.md` — agent 文档

---

## 🔮 下一步建议

1. **Agent 功能深化**：当前助手页面只做了基础对话，下一步应接入 agent 的意图识别和工具调用结果展示（地点推荐卡片、路线规划卡片等富文本回复）
2. **室内导航**：继续 DEV_LOG08 里规划的室内导航标签页开发
3. **前端细节打磨**：Glass Frost 系统迁移后，部分旧页面（如 ConcurrencyTestPage、DiaryDetailPage）的页头渐变还未完全替换，可以后续逐个收口

---

## 一句话总结

本轮完成了三件事：把 Python agent 服务通过前端助手页面对接上线、把全局 UI 从零散渐变拉回统一的 Glass Frost 设计系统、修掉了路径时间单位不一致的 bug。
