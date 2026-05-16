# 个性化旅游系统 — 功能实现目录

> 最后更新：2026-05-11  
> 基于 DEV_LOG01 ~ DEV_LOG10、REQUIREMENTS_API_TEST_MATRIX.md 及源码结构整理

---

## 一、系统总览

| 子系统 | 技术栈 | 端口 | 状态 |
|--------|--------|------|------|
| Java 后端 | Spring Boot 3.3.5 + MyBatis-Plus + MySQL 8 + Redis + JGraphT | 8080 | 运行中 |
| Python Agent | FastAPI + Pydantic v2 + SQLite | 9000 | 运行中 |
| React 前端 | Vite + React + Ant Design | 5173 | 运行中 |
| iOS App | SwiftUI + MapKit | — | 基础框架 |

---

## 二、Java 后端功能

### 2.1 用户认证模块 (`/api/auth`)

| 功能 | 接口 | 状态 | 说明 |
|------|------|------|------|
| 用户登录 | `POST /api/auth/login` | 已完成 | 返回 JWT token，BCrypt 密码校验 |
| 用户注册 | `POST /api/auth/register` | 已完成 | 带参数校验，密码加密存储 |
| 获取当前用户 | `GET /api/auth/me` | 已完成 | JWT 解析后返回用户信息 |

**技术实现**：Spring Security + JWT (jjwt 0.12.6)，`JwtAuthenticationFilter` 过滤器 + `UserDetailsServiceImpl`。

---

### 2.2 场所管理模块 (`/api/places`)

| 功能 | 接口 | 状态 | 说明 |
|------|------|------|------|
| 场所分页查询 | `GET /api/places` | 已完成 | 支持类型/关键字筛选 |
| 场所详情 | `GET /api/places/{id}` | 已完成 | 含关联建筑/设施信息 |
| 场所搜索 | `GET /api/places/search` | 已完成 | 名称、类别、关键字查询 |
| 热门场所 | `GET /api/places/hot` | 已完成 | 按浏览量排序 |
| 高评分场所 | `GET /api/places/top-rated` | 已完成 | 按平均评分排序 |
| 按类型查询 | `GET /api/places/type/{type}` | 已完成 | 按景区/校园/公园/博物馆过滤 |
| 场所推荐 | `POST /api/places/recommend` | 已完成 | 内容过滤 + 协同过滤推荐 |
| 场所排序 | `POST /api/places/sort` | 已完成 | 热度/评分/距离排序 |
| 场所评分 | `POST /api/places/{id}/rate` | 已完成 | 评分写入后自动回刷场所平均分 |

**技术实现**：`PlaceServiceImpl` + `RecommendationAlgorithm`（内容过滤/协同过滤/热度推荐）+ `SortingAlgorithm` + `CoordinateTransformUtils`（WGS84→GCJ-02 坐标转换）。

---

### 2.3 建筑物管理模块 (`/api/buildings`)

| 功能 | 接口 | 状态 | 说明 |
|------|------|------|------|
| 建筑物分页查询 | `GET /api/buildings` | 已完成 | 支持筛选条件 |
| 建筑物详情 | `GET /api/buildings/{id}` | 已完成 | |
| 建筑物搜索 | `GET /api/buildings/search` | 已完成 | |
| 按场所查建筑 | `GET /api/buildings/place/{placeId}` | 已完成 | 返回某场所下的建筑列表 |

---

### 2.4 设施管理模块 (`/api/facilities`)

| 功能 | 接口 | 状态 | 说明 |
|------|------|------|------|
| 设施查询 | `GET /api/facilities` | 已完成 | 分页，支持类型筛选 |
| 设施详情 | `GET /api/facilities/{id}` | 已完成 | |
| 设施搜索 | `GET /api/facilities/search` | 已完成 | |
| 按场所查设施 | `GET /api/facilities/place/{placeId}` | 已完成 | |
| 按场所+类型查设施 | `GET /api/facilities/place/{placeId}/type/{type}` | 已完成 | |
| 路径距离最近设施 | `POST /api/facilities/nearest` | 已完成 | 基于可通行路径 Dijkstra 距离排序，含步行时间 |
| LBS 附近设施 | `GET /api/facilities/nearby` | 已完成 | 直线距离排序，保留为调试接口 |

