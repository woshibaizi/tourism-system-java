# 个性化旅游系统需求-页面-API-测试矩阵

---

## 目的

本文档作为四 Agent 收尾阶段的架构/验收矩阵，用于把 [`requirements_summary_from_images.md`](../requirements_summary_from_images.md) 中的需求固定映射到页面、正式业务 API、兼容策略和测试证据。

本矩阵只记录当前项目的正式交付面，不把算法演示接口作为业务页面的主要依赖。

---

## 接口分层约定

| 类型 | 说明 | 使用原则 |
|---|---|---|
| Canonical API | 正式业务接口 | 前端页面、README、Swagger、测试优先使用 |
| Legacy API | 兼容旧页面或旧调用方的薄适配接口 | 只保留兼容，不再新增能力 |
| Algorithm API | 算法演示、调试、统计辅助接口 | 不作为核心业务页面的主依赖 |

---

## Canonical API 清单

| 领域 | 正式接口 | 交付说明 |
|---|---|---|
| 户外导航 | `POST /api/navigation/shortest-path` | 单目标路径规划，支持最短距离/最短时间 |
| 户外导航 | `POST /api/navigation/mixed-vehicle-path` | 混合交通工具最短时间路径 |
| 户外导航 | `POST /api/navigation/multi-destination` | 多目标路径规划，要求返回完整路径与分段信息 |
| 室内导航 | `POST /api/navigation/indoor` | 建筑物内部导航 |
| 室内导航 | `GET /api/navigation/indoor/rooms` | 室内房间列表 |
| 室内导航 | `GET /api/navigation/indoor/building-info` | 室内建筑结构信息 |
| 设施查询 | `POST /api/facilities/nearest` | 按可通行路径距离排序的附近设施 |
| 场所推荐/搜索 | `GET /api/places/search` | 名称、类别、关键字查询 |
| 场所推荐/搜索 | `POST /api/places/recommend` | 景点/学校推荐 |
| 场所推荐/搜索 | `POST /api/places/sort` | 热度/评分等排序 |
| 日记 | `GET /api/diaries/search` | 标题、内容、目的地检索 |
| 日记 | `POST /api/diaries/recommend` | 日记推荐 |
| 日记 | `POST /api/diaries/{id}/rate` | 日记评分 |
| 日记 | 现有日记 CRUD | 日记创建、编辑、删除、详情、分页列表 |
| 美食 | `GET /api/foods` | 美食列表、过滤、模糊查询、排序主接口 |
| 美食 | `GET /api/foods/popular` | 热门美食辅助接口 |
| 美食 | `GET /api/foods/cuisines` | 菜系列表 |
| 美食 | `GET /api/foods/place/{placeId}` | 指定场所美食 |
| AIGC/上传 | `POST /api/upload/image` | 图片上传 |
| AIGC/上传 | `POST /api/upload/video` | 视频上传 |
| AIGC/上传 | `POST /api/aigc/convert-to-video` | 图片和描述生成动画 |

---

## Legacy API 保留策略

| 兼容接口 | 当前策略 | 删除条件 |
|---|---|---|
| `/api/routes/*` | 只读兼容旧路线规划调用方，不再新增字段和能力 | 前端 grep 零调用，README/Swagger 不再作为主接口描述，smoke 通过 |
| `/api/indoor/*` | 只读兼容旧室内导航页面，不再承接新需求 | `IndoorNavigationPage` 全量迁移到 `/api/navigation/indoor*`，smoke 通过 |
| `/api/facilities/nearby` | 保留为 LBS/调试接口，不作为页面主路径 | 不删除；文档中标注非路径距离排序主接口 |
| `/api/algorithm/*` | 算法演示、压缩、敏感词过滤等辅助能力 | 核心业务页面不依赖即可；不要求删除 |

---

## 需求映射矩阵

