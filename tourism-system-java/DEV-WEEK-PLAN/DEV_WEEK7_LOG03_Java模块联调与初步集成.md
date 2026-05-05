# 个性化旅游系统 Java 版 — 开发日志

---

## 📅 2026-04-20 第三次开发：页面接口联调与基础结果结构统一

### 🎯 需求背景

在 Week 5 完成数据库底座、Week 6 完成认证链路和核心查询接口初步打通之后，本周开发重点继续推进到“页面接口联调与基础结果结构统一”。这一阶段的目标不是继续扩展复杂算法，也不是宣称推荐、路线规划、AIGC 或 Skill 调度已经完成，而是对照前端页面真实调用方式，检查 Java 后端当前已有接口是否能被页面稳定消费。

本周重点围绕以下问题展开：

1. 核对 `PlaceController` 与 `PlacesPage`、`PlaceDetailPage` 的字段和返回结构；
2. 核对 `DiaryController` 与 `DiariesPage`、`DiaryDetailPage` 的分页、列表、详情接口；
3. 核对 `FacilityController` 与 `FacilityQueryPage` 的设施查询和附近设施查询差异；
4. 继续推广 `Result<T>` 的 `code/message/data` 统一响应结构；
5. 梳理前端旧接口中仍依赖但 Java 后端尚未实现的接口；
6. 将推荐、路线规划、Skill 编排等能力保留为后续接口边界设计和预研内容。

> **说明**：本周是页面级联调准备和结果结构整理阶段，重点是发现差异、收敛接口和明确下一步，而不是完成成熟业务闭环。

> **周期口径**：本项目周报按 Week 5 至 Week 14 逐周推进记录，其中 Week 14 才进入总结验收阶段。Week 7 只记录页面接口核对和初步联调问题，不提前写完整前后端闭环或最终成果。

---

### 🧱 本周建设范围

本周围绕场所、日记、设施三条页面主链路进行联调核对，并继续检查认证、异常处理和统一返回格式的可用性。

| 模块 | 对应文件 | 本周进展 | 说明 |
|---|---|---|---|
| 场所列表联调 | `PlaceController` / `PlacesPage.js` / `api.js` | 结构核对 | 后端已有分页、类型筛选、关键字搜索；前端仍保留推荐、排序、独立搜索接口调用 |
| 场所详情联调 | `PlaceController` / `PlaceDetailPage.js` | 发现差异 | 后端当前返回单个 `SpotPlace`；前端详情页期望聚合 `place/buildings/facilities` |
| 日记列表联调 | `DiaryController` / `DiariesPage.js` | 结构核对 | 后端已有分页、`placeId` 筛选；前端仍保留搜索、推荐、创建、上传、评分等调用 |
| 日记详情联调 | `DiaryController` / `DiaryDetailPage.js` | 结构核对 | 后端已有详情查询和 404 失败返回；前端还依赖用户信息和评分接口 |
| 设施查询联调 | `FacilityController` / `FacilityQueryPage.js` | 发现差异 | 后端已有按场所查询、附近设施查询；前端页面当前偏向建筑物到最近设施查询 |
| 统一响应结构 | `Result<T>` / `GlobalExceptionHandler` | 持续收敛 | Java 后端统一 `code/message/data`，前端旧代码多处仍判断 `success` 字段 |
| 安全与公开接口 | `SecurityConfig` / `JwtAuthenticationFilter` | 持续核对 | 场所、日记 GET 接口已公开；设施接口默认仍受认证策略影响 |
| LBS 基础能力 | `FacilityController` / `GeoUtils` | 初步可用 | `GeoUtils.distance(...)` 支撑附近设施半径过滤，不等同于完整路线规划 |

---

### 📝 本次修改文件清单

#### 1) 后端接口核对范围

| 文件 | 当前状态 | 本周说明 |
|---|---|---|
| `controller/AuthController.java` | 已存在 | 登录、注册接口继续作为前端登录联调基础 |
| `controller/PlaceController.java` | 已存在 | 核对场所分页、筛选、关键字搜索和详情字段 |
| `controller/DiaryController.java` | 已存在 | 核对日记分页、按场所筛选和详情字段 |
| `controller/FacilityController.java` | 已存在 | 核对场所设施查询和附近设施查询入参 |
| `utils/Result.java` | 已存在 | 继续作为 Java 后端统一响应包装 |
| `exception/GlobalExceptionHandler.java` | 已存在 | 继续收敛资源不存在、认证异常、参数异常和兜底异常 |
| `utils/GeoUtils.java` | 已存在 | 用于附近设施查询中的距离计算 |
| `config/SecurityConfig.java` | 已存在 | 核对公开接口和受保护接口边界 |