**技术实现**：`FacilityServiceImpl` + `ShortestPathAlgorithm.dijkstraDistanceOnly()`，道路图不可用时回退直线距离。设施实体含运行时字段 `distance` / `travelTime`。

---

### 2.5 美食管理模块 (`/api/foods`)

| 功能 | 接口 | 状态 | 说明 |
|------|------|------|------|
| 美食列表/搜索/排序 | `GET /api/foods` | 已完成 | 综合查询，支持模糊搜索、过滤、排序 |
| 热门美食 | `GET /api/foods/popular` | 已完成 | 按人气排序 |
| 菜系列表 | `GET /api/foods/cuisines` | 已完成 | 返回所有菜系分类 |
| 按场所查美食 | `GET /api/foods/place/{placeId}` | 已完成 | |
| 按菜系查美食 | `GET /api/foods/cuisine/{cuisine}` | 已完成 | |
| 美食详情 | `GET /api/foods/{id}` | 已完成 | |

**待补齐**：美食评分/距离排序的测试覆盖。

---

### 2.6 旅游日记模块 (`/api/diaries`)

| 功能 | 接口 | 状态 | 说明 |
|------|------|------|------|
| 日记分页查询 | `GET /api/diaries` | 已完成 | |
| 日记详情 | `GET /api/diaries/{id}` | 已完成 | 浏览时自动累计浏览量 |
| 日记搜索 | `GET /api/diaries/search` | 已完成 | 标题/内容/目的地检索 |
| 日记推荐 | `POST /api/diaries/recommend` | 已完成 | 内容过滤 + 热度推荐 |
| 日记创建 | `POST /api/diaries` | 已完成 | 正文 Huffman 压缩后存储 |
| 日记更新 | `PUT /api/diaries/{id}` | 已完成 | |
| 日记删除 | `DELETE /api/diaries/{id}` | 已完成 | |
| 日记评分 | `POST /api/diaries/{id}/rate` | 已完成 | 评分写入后回刷日记平均分 |
| 按作者查询 | `GET /api/diaries/author/{authorId}` | 已完成 | |
| 热门日记 | `GET /api/diaries/hot` | 已完成 | 按浏览量排序 |

**技术实现**：`DiaryServiceImpl` → Huffman 压缩存储 + AC 自动机敏感词过滤 + 评分联动 `UserBehaviorServiceImpl`。

---

### 2.7 路径规划模块 (`/api/navigation`) — Canonical

| 功能 | 接口 | 状态 | 说明 |
|------|------|------|------|
| 单目标路径规划 | `POST /api/navigation/shortest-path` | 已完成 | A* 算法，支持最短距离/最短时间两种策略 |
| 混合交通路径 | `POST /api/navigation/mixed-vehicle-path` | 已完成 | 多交通工具联合最优时间 |
| 多目标路径 | `POST /api/navigation/multi-destination` | 已完成 | TSP 四种求解器：最近邻/DP/模拟退火/遗传算法 |
| 室内导航 | `POST /api/navigation/indoor` | 已完成 | 建筑内导航，含导航步骤、楼层分析 |
| 室内房间列表 | `GET /api/navigation/indoor/rooms` | 已完成 | 支持按楼层筛选 |
| 室内建筑信息 | `GET /api/navigation/indoor/building-info` | 已完成 | 建筑结构概览 |
| 图重载 | `POST /api/navigation/reload-graph` | 已完成 | 管理接口，重新加载路网图 |

**技术实现**：
- `ShortestPathAlgorithm`：A*、Dijkstra、混合交通 Dijkstra、TSP 四种求解器，`@PostConstruct` 加载内存图
- `IndoorNavigationAlgorithm`：从 `indoor_navigation.json` 加载节点图，时间/距离 Dijkstra，电梯/楼梯楼层切换建模
- `OutdoorRouteService`：路径结果封装，时间秒→分钟转换
- `CoordinateTransformUtils`：路径节点 WGS84→GCJ-02 批量转换
- 返回字段：`path`、`segments`、`totalDistance`、`totalTime`、`vehicle`、`strategy`、`nodeCoordinates`

