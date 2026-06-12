# 校园周边功能扩展方案

## 一、项目现状与优化方向

### 1.1 当前系统架构

```
┌─────────────────────────────────────────────────────┐
│                    前端 (React + Vite)               │
│   PlacesPage / PlaceDetailPage / FoodSearchPage      │
│   FacilityQueryPage / NavigationPage / RoutePage      │
│   HomePage / DiariesPage / PersonalTravelAssistant   │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP / SSE
┌──────────────────────▼──────────────────────────────┐
│                Java Backend (Spring Boot)            │
│   PlaceController / FoodController                   │
│   FacilityController / BuildingController            │
│   NavigationController / DiaryController             │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              Agent Service (Python FastAPI)          │
│   8 Agents: Chat/Route/Diary/Scene/Dice/Persona/    │
│   Memory + Tool Registry + SSE Streaming            │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                   MySQL + Redis                      │
│   spot_place / spot_building / spot_facility         │
│   spot_food / spot_road_edge / travel_diary          │
│   sys_user / user_behavior                          │
└─────────────────────────────────────────────────────┘
```

### 1.2 现有数据覆盖

| 维度 | 数据表 | 当前覆盖 | 缺口 |
|------|--------|----------|------|
| 目的地 | `spot_place` | 101校园 + 200景区 | ✅ 已覆盖 |
| 校内建筑 | `spot_building` | 教学楼、宿舍、行政楼 | 仅校内 |
| 校内设施 | `spot_facility` | 食堂、超市、卫生间等 | 仅校内 |
| 校内美食 | `spot_food` | 食堂窗口、校内餐饮 | 仅校内 |
| **校园周边** | **无** | **空白** | ❌ **本次补齐** |

### 1.3 核心问题

> 用户来到一个大学校园旅游，除了逛校园本身，还需要知道：**校门口有什么好吃的？附近有什么好玩的？哪里可以住宿？怎么去最近的地铁站？**

当前系统对"校园周边"完全没有覆盖，这是用户体验的一个明显断层。

### 1.4 数据规模策略：精品精选

> **原则：少而精，不做数据堆砌。**

| 学校 | 周边数据量 | 理由 |
|------|-----------|------|
| 北邮 (place_001) | **不限量**（全量保留） | 开发者熟悉，作为标杆样板，数据可最丰富 |
| 其他 100 所校园 | **每校 20 条** | 精选最具代表性的周边商户，够用不冗余 |

**每校 20 条的分配建议**：

| 类别 | 数量 | 包含 |
|------|------|------|
| 🍜 美食餐饮 | 8 条 | 2家正餐 + 2家快餐/小吃 + 2家奶茶/咖啡 + 2家特色/深夜营业 |
| 🛍️ 购物消费 | 3 条 | 1个最近的大型商超 + 1个便利店 + 1个特色店铺 |
| 🎮 休闲娱乐 | 3 条 | 1个电影院/KTV + 1个剧本杀/网咖 + 1个运动场馆 |
| 🏨 住宿酒店 | 2 条 | 1个经济型 + 1个舒适型 |
| 🚇 交通出行 | 2 条 | 最近的地铁站 + 主要的公交枢纽 |
| 🏦 生活服务 | 2 条 | 1个银行ATM + 1个药店/医院 |

**总共 101 所校园 × 20 条 = 2,020 条精选数据 + 北邮全量数据。**

这个规模：够用户在 App 里浏览，不会造成选择困难，爬取和清洗成本可控。

---

## 二、校园周边功能设计

### 2.1 功能定义

"校园周边"指以校园为中心、半径 3km 范围内的生活娱乐服务设施，包括六大类别：

| 类别 | type 值 | 包含内容 | 示例 |
|------|---------|----------|------|
| 🍜 美食餐饮 | `restaurant` | 餐馆、小吃店、火锅、烧烤、奶茶店 | 海底捞、沙县小吃、喜茶 |
| 🛍️ 购物消费 | `shopping` | 商场、超市、便利店、书店 | 万达广场、罗森、新华书店 |
| 🎮 休闲娱乐 | `entertainment` | KTV、电影院、剧本杀、网咖、台球 | 万达影城、魅KTV |
| 🏨 住宿酒店 | `hotel` | 酒店、宾馆、青旅、民宿 | 如家、全季、汉庭 |
| 🚇 交通出行 | `transport` | 地铁站、公交站、停车场 | 2号线XX站 |
| 🏦 生活服务 | `service` | 银行、医院、药店、理发店、快递 | 工行ATM、老百姓大药房 |

### 2.2 数据模型设计

#### 新建表：`spot_surrounding`

