# 个性化旅游系统 Java 重构 — 开发日志 06

---

## 📅 2026-04-16 第六次开发：导航契约统一、路径距离设施查询与测试基线补齐

### 🎯 本次目标

对照 [`requirements_summary_from_images.md`](../requirements_summary_from_images.md) 与前五次开发结果，优先解决当前最影响“真实可交付”的三个问题：

1. 前后端路线规划接口契约不一致；
2. 附近设施查询仍主要按直线距离排序，不满足需求中“按可通行路径距离排序”的要求；
3. 测试仍停留在 `contextLoads()`，缺少可证明业务闭环的最小自动化验证。

本轮重点不是继续增加页面数量，而是把现有 Java 后端、前端页面和算法能力真正对齐，让导航、设施查询、日记搜索与算法能力具备稳定联调基础。

---

### ✅ 本次完成的需求映射

| 总需求 | 本次完成情况 |
|---|---|
| 旅游路线规划 | 前端正式切换对接 `/api/navigation/*`，单目标、多目标、混合交通路径规划接口统一 |
| 图形化展示 | 路线接口返回路径节点、分段信息、节点坐标，地图组件可直接渲染 |
| 场所查询 | `/api/facilities/nearest` 优先按道路图最短路径距离排序，并补充步行时间 |
| 旅游日记交流 | 修复标题精确检索链路，保证业务接口可直接命中数据 |
| 日记压缩存储 | 新增压缩/解压回归测试，验证 Huffman 链路可逆 |
| 核心算法验证 | 补齐导航、设施排序、日记检索、敏感词过滤的最小集成测试 |

---

### 🧩 后端补齐内容

#### 1. 路径规划接口返回结构统一

- 调整 `NavigationController`，让以下接口统一返回更适合前端消费的数据结构：
  - `POST /api/navigation/shortest-path`
  - `POST /api/navigation/mixed-vehicle-path`
  - `POST /api/navigation/multi-destination`
- 新增返回字段：
  - `path`
  - `segments`
  - `totalDistance`
  - `totalTime`
  - `vehicle`
  - `strategy`
  - `nodeCoordinates`
- 前端无需再猜测字段含义，也不必自己拼装路径段。

#### 2. 路网节点坐标能力补齐

- 扩展 `ShortestPathAlgorithm`：
  - 加载 `SpotBuilding`、`SpotFacility` 的坐标到内存图；
  - 暴露节点坐标查询能力；
  - 新增基于路径段的总时间计算方法。
- 这样前端地图不仅能展示建筑物/设施点，也能定位路径中的图节点。

#### 3. 附近设施查询从直线距离升级为路径距离

- 改造 `FacilityController#nearest`：
  - 若道路图已加载且建筑物、设施节点在图中存在，则直接用 `dijkstraDistanceOnly` 计算真实可通行路径距离；
  - 同时计算步行时间并返回；
  - 若图不可用，再回退到经纬度直线距离。
- `SpotFacility` 增加运行时字段：
  - `distance`
  - `travelTime`

这意味着“附近设施排序不能只按直线距离”的需求已经开始真正落地，而不是停留在算法储备层。

#### 4. 日记搜索链路稳定性修复

- 修复 `DiaryServiceImpl` 中日记搜索项构造逻辑，显式补全：
  - `id`
  - `title`
  - `placeId`
  - `authorId`
- 避免 `TravelDiary -> Map` 转换后字段缺失，导致标题索引构建为空。

---

### 🖥️ 前端打通内容

#### 1. 路线规划 API 正式切换到 Java 导航接口

- `frontend/src/services/api.js` 中的路径规划调用不再依赖旧的：
  - `/routes/single`
  - `/routes/multi`
- 改为直接对接：
  - `/navigation/shortest-path`
  - `/navigation/mixed-vehicle-path`
  - `/navigation/multi-destination`

#### 2. 前端增加导航结果归一化

- 新增路线响应归一化逻辑，把后端返回统一整理成页面层稳定消费的结构：
  - `total_distance`
  - `total_time`
  - `detailed_info.segments`
  - `algorithm_name`
  - `available_vehicles`
  - `nodeCoordinates`

#### 3. 地图组件支持后端节点坐标

- `RouteMap.jsx` 现在会优先读取后端返回的 `nodeCoordinates`；
- 即使路径节点不是建筑物/设施本身，也能绘制到地图上；
- 为路线规划页后续做更细粒度的路径动画和路线段点击交互打下基础。

---

### 📄 本次新增 / 重点修改文件

#### 新增

- `src/test/resources/schema.sql`
- `src/test/resources/data.sql`
- `src/test/java/com/tourism/NavigationFacilityIntegrationTests.java`
- `src/test/java/com/tourism/DiaryAlgorithmIntegrationTests.java`
- `DEV-PLAN/DEV_LOG06.md`

#### 重点修改

- `src/main/java/com/tourism/controller/NavigationController.java`
- `src/main/java/com/tourism/controller/FacilityController.java`
- `src/main/java/com/tourism/algorithm/ShortestPathAlgorithm.java`
- `src/main/java/com/tourism/model/entity/SpotFacility.java`
- `src/main/java/com/tourism/service/impl/DiaryServiceImpl.java`
- `frontend/src/services/api.js`
- `frontend/src/components/RouteMap.jsx`
- `src/test/resources/application.yml`
- `README.md`

---

### 🧪 验证结果

#### 后端

```bash
mvn test
```

结果：

```text
BUILD SUCCESS
Tests run: 9, Failures: 0, Errors: 0, Skipped: 0
```

本轮新增覆盖：

- 单目标路径规划
- 混合交通工具路径规划
- 多目标路径规划
- 附近设施路径距离排序
- 日记标题搜索
- 日记评分
- Huffman 压缩/解压回环
- AC 自动机敏感词过滤

#### 前端

```bash
npm run build
```

结果：

```text
vite build 成功
```

#### 前端静态检查

```bash
npm run lint
```

结果：

```text
未通过
```

说明：

- 当前前端仓库里存在较多历史遗留的 `no-unused-vars` 和 `react-hooks/exhaustive-deps` 问题；
- 本轮没有专门清仓这些风格问题，只验证了新增契约改动不会阻断前端生产构建。

---

### ⚠️ 当前已知问题 / 后续优化项

1. 前端 `eslint` 仍有较多历史遗留问题，虽然不影响当前 `vite build`，但后续若要把质量门槛提升到 CI 级别，需要专门做一轮前端清理。
2. 路径规划和设施查询已经打通，但推荐、美食、日记等页面仍有部分“后端已有能力、前端仍保留兜底逻辑”的情况，后续需要继续收口。
3. README 中“后续开发计划”部分仍保留早期阶段性表述，虽然本轮补充了当前联调接口和测试基线，但整个文档还可以进一步重构为真实现状说明。
4. 前端生产包体积依然偏大，`vite build` 给出 chunk size 警告，后续可以做路由级拆包。

---

### 🔮 下一步建议

1. 继续按需求文档推进推荐 / 搜索业务化收口，减少前端 fallback 分支，让页面完全依赖真实业务接口。
2. 为 AIGC 生成链路补失败降级测试和接口级验证，而不只验证上传/返回路径。
3. 做一轮前端 lint 清理，把当前历史遗留的 unused vars 和 hook 依赖问题集中处理，作为进入展示/验收前的质量收口。
4. 如果下一轮继续按多 agent 方式推进，建议优先分成三条并行线：
   - 推荐/搜索与日记业务接口收口
   - 前端页面联调与 fallback 清理
   - 文档、测试、验收矩阵补全