---

### 2.8 老旧路线接口 (`/api/routes`, `/api/indoor`) — Legacy 兼容

| 功能 | 接口 | 状态 | 说明 |
|------|------|------|------|
| 单目标路线 | `POST /api/routes/single` | 兼容保留 | 复用 NavigationController 算法 |
| 多目标路线 | `POST /api/routes/multi` | 兼容保留 | 复用 NavigationController 算法 |
| 室内建筑信息 | `GET /api/indoor/building` | 兼容保留 | |
| 室内房间列表 | `GET /api/indoor/rooms` | 兼容保留 | |
| 室内导航 | `POST /api/indoor/navigate` | 兼容保留 | |

**策略**：仅兼容旧前端调用方，不再新增字段和能力。

---

### 2.9 算法演示模块 (`/api/algorithm`)

| 功能 | 接口 | 状态 | 说明 |
|------|------|------|------|
| 统一搜索 | `POST /api/algorithm/search` | 已完成 | 二分查找 + Jaccard 模糊搜索 + TF-IDF 混合 |
| 模糊搜索 | `POST /api/algorithm/search/fuzzy` | 已完成 | |
| 全文搜索 | `POST /api/algorithm/search/fulltext` | 已完成 | TF-IDF 全文检索 |
| 场所推荐 | `POST /api/algorithm/recommend/places` | 已完成 | 内容过滤/协同过滤/混合推荐 |
| 日记推荐 | `POST /api/algorithm/recommend/diaries` | 已完成 | |
| 热度推荐 | `POST /api/algorithm/recommend/popular` | 已完成 | |
| Huffman 压缩 | `POST /api/algorithm/compress` | 已完成 | 无损压缩 + Base64 序列化 |
| Huffman 解压 | `POST /api/algorithm/decompress` | 已完成 | |
| 压缩统计 | `POST /api/algorithm/compression-stats` | 已完成 | 压缩率统计 |
| 构建敏感词库 | `POST /api/algorithm/ac-automaton/build` | 已完成 | AC 自动机构建 |
| 敏感词过滤 | `POST /api/algorithm/filter-text` | 已完成 | 多模式匹配过滤 |
| 多模式搜索 | `POST /api/algorithm/ac-automaton/search` | 已完成 | |
| 场所排序 | `POST /api/algorithm/sort/places` | 已完成 | 快排/堆排/归并排序 |
| 日记排序 | `POST /api/algorithm/sort/diaries` | 已完成 | |

**用途**：算法演示、调试、辅助能力。核心业务页面不依赖此模块。

---

### 2.10 媒体/AIGC 模块

| 功能 | 接口 | 状态 | 说明 |
|------|------|------|------|
| 图片上传 | `POST /api/upload/image` | 已完成 | 存入 `uploads/images/`，返回 URL |
| 视频上传 | `POST /api/upload/video` | 已完成 | |
| 图片转动画 | `POST /api/aigc/convert-to-video` | 已完成 | 调用 `generate_aigc_gif.py` 生成 GIF，退回 Pillow 方案 |
| 静态资源访问 | `GET /api/uploads/**` | 已完成 | `WebMvcConfig` 映射上传目录 |

**已知限制**：`outputFormat=mp4` 当前实际返回 GIF，需明确契约。

---

### 2.11 用户管理模块 (`/api/users`)

| 功能 | 接口 | 状态 | 说明 |
|------|------|------|------|
| 用户列表 | `GET /api/users` | 已完成 | |
| 用户详情 | `GET /api/users/{id}` | 已完成 | 含用户偏好 |
| 更新用户信息 | `PUT /api/users/{id}` | 已完成 | |
| 记录用户行为 | `POST /api/users/{userId}/behavior` | 已完成 | 浏览/评分，upsert 逻辑 |
| 浏览历史 | `GET /api/users/{userId}/views` | 已完成 | |
| 评分历史 | `GET /api/users/{userId}/ratings` | 已完成 | |