```sql
CREATE TABLE `spot_surrounding` (
    `id`              VARCHAR(32)    PRIMARY KEY COMMENT '主键，如 sr_001',
    `name`            VARCHAR(100)   NOT NULL COMMENT '商户/场所名称',
    `type`            VARCHAR(30)    NOT NULL COMMENT '类型：restaurant/shopping/entertainment/hotel/transport/service',
    `sub_type`        VARCHAR(30)    DEFAULT NULL COMMENT '子类型：hotpot/milk_tea/cinema/ktv/metro/hotel_chain 等',
    `place_id`        VARCHAR(32)    NOT NULL COMMENT '所属校园ID，关联 spot_place.id',
    `lat`             DECIMAL(10,7)  NOT NULL COMMENT '纬度（WGS84）',
    `lng`             DECIMAL(10,7)  NOT NULL COMMENT '经度（WGS84）',
    `address`         VARCHAR(255)   DEFAULT NULL COMMENT '详细地址',
    `distance_meters` INT            DEFAULT NULL COMMENT '距校园中心的距离（米），由后端计算填充',
    `price_range`     VARCHAR(20)    DEFAULT NULL COMMENT '价格区间：¥/¥¥/¥¥¥',
    `avg_cost`        DECIMAL(8,2)   DEFAULT NULL COMMENT '人均消费（元）',
    `open_time`       VARCHAR(200)   DEFAULT NULL COMMENT '营业时间',
    `phone`           VARCHAR(20)    DEFAULT NULL COMMENT '联系电话',
    `image`           VARCHAR(500)   DEFAULT NULL COMMENT '封面图片路径',
    `images`          TEXT           DEFAULT NULL COMMENT '多图JSON数组',
    `tags`            TEXT           DEFAULT NULL COMMENT '标签JSON数组，如 ["性价比高","学生优惠","深夜营业"]',
    `rating`          DECIMAL(2,1)   DEFAULT 0.0 COMMENT '综合评分 0.0~5.0',
    `rating_count`    INT            DEFAULT 0 COMMENT '评分人数',
    `click_count`     INT            DEFAULT 0 COMMENT '浏览量/热度',
    `description`     VARCHAR(500)   DEFAULT NULL COMMENT '简要描述（50-150字）',
    `detail_description` TEXT        DEFAULT NULL COMMENT '详细介绍（200-400字）',
    `student_discount` TINYINT(1)    DEFAULT 0 COMMENT '是否有学生优惠',
    `must_try`        VARCHAR(200)   DEFAULT NULL COMMENT '必点/必玩推荐',
    `deleted`         TINYINT(1)     DEFAULT 0 COMMENT '软删除',
    `created_at`      DATETIME       DEFAULT CURRENT_TIMESTAMP,
    `updated_at`      DATETIME       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_place_id` (`place_id`),
    INDEX `idx_type` (`type`),
    INDEX `idx_sub_type` (`sub_type`),
    INDEX `idx_rating` (`rating`),
    INDEX `idx_click_count` (`click_count`),
    INDEX `idx_distance` (`place_id`, `distance_meters`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='校园周边商户/场所';
```

#### 与现有表的关系

```
spot_place (校园) ──1:N──→ spot_surrounding (周边商户)
     │
     ├──1:N──→ spot_building (校内建筑)
     ├──1:N──→ spot_facility (校内设施)
     └──1:N──→ spot_food (校内美食)
```

#### 为什么不复用 `spot_facility`？

| 对比维度 | spot_facility | spot_surrounding（新建） |
|----------|--------------|--------------------------|
| 定位 | 校内设施（食堂、卫生间、超市） | 校外周边商户 |
| 独有字段 | 无价格/距离/学生优惠 | price_range / avg_cost / distance_meters / student_discount / must_try / phone |
| 语义清晰度 | 混合后 type 枚举膨胀 | 独立管理，语义清晰 |
| 查询效率 | 校内+周边混杂，查询需额外过滤 | 独立索引，查询干净 |
| 扩展性 | 字段不足，需 ALTER TABLE | 自由扩展，不影响现有功能 |

**结论：新建独立表，保持数据边界清晰。**

### 2.3 API 接口设计

#### 新增 Controller：`SurroundingController`

```
Base path: /api/surroundings
```

| 方法 | 端点 | 说明 | 对应前端页面 |
|------|------|------|-------------|
| `GET` | `/api/surroundings` | 分页列表（按placeId/type筛选） | 周边列表页 |
| `GET` | `/api/surroundings/{id}` | 商户详情 | 周边详情页 |
| `GET` | `/api/surroundings/by-place/{placeId}` | 按校园查询周边（分类展示） | 校园详情页"周边"Tab |
| `GET` | `/api/surroundings/search` | 综合搜索（名称+标签+描述） | 搜索页 |
| `GET` | `/api/surroundings/nearby` | LBS附近搜索（lat/lng/radius/type） | 地图浏览 |
| `GET` | `/api/surroundings/hot` | 热门推荐（按click_count） | 首页推荐 |
| `GET` | `/api/surroundings/top-rated` | 高分排行（按rating） | 排行榜 |
| `GET` | `/api/surroundings/categories/{placeId}` | 获取某校园周边的分类统计 | 分类导航 |
| `POST` | `/api/surroundings/{id}/rate` | 评分 | 详情页评分 |

#### 复用现有接口（无需新增）

| 端点 | 复用方式 |
|------|----------|
| `POST /api/places/recommend` | TF-IDF 推荐算法可直接对 surrounding 数据运行（需在 service 层接入） |
| `GET /api/places/{id}` | 校园详情接口可附带周边摘要 |
| `POST /api/agent/chat/stream` | Agent 可调用 surrounding 数据进行周边推荐 |

### 2.4 前端页面设计

#### 新增页面

| 页面 | 路由 | 说明 |
|------|------|------|
| `SurroundingPage` | `/surrounding/:placeId` | 校园周边主页，6 分类 Tab 切换 + 列表 |
| `SurroundingDetailPage` | `/surrounding/:placeId/:id` | 商户详情：图片轮播、信息、地图位置、评分 |

#### 现有页面改造

| 页面 | 改动 |
|------|------|
| `PlaceDetailPage` | 新增"周边"Tab，嵌入周边分类卡片 |
| `HomePage` | 新增"校园周边热门"推荐卡片 |
| `MixedSearchPage` | 搜索结果中混合展示周边商户 |
| `FoodSearchPage` | 可切换"校内美食" / "校外周边美食" |

### 2.5 Agent 扩展

| Agent | 新增能力 |
|-------|----------|
| ChatAgent | 新增 surrounding 工具：`search_surrounding`、`get_surrounding_detail`、`recommend_surrounding` |
| SceneAgent | "此刻出发"场景：推荐周边夜宵/深夜娱乐 |
| RouteAgent | 路线规划：加入周边商户作为经停点 |

---

## 三、数据采集策略：爬虫 + AI 清洗自动化流水线

### 3.1 核心理念转变

> **从"人工整理 Excel"升级为"爬虫批量采集 → AI 清洗结构化 → 自动入库"的自动化流水线。**

人工不再需要逐条整理商户清单。人工的工作聚焦在：选择目标学校、选择爬取平台、审核最终数据质量。

```
┌─────────────────────────────────────────────────────────┐
│                    全自动化流水线                          │
│                                                          │
│  爬虫采集                   AI 清洗                       │
│  ┌──────────┐          ┌──────────────┐                 │
│  │大众点评   │──┐       │ 去重合并       │                 │
│  │美团      │──┤       │ 分类纠偏       │                 │
│  │高德地图   │──┤──────▶│ 评分标准化     │──▶ SQL        │
│  │百度地图   │──┤       │ 地址补全       │                 │
│  │饿了么     │──┘       │ LLM文本生成    │                 │
│  └──────────┘          │ 经纬度校验     │                 │
│       ▲                └──────┬───────┘                 │
│       │                       │                          │
│  人工只需指定：          人工最终审核：                      │
│  · 目标学校+坐标        · 数据质量抽查                     │
│  · 爬取半径             · 照片补充                        │
│  · 爬取平台选择          · 边界case处理                    │
└─────────────────────────────────────────────────────────┘
```

### 3.2 数据来源平台分析

| 平台 | 数据优势 | 爬取难度 | 建议策略 |
|------|----------|----------|----------|
| **高德地图 API** | 官方 API，经纬度精确，结构化数据 | ⭐ 低（有开放API） | **首选**，POI 搜索 + 详情查询 |
| **百度地图 API** | 类似高德，互为补充 | ⭐ 低（有开放API） | 交叉验证高德数据 |
| **大众点评** | 评价丰富、人均消费、推荐菜、真实照片 | ⭐⭐⭐ 高（强反爬） | 辅助补充，爬搜索结果页 |
| **美团** | 团购/外卖数据，价格信息准确 | ⭐⭐⭐ 高 | 辅助补充 |
| **饿了么** | 外卖商家数据 | ⭐⭐ 中 | 补充餐饮类数据 |
| **小红书** | 学生探店笔记、真实体验 | ⭐⭐⭐ 高 | 可选，用于 LLM 生成描述时的素材 |

**推荐策略：高德 API 为主力（结构化好、有官方接口），大众点评/美团为辅（补充评价和价格），小红书笔记作为 LLM 文本生成的语义素材。**

### 3.3 高德地图 API 采集方案（主力）

高德地图提供 Web API `POI 周边搜索`，无需爬虫，直接 HTTP 调用：

```
GET https://restapi.amap.com/v3/place/around?
  key=YOUR_KEY
  &location=114.3643,30.5362        ← 校园中心坐标
  &radius=3000                       ← 3km 半径
  &types=050000|060000|070000|080000  ← POI 分类码
  &offset=25                         ← 每页25条
  &page=1                            ← 分页
```

**返回字段（结构完美匹配需求）**：
```json
{
  "id": "B0FFF8XZQ2",
  "name": "海底捞火锅(街道口店)",
  "type": "餐饮服务;火锅",
  "typecode": "050100",
  "address": "珞喻路街道口未来城购物中心3层",
  "location": "114.356,30.532",
  "tel": "027-87888888",
  "distance": "850",
  "biz_ext": { "rating": "4.6", "cost": "120" },
  "photos": [{ "url": "https://..." }]
}
```

**高德 POI 分类码映射**：

| 高德分类 | typecode | → 我们的 type |
|----------|----------|--------------|
| 餐饮服务 | 050000 | `restaurant` |
| 购物服务 | 060000 | `shopping` |
| 生活服务 | 070000 | `service` |
| 体育休闲 | 080000 | `entertainment` |
| 住宿服务 | 100000 | `hotel` |
| 交通设施 | 150000 | `transport` |

**优势**：
- 官方 API，合法合规，无法律风险
- 返回结构化 JSON，无需解析 HTML
- 经纬度精确（GCJ02，需转为 WGS84）
- 自带 distance、rating、cost、photos
- 单个校园 3km 半径约 200-500 条 POI，免费额度足够

### 3.4 大众点评数据补充（辅助）

高德 API 提供的是基础 POI 数据，缺少：
- 详细用户评价文本
- 推荐菜/招牌菜
- 真实人均消费（高德的 cost 字段可能不准）
- 营业时间详细信息
- 学生优惠信息

**采集策略**：
1. 用高德返回的商户名 + 地址，拼接大众点评搜索 URL
2. 爬搜索结果页的摘要信息（评价数、人均、星级、推荐菜）
3. 不要爬全部评价详情（量大且反爬严重），只取搜索结果页摘要

**技术路线**：
- Python + Playwright（模拟浏览器，绕过部分反爬）
- 请求频率控制：3-5 秒/条
- 随机 User-Agent + 代理轮换
- 只爬必要字段，不爬全量评价

**法律风险说明**：爬取公开数据用于个人项目/学术用途一般风险可控；若未来商业化，需走官方 API 或商务合作。

### 3.5 自动化数据流水线设计

#### 完整流水线架构

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 0: 输入配置                                                │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ config.json: {                                          │     │
│  │   "schools": [{ "placeId": "place_001",                  │     │
│  │                 "name": "北京邮电大学",                   │     │
│  │                 "center": "116.3536,39.9592",           │     │
│  │                 "radius": 3000,                          │     │
│  │                 "maxItems": 0 }],  ← 0=不限量(北邮)      │     │
│  │   "sources": ["amap"],                                  │     │
│  │   "defaultMaxItems": 20,  ← 其他学校默认20条             │     │
│  │   "output": "sql/surrounding_data.sql"                  │     │
│  │ }                                                       │     │
│  └────────────────────────────────────────────────────────┘     │
│                              │                                    │
│                              ▼                                    │
│  Step 1: 高德 API 批量采集                                       │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ scripts/scrape_amap.py                                  │     │
│  │   输入: school center + radius                           │     │
│  │   输出: data/raw/amap_{placeId}.json (全量原始POI)       │     │
│  │   采集量: 每校 200-500 条（仅采集，不过滤）               │     │
│  └────────────────────────────────────────────────────────┘     │
│                              │                                    │
│                              ▼                                    │
│  Step 2: 大众点评补充采集（可选）                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ scripts/scrape_dianping.py                               │     │
│  │   输入: data/raw/amap_{placeId}.json (商户名+地址)       │     │
│  │   输出: data/raw/dianping_{placeId}.json                 │     │
│  │   说明: 仅对北邮(place_001)执行全量补充，其他学校跳过     │     │
│  └────────────────────────────────────────────────────────┘     │
│                              │                                    │
│                              ▼                                    │
│  Step 3: AI 数据清洗 & 合并                                       │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ scripts/clean_and_merge.py                               │     │
│  │   1. 多源数据去重（同名+同坐标=同一商户）                   │     │
│  │   2. 字段优先级合并（名称/坐标/人均/评分）                 │     │
│  │   3. 分类纠偏（LLM辅助）                                  │     │
│  │   4. 坐标系转换 GCJ02→WGS84                              │     │
│  │   5. 距离计算                                            │     │
│  │   输出: data/clean/{placeId}_all.json (全量清洗后)        │     │
│  └────────────────────────────────────────────────────────┘     │
│                              │                                    │
│                              ▼                                    │
│  ★ Step 4: AI 智能精选 ★（核心差异步骤）                          │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ scripts/select_best.py                                   │     │
│  │   从全量数据中精选 top N 条（北邮不限, 其他20条）:         │     │
│  │                                                          │     │
│  │   精选策略:                                                │     │
│  │   1. 按分类配额分配（美食8/购物3/娱乐3/住宿2/交通2/服务2） │     │
│  │   2. 每个分类内按 综合评分 ↓ + 距离 ↑ + 评论数 ↓ 排序     │     │
│  │   3. 确保多样性：同一连锁品牌最多保留2家                   │     │
│  │   4. LLM judge 审核：剔除质量差/描述不准确的               │     │
│  │   5. 人工可调：支持 manual_overrides.json 强制包含/排除    │     │
│  │                                                          │     │
│  │   输入: data/clean/{placeId}_all.json                     │     │
│  │   输出: data/selected/{placeId}_selected.json (精选20条)   │     │
│  └────────────────────────────────────────────────────────┘     │
│                              │                                    │
│                              ▼                                    │
│  Step 5: LLM 文本增强                                            │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ scripts/enrich_with_llm.py                               │     │
│  │   对精选后的商户调用 LLM 生成:                              │     │
│  │   · description (50-100字简介)                            │     │
│  │   · detail_description (200-300字详细介绍)                │     │
│  │   · tags (3-5个特色标签)                                  │     │
│  │   · must_try (推荐菜/必玩项目)                             │     │
│  │   · student_discount (从评价中推断是否有学生优惠)           │     │
│  │                                                          │     │
│  │   输入: data/selected/{placeId}_selected.json              │     │
│  │   输出: data/enriched/{placeId}_enriched.json             │     │
│  │   成本: 每校20条 ~ 0.03元, 全量101校 ~ 3元              │     │
│  └────────────────────────────────────────────────────────┘     │
│                              │                                    │
│                              ▼                                    │
│  Step 6: 质量校验                                                │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ scripts/validate_data.py                                 │     │
│  │   · 经纬度范围检查（中国境内）                              │     │
│  │   · 必填字段非空检查                                       │     │
│  │   · JSON 格式校验                                         │     │
│  │   · 同校园内重复检测                                       │     │
│  │   输出: data/validated/{placeId}_ok.json                   │     │
│  │        + data/rejected/{placeId}_fail.json (需人工看)      │     │
│  └────────────────────────────────────────────────────────┘     │
│                              │                                    │
│                              ▼                                    │
│  Step 7: SQL 生成                                                │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ scripts/generate_sql.py                                  │     │
│  │   输入: data/validated/*.json                             │     │
│  │   输出: sql/surrounding_schema.sql (DDL)                   │     │
│  │        sql/surrounding_data.sql (INSERT,            │     │
│  │           北邮全量 + 其他各20条)                   │     │
│  └────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### 3.5.1 关键脚本设计

#### `config.json` — 唯一需要人工编辑的文件

```json
{
  "defaultMaxItems": 20,
  "categoryQuota": {
    "restaurant":    8,
    "shopping":      3,
    "entertainment": 3,
    "hotel":         2,
    "transport":     2,
    "service":       2
  },
  "schools": [
    {
      "placeId": "place_001",
      "name": "北京邮电大学",
      "center": { "lat": 39.9592, "lng": 116.3536 },
      "radius": 3000,
      "maxItems": 0
    },
    {
      "placeId": "place_002",
      "name": "清华大学",
      "center": { "lat": 40.0005, "lng": 116.3268 },
      "radius": 3000
    }
  ],
  "amap": {
    "apiKey": "${AMAP_API_KEY}",
    "categories": ["050000", "060000", "070000", "080000", "100000", "150000"]
  },
  "llm": {
    "provider": "openai_compatible",
    "model": "deepseek-chat",
    "batchSize": 20
  },
  "selection": {
    "maxSameBrand": 2,
    "sortWeight": {
      "rating": 0.5,
      "reviewCount": 0.3,
      "distance": 0.2
    }
  }
}
```

`maxItems: 0` 表示不限量（仅北邮），其他学校默认 20 条。

#### `manual_overrides.json` — 人工微调（可选）

```json
{
  "place_001": {
    "force_include": ["海底捞火锅(枫蓝国际店)"],
    "force_exclude": ["某某已倒闭店铺"],
    "replace_name": { "阿三生煎(学院路店)": "阿三生煎·北邮学子第二食堂" }
  }
}
```

人工可以强制包含/排除特定商户，或修正名称，无需手动编辑 SQL。

#### `select_best.py` — AI 智能精选（新增关键脚本）

```python
"""
从全量 POI 数据中精选 top N 条
策略：分类配额 + 综合评分 + 多样性保证 + LLM judge
"""
import json
from collections import defaultdict

def select_best(records, place_id, max_items=20, quota=None, overrides=None):
    """
    精选逻辑：
    1. 按分类分组
    2. 每类按综合得分排序 (rating * 0.5 + log(reviewCount) * 0.3 - distance_km * 0.2)
    3. 取每类 top quota 条
    4. 去重：同一连锁品牌同校园最多保留 maxSameBrand 条
    5. 应用 manual_overrides（强制包含/排除）
    6. LLM judge 最终审核（可选，仅对边缘case）
    """
    if quota is None:
        quota = {"restaurant": 8, "shopping": 3, "entertainment": 3,
                 "hotel": 2, "transport": 2, "service": 2}
    if overrides is None:
        overrides = {}

    # 应用 force_exclude
    exclude_names = set(overrides.get("force_exclude", []))
    records = [r for r in records if r["name"] not in exclude_names]

    # 按分类分组
    by_category = defaultdict(list)
    for r in records:
        by_category[r["type"]].append(r)

    # 每类内排序 + 截取
    selected = []
    for cat, cat_records in by_category.items():
        # 计算综合得分
        for r in cat_records:
            r["_score"] = (
                float(r.get("rating", 0)) * 0.5 +
                min(float(r.get("review_count", 0)), 100) / 100 * 0.3 -
                float(r.get("distance_meters", 0)) / 3000 * 0.2
            )

        # 按分数降序排序
        cat_records.sort(key=lambda x: x["_score"], reverse=True)

        # 去同品牌（同名关键词匹配）
        selected_cat = []
        brand_counts = defaultdict(int)
        for r in cat_records:
            brand = extract_brand(r["name"])  # 提取品牌名
            if brand_counts[brand] >= 2:  # maxSameBrand
                continue
            selected_cat.append(r)
            brand_counts[brand] += 1
            if len(selected_cat) >= quota.get(cat, 20):
                break

        selected.extend(selected_cat)

    # 应用 force_include
    for name in overrides.get("force_include", []):
        if not any(s["name"] == name for s in selected):
            full_record = find_by_name(records, name)
            if full_record:
                selected.append(full_record)

    # 应用名称替换
    name_map = overrides.get("replace_name", {})
    for s in selected:
        if s["name"] in name_map:
            s["name"] = name_map[s["name"]]

    return selected

def extract_brand(name):
    """从商户全名提取品牌名：'海底捞火锅(枫蓝国际店)' -> '海底捞火锅'"""
    import re
    return re.sub(r'[\(（].*?[\)）]|[店铺]|[路街]号.*', '', name).strip()
```

#### `scrape_amap.py` — 主力采集脚本

```python
"""
高德地图 POI 周边搜索 → 结构化 JSON
单校 3km 半径 → 200-500 条 POI，耗时 ~30 秒
"""
import requests
import json
import time
from pathlib import Path

AMAP_AROUND_URL = "https://restapi.amap.com/v3/place/around"

def scrape_school(config_entry, api_key, output_dir):
    """采集单个学校的周边 POI"""
    all_pois = []

    for category in config_entry.get("keywords", []):
        # 映射到高德 category code
        poitype = CATEGORY_MAP.get(category, "")
        page = 1

        while True:
            params = {
                "key": api_key,
                "location": f"{config_entry['center']['lng']},{config_entry['center']['lat']}",
                "radius": config_entry["radius"],
                "types": poitype,
                "offset": 25,
                "page": page,
                "extensions": "all"  # 返回详细信息
            }
            resp = requests.get(AMAP_AROUND_URL, params=params)
            data = resp.json()

            if data["status"] != "1" or not data.get("pois"):
                break

            all_pois.extend(data["pois"])

            # 高德 API 最多返回 1000条（25*40页）
            total = int(data.get("count", 0))
            if page * 25 >= total or page >= 40:
                break
            page += 1
            time.sleep(0.1)  # 遵守限速

    # 保存原始数据
    output_path = Path(output_dir) / f"amap_{config_entry['placeId']}.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_pois, f, ensure_ascii=False, indent=2)

    print(f"[{config_entry['name']}] 采集完成: {len(all_pois)} 条 POI")
    return all_pois

# 高德 POI 分类 → 我们的 type
CATEGORY_MAP = {
    "美食": "050000",
    "购物": "060000",
    "生活": "070000",
    "娱乐": "080000",
    "酒店": "100000",
    "交通": "150000"
}
```

#### `clean_and_merge.py` — AI 清洗核心

```python
"""
多源数据合并 + AI 清洗
核心逻辑：
  1. 坐标聚类去重（50m 内视为同一商户）
  2. 字段优先级合并
  3. LLM 辅助分类纠偏
"""
from geopy.distance import geodesic
from collections import defaultdict
import json
import openai

def deduplicate_by_proximity(records, threshold_meters=50):
    """基于坐标的去重：50米内同名的记录合并"""
    clusters = defaultdict(list)
    for r in records:
        key = (r["name"].strip(), round(r["lat"], 4), round(r["lng"], 4))
        clusters[key].append(r)
    return clusters

def merge_sources(amap_records, dianping_records=None, meituan_records=None):
    """
    多源合并策略：
    - 名称: 大众点评（跟实际招牌一致） > 高德 > 美团
    - 坐标: 高德（GPS最准） > 百度 > 大众点评
    - 人均: 大众点评 > 美团 > 高德
    - 评分: 大众点评（评价基数大） > 高德 > 美团
    - 电话: 高德 > 大众点评 > 美团
    """
    # 以高德数据为主干（坐标最精确）
    merged = []
    for amap_poi in amap_records:
        m = {
            "id": None,  # 后续分配
            "name": amap_poi["name"],
            "source_lat": amap_poi["location"].split(",")[1],
            "source_lng": amap_poi["location"].split(",")[0],
            "address": amap_poi.get("address", ""),
            "phone": amap_poi.get("tel", ""),
            "source_rating": amap_poi.get("biz_ext", {}).get("rating", ""),
            "source_cost": amap_poi.get("biz_ext", {}).get("cost", ""),
            "source_type": amap_poi.get("type", ""),
            "source": "amap"
        }

        # 如果大众点评有匹配项，覆盖名称/人均/评分
        if dianping_records:
            dp_match = find_match(m, dianping_records)
            if dp_match:
                m["name"] = dp_match.get("name", m["name"])
                m["avg_cost"] = dp_match.get("avg_cost", m["source_cost"])
                m["rating"] = dp_match.get("rating", m["source_rating"])
                m["review_count"] = dp_match.get("review_count", 0)
                m["recommend_dishes"] = dp_match.get("recommend_dishes", [])
                m["source"] += "+dianping"

        merged.append(m)

    return merged
```

#### `enrich_with_llm.py` — LLM 批量文本生成

```python
"""
批量调用 LLM 生成描述文本
每次调用处理 20 条（batch），控制成本和速度

预估成本（以 deepseek-chat 为例）：
  - 每条商户 ~600 output tokens
  - 1000 条 × 600 tokens = 60万 tokens
  - deepseek-chat: 输入 1元/百万tokens, 输出 2元/百万tokens
  - 总成本: ~1.5 元人民币
"""
import json
from openai import OpenAI

SYSTEM_PROMPT = """你是一个旅游数据编辑，负责为校园周边的商户撰写介绍。

请为每条商户生成以下字段：
1. description: 50-100字简介，突出特色和亮点
2. detail_description: 200-300字详细介绍，包含环境、服务、推荐理由
3. tags: 3-5个特色标签（JSON数组），如 ["学生友好","深夜营业","网红打卡"]
4. must_try: 必点/必玩推荐（15字以内），若无则为null
5. student_discount: 推断是否有学生优惠 (true/false)
6. price_range: 价格区间 ¥/¥¥/¥¥¥

输出格式（每条一行JSON）：
{"name":"商户名","description":"...","detail_description":"...","tags":[...],"must_try":"...","student_discount":false,"price_range":"¥¥"}
"""

def enrich_batch(merchants, client, model="deepseek-chat"):
    """批量生成商户文本描述"""
    user_prompt = "请为以下商户生成描述文本：\n\n"
    for i, m in enumerate(merchants):
        user_prompt += f"{i+1}. {m['name']} | 类型:{m.get('type','')} | "
        user_prompt += f"地址:{m.get('address','')} | "
        user_prompt += f"人均:{m.get('avg_cost','未知')}元 | "
        user_prompt += f"评分:{m.get('rating','未知')}\n"

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.7,
        max_tokens=4000
    )

    # 解析返回的 JSON 行
    results = []
    for line in response.choices[0].message.content.strip().split("\n"):
        try:
            results.append(json.loads(line))
        except json.JSONDecodeError:
            continue

    return results
