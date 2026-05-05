# 个性化旅游系统 Java 版 — 开发日志

---

## 📅 2026-04-27 第四次开发：LBS 查询深化、接口容错与算法预研准备

### 🎯 需求背景

在 Week 5 完成数据库底座、Week 6 打通核心查询接口与认证链路、Week 7 完成页面接口联调和基础结果结构核对之后，本周开发重点继续向“LBS 查询深化、接口容错与算法预研准备”推进。

上一阶段已经明确：当前 Java 后端具备场所、日记、设施、认证等基础接口，但前端旧项目仍保留推荐、路线规划、上传、统计、最近设施等未由 Java 主工程完整实现的接口。因此 Week 8 的重点不是提前完成复杂算法，而是围绕当前真实源码继续打磨已有能力，并为后续推荐和导航能力准备接口边界。

本周工作重点：

1. 深化 `FacilityController#nearby` 与 `GeoUtils.distance(...)` 支撑的附近设施查询；
2. 继续观察 `PlaceController#list` 的分页、类型筛选和关键字搜索稳定性；
3. 继续核对 `DiaryController#list/detail` 的分页、按场所筛选和详情空结果处理；
4. 继续完善 `Result<T>` 与 `GlobalExceptionHandler` 的异常容错口径；
5. 检查 `SecurityConfig` 中公开接口和受保护接口的访问边界；
6. 梳理前端 `RouteMap.js`、路线页面和推荐相关页面未来需要的字段；
7. 将推荐、路径规划、Agent / Skill 编排作为后续预研方向，不写成已实现。

> **说明**：本周的“算法预研”主要指围绕已有 `GeoUtils.distance(...)`、`GeoUtils.heuristic(...)` 和前端路线展示需求做接口设计准备；A*、Dijkstra、TSP、推荐算法和 SkillRegistry 均未在当前 Java 主工程中落地。

---

### 🧱 本周建设范围

本周围绕已存在的查询接口和工具类做深化整理，重点关注 LBS 查询、分页查询、异常容错、安全边界和后续算法字段准备。

| 模块 | 对应文件 | 本周进展 | 说明 |
|---|---|---|---|
| LBS 附近设施查询 | `FacilityController` / `GeoUtils` | 深化整理 | 基于经纬度、半径和设施类型筛选附近设施 |
| 场所分页与筛选 | `PlaceController` / `PlaceMapper` | 稳定性观察 | 继续使用 MyBatis-Plus 分页、类型筛选、关键字匹配和热度排序 |
| 日记分页与详情 | `DiaryController` / `DiaryMapper` | 容错核对 | 继续支持分页、`placeId` 筛选和详情 404 返回 |
| 统一响应结构 | `Result<T>` | 持续使用 | 继续约束成功和失败返回格式 |
| 异常处理 | `GlobalExceptionHandler` / `BusinessException` | 持续收口 | 业务异常、参数异常、认证异常、权限异常和兜底异常统一输出 |
| 安全边界 | `SecurityConfig` / `JwtAuthenticationFilter` | 持续核对 | 场所、日记 GET 公开；其他接口默认需要登录 |
| 前端路线字段预研 | `RouteMap.js` / `api.js` | 字段梳理 | 前端已有地图展示组件，但 Java 后端尚未提供路线规划接口 |
| 测试覆盖现状 | `src/test/` | 风险识别 | 当前仅有基础启动测试，接口与 LBS 逻辑测试仍待补充 |

---

### 📝 本次修改文件清单

#### 1) 后端接口与工具类核对范围