---

### 2.12 统计模块 (`/api/stats`)

| 功能 | 接口 | 状态 | 说明 |
|------|------|------|------|
| 系统统计概览 | `GET /api/stats` | 已完成 | 景点/建筑/设施/美食/日记/用户/道路总数 |

---

### 2.13 Agent 桥接模块

| 功能 | 接口 | 状态 | 说明 |
|------|------|------|------|
| Agent 健康检查代理 | `GET /api/agent/health` | 已完成 | 代理到 Python 9000 端口 |
| Agent 聊天代理 | `POST /api/agent/chat` | 已完成 | |
| Agent 会话代理 | `GET /api/agent/sessions` | 已完成 | |

**技术实现**：`AgentController` + `AgentClient`（RestTemplate）+ `AgentProperties` 配置。

---

### 2.14 算法库总览

| 算法类 | 功能 | 状态 |
|--------|------|------|
| `ShortestPathAlgorithm` | A*/Dijkstra 最短路径、混合交通、TSP 四种求解器 | 已完成 |
| `IndoorNavigationAlgorithm` | 室内导航 Dijkstra、电梯/楼梯建模、步骤生成 | 已完成 |
| `RecommendationAlgorithm` | 内容过滤、协同过滤、混合推荐、热度推荐 | 已完成 |
| `SearchAlgorithm` | 二分查找、Jaccard 模糊搜索、TF-IDF 全文检索 | 已完成 |
| `SortingAlgorithm` | 快排/堆排/归并/Top-K + 业务排序逻辑 | 已完成 |
| `ACAutomaton` | Aho-Corasick 多模式匹配（敏感词过滤） | 已完成 |
| `HuffmanCompression` | Huffman 编码无损压缩/解压（日记存储） | 已完成 |
| `TreapTopK` | Treap 树 Top-K 结构（推荐系统排序） | 已完成 |
| `FibonacciHeap` | 斐波那契堆（A*/Dijkstra 优先队列优化） | 已完成 |

---

### 2.15 基础设施

| 功能 | 实现 | 状态 |
|------|------|------|
| 全局异常处理 | `GlobalExceptionHandler` | 已完成 |
| 统一返回格式 | `Result<T>` (`{code, message, data}`) | 已完成 |
| Swagger 文档 | Springdoc OpenAPI 2.6.0，`/swagger-ui.html` | 已完成 |
| CORS 配置 | `SecurityConfig` 跨域放行 | 已完成 |
| 静态资源映射 | `WebMvcConfig`，`/api/uploads/**` | 已完成 |
| 地理坐标工具 | `GeoUtils`：经纬度距离计算 | 已完成 |
| 坐标转换 | `CoordinateTransformUtils`：WGS84 ↔ GCJ-02 | 已完成 |
| JSON 工具 | `JsonUtils`：JSON 字符串 ↔ 对象 | 已完成 |
| 高德配置 | `AmapProperties` + `AmapNavigationService` | 已完成 |

---

### 2.16 数据库表

| 表名 | 实体类 | 记录数 | 说明 |
|------|--------|--------|------|
| `sys_user` | `SysUser` | 10 | 用户信息，BCrypt 密码 |
| `spot_place` | `SpotPlace` | 201 | 场所（景区/校园/公园/博物馆） |
| `spot_building` | `SpotBuilding` | 63 | 建筑物（教学楼/宿舍楼） |
| `spot_facility` | `SpotFacility` | 204 | 设施（食堂/图书馆/商店） |
| `spot_road_edge` | `SpotRoadEdge` | 483 | 道路拓扑（路径/距离/拥堵系数） |
| `spot_food` | `SpotFood` | 40 | 美食（菜系/价格/人气） |
| `travel_diary` | `TravelDiary` | 14 | 旅游日记 |
| `user_behavior` | `UserBehavior` | ~100+ | 用户浏览/评分行为 |

---

### 2.17 测试覆盖

