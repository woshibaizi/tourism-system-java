# 个性化旅游系统 Java 版 — 开发日志

---

## 📅 2026-05-04 第五次开发：全链路结果结构收敛与前端深度对接

### 🎯 需求背景

在 Week 5 完成数据库底座、Week 6 打通认证与核心查询接口、Week 7 完成页面接口联调核对、Week 8 深化 LBS 查询和接口容错之后，本周开发重点继续推进到“全链路结果结构收敛与前端深度对接”。

上一阶段已经明确：当前 Java 主工程真实具备的能力主要集中在登录注册、场所分页与详情、日记分页与详情、设施查询与附近设施查询、统一响应、异常处理和 JWT 安全边界。前端旧项目中仍保留路线规划、推荐、多媒体、AIGC、统计、最近设施、建筑查询等更多调用，但这些能力尚未在 Java 主工程中完整落地。

因此 Week 9 的目标不是宣称推荐、导航、Skill 或多媒体链路已经完成，而是继续收敛已有接口的结果结构，核对前端页面消费方式，并为后续更复杂能力准备清晰的 DTO / VO 和接口边界。

本周工作重点：

1. 继续统一 `Result<T>` 的 `code/message/data` 返回结构；
2. 继续核对 MyBatis-Plus `Page<T>` 与前端列表页面的数据消费方式；
3. 继续整理 `PlaceController`、`DiaryController`、`FacilityController` 的空结果、404 和参数错误处理；
4. 继续核对 `SecurityConfig` 中公开接口与受保护接口的访问边界；
5. 围绕 `PlacesPage`、`PlaceDetailPage`、`DiariesPage`、`DiaryDetailPage`、`FacilityQueryPage`、`RouteMap.js` 做字段和接口差异梳理；
6. 将推荐、路线规划、AIGC、多媒体、Agent / Skill 编排继续作为后续接口设计和预研方向。

> **说明**：本周承接 Week 8 的“预研准备”，重点是结果结构、页面适配和接口边界收敛；当前 Java 主工程未发现独立算法包、导航 Controller、媒体 Controller、AIGC Service 或成熟 SkillRegistry，因此这些内容不记录为已完成。

> **周期口径**：本项目周报按 Week 5 至 Week 14 逐周推进记录，其中 Week 14 才进入总结验收阶段。Week 9 只记录结果结构收敛和前端深度对接问题，不提前写复杂能力完成或最终验收。

---

### 🧱 本周建设范围

本周围绕当前真实源码中已经存在的后端接口与前端页面需求进行深度核对，重点关注“接口能否被页面稳定理解”和“后续新增能力应如何预留结构”。

| 模块 | 对应类 / 文件 | 本周进展 | 说明 |
|---|---|---|---|
| 场所列表与详情 | `PlaceController` / `SpotPlace` / `PlacesPage.js` / `PlaceDetailPage.js` | 结果结构收敛 | 后端已有分页、类型筛选、关键字搜索和详情；前端详情聚合结构仍需后续对齐 |
| 日记列表与详情 | `DiaryController` / `TravelDiary` / `DiariesPage.js` / `DiaryDetailPage.js` | 结果结构收敛 | 后端已有分页、`placeId` 筛选和详情 404；创建、评分、上传等仍为后续能力 |
| 设施查询与 LBS | `FacilityController` / `SpotFacility` / `GeoUtils` / `FacilityQueryPage.js` | 深度核对 | 后端已有按场所设施查询和附近设施查询；前端建筑到最近设施模型仍需对齐 |
| 认证入口 | `AuthController` / `AuthServiceImpl` / `LoginDTO` / `RegisterDTO` / `LoginVO` | 持续支撑 | 当前真实接口为登录、注册；未发现独立当前用户接口 |
| 统一响应 | `Result<T>` | 持续收敛 | 后端统一 `code/message/data`，前端旧代码仍需适配 `success` 判断差异 |
| 异常处理 | `GlobalExceptionHandler` / `BusinessException` | 持续收口 | 参数异常、认证异常、权限异常、业务异常和兜底异常统一返回 |
| 安全边界 | `SecurityConfig` / `JwtAuthenticationFilter` | 持续核对 | 认证、场所 GET、日记 GET 公开；其他接口默认需要登录 |
| 路线字段预研 | `RouteMap.js` / `RoutePage.js` / `SpotRoadEdge` / `RoadEdgeMapper` | 字段准备 | 仅整理未来路径结果字段，不写导航接口或路径算法已完成 |
| 测试与性能观察 | `src/test/` / `GeoUtils` / 分页接口 | 风险识别 | 当前仅基础启动测试，接口测试与压力测试仍待补充 |