| 文件 | 当前状态 | 本周说明 |
|---|---|---|
| `controller/FacilityController.java` | 已存在 | 重点核对附近设施查询逻辑和半径过滤方式 |
| `utils/GeoUtils.java` | 已存在 | `distance(...)` 用于 LBS 距离计算，`heuristic(...)` 作为后续路径预研辅助 |
| `controller/PlaceController.java` | 已存在 | 继续核对分页、类型筛选、关键字搜索和详情空结果 |
| `controller/DiaryController.java` | 已存在 | 继续核对分页、按场所筛选和详情空结果 |
| `controller/AuthController.java` | 已存在 | 认证入口继续作为受保护接口联调基础 |
| `utils/Result.java` | 已存在 | 继续统一 `code/message/data` |
| `exception/GlobalExceptionHandler.java` | 已存在 | 继续统一异常返回结构 |
| `config/SecurityConfig.java` | 已存在 | 继续检查公开接口和受保护接口边界 |
| `config/MybatisPlusConfig.java` | 已存在 | 继续支撑分页插件和时间字段自动填充 |
| `src/main/resources/application.yml` | 已存在 | 继续提供端口、数据库、Redis、JWT、Swagger 配置 |

#### 2) 前端预研与联调参考范围

| 文件 | 当前用途 | 本周说明 |
|---|---|---|
| `frontend/src/services/api.js` | 前端 API 封装 | 仍保留推荐、路线规划、上传、统计等 Java 后端尚未完整实现的调用 |
| `frontend/src/components/RouteMap.js` | 路线地图展示组件 | 用于梳理未来路径接口字段，如 `path`、`segments`、`distance`、`time`、`vehicle` |
| `frontend/src/pages/RoutePage.js` | 路线页面 | 作为后续路径规划接口设计参考 |
| `frontend/src/pages/PlacesPage.js` | 场所列表页 | 继续作为分页、搜索、推荐字段差异参考 |
| `frontend/src/pages/FacilityQueryPage.js` | 设施查询页 | 继续作为 LBS / 最近设施接口差异参考 |

#### 3) 测试目录现状

| 文件 | 当前状态 | 说明 |
|---|---|---|
| `src/test/java/com/tourism/TourismApplicationTests.java` | 已存在 | 当前仅包含 `contextLoads()` 基础启动测试 |
| `src/test/resources/application.yml` | 已存在 | 测试环境配置文件存在 |

> 当前源码中未发现 `algorithm/RecommendationAlgorithm.java`、`algorithm/SearchAlgorithm.java`、`algorithm/ShortestPathAlgorithm.java`、`algorithm/IndoorNavigationAlgorithm.java`、`algorithm/HuffmanCompression.java`、`algorithm/ACAutomaton.java`、`algorithm/TreapTopK.java`、`algorithm/FibonacciHeap.java`、`NavigationController`、`LegacyNavigationController`、`AlgorithmController`、`MediaController`、`AigcService`、成熟 `SkillRegistry` 或完整 Travel Agent 调度器，因此本周不记录这些内容为已完成。

---

### 🧠 本轮开发的核心产出

本周工作的核心，是在已有基础接口上进一步识别稳定性、容错和后续复杂能力的接口需求。

1. **LBS 附近设施查询链路进一步明确**  
   `FacilityController#nearby(...)` 当前通过 `lat`、`lng`、`radius`、`type` 作为入参，先按设施类型查询候选数据，再用 `GeoUtils.distance(...)` 计算两点间球面距离，最终返回半径范围内的设施列表。

2. **分页查询稳定性继续观察**  
   `PlaceController#list(...)` 与 `DiaryController#list(...)` 均使用 MyBatis-Plus `Page<T>` 作为分页输出基础。Week 8 继续明确分页接口的参数、排序和前端消费风险，为 Week 9 更深层的结果结构收敛做准备。

3. **资源不存在场景继续收敛**  
   `PlaceController#detail(...)` 和 `DiaryController#detail(...)` 在查不到资源时返回 `Result.fail(404, ...)`。这为前端详情页的空态、错误态展示提供了更明确的判断基础。

4. **统一响应和异常处理继续作为全局约束**  
   `Result<T>` 和 `GlobalExceptionHandler` 已经成为 Java 后端接口风格的核心约束。本周继续围绕 `code/message/data`、参数错误、认证失败、权限失败、业务失败等场景梳理联调口径。

