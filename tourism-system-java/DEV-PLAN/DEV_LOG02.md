# 个性化旅游系统 Java 重构 — 开发日志 02

---

## 📅 2026-04-06 第二次开发：Controller 注入 Service 重构 + API 端点扩展

### 🎯 需求背景

上次开发完成了 Service 层（8 个接口 + 8 个实现类），但现有 Controller 仍然直接注入 Mapper 进行数据库操作，违背了 **Controller → Service → Mapper** 的分层架构原则。

本次目标：
1. 将所有 Controller 中的 Mapper 依赖替换为对应的 Service 依赖
2. 利用 Service 层已有的业务方法，新增 API 端点
3. 保持所有原有 API 接口不变，确保向下兼容

> **前置条件**：MySQL 建表（`schema.sql`）和数据导入（`data.sql`）已完成。

---

### 🔄 重构前后对比

| Controller | 重构前依赖 | 重构后依赖 |
|---|---|---|
| `PlaceController` | PlaceMapper, BuildingMapper, FacilityMapper | **PlaceService**, **BuildingService**, **FacilityService** |
| `BuildingController` | BuildingMapper | **BuildingService** |
| `FacilityController` | FacilityMapper, BuildingMapper | **FacilityService**, **BuildingService** |
| `DiaryController` | DiaryMapper | **DiaryService** |
| `UserController` | UserMapper | **UserService**, **UserBehaviorService** |
| `StatsController` | PlaceMapper, DiaryMapper, UserMapper, RoadEdgeMapper | **PlaceService**, **DiaryService**, **UserService**, **RoadEdgeService**, **BuildingService**, **FacilityService**, **FoodService** |
| `AuthController` | AuthService, UserMapper | AuthService, **UserService** |
| `FoodController` | _(已使用 FoodService，无需修改)_ | FoodService |

---

### 📝 本次修改文件清单

#### Controller 控制器（7 个修改）

| 文件 | 操作 | 改动要点 |
|---|---|---|
| `controller/PlaceController.java` | 修改 | Mapper → Service；新增 `/hot`、`/top-rated`、`/type/{type}` 三个端点 |
| `controller/BuildingController.java` | 修改 | Mapper → Service；新增 `/place/{placeId}` 端点 |
| `controller/FacilityController.java` | 修改 | Mapper → Service；新增 `/place/{placeId}`、`/place/{placeId}/type/{type}` 端点 |
| `controller/DiaryController.java` | 修改 | Mapper → Service；新增 `/author/{authorId}`、`/hot` 端点 |
| `controller/UserController.java` | 修改 | Mapper → Service + UserBehaviorService；新增 `PUT /{id}`、`POST /{userId}/behavior`、`GET /{userId}/views`、`GET /{userId}/ratings` 端点 |
| `controller/StatsController.java` | 修改 | 4 个 Mapper → 7 个 Service；统计项新增 buildings/facilities/foods 计数 |
| `controller/AuthController.java` | 修改 | UserMapper → UserService |

#### 未修改
| 文件 | 原因 |
|---|---|
| `controller/FoodController.java` | 上次开发时已正确注入 FoodService，无需修改 |

---

### 🆕 新增 API 端点汇总

#### PlaceController (`/api/places`)

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/places/hot?limit=10` | 获取热门场所（按浏览量排序） |
| GET | `/api/places/top-rated?limit=10` | 获取高评分场所 |
| GET | `/api/places/type/{type}` | 按类型查询场所列表 |

#### BuildingController (`/api/buildings`)

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/buildings/place/{placeId}` | 根据场所ID查询建筑物列表 |

#### FacilityController (`/api/facilities`)

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/facilities/place/{placeId}` | 根据场所ID查询设施列表 |
| GET | `/api/facilities/place/{placeId}/type/{type}` | 根据场所和类型查询设施 |

#### DiaryController (`/api/diaries`)

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/diaries/author/{authorId}` | 根据作者ID查询日记列表 |
| GET | `/api/diaries/hot?limit=10` | 获取热门日记（按浏览量排序） |

#### UserController (`/api/users`)

| 方法 | 路径 | 说明 |
|---|---|---|
| PUT | `/api/users/{id}` | 更新用户信息 |
| POST | `/api/users/{userId}/behavior?targetId=&behaviorType=&score=` | 记录用户行为（浏览/评分） |
| GET | `/api/users/{userId}/views` | 查询用户浏览历史 |
| GET | `/api/users/{userId}/ratings` | 查询用户评分历史 |

#### StatsController (`/api/stats`)

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/stats` | 统计概览（新增 buildings/facilities/foods 三项计数） |

---

### 🔌 现有 API 端点总览（全部 Controller）

```
AuthController     /api/auth
  POST /api/auth/login              用户登录
  POST /api/auth/register           用户注册
  GET  /api/auth/me                 获取当前登录用户

PlaceController    /api/places
  GET  /api/places                  分页查询场所列表
  GET  /api/places/{id}             获取场所详情（含建筑/设施）
  GET  /api/places/search           搜索场所
  GET  /api/places/hot              🆕 热门场所
  GET  /api/places/top-rated        🆕 高评分场所
  GET  /api/places/type/{type}      🆕 按类型查场所