---

### 📝 本次修改文件清单

#### 1) 后端接口核对范围

| 文件 | 当前状态 | 本周说明 |
|---|---|---|
| `controller/AuthController.java` | 已存在 | 当前提供 `/api/auth/login` 和 `/api/auth/register` |
| `controller/PlaceController.java` | 已存在 | 继续核对 `/api/places` 分页筛选搜索和 `/api/places/{id}` 详情 |
| `controller/DiaryController.java` | 已存在 | 继续核对 `/api/diaries` 分页、`placeId` 筛选和 `/api/diaries/{id}` 详情 |
| `controller/FacilityController.java` | 已存在 | 继续核对 `/api/facilities` 和 `/api/facilities/nearby` |
| `utils/Result.java` | 已存在 | 继续统一 `code/message/data` 响应 |
| `exception/GlobalExceptionHandler.java` | 已存在 | 继续统一异常返回 |
| `utils/GeoUtils.java` | 已存在 | `distance(...)` 用于附近设施查询，`heuristic(...)` 仅作为后续路径预留 |
| `config/SecurityConfig.java` | 已存在 | 继续核对公开接口与认证接口边界 |
| `config/MybatisPlusConfig.java` | 已存在 | 继续支撑分页插件和时间字段自动填充 |

#### 2) Model / Mapper 核对范围

| 类型 | 当前状态 | 说明 |
|---|---|---|
| Entity | 已存在 | `SysUser`、`SpotPlace`、`SpotBuilding`、`SpotFacility`、`SpotRoadEdge`、`TravelDiary`、`UserBehavior` |
| Mapper | 已存在 | `UserMapper`、`PlaceMapper`、`BuildingMapper`、`FacilityMapper`、`RoadEdgeMapper`、`DiaryMapper`、`UserBehaviorMapper` |
| DTO | 已存在 | `LoginDTO`、`RegisterDTO` |
| VO | 已存在 | `LoginVO` |
| Service | 部分存在 | 当前仅 `AuthService` 与 `AuthServiceImpl` 落地，场所、日记、设施 Service 仍待补强 |

#### 3) 前端联调核对范围

| 文件 | 当前用途 | 本周说明 |
|---|---|---|
| `frontend/src/services/api.js` | 前端 API 封装 | 默认端口和返回结构仍需适配 Java 后端 |
| `frontend/src/pages/PlacesPage.js` | 场所列表页 | 继续核对分页、类型、关键字、推荐字段差异 |
| `frontend/src/pages/PlaceDetailPage.js` | 场所详情页 | 前端期望聚合结构，后端当前只返回单个 `SpotPlace` |
| `frontend/src/pages/DiariesPage.js` | 日记列表页 | 后端可支撑分页和场所筛选，搜索/推荐/创建仍待补齐 |
| `frontend/src/pages/DiaryDetailPage.js` | 日记详情页 | 后端可支撑详情和 404，用户信息与评分能力仍待补齐 |
| `frontend/src/pages/FacilityQueryPage.js` | 设施查询页 | 页面模型与当前 LBS 接口仍需统一 |
| `frontend/src/components/RouteMap.js` | 路线地图组件 | 仅作为未来路线接口字段参考 |
| `frontend/src/pages/RoutePage.js` | 路线页面 | Java 后端尚未提供路线规划 Controller |
| `frontend/src/pages/AIGCPage.js` | AIGC 页面 | Java 后端尚未提供 AIGC Service |

