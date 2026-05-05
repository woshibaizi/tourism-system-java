# 个性化旅游系统 Java 重构 — 开发日志 08

---

## 📅 2026-04-24 第八次开发：网页端地点与导航重构、校内导航初版、坐标系长期修正

### 🎯 本次目标

本轮不是继续堆功能，而是把“网页端地点与导航”这一块从结构、导航入口、地图承载方式到数据坐标系整体拉回到可持续状态。

核心目标有 4 个：

1. 把网页端原本分散的“场所浏览 / 美食搜索 / 路线规划 / 室内导航”重新整理成更清晰的入口结构；
2. 把“室内导航”升级为“校内导航”模块，先交付“学校内导航”初版；
3. 让高德地图从“局部尝试接入”变成网页端地图展示的统一平台；
4. 修掉北邮校园点位在高德底图上整体偏移的问题，采用长期正确的坐标系修正方案，而不是前端临时补丁。

---

## ✅ 本轮完成的功能与结构调整

### 1. 网页端“地点与导航”信息架构重构

原本网页端存在多个互相重叠的入口：

- 场所浏览
- 美食搜索
- 路线规划
- 室内导航

本轮先把入口结构收口为：

- `地点搜索`
- `高德导航`
- `校内导航`

其中：

- `地点搜索` 统一承接地点与美食搜索，不再让用户在“场所浏览”和“美食搜索”之间来回跳；
- `高德导航` 保留为纯高德地图 / 搜索 / 路线规划试验入口；
- `校内导航` 成为校园场景的主导航模块；
- 原 `/places`、`/food-search`、`/facility-query`、`/indoor-navigation` 页面入口改为跳转或重定向，不再作为主入口暴露。

对应文件：

- `frontend/src/App.jsx`
- `frontend/src/pages/LocationSearchPage.jsx`
- `frontend/src/pages/HomePage.jsx`

---

### 2. 地点搜索统一入口落地

新增 `LocationSearchPage`，把地点和美食合到一个页面中：

- 支持分类筛选：
  - 全部
  - 景区
  - 学校
  - 公园
  - 美食
- 支持统一关键词检索；
- 支持综合排序 / 评分优先 / 热度优先；
- 搜索结果可以直接跳详情页，也可以直接进入导航页。

本轮采用的策略是：

- 地点数据来自 `places`
- 美食数据来自 `foods`
- 前端做统一结果归并与展示

这是为了先快速把信息架构收顺，而不是一开始就把“统一搜索聚合接口”做成后端新服务。

---

### 3. “室内导航”升级为“校内导航”

本轮没有直接把室内导航做大，而是先把模块层级改对：

- 菜单从 `室内导航` 改为 `校内导航`
- 新增 `CampusNavigationPage`
- 页面内部拆成两个标签：
  - `学校内导航`
  - `室内导航`

当前状态：

- `学校内导航` 已交付初版
- `室内导航` 暂时保留为“后续开发”占位说明

这样做的原因是：

- 校园内路径和楼内路径是两套不同的图；
- 如果在当前版本把两者强拼，会导致页面结构和数据模型一起失控；
- 先让“学校内导航”跑通，再把现有 `indoor_navigation.json` 和楼层逻辑接回来，后续更稳。

对应文件：

- `frontend/src/pages/CampusNavigationPage.jsx`
- `frontend/src/App.jsx`

---

### 4. 学校内导航初版落地

“学校内导航”初版采用的是：

- **高德地图做地图承载**
- **现有北邮校内点位 + 现有最短路径算法做校园内部导航**

具体逻辑：

- 默认校园数据锁定北京邮电大学（优先匹配 `place_001`，其次按 `校园` / `北京邮电大学` 搜索）；
- 起点终点来自北邮校内建筑物和设施点；
- 支持“使用当前位置”；
- 若使用当前位置，则先映射为最近图节点，再复用现有路径算法；
- 后端按本地路网算法返回路径；
- 前端将路径绘制到高德底图上。

本轮先只做：

- 校内步行导航

本轮暂不做：

- 室内导航拼接
- 校外到校内联动
- 校内骑行 / 驾车模式
- 室内楼层切换

涉及文件：

- `frontend/src/pages/CampusNavigationPage.jsx`
- `frontend/src/services/api.js`
- `src/main/java/com/tourism/controller/NavigationController.java`
- `src/main/java/com/tourism/controller/LegacyNavigationController.java`
- `src/main/java/com/tourism/service/OutdoorRouteService.java`
- `src/main/java/com/tourism/algorithm/ShortestPathAlgorithm.java`

