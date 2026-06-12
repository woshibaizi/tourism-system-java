# 个性化旅游系统 Java 重构 — 开发日志 04

---

## 📅 2026-04-07 第四次开发：Python 算法库完整移植至 Java

### 🎯 需求背景

前三次开发已完成数据库迁移、后端 Controller 框架搭建以及前端 API 接入。本次目标是将原 Python 后端 `/backend/algorithms/` 目录下全部算法模块，移植为 Spring Boot 可用的 Java `@Component` 服务类，并通过 REST Controller 对外暴露，最终通过 `mvn compile` 编译验证。

**移植策略（双轨方案）：**
- **方案 A（无状态工具型）**：纯方法类，参数传入数据，无数据库依赖（Sorting、Search、Recommendation、ACAutomaton、HuffmanCompression、FibonacciHeap、TreapTopK）。
- **方案 B（图算法有状态型）**：注入 Mapper，`@PostConstruct` 启动时加载数据到内存图，所有请求复用（ShortestPath、IndoorNavigation）。

---

### 📝 本次新增 / 修改文件清单

#### 算法核心层（`com.tourism.algorithm`）

| 文件 | 操作 | 说明 |
|---|---|---|
| `FibonacciHeap.java` | 新增 | 斐波那契堆，用于优化 A* / Dijkstra 优先队列性能 |
| `TreapTopK.java` | 新增 | Treap 树维护 Top-K 结构，用于推荐系统高效排序 |
| `ACAutomaton.java` | 新增 | Aho-Corasick 多模式字符串匹配，用于日记敏感词过滤 |
| `HuffmanCompression.java` | 新增 | Huffman 编码无损压缩，用于日记内容存储压缩（Base64 序列化） |
| `SortingAlgorithm.java` | 新增 | 快速排序、堆排序、归并排序、Top-K 选择 + 场所/日记/设施业务排序逻辑 |
| `SearchAlgorithm.java` | 新增 | 二分查找、Jaccard 模糊搜索、TF-IDF 全文检索、哈希索引搜索、统一搜索入口 |
| `RecommendationAlgorithm.java` | 新增 | 内容过滤推荐、协同过滤推荐、混合推荐、热度推荐，支持场所/日记两类业务 |
| `ShortestPathAlgorithm.java` | 新增 | A* 算法（指定交通工具）、纯距离 Dijkstra、混合交通工具 Dijkstra、TSP 四种求解器（最近邻/DP/模拟退火/遗传算法）、多目标路径规划；方案 B，Mapper 注入 + `@PostConstruct` 内存图 |
| `IndoorNavigationAlgorithm.java` | 新增 | 从 `indoor_navigation.json` 加载室内节点图，时间权重/距离权重 Dijkstra，电梯/楼梯楼层切换时间建模，导航步骤生成；方案 B |

#### REST 控制器层（`com.tourism.controller`）

| 文件 | 操作 | 说明 |
|---|---|---|
| `NavigationController.java` | 新增 | 户外路径规划（单目标 A*、混合交通、TSP 多目标、图重载）+ 室内导航（到房间、房间列表、建筑信息）共 7 个接口 |
| `AlgorithmController.java` | 新增 | 搜索（统一/模糊/TF-IDF）、推荐（场所/日记/热度）、Huffman 压缩/解压/统计、AC 自动机构建/过滤/搜索、场所/日记排序，共 12 个接口 |

