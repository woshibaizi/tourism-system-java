"""
Step 4: AI 智能精选 — 从全量清洗数据中精选 top N 条

策略:
  1. 按分类配额分配 (美食8/购物3/娱乐3/住宿2/交通2/服务2)
  2. 每类按综合得分排序 (rating 50% + reviewCount 30% + distance 20%)
  3. 同品牌去重 (maxSameBrand=2)
  4. 支持 manual_overrides.json 强制包含/排除/改名
  5. 北邮 (maxItems=0) 全量保留，不做剔除

输入: data/clean/{placeId}_all.json
输出: data/selected/{placeId}_selected.json

用法:
    py scripts/select_best.py                      # 全部学校
    py scripts/select_best.py --school place_001   # 仅指定学校
"""

import json
import os
import re
import math
import argparse
from collections import defaultdict


def load_config(config_path="scripts/config.json"):
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_overrides(overrides_path="scripts/manual_overrides.json"):
    if not os.path.exists(overrides_path):
        return {}
    with open(overrides_path, "r", encoding="utf-8") as f:
        return json.load(f)


def extract_brand(name):
    """提取品牌名: '海底捞火锅(枫蓝国际店)' → '海底捞火锅'"""
    name = re.sub(r'[\(（][^)）]*[\)）]', '', name).strip()
    for suffix in ['店', '分店', '旗舰店', '总店', '分公司', '直营店']:
        if name.endswith(suffix) and len(name) > len(suffix) + 1:
            name = name[:-len(suffix)]
    return name


def compute_score(record, weights):
    """综合评分: rating * w1 + log(click_count) * w2 + (1 - distance/3000) * w3"""
    rating = float(record.get("source_rating", 0) or 0)
    review_count = min(float(record.get("review_count", 0) or 0), 10000)
    distance = float(record.get("distance_meters", 1500) or 1500)

    rating_score = min(rating / 5.0, 1.0)  # 归一化到 0-1
    review_score = math.log(review_count + 1) / math.log(10001) if review_count > 0 else 0
    distance_score = 1.0 - min(distance / 3000, 1.0)

    w = weights
    return rating_score * w.get("rating", 0.5) + \
           review_score * w.get("reviewCount", 0.3) + \
           distance_score * w.get("distance", 0.2)


def select_best(records, place_id, config, overrides=None):
    """核心精选函数"""
    if overrides is None:
        overrides = {}

    max_items = config.get("defaultMaxItems", 20)
    quota = dict(config.get("categoryQuota", {}))
    weights = config.get("selection", {}).get("sortWeight", {})
    max_same_brand = config.get("selection", {}).get("maxSameBrand", 2)

    # 检查学校级覆盖
    for school in config.get("schools", []):
        if school["placeId"] == place_id:
            sm = school.get("maxItems")
            if sm is not None:
                if sm == 0:
                    max_items = 0  # 不限量
                else:
                    max_items = sm
            break

    # 如果 max_items > 默认配额总和，按比例扩展配额
    quota_sum = sum(quota.values())
    if max_items > 0 and max_items > quota_sum:
        scale = max_items / quota_sum
        quota = {k: max(int(v * scale), 1) for k, v in quota.items()}
        # 微调使总和接近 max_items
        diff = max_items - sum(quota.values())
        if diff > 0:
            # 把差额加到最大的类别上
            biggest = max(quota, key=quota.get)
            quota[biggest] += diff

    place_overrides = overrides.get(place_id, {})

    # 应用 force_exclude
    exclude_names = set(place_overrides.get("force_exclude", []))
    records = [r for r in records if r["name"] not in exclude_names]

    # 如果是不限量 (maxItems=0)，跳过精选
    if max_items == 0:
        # 仍然去同品牌
        seen_brands = defaultdict(int)
        result = []
        for r in records:
            brand = extract_brand(r.get("name", ""))
            if seen_brands[brand] < max_same_brand:
                result.append(r)
                seen_brands[brand] += 1
        result = _apply_overrides(result, place_overrides, records)
        return result

    # 按分类分组
    by_category = defaultdict(list)
    for r in records:
        cat = r.get("type", "other")
        by_category[cat].append(r)

    # 每类内排序 + 截取
    selected = []
    for cat, cat_records in by_category.items():
        # 计算得分
        for r in cat_records:
            r["_score"] = compute_score(r, weights)

        # 按分数降序
        cat_records.sort(key=lambda x: x["_score"], reverse=True)

        # 去同品牌
        selected_cat = []
        brand_counts = defaultdict(int)
        for r in cat_records:
            brand = extract_brand(r.get("name", ""))
            if brand_counts[brand] >= max_same_brand:
                continue
            selected_cat.append(r)
            brand_counts[brand] += 1

            cat_quota = quota.get(cat, 2)
            if len(selected_cat) >= cat_quota:
                break

        selected.extend(selected_cat)

    # 应用 force_include
    for name in place_overrides.get("force_include", []):
        if not any(s["name"] == name for s in selected):
            # 从原始数据中找到该商户
            match = next((r for r in records if r["name"] == name), None)
            if match:
                selected.append(match)

    # 应用名称替换
    name_map = place_overrides.get("replace_name", {})
    for s in selected:
        if s["name"] in name_map:
            s["name"] = name_map[s["name"]]

    # 清理内部字段
    for s in selected:
        s.pop("_score", None)

    return selected


