# 北邮周边数据前端未展现 — 问题分析报告

> **报告日期**: 2026-06-10  
> **问题描述**: 校园周边大规模数据扩展后，北京邮电大学（place_001）作为数据量最大（200条真实POI）的主要数据源，在前端完全没有展现，在目的地栏目中也无入口。

---

## 一、问题现象概述

| 维度 | 预期行为 | 实际表现 |
|------|---------|---------|
| 目的地列表（`/location-search`） | 应能看到"北京邮电大学"卡片 | 未确认（见根因分析） |
| 首页搜索下拉（SearchDropdown） | 输入"北邮"应返回结果 | 仅依赖后端搜索 API |
| 侧边栏导航 | 应有"校园周边"入口 | **无此入口** |
| Place 详情页周边板块 | 进入北邮详情页后可看 200 条周边 | 需要先找到北邮条目 |
| 周边独立页面（`/surrounding/place_001`） | 可展示 200 条周边 | 无导航入口可达 |

---

## 二、根因分析

### 根因 #1（最可能）：SQL 数据文件未在生产数据库执行

**证据链：**

1. `sql/data.sql`（739KB, 301条 `spot_place` INSERT）包含 `place_001`（北京邮电大学）
2. `sql/surrounding_data.sql`（BUPT 专属 200 条 `spot_surrounding` INSERT）
3. `sql/scenic_surrounding_data.sql`（200 景区 × 20 条 = 4,000 条）
4. 这三份 SQL 文件是**静态文件**，需要手动通过 MySQL 客户端执行导入

**代码证据：**
```
sql/
├── schema.sql                      ← 全量表结构 DDL
├── data.sql                        ← 301 条场所 INSERT（含 place_001）
├── surrounding_schema.sql          ← 周边表 DDL
├── surrounding_data.sql            ← 北邮 200 条周边 INSERT
└── scenic_surrounding_data.sql     ← 景区 4,000 条周边 INSERT
```

**与测试环境的区别：**
- 测试环境使用 `src/test/resources/schema.sql` + `src/test/resources/data.sql`（H2 内存库），与生产 SQL 目录**完全独立**
- CLAUDE.md 明确说明："Tests use `src/test/resources/schema.sql` + `data.sql` for H2 in-memory setup"
- 生产环境需要**手动执行** `sql/` 目录下的文件

**判定标准：** 如果后端 `GET /api/places?page=1&size=1000` 返回的记录数 < 301，则确认此根因。

---

### 根因 #2：目的地列表页缺少"周边数据丰富度"标识

**代码位置：** `frontend/src/pages/LocationSearchPage.jsx`

当前每个目的地卡片展示内容：
- 图片 → 名称 → 评分 → 描述

缺失的信息：
- **没有周边 POI 数量标识**（如 "200 家周边" badge）
- **没有"查看周边"快捷入口**

**影响：** 即使 BUPT 在列表中，用户也无法从卡片上看到它有 200 条周边数据，所有目的地看起来完全一样。BUPT 的差异化价值完全不可见。

**代码证据（LocationSearchPage.jsx:95-121）：**
```jsx
{paginated.map((item) => (
  <div key={item.id} onClick={() => navigate(`/places/${item.id}`)}>
    {/* 只有 图片 + 类型标签("景点") + 名称 + 评分 + 描述 */}
    <span>景点</span>  {/* ← 所有地点统一标为"景点" */}
    <h3>{item.name}</h3>
    <StarRating value={item.rating || 0} />
    {/* 没有任何周边数据提示 */}
  </div>
))}
```

---

### 根因 #3：缺少"校园周边"一级导航入口

**代码位置：** `frontend/src/utils/constants.js:9-16`

当前侧边栏导航结构：
```javascript
NAV_ITEMS = [
  { key: 'home',         label: '首页',     path: '/' },
  { key: 'destinations', label: '目的地',   path: '/location-search' },
  { key: 'diaries',      label: '游记',     path: '/diaries' },
  { key: 'navigation',   label: '导航',     path: '/navigation' },
  { key: 'assistant',    label: 'AI 助手',  path: '/travel-assistant' },
  { key: 'stats',        label: '统计',     path: '/stats' },
]
```

**缺失：** 没有 `校园周边` 或 `周边发现` 入口。周边数据只能通过"先找到地点 → 点击进入详情页 → 下滑到周边板块"的三级路径到达，可发现性极差。

**影响范围：** 4,200 条 `spot_surrounding` 数据（BUPT 200 + 200景区×20）对普通用户**完全不可见**，除非用户恰好导航到正确的地点详情页。

---

### 根因 #4：首页搜索下拉无法发现周边数据

**代码位置：** `frontend/src/components/SearchDropdown.jsx` → `searchAPI.globalSearch()`

搜索下拉的流程：
```
SearchDropdown
  → searchAPI.globalSearch(query)
    → Promise.allSettled([
        placeAPI.searchPlaces(query),    // GET /api/places/search?query=...
        diaryAPI.searchDiaries(query),   // GET /api/diaries/search?query=...
      ])
    → 分别返回 places + diaries
    → 合并展示（最多 3 places + 3 diaries）
```

