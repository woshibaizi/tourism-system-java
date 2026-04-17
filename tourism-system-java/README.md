# 个性化旅游系统 — Java 重构版

基于 **Spring Boot 3.3.5 + MyBatis-Plus + MySQL 8 + Redis** 的旅游系统后端。

## 技术栈

| 层次 | 技术 |
|---|---|
| Web 框架 | Spring Boot 3.3.5 |
| 安全认证 | Spring Security + JWT (jjwt 0.12.6) |
| 持久层 | MyBatis-Plus 3.5.8 |
| 数据库 | MySQL 8.0 |
| 缓存 | Redis (Lettuce) |
| 接口文档 | Springdoc OpenAPI 2.6.0 (Swagger UI) |
| 图算法 | JGraphT 1.5.2 |
| 构建工具 | Maven 3.9+ / Java 17+ |

## 项目结构

```
tourism-system-java/
├── pom.xml
├── sql/
│   └── schema.sql              ← MySQL 建表 DDL
├── scripts/
│   └── migrate_data.py         ← JSON → MySQL 数据迁移脚本
└── src/main/java/com/tourism/
    ├── TourismApplication.java
    ├── config/                 ← Redis / Security / Swagger / MyBatis-Plus 配置
    ├── security/               ← JWT 过滤器 / UserDetailsService
    ├── controller/             ← REST 接口层
    ├── service/impl/           ← 业务逻辑层
    ├── mapper/                 ← MyBatis Mapper 接口
    ├── model/
    │   ├── entity/             ← 7 张数据库实体
    │   ├── dto/                ← 请求参数对象
    │   └── vo/                 ← 响应视图对象
    ├── algorithm/              ← A* / Dijkstra / 推荐算法（待实现）
    ├── exception/              ← 全局异常处理
    └── utils/                  ← JWT / GeoUtils / Result
```

## 第一步：环境搭建与数据准备

### 1. 前置条件

- Java 17+（已验证 OpenJDK 25）
- Maven 3.9+
- MySQL 8.0（本地或 Docker）
- Redis 7+（本地或 Docker）
- Python 3.8+（仅迁移脚本需要）

### 2. 创建数据库

```bash
# 登录 MySQL
mysql -u root -p

# 执行建表脚本
source /path/to/tourism-system-java/sql/schema.sql
```

或直接执行：

```bash
mysql -u root -p < sql/schema.sql
```

### 3. 修改配置

编辑 `src/main/resources/application.yml`，填入真实的数据库密码：

```yaml
spring:
  datasource:
    password: your_password   # ← 改这里
```

### 4. 安装迁移脚本依赖

```bash
pip install pymysql bcrypt
```

### 5. 执行数据迁移

```bash
cd tourism-system-java/scripts

python migrate_data.py \
  --host localhost \
  --port 3306 \
  --user root \
  --password your_password \
  --data-dir ../../tourism-system/backend/data
```

迁移完成后会输出每张表的记录数，示例：

```
sys_user: 10 条
spot_place: 200 条
spot_building: 150 条
spot_facility: 80 条
spot_road_edge: 250 条
travel_diary: 20 条
user_behavior: 100 条
```

### 6. 启动项目

```bash
cd tourism-system-java
mvn spring-boot:run
```

访问 Swagger 文档：http://localhost:8080/swagger-ui.html

## Canonical API 与兼容策略

当前项目已经从“第一步阶段接口”推进到多页面联调阶段。后续开发和验收统一以 **Canonical API** 为准；旧接口只保留兼容，不再承接新能力。

### Canonical API