def _apply_overrides(selected, place_overrides, all_records):
    """对不限量模式应用 overrides"""
    for name in place_overrides.get("force_include", []):
        if not any(s["name"] == name for s in selected):
            match = next((r for r in all_records if r["name"] == name), None)
            if match:
                selected.append(match)

    selected = [s for s in selected
                if s["name"] not in set(place_overrides.get("force_exclude", []))]

    name_map = place_overrides.get("replace_name", {})
    for s in selected:
        if s["name"] in name_map:
            s["name"] = name_map[s["name"]]

    return selected


def main():
    parser = argparse.ArgumentParser(description="AI智能精选")
    parser.add_argument("--school", type=str, help="仅精选指定 placeId")
    parser.add_argument("--config", type=str, default="scripts/config.json")
    parser.add_argument("--overrides", type=str, default="scripts/manual_overrides.json")
    parser.add_argument("--input-dir", type=str, default="data/clean")
    parser.add_argument("--output-dir", type=str, default="data/selected")
    args = parser.parse_args()

    config = load_config(args.config)
    overrides = load_overrides(args.overrides)
    schools = config.get("schools", [])
    if args.school:
        schools = [s for s in schools if s["placeId"] == args.school]

    os.makedirs(args.output_dir, exist_ok=True)
    total_selected = 0

    for school in schools:
        pid = school["placeId"]
        input_path = os.path.join(args.input_dir, f"{pid}_all.json")

        if not os.path.exists(input_path):
            print(f"[{pid}] {school['name']} — 跳过 (无清洗数据)")
            continue

        with open(input_path, "r", encoding="utf-8") as f:
            all_records = json.load(f)

        selected = select_best(all_records, pid, config, overrides)

        output_path = os.path.join(args.output_dir, f"{pid}_selected.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(selected, f, ensure_ascii=False, indent=2)

        max_items = school.get("maxItems", config.get("defaultMaxItems", 20))
        limit = "不限量" if max_items == 0 else f"≤{max_items}"
        print(f"[{pid}] {school['name']}: {len(all_records)} → {len(selected)} 条 ({limit})")

        # 打印分类分布
        cat_counts = defaultdict(int)
        for r in selected:
            cat_counts[r.get("type", "other")] += 1
        for cat, count in sorted(cat_counts.items()):
            print(f"  {cat}: {count}")

        total_selected += len(selected)

    print(f"\n全部完成! 共精选 {total_selected} 条 → {args.output_dir}/")


if __name__ == "__main__":
    main()