BuildingController /api/buildings
  GET  /api/buildings               分页查询建筑物
  GET  /api/buildings/{id}          获取建筑物详情
  GET  /api/buildings/search        搜索建筑物
  GET  /api/buildings/place/{id}    🆕 按场所查建筑

FacilityController /api/facilities
  GET  /api/facilities              查询设施（分页，支持筛选）
  GET  /api/facilities/{id}         获取设施详情
  GET  /api/facilities/search       搜索设施
  GET  /api/facilities/nearby       附近设施（LBS）
  POST /api/facilities/nearest      建筑附近设施（按距离排序）
  GET  /api/facilities/place/{id}           🆕 按场所查设施
  GET  /api/facilities/place/{id}/type/{t}  🆕 按场所+类型查设施

FoodController     /api/foods
  GET  /api/foods/place/{placeId}   按场所查美食
  GET  /api/foods/cuisine/{cuisine} 按菜系查美食
  GET  /api/foods/popular           热门美食
  GET  /api/foods/{id}              美食详情

DiaryController    /api/diaries
  GET  /api/diaries                 分页查询日记
  GET  /api/diaries/{id}            日记详情
  GET  /api/diaries/author/{id}     🆕 按作者查日记
  GET  /api/diaries/hot             🆕 热门日记

UserController     /api/users
  GET  /api/users                   用户列表
  GET  /api/users/{id}              用户详情
  PUT  /api/users/{id}              🆕 更新用户信息
  POST /api/users/{id}/behavior     🆕 记录用户行为
  GET  /api/users/{id}/views        🆕 浏览历史
  GET  /api/users/{id}/ratings      🆕 评分历史

StatsController    /api/stats
  GET  /api/stats                   系统统计概览（7项）
```

---

### ✅ 验证结果

- `mvn compile` 编译通过，无任何错误
- 所有原有 API 路径保持不变，向下兼容

---

### 🔮 下次开发计划

#### 优先级高

1. **前端 API 对接**
   - 根据后端 Controller 接口修改 `frontend/src/services/api.js`
   - 对齐前后端数据结构（VO/DTO 与前端 model 的映射）
   - 验证前后端联调是否通畅

2. **启动应用并验证全部 API**
   - `mvn spring-boot:run` 启动后端
   - 使用 Swagger UI (`/swagger-ui.html`) 或 Postman 逐一测试每个端点
   - 重点验证分页、搜索、LBS 附近设施等核心功能

#### 优先级中

3. **路线规划功能**
   - 基于 `spot_road_edge` 表和 JGraphT 库实现最短路径算法（Dijkstra）
   - 新增 `NavigationService` 和 `NavigationController`
   - API 设计：`GET /api/navigation/route?from={nodeA}&to={nodeB}&placeId={id}`

4. **个性化推荐功能**
   - 基于 `user_behavior` 表实现协同过滤推荐
   - 新增 `RecommendService` 和 `RecommendController`
   - API 设计：`GET /api/recommend/places?userId={id}&limit=10`

#### 后期改进

5. **室内导航**（`indoor_navigation.json`）
   - 设计 `indoor_nav_node` 和 `indoor_nav_connection` 表
   - 实现楼内路径规划

6. **MyBatis-Plus 自动填充配置**
   - 实现 `MetaObjectHandler`，自动填充 `createdAt` / `updatedAt` 字段

7. **单元测试**
   - 使用 H2 内存数据库对 Service 层编写测试

---

### 🏗 当前项目结构

```
tourism-system-java/
├── DEV-PLAN/
│   ├── DEV_LOG01.md        # 第一次开发日志（数据迁移+Service层）
│   └── DEV_LOG02.md        # 第二次开发日志（Controller注入Service）
├── sql/
│   ├── schema.sql          # 建表脚本（7张表）✅ 已执行
│   └── data.sql            # 数据导入脚本（1095行）✅ 已执行
├── src/main/java/com/tourism/
│   ├── TourismApplication.java
│   ├── config/             # 配置类（MBP/Redis/Security/Swagger）
│   ├── controller/         # 控制器（8个：Auth/Place/Building/Facility/Food/Diary/User/Stats）
│   ├── exception/          # 全局异常处理
│   ├── mapper/             # MyBatis-Plus Mapper（7个）
│   ├── model/
│   │   ├── dto/            # 请求 DTO（Login/Register）
│   │   ├── entity/         # 实体类（8个）
│   │   └── vo/             # 响应 VO（Login/PlaceDetail/UserProfile）
│   ├── security/           # JWT 认证过滤器
│   ├── service/            # Service 接口（9个）
│   │   └── impl/           # Service 实现类（9个）
│   └── utils/              # 工具类（Geo/Jwt/Result）
├── frontend/               # 前端项目
└── src/main/resources/
    ├── application.yml     # 应用配置
    └── mapper/             # XML Mapper（如有需要）
```