#### 2) 前端页面核对范围

| 文件 | 当前用途 | 本周说明 |
|---|---|---|
| `frontend/src/services/api.js` | 前端 API 封装入口 | 发现默认请求 `http://localhost:5001/api`，与 Java 后端 `8080` 存在端口差异 |
| `frontend/src/pages/PlacesPage.js` | 场所列表页 | 依赖场所列表，同时保留推荐、搜索、排序等未完全对齐 Java 后端的调用 |
| `frontend/src/pages/PlaceDetailPage.js` | 场所详情页 | 期望详情接口返回场所、建筑、设施聚合结构 |
| `frontend/src/pages/DiariesPage.js` | 日记列表页 | 依赖日记列表，同时保留搜索、推荐、创建、上传等旧接口 |
| `frontend/src/pages/DiaryDetailPage.js` | 日记详情页 | 依赖日记详情，同时保留用户信息、日记评分等接口 |
| `frontend/src/pages/FacilityQueryPage.js` | 设施查询页 | 当前更偏建筑物到最近设施查询，和 Java 后端已有附近设施接口不同 |

#### 3) Model / Mapper 基础层

| 类型 | 当前状态 | 说明 |
|---|---|---|
| Entity | 已存在 | `SpotPlace`、`TravelDiary`、`SpotFacility` 等实体继续作为接口返回基础 |
| DTO / VO | 已存在 | `LoginDTO`、`RegisterDTO`、`LoginVO` 支撑认证接口 |
| Mapper | 已存在 | `PlaceMapper`、`DiaryMapper`、`FacilityMapper` 等支撑基础查询 |

> 当前源码中未发现 `AlgorithmController`、`MediaController`、`AigcService`、`NavigationController`、`LegacyNavigationController`、`RecommendationAlgorithm`、`SearchAlgorithm`、`ShortestPathAlgorithm`、`IndoorNavigationAlgorithm`、`HuffmanCompression`、`ACAutomaton`、`TreapTopK` 或独立 `algorithm/` 目录，因此本周不将这些内容写为已完成。

---

### 🧠 本轮开发的核心产出

本周的核心产出不是新增大模块，而是完成一次面向页面联调的接口结构梳理，明确“当前能接什么、哪里还不匹配、下一步该补什么”。

1. **场所列表接口具备页面接入基础**  
   Java 后端 `GET /api/places` 已支持分页、类型筛选和关键字搜索，返回 `Result<Page<SpotPlace>>`。这为 `PlacesPage` 的基础列表展示提供了接入条件。

2. **场所详情接口与前端聚合需求存在差异**  
   Java 后端 `GET /api/places/{id}` 当前返回单个 `SpotPlace`，而 `PlaceDetailPage` 期望 `placeData.place`、`placeData.buildings`、`placeData.facilities` 这类聚合结构。本周明确该差异，后续需要补充详情 VO 或前端拆分请求。

3. **日记列表和详情具备基础接入条件**  
   Java 后端 `GET /api/diaries` 支持分页和 `placeId` 筛选，`GET /api/diaries/{id}` 支持详情查询和 404 返回，能够支撑 `DiariesPage`、`DiaryDetailPage` 的基础展示链路。

4. **设施查询能力完成基础核对**  
   Java 后端 `GET /api/facilities` 支持按 `placeId` 和 `type` 查询，`GET /api/facilities/nearby` 支持基于经纬度和半径的附近设施查询。当前前端 `FacilityQueryPage` 更偏向建筑物和最近设施路径查询，两者需要后续对齐。

5. **统一响应结构继续推广**  
   Java 后端统一使用 `Result<T>` 返回 `code/message/data`。前端旧代码中多处仍以 `response.success` 判断请求结果，本周将其识别为联调改造重点。

6. **异常处理进入页面联调语境**  
   `GlobalExceptionHandler` 已能统一处理业务异常、参数校验异常、认证异常和权限异常；`PlaceController`、`DiaryController` 对资源不存在返回 `Result.fail(404, ...)`，便于页面后续展示空态或错误态。

7. **Agent / Skill 仅保留为接口边界预留**  
   本周没有成熟 Skill 调度，也没有算法 Controller。所谓 Agent / Skill 雏形仅体现在：后端开始统一输入输出格式，前端开始识别哪些能力未来需要独立接口承载。

---

### ✅ 验证结果

