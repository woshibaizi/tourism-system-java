# 校园周边描述/评价字段消失 — 问题分析与修复

> **报告日期**: 2026-06-10  
> **严重程度**: 🔴 Critical — 所有 379 条北邮周边数据的文本字段（描述、标签、必点推荐等）全部丢失

---

## 一、问题现象

前端展示的北邮周边商户卡片/列表中，所有文本描述字段显示为空或占位值：

| 字段 | 期望 | 实际 |
|------|------|------|
| `description` | "邮电大学旁的嗦粉天堂！柳州肥姨妈大骨螺蛳粉..." | `"北京邮电大学海淀校区体育场"`（= 商户名称） |
| `detail_description` | 150-300字详细介绍 | `""`（空字符串） |
| `tags` | `["学生友好","性价比高","深夜营业"]` | `[]`（空数组） |
| `mustTry` | `"招牌大骨螺蛳粉加炸蛋"` | `null` |
| `studentDiscount` | `1`（true） | `0`（false） |
| `priceRange` | 正常 `¥` / `¥¥` / `¥¥¥` | 全部 `¥` |

---

## 二、根因分析

### 直接原因：`enrich_with_llm.py --no-llm` 覆写了全部数据

**触发代码** (`enrich_with_llm.py:249-258`)：

```python
if args.no_llm:
    print(f"[{pid}] {name}: 填充默认值 {len(records)} 条 (no-llm)")
    for r in records:
        r["description"] = r.get("name", "")       # ← 名称当描述
        r["detail_description"] = ""               # ← 空字符串
        r["tags"] = []                             # ← 空数组
        r["must_try"] = None                       # ← 空
        r["student_discount"] = False               # ← 默认无优惠
        r["price_range"] = "¥"                     # ← 默认最低档
```

**数据流追踪：**

```
扩展前（正常状态）:
  selected/place_001_selected.json    ← 200条精选（含原始POI字段）
  enriched/place_001_enriched.json    ← 200条 + LLM增强文本 ✅
  validated/place_001_ok.json         ← 200条验证通过
  surrounding_data.sql                ← 200条 INSERT, 含完整描述

扩展时（--no-llm 覆写）:
  selected/place_001_selected.json    ← 379条精选（200旧 + 179新）
  enrich_with_llm --no-llm            ← 🔴 379条全部填默认值，覆写 enriched/
  enriched/place_001_enriched.json    ← 379条，文本全为空 ❌
  validate_data.py                    ← 验证通过（仅检查必填字段）
  surrounding_data.sql                ← 379条 INSERT，描述=名称 ❌
  MySQL import                        ← 379条入库，字段丢失 ❌
```

### 为什么 API Key 可用但未使用

`.env` 文件中存在有效的 DeepSeek API Key：
```
TEXT_LLM_API_KEY=sk-220a0ab729f34021a5c00aa80ec1c62a
TEXT_LLM_BASE_URL=https://api.deepseek.com
TEXT_LLM_MODEL=deepseek-chat
```

但因为显式传入了 `--no-llm` 参数，脚本根本未尝试加载和调用 LLM。

---

## 三、修复方案

**重新运行 LLM 增强（不加 `--no-llm`）**，让 DeepSeek API 为全部 379 条记录生成真实描述。

```bash
python scripts/enrich_with_llm.py --school place_001
```

脚本会自动：
1. 从 `agent-service/.env` 读取 API Key/URL/Model
2. 每次 20 条批量调用 DeepSeek API（共约 19 批）
3. 生成 description / detail_description / tags / must_try / student_discount / price_range
4. 写入 `data/enriched/place_001_enriched.json`

然后重新生成 SQL 并导入 MySQL。

**预估成本**: DeepSeek API ~0.3-0.5 元（379条 × ~1k tokens/条 = ~400k tokens）

---

## 四、修复步骤

1. 运行 `python scripts/enrich_with_llm.py --school place_001`（不加 --no-llm）
2. 运行 `python scripts/validate_data.py --school place_001`
3. 运行 `python scripts/generate_sql.py --school place_001`
4. 删除 MySQL 中 BUPT 旧数据，重新导入
5. 验证 API 返回完整字段
