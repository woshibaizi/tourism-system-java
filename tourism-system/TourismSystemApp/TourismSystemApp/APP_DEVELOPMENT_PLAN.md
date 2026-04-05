# TourismSystemApp 页面规划与开发文档

## 1. 文档目标

本文档用于指导 `TourismSystemApp` 的第一阶段开发，目标不是直接复刻 Web 前端，而是基于现有旅游系统的业务能力，重新设计一套更适合 iPhone 的 `Swift + SwiftUI` App 页面结构。

当前原则：

- 保留现有系统的核心业务能力
- 保留后端 API 的模块划分思路
- 按 iPhone App 的交互方式重组页面
- 优先完成可展示、可导航、可逐步接 API 的移动端骨架

---

## 2. 现有 Web 页面梳理

当前前端已有页面：

- `LoginPage`
- `HomePage`
- `PlacesPage`
- `PlaceDetailPage`
- `DiariesPage`
- `DiaryDetailPage`
- `DiaryManagementPage`
- `RoutePage`
- `FacilityQueryPage`
- `FoodSearchPage`
- `IndoorNavigationPage`
- `AIGCPage`
- `StatsPage`
- `ConcurrencyTestPage`

这些页面里，适合直接迁移到移动端核心体验的有：

- 登录
- 首页
- 景点浏览
- 景点详情
- 路线规划
- 设施查询
- 美食搜索
- 室内导航
- 日记列表
- 日记详情

不建议在第一版 App 中优先迁移的页面：

- `DiaryManagementPage`
- `StatsPage`
- `ConcurrencyTestPage`

原因：

- 这些页面更偏后台或开发辅助
- 不符合移动端第一版练习项目的核心场景
- 会拉高开发复杂度，降低前期成就感

---

## 3. App 第一版产品定位

第一版 `TourismSystemApp` 定位为：

> 一个面向游客/学生用户的移动端个性化旅游助手，支持景点浏览、路线规划、设施查询、旅游日记和个人中心。

第一版目标：

- 先完成 iPhone App 的整体骨架
- 先做静态 UI 和页面跳转
- 再逐步接入现有 API
- 最后适配 Spring Boot + MySQL 后端

---

## 4. 推荐的 App 信息架构

推荐采用底部 `Tab Bar` 作为主导航，共 5 个一级页面：

1. `首页`
2. `发现`
3. `路线`
4. `日记`
5. `我的`

这是最适合新手上手的移动端结构，原因：

- 页面边界清晰
- 符合 iPhone 常见使用习惯
- 方便逐步补功能
- 适合 SwiftUI 的 `TabView + NavigationStack`

---

## 5. 页面规划总表

### 5.1 启动与账户模块

#### 1. `LaunchView`

作用：

- App 启动页
- 显示品牌、Logo、加载状态

说明：

- 可以非常简单
- 后期可加自动跳转逻辑

#### 2. `LoginView`

对应 Web：

- `LoginPage`

功能：

- 用户登录
- 跳转注册
- 游客模式入口（可选）

#### 3. `RegisterView`

功能：

- 用户注册
- 基本资料填写

说明：

- 如果后端暂时没有完整注册接口，可先保留静态页或假数据流程

---

### 5.2 首页模块

#### 4. `HomeView`

对应 Web：

- `HomePage`

功能建议：

- 顶部欢迎区
- 搜索入口
- 今日推荐景点
- 热门路线
- 常用功能快捷入口
- 附近设施/美食推荐

界面建议：

- 顶部大图或轻量 Banner
- 推荐卡片横向滑动
- 快捷入口宫格
- 内容卡片化展示

#### 5. `RecommendationDetailView`

功能：

- 展示某条推荐的详细内容
- 可跳转到景点详情或路线页

说明：

- 如果第一版内容不多，这个页面也可以先合并进景点详情页

---

### 5.3 发现模块

#### 6. `DiscoverView`

对应 Web：

- `PlacesPage`

功能建议：

- 景点列表
- 搜索框
- 分类筛选
- 热门/评分/距离排序

界面建议：

- 顶部搜索栏
- 标签筛选区
- 下方景点列表

#### 7. `PlaceDetailView`

对应 Web：

- `PlaceDetailPage`

功能建议：

- 景点图片
- 景点介绍
- 标签与评分
- 开放时间/建议游玩时长
- 周边设施入口
- 路线规划入口
- 相关日记入口