```

#### `validate_data.py` — 自动化质量检查

```python
"""
数据质量三层校验
输出: validated.json + rejected.json
"""
import json
import re

def validate_record(record):
    errors = []

    # Layer 1: 格式检查
    if not record.get("name") or len(record["name"]) < 2:
        errors.append("名称过短或缺失")
    if not (-90 <= float(record.get("lat", 999)) <= 90):
        errors.append("纬度越界")
    if not (-180 <= float(record.get("lng", 999)) <= 180):
        errors.append("经度越界")

    # Layer 2: 合理性检查（中国境内）
    lat, lng = float(record.get("lat", 0)), float(record.get("lng", 0))
    if not (18 <= lat <= 54) or not (73 <= lng <= 135):
        errors.append(f"坐标不在中国境内: ({lat}, {lng})")

    # Layer 3: JSON 格式
    for field in ["tags"]:
        if field in record and isinstance(record[field], str):
            try:
                json.loads(record[field])
            except:
                errors.append(f"{field} 不是合法JSON")

    return errors

def validate_all(input_path, output_dir):
    with open(input_path, "r", encoding="utf-8") as f:
        records = json.load(f)

    passed, rejected = [], []
    for r in records:
        errs = validate_record(r)
        if errs:
            r["_errors"] = errs
            rejected.append(r)
        else:
            passed.append(r)

    print(f"✅ 通过: {len(passed)} 条")
    print(f"❌ 拒绝: {len(rejected)} 条")
    if rejected:
        print("请人工审核 data/rejected/ 中的记录")

    # 保存
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    with open(f"{output_dir}/validated.json", "w") as f:
        json.dump(passed, f, ensure_ascii=False, indent=2)
    with open(f"{output_dir}/rejected.json", "w") as f:
        json.dump(rejected, f, ensure_ascii=False, indent=2)