| 测试类 | 覆盖范围 | 状态 |
|--------|----------|------|
| `NavigationFacilityIntegrationTests` | 单目标/混合交通/多目标路径、设施路径距离排序、高德配置/回退、最近图节点 | 已完成 |
| `DiaryAlgorithmIntegrationTests` | 日记标题搜索、评分、Huffman 压缩/解压回环、AC 自动机敏感词过滤 | 已完成 |
| `IndoorNavigationIntegrationTests` | 室内导航 canonical 接口、legacy 兼容、房间列表 | 已完成 |
| `AgentServiceTests` | Agent 服务相关测试 | 已完成 |
| `TourismApplicationTests` | 上下文加载 | 已完成 |

**测试基准**：H2 内存库 + `src/test/resources/schema.sql` + `data.sql`。

---

## 三、React 前端功能

### 3.1 页面清单

| 页面 | 路由 | 功能 | 状态 |
|------|------|------|------|
| 启动加载页 | `/loading` | 品牌加载动画，多页轮播 | 已完成 |
| 首页 | `/` | 统计数据总览、快捷入口 | 已完成 |
| 登录页 | `/login` | 登录/注册 | 已完成 |
| 场所浏览 | `/places` | 场所搜索、分类筛选、排序 | 已完成 |
| 场所详情 | `/places/:id` | 详情展示、关联设施/美食、评分 | 已完成 |
| 地点搜索 | `/location-search` | 统一地点+美食搜索，分类/排序 | 已完成 |
| 路线规划 | `/route` | 高德地图路线规划 | 已完成 |
| 校内导航 | `/campus-navigation` | 北邮校园步行导航，含高德底图 | 已完成 |
| 室内导航 | `/indoor-navigation` | 室内建筑/房间/导航步骤 | 已完成 |
| 设施查询 | `/facility-query` | 设施搜索、按场所/类型筛选 | 已完成 |
| 美食搜索 | `/food-search` | 美食列表、菜系筛选、排序 | 已完成 |
| 日记列表 | `/diaries` | 日记浏览、搜索、推荐 | 已完成 |
| 日记详情 | `/diaries/:id` | 日记全文、评分、关联场所 | 已完成 |
| 日记管理 | `/diary-management` | 日记 CRUD 管理后台 | 已完成 |
| 旅游助手 | `/travel-assistant` | AI 对话、会话管理、日记生成 | 已完成 |
| AIGC | `/aigc` | 图片上传、GIF 动画生成 | 已完成 |
| 数据统计 | `/stats` | 系统统计图表 | 已完成 |
| 并发测试 | `/concurrency-test` | 压力测试工具 | 已完成 |
| 功能占位 | `/feature-placeholder` | 未开放功能占位 | 已完成 |

### 3.2 UI 组件

| 组件类型 | 组件 | 说明 |
|----------|------|------|
| 对话 | `ChatBubble` | 气泡式对话渲染 |
| 对话 | `ChatInput` | 输入框，Enter 发送 |
| 对话 | `TypingIndicator` | AI 思考动画 |
| 地图 | `AMapView` | 高德地图容器封装 |
| 地图 | `RouteMap` | 路径 polyline 绘制 + marker 展示 |
| 外壳 | `LeftSidebar` | 左侧导航菜单 |
| 外壳 | `TopBar` | 顶部栏 |
| 外壳 | `MobileMenuOverlay` | 移动端菜单 |
| UI 基础 | `CTAButton`, `EmptyState`, `ImageCard`, `LazyImage` | 通用 UI |
| UI 基础 | `ScrollRow`, `SectionLabel`, `Skeleton`, `StarRating`, `Toast` | 通用 UI |
| UI 基础 | `LineInput`, `LogoText` | 通用 UI |

### 3.3 设计系统

- **Glass Frost** 设计系统（DEV_LOG09 统一迁移）
- CSS 变量体系：`--glass-bg/surface/hover`、`--glass-border/shadow/blur`、`--text-primary/secondary/tertiary`、`--accent/hover/soft`、`--radius-sm/md/lg/pill`
- Ant Design 组件全局覆盖（Card/Button/Input/Select/Dropdown/Modal/Table/Tag）

