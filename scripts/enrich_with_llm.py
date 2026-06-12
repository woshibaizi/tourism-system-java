"""
Step 5: LLM 文本增强 — 批量生成描述文本 (纯标准库版)

对精选后的商户，调用 DeepSeek API 生成:
  - description / detail_description / tags / must_try / student_discount / price_range

用法:
    py scripts/enrich_with_llm.py --school place_001
    py scripts/enrich_with_llm.py --dry-run            # 预览不调用LLM
    py scripts/enrich_with_llm.py --no-llm              # 跳过LLM, 填默认值直接输出

依赖: 纯 Python 标准库，无需 pip install
"""

import json
import os
import sys
import time
import argparse
import urllib.request
import urllib.error
from datetime import datetime

# ─── 提示词 ──────────────────────────────────────
SYSTEM_PROMPT = """你是一个校园周边生活指南的编辑，负责为大学周边的商户撰写吸引人的介绍。

请为每条商户生成以下字段：

1. description: 50-100字简介，突出这家店最核心的特色和亮点，语气亲切自然
2. detail_description: 200-300字详细介绍，包含环境氛围、服务特色、适合场景、推荐理由
3. tags: 3-5个特色标签（中文JSON数组），如 ["学生友好","深夜营业","网红打卡","性价比高","适合聚会"]
4. must_try: 必点菜/必玩项目推荐（15字以内），如无则为null
5. student_discount: 是否有学生优惠（仅返回true或false）
6. price_range: 价格区间符号 ¥/¥¥/¥¥¥（人均<30=¥, 30-80=¥¥, >80=¥¥¥）

重要规则：
- 描述要根据商户类型调整语气：美食用食欲感语言，娱乐用氛围感语言
- 体现"对学生友好"和"校园生活"的语境
- 不要编造不存在的具体菜品，基于商户名称和类型知识撰写
- 学生优惠推断：奶茶/快餐/小吃/电影院/KTV 大概率有 → true

严格按以下格式输出，每条一行JSON（不要用markdown代码块包裹）：
{"index":0,"description":"...","detail_description":"...","tags":["tag1","tag2"],"must_try":"推荐xxx","student_discount":true,"price_range":"¥¥"}"""


def http_post_json(url, payload, headers, timeout=60):
    """urllib POST JSON，返回解析后的 JSON"""
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body)
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8") if e.fp else str(e)
        raise RuntimeError(f"HTTP {e.code}: {err_body[:300]}")
    except urllib.error.URLError as e:
        raise ConnectionError(f"请求失败: {e}")


def build_user_prompt(merchants):
    """构建批量用户提示"""
    lines = ["请为以下校园周边商户生成描述文本：\n"]
    cat_zh = {
        "restaurant": "美食餐饮", "shopping": "购物消费",
        "entertainment": "休闲娱乐", "hotel": "住宿酒店",
        "transport": "交通出行", "service": "生活服务"
    }
    for i, m in enumerate(merchants):
        cat = cat_zh.get(m.get("type", ""), "其他")
        lines.append(
            f"{i}. {m['name']} | "
            f"类型: {cat} | "
            f"地址: {m.get('address', '未知')} | "
            f"距校园: {m.get('distance_meters', '?')}米 | "
            f"评分: {m.get('source_rating', 0)} | "
            f"参考人均: {m.get('source_cost', 0)}元"
        )
    return "\n".join(lines)


def enrich_batch(merchants, api_key, base_url, model, dry_run=False):
    """批量调用 LLM 生成文本"""
    if dry_run:
        prompt = build_user_prompt(merchants)
        print(f"  [DRY RUN] {len(merchants)} 条, prompt {len(prompt)} 字符")
        return []

    url = f"{base_url.rstrip('/')}/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_user_prompt(merchants)},
        ],
        "temperature": 0.7,
        "max_tokens": 4000,
    }

    try:
        resp = http_post_json(url, payload, headers, timeout=90)
        content = resp["choices"][0]["message"]["content"] or ""
    except Exception as e:
        print(f"  LLM 调用失败: {e}")
        return []

    # 解析返回的 JSON 行
    results = []
    for line in content.strip().split("\n"):
        line = line.strip()
        if not line or line.startswith("```"):
            continue
        try:
            results.append(json.loads(line))
        except json.JSONDecodeError:
            continue

    return results