5. **安全访问边界继续明确**  
   `SecurityConfig` 当前公开 `/api/auth/**`、GET `/api/places/**`、GET `/api/diaries/**` 和 Swagger；其他接口默认需要认证。Week 8 继续识别设施接口联调时可能需要 Token 或公开策略调整。

6. **后续路线规划字段开始预研**  
   前端 `RouteMap.js` 已经体现出未来路线接口可能需要的 `path`、节点坐标、分段、距离、时间、交通方式等字段。本周只做字段预研，不写路径算法已实现。

7. **性能风险开始被识别**  
   当前附近设施查询采用“查询候选设施 + Java 内存距离过滤”的方式，适合早期验证；当设施数据量扩大时，需要考虑数据库侧经纬度范围预筛选、空间索引或分页策略。本周仅识别风险，不宣称完成压力测试。

---

### ✅ 验证结果

- 已核对 Week 5、Week 6、Week 7 周报，确认 Week 8 应承接到 LBS、分页、容错和预研准备，而不是直接进入成熟算法攻坚。
- 已核对 `FacilityController#nearby(...)`，确认当前真实存在附近设施查询逻辑。
- 已核对 `GeoUtils.distance(...)`，确认其使用 Haversine 公式计算两点球面距离。
- 已核对 `GeoUtils.heuristic(...)`，确认其当前只是复用 `distance(...)`，可作为后续路径规划启发函数预留。
- 已核对 `PlaceController#list(...)`，确认支持分页、类型筛选、关键字搜索和按 `clickCount` 降序。
- 已核对 `DiaryController#list(...)` 与 `DiaryController#detail(...)`，确认支持分页、按 `placeId` 筛选和详情不存在返回 404。
- 已核对 `Result`、`GlobalExceptionHandler`、`SecurityConfig`、`JwtAuthenticationFilter`，统一响应、异常处理和认证边界仍与前几周口径一致。
- 已核对 `src/test/`，当前仅有基础启动测试，接口级和 LBS 逻辑测试仍待补充。
- 已核对 `RouteMap.js` 和 `api.js`，前端存在路线展示与路线接口调用需求，但 Java 后端尚未落地对应 Controller。
- 当前未发现推荐、搜索、路径规划、室内导航、压缩、过滤、Top-K、Fibonacci 堆、AIGC、多媒体上传或 SkillRegistry 相关 Java 源码，因此本周不记录为已完成。

> 本次验证以源码阅读和文件结构核对为主。由于当前运行环境未识别到 `mvn` 命令，本周不宣称 `mvn compile`、`mvn test`、压力测试或完整前后端联调已通过。

---

### 🔍 技术实现细节

#### 1) LBS 附近设施查询

`FacilityController#nearby(...)` 当前入参包括：

- `lat`
- `lng`
- `radius`
- `type`

当前处理流程：

- 使用 `LambdaQueryWrapper<SpotFacility>` 构造候选设施查询；
- 如果 `type` 不为空，则先按设施类型过滤；
- 读取候选设施列表；
- 过滤掉缺少经纬度的设施；
- 使用 `GeoUtils.distance(lat, lng, facilityLat, facilityLng)` 计算距离；
- 返回距离小于等于 `radius` 的设施集合。

这一逻辑已经能支撑“当前位置附近有什么设施”的基础查询，但还不是路线规划，也不包含道路拓扑、步行时间或可达路径计算。

#### 2) `GeoUtils.distance(...)` 与 `GeoUtils.heuristic(...)`

`GeoUtils.distance(...)` 使用 Haversine 公式计算两个经纬度点之间的球面距离，单位为米。该方法适合用于附近设施半径过滤。

`GeoUtils.heuristic(...)` 当前直接复用 `distance(...)`，可作为未来 A* 路径规划启发函数的接口预留。但当前 Java 主工程中尚未发现 A* 或 Dijkstra 算法实现，因此不能写成路径算法已完成。

#### 3) 场所分页、筛选和关键字搜索

`PlaceController#list(...)` 当前使用：