### 3.4 前端基础设施

| 功能 | 说明 | 状态 |
|------|------|------|
| 统一 API 层 | `api.js`：JWT 注入、响应归一化、legacy fallback | 已完成 |
| JWT 鉴权 | `useAuth` hook，token 存储与拦截器注入 | 已完成 |
| 高德地图加载 | `amapLoader.js` JSAPI 动态加载 | 已完成 |
| 浏览器定位 | `location.js` 定位工具 | 已完成 |
| 响应式 | `useMediaQuery` hook | 已完成 |
| 滚动动效 | `useScrollReveal` hook | 已完成 |
| Toast 提示 | `toast.js` 轻量提示 | 已完成 |
| Vite 代理 | `/api` → 8080，`/api/agent` → 9000 | 已完成 |

---

## 四、Python Agent 服务

### 4.1 架构总览

```
agent-service/app/
├── main.py              # FastAPI 路由入口
├── config.py            # 环境变量配置（LLM provider/model/key）
├── schemas.py           # Pydantic 请求/响应模型
├── agent/
│   ├── base_agent.py    # Agent 抽象基类
│   ├── dispatcher.py    # 意图分发器（LLM 分类 + 关键词规则降级）
│   ├── chat_agent.py    # 主对话 Agent（工具集/function calling 模式）
│   ├── diary_agent.py   # 日记生成 Agent（5 阶段异步流水线）
│   ├── orchestrator.py  # 旧编排器（兼容保留）
│   ├── llm_client.py    # LLM 抽象层（OpenAI 兼容 / Anthropic）
│   ├── memory.py        # 用户偏好/上下文记忆
│   └── prompts.py       # 提示词集中管理
├── tools/
│   ├── registry.py      # 工具注册表（装饰器注册）
│   ├── tourism_api.py   # 调 Java 后端接口
│   ├── route_planner.py # 路线规划工具
│   ├── image_diary.py   # 图片日记生成工具
│   └── skill_registry.py# Skills 注册
├── db/
│   └── sqlite_store.py  # SQLite 会话持久化（WAL 模式）
└── data/
    └── traces/          # trace 记录
```

### 4.2 API 接口

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| `GET` | `/agent/health` | 健康检查，含 agents 列表 | 已完成 |
| `GET` | `/agent/sessions` | 会话列表（摘要，不含消息） | 已完成 |
| `GET` | `/agent/sessions/{id}` | 会话详情（含完整消息流） | 已完成 |
| `DELETE` | `/agent/sessions/{id}` | 删除会话 + 级联清理消息 | 已完成 |
| `PUT` | `/agent/sessions/{id}/rename` | 重命名会话 | 已完成 |
| `POST` | `/agent/chat` | 统一人机对话入口 | 已完成 |
| `POST` | `/agent/diary/generate` | 启动日记生成任务 | 已完成 |
| `GET` | `/agent/diary/status/{task_id}` | 轮询日记生成进度 | 已完成 |

### 4.3 多 Agent 架构

| Agent | 模式 | 职责 | 状态 |
|-------|------|------|------|
| `Dispatcher` | 路由器 | 意图识别 → 路由到对应 Agent，LLM 分类 + 关键词降级 | 已完成 |
| `ChatAgent` | 工具集/Function calling | 路线规划/场所推荐/闲聊，工具通过 ToolRegistry 注册 | 已完成 |
| `DiaryAgent` | 独立子 Agent | 5 阶段异步流水线：图片理解→要素提取→正文撰写→润色定稿→持久化 | 已完成 |

### 4.4 DiaryAgent 流水线

| 阶段 | 进度 | 说明 |
|------|------|------|
| 图片理解 | 0%→30% | 多模态 LLM 识别图片中的景点/美食/活动 |
| 要素提取 | 30%→50% | 从文本+图片描述提取结构化要素（地点/活动/心情/亮点） |
| 正文撰写 | 50%→80% | 按风格（小红书/随笔/攻略）生成日记正文 |
| 润色定稿 | 80%→95% | 修正语句，添加 #话题标签 |
| 持久化 | 95%→100% | 通过 Java 后端 `/api/diaries` 保存到 MySQL |

