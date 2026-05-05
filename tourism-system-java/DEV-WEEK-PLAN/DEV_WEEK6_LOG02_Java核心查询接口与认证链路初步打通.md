# 个性化旅游系统 Java 版 — 开发日志

---

## 📅 2026-04-13 第二次开发：核心查询接口与认证链路初步打通

### 🎯 需求背景

在 Week 5 完成数据库底座、核心 Entity 和 Mapper 基础映射之后，本周开发重点开始从“表结构和持久层入口准备”转向“基础接口可调用”。本轮目标是让 Java 后端先具备最小可联调的业务入口，包括用户认证、场所查询、日记查询、设施查询，以及统一响应和基础异常处理。

这一阶段仍属于早期开发推进，不追求成熟业务闭环，也不提前宣称推荐、导航、室内路径、多媒体、AIGC 或 Skill 调度已经完成。本周更关注以下几件事：

1. 让登录、注册链路能够基于数据库用户表完成基础认证；
2. 让场所、日记、设施等页面所需的基础查询接口先具备返回能力；
3. 建立 `Result<T>` 统一响应结构，减少后续前端适配成本；
4. 建立 Spring Security + JWT 的基础访问边界；
5. 保留推荐、路线规划、复杂搜索等后续能力的数据和接口扩展方向。

> **说明**：本周标题中的“核心链路”指认证链路、查询链路、统一响应链路和异常处理链路；算法能力仅作为后续预留方向，不记录为已接入业务。

> **周期口径**：本项目周报按 Week 5 至 Week 14 逐周推进记录，其中 Week 14 才进入总结验收阶段。Week 6 只承接数据库底座后的基础接口打通，不提前写算法闭环、全量联调或最终验收。

---

### 🧱 本周建设范围

本周围绕“核心基础接口 + 安全认证 + 统一返回”展开，重点完成认证、场所、日记和设施四类接口的初步可调用状态。

| 模块 | 对应类 / 文件 | 本周进展 | 说明 |
|---|---|---|---|
| 认证链路 | `AuthController` / `AuthService` / `AuthServiceImpl` | 初步打通 | 提供登录、注册接口，登录成功后返回 JWT |
| JWT 安全链路 | `SecurityConfig` / `JwtAuthenticationFilter` / `UserDetailsServiceImpl` / `JwtUtils` | 初步建立 | 配置公开接口、无状态会话、Token 解析和用户上下文注入 |
| 场所查询 | `PlaceController` / `PlaceMapper` / `SpotPlace` | 初步可用 | 支持分页、类型筛选、关键字搜索和详情查询 |
| 日记查询 | `DiaryController` / `DiaryMapper` / `TravelDiary` | 初步可用 | 支持分页、按 `placeId` 筛选和详情查询 |
| 设施查询 | `FacilityController` / `FacilityMapper` / `SpotFacility` / `GeoUtils` | 初步可用 | 支持按场所查询、按类型筛选和附近设施查询 |
| 统一响应 | `Result<T>` | 已建立 | 统一 `code/message/data` 返回结构 |
| 异常处理 | `GlobalExceptionHandler` / `BusinessException` | 初步建立 | 统一处理业务异常、参数校验异常、认证异常、权限异常和兜底异常 |
| MyBatis-Plus 支撑 | `MybatisPlusConfig` / Mapper 基础接口 | 初步建立 | 分页插件和基础 Mapper 查询可支撑列表接口 |
| 接口文档基础 | `SwaggerConfig` / Controller 注解 | 初步准备 | 为后续接口调试和文档查看提供基础 |

---

### 📝 本次修改文件清单

#### 1) Controller 接口层

| 文件 | 操作 | 说明 |
|---|---|---|
| `controller/AuthController.java` | 新建/完善 | 提供 `/api/auth/login` 和 `/api/auth/register` |
| `controller/PlaceController.java` | 新建/完善 | 提供 `/api/places` 分页、筛选、关键字搜索和 `/api/places/{id}` 详情 |
| `controller/DiaryController.java` | 新建/完善 | 提供 `/api/diaries` 分页、`placeId` 筛选和 `/api/diaries/{id}` 详情 |
| `controller/FacilityController.java` | 新建/完善 | 提供 `/api/facilities` 场所设施查询和 `/api/facilities/nearby` 附近设施查询 |

> 当前源码中未发现 `NavigationController`、`LegacyNavigationController`、`AlgorithmController`、`MediaController`、`FoodController`、`StatsController`、`UserController`，因此本周不将这些文件记录为已完成。

#### 2) 认证与安全链路