- `Page<SpotPlace>` 提供分页；
- `type` 对 `SpotPlace::getType` 做精确筛选；
- `keyword` 对 `name`、`keywords`、`description` 做模糊匹配；
- `orderByDesc(SpotPlace::getClickCount)` 提供默认热度排序。

当前需要继续观察的点：

- 前端旧代码是否传递 `page`、`size`，还是前端自行分页；
- `keyword` 对 JSON 字符串字段 `keywords` 的模糊匹配是否满足展示需求；
- 返回 `Page<T>` 后前端是否能正确读取 `records`、`total` 等分页字段。

#### 4) 日记分页、筛选和空结果

`DiaryController#list(...)` 当前使用：

- `Page<TravelDiary>` 提供分页；
- `placeId` 做场所维度筛选；
- `orderByDesc(TravelDiary::getCreatedAt)` 默认按创建时间倒序。

`DiaryController#detail(...)` 查不到日记时返回：

```json
{
  "code": 404,
  "message": "日记不存在",
  "data": null
}
```

这使前端详情页能够区分“资源不存在”和“网络请求失败”，但仍需要前端适配 `code/message/data`。

#### 5) 统一异常处理

`GlobalExceptionHandler` 当前覆盖：

- `BusinessException`
- `MethodArgumentNotValidException`
- `AuthenticationException`
- `AccessDeniedException`
- 通用 `Exception`

本周重点是确认这些异常都能通过 `Result<Void>` 返回，让前端在参数缺失、未登录、无权限、业务失败等场景下得到统一格式。

#### 6) 前端路线字段预研

`RouteMap.js` 中已经能看出未来路线结果可能需要：

- `path`
- `detailed_info.segments`
- 节点 ID 与坐标；
- 分段距离；
- 分段时间；
- 交通方式；
- 起点、终点、途经点；
- 建筑物和设施坐标映射。

Week 8 只把这些内容整理为未来路线接口的字段参考，不写成 `NavigationController`、`ShortestPathAlgorithm` 或 TSP 已经完成。

---

### ⚠️ 当前阻塞点与优化方向

#### 1) 附近设施查询存在内存过滤风险

当前 `FacilityController#nearby(...)` 会先查出候选设施，再在 Java 内存中计算距离并过滤。数据量较小时实现简单清晰，但设施数量增大后可能带来性能压力。

**优化方向：**

- 增加经纬度范围预筛选；
- 评估数据库空间索引；
- 增加分页或最大返回条数；
- 对常用设施类型查询考虑缓存策略。

#### 2) 前端设施页面与后端 LBS 接口仍不完全一致

前端 `FacilityQueryPage` 当前偏向“选择建筑物后查询最近设施”，而 Java 后端已有的是“给定经纬度和半径查询附近设施”。

**优化方向：**

- 若保留建筑物到最近设施逻辑，需要新增建筑查询接口和最近设施接口；
- 若优先使用当前后端能力，需要改造前端入参为经纬度、半径和设施类型；
- 先明确页面交互模型，再决定接口扩展方式。

#### 3) 分页结果与前端消费结构仍需适配

Java 后端返回 MyBatis-Plus `Page<T>`，前端旧代码多处把 `response.data` 当成普通数组。

**优化方向：**

- 在前端统一适配 `records`、`total`、`current`、`size`；
- 或后端新增更稳定的分页 VO；
- 保持各列表接口分页格式一致。

#### 4) 安全公开边界仍需按页面调整

`SecurityConfig` 公开了场所和日记 GET 接口，但设施 GET 接口当前不在公开白名单中。若设施查询页需要匿名访问，可能会在联调中遇到 401。

**优化方向：**

- 明确设施查询是否公开；
- 若公开，则调整 `SecurityConfig`；
- 若需要登录，则前端请求拦截器补充 Token。

#### 5) 测试覆盖仍不足

当前 `src/test/` 只有基础 `contextLoads()` 测试，尚未覆盖分页查询、LBS 距离过滤、资源不存在、认证异常等关键场景。

**优化方向：**