> 当前源码中未发现 `NavigationController`、`LegacyNavigationController`、`AlgorithmController`、`MediaController`、`AigcService`、`RecommendationAlgorithm`、`SearchAlgorithm`、`ShortestPathAlgorithm`、`IndoorNavigationAlgorithm`、成熟 `SkillRegistry` 或独立 `algorithm/` 目录，因此本周不将这些内容写为已完成。

---

### 🧠 本轮开发的核心产出

本周核心产出是一次面向全链路联调的结果结构复盘，让已有 Java 接口更清楚地对齐前端页面的真实消费方式。

1. **统一响应结构继续成为主约束**  
   Java 后端继续以 `Result<T>` 输出 `code/message/data`。Week 9 明确前端应围绕 `code === 200` 或统一适配器消费结果，而不是继续依赖旧接口中的 `success` 字段。

2. **分页结果结构进入重点收敛范围**  
   `PlaceController#list(...)` 和 `DiaryController#list(...)` 当前返回 `Result<Page<T>>`。前端需要识别 `records`、`total`、`current`、`size` 等分页字段，不能简单把 `data` 当作普通数组处理。

3. **详情空结果处理继续明确**  
   `PlaceController#detail(...)` 查不到场所时返回 `Result.fail(404, "场所不存在")`，`DiaryController#detail(...)` 查不到日记时返回 `Result.fail(404, "日记不存在")`。这为前端空态和错误态提供了稳定判断依据。

4. **LBS 结果结构继续围绕真实接口收敛**  
   `FacilityController#nearby(...)` 当前以 `lat`、`lng`、`radius`、`type` 为入参，返回半径范围内的 `SpotFacility` 列表。该接口只代表附近设施查询，不代表路径规划、可达性计算或室内导航已经完成。

5. **前端深度对接问题被系统整理**  
   本周继续识别端口差异、返回结构差异、详情聚合结构差异、设施查询模型差异和路线页面字段需求，为后续真正修改前端或补充后端接口提供依据。

6. **复杂能力仍保持清晰边界**  
   推荐、路线规划、AIGC、多媒体上传、统计、Agent / Skill 编排当前仍处于接口设计或后续预研阶段。Week 9 只记录字段梳理和边界准备，不写成业务闭环完成。

7. **测试和性能观察点进一步明确**  
   当前 `src/test/` 仅有基础启动测试。本周将分页查询、附近设施距离过滤、资源不存在、认证失败、权限失败等列为后续测试补充重点；性能方面只识别风险，不宣称压力测试完成。

---

### ✅ 验证结果

- 已核对 Week 5、Week 6、Week 7、Week 8 周报，确认 Week 9 应承接结果结构收敛和前端深度对接，而不是宣称成熟算法完成。
- 已核对 `AuthController`，当前真实接口为登录和注册，未发现当前用户接口。
- 已核对 `PlaceController`，确认支持分页、类型筛选、关键字搜索和详情 404。
- 已核对 `DiaryController`，确认支持分页、`placeId` 筛选和详情 404。
- 已核对 `FacilityController`，确认支持按场所查询、按类型筛选和基于 `GeoUtils.distance(...)` 的附近设施查询。
- 已核对 `Result` 和 `GlobalExceptionHandler`，确认统一响应和异常处理仍是当前核心基础。
- 已核对 `SecurityConfig` 和 `JwtAuthenticationFilter`，确认公开接口与受保护接口边界仍需在页面联调中继续观察。
- 已核对 `frontend/src/services/api.js`，确认前端仍存在旧端口、旧路径和 `success` 字段判断。
- 已核对 `RouteMap.js`、`RoutePage.js` 和 `AIGCPage.js`，确认前端存在路线与 AIGC 页面需求，但 Java 主工程尚未提供对应后端能力。
- 已核对 `src/test/`，当前仅有基础启动测试，接口级测试、LBS 测试和压力测试仍待补充。

> 本次验证以源码阅读、文件结构核对和周报一致性检查为主。本周未实际运行并验证 `mvn compile`、`mvn test`、完整前后端联调或压力测试成功，因此不宣称编译、测试、完整联调或压力测试已经通过。

