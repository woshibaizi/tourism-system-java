# 个性化旅游系统 Java 版 — 开发日志

---

## 📅 2026-04-06 第一次开发：数据库底座从零搭建

### 🎯 需求背景

为了让个性化旅游系统的 Java 后端具备稳定的数据支撑，本轮开发首先从 **MySQL 数据库底座建设** 入手，完成核心业务表设计、建库建表脚本整理，并同步建立与数据库结构对应的 Entity / Mapper 基础映射。

这一阶段的目标不是完成成熟业务闭环，也不是提前接入推荐、导航、AIGC 或多媒体能力，而是先把“数据模型清晰、表结构可创建、Java 持久层有入口”这件事搭起来，为后续场所查询、日记展示、设施检索、用户行为记录、推荐与路线规划继续推进提供统一的数据基础。

> **说明**：本周定位为 Java 重构版的数据库起步阶段。当前仅记录已经在源码中可核对的表结构、实体类、Mapper 和基础配置；初始化数据脚本、完整 Service 层、复杂算法与前端联调均作为后续开发内容处理。

> **周期口径**：本项目周报按 Week 5 至 Week 14 逐周推进记录，其中 Week 14 才进入总结验收阶段。Week 5 只记录数据底座和持久层入口，不提前写后续联调、算法或验收结论。

---

### 🧱 本次数据库建设范围

本次开发围绕 `tourism_db` 完成首批核心业务表设计，当前建表脚本位于 `sql/schema.sql`。数据库范围覆盖用户、场所、建筑、设施、道路、日记、用户行为等主链路数据。

| 模块 | 对应表 | 当前状态 | 说明 |
|---|---|---|---|
| 用户中心 | `sys_user` | 已建模 | 用户名、加密密码、兴趣标签、偏好分类、头像、软删除与时间字段 |
| 场所中心 | `spot_place` | 已建模 | 景区 / 校园 / 公园 / 博物馆等场所主表，包含评分、热度、坐标、封面与描述 |
| 建筑信息 | `spot_building` | 已建模 | 场所下建筑物信息，包含类型、所属场所、坐标与评分 |
| 配套设施 | `spot_facility` | 已建模 | 商店、饭店、洗手间、图书馆、食堂、公交站等设施信息 |
| 路网拓扑 | `spot_road_edge` | 已建模 | 道路边、起止节点、距离、理想速度、拥堵系数和通行方式 |
| 游记内容 | `travel_diary` | 已建模 | 日记标题、正文、关联场所、作者、评分、图片、视频、标签 |
| 用户行为 | `user_behavior` | 已建模 | 浏览、点赞、评分、收藏等行为记录，为后续推荐提供数据来源 |

补充约定：

- 数据库统一使用 `utf8mb4` 字符集和 `utf8mb4_unicode_ci` 排序规则。
- 多个业务表保留 `deleted` 字段，用于后续软删除能力。
- 主要业务表保留 `created_at`、`updated_at` 等时间字段，便于后续审计和排序。
- `sys_user.username` 通过唯一索引约束，避免用户名重复。
- `user_behavior` 通过 `(user_id, target_id, behavior_type)` 唯一约束避免重复行为记录。
- 场所、设施、道路、日记等表增加常用查询索引，为后续列表、筛选和关联查询打基础。
- `sql/data.sql` 当前未在源码中出现，初始化数据导入仍作为后续补充任务。

---

### 📝 本次修改文件清单

#### 1) SQL 脚本

| 文件 | 操作 | 说明 |
|---|---|---|
| `sql/schema.sql` | 修改/完善 | 创建 `tourism_db`，并定义 7 张核心业务表的结构、主键、索引与默认字段 |

> 当前 `sql/` 目录下仅核对到 `schema.sql`。初始化数据脚本尚未形成独立 `data.sql` 文件，后续可结合旧系统 JSON 数据或迁移脚本补齐。

#### 2) Entity 实体层

| 文件 | 操作 | 说明 |
|---|---|---|
| `model/entity/SysUser.java` | 新建/完善 | 对应 `sys_user` 用户表 |
| `model/entity/SpotPlace.java` | 新建/完善 | 对应 `spot_place` 场所表 |
| `model/entity/SpotBuilding.java` | 新建/完善 | 对应 `spot_building` 建筑物表 |
| `model/entity/SpotFacility.java` | 新建/完善 | 对应 `spot_facility` 服务设施表 |
| `model/entity/SpotRoadEdge.java` | 新建/完善 | 对应 `spot_road_edge` 道路拓扑表 |
| `model/entity/TravelDiary.java` | 新建/完善 | 对应 `travel_diary` 旅游日记表 |
| `model/entity/UserBehavior.java` | 新建/完善 | 对应 `user_behavior` 用户行为表 |

