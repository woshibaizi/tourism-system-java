# 个性化旅游系统 Java 重构 — 开发日志

---

## 📅 2026-04-06 第一次开发：JSON 数据迁移 + 数据库层实现

### 🎯 需求背景

将原 Python 项目 (`tourism-system/backend/data/`) 中的 JSON 数据全部迁移到 MySQL 数据库，并在 Java 项目中实现完整的数据库访问层（Entity → Mapper → Service），为后续 API 开发打好基础。

> **说明**：`indoor_navigation.json`（室内导航）暂不处理，作为后期改进目标。

---

### 📊 数据迁移统计

| JSON 文件 | → MySQL 表 | 记录数 | 说明 |
|---|---|---|---|
| `users.json` | `sys_user` | 10 | 用户信息，密码统一 BCrypt("123456") |
| `places.json` | `spot_place` | 201 | 场所（景区/校园/公园/博物馆） |
| `buildings.json` | `spot_building` | 63 | 建筑物（教学楼/宿舍楼等） |
| `facilities.json` | `spot_facility` | 204 | 设施（食堂/图书馆/商店等） |
| `foods.json` | `spot_food` | 40 | 美食（菜系/价格/人气） |
| `roads.json` | `spot_road_edge` | 483 | 道路拓扑（路径/距离/拥堵系数） |
| `diaries.json` | `travel_diary` | 14 | 旅游日记 |
| users → visitHistory | `user_behavior` | ~100+ | 用户浏览行为 (VIEW) |
| users → ratingHistory | `user_behavior` | - | 用户场所评分 (RATE) |
| users → diaryRatingHistory | `user_behavior` | - | 用户日记评分 (RATE) |

**用户 ID 映射规则**：JSON 中的 `user_001` ~ `user_010` 映射为数据库自增 ID `1` ~ `10`。

---

### 📝 本次修改文件清单

#### SQL 脚本
| 文件 | 操作 | 说明 |
|---|---|---|
| `sql/schema.sql` | 修改 | 移除 `spot_place` 无效的 SPATIAL INDEX；新增 `spot_food` 表 |
| `sql/data.sql` | 新建 | 1095 行 INSERT 语句，覆盖全部 7 个 JSON 文件 |

#### Entity 实体类
| 文件 | 操作 | 说明 |
|---|---|---|
| `model/entity/SpotFood.java` | 新建 | 美食实体，映射 `spot_food` 表 |

#### Mapper 数据访问层
| 文件 | 操作 | 说明 |
|---|---|---|
| `mapper/FoodMapper.java` | 新建 | 美食 Mapper，继承 BaseMapper |

#### Service 接口（8 个）
| 文件 | 操作 |
|---|---|
| `service/PlaceService.java` | 新建 |
| `service/BuildingService.java` | 新建 |
| `service/FacilityService.java` | 新建 |
| `service/FoodService.java` | 新建 |
| `service/DiaryService.java` | 新建 |
| `service/UserService.java` | 新建 |
| `service/RoadEdgeService.java` | 新建 |
| `service/UserBehaviorService.java` | 新建 |

#### Service 实现类（8 个）
| 文件 | 操作 | 核心功能 |
|---|---|---|
| `service/impl/PlaceServiceImpl.java` | 新建 | 分页查询、关键字搜索、热门/高评分场所 |
| `service/impl/BuildingServiceImpl.java` | 新建 | 按场所查建筑列表 |
| `service/impl/FacilityServiceImpl.java` | 新建 | 按场所/类型查设施 |
| `service/impl/FoodServiceImpl.java` | 新建 | 按场所/菜系查美食、人气排序 |
| `service/impl/DiaryServiceImpl.java` | 新建 | 分页查日记、按作者查、热门日记 |
| `service/impl/UserServiceImpl.java` | 新建 | 按用户名查询、更新用户信息 |
| `service/impl/RoadEdgeServiceImpl.java` | 新建 | 按场所/节点查道路拓扑 |
| `service/impl/UserBehaviorServiceImpl.java` | 新建 | 记录行为(upsert)、查浏览/评分历史 |

#### Controller 控制器
| 文件 | 操作 | 说明 |
|---|---|---|
| `controller/FoodController.java` | 新建 | 美食相关 API（按场所/菜系/人气查询） |

---

### ✅ 验证结果

- `mvn compile` 编译通过，无任何错误
- SQL 语法经 Python 脚本自动生成并校验

---

### 🔮 下次开发计划

#### 优先级高
1. **在 MySQL 中执行建表和数据导入**
   - 执行 `sql/schema.sql` 建表
   - 执行 `sql/data.sql` 导入数据
   - 验证每张表的数据完整性（记录数是否匹配）

2. **完善现有 Controller，注入 Service**
   - `PlaceController` — 接入 PlaceService（分页查询、详情、热门推荐）
   - `BuildingController` — 接入 BuildingService
   - `FacilityController` — 接入 FacilityService
   - `DiaryController` — 接入 DiaryService
   - `UserController` — 接入 UserService
   - `StatsController` — 接入统计逻辑

3. **前端 API 对接**
   - 根据后端 Controller 接口修改 `frontend/src/services/api.js`

#### 优先级中
4. **路线规划功能**
   - 基于 `spot_road_edge` 表和 JGraphT 库实现最短路径算法
   - 新增 `NavigationService` 和 `NavigationController`

5. **个性化推荐功能**
   - 基于 `user_behavior` 表实现协同过滤推荐
   - 新增 `RecommendService`

#### 后期改进
6. **室内导航**（`indoor_navigation.json`）
   - 设计 `indoor_nav_node` 和 `indoor_nav_connection` 表
   - 实现楼内路径规划

7. **MyBatis-Plus 自动填充配置**
   - 实现 `MetaObjectHandler`，自动填充 `createdAt` / `updatedAt` 字段

8. **单元测试**
   - 使用 H2 内存数据库对 Service 层编写测试

---

### 🏗 当前项目结构

```
tourism-system-java/
├── sql/
│   ├── schema.sql          # 建表脚本（7张表）
│   └── data.sql            # 数据导入脚本（1095行）
├── src/main/java/com/tourism/
│   ├── TourismApplication.java
│   ├── config/             # 配置类（MBP/Redis/Security/Swagger）
│   ├── controller/         # 控制器（Auth/Place/Building/Facility/Diary/User/Stats/Food）
│   ├── exception/          # 全局异常处理
│   ├── mapper/             # MyBatis-Plus Mapper（7个）
│   ├── model/
│   │   ├── dto/            # 请求 DTO（Login/Register）
│   │   ├── entity/         # 实体类（7个：SysUser/SpotPlace/SpotBuilding/SpotFacility/SpotFood/SpotRoadEdge/TravelDiary/UserBehavior）
│   │   └── vo/             # 响应 VO（Login/PlaceDetail/UserProfile）
│   ├── security/           # JWT 认证过滤器
│   ├── service/            # Service 接口（9个，含 AuthService）
│   │   └── impl/           # Service 实现类（9个）
│   └── utils/              # 工具类（Geo/Jwt/Result）
└── src/main/resources/
    ├── application.yml     # 应用配置
    └── mapper/             # XML Mapper（如有需要）
```