| 需求域 | 需求点 | 页面 | Canonical API | 测试证据 | 当前状态 |
|---|---|---|---|---|---|
| 旅游推荐 | 景点/学校推荐 | `HomePage`、`PlacesPage` | `POST /api/places/recommend` | 待补 `PlaceRecommendationIntegrationTests` | 待收口 |
| 旅游推荐 | 名称/类别/关键字查询 | `PlacesPage` | `GET /api/places/search` | 待补搜索与排序测试 | 待收口 |
| 旅游推荐 | 热度/评分排序 | `PlacesPage` | `POST /api/places/sort` | 待补热度/评分排序测试 | 待收口 |
| 路线规划 | 单目标路径 | `RoutePage` | `POST /api/navigation/shortest-path` | `NavigationFacilityIntegrationTests` 已覆盖基础路径 | 已打通，需继续扩策略覆盖 |
| 路线规划 | 多目标回路 | `RoutePage` | `POST /api/navigation/multi-destination` | `NavigationFacilityIntegrationTests` 已覆盖基础回路 | 已打通 |
| 路线规划 | 最短时间/拥挤度 | `RoutePage` | `POST /api/navigation/shortest-path` | 待补最短时间分支测试 | 部分完成 |
| 路线规划 | 混合交通工具 | `RoutePage` | `POST /api/navigation/mixed-vehicle-path` | `NavigationFacilityIntegrationTests` 已覆盖基础返回 | 已打通 |
| 路线规划 | 室内导航 | `IndoorNavigationPage` | `/api/navigation/indoor*` | 待补 `IndoorNavigationIntegrationTests` | 待迁移前端与补测 |
| 场所查询 | 附近设施按路径距离排序 | `FacilityQueryPage` | `POST /api/facilities/nearest` | `NavigationFacilityIntegrationTests` 已覆盖排序 | 已打通 |
| 场所查询 | 设施类别过滤 | `FacilityQueryPage` | `POST /api/facilities/nearest` | 待补类别过滤测试 | 待补测 |
| 日记管理 | 日记 CRUD | `DiariesPage`、`DiaryManagementPage` | 现有日记 CRUD | 待补 `DiaryCrudSearchIntegrationTests` | 待补测 |
| 日记管理 | 日记浏览、评分 | `DiariesPage` | `POST /api/diaries/{id}/rate` | `DiaryAlgorithmIntegrationTests` 已覆盖评分 | 已打通，需扩聚合测试 |
| 日记管理 | 日记推荐 | `DiariesPage` | `POST /api/diaries/recommend` | 待补 content/popular 策略测试 | 待收口 |
| 日记交流 | 目的地相关日记排序 | `DiariesPage`、`DiaryManagementPage` | `GET /api/diaries/search` | 待补目的地排序测试 | 待补 |
| 日记交流 | 标题精确查询 | `DiariesPage` | `GET /api/diaries/search` | `DiaryAlgorithmIntegrationTests` 已覆盖标题搜索 | 已打通 |
| 日记交流 | 内容全文检索 | `DiariesPage` | `GET /api/diaries/search` | 待补全文检索测试 | 待补 |
| 日记交流 | 压缩存储 | 页面无直接入口 | `/api/algorithm/compress`、`/api/algorithm/decompress` 与日记服务内部压缩 | `DiaryAlgorithmIntegrationTests` 已覆盖回环 | 已验证算法，需业务 CRUD 覆盖 |
| 日记交流 | AIGC 动画生成 | `AIGCPage` | `POST /api/aigc/convert-to-video` | 待补 `AigcIntegrationTests` | 待收口 |
| 美食推荐 | 按场所推荐美食 | `FoodSearchPage`、`PlaceDetailPage` | `GET /api/foods`、`GET /api/foods/place/{placeId}` | 待补 `FoodRecommendationIntegrationTests` | 待收口 |
| 美食推荐 | 菜系过滤 | `FoodSearchPage` | `GET /api/foods` | 待补菜系过滤测试 | 待补 |
| 美食推荐 | 热度/评分/距离排序 | `FoodSearchPage` | `GET /api/foods?sortBy=popularity|rating|distance` | 待补排序测试 | 待补 |
| 美食推荐 | 美食/菜系/饭店/窗口模糊查询 | `FoodSearchPage` | `GET /api/foods` | 待补模糊查询测试 | 待补 |

---

## 发布门槛

1. `mvn test` 通过，并覆盖本矩阵中的关键后端场景。
2. `npm run build` 通过。
3. `npm run lint` repo-wide 通过，或在开发日志中明确剩余 lint debt 和阻塞原因。
4. 前端页面不再依赖 404/405/501 时的本地业务兜底来伪造成功。
5. README、Swagger、开发日志只描述真实 canonical 契约和明确保留的 legacy 契约。

---

## Architect 决策记录

| 决策 | 结论 |
|---|---|
| 导航主契约 | 使用 `/api/navigation/*`，`/api/routes/*` 仅兼容 |
| 室内导航主契约 | 使用 `/api/navigation/indoor*`，`/api/indoor/*` 仅兼容 |
| 设施查询主契约 | 页面使用 `/api/facilities/nearest`，要求路径距离排序 |
| 业务页面是否依赖算法接口 | 不允许作为主路径依赖 |
| 推荐接口返回形态 | 以“排序后的实体数组”为当前权威结果，不强制新增推荐 DTO |
| AIGC 输出格式 | 当前必须显式说明实际支持格式，不允许 `mp4` 参数静默返回 `gif` |