> 当前源码中未发现 `SpotFood.java`，因此本周不记录美食实体为已完成。美食数据可在后续根据业务需要单独建表或合并到设施/场所扩展字段中评估。

#### 3) Mapper 数据访问层

| 文件 | 操作 | 说明 |
|---|---|---|
| `mapper/UserMapper.java` | 新建/完善 | 用户表 MyBatis-Plus 数据访问入口 |
| `mapper/PlaceMapper.java` | 新建/完善 | 场所表 MyBatis-Plus 数据访问入口 |
| `mapper/BuildingMapper.java` | 新建/完善 | 建筑物表 MyBatis-Plus 数据访问入口 |
| `mapper/FacilityMapper.java` | 新建/完善 | 服务设施表 MyBatis-Plus 数据访问入口 |
| `mapper/RoadEdgeMapper.java` | 新建/完善 | 道路拓扑表 MyBatis-Plus 数据访问入口 |
| `mapper/DiaryMapper.java` | 新建/完善 | 旅游日记表 MyBatis-Plus 数据访问入口 |
| `mapper/UserBehaviorMapper.java` | 新建/完善 | 用户行为表 MyBatis-Plus 数据访问入口 |

> 当前源码中未发现 `FoodMapper.java`，因此本周不记录美食 Mapper 为已完成。