---

### 5. 高德导航页改为“纯高德模式”

原来的路线规划页经历了几轮改造，本轮最终把它收敛成一个更明确的方向：

- 出发地 / 目的地使用高德搜索建议
- 定位走浏览器定位 + 高德底图显示
- 路线规划走高德方向服务
- 页面不再依赖数据库点位做主交互

虽然这页目前仍在持续调试，但方向已经定了：

- 高德导航页 = 纯高德能力实验与对照页
- 校内导航页 = 校园真实业务导航页

这两条链路不再混在一起。

对应文件：

- `frontend/src/pages/RoutePage.jsx`
- `frontend/src/components/RouteMap.jsx`
- `frontend/src/utils/amapLoader.js`
- `frontend/src/utils/location.js`

---

## 🧩 后端关键变化

### 1. 导航相关接口开放为匿名可访问

由于“高德导航 / 校内导航 / 室内导航”都属于前台公开可测模块，本轮把以下接口显式放开：

- `GET /api/navigation/**`
- `POST /api/navigation/**`
- `GET /api/routes/**`
- `POST /api/routes/**`
- `GET /api/indoor/**`
- `POST /api/indoor/**`

同时修正了一次误放开的权限回归：

- 曾一度把日记的写接口也放成匿名可访问；
- 已撤回，只保留导航相关接口公开。

对应文件：

- `src/main/java/com/tourism/config/SecurityConfig.java`

---

### 2. 高德前后端配置补齐

后端补了高德配置承载：

- `AmapProperties`
- `AmapNavigationService`
- `OutdoorRouteService`
- `application.yml` 中增加高德配置项

目的是把：

- JS API key
- Web service key
- 安全密钥

都放进统一配置层，而不是继续在页面里到处散落。

对应文件：

- `src/main/java/com/tourism/config/AmapProperties.java`
- `src/main/java/com/tourism/service/AmapNavigationService.java`
- `src/main/java/com/tourism/service/OutdoorRouteService.java`
- `src/main/resources/application.yml`

---

### 3. 坐标系长期正确方案落地

这是本轮最关键的后端修正。

问题来源：

- 数据库中的北邮建筑、设施、地点坐标更像 `WGS84`
- 高德地图底图使用 `GCJ-02`
- 如果把数据库原始坐标直接画到高德上，整条路径会整体偏移到校区外侧

这轮采取的不是“前端临时修正”，而是长期方案：

#### 新增统一坐标转换工具

- `CoordinateTransformUtils`

能力包括：

- `WGS84 -> GCJ-02`
- 批量给地点 / 建筑 / 设施打地图展示坐标
- 批量把路径节点坐标转换成高德可展示坐标

#### 实体新增运行时地图字段

在以下实体中新增非持久化字段：

- `mapLat`
- `mapLng`
- `coordSystem`
- `mapCoordSystem`

涉及：

- `SpotPlace`
- `SpotBuilding`
- `SpotFacility`

#### 控制器统一返回地图展示坐标

以下控制器现在统一给前端返回可直接在高德上使用的坐标：

- `PlaceController`
- `BuildingController`
- `FacilityController`

#### 导航路径节点统一转成 GCJ-02

`OutdoorRouteService` 里，路径节点坐标输出也改成了 GCJ-02，避免：

- 建筑点位是 GCJ-02
- 路径折线还是 WGS84

这种二次错位。

这意味着后续前端不需要再“猜数据库是什么坐标系”，只需要优先使用：

- `mapLat`
- `mapLng`

对应文件：

- `src/main/java/com/tourism/utils/CoordinateTransformUtils.java`
- `src/main/java/com/tourism/model/entity/SpotPlace.java`
- `src/main/java/com/tourism/model/entity/SpotBuilding.java`
- `src/main/java/com/tourism/model/entity/SpotFacility.java`
- `src/main/java/com/tourism/controller/PlaceController.java`
- `src/main/java/com/tourism/controller/BuildingController.java`
- `src/main/java/com/tourism/controller/FacilityController.java`
- `src/main/java/com/tourism/service/OutdoorRouteService.java`

---

## 🖥️ 前端地图承载能力变化

### 1. RouteMap 统一承接高德地图展示

`RouteMap.jsx` 不再只是旧路径动画组件，而是逐步变成：

- 高德地图容器
- 点位 marker 展示
- 路径 polyline 绘制
- fallback 到旧结果渲染

同时它现在优先读取：