```

### 3.6 人工角色重新定义

在爬虫+AI流水线下，**人工工作大幅减少**：

| 阶段 | 人工任务 | 预估耗时 |
|------|----------|----------|
| 配置 | 选择目标学校 + 填写 config.json | 10 分钟/校 |
| 爬取中 | 可能需要手动过验证码（大众点评） | 5-10 分钟/校 |
| 清洗后 | 审核 rejected.json（通常 <5% 的记录） | 10 分钟 |
| 入库前 | 抽查 5-10 条数据质量 | 5 分钟 |
| 图片 | 拍摄或搜索高质量商户照片 | 30-60 分钟/校 |
| **合计（每校）** | | **1-1.5 小时** |

对比原方案人工 4-6 小时/校，**效率提升 3-4 倍**。

### 3.7 图片采集策略

图片是整个数据流水线中最难自动化的部分。两种方案结合：

| 方案 | 来源 | 优势 | 劣势 |
|------|------|------|------|
| **高德 API 图片** | `photos` 字段返回的 URL | 免费、自动化、合法 | 图片小、质量一般 |
| **人工补充** | 大众点评/美团商户头图 | 质量高、有食欲 | 需手动下载 |
| **AI 生成** | DALL-E/Midjourney | 无版权风险 | 不真实、不推荐 |

**建议策略**：优先使用高德 API 返回的图片作为封面，人工替换重点商户（top 20%）的高清照片。

---

## 四、AI + 人工协作开发策略

### 4.1 代码生成策略

| 层级 | 生成方式 | 说明 |
|------|----------|------|
| 爬虫脚本 | AI 生成 | Python 脚本：高德 API / 大众点评 Playwright |
| 清洗脚本 | AI 生成 | 去重、合并、校验逻辑 |
| LLM 增强脚本 | AI 生成 | 批量 LLM 调用 + 结果解析 |
| Entity (`SpotSurrounding.java`) | AI 生成 | 参考现有 `SpotFacility.java` 风格 |
| Mapper (`SurroundingMapper.java`) | AI 生成 | MyBatis-Plus 标准写法 |
| Service 接口 + Impl | AI 生成 | 参考 `FacilityServiceImpl` 的 LBS 查询模式 |
| Controller | AI 生成 | 标准 REST CRUD，参考 `FacilityController` |
| 前端页面 | AI 生成 | React + Ant Design，参考 `FoodSearchPage` 布局 |
| Agent 工具 | AI 生成 | Python tool 函数，注册到 `registry.py` |
| Agent 提示词 | AI 生成 | 在 `prompts.py` 中新增周边推荐提示词段落 |
| 测试代码 | AI 生成 | MockMvc 集成测试，参考现有 `AgentServiceTests` |
| SQL 数据脚本 | **脚本自动生成** | `generate_sql.py` 输出完整 INSERT |

### 4.2 人力投入对比

| 任务 | 原方案（人工） | 新方案（爬虫+AI） | 节省 |
|------|-------------|-----------------|------|
| 商户清单整理 | 4-6h/校 | **10min/校** (写config) | **95%** |
| 文本描述撰写 | 不可行（量太大） | **全自动** LLM生成 | **100%** |
| 坐标获取 | 需人工查地图 | **全自动** 高德API | **100%** |
| 数据校验 | 2-3h | **10min** (审核rejected) | **92%** |
| 图片收集 | 30-60min/校 | 30-60min/校（不变） | 0% |

**核心洞察**：图片是唯一无法被 AI 廉价替代的环节，其余全部自动化。

### 3.3 代码生成策略

| 层级 | 生成方式 | 说明 |
|------|----------|------|
| Entity (`SpotSurrounding.java`) | AI 生成 | 参考现有 `SpotFacility.java` 风格 |
| Mapper (`SurroundingMapper.java`) | AI 生成 | MyBatis-Plus 标准写法 |
| Service 接口 + Impl | AI 生成 | 参考 `FacilityServiceImpl` 的 LBS 查询模式 |
| Controller | AI 生成 | 标准 REST CRUD，参考 `FacilityController` |
| 前端页面 | AI 生成 | React + Ant Design，参考 `FoodSearchPage` 布局 |
| Agent 工具 | AI 生成 | Python tool 函数，注册到 `registry.py` |
| Agent 提示词 | AI 生成 | 在 `prompts.py` 中新增周边推荐提示词段落 |
| 测试代码 | AI 生成 | MockMvc 集成测试，参考现有 `AgentServiceTests` |
| SQL 数据脚本 | **脚本生成** | Python 脚本读取种子数据 → 调用 LLM → 输出 SQL |

**关键原则：AI 生成所有代码，人工只审核不手写。**

---

## 四、实施计划

### 4.1 总体阶段

```
Phase 1: 数据层（2天）
  ├── 设计 spot_surrounding 表结构
  ├── 人工整理 3-5 所学校的周边种子数据（CSV）
  ├── AI 批量补全：地理编码 + 文本生成
  ├── 人工审核 + 图片收集
  └── 生成最终 SQL 脚本