支持输入方式：纯文本 / 图片+文字，三种风格可选。

### 4.5 LLM 配置

| 配置项 | 说明 | 状态 |
|--------|------|------|
| `LLM_PROVIDER` | `openai_compatible` 或 `anthropic` | 已完成 |
| `LLM_MODEL` | 模型名（如 `deepseek-chat`, `claude-opus-4-7`） | 已完成 |
| `LLM_API_KEY` | API 密钥 | 已完成 |
| `LLM_BASE_URL` | API 地址（OpenAI 兼容接口自定义） | 已完成 |
| 降级规则模式 | 未配置 API key 时自动降级 | 已完成 |

### 4.6 会话存储 (SQLite)

- WAL 模式，支持并发读写
- `session_id + user_id` 双重校验，防跨用户串读
- 级联删除（session → messages）
- 线程安全（`threading.Lock` 写操作）
- 服务重启后数据完整保留

### 4.7 安全修复

| 严重程度 | 问题 | 修复状态 |
|----------|------|----------|
| 严重 | `_llm_available()` 返回 API key 字符串写入 trace | 已修复 |
| 高 | `.env.example` 包含真实 API key | 已脱敏 |
| 中 | trace 包含完整 system prompt 膨胀过快 | 已优化 |

---

## 五、iOS App

| Tab | 功能 | 状态 |
|-----|------|------|
| 景点 | 场所浏览 | 基础框架 |
| 路线 | 路线查看 | 基础框架 |
| 日记 | 日记浏览 | 基础框架 |
| 我的 | 个人中心 | 基础框架 |

**技术实现**：SwiftUI + MapKit + Codable 模型，架构为 Views → ViewModels → Services → API。

---

## 六、脚本与工程

| 脚本 | 功能 | 状态 |
|------|------|------|
| `scripts/start-all.sh` | 一键启动全部服务（后端+前端+agent） | 已完成 |
| `scripts/stop-all.sh` | 一键停止全部服务（含 8080/5173/9000 端口） | 已完成 |
| `scripts/start-backend.sh` | 单独启动后端 | 已完成 |
| `scripts/start-frontend.sh` | 单独启动前端 | 已完成 |
| `scripts/start-agent.sh` | 单独启动 agent | 已完成 |
| `scripts/migrate_data.py` | JSON→MySQL 数据迁移 | 已完成 |
| `scripts/generate_aigc_gif.py` | Pillow GIF 动画生成 | 已完成 |

---

## 七、已知待完成项

### 高优先级

| 项目 | 说明 |
|------|------|
| 室内导航前端联调 | `CampusNavigationPage` 的"室内导航"标签页待开发，需接回 `indoor_navigation.json` |
| 美食评分/距离排序测试 | 后端能力已有，测试和前端联调待收口 |
| AIGC 输出格式契约 | `outputFormat=mp4` 静默返回 GIF 需明确 |
| 前端业务 fallback 清理 | 部分页面在 404/405/501 时仍有兜底逻辑，需删除 |
| 前端 lint 修复 | ~5 个 react-hooks warning，历史遗留 |

### 中优先级

| 项目 | 说明 |
|------|------|
| Agent 流式响应 | ChatAgent 接入 `chat_stream()`，前端 SSE |
| Agent 记忆系统 | 跨会话用户偏好记忆（AGENT-PLAN 阶段 D） |
| 前端包体积优化 | Vite 路由级拆包 |
| 高德导航 provider 测试 | 当前仅覆盖 fallback 场景，无真实 key 测试 |

### 低优先级

| 项目 | 说明 |
|------|------|
| MCP 小红书同步 | AGENT-PLAN 阶段 C，小红书草稿/发布 tool |
| 端到端 Agent 评测 | AGENT-PLAN 阶段 F，eval dataset + runner |
| Monitor Agent | AGENT-PLAN 阶段 G，线上 trace 分析 |
| AIGC 纯 Java 方案 | 移除 Python 依赖 |