界面建议：

- 顶部大图
- 下面是信息分区卡片
- 底部固定操作按钮，如“去规划路线”

#### 8. `FacilityQueryView`

对应 Web：

- `FacilityQueryPage`

功能建议：

- 查询附近洗手间、咖啡馆、食堂、超市等设施
- 展示距离和位置

说明：

- 这个页面可从景点详情页跳入
- 也可以后期合并到地图页中

#### 9. `FoodSearchView`

对应 Web：

- `FoodSearchPage`

功能建议：

- 搜索周边美食
- 筛选菜系
- 按评分/距离排序

说明：

- 可以作为发现模块的子页面
- 第一版无需做得过重

---

### 5.4 路线模块

#### 10. `RoutePlannerView`

对应 Web：

- `RoutePage`

功能建议：

- 选择起点、终点
- 选择多点游览目标
- 生成推荐路线

界面建议：

- 表单式布局
- 结果区和地图区上下布局

#### 11. `RouteResultView`

功能：

- 展示路线摘要
- 展示总距离、预计时间、途经点
- 提供地图查看入口

说明：

- 可从 `RoutePlannerView` 进入

#### 12. `MapRouteView`

功能：

- 在地图上显示路线
- 标记起点终点和途经点

说明：

- 第一版可以先做静态地图容器或占位视图
- 真正地图接入可以放在后续阶段

#### 13. `IndoorNavigationView`

对应 Web：

- `IndoorNavigationPage`

功能建议：

- 建筑物内路径导航
- 楼层切换
- 房间查找

说明：

- 室内导航是亮点功能
- 但复杂度较高，建议放在路线模块的后续版本中实现

---

### 5.5 日记模块

#### 14. `DiaryListView`

对应 Web：

- `DiariesPage`

功能建议：

- 浏览旅游日记
- 支持封面图、标题、摘要、点赞数
- 支持筛选或搜索

界面建议：

- 卡片流布局
- 类似内容社区风格

#### 15. `DiaryDetailView`

对应 Web：

- `DiaryDetailPage`

功能建议：

- 展示图文详情
- 显示作者、发布时间、关联景点
- 点赞、收藏、分享入口

#### 16. `CreateDiaryView`

功能建议：

- 编辑标题、正文
- 选择图片
- 选择关联景点
- 提交日记

说明：

- 这是 App 很适合练手的页面
- 可以练习表单、图片选择、上传、提交

#### 17. `EditDiaryView`

功能建议：

- 编辑已有日记

说明：

- 如果第一版范围太大，可以先不做

---

### 5.6 我的模块

#### 18. `ProfileView`

功能建议：

- 头像、昵称、简介
- 我的收藏
- 我的日记
- 我的历史路线
- 设置入口

#### 19. `FavoritesView`

功能建议：

- 收藏景点
- 收藏日记

#### 20. `HistoryView`

功能建议：

- 浏览过的景点
- 规划过的路线

#### 21. `SettingsView`

功能建议：

- 账号设置
- 清除缓存
- 关于应用

---

### 5.7 后续增强模块

#### 22. `AIGCAssistantView`

对应 Web：

- `AIGCPage`

功能建议：

- 一键生成旅游文案
- 辅助生成日记草稿

说明：

- 适合作为第二阶段增强能力
- 第一版不建议优先实现

#### 23. `StatsView`

对应 Web：

- `StatsPage`

说明：

- 可作为开发调试工具页
- 不建议面向普通用户开放

#### 24. `AdminDiaryManagementView`

对应 Web：

- `DiaryManagementPage`

说明：

- 更适合 Web 后台
- 不建议进入普通移动端 App 第一版

---

## 6. 第一版建议实际开发页面

为了降低复杂度，第一版建议只做以下页面：

### 一级主页面

- `HomeView`
- `DiscoverView`
- `RoutePlannerView`
- `DiaryListView`
- `ProfileView`

### 二级页面

- `LoginView`
- `RegisterView`
- `PlaceDetailView`
- `DiaryDetailView`
- `CreateDiaryView`
- `FacilityQueryView`
- `FoodSearchView`
- `RouteResultView`

### 可暂缓页面

- `MapRouteView`
- `IndoorNavigationView`
- `AIGCAssistantView`
- `FavoritesView`
- `HistoryView`
- `SettingsView`

---