| 文件 | 操作 | 说明 |
|---|---|---|
| `service/AuthService.java` | 新建/完善 | 定义登录和注册业务入口 |
| `service/impl/AuthServiceImpl.java` | 新建/完善 | 完成用户名查重、密码 BCrypt 加密、登录校验和 Token 返回 |
| `config/SecurityConfig.java` | 新建/完善 | 配置公开接口、受保护接口、无状态会话和 JWT 过滤器 |
| `security/JwtAuthenticationFilter.java` | 新建/完善 | 从 `Authorization: Bearer ...` 中解析 Token 并注入认证上下文 |
| `security/UserDetailsServiceImpl.java` | 新建/完善 | 根据 Token 中的用户 ID 读取数据库用户信息 |
| `utils/JwtUtils.java` | 新建/完善 | 提供 Token 生成、解析、用户 ID 获取和有效性校验 |

#### 3) 统一返回与异常处理

| 文件 | 操作 | 说明 |
|---|---|---|
| `utils/Result.java` | 新建/完善 | 统一成功和失败响应格式 |
| `exception/BusinessException.java` | 新建/完善 | 承载业务错误码和错误消息 |
| `exception/GlobalExceptionHandler.java` | 新建/完善 | 统一处理业务异常、校验异常、认证异常、权限异常和系统异常 |

#### 4) 配置与工具类

| 文件 | 操作 | 说明 |
|---|---|---|
| `config/MybatisPlusConfig.java` | 新建/完善 | 配置 MyBatis-Plus 分页插件和时间字段自动填充 |
| `config/RedisConfig.java` | 新建/完善 | 提供 Redis 基础配置入口 |
| `config/SwaggerConfig.java` | 新建/完善 | 提供接口文档基础配置 |
| `utils/GeoUtils.java` | 新建/完善 | 提供 Haversine 距离计算，支撑附近设施查询 |

#### 5) Model / Mapper 基础层

| 类型 | 当前状态 | 说明 |
|---|---|---|
| Entity | 已存在 | `SysUser`、`SpotPlace`、`SpotBuilding`、`SpotFacility`、`SpotRoadEdge`、`TravelDiary`、`UserBehavior` |
| Mapper | 已存在 | `UserMapper`、`PlaceMapper`、`BuildingMapper`、`FacilityMapper`、`RoadEdgeMapper`、`DiaryMapper`、`UserBehaviorMapper` |
| DTO | 已存在 | `LoginDTO`、`RegisterDTO` |
| VO | 已存在 | `LoginVO` |

> 当前源码中未发现 `algorithm/` 目录及推荐、搜索、路径规划、压缩、过滤、排序等算法类。本周仅保留后续接入计划，不记录为已接入业务。

---

### 🧠 本轮开发的核心产出

本周工作的重点，是让 Week 5 建好的数据模型开始通过基础接口被访问，并建立认证、安全、异常和响应格式的工程边界。

1. **认证链路初步打通**  
   `AuthController` 调用 `AuthServiceImpl` 完成登录与注册。注册时对密码进行 BCrypt 加密，登录时校验用户名和密码，并通过 `JwtUtils` 生成 Token 返回给前端。

2. **核心查询接口初步可用**  
   `PlaceController`、`DiaryController`、`FacilityController` 已能基于 MyBatis-Plus Mapper 完成基础查询，支撑场所列表、日记列表、设施列表等页面的初步联调。

3. **分页与筛选能力开始落地**  
   场所和日记列表接口使用 MyBatis-Plus `Page<T>` 输出分页结果；场所接口支持 `type` 和 `keyword`，日记接口支持 `placeId`，设施接口支持 `placeId` 和 `type`。

4. **附近设施查询具备基础能力**  
   `FacilityController#nearby` 通过 `GeoUtils.distance(...)` 计算当前位置与设施坐标之间的球面距离，在半径范围内返回候选设施。该能力属于 LBS 查询基础，不等同于完整路线规划。

5. **统一响应与异常处理初步建立**  
   `Result<T>` 统一输出 `code/message/data`，`GlobalExceptionHandler` 统一处理常见异常，使后续前端更容易建立统一错误处理逻辑。

6. **安全边界初步明确**  
   `SecurityConfig` 已配置 `/api/auth/**`、GET `/api/places/**`、GET `/api/diaries/**`、Swagger 文档为公开访问，其余接口默认需要认证。

7. **复杂算法能力保持后续预留**  
   数据库中的 `user_behavior` 和 `spot_road_edge` 为推荐与路线规划提供了数据基础，但当前 Java 源码尚未落地对应算法类或导航 Controller，本周不将其记录为完成项。

---

### ✅ 验证结果