- 已核对 Week 5 周报，确认当前阶段应承接数据库底座和持久层基础。
- 已核对 Week 6 周报，确认当前阶段应承接核心查询接口与认证链路。
- 已核对 `PlaceController`，确认存在 `/api/places` 和 `/api/places/{id}`。
- 已核对 `DiaryController`，确认存在 `/api/diaries` 和 `/api/diaries/{id}`。
- 已核对 `FacilityController`，确认存在 `/api/facilities` 和 `/api/facilities/nearby`。
- 已核对 `AuthController`、`SecurityConfig`、`JwtAuthenticationFilter`，认证和安全基础链路仍与 Week 6 口径一致。
- 已核对 `Result` 和 `GlobalExceptionHandler`，统一响应和异常处理可继续作为页面联调基础。
- 已核对 `frontend/src/services/api.js`，发现前端仍保留旧端口、旧接口和 `success` 字段判断。
- 已核对前端页面目录，存在 `PlacesPage.js`、`PlaceDetailPage.js`、`DiariesPage.js`、`DiaryDetailPage.js`、`FacilityQueryPage.js` 等页面。
- 当前未发现算法、导航、多媒体、AIGC 或 Skill 调度相关 Java 源码，因此本周不记录为完成。

> 本次验证以源码阅读和接口结构核对为主。本周未实际运行并验证 `mvn compile`、`mvn test` 或完整前后端联调成功，因此不宣称编译、测试或完整联调已通过。

---

### 🔍 技术实现细节

#### 1) `PlaceController` 与场所页面的字段核对

`PlaceController#list(...)` 当前支持：

- `page`
- `size`
- `type`
- `keyword`

返回结构为 `Result<Page<SpotPlace>>`，其中 `SpotPlace` 包含 `id`、`name`、`type`、`keywords`、`features`、`rating`、`ratingCount`、`clickCount`、`lat`、`lng`、`address`、`openTime`、`image`、`description` 等字段。

`PlacesPage.js` 当前还调用：

- `searchPlaces(...)`
- `getRecommendedPlaces(...)`
- `sortPlaces(...)`

这些独立搜索、推荐、排序接口尚未在 Java 主工程中落地。本周处理方式是先确认基础列表接口可作为页面数据源，推荐和排序相关调用后续再收敛。

#### 2) `PlaceDetailPage` 的聚合结构差异

`PlaceController#detail(...)` 当前只返回 `SpotPlace`：

- 查到数据时：`Result.success(place)`
- 查不到时：`Result.fail(404, "场所不存在")`

但 `PlaceDetailPage.js` 当前读取的是聚合数据结构，例如：

- `placeData.place`
- `placeData.buildings`
- `placeData.facilities`

这说明前端详情页仍保留旧后端聚合接口思路。后续有两种方向：

- 后端新增场所详情 VO，聚合场所、建筑和设施；
- 或前端分别调用场所详情、建筑列表、设施列表接口后自行组装。

#### 3) `DiaryController` 与日记页面的字段核对

`DiaryController#list(...)` 当前支持：

- `page`
- `size`
- `placeId`

返回 `Result<Page<TravelDiary>>`，列表默认按 `createdAt` 降序。

`DiaryController#detail(...)` 当前返回单个 `TravelDiary`，查不到时返回 `Result.fail(404, "日记不存在")`。

`DiariesPage.js` 和 `DiaryDetailPage.js` 当前还依赖：

- 日记搜索接口；
- 日记推荐接口；
- 日记创建、更新、删除接口；
- 日记评分接口；
- 图片、视频上传接口；
- 用户列表接口。

这些能力当前未在 Java 主工程完整落地。本周将其整理为后续接口补齐项，不写成已完成。

#### 4) `FacilityController` 与设施查询页的差异

`FacilityController#listByPlace(...)` 当前支持：

- `placeId`
- `type`

`FacilityController#nearby(...)` 当前支持：

- `lat`
- `lng`
- `radius`
- `type`

附近设施查询通过 `GeoUtils.distance(...)` 计算球面距离，并在 Java 内存中过滤半径范围内的设施。

但 `FacilityQueryPage.js` 当前调用的是：

- `getBuildingsByPlace(...)`
- `getNearestFacilities(...)`

也就是更偏“选择场所 -> 选择建筑 -> 查询最近设施”的旧页面逻辑。当前 Java 后端尚未提供建筑列表 Controller 或最近设施路径查询接口，因此后续需要决定是调整页面调用已有 `/api/facilities`、`/api/facilities/nearby`，还是新增建筑和最近设施接口。