| 模块 | 接口 | 说明 |
|---|---|---|
| 认证 | `POST /api/auth/login` | 用户登录，返回 JWT |
| 认证 | `POST /api/auth/register` | 用户注册 |
| 场所 | `GET /api/places` | 分页查询，支持类型/关键字筛选 |
| 场所 | `GET /api/places/{id}` | 场所详情 |
| 场所 | `GET /api/places/search` | 名称、类别、关键字查询 |
| 场所 | `POST /api/places/recommend` | 景点/学校推荐 |
| 场所 | `POST /api/places/sort` | 热度/评分等排序 |
| 路径规划 | `POST /api/navigation/shortest-path` | 单目标路径规划，支持最短距离/最短时间 |
| 路径规划 | `POST /api/navigation/mixed-vehicle-path` | 校园/景区混合交通工具最短时间路径 |
| 路径规划 | `POST /api/navigation/multi-destination` | 多目标路径规划，返回完整路径与分段信息 |
| 室内导航 | `POST /api/navigation/indoor` | 建筑物内部导航 |
| 室内导航 | `GET /api/navigation/indoor/rooms` | 室内房间列表 |
| 室内导航 | `GET /api/navigation/indoor/building-info` | 室内建筑结构信息 |
| 设施 | `GET /api/facilities` | 按场所查询设施 |
| 设施 | `POST /api/facilities/nearest` | 基于可通行路径距离的附近设施排序 |
| 日记 | `GET /api/diaries` | 分页查询日记 |
| 日记 | `GET /api/diaries/{id}` | 日记详情 |
| 日记 | `GET /api/diaries/search` | 按标题/内容/目的地检索旅游日记 |
| 日记 | `POST /api/diaries/recommend` | 日记推荐 |
| 日记 | `POST /api/diaries/{id}/rate` | 日记评分 |
| 美食 | `GET /api/foods` | 美食列表、过滤、模糊搜索、排序主接口 |
| 美食 | `GET /api/foods/popular` | 热门美食 |
| 美食 | `GET /api/foods/cuisines` | 菜系列表 |
| 美食 | `GET /api/foods/place/{placeId}` | 指定场所美食 |
| AIGC/上传 | `POST /api/upload/image` | 图片上传 |
| AIGC/上传 | `POST /api/upload/video` | 视频上传 |
| AIGC/上传 | `POST /api/aigc/convert-to-video` | 图片和描述生成动画 |
| 算法辅助 | `POST /api/algorithm/compress` | Huffman 压缩 |
| 算法辅助 | `POST /api/algorithm/decompress` | Huffman 解压 |
| 算法辅助 | `POST /api/algorithm/filter-text` | AC 自动机敏感词过滤 |

### Legacy / 调试接口

| 接口 | 策略 |
|---|---|
| `/api/routes/*` | 兼容旧路线规划调用方；不再新增字段和能力 |
| `/api/indoor/*` | 兼容旧室内导航页面；前端应迁移到 `/api/navigation/indoor*` |
| `GET /api/facilities/nearby` | LBS/调试用途；页面主路径使用 `/api/facilities/nearest` |
| `/api/algorithm/*` | 算法演示、压缩、敏感词过滤等辅助能力；业务页面不应依赖它完成核心推荐/搜索 |

完整需求映射和验收矩阵见 [`DEV-PLAN/REQUIREMENTS_API_TEST_MATRIX.md`](DEV-PLAN/REQUIREMENTS_API_TEST_MATRIX.md)。

## 早期基础接口记录

| 模块 | 接口 | 说明 |
|---|---|---|
| 认证 | `POST /api/auth/login` | 用户登录，返回 JWT |
| 认证 | `POST /api/auth/register` | 用户注册 |
| 场所 | `GET /api/places` | 分页查询，支持类型/关键字筛选 |
| 场所 | `GET /api/places/{id}` | 场所详情 |
| 日记 | `GET /api/diaries` | 分页查询日记 |
| 日记 | `GET /api/diaries/{id}` | 日记详情 |
| 设施 | `GET /api/facilities` | 按场所查询设施 |
| 设施 | `GET /api/facilities/nearby` | LBS 附近设施查询，不作为路径距离排序主接口 |

## 测试基线

当前测试环境使用 `src/test/resources/schema.sql` 和 `src/test/resources/data.sql` 初始化 H2 内存库，覆盖最小业务闭环：

- 导航：单目标、混合交通、多目标路径
- 场所查询：附近设施按路径距离排序
- 日记：标题检索、评分
- 算法：压缩/解压、敏感词过滤

执行：

```bash
mvn test
```

前端验证命令：

```bash
cd frontend
npm run build
npm run lint
```

当前发布门槛：

- `mvn test` 必须通过；
- `npm run build` 必须通过；
- `npm run lint` 最终应 repo-wide 通过；
- 业务页面不得依赖 404/405/501 fallback 伪造成功结果。

## 四 Agent 收尾计划

- **frontend lane**：迁移页面到 canonical API，删除业务 fallback，补齐美食排序、室内导航、AIGC 页面输入与错误态。
- **backend lane**：补齐美食评分/距离排序、日记推荐策略、AIGC 成功/失败契约和室内导航 canonical 返回结构。
- **test lane**：扩展 H2 夹具和 MockMvc 覆盖，补齐认证、推荐、美食、室内导航、日记 CRUD、AIGC、错误契约测试。
- **architect/review lane**：维护需求矩阵、canonical/legacy 策略、README/Swagger/开发日志与最终验收裁决。
