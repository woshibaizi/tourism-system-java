# 个性化旅游系统 Java 重构 — 开发日志 07

---

## 📅 2026-04-16 第七次开发：四 Agent 收尾契约冻结与验收矩阵补齐

### 🎯 本次目标

本轮作为四 Agent 收尾阶段的 architect/doc lane，只做文档和契约裁决，不修改前端、后端或测试代码。

目标是把当前开发进度从“功能陆续补齐”整理成可执行、可验收、可审查的收尾标准：

1. 冻结正式业务 API 与兼容接口边界；
2. 建立需求到页面、API、测试的映射矩阵；
3. 更新 README，让后续开发只围绕真实现状推进；
4. 为 frontend、backend、test lane 提供明确的合并门槛。

---

### ✅ 本次完成的需求映射

| 总需求 | 本次完成情况 |
|---|---|
| 旅游推荐 | 明确场所推荐、搜索、排序的 canonical API 与待补测试 |
| 旅游路线规划 | 固定 `/api/navigation/*` 为正式契约，`/api/routes/*` 仅兼容 |
| 场所查询 | 固定 `/api/facilities/nearest` 为路径距离排序主接口 |
| 旅游日记管理 | 明确日记 CRUD、搜索、推荐、评分的验收测试缺口 |
| 旅游日记交流 | 明确标题检索、全文检索、目的地排序、压缩存储、AIGC 的页面/API/测试映射 |
| 美食推荐 | 明确 `GET /api/foods` 是列表、过滤、模糊查询、排序主接口 |

---

### 🧩 架构决策

#### 1. Canonical API 与 Legacy API 分层

本轮明确区分三类接口：

- Canonical API：正式业务接口，前端页面、README、Swagger、测试优先使用；
- Legacy API：兼容旧页面或旧调用方的薄适配接口，只保留兼容，不新增能力；
- Algorithm API：算法演示、调试、统计辅助接口，不作为核心业务页面主依赖。

#### 2. 导航契约冻结

正式导航接口固定为：

- `POST /api/navigation/shortest-path`
- `POST /api/navigation/mixed-vehicle-path`
- `POST /api/navigation/multi-destination`
- `POST /api/navigation/indoor`
- `GET /api/navigation/indoor/rooms`
- `GET /api/navigation/indoor/building-info`

`/api/routes/*` 和 `/api/indoor/*` 只作为兼容层保留。删除前必须满足：前端零调用、文档不再作为主接口描述、人工 smoke 通过。

#### 3. 设施查询契约冻结

页面主路径固定为：

- `POST /api/facilities/nearest`

该接口必须按可通行路径距离排序。`GET /api/facilities/nearby` 保留为 LBS/调试接口，不作为需求中的“附近设施排序”验收依据。

#### 4. 业务页面不再依赖算法演示接口

`AlgorithmController` 保留为算法辅助面，例如压缩、解压、敏感词过滤和调试类能力。

推荐、搜索、排序等核心业务页面应使用领域 controller：

- `PlaceController`
- `FoodController`
- `DiaryController`
- `NavigationController`
- `FacilityController`

---

### 📄 本次新增 / 重点修改文件

#### 新增

- `DEV-PLAN/REQUIREMENTS_API_TEST_MATRIX.md`
- `DEV-PLAN/DEV_LOG07.md`

#### 重点修改

- `README.md`

---

### 🧪 验收矩阵

新增 `REQUIREMENTS_API_TEST_MATRIX.md`，固定以下映射关系：

- 需求域 -> 需求点
- 需求点 -> 页面
- 页面 -> Canonical API
- Canonical API -> 自动化测试证据
- 当前状态 -> 已打通 / 待收口 / 待补测

该矩阵同时记录 legacy API 删除条件和 architect 决策，后续 frontend、backend、test lane 应以该矩阵作为合并依据。

---

### 🧪 验证结果

本轮只修改文档，未运行后端或前端构建。

应由后续 test lane 执行：

```bash
mvn test
```

```bash
cd frontend
npm run build
npm run lint
```

---

### ⚠️ 当前已知问题 / 后续优化项

1. 美食评分/距离排序仍需要 backend lane 补齐字段、查询逻辑和测试。
2. 室内导航页面仍需 frontend lane 全量迁移到 `/api/navigation/indoor*`。
3. AIGC 当前需要 backend lane 明确实际输出格式，不能让 `outputFormat=mp4` 静默返回 GIF。
4. 前端还需要删除 404/405/501 时的业务 fallback，避免页面伪成功。
5. `npm run lint` 仍是最终发布门槛，不能作为长期可忽略项。

---

### 🔮 下一步建议

1. test lane 先根据矩阵补 contract-first 测试和 H2 夹具。
2. backend lane 按测试期望补齐 food、diary、AIGC、indoor navigation 的 canonical 能力。
3. frontend lane 迁移页面到 canonical API，并删除业务 fallback。
4. architect/review lane 在每轮合并前检查矩阵状态，不允许新增未批准的 legacy surface。