#### 5) `Result<T>` 与前端响应判断差异

Java 后端响应格式为：

- `code`
- `message`
- `data`

前端旧代码多处使用：

- `response.success`
- `response.data`
- `response.message`

这会导致即使 Java 接口返回成功，页面也可能因为找不到 `success` 字段而进入错误分支。本周将前端响应适配列为重点问题，后续可在 `api.js` 中统一转换，例如把 `code === 200` 映射为 `success: true`，或直接改页面判断逻辑。

#### 6) 认证和公开访问边界

`SecurityConfig` 当前允许：

- `/api/auth/**`
- GET `/api/places/**`
- GET `/api/diaries/**`
- Swagger 文档接口

其余接口默认需要认证。由于 `FacilityController` 的 GET 接口不在公开白名单中，设施页面联调时可能需要携带 Token，或在后续根据业务需要调整公开访问策略。

---

### ⚠️ 遇到的问题与处理

#### 1) 前端默认端口仍指向旧后端

`frontend/src/services/api.js` 当前默认 `baseURL` 为 `http://localhost:5001/api`，而 Java 后端配置端口为 `8080`。如果不设置 `REACT_APP_API_URL`，前端不会直接请求 Java 后端。

**处理方式：**

- 本周先记录端口差异；
- 后续联调时通过环境变量或 `api.js` 调整到 Java 后端；
- 优先确保登录、场所、日记、设施基础接口能被访问。

#### 2) 前端仍使用 `success` 字段，后端使用 `code/message/data`

Java 后端统一返回 `Result<T>`，但前端旧页面普遍使用 `response.success` 判断成功状态。

**处理方式：**

- 本周确认该结构差异；
- 后续可在 `api.js` 响应拦截器中做兼容转换；
- 或统一把页面判断改为 `response.code === 200`。

#### 3) 场所详情页需要聚合数据，后端当前只返回单表详情

`PlaceDetailPage` 需要场所、建筑和设施组合数据，但当前 `PlaceController#detail(...)` 只返回 `SpotPlace`。

**处理方式：**

- 短期可拆分为多个接口请求；
- 中期可新增场所详情 VO；
- 不在 Week 7 中宣称聚合详情已完成。

#### 4) 日记页面保留了大量后续能力调用

`DiariesPage` 和 `DiaryDetailPage` 中仍存在搜索、推荐、评分、创建、上传、用户列表等调用，而 Java 主工程当前只具备日记分页和详情查询。

**处理方式：**

- 本周只核对基础列表与详情；
- 搜索、推荐、创建、评分、上传作为后续补齐项；
- 避免把旧前端已有功能误写为 Java 后端已完成。

#### 5) 设施查询页与 Java 后端已有接口方向不同

前端 `FacilityQueryPage` 以建筑物和最近设施为核心；Java 后端当前已有的是按场所查询和经纬度半径查询。

**处理方式：**

- 本周先记录接口模型差异；
- 后续决定改造页面为附近设施查询，或补充建筑与最近设施接口；
- 当前不写成导航或路径规划已完成。

#### 6) 推荐、路线规划、Skill 编排仍处于设计和预研阶段

当前 Java 主工程未发现相关算法类、Controller 或 Skill 注册机制。

**处理方式：**

- 本周仅保留接口结构层面的预留和边界梳理；
- 后续先明确输入输出 DTO / VO；
- 等源码真实落地后再写入后续周报。

---

### 🔮 下次开发计划

#### 优先级高

1. **适配前端响应结构**
   - 在 `api.js` 中兼容 `Result<T>` 的 `code/message/data`
   - 或逐页替换 `response.success` 判断
   - 优先覆盖场所、日记、设施页面

2. **调整 Java 后端联调地址**
   - 配置 `REACT_APP_API_URL=http://localhost:8080/api`
   - 或修改前端默认 `baseURL`
   - 明确本地联调启动说明

3. **收敛场所详情结构**
   - 评估新增场所详情 VO
   - 或前端分别调用场所详情、建筑列表、设施列表
   - 明确 `PlaceDetailPage` 所需字段

4. **收敛日记页面基础能力**
   - 先保证日记列表和详情稳定展示
   - 再逐步补充创建、搜索、评分、推荐和上传能力

#### 优先级中

5. **对齐设施查询页面**
   - 决定 `FacilityQueryPage` 使用附近设施查询还是最近设施查询
   - 如保留最近设施，需要补充建筑查询和最近设施接口
   - 如改为附近设施，需要调整页面入参为经纬度和半径