---

### 🔍 技术实现细节

#### 1) `Result<T>` 与前端响应适配

Java 后端当前统一返回：

```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

前端旧代码中仍存在 `response.success` 判断。若不做适配，即使后端请求成功，页面也可能进入错误分支。

后续适配方向：

- 在 `api.js` 响应拦截器中把 `code === 200` 转换为统一成功标识；
- 或逐页改为直接判断 `response.code === 200`；
- 对分页接口统一读取 `response.data.records`。

#### 2) 分页结构收敛

`PlaceController#list(...)` 和 `DiaryController#list(...)` 返回 MyBatis-Plus `Page<T>`，主要字段包括：

- `records`
- `total`
- `size`
- `current`
- `pages`

本周重点是确认前端列表页不能只把 `data` 当成数组，需要根据分页结构读取 `records`，并将 `total`、`current`、`size` 用于分页控件或加载更多逻辑。

#### 3) 场所详情聚合结构差异

`PlaceController#detail(...)` 当前只返回单个 `SpotPlace`。但 `PlaceDetailPage.js` 期望的是聚合结构，例如：

- `place`
- `buildings`
- `facilities`

后续可选方向：

- 新增场所详情 VO，由后端聚合场所、建筑和设施；
- 前端拆分请求，分别调用场所详情、建筑列表和设施列表；
- 短期先保证单个场所详情稳定展示。

#### 4) 日记基础能力与后续能力边界

`DiaryController#list(...)` 当前支持分页和 `placeId` 筛选，`DiaryController#detail(...)` 支持详情查询和 404。

前端旧页面仍保留：

- 日记搜索；
- 日记推荐；
- 日记创建、更新、删除；
- 图片和视频上传；
- 评分或互动。

这些能力当前未在 Java 主工程完整落地，本周只记录为后续接口补齐方向。

#### 5) 设施查询与 LBS 查询

`FacilityController#listByPlace(...)` 当前通过 `placeId` 和可选 `type` 查询场所内设施。

`FacilityController#nearby(...)` 当前通过：

- `lat`
- `lng`
- `radius`
- `type`

查询附近设施，并使用 `GeoUtils.distance(...)` 在 Java 内存中做半径过滤。

该能力适合页面早期联调，但后续需要继续评估：

- 经纬度范围预筛选；
- 最大半径限制；
- 最大返回条数；
- 数据库空间索引；
- 是否对设施 GET 接口开放匿名访问。

#### 6) 路线页面字段只做预研

`RouteMap.js` 中已经能看到未来路线接口可能需要：

- `path`
- `segments`
- 节点坐标；
- 分段距离；
- 分段时间；
- 交通方式；
- 起点、终点和途经点。

当前 Java 主工程只有 `SpotRoadEdge`、`RoadEdgeMapper` 和 `GeoUtils.heuristic(...)` 这类基础数据与工具，并未发现路线规划 Controller 或路径算法类。因此 Week 9 只做字段预研，不记录为导航能力已完成。

---

### ⚠️ 当前阻塞点与优化方向

#### 1) 前端响应结构仍未完全适配 Java 后端

**问题表现：**  
Java 后端返回 `code/message/data`，前端旧代码仍使用 `success` 判断。

**优化方向：**

- 优先在 `api.js` 做统一响应适配；
- 对分页接口统一抽取 `records`；
- 逐步替换页面中的旧判断逻辑。

#### 2) 前端默认端口仍可能指向旧后端

**问题表现：**  
前端默认 `baseURL` 仍可能指向 `http://localhost:5001/api`，而 Java 后端端口为 `8080`。

**优化方向：**

- 配置 `REACT_APP_API_URL=http://localhost:8080/api`；
- 或调整默认 `baseURL`；
- 在联调文档中明确 Java 后端启动端口。

#### 3) 场所详情聚合数据仍未收敛

**问题表现：**  
前端详情页需要场所、建筑、设施等组合数据，后端当前只返回 `SpotPlace`。

**优化方向：**