- 已核对 `AuthController` 存在，并提供登录、注册接口。
- 已核对 `AuthService` 和 `AuthServiceImpl` 存在，登录注册逻辑已基于 `UserMapper`、`PasswordEncoder` 和 `JwtUtils` 实现。
- 已核对 `PlaceController` 存在，支持分页、类型筛选、关键字搜索和详情查询。
- 已核对 `DiaryController` 存在，支持分页、按场所筛选和详情查询。
- 已核对 `FacilityController` 存在，支持按场所查询、按类型筛选和附近设施查询。
- 已核对 `SecurityConfig`、`JwtAuthenticationFilter`、`UserDetailsServiceImpl`、`JwtUtils` 存在，JWT 认证链路已具备基础结构。
- 已核对 `Result`、`BusinessException`、`GlobalExceptionHandler` 存在，统一响应和异常处理已具备基础结构。
- 已核对 `MybatisPlusConfig` 存在，分页插件和时间字段自动填充已有配置。
- 当前未发现 `NavigationController`、`AlgorithmController`、`MediaController`、`FoodController`、`StatsController`、`UserController` 或独立 `algorithm/` 目录，因此本周不记录这些内容为已完成。

> 本次验证以源码文件核对和实现阅读为主。本周未实际运行并验证 `mvn compile` 或 `mvn test` 成功，因此不宣称编译或测试已通过。

---

### 🔍 技术实现细节

#### 1) 登录与注册链路

`AuthController` 对外暴露：

- `POST /api/auth/login`
- `POST /api/auth/register`

登录逻辑由 `AuthServiceImpl#login(...)` 承担：

- 通过 `UserMapper` 按用户名查询 `SysUser`；
- 使用 `PasswordEncoder#matches(...)` 校验密码；
- 校验通过后写入 `LoginVO`；
- 通过 `JwtUtils#generateToken(...)` 生成 Token。

注册逻辑由 `AuthServiceImpl#register(...)` 承担：

- 先检查用户名是否重复；
- 使用 BCrypt 对密码加密；
- 将 `interests`、`favoriteCategories` 转为 JSON 字符串；
- 最后通过 `UserMapper#insert(...)` 写入用户表。

#### 2) JWT 认证链路

`SecurityConfig` 采用无状态会话策略，并将 `JwtAuthenticationFilter` 放在 `UsernamePasswordAuthenticationFilter` 之前。

`JwtAuthenticationFilter` 的核心流程是：

- 从请求头读取 `Authorization`；
- 识别 `Bearer ` 前缀并提取 Token；
- 使用 `JwtUtils#isTokenValid(...)` 校验；
- 从 Token 中解析用户 ID；
- 通过 `UserDetailsServiceImpl` 加载用户；
- 将认证信息写入 `SecurityContextHolder`。

当前用户权限集合为空，说明本阶段只建立“是否登录”的基础边界，角色权限和细粒度授权留到后续补充。

#### 3) 场所查询接口

`PlaceController#list(...)` 使用 `LambdaQueryWrapper<SpotPlace>` 构造查询条件：

- `type` 存在时按场所类型精确筛选；
- `keyword` 存在时匹配 `name`、`keywords`、`description`；
- 默认按 `clickCount` 降序；
- 使用 `Page<SpotPlace>` 返回分页结果。

`PlaceController#detail(...)` 通过 `PlaceMapper#selectById(...)` 查询详情，查不到时返回 `Result.fail(404, "场所不存在")`。

#### 4) 日记查询接口

`DiaryController#list(...)` 使用 `Page<TravelDiary>` 返回分页结果，并支持按 `placeId` 筛选。列表默认按 `createdAt` 降序排列。

`DiaryController#detail(...)` 通过 `DiaryMapper#selectById(...)` 查询详情，查不到时返回 `Result.fail(404, "日记不存在")`。

当前源码中未发现完整 `DiaryServiceImpl#createDiary`，因此本周不记录日记创建、压缩、敏感词过滤、推荐等能力为已完成。

#### 5) 设施与附近设施查询

`FacilityController#listByPlace(...)` 通过 `placeId` 查询场所内设施，并可按 `type` 进一步筛选。

`FacilityController#nearby(...)` 接收入参 `lat`、`lng`、`radius`、`type`，先按类型筛选候选设施，再通过 `GeoUtils.distance(...)` 计算距离并过滤半径范围内的设施。

当前实现适合中小数据量和联调验证；如果后续设施数据量扩大，需要考虑数据库侧空间索引、分页或范围预筛选。

#### 6) 统一返回与异常处理

`Result<T>` 统一提供：

- `success(T data)`
- `success()`
- `fail(String message)`
- `fail(Integer code, String message)`

`GlobalExceptionHandler` 当前覆盖：

- `BusinessException`
- `MethodArgumentNotValidException`
- `AuthenticationException`
- `AccessDeniedException`
- 通用 `Exception`

这让前端可以先围绕 `code/message/data` 建立基础处理逻辑。

---

### ⚠️ 遇到的问题与处理