Phase 2: 后端（2天）
  ├── Entity + Mapper + Service + Controller 全栈 CRUD
  ├── LBS 附近搜索（参考 FacilityService）
  ├── 集成测试
  └── Swagger 验证

Phase 3: 前端（2天）
  ├── SurroundingPage（分类Tab + 列表）
  ├── SurroundingDetailPage（详情 + 图片轮播 + 地图）
  ├── PlaceDetailPage 改造（新增"周边"Tab）
  ├── HomePage 改造（周边热门推荐卡片）
  └── MixedSearchPage 改造（搜索结果混合）

Phase 4: Agent 集成（1天）
  ├── 新增 surrounding 工具函数（tourism_api.py）
  ├── ChatAgent 提示词扩展
  ├── SceneAgent 周边场景
  └── SSE 流式测试

Phase 5: 测试 + 上线（1天）
  ├── 全栈集成测试
  ├── 性能测试（分页/LBS查询）
  └── 启动验证
```

### 4.2 详细任务拆解

#### Phase 1: 数据采集流水线

| # | 任务 | 产出 | 负责 | 耗时 |
|---|------|------|------|------|
| 1.1 | 编写 `config.json`（校园坐标+半径，北邮不限量） | 配置文件 | **人工** | 30min |
| 1.2 | 编写 `scrape_amap.py`（高德 API 批量采集） | 爬虫脚本 | AI | 30min |
| 1.3 | 运行采集脚本，获取全量原始 POI | `data/raw/amap_{placeId}.json` | AI 自动 | 1min/校 |
| 1.4 | 编写 `scrape_dianping.py`（仅北邮执行，可选） | 爬虫脚本 | AI | 1h |
| 1.5 | 运行大众点评采集（需人工过验证码） | `data/raw/dianping_place_001.json` | **人工陪跑** | 10min |
| 1.6 | 编写 `clean_and_merge.py`（多源去重合并） | 清洗脚本 | AI | 1h |
| 1.7 | 运行清洗脚本 | `data/clean/{placeId}_all.json` | AI 自动 | <1min |
| 1.8 | 编写 `select_best.py`（**AI 智能精选每校20条**） | 精选脚本 | AI | 1h |
| 1.9 | 运行精选脚本 | `data/selected/{placeId}_selected.json` | AI 自动 | <1min |
| 1.10 | 编写 `manual_overrides.json`（微调精选结果） | 人工微调 | **人工** | 20min |
| 1.11 | 编写 `enrich_with_llm.py`（LLM批量文本生成） | 增强脚本 | AI | 1h |
| 1.12 | 运行 LLM 增强 | `data/enriched/{placeId}_enriched.json` | AI 自动 | ~10min/全量 |
| 1.13 | 编写 `validate_data.py`（自动质量检查） | 校验脚本 | AI | 30min |
| 1.14 | 运行校验 + 人工审核 rejected | 通过/拒绝清单 | **人工**（<5%） | 10min |
| 1.15 | 编写 `generate_sql.py`（自动生成SQL） | SQL生成脚本 | AI | 30min |
| 1.16 | 运行脚本生成最终 SQL | `surrounding_schema.sql` + `surrounding_data.sql` | AI 自动 | <1min |
| 1.17 | 人工收集/补充重点商户照片 | `uploads/images/surrounding/` | **人工** | 30-60min |

#### Phase 2: 后端

| # | 任务 | 产出 | 说明 |
|---|------|------|------|
| 2.1 | 创建 `SpotSurrounding.java` Entity | entity 文件 | 参考 SpotFacility 风格，Lombok 简化 getter/setter |
| 2.2 | 创建 `SurroundingMapper.java` | Mapper 接口 | MyBatis-Plus BaseMapper |
| 2.3 | 创建 `SurroundingService.java` 接口 | Service 接口 | 定义 8 个业务方法 |
| 2.4 | 实现 `SurroundingServiceImpl.java` | Service 实现 | 含 LBS 附近搜索（Haversine公式） |
| 2.5 | 创建 `SurroundingController.java` | REST Controller | 8 个端点（见 API 设计） |
| 2.6 | 扩展 `PlaceService`：校园详情添加周边摘要 | 修改 `PlaceServiceImpl` | `getPlaceDetail()` 附带周边分类计数 |
| 2.7 | 编写集成测试 `SurroundingIntegrationTests.java` | 测试类 | H2 内存数据库，覆盖所有端点 |
| 2.8 | 更新 Swagger 文档 tag | 配置 | ApiResponses 注解 |

#### Phase 3: 前端

| # | 任务 | 产出 | 说明 |
|---|------|------|------|
| 3.1 | 新增 `api.js` 中 surrounding 相关 API 函数 | API 层 | `getSurroundings()` / `getSurroundingDetail()` 等 |
| 3.2 | 创建 `SurroundingPage.jsx` | 新页面 | 分类 Tab 切换 + 卡片列表 + 筛选排序 |
| 3.3 | 创建 `SurroundingDetailPage.jsx` | 新页面 | 图片轮播 + 信息面板 + 地图 Marker + 评分 |
| 3.4 | 改造 `PlaceDetailPage.jsx`：新增"周边"Tab | 改造 | 嵌入周边分类卡片 + "查看更多"跳转 |
| 3.5 | 改造 `HomePage.jsx`：新增"校园周边热门" | 改造 | 横向滚动卡片 |
| 3.6 | 改造 `MixedSearchPage.jsx`：搜索结果混合 | 改造 | 搜索结果中混合展示周边商户 |
| 3.7 | 新增路由 + 导航入口 | 路由配置 | React Router 新增 2 条路由 |

#### Phase 4: Agent 集成

| # | 任务 | 产出 | 说明 |
|---|------|------|------|
| 4.1 | 新增 `search_surrounding` 工具函数 | `tourism_api.py` 新增函数 | 封装 `/api/surroundings/search` |
| 4.2 | 新增 `get_surrounding_detail` 工具函数 | `tourism_api.py` 新增函数 | 封装 `/api/surroundings/{id}` |
| 4.3 | 工具注册到 `registry.py` | 注册函数 | OpenAI function calling 格式 |
| 4.4 | 扩展 `prompts.py`：周边推荐提示词 | 提示词段落 | 6 种类别推荐话术 |
| 4.5 | ChatAgent 周边推荐能力 | `chat_agent.py` 微调 | 新增 intent 分支或 tool 调用流程 |
| 4.6 | SceneAgent 周边场景 | `scene_agent.py` 扩展 | "深夜饿了吃什么" → 搜索周边深夜营业美食 |

#### Phase 5: 测试 + 上线

| # | 任务 | 说明 |
|---|------|------|
| 5.1 | 全栈启动：backend + frontend + agent | `scripts/start-all.sh` |
| 5.2 | Swagger UI 手动验证所有 API | http://localhost:8080/swagger-ui.html |
| 5.3 | 前端页面截图验证 | 关键页面截图 |
| 5.4 | 性能验证：分页查询 < 200ms, LBS 查询 < 500ms | 数据库索引确认 |
| 5.5 | Agent SSE 流式对话验证 | 问"武大周边有什么好吃的" |

### 4.3 首批覆盖学校建议

建议从系统中已有的 101 所校园中选择 3-5 所数据最容易获取的先行覆盖：

| 优先级 | 选择标准 | 建议数量 |
|--------|----------|----------|
| P0 | 开发者熟悉的校园（方便人工验证数据） | 1-2 所 |
| P1 | 大型综合性大学（周边商业发达） | 1-2 所 |
| P2 | 城市中心校区（周边数据丰富） | 1 所 |

---

## 五、高质量保证措施

### 5.1 数据质量三层校验

```
Layer 1: AI 自动校验（生成时）
  ├── 经纬度范围检查（中国境内 18-54° / 73-135°）
  ├── JSON 格式校验（tags 必须是合法 JSON 数组）
  ├── 字段非空检查（必填字段不能为 NULL）
  ├── 地址-坐标一致性（逆地理编码后比对城市名）
  └── 重复检查（同校园+同名称+同坐标 = 重复）