def enrich_school(records, api_key, base_url, model, batch_size=20, dry_run=False):
    """对单校数据逐批增强"""
    enriched = []

    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        batch_results = enrich_batch(batch, api_key, base_url, model, dry_run)

        for j, record in enumerate(batch):
            result = next((r for r in batch_results if r.get("index") == j), None)

            enriched_record = dict(record)
            if result:
                enriched_record["description"] = str(result.get("description") or "")
                enriched_record["detail_description"] = str(result.get("detail_description") or "")
                enriched_record["tags"] = result.get("tags", [])
                enriched_record["must_try"] = result.get("must_try")
                enriched_record["student_discount"] = result.get("student_discount", False)
                enriched_record["price_range"] = result.get("price_range", "¥")
            else:
                # 填默认值
                enriched_record["description"] = record.get("name", "")
                enriched_record["detail_description"] = ""
                enriched_record["tags"] = []
                enriched_record["must_try"] = None
                enriched_record["student_discount"] = False
                enriched_record["price_range"] = "¥"

            enriched.append(enriched_record)

        if not dry_run and i + batch_size < len(records):
            time.sleep(0.5)  # 避免限速

    return enriched


def load_dotenv(path):
    """简易 .env 解析"""
    result = {}
    if not os.path.exists(path):
        return result
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            result[key.strip()] = val.strip().strip('"').strip("'")
    return result


def load_config(config_path="scripts/config.json"):
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser(description="LLM文本增强 (纯标准库)")
    parser.add_argument("--school", type=str, help="仅处理指定 placeId")
    parser.add_argument("--config", type=str, default="scripts/config.json")
    parser.add_argument("--input-dir", type=str, default="data/selected")
    parser.add_argument("--output-dir", type=str, default="data/enriched")
    parser.add_argument("--dry-run", action="store_true", help="预览不调用LLM")
    parser.add_argument("--no-llm", action="store_true", help="跳过LLM,填默认值")
    parser.add_argument("--batch-size", type=int, default=10, help="每批处理条数")
    args = parser.parse_args()

    config = load_config(args.config)

    # ── API Key ────────────────────────────────
    api_key = ""
    base_url = "https://api.deepseek.com"
    model = "deepseek-chat"

    # 1. config.json
    llm_cfg = config.get("llm", {})
    if llm_cfg.get("apiKey") and not llm_cfg["apiKey"].startswith("$"):
        api_key = llm_cfg["apiKey"]
    if llm_cfg.get("baseUrl") and not llm_cfg["baseUrl"].startswith("$"):
        base_url = llm_cfg["baseUrl"]
    if llm_cfg.get("model"):
        model = llm_cfg["model"]

    # 2. agent-service/.env
    if not api_key:
        dotenv_path = os.path.join(os.path.dirname(__file__), "..", "agent-service", ".env")
        env = load_dotenv(dotenv_path)
        api_key = env.get("TEXT_LLM_API_KEY") or env.get("LLM_API_KEY") or ""
        base_url = env.get("TEXT_LLM_BASE_URL") or env.get("LLM_BASE_URL") or base_url
        model = env.get("TEXT_LLM_MODEL") or env.get("LLM_MODEL") or model

    # 3. 系统环境变量
    if not api_key:
        api_key = os.environ.get("TEXT_LLM_API_KEY") or os.environ.get("LLM_API_KEY") or ""

    if not api_key and not args.dry_run and not args.no_llm:
        print("警告: 未找到 LLM API Key，将使用 --no-llm 模式填充默认值")
        args.no_llm = True

    if not args.no_llm and not args.dry_run:
        print(f"LLM: {model} @ {base_url}")
        print(f"API Key: {api_key[:8]}...{api_key[-4:]}")
        print()

    # ── 处理学校 ──────────────────────────────────
    schools = config.get("schools", [])
    if args.school:
        schools = [s for s in schools if s["placeId"] == args.school]

    os.makedirs(args.output_dir, exist_ok=True)
    total = 0

    for school in schools:
        pid = school["placeId"]
        name = school["name"]
        input_path = os.path.join(args.input_dir, f"{pid}_selected.json")

        if not os.path.exists(input_path):
            print(f"[{pid}] {name} — 跳过 (无精选数据)")
            continue

        with open(input_path, "r", encoding="utf-8") as f:
            records = json.load(f)

        if args.no_llm:
            print(f"[{pid}] {name}: 填充默认值 {len(records)} 条 (no-llm)")
            enriched = []
            for r in records:
                r["description"] = r.get("name", "")
                r["detail_description"] = ""
                r["tags"] = []
                r["must_try"] = None
                r["student_discount"] = False
                r["price_range"] = "¥"
                enriched.append(r)
        else:
            print(f"[{pid}] {name}: LLM增强 {len(records)} 条 (batch={args.batch_size})...")
            enriched = enrich_school(records, api_key, base_url, model,
                                     args.batch_size, args.dry_run)

        output_path = os.path.join(args.output_dir, f"{pid}_enriched.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(enriched, f, ensure_ascii=False, indent=2)

        total += len(enriched)

    if args.dry_run:
        print(f"\n[DRY RUN] 预览完成, 共 {total} 条")
    else:
        print(f"\n全部完成! 共 {total} 条 → {args.output_dir}/")


if __name__ == "__main__":
    main()