- 增加 `GeoUtils.distance(...)` 单元测试；
- 增加 Controller 层基础接口测试；
- 增加空结果和 404 场景测试；
- 后续再考虑集成测试和性能观察。

#### 6) 推荐、路径规划、Skill 编排仍是预研

当前 Java 主工程未落地推荐算法、路径规划 Controller、算法包或 SkillRegistry。

**优化方向：**

- 先设计推荐结果和路线结果 DTO / VO；
- 先明确前端需要的字段；
- 等基础接口和测试稳定后，再分阶段落地推荐和导航实现。

---

### 🔮 下次开发计划

#### 优先级高

1. **继续收敛基础结果结构**
   - 场所列表分页结果
   - 日记列表分页结果
   - 设施列表和附近设施结果
   - 资源不存在和参数错误返回

2. **补齐前端对 `Result<T>` 和分页结构的适配**
   - 统一处理 `code === 200`
   - 兼容 MyBatis-Plus `Page<T>` 的 `records`、`total`、`current`、`size`
   - 继续清理旧的 `success` 判断

3. **深化 LBS 查询接口**
   - 明确附近设施是否公开访问
   - 增加半径默认值、最大值和参数校验策略
   - 评估经纬度范围预筛选

#### 优先级中

4. **准备路线规划接口设计**
   - 根据 `RouteMap.js` 整理路径结果字段
   - 设计路径节点、分段、距离、时间、交通方式结构
   - 暂不提前声明 A*、Dijkstra、TSP 已实现

5. **准备推荐接口设计**
   - 根据场所、日记页面需求整理推荐候选字段
   - 明确推荐输入是否来自用户行为、兴趣标签和场所特征
   - 暂不提前声明推荐算法已完成

6. **补充基础测试**
   - `GeoUtils.distance(...)`
   - 场所分页和关键字查询
   - 日记分页和详情 404
   - 附近设施半径过滤
   - 认证和权限异常返回

#### 后续改进

7. **继续梳理 Agent / Skill 边界**
   - 先统一输入输出协议
   - 再评估是否需要 Skill 注册或调度层
   - 避免在基础接口未稳定前引入过重架构

8. **为 Week 9 前端深度对接做准备**
   - 继续整理前端旧接口清单
   - 继续统一接口字段命名
   - 继续明确哪些能力保留、替换或延后

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
│           │   ├── PlacesPage.js
│           │   ├── PlaceDetailPage.js
│           │   ├── DiariesPage.js
│           │   ├── DiaryDetailPage.js
│           │   ├── FacilityQueryPage.js
│           │   └── RoutePage.js
│           └── services/
│               └── api.js
└── tourism-system-java/
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

如果说 Week 7 的重点是把基础接口放到前端页面语境下检查，那么 Week 8 的重点就是继续深化其中最现实的 LBS 查询、分页查询和异常容错，并为后续推荐和路径规划做接口预研。

本次推进后，项目已经进一步明确：

- `FacilityController#nearby` 和 `GeoUtils.distance(...)` 是当前真实存在的 LBS 查询基础；
- `PlaceController#list`、`DiaryController#list/detail` 是当前页面联调最核心的查询接口；
- `Result<T>` 和 `GlobalExceptionHandler` 仍是结果结构和异常容错的主要约束；
- `SecurityConfig` 的公开/受保护接口边界需要继续结合页面联调调整；
- `RouteMap.js` 已经提供未来路径结果字段参考，但 Java 后端尚未落地导航 Controller 或路径算法；
- 推荐、路线规划、Agent / Skill 编排仍处于接口设计和预研阶段。

当前仍待处理：

- 附近设施查询的性能风险；
- 分页结果与前端数组结构的适配；
- 设施接口是否公开访问；
- LBS、分页、详情、异常场景的测试覆盖；
- 推荐、导航和 Skill 相关能力的真实源码落地。

下一阶段将围绕“**基础结果结构继续收敛、前端深度对接准备、LBS 查询优化和复杂能力接口边界设计**”继续推进。