Layer 2: 人工抽查（生成后）
  ├── 每种类型抽查 3-5 条
  ├── description 是否准确描述该商户
  ├── tags 是否贴切
  └── 人均消费是否合理

Layer 3: 线上监控（上线后）
  ├── 用户评分反馈（低分预警）
  ├── 点击率异常检测（描述不符导致的高点击低评分）
  └── 定期数据刷新（商户可能关门/搬迁）
```

### 5.2 代码质量保障

| 措施 | 说明 |
|------|------|
| 参考现有代码风格 | Entity/Mapper/Service/Controller 严格遵循现有模式 |
| 单元测试覆盖 | 所有 Service 方法 + Controller 端点 |
| API 响应格式一致 | `Result<T>` 封装，与现有接口统一 |
| 前端组件复用 | 复用 `ImageCard`、`ScrollRow`、`LazyImage` 等现有 UI 组件 |
| MyBatis-Plus 分页 | 使用 `Page<T>` 插件，与现有分页一致 |

### 5.3 防止常见错误

| 常见错误 | 预防措施 |
|----------|----------|
| 经纬度偏移（GCJ02 vs WGS84） | 统一使用 WGS84，与现有 spot_place 坐标系一致 |
| N+1 查询问题 | place 信息 JOIN 查询，不走 N+1 |
| 图片路径不一致 | 使用与现有系统相同的 `uploads/images/` 路径规范 |
| 前端 JSON 解析失败 | tags/images 字段后端返回时确保是 JSON 字符串，前端 normalize |
| Agent tool 超时 | surrounding tool 设置合理的 timeout（3s） |

---

## 六、与现有系统的集成点

### 6.1 搜索集成

```
用户搜索 "火锅"
    │
    ▼
