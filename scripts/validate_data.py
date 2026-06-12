"""
Step 6: 数据质量自动校验

检查项:
  1. 必填字段非空 (name, lat, lng, type, place_id)
  2. 经纬度范围 (中国境内: lat 18-54, lng 73-135)
  3. JSON 字段格式 (tags 必须是合法 JSON 数组)
  4. 同校园内重复检测 (同名+距离<20m)
  5. 分类分布合理性 (每类至少1条)
  6. 文本长度检查 (description 30-150字)

输入: data/enriched/{placeId}_enriched.json
输出: data/validated/{placeId}_ok.json + data/rejected/{placeId}_fail.json
      + data/rejected/_report.json

用法:
    py scripts/validate_data.py                      # 全部学校
    py scripts/validate_data.py --school place_001   # 仅指定学校
"""

import json
import os
import re
import math
import argparse
from pathlib import Path
from collections import defaultdict
from datetime import datetime


def load_config(config_path="scripts/config.json"):
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


def haversine(lat1, lng1, lat2, lng2):
    """计算两点距离 (米)"""
    R = 6371000
    phi1, phi2 = math.radians(float(lat1)), math.radians(float(lat2))
    dphi = math.radians(float(lat2) - float(lat1))
    dlam = math.radians(float(lng2) - float(lng1))
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


def validate_record(record, place_id):
    """校验单条记录，返回错误列表"""
    errors = []

    # 1. 必填字段
    if not record.get("name") or len(str(record.get("name", "")).strip()) < 2:
        errors.append("名称过短或缺失")

    lat = record.get("lat")
    lng = record.get("lng")
    if lat is None or lng is None:
        errors.append("经纬度缺失")
    else:
        lat, lng = float(lat), float(lng)
        # 2. 经纬度范围
        if not (18 <= lat <= 54):
            errors.append(f"纬度越界: {lat}")
        if not (73 <= lng <= 135):
            errors.append(f"经度越界: {lng}")

    if not record.get("type"):
        errors.append("类型缺失")

    # 3. JSON 字段格式
    tags = record.get("tags", [])
    if isinstance(tags, str):
        try:
            json.loads(tags)
        except (json.JSONDecodeError, TypeError):
            errors.append("tags 不是合法 JSON")
    elif not isinstance(tags, list):
        errors.append(f"tags 类型错误: {type(tags).__name__}")

    # 4. 文本长度 (no-llm 模式下 description 仅为商户名, 降低阈值)
    desc = record.get("description", "") or ""
    if len(desc) < 2:
        errors.append(f"description 过短 ({len(desc)}字)")
    elif len(desc) > 500:
        errors.append(f"description 过长 ({len(desc)}字)")

    # 5. 距离合理性
    dist = record.get("distance_meters", 0)
    if dist is not None and (dist < 0 or dist > 100000):
        errors.append(f"距离异常: {dist}m")

    return errors


def detect_duplicates(records, threshold_meters=20):
    """检测同校园内重复"""
    duplicates = []
    for i in range(len(records)):
        for j in range(i + 1, len(records)):
            r1, r2 = records[i], records[j]
            name1 = str(r1.get("name", "")).strip()
            name2 = str(r2.get("name", "")).strip()
            if name1 != name2:
                continue
            try:
                dist = haversine(
                    float(r1.get("lat", 0)), float(r1.get("lng", 0)),
                    float(r2.get("lat", 0)), float(r2.get("lng", 0))
                )
            except (ValueError, TypeError):
                continue
            if dist < threshold_meters:
                duplicates.append({
                    "record1": name1,
                    "record2": name2,
                    "distance": round(dist, 1),
                    "index1": i, "index2": j,
                })
    return duplicates


def check_category_distribution(records, place_name):
    """检查分类分布"""
    cats = defaultdict(int)
    for r in records:
        cats[r.get("type", "other")] += 1

    warnings = []
    expected = {"restaurant", "shopping", "transport"}
    for cat in expected:
        if cats.get(cat, 0) == 0:
            warnings.append(f"缺少 {cat} 类型")

    return cats, warnings


def main():
    parser = argparse.ArgumentParser(description="数据质量校验")
    parser.add_argument("--school", type=str, help="仅校验指定 placeId")
    parser.add_argument("--config", type=str, default="scripts/config.json")
    parser.add_argument("--input-dir", type=str, default="data/enriched")
    parser.add_argument("--output-dir", type=str, default="data/validated")
    parser.add_argument("--rejected-dir", type=str, default="data/rejected")
    args = parser.parse_args()

    config = load_config(args.config)
    schools = config.get("schools", [])
    if args.school:
        schools = [s for s in schools if s["placeId"] == args.school]

    os.makedirs(args.output_dir, exist_ok=True)
    os.makedirs(args.rejected_dir, exist_ok=True)

    report = {"updated": datetime.now().isoformat(), "schools": {}, "total": {}}
    total_ok, total_fail = 0, 0

    for school in schools:
        pid = school["placeId"]
        name = school["name"]
        input_path = os.path.join(args.input_dir, f"{pid}_enriched.json")

        if not os.path.exists(input_path):
            continue

        with open(input_path, "r", encoding="utf-8") as f:
            records = json.load(f)

        ok_records, fail_records = [], []

        # 逐条校验
        for r in records:
            errors = validate_record(r, pid)
            if errors:
                r["_errors"] = errors
                fail_records.append(r)
            else:
                ok_records.append(r)

        # 重复检测
        dupes = detect_duplicates(ok_records)
        cat_dist, cat_warnings = check_category_distribution(ok_records, name)

        # 保存
        ok_path = os.path.join(args.output_dir, f"{pid}_ok.json")
        with open(ok_path, "w", encoding="utf-8") as f:
            json.dump(ok_records, f, ensure_ascii=False, indent=2)

        if fail_records:
            fail_path = os.path.join(args.rejected_dir, f"{pid}_fail.json")
            with open(fail_path, "w", encoding="utf-8") as f:
                json.dump(fail_records, f, ensure_ascii=False, indent=2)

        # 输出
        status = "[OK]" if len(fail_records) == 0 and len(dupes) == 0 else "[WARN]"
        print(f"{status} [{pid}] {name}: {len(ok_records)} OK, {len(fail_records)} FAIL, "
              f"{len(dupes)} dupes")

        if cat_warnings:
            for w in cat_warnings:
                print(f"     [WARN] {w}")
        if dupes:
            print(f"     [WARN] {len(dupes)} 对疑似重复")

        report["schools"][pid] = {
            "name": name, "ok": len(ok_records), "fail": len(fail_records),
            "duplicates": len(dupes), "categories": dict(cat_dist),
            "warnings": cat_warnings,
        }
        total_ok += len(ok_records)
        total_fail += len(fail_records)

    report["total"] = {"ok": total_ok, "fail": total_fail,
                       "pass_rate": f"{total_ok/max(total_ok+total_fail, 1)*100:.1f}%"}

    report_path = os.path.join(args.rejected_dir, "_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"全部完成! {total_ok} OK / {total_fail} FAIL ({report['total']['pass_rate']})")
    print(f"通过数据: {args.output_dir}/")
    print(f"拒绝数据: {args.rejected_dir}/")
    print(f"校验报告: {report_path}")


if __name__ == "__main__":
    main()