## 7. 推荐页面跳转关系

### 主干导航

- `LaunchView` -> `LoginView`
- `LoginView` -> `MainTabView`

### 首页流转

- `HomeView` -> `PlaceDetailView`
- `HomeView` -> `RoutePlannerView`
- `HomeView` -> `FoodSearchView`
- `HomeView` -> `FacilityQueryView`

### 发现流转

- `DiscoverView` -> `PlaceDetailView`
- `PlaceDetailView` -> `RoutePlannerView`
- `PlaceDetailView` -> `FacilityQueryView`
- `PlaceDetailView` -> `DiaryListView`

### 路线流转

- `RoutePlannerView` -> `RouteResultView`
- `RouteResultView` -> `MapRouteView`
- `RouteResultView` -> `IndoorNavigationView`

### 日记流转

- `DiaryListView` -> `DiaryDetailView`
- `DiaryListView` -> `CreateDiaryView`

### 我的流转

- `ProfileView` -> `FavoritesView`
- `ProfileView` -> `HistoryView`
- `ProfileView` -> `SettingsView`

---

## 8. 推荐的 SwiftUI 工程目录

建议在 `TourismSystemApp` 工程中逐步建立以下目录：

```text
TourismSystemApp/
├── App/
├── Models/
├── Views/
│   ├── Launch/
│   ├── Auth/
│   ├── Home/
│   ├── Discover/
│   ├── Route/
│   ├── Diary/
│   └── Profile/
├── ViewModels/
├── Services/
├── Components/
├── Resources/
└── Utils/
```

说明：

- `Views` 下按业务模块拆分最清晰
- `Components` 存可复用卡片、搜索框、按钮、标签视图
- `Services` 存 API 请求封装
- `ViewModels` 管理页面状态

---

## 9. API 模块保留建议

虽然后端正在从 Flask 重构到 Spring Boot，但移动端可以先按业务模块保留接口边界：

- `AuthService`
- `PlaceService`
- `RouteService`
- `DiaryService`
- `FoodService`
- `FacilityService`
- `IndoorNavigationService`
- `UploadService`

建议：

- 页面不要直接写请求逻辑
- 统一在 `Services/` 中封装请求
- 后端切换时尽量只改 `Service` 和 `Model`

---

## 10. 第一阶段开发顺序建议

### 阶段一：先搭骨架

目标：

- App 能跑
- 有 Tab Bar
- 有基础导航

任务：

- 创建 `MainTabView`
- 创建 5 个一级页面占位视图
- 跑通 `NavigationStack`

### 阶段二：先做静态页面

目标：

- 先不接真实 API
- 用假数据完成核心页面外观

优先页面：

- `HomeView`
- `DiscoverView`
- `PlaceDetailView`
- `DiaryListView`
- `ProfileView`

### 阶段三：补交互和二级页面

目标：

- 让页面可点击、可跳转、可提交

优先补充：

- `RoutePlannerView`
- `RouteResultView`
- `DiaryDetailView`
- `CreateDiaryView`

### 阶段四：接 API

目标：

- 从静态页面过渡到真实数据驱动

顺序建议：

1. 景点列表与详情
2. 日记列表与详情
3. 登录
4. 路线规划
5. 上传

### 阶段五：增强能力

目标：

- 提升 App 完整度

增强方向：

- 地图接入
- 图片选择
- 上传图片
- 收藏与历史记录
- 室内导航

---

## 11. 新手开发时的控制范围建议

为了保证项目能持续推进，建议你控制第一版范围：

先做：

- 页面结构
- 假数据
- 页面跳转
- API 预留

后做：

- 地图绘制
- 室内导航
- AIGC
- 复杂筛选
- 高级动画

这样更容易在短时间内看到结果，也更适合学习 SwiftUI。

---

## 12. 当前建议结论

对于这个旅游系统，iPhone App 的第一版最适合的做法是：

- 用 `Tab Bar` 组织 5 个一级页面
- 把 Web 端的功能重组成适合移动端的页面流
- 优先开发 `首页 / 发现 / 路线 / 日记 / 我的`
- 先用静态页面和假数据搭建骨架
- 后续逐步接入 `Spring Boot + MySQL` 提供的 API

第一版不要追求功能完整，而要追求：

- 结构清楚
- 页面顺
- 易于扩展
- 能学到完整 iOS 开发流程