┌─────────────────────────────────────────┐
│ SearchService.search("火锅")             │
│                                          │
│  ├── spot_place (景点/校园)              │ → "重庆火锅博物馆"（景区）
│  ├── spot_food (校内美食)               │ → "学一食堂·火锅窗口"（校内）
│  ├── spot_surrounding (周边)     ← NEW   │ → "海底捞(街道口店)"（周边）
│  └── spot_facility (校内设施)            │ → (无匹配)
│                                          │
│  返回混合搜索结果，按相关度排序            │
└─────────────────────────────────────────┘
```

### 6.2 推荐系统集成

现有 `RecommendationAlgorithm` 基于 TF-IDF + 协同过滤，新数据通过以下方式接入：

- `SpotSurrounding.tags` 和 `SpotSurrounding.description` 参与 TF-IDF 向量计算
- 用户对 surrounding 的评分计入协同过滤矩阵
- 推荐结果中新增 `"surrounding"` 类型的推荐项

### 6.3 导航集成

- 校园周边商户可作为导航的起点/终点/经停点
- 复用现有 `AmapNavigationService` 的步行/骑行/驾车路径规划

### 6.4 运营数据集成

- UserBehavior 记录新增 `target_type = "surrounding"` 类型
- 统计看板（StatsPage）新增"热门周边"板块
- 用户画像（PersonaAgent）加入周边消费偏好维度

---

## 七、扩展路线图（后续迭代）

### 7.1 近期（本次实现）
- 校园周边基础数据 + CRUD + 前端页面
- Agent 基础周边推荐能力

### 7.2 中期（下一迭代）
- 用户评论/晒图（UGC 内容）
- 周边商户收藏/打卡功能
- 学生优惠专区（筛选 `student_discount=1`）
- 基于用户位置的"最近周边"推荐

### 7.3 远期
- 周边商户实时排队/等位信息（接入美团/大众点评 API）
- 外卖直达（跳转美团/饿了么）
- 周边商户优惠券系统
- 社区运营：学生探店笔记/攻略

---

## 八、工作量估算

| 阶段 | AI 工作量 | 人工工作量 | 总时长 |
|------|----------|-----------|--------|
| Phase 1: 数据采集流水线 | 5-6h（6个脚本） | 1-1.5h（配置+overrides+审核+图片） | **6-7.5h** |
| Phase 2: 后端 CRUD | 3-4h（全栈CRUD+测试） | 0.5h（代码审核） | **3.5-4.5h** |
| Phase 3: 前端页面 | 4-6h（页面+改造） | 0.5h（UI审核） | **4.5-6.5h** |
| Phase 4: Agent 集成 | 2-3h（工具+提示词） | 0h | **2-3h** |
| Phase 5: 测试上线 | 1-2h（测试+修复） | 1h（验证） | **2-3h** |
| **合计** | **15.5-21h** | **3.5-4h** | **19-25h** |

### 与原方案对比

| 维度 | 原方案（人工整理） | 新方案（爬虫+AI） | 改进 |
|------|-----------------|-----------------|------|
| 人工时间 | 6-8h | 3.5-4h | **↓ 44%** |
| 数据规模 | 每校 30-50 条 | 每校 200-500 条 | **↑ 10x** |
| 数据质量 | 依赖人工经验 | 多源交叉验证 + AI 校验 | **↑ 显著提升** |
| 可扩展性 | 新增学校需人工重做 | 改 config.json 一键跑 | **质的飞跃** |

### 关键依赖

| 依赖项 | 负责方 | 说明 |
|--------|--------|------|
| 高德地图 API Key | 已有（`AmapProperties`） | 免费版日配额 30万次，单校用~20次 |
| LLM API (DeepSeek/OpenAI) | 已有（`agent-service/.env`） | 1000条文本生成约需 1.5元 |
| 大众点评数据爬取 | AI + 人工（过验证码） | 可选，不做也能用高德数据跑通 |
| 商户照片（重点商户） | **人工** | 唯一无法被AI替代的环节 |

---

## 九、总结

### 核心原则

1. **AI 优势最大化**：代码生成、文本描述、坐标计算、格式校验 — 全部由 AI 完成
2. **人工聚焦不可替代的工作**：商户清单整理、图片拍摄、数据审核 — 这些需要真实经验和判断力
3. **新建优于魔改**：新建 `spot_surrounding` 表，保持数据边界清晰，不破坏现有功能
4. **风格一致第一**：新代码严格遵循现有代码风格，用户看不出哪些是 AI 写的
5. **分阶段交付**：先跑通 3-5 所学校 → 验证效果 → 再批量扩展

### 成功的定义

> 一个来到武汉大学旅游的用户，打开 App 搜索"周边美食"，能看到校门口 3km 内的所有餐饮选择，能按距离/评分/人均排序，能看到详细描述和学生优惠信息，能一键导航过去。AI 助手能回答"武大附近有什么好吃的火锅？"

这就是本次扩展要达到的目标。