6. **继续补强 Service 层**
   - 将场所、日记、设施查询逻辑从 Controller 下沉到 Service
   - 为后续聚合 VO 和业务规则预留空间

7. **明确推荐、路线规划、Skill 的接口边界**
   - 推荐先设计候选结果结构
   - 路线规划先设计路径节点、距离、时间字段
   - Skill 编排只做边界梳理，不提前实现复杂框架

#### 后续改进

8. **补充基础测试**
   - 场所分页和详情测试
   - 日记分页和详情测试
   - 设施列表和附近设施测试
   - 统一错误返回测试

9. **整理旧前端遗留接口**
   - 标记尚未由 Java 后端实现的接口
   - 分批决定保留、改造或删除

---

### 🏗 当前项目结构

```text
tourism-system-java/
├── tourism-system/
│   └── frontend/
│       └── src/
│           ├── pages/
│           │   ├── PlacesPage.js
│           │   ├── PlaceDetailPage.js
│           │   ├── DiariesPage.js
│           │   ├── DiaryDetailPage.js
│           │   └── FacilityQueryPage.js
│           └── services/
│               └── api.js
└── tourism-system-java/
    ├── sql/
    │   └── schema.sql
    ├── scripts/
    │   └── migrate_data.py
    ├── src/main/java/com/tourism/
    │   ├── TourismApplication.java
    │   ├── config/
    │   │   ├── MybatisPlusConfig.java
    │   │   ├── RedisConfig.java
    │   │   ├── SecurityConfig.java
    │   │   └── SwaggerConfig.java
    │   ├── controller/
    │   │   ├── AuthController.java
    │   │   ├── PlaceController.java
    │   │   ├── DiaryController.java
    │   │   └── FacilityController.java
    │   ├── exception/
    │   │   ├── BusinessException.java
    │   │   └── GlobalExceptionHandler.java
    │   ├── mapper/
    │   │   ├── UserMapper.java
    │   │   ├── PlaceMapper.java
    │   │   ├── BuildingMapper.java
    │   │   ├── FacilityMapper.java
    │   │   ├── RoadEdgeMapper.java
    │   │   ├── DiaryMapper.java
    │   │   └── UserBehaviorMapper.java
    │   ├── model/
    │   │   ├── dto/
    │   │   │   ├── LoginDTO.java
    │   │   │   └── RegisterDTO.java
    │   │   ├── entity/
    │   │   │   ├── SysUser.java
    │   │   │   ├── SpotPlace.java
    │   │   │   ├── SpotBuilding.java
    │   │   │   ├── SpotFacility.java
    │   │   │   ├── SpotRoadEdge.java
    │   │   │   ├── TravelDiary.java
    │   │   │   └── UserBehavior.java
    │   │   └── vo/
    │   │       └── LoginVO.java
    │   ├── security/
    │   │   ├── JwtAuthenticationFilter.java
    │   │   └── UserDetailsServiceImpl.java
    │   ├── service/
    │   │   ├── AuthService.java
    │   │   └── impl/
    │   │       └── AuthServiceImpl.java
    │   └── utils/
    │       ├── GeoUtils.java
    │       ├── JwtUtils.java
    │       └── Result.java
    └── src/main/resources/
        └── application.yml
```

---

### 📌 阶段结论

如果说 Week 5 是数据库底座，Week 6 是认证和核心查询接口初步打通，那么 Week 7 的重点就是把这些接口放到真实前端页面语境下检查，开始统一基础结果结构，并把联调差异暴露出来。

本次推进后，项目已经明确：

- 场所列表、日记列表、日记详情、场所详情和设施查询都具备一定的 Java 接口基础；
- `Result<T>` 和 `GlobalExceptionHandler` 可以作为后续前端统一适配的核心约束；
- `GeoUtils.distance(...)` 可以支撑附近设施的基础 LBS 查询；
- 前端旧项目仍保留大量 Java 后端尚未实现的接口调用；
- 页面联调下一步的关键不是继续扩张功能，而是先完成响应结构、端口、路径、字段和空态错误态的对齐。

当前仍待处理：

- 前端 `success` 字段与后端 `code/message/data` 的适配；
- 场所详情聚合结构；
- 日记创建、搜索、评分、上传等后续接口；
- 建筑查询和最近设施查询接口边界；
- 推荐、路线规划、Skill 编排等复杂能力的真实源码落地。

下一阶段将围绕“**前端响应适配、详情聚合结构收敛、设施查询模型对齐，以及后续复杂能力接口边界设计**”继续推进。