#### 1) Controller 当前仍直接依赖 Mapper，Service 层尚不完整

本周为了尽快打通基础查询接口，`PlaceController`、`DiaryController`、`FacilityController` 直接调用对应 Mapper。这样可以快速验证数据库访问和接口返回，但长期会让 Controller 承担过多业务逻辑。

**处理方式：**

- Week 6 先保留该结构，优先完成基础可调用；
- 后续逐步补充 `PlaceService`、`DiaryService`、`FacilityService` 等业务层；
- 将筛选、排序、空结果处理、行为记录等逻辑下沉到 Service。

#### 2) 前端旧接口与 Java 接口可能存在路径差异

旧前端中部分接口可能仍沿用旧后端路径或端口，而 Java 侧当前已形成 `/api/auth`、`/api/places`、`/api/diaries`、`/api/facilities` 等基础路径。

**处理方式：**

- 本周先稳定 Java 后端基础接口；
- 后续联调时集中调整前端 `api.js`；
- 优先对齐登录、场所列表、日记列表、设施查询等核心页面。

#### 3) 附近设施查询当前为内存过滤

`FacilityController#nearby(...)` 当前先查出候选设施，再使用 `GeoUtils.distance(...)` 在 Java 内存中过滤半径范围。该方式实现直接，适合早期联调，但大数据量下可能存在性能压力。

**处理方式：**

- Week 6 暂作为 LBS 基础能力保留；
- 后续根据数据量评估数据库空间索引、经纬度范围预过滤或分页策略；
- 不将其表述为完整路径规划或导航能力。

#### 4) 推荐、导航、搜索等算法尚未在 Java 主工程落地

Week 5 已经通过 `user_behavior`、`spot_road_edge` 等表为后续能力预留了数据基础，但当前 Java 源码中尚未发现独立 `algorithm/` 目录和对应算法类。

**处理方式：**

- 本周不记录推荐、路径规划、室内导航、压缩、敏感词过滤等为已完成；
- 将这些能力放入后续计划；
- 下一阶段先补清 Service 和结果对象，再逐步接入复杂能力。

---

### 🔮 下次开发计划

#### 优先级高

1. **补强核心 Service 层**
   - 新增或完善场所、日记、设施相关 Service
   - 将 Controller 中直接调用 Mapper 的查询逻辑下沉
   - 保持 Controller 更聚焦参数接收和结果返回

2. **推进前端基础页面联调**
   - 对齐登录接口
   - 对齐场所列表、详情接口
   - 对齐日记列表、详情接口
   - 对齐设施列表和附近设施接口

3. **继续统一接口返回结构**
   - 保持 `Result<T>` 风格
   - 规范资源不存在、参数错误、未登录、无权限等错误码
   - 检查分页接口和列表接口的空结果表现

#### 优先级中

4. **补充基础测试**
   - 认证注册与登录测试
   - 场所分页与关键字筛选测试
   - 日记分页与 `placeId` 筛选测试
   - 附近设施查询测试

5. **准备推荐与导航能力的接口边界**
   - 推荐能力先基于 `user_behavior` 设计输入输出结构
   - 路线规划能力先基于 `spot_road_edge` 设计路径结果结构
   - 在源码落地前不提前声明算法已接入

#### 后续改进

6. **评估更多业务模块**
   - 用户资料接口
   - 建筑查询接口
   - 统计概览接口
   - 美食或多媒体资源是否需要独立模块

7. **继续整理安全策略**
   - 明确哪些查询接口公开访问
   - 明确哪些写入、行为记录、用户资料接口需要登录
   - 后续再评估角色权限和管理端接口

---

### 🏗 当前项目结构

```text
tourism-system-java/
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

如果说 Week 5 的重点是“把数据库和持久层入口搭起来”，那么 Week 6 的重点就是“让最核心的基础接口能够被调用，并建立认证、安全和统一返回的工程边界”。

本次开发推进后，项目已经具备：

- 登录和注册的基础认证接口；
- JWT Token 生成、解析和过滤器接入；
- 场所分页、筛选、关键字搜索和详情查询；
- 日记分页、按场所筛选和详情查询；
- 设施按场所查询、按类型筛选和附近设施查询；
- `Result<T>` 统一响应结构；
- `GlobalExceptionHandler` 初步异常处理；
- MyBatis-Plus 分页和基础 Mapper 查询支撑。

当前仍待补充：

- 更完整的业务 Service 层；
- 用户、建筑、统计等更多模块接口；
- 前端页面级联调；
- 推荐、导航、搜索、多媒体等复杂能力的源码落地；
- 自动化测试和真实运行验证。

下一阶段将围绕“**Service 层补强、前端基础页面联调、返回结构继续收敛，以及推荐/导航能力的接口边界设计**”继续推进。
