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

## 已实现接口（第一步阶段）

| 模块 | 接口 | 说明 |
|---|---|---|
| 认证 | `POST /api/auth/login` | 用户登录，返回 JWT |
| 认证 | `POST /api/auth/register` | 用户注册 |
| 场所 | `GET /api/places` | 分页查询，支持类型/关键字筛选 |
| 场所 | `GET /api/places/{id}` | 场所详情 |
| 日记 | `GET /api/diaries` | 分页查询日记 |
| 日记 | `GET /api/diaries/{id}` | 日记详情 |
| 设施 | `GET /api/facilities` | 按场所查询设施 |
| 设施 | `GET /api/facilities/nearby` | LBS 附近设施查询 |

## 后续开发计划

- **第二步**：完善用户CRUD、场所管理接口、日记发布/点赞
- **第三步**：A* 路径规划、TSP 多点路线、Redis 缓存热点数据
- **第四步**：协同过滤推荐算法、AIGC 日记生成、并发压测