#### 4) 基础配置

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/main/resources/application.yml` | 新建/完善 | 配置服务端口、MySQL 数据源、Redis、MyBatis-Plus、JWT、Swagger 和日志级别 |
| `config/MybatisPlusConfig.java` | 新建/完善 | 配置 MyBatis-Plus 分页插件和时间字段自动填充处理器 |

#### 5) Service 与 Controller 当前边界

| 目录 / 文件 | 当前状态 | 说明 |
|---|---|---|
| `service/AuthService.java` | 已存在 | 当前仅认证服务接口已落地 |
| `service/impl/AuthServiceImpl.java` | 已存在 | 当前仅认证服务实现已落地 |
| `controller/AuthController.java` | 已存在 | 登录、注册接口属于基础认证链路 |
| `controller/PlaceController.java` | 已存在 | 场所分页与详情查询已具备基础入口 |
| `controller/DiaryController.java` | 已存在 | 日记分页与详情查询已具备基础入口 |
| `controller/FacilityController.java` | 已存在 | 设施查询与附近设施查询已具备基础入口 |

> Week 5 的主题仍是数据库底座，因此上述 Controller / Service 只作为“当前源码边界”记录，不展开描述为成熟业务闭环。完整 Service 层、更多 Controller、推荐、导航、多媒体等能力留到后续阶段推进。

---

### 🧠 本轮开发的核心产出

这次工作的重点，不是把某个业务页面或算法链路一次性做完，而是把 Java 后端的数据基础设施先铺出来：

1. **数据库结构初步定型**  
   `schema.sql` 已明确用户、场所、建筑、设施、道路、日记、用户行为 7 张核心表，为后续业务模块提供统一数据模型。

2. **核心字段和索引约定形成**  
   表结构中已经包含主键、唯一约束、软删除字段、时间字段、类型索引、评分/热度索引、行为唯一约束等基础设计，便于后续查询、排序和行为沉淀。

3. **Java 实体映射完成首轮对齐**  
   `model/entity/` 下已有 7 个核心实体类，与当前 `schema.sql` 的主要表结构对应，后续可以在此基础上继续补充 DTO / VO 和业务 Service。

4. **Mapper 数据访问入口建立**  
   `mapper/` 下已有 7 个 MyBatis-Plus `BaseMapper` 接口，说明 Java 后端已经具备访问核心表的基础入口。

5. **基础运行配置就位**  
   `application.yml` 已配置 MySQL、Redis、MyBatis-Plus、JWT、Swagger 等基础项，项目具备继续开展数据库连接、接口验证和后续联调的配置基础。

6. **后续扩展方向被明确保留**  
   用户行为表和道路拓扑表为后续推荐与路径规划提供数据来源，但本周不提前记录推荐算法、路径算法或 Agent / Skill 编排为已完成。

---

### ✅ 验证结果

- 已核对 `sql/schema.sql` 存在，并包含 `tourism_db` 建库语句和 7 张核心业务表建表语句。
- 已核对 `model/entity/` 下存在 7 个核心实体类：`SysUser`、`SpotPlace`、`SpotBuilding`、`SpotFacility`、`SpotRoadEdge`、`TravelDiary`、`UserBehavior`。
- 已核对 `mapper/` 下存在 7 个核心 Mapper：`UserMapper`、`PlaceMapper`、`BuildingMapper`、`FacilityMapper`、`RoadEdgeMapper`、`DiaryMapper`、`UserBehaviorMapper`。
- 已核对 `src/main/resources/application.yml` 存在，并包含 MySQL、Redis、MyBatis-Plus、JWT、Swagger 等基础配置。
- 当前 `sql/data.sql` 未在源码中出现，因此本周不记录初始化数据脚本为已完成。
- 当前未发现 `SpotFood.java`、`FoodMapper.java`、`FoodController.java`、独立 `algorithm/` 目录或完整业务 ServiceImpl 集合，因此不将这些内容写入 Week 5 已完成成果。

> 本次验证以源码文件核对和结构检查为主。本周未实际运行并验证 `mvn compile` 或 `mvn test` 成功，因此不宣称编译或测试已通过。

---

### 🔮 下次开发计划

#### 优先级高

1. **执行数据库落库验证**
   - 执行 `sql/schema.sql`
   - 检查 `tourism_db` 是否能正常创建
   - 逐表核对字段类型、默认值、索引和唯一约束

2. **补充初始化数据导入方案**
   - 评估是否新增 `sql/data.sql`
   - 或继续使用 `scripts/migrate_data.py` 从旧系统 JSON 数据迁移到 MySQL
   - 核对用户、场所、建筑、设施、道路、日记、用户行为等数据规模与字段完整性

3. **围绕核心表补强 Service 层**
   - 优先补齐场所、日记、设施等基础查询 Service
   - 将 Controller 中直接调用 Mapper 的逻辑逐步下沉到业务层
   - 保持返回结构稳定，为前端联调做准备

#### 优先级中

4. **推进基础接口结构整理**
   - 场所分页、详情、关键字搜索
   - 日记分页、详情、按场所筛选
   - 设施按场所、按类型、附近设施查询

5. **完善测试与本地运行条件**
   - 补充 Maven 环境或项目构建说明
   - 增加数据库连接、Mapper 查询和基础接口测试
   - 为后续 H2 或测试库验证预留配置

#### 后续改进

6. **继续评估扩展表结构**
   - 美食数据是否单独建表
   - 室内导航数据是否单独建模
   - 多媒体资源是否需要独立资源表

7. **为推荐与路线规划保留数据基础**
   - 基于 `user_behavior` 继续沉淀推荐所需行为数据
   - 基于 `spot_road_edge` 继续准备路径规划所需拓扑数据
   - 推荐、导航和复杂算法在后续周逐步实现，不纳入 Week 5 已完成范围

---

### 🏗 当前项目结构

```text
tourism-system-java/
├── sql/
│   └── schema.sql                # 数据库建表脚本
├── scripts/
│   └── migrate_data.py           # JSON 数据迁移到 MySQL 的辅助脚本
├── src/main/java/com/tourism/
│   ├── TourismApplication.java
│   ├── config/                   # Redis / Security / Swagger / MyBatis-Plus 配置
│   ├── controller/               # 当前已有 Auth / Place / Diary / Facility 基础接口
│   ├── exception/                # 业务异常与全局异常处理
│   ├── mapper/                   # 7 个核心 MyBatis-Plus Mapper
│   ├── model/
│   │   ├── dto/                  # LoginDTO / RegisterDTO
│   │   ├── entity/               # 7 个核心数据库实体
│   │   └── vo/                   # LoginVO
│   ├── security/                 # JWT 认证过滤器与用户加载逻辑
│   ├── service/                  # 当前已有 AuthService 与 AuthServiceImpl
│   └── utils/                    # Result / JwtUtils / GeoUtils
└── src/main/resources/
    └── application.yml           # 数据源、Redis、MyBatis-Plus、JWT、Swagger 配置
```

---

### 📌 阶段结论

Java 版个性化旅游系统的第一步，是先把数据库与持久层地基搭起来，而不是提前完成所有业务功能。

本次开发完成后，项目已经具备：

- 独立的 MySQL 建库建表脚本；
- 7 张核心业务表的数据模型；
- 与核心表对应的 Java Entity；
- 与核心表对应的 MyBatis-Plus Mapper；
- MySQL、Redis、MyBatis-Plus、JWT、Swagger 等基础配置；
- 后续场所查询、日记系统、设施查询、用户行为记录、推荐和路线规划继续推进的数据基础。

当前仍待补充：

- 初始化数据脚本或迁移后的真实数据校验；
- 更完整的 Service 层业务封装；
- 更多接口的结构收敛与前端联调；
- 推荐、导航、多媒体等后续复杂能力。

下一阶段将围绕“**数据库真实落库、初始化数据导入、基础 Service 层补强和核心查询接口整理**”继续推进。