- 新增场所详情 VO；
- 或前端拆分多个接口请求；
- 优先不要在页面中强依赖尚未提供的聚合字段。

#### 4) 设施查询页面模型仍需决定

**问题表现：**  
前端 `FacilityQueryPage` 偏向“建筑物到最近设施”查询，Java 后端当前偏向“经纬度半径附近设施”查询。

**优化方向：**

- 若保留建筑模型，需要补充建筑查询和最近设施接口；
- 若优先使用当前后端能力，需要改造页面输入为经纬度、半径和设施类型；
- 明确设施接口是否需要公开访问。

#### 5) Service 层仍较薄

**问题表现：**  
除认证模块外，场所、日记、设施 Controller 当前仍直接调用 Mapper。

**优化方向：**

- 后续补充 `PlaceService`、`DiaryService`、`FacilityService`；
- 将分页参数校验、空结果处理、结果 VO 组装逐步下沉；
- 为后续推荐和路线能力预留更清晰的业务层边界。

#### 6) 测试覆盖仍不足

**问题表现：**  
当前测试目录主要是基础启动测试，缺少接口、异常和 LBS 逻辑测试。

**优化方向：**

- 补充 `GeoUtils.distance(...)` 单元测试；
- 补充场所分页和日记详情 404 测试；
- 补充设施附近查询半径过滤测试；
- 后续再推进集成测试和性能观察。

#### 7) 推荐、导航、AIGC、Skill 仍是后续能力

**问题表现：**  
前端存在相关页面或调用，但 Java 主工程尚未落地对应 Controller、Service 或算法类。

**优化方向：**

- 先设计推荐结果、路线结果、AIGC 结果的 DTO / VO；
- 先统一输入输出协议；
- 等源码真实落地后再进入完成项记录。

---

### 🔮 下次开发计划

#### 优先级高

1. **完成前端统一响应适配**
   - 统一处理 `code/message/data`
   - 兼容分页结构中的 `records`
   - 清理页面中的 `response.success` 判断

2. **对齐 Java 后端联调地址**
   - 明确 `localhost:8080/api`
   - 配置前端环境变量或默认地址
   - 优先验证登录、场所、日记、设施查询

3. **收敛详情页数据结构**
   - 明确场所详情是否新增聚合 VO
   - 明确日记详情是否需要作者信息和关联场所信息
   - 避免前端依赖尚未提供的字段

4. **补充设施查询联调方案**
   - 决定采用附近设施模型还是最近设施模型
   - 明确是否补充建筑查询接口
   - 明确设施接口公开访问策略

#### 优先级中

5. **补强 Service 层**
   - 增加场所、日记、设施业务层
   - 整理 Controller 中的 Mapper 调用
   - 为 VO 组装和后续复杂能力预留空间

6. **补充基础测试**
   - 场所分页
   - 日记分页与详情 404
   - 附近设施距离过滤
   - 认证失败和权限失败

7. **继续设计推荐与路线接口**
   - 推荐先设计输入和候选结果结构
   - 路线先设计节点、分段、距离、时间结构
   - 不提前写算法已完成

#### 后续改进

8. **继续梳理 Agent / Skill 边界**
   - 先统一输入输出对象
   - 再评估是否需要注册和调度机制
   - 避免在基础接口未稳定前引入过重框架

9. **准备后续性能观察**
   - 分页查询响应时间
   - 关键字搜索响应时间
   - 附近设施内存过滤开销
   - 数据量扩大后的索引策略

---

### 🏗 当前项目结构

