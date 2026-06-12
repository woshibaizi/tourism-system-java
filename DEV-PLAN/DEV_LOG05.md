# 个性化旅游系统 Java 重构 — 开发日志 05

---

## 📅 2026-04-08 第五次开发：需求对齐收口与全栈功能打通

### 🎯 本次目标

对照 [`requirements_summary_from_images.md`](../requirements_summary_from_images.md) 与前四次开发日志，补齐 Java 版本当前仍缺失的核心能力，并完成一次后端测试 + 前端构建验证，确认 `tourism-system-java` 已能够承接原 Python 项目的主要功能闭环。

本轮重点不再是“继续搭框架”，而是把已经迁移过来的算法、页面、接口真正接起来，让前端页面不再停留在占位状态。

---

### ✅ 本次完成的需求映射

| 总需求 | 本次完成情况 |
|---|---|
| 景点推荐 | 新增 Java 端个性化推荐接口 `/api/places/recommend`，并补齐评分接口 `/api/places/{id}/rate` |
| 路线规划 | 为前端旧页面补齐兼容接口 `/api/routes/single`、`/api/routes/multi`，直接复用 Java 路径规划算法 |
| 附近设施查询 | 既有功能保留，本轮未新增但已纳入整体联调路径 |
| 游记管理 | 新增游记 CRUD、搜索、推荐、评分、敏感词过滤、正文压缩存储与解压读取 |
| 美食推荐 / 搜索 | 新增统一美食查询接口 `/api/foods` 与菜系列表接口 `/api/foods/cuisines` |
| 室内导航 | 新增旧接口兼容层 `/api/indoor/*`，打通室内导航页面 |
| AIGC 动画 | 新增图片上传、动画生成、静态资源访问链路，页面从占位恢复为可用状态 |

---

### 🧩 后端补齐内容

#### 1. 游记能力补全

- 扩展 `DiaryService` / `DiaryServiceImpl`，新增：
  - 游记创建、更新、删除
  - 游记搜索（标题 / 内容 / 目的地）
  - 个性化推荐
  - 游记评分
- 游记正文接入 Huffman 压缩存储，读取时自动解压。
- 在保存游记时接入 `ACAutomaton` 做敏感词检测。
- 查看游记详情时自动累计浏览量。

#### 2. 推荐、评分与统计联动

- `PlaceController` 新增推荐、排序、评分接口。
- `UserBehaviorServiceImpl` 增加评分聚合逻辑，写入用户行为后自动回刷景点 / 游记平均分与评分人数。
- 浏览行为与评分行为开始参与后续推荐数据闭环。

#### 3. 美食与媒体接口补齐

- `FoodController` 新增统一列表查询、模糊搜索、排序、菜系列表接口。
- 新增 `MediaController`：
  - `POST /api/upload/image`
  - `POST /api/upload/video`
  - `POST /api/aigc/convert-to-video`
- 新增 `AigcService` 与 `scripts/generate_aigc_gif.py`，在当前环境无 `ffmpeg` / `opencv` 时，先用 Pillow 生成 GIF 动画，确保链路可运行。

#### 4. 兼容旧前端 API

- 新增 `LegacyNavigationController`，提供：
  - `POST /api/routes/single`
  - `POST /api/routes/multi`
  - `GET /api/indoor/building`
  - `GET /api/indoor/rooms`
  - `POST /api/indoor/navigate`
- 这样前端已有页面无需整体重写，即可直接切到 Java 后端。

#### 5. 资源访问与配置兜底

- 新增 `WebMvcConfig`，把上传目录映射为 `/api/uploads/**` 静态资源。
- `SecurityConfig` 放行上传与生成动画相关接口。
- `application.yml` 与 `src/test/resources/application.yml` 增加上传目录 / AIGC 命令配置，避免测试环境启动失败。

---

### 🖥️ 前端打通内容

- `frontend/src/App.jsx` 恢复以下真实页面，不再使用占位组件：
  - `DiaryManagementPage`
  - `FoodSearchPage`
  - `IndoorNavigationPage`
  - `AIGCPage`
  - `ConcurrencyTestPage`
- `frontend/src/services/api.js` 重做了返回值归一化，兼容 Java 新接口与旧风格 `{success,data}` 响应。
- 统一补齐用户、景点、游记字段的 JSON 字符串反序列化，避免页面侧反复手工处理。
- 修复多个页面中的筛选 bug：
  - `RoutePage`
  - `IndoorNavigationPage`
  - `StatsPage`
- `AIGCPage` 调整为“图片转动画”展示逻辑，支持 GIF 预览与下载。

---

### 📄 本次新增 / 重点修改文件

#### 新增

- `src/main/java/com/tourism/utils/JsonUtils.java`
- `src/main/java/com/tourism/service/AigcService.java`
- `src/main/java/com/tourism/config/WebMvcConfig.java`
- `src/main/java/com/tourism/controller/MediaController.java`
- `src/main/java/com/tourism/controller/LegacyNavigationController.java`
- `scripts/generate_aigc_gif.py`

#### 重点修改

- `src/main/java/com/tourism/controller/DiaryController.java`
- `src/main/java/com/tourism/controller/PlaceController.java`
- `src/main/java/com/tourism/controller/FoodController.java`
- `src/main/java/com/tourism/service/DiaryService.java`
- `src/main/java/com/tourism/service/impl/DiaryServiceImpl.java`
- `src/main/java/com/tourism/service/impl/UserBehaviorServiceImpl.java`
- `src/main/java/com/tourism/algorithm/ShortestPathAlgorithm.java`
- `src/main/java/com/tourism/config/SecurityConfig.java`
- `src/main/resources/application.yml`
- `frontend/src/services/api.js`
- `frontend/src/App.jsx`
- `frontend/src/pages/RoutePage.jsx`
- `frontend/src/pages/IndoorNavigationPage.jsx`
- `frontend/src/pages/AIGCPage.jsx`
- `frontend/src/pages/StatsPage.jsx`

---

### 🧪 验证结果

#### 后端

```bash
mvn test
```

结果：

```text
BUILD SUCCESS
Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
```

#### 前端

```bash
npm install
npm run build
```

结果：

```text
vite build 成功
```

---

### ⚠️ 当前已知问题 / 后续优化项

1. `ShortestPathAlgorithm` 在测试启动早期会先尝试加载路网，H2 初始化前会打印一次“表不存在”警告，但当前不会导致启动失败。
2. 前端打包产物主包体积偏大，Vite 给出了 chunk size 警告，后续可以做路由级拆包。
3. AIGC 目前在 Java 主链路中已可用，但为适配当前本机环境，底层生成器先采用 Python + Pillow 生成 GIF；如果后续要完全摆脱 Python 运行时，还需要继续替换为纯 Java 方案。

---

### 🔮 下一步建议

1. 做一次真实数据联调，重点验证游记新增/编辑/删除、图片上传、动画生成、评分回刷是否符合预期。
2. 把“附近设施”与“推荐首页”做一次手工回归，确认前端展示和 Java 返回字段完全一致。
3. 如果准备进入演示或验收阶段，下一轮优先做鉴权收口、接口权限分级和页面级体验优化，而不是继续扩展新功能。