#### 数据资源

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/main/resources/data/indoor_navigation.json` | 新增 | 从 Python 项目复制，室内导航节点与连接数据 |

---

### 🐛 编译期 Bug 修复

| 问题 | 位置 | 修复方式 |
|---|---|---|
| 混合交通 Dijkstra `previous` map 类型错误 | `ShortestPathAlgorithm.java:386` | `Map<String, Map<String, Object[]>>` → `Map<String, Object[]>` |
| 中文全角引号嵌入 Java 字符串字面量导致语法错误 | `SearchAlgorithm.java:216` | 替换为 `[\s\p{Punct}，。！？、；：【】（）]+` |
| 未使用的局部变量 `ratingCount` | `SortingAlgorithm.java:260` | 删除该变量声明 |
| `Result` 类路径引用错误 | `NavigationController.java` / `AlgorithmController.java` | `com.tourism.model.common.Result` → `com.tourism.utils.Result`，方法名 `error()` → `fail()` |

---

### ✅ 验证结果

```
mvn compile → BUILD SUCCESS
```

- 全部 9 个算法类 + 2 个 Controller 编译通过
- 无 Classpath 缺失、无类型不兼容错误
- 警告均为 Eclipse JDT 空安全标注（null type safety），不影响运行时

---

### 📐 架构设计说明

#### API 总览（新增接口）

```
POST /api/navigation/shortest-path          # A* / Dijkstra 单目标
POST /api/navigation/mixed-vehicle-path     # 混合交通工具最优时间
POST /api/navigation/multi-destination      # TSP 多目标路径规划
POST /api/navigation/reload-graph           # 管理：重新加载路图
POST /api/navigation/indoor                 # 室内导航到房间
GET  /api/navigation/indoor/rooms           # 全部房间列表
GET  /api/navigation/indoor/rooms/floor/{n} # 按楼层查询房间
GET  /api/navigation/indoor/building-info   # 建筑物信息

POST /api/algorithm/search                  # 统一搜索
POST /api/algorithm/search/fuzzy            # 模糊搜索
POST /api/algorithm/search/fulltext         # TF-IDF 全文搜索
POST /api/algorithm/recommend/places        # 场所推荐
POST /api/algorithm/recommend/diaries       # 日记推荐
POST /api/algorithm/recommend/popular       # 热度推荐
POST /api/algorithm/compress                # Huffman 压缩
POST /api/algorithm/decompress              # Huffman 解压
POST /api/algorithm/compression-stats       # 压缩统计
POST /api/algorithm/ac-automaton/build      # 构建敏感词库
POST /api/algorithm/filter-text             # 敏感词过滤
POST /api/algorithm/ac-automaton/search     # 多模式文本搜索
POST /api/algorithm/sort/places             # 场所综合排序
POST /api/algorithm/sort/diaries            # 日记相关度排序
```

---

### 🔮 下次开发计划

#### 优先级：极高

1. **前端路线规划页面接入（`RoutePage`）**
   - `RoutePage` 已有 UI，但后端路径规划接口此前不存在；现在 `NavigationController` 已实现，下一步在前端 `api.js` 增加对 `/api/navigation/shortest-path` 和 `/api/navigation/multi-destination` 的调用封装，完成路线规划功能的前后端打通。

2. **室内导航页面接入（`IndoorNavigationPage`）**
   - 前端 `IndoorNavigationPage.jsx` 已存在（LOG03 中已将请求收口到 `/api`），目前服务端是 404；现在 `NavigationController` 室内导航接口已实现，直接接入即可，重点验证楼层切换显示与步骤渲染。

#### 优先级：高

3. **推荐与搜索功能接入**
   - 首页热度推荐：调用 `/api/algorithm/recommend/popular` 替换现有前端本地排序逻辑。
   - 搜索页：将关键词输入接入 `/api/algorithm/search`，支持模糊 + TF-IDF 混合搜索。
   - 日记页：调用 `/api/algorithm/recommend/diaries` 接入个性化日记推荐。

4. **日记内容压缩存储**
   - 后端 `DiaryService` 的新建/更新日记方法，接入 `HuffmanCompression.compressDiaryContent()`，将日记正文压缩后存储到数据库，读取时解压，降低存储空间。

5. **敏感词过滤中间件**
   - 在日记/评论的保存接口中，注入 `ACAutomaton` 进行内容检测，在 `Service` 层拦截含敏感词内容，返回友好提示。

#### 优先级：中

6. **全栈联调压测**
   - 并发测试页（`ConcurrencyTestPage`）接入算法接口压测，尤其是 TSP 遗传算法（`genetic_algorithm`）在目标点 > 20 时的响应时间验证。
   - 验证 `ShortestPathAlgorithm` 的 `@PostConstruct` 图加载时间，确保不影响 Spring Boot 启动速度（可考虑异步加载）。

7. **Spring Security + JWT 鉴权加固**
   - 当前导航和算法接口未鉴权，需在 `SecurityConfig` 中将管理类接口（如 `/api/navigation/reload-graph`）限制为 ADMIN 角色访问。