```text
tourism-system-java/
├── tourism-system/
│   └── frontend/
│       └── src/
│           ├── components/
│           │   └── RouteMap.js
│           ├── pages/
│           │   ├── AIGCPage.js
│           │   ├── DiariesPage.js
│           │   ├── DiaryDetailPage.js
│           │   ├── FacilityQueryPage.js
│           │   ├── PlaceDetailPage.js
│           │   ├── PlacesPage.js
│           │   └── RoutePage.js
│           └── services/
│               └── api.js
└── tourism-system-java/
    ├── DEV-WEEK-PLAN/
    ├── sql/
    │   └── schema.sql
    ├── scripts/
    │   └── migrate_data.py
    └── src/
        ├── main/
        │   ├── java/com/tourism/
        │   │   ├── TourismApplication.java
        │   │   ├── config/
        │   │   │   ├── MybatisPlusConfig.java
        │   │   │   ├── RedisConfig.java
        │   │   │   ├── SecurityConfig.java
        │   │   │   └── SwaggerConfig.java
        │   │   ├── controller/
        │   │   │   ├── AuthController.java
        │   │   │   ├── PlaceController.java
        │   │   │   ├── DiaryController.java
        │   │   │   └── FacilityController.java
        │   │   ├── exception/
        │   │   │   ├── BusinessException.java
        │   │   │   └── GlobalExceptionHandler.java
        │   │   ├── mapper/
        │   │   │   ├── UserMapper.java
        │   │   │   ├── PlaceMapper.java
        │   │   │   ├── BuildingMapper.java
        │   │   │   ├── FacilityMapper.java
        │   │   │   ├── RoadEdgeMapper.java
        │   │   │   ├── DiaryMapper.java
        │   │   │   └── UserBehaviorMapper.java
        │   │   ├── model/
        │   │   │   ├── dto/
        │   │   │   │   ├── LoginDTO.java
        │   │   │   │   └── RegisterDTO.java
        │   │   │   ├── entity/
        │   │   │   │   ├── SysUser.java
        │   │   │   │   ├── SpotPlace.java
        │   │   │   │   ├── SpotBuilding.java
        │   │   │   │   ├── SpotFacility.java
        │   │   │   │   ├── SpotRoadEdge.java
        │   │   │   │   ├── TravelDiary.java
        │   │   │   │   └── UserBehavior.java
        │   │   │   └── vo/
        │   │   │       └── LoginVO.java
        │   │   ├── security/
        │   │   │   ├── JwtAuthenticationFilter.java
        │   │   │   └── UserDetailsServiceImpl.java
        │   │   ├── service/
        │   │   │   ├── AuthService.java
        │   │   │   └── impl/
        │   │   │       └── AuthServiceImpl.java
        │   │   └── utils/
        │   │       ├── GeoUtils.java
        │   │       ├── JwtUtils.java
        │   │       └── Result.java
        │   └── resources/
        │       └── application.yml
        └── test/
            ├── java/
            │   └── com/tourism/TourismApplicationTests.java
            └── resources/
                └── application.yml
```

---

### 📌 阶段结论

如果说 Week 8 的重点是深化 LBS 查询、接口容错和算法预研准备，那么 Week 9 的重点就是把这些基础能力继续放到前端页面语境下收敛，尤其是统一响应结构、分页结构、空结果、错误态和安全边界。

本次推进后，项目已经进一步明确：

- 当前 Java 主工程真实可用的后端能力仍以认证、场所、日记、设施、统一响应、异常处理和 JWT 安全链路为主；
- `Result<T>` 与 MyBatis-Plus `Page<T>` 是前端适配时最需要统一处理的结果结构；
- `FacilityController#nearby` 和 `GeoUtils.distance(...)` 是当前真实存在的 LBS 查询基础；
- 前端路线、AIGC、推荐、多媒体等页面需求仍可作为后续接口设计参考，但不能写成 Java 后端已完成；
- Service 层、接口测试、性能观察和复杂能力 DTO / VO 设计仍是下一阶段重点。

当前仍待处理：

- 前端 `success` 判断与后端 `code/message/data` 的适配；
- 前端默认端口与 Java 后端端口对齐；
- 场所详情聚合结构；
- 设施查询页面模型；
- 场所、日记、设施 Service 层补强；
- LBS、分页、异常、安全边界的测试覆盖；
- 推荐、路线规划、AIGC、多媒体和 Agent / Skill 相关能力的真实源码落地。

下一阶段将围绕“**前端统一响应适配、主要页面深度联调、详情聚合结构收敛、设施查询模型对齐、Service 层补强和基础测试补充**”继续推进。
