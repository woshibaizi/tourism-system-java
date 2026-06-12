# 路线规划问题 — 最终根因报告

**日期**: 2026-06-12
**结论**: 代码已修复，**根因在数据层** — Java 后端数据库中没有 "杭州/西湖" 相关数据。

---

## 逐层验证结果

### 第2层：Agent 代码 — ✅ 全部正常

| 检查项 | 结果 |
|--------|------|
| 意图分类 | `plan_trip_route`, confidence=0.9, destination=西湖 ✅ |
| 路由 | `plan_trip_route` → RouteAgent ✅ |
| 工具过滤 | 只暴露 5 个路线工具，`search_places`/`get_hot_foods` 已排除 ✅ |
| 诊断日志 | 已添加，重启后可在日志中看到完整 LLM 输入/输出 ✅ |

### 第4层：后端数据 — ❌ 这才是根因

```
get_places(10)           → ✅ 10 results (莫高窟, 外滩, 迪士尼, 欢乐谷, 茶卡盐湖...)
get_hot_places(5)        → ✅ 10 results
recommend_places         → ❌ 0 results (推荐接口返回空)
search_places('西湖')    → ❌ 0 results (数据库中没有"西湖")
get_foods(5)             → ❌ 0 results
foods_by_place(place_001)→ ✅ 40 results (某些地点有美食数据)
```

**数据库里现有的地点**: 莫高窟、外滩、迪士尼、欢乐谷、茶卡盐湖...  
**数据库里没有的地点**: 西湖、杭州、雷峰塔、灵隐寺...

---

## 问题全貌还原

当用户说 "帮我规划一下杭州沿西湖绕一整圈的游玩路线"：

```
1. [Agent 代码] classify_intent() → plan_trip_route ✅
2. [Agent 代码] dispatcher → RouteAgent ✅  
3. [Agent 代码] 工具过滤 → 只暴露 5 个路线工具 ✅
4. [Agent 代码] LLM 收到: "用 recommend_places 获取候选景点" ✅
5. [LLM]    调用 recommend_places(interests=["拍照","美食","休闲"])
6. [后端]   recommend_places → 返回空数组 []（数据库无匹配）
7. [工具]   包装为 "暂无推荐数据" 返回给 LLM
8. [LLM]    看到 "暂无推荐数据"，尝试 get_foods_by_place("杭州西湖")
9. [后端]   查询 foods WHERE place_name="杭州西湖" → 返回空（没有这个地点）
10.[LLM]    两次工具都返回空 → "工具库中没有收录具体的西湖景点数据，但我可以..."
```

**Agent 代码的三轮修复（P0-P4 + Fix A-D + 工具隔离 + 意图覆盖）全部生效了。问题不在代码，在数据。**

---

## 解决方案

### 方案 A：补充数据库数据（推荐 — 根本解决）

向 Java 后端的 `spot_place` 表中插入杭州西湖相关地点：

```sql
INSERT INTO spot_place (id, name, description, type, rating, latitude, longitude, keywords)
VALUES
('place_wl_001', '西湖', '杭州西湖，中国十大风景名胜之一', 'spot', 4.9, 30.259, 120.146, '西湖,杭州,断桥,苏堤'),
('place_wl_002', '雷峰塔', '西湖十景之一，白蛇传传说发源地', 'spot', 4.7, 30.231, 120.148, '雷峰塔,西湖,白蛇传'),
('place_wl_003', '断桥残雪', '西湖十景之一', 'spot', 4.8, 30.261, 120.155, '断桥,西湖'),
...
```

同时插入对应的 `spot_food`（西湖附近美食）和 `spot_facility`（卫生间等设施）。

### 方案 B：代码兜底（短期止血）

当工具返回空结果时，引导 LLM 用自己的知识生成行程：

修改 `recommend_places` 工具处理器，当后端返回空时，返回一条提示：
```
"后端暂无此目的地的精确数据。请基于你对目的地的通用知识继续规划，
标注"* 信息基于通用知识，建议出行前核实"。"
```

修改 `context_hint`：
```python
context_hint = (
    ...
    "注意：如果工具返回'暂无数据'或空结果，不要放弃。"
    "基于你对该目的地的知识直接编排行程，在 tips 中建议用户核实最新信息。"
)
```

---

## 三轮代码修复总结

| 轮次 | 修复项 | 状态 |
|------|--------|------|
| R1-P0 | `_llm_classify` slots 丢失 | ✅ 已验证 |
| R1-P1 | Dispatcher 放宽拦截 | ✅ 已验证 |
| R1-P2 | RouteAgent 硬阻断移除 | ✅ 已验证 |
| R1-P3 | 目的地关键词扩展 | ✅ 已验证 |
| R1-P4 | ROUTE_PLAN_PROMPT 工具指南 | ✅ 已验证 |
| R2-A | context_hint 不再误导 LLM | ✅ 已验证 |
| R2-B | ROUTE_PLAN_PROMPT 精简工具列表 | ✅ 已验证 |
| R2-C | ROUTE_OUTPUT_PROMPT 不冲突 | ✅ 已验证 |
| R2-D | recommend_places interests 可选 | ✅ 已验证 |
| R3-1 | RouteAgent 工具白名单过滤 | ✅ 已验证 |
| R3-2 | 意图分类关键词强制覆盖 | ✅ 已验证 |
| R3-3 | LLM 诊断日志 | ✅ 已添加 |

**所有代码修复均已生效。根本问题在数据层 — 后端数据库没有杭州西湖的数据。**