- `mapLat/mapLng`
- 或转换后的路径坐标

不再优先盲信数据库原始 `lat/lng`。

这使得高德底图和北邮校内路径有了统一的坐标参考。

---

## 📄 本轮新增 / 重点修改文件

### 新增

- `frontend/src/pages/LocationSearchPage.jsx`
- `frontend/src/pages/CampusNavigationPage.jsx`
- `frontend/src/utils/amapLoader.js`
- `frontend/src/utils/location.js`
- `src/main/java/com/tourism/config/AmapProperties.java`
- `src/main/java/com/tourism/service/AmapNavigationService.java`
- `src/main/java/com/tourism/service/OutdoorRouteService.java`
- `src/main/java/com/tourism/utils/CoordinateTransformUtils.java`
- `src/test/java/com/tourism/IndoorNavigationIntegrationTests.java`
- `DEV-PLAN/GAODE_NAVIGATION_TEST_CHECKLIST.md`

### 重点修改

- `frontend/src/App.jsx`
- `frontend/src/pages/HomePage.jsx`
- `frontend/src/pages/RoutePage.jsx`
- `frontend/src/components/RouteMap.jsx`
- `frontend/src/services/api.js`
- `src/main/java/com/tourism/config/SecurityConfig.java`
- `src/main/java/com/tourism/controller/PlaceController.java`
- `src/main/java/com/tourism/controller/BuildingController.java`
- `src/main/java/com/tourism/controller/FacilityController.java`
- `src/main/java/com/tourism/controller/NavigationController.java`
- `src/main/java/com/tourism/controller/LegacyNavigationController.java`
- `src/main/java/com/tourism/algorithm/ShortestPathAlgorithm.java`
- `src/main/resources/application.yml`
- `src/test/resources/application.yml`
- `src/test/java/com/tourism/NavigationFacilityIntegrationTests.java`

---

## 🧪 验证结果

### 后端

```bash
mvn test
```

结果：

```text
BUILD SUCCESS
Tests run: 15, Failures: 0, Errors: 0, Skipped: 0
```

覆盖包括：

- 导航接口
- 校内导航相关回退能力
- 室内导航集成能力
- 现有日记算法链路

### 前端

```bash
cd frontend
npm run build
```

结果：

```text
vite build 成功
```

### 前端 lint

```bash
npm run lint
```

结果：

```text
仍有 5 个历史遗留 react-hooks warning
```

说明：

- 本轮没有新增 lint error
- 剩余 warning 来自旧页面，不是本轮新增问题

---

## ⚠️ 当前工作区中额外的未提交变更

除了本轮真实业务改动外，当前工作区里还有一些不应作为本轮功能总结主体的变动：

1. `target/` 目录下大量编译产物与测试报告变更；
2. `../tourism-system/TourismSystemApp/**` 出现整组删除；
3. `../tourism-system/backend/uploads/images/**` 出现若干新增图片；
4. 若干脚本与说明文件尚未纳入正式交付判断。

这些内容属于：

- 构建输出
- 相邻工作区副作用
- 历史遗留或本地实验痕迹

后续提交前应再次确认是否纳入版本控制。

---

## 🔮 下一步建议

### 1. 室内导航

下一步主线应该是把 `校内导航` 模块中的第二个标签真正做起来：

- 接回现有 `indoor_navigation.json`
- 对接 `IndoorNavigationAlgorithm`
- 做楼层切换与楼内步骤展示
- 最终把“学校内导航 + 室内导航”拼成一条连续链路

建议目标：

- 先支持“校门 / 楼外点位 -> 教学楼内房间”
- 再支持“楼内起点 -> 楼内终点”

### 2. 开发 agent

如果继续多 agent 推进，推荐下一轮拆成 3 条主线：

1. **frontend agent**
   - 完善 `CampusNavigationPage`
   - 做室内导航标签页
   - 收口 RouteMap 交互和状态

2. **backend agent**
   - 室内导航接口与校内导航编排
   - 校内导航与室内导航拼接
   - 坐标系元数据进一步标准化

3. **test/doc agent**
   - 增补室内导航和校内导航联动测试
   - 更新 README / 验收清单 / 开发日志

---

## 一句话总结

本轮把“网页端地点与导航”从杂乱入口和试验态，推进到了：

- `地点搜索`
- `高德导航`
- `校内导航`

三个职责更清晰的模块结构；同时完成了北邮校内导航初版，并用**后端统一坐标转换**的方式解决了高德底图与数据库点位坐标系不一致的问题。