**问题：**
1. 搜索下拉**不搜索周边数据**（`spot_surrounding`），即使用户搜索"北邮 火锅"，也只会返回地点名和游记，不会返回周边商户
2. 前端 `searchAPI.globalSearch` 只调用了 `placeAPI.searchPlaces` 和 `diaryAPI.searchDiaries`，完全没有调用 `surroundingAPI.search()`

---

### 根因 #5：北邮在一众地点中缺乏"主角"定位

**数据事实：**
- 北邮（place_001）周边数据量：**200 条**（来自高德地图真实 POI + LLM 增强描述）
- 200 个景区（place_102~place_301）周边数据量：各 **20 条**（纯 LLM 生成的简略版）
- BUPT 是系统中数据最丰富的目的地，但前端没有任何差异化呈现

**前端表现：**
- `LocationSearchPage` 对所有地点使用**相同的卡片模板**
- `type` 字段统一被硬编码标签 "景点"（第 110 行 `<span>景点</span>`）
- 北邮的 `type = '校园'` 与其他学校的卡片完全无法区分

---

## 三、完整数据流追踪

```
                         ┌─────────────────────────────────┐
                         │  MySQL (tourism_db)              │
                         │  ├── spot_place (301 rows)       │
                         │  │   └── place_001 北京邮电大学   │
                         │  └── spot_surrounding (? rows)   │
                         │      └── place_001 → 200条 POI   │ ← 如果 SQL 未执行,此处为空
                         └──────────────┬──────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
              PlaceController    SurroundingController   SearchController
              GET /api/places    GET /api/surroundings   (不存在,由place+diary拼装)
                    │                   │                   │
                    ▼                   ▼                   ▼
         LocationSearchPage    SurroundingPage        SearchDropdown
         (301条全部,分页9条)   /surrounding/:placeId  (仅查place+diary)
                    │                   │                   │
                    ▼                   ▼                   ▼
           北邮是否出现取决于         需要先知道          不搜索周边数据
           SQL是否已执行              placeId=place_001
```

---

## 四、影响范围评估

| 问题 | 严重程度 | 影响 |
|------|---------|------|
| SQL 文件未执行 | 🔴 **Critical** | BUPT 及周边全部数据完全不存在于数据库 |
| 无周边导航入口 | 🟠 **High** | 4,200 条周边数据可发现性为 0 |
| 搜索不包含周边 | 🟠 **High** | 用户无法通过搜索找到周边商户 |
| 卡片无周边标识 | 🟡 **Medium** | BUPT 的差异化优势完全不可见 |
| 硬编码"景点"标签 | 🟡 **Medium** | 校园/景区/公园等类型无法区分 |

---

## 五、修复建议优先级

### P0 — 紧急确认
1. **验证数据库状态** — 执行以下 SQL 确认数据是否存在：
   ```sql
   SELECT COUNT(*) FROM spot_place;          -- 预期: 301
   SELECT COUNT(*) FROM spot_surrounding;    -- 预期: 4200
   SELECT * FROM spot_place WHERE id = 'place_001';  -- 预期: 1 row
   SELECT COUNT(*) FROM spot_surrounding WHERE place_id = 'place_001';  -- 预期: 200
   ```
   如果任一查询返回 0，**立即执行对应 SQL 文件导入数据**。

### P1 — 前端增强
2. **增加"校园周边"一级导航** — 在 `NAV_ITEMS` 中增加 `{ key: 'surrounding', label: '校园周边', path: '/surrounding/place_001' }` 或在 HomePage 新增周边发现入口
3. **搜索结果纳入周边数据** — 修改 `SearchDropdown` 和 `globalSearch`，增加 `surroundingAPI.search()` 调用
4. **Place 列表卡片增加周边数量标识** — 在 `LocationSearchPage` 的卡片中，调用 `surroundingAPI.getCategoryCounts()` 或一次性批量获取所有地点的周边计数

### P2 — 体验优化
5. **修复硬编码"景点"标签** — 改为 `${item.type}` 动态显示
6. **为周边最丰富的地点增加"推荐"或"热门"徽章**

---

## 六、验证方案

修复完成后，通过以下步骤验证：

1. **数据库验证：** 确认 `spot_place` 有 301 条，`spot_surrounding` 有 4,200 条
2. **API 验证：** `GET /api/places?page=1&size=10` 返回的第一页包含 `place_001`（按 click_count 排序应在第一位或前列）
3. **API 验证：** `GET /api/surroundings/place/place_001` 返回 200 条数据
4. **前端验证：** 首页 `/` → 点击"目的地" → 列表中看到"北京邮电大学"卡片
5. **前端验证：** 点击北邮卡片 → 详情页底部显示"校园周边(200)"板块，含分类统计
6. **前端验证：** 点击"查看全部" → `/surrounding/place_001` 显示 200 条周边，6 个分类 Tab 正常切换
7. **前端验证：** 首页搜索"北邮 火锅" → 能返回周边火锅店结果
