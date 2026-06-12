# 景区周边数据乱码（全?）及展示降级 — 问题分析与优化方案

> **报告日期**: 2026-06-10  
> **问题**: 景区及其他学校周边数据在前端展示为全 `?` 乱码，需要降级为纯文字展示并取消跳转

---

## 一、问题根因分析

### 1.1 "?" 乱码根因：MySQL 字符集导入错误

**现状：**

| 数据来源 | place_id | 记录数 | 中文状态 | 导入时间 |
|---------|----------|--------|---------|---------|
| BUPT（高德真实POI）| place_001 | 200 | ✅ 正常 | 2026-06-09 18:11 |
| 景区（LLM生成）| place_102~301 | 4,000 | ❌ 全为 `?` | 2026-06-09 19:46 |

**数据库验证：**
```sql
SELECT COUNT(*) FROM spot_surrounding;                    -- 4200
SELECT COUNT(*) FROM spot_surrounding 
  WHERE HEX(name) LIKE '%3F3F3F%';                        -- 3969 corrupted
SELECT COUNT(*) FROM spot_surrounding 
  WHERE place_id='place_001' AND HEX(name) LIKE '%3F3F3F%'; -- 0 (BUPT clean)
```

**HEX 分析：**
```
BUPT name (正常): E5 8C 97 E4 BA AC ...  = UTF-8 中文
景区 name (乱码): 3F 3F 3F 3F 3F ...      = 全是 0x3F (ASCII '?')
```

**根因：** `scenic_surrounding_data.sql` 文件本身是有效 UTF-8 编码（已验证），但在通过 MySQL 客户端导入时，`character_set_client` 或 `character_set_connection` 被设为 `latin1`，导致 MySQL 尝试将 UTF-8 多字节序列按 latin1（单字节）解析，所有无法映射的字符被替换为 `0x3F`（`?`）。该损坏不可逆 — `?` 就是实际存储内容，原始 UTF-8 字节已永久丢失。

**修复：** 从源文件重新导入，确保 charset 设为 `utf8mb4`：
```bash
mysql --default-character-set=utf8mb4 -u root -p tourism_db < scenic_surrounding_data.sql
```

---

### 1.2 景区周边数据质量本就不高（需降级展示）

**数据对比：**

| 维度 | BUPT (200条) | 景区 (4,000条) |
|------|-------------|---------------|
| 数据源 | 高德地图真实 POI | LLM 纯虚构生成 |
| 图片 | 3 张真实照片 | NULL |
| 电话 | 真实号码 | NULL |
| 地址 | 真实街道地址 | NULL |
| 详细描述 | 150-300 字专属描述 | NULL |
| 标签 | 4 个差异化标签 | 2-3 个通用标签 |
| 评分 | 4.3-4.7 真实评分 | 3.5-4.9 随机数 |
| 人均价格 | 特定值（如21元） | 整数随机值（如100, 500） |
| 必点推荐 | 具体菜名 | NULL |
| 坐标精度 | 7 位小数（亚米级） | 3-4 位小数（百米级） |

**结论：** 景区周边数据是纯 LLM 虚构的"占位数据"，缺乏真实世界的任何锚点（无图片、无电话、无地址、无真实评分）。这些数据在当前形式下展示为富媒体卡片会给用户造成误导。

---

## 二、优化方案

### 2.1 修复"?"乱码

**操作：** 删除景区已损坏数据，以正确 charset 重新导入

```sql
-- 1. 删除损坏数据
DELETE FROM spot_surrounding WHERE place_id != 'place_001';

-- 2. 重新导入
-- mysql --default-character-set=utf8mb4 -u root -p tourism_db < scenic_surrounding_data.sql
```

### 2.2 降级景区/其他学校周边展示

**PlaceDetailPage 改造策略：**

| 条件 | 展示方式 |
|------|---------|
| `place_id === 'place_001'` (BUPT) | 保持现有富媒体展示：分类标签 + 预览卡片 + "查看全部" 跳转 |
| `place_id !== 'place_001'` (景区/其他学校) | **降级为纯文字列表**：仅展示名称/类型/距离，无图片、无评分、无跳转 |

**具体改动：**

1. **PlaceDetailPage.jsx** — 根据 `placeId` 判断展示模式
   - BUPT：保持原有 `surrounding` 富媒体板块（分类 chips + 卡片预览 + 查看全部链接）
   - 景区/其他：新增加 `surroundingSimple` 纯文字板块（无分类筛选、无图片、无链接）
   - 纯文字板块每行格式：`🍜 餐厅名称 · 距离xxxm · ¥人均`

2. **SurroundingPage** — 限制非 BUPT 访问
   - 路由守卫：如果 `placeId !== 'place_001'`，重定向回首页或显示空状态

3. **左侧导航** — 已在上轮修复中指向 `/surrounding/place_001`（无需改动）

### 2.3 影响范围

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `scenic_surrounding_data.sql` | 重新导入 | 修复乱码 |
| `PlaceDetailPage.jsx:173-235` | 条件渲染 | BUPT 富媒体 / 其他 纯文字 |
| `SurroundingPage.jsx` | 路由守卫 | 限制仅 BUPT 可用 |

---

## 三、实现步骤

1. **P0**: DNS 修复 → 删除损坏数据 + 正确 charset 导入
2. **P1**: PlaceDetailPage 降级 → 分为富媒体模式（BUPT）和纯文字模式（其他）
3. **P2**: SurroundingPage 守卫 → 限制非 BUPT 的 placeId 访问
4. **验证**: 确认景区详情页显示正确中文 + 纯文字列表 + 无跳转链接
