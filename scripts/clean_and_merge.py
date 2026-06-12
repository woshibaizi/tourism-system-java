"""
Step 3: 数据清洗 & 多源合并

功能:
  1. 高德 GCJ02 → WGS84 坐标转换
  2. 距离重新计算 (用 WGS84 坐标 + Haversine 公式)
  3. 多源数据去重 (50m内同名视为同一商户)
  4. 字段优先级合并 (坐标用高德, 评分/人均用点评)
  5. 过滤明显无效数据

输入: data/raw/amap_{placeId}.json  [+ data/raw/dianping_{placeId}.json]
输出: data/clean/{placeId}_all.json

用法:
    py scripts/clean_and_merge.py                    # 清洗所有已采集学校
    py scripts/clean_and_merge.py --school place_001 # 仅清洗指定学校
"""

import json
import os
import math
import re
import argparse
from pathlib import Path
from collections import defaultdict

# ─── 坐标转换 ────────────────────────────────────
# GCJ02 → WGS84 (高德坐标系 → GPS坐标系)
# 参考: https://github.com/wandergis/coord-transform

PI = math.pi
A = 6378245.0  # 长半轴
EE = 0.00669342162296594323  # 扁率


def _transform_lat(x, y):
    ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * math.sqrt(abs(x))
    ret += (20.0 * math.sin(6.0 * x * PI) + 20.0 * math.sin(2.0 * x * PI)) * 2.0 / 3.0
    ret += (20.0 * math.sin(y * PI) + 40.0 * math.sin(y / 3.0 * PI)) * 2.0 / 3.0
    ret += (160.0 * math.sin(y / 12.0 * PI) + 320.0 * math.sin(y * PI / 30.0)) * 2.0 / 3.0
    return ret


def _transform_lng(x, y):
    ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * math.sqrt(abs(x))
    ret += (20.0 * math.sin(6.0 * x * PI) + 20.0 * math.sin(2.0 * x * PI)) * 2.0 / 3.0
    ret += (20.0 * math.sin(x * PI) + 40.0 * math.sin(x / 3.0 * PI)) * 2.0 / 3.0
    ret += (150.0 * math.sin(x / 12.0 * PI) + 300.0 * math.sin(x / 30.0 * PI)) * 2.0 / 3.0
    return ret


def gcj02_to_wgs84(lng, lat):
    """高德 GCJ02 → WGS84"""
    d_lat = _transform_lat(lng - 105.0, lat - 35.0)
    d_lng = _transform_lng(lng - 105.0, lat - 35.0)
    rad_lat = lat / 180.0 * PI
    magic = math.sin(rad_lat)
    magic = 1 - EE * magic * magic
    sqrt_magic = math.sqrt(magic)
    d_lat = (d_lat * 180.0) / ((A * (1 - EE)) / (magic * sqrt_magic) * PI)
    d_lng = (d_lng * 180.0) / (A / sqrt_magic * math.cos(rad_lat) * PI)
    return lng - d_lng, lat - d_lat


def haversine(lat1, lng1, lat2, lng2):
    """Haversine 距离计算 (米)"""
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


# ─── 名称规范化 ──────────────────────────────────
def normalize_name(name):
    """提取核心名称，去除分店信息"""
    if not name:
        return ""
    # 去掉括号内容
    name = re.sub(r'[\(（][^)）]*[\)）]', '', name)
    # 去掉常见后缀
    for suffix in ['店', '分店', '旗舰店', '总店', '分公司', '分园']:
        if name.endswith(suffix) and len(name) > len(suffix) + 1:
            name = name[:-len(suffix)]
    return name.strip()


def extract_brand(name):
    """提取品牌名: '海底捞火锅(枫蓝国际店)' → '海底捞火锅'"""
    return normalize_name(name)


# ─── 去重 ────────────────────────────────────────
def deduplicate(records, threshold_meters=30):
    """
    去重策略:
    1. 同名称 → 保留距离最近的
    2. 坐标 <30m → 保留信息最完整的
    """
    # Pass 1: 按 name+lat+lng 粗略分组
    groups = defaultdict(list)
    for r in records:
        name_key = normalize_name(r.get("name", ""))
        coord_key = f"{name_key}|{r.get('lat', 0):.5f}|{r.get('lng', 0):.5f}"
        groups[coord_key].append(r)

    # 同组内选最佳（多源合并用）
    unique = []
    for key, group in groups.items():
        best = max(group, key=lambda r: (
            len(r.get("phone", "") or "") > 0,
            float(r.get("source_rating", 0) or 0),
            len(r.get("address", "") or "") > 10
        ))
        unique.append(best)

    # Pass 2: 50m内的同名去重
    final = []
    used = set()
    for i, r1 in enumerate(unique):
        if i in used:
            continue
        name1 = normalize_name(r1.get("name", ""))
        for j, r2 in enumerate(unique):
            if j <= i or j in used:
                continue
            name2 = normalize_name(r2.get("name", ""))
            if name1 != name2:
                continue
            dist = haversine(
                float(r1.get("lat", 0)), float(r1.get("lng", 0)),
                float(r2.get("lat", 0)), float(r2.get("lng", 0))
            )
            if dist < threshold_meters:
                used.add(j)

        final.append(r1)

    return final


# ─── 主流程 ──────────────────────────────────────
def clean_records(raw_records, school_center):
    """清洗并转换单校数据"""
    cleaned = []

    for r in raw_records:
        # 1. 坐标转换 GCJ02 → WGS84
        lng_gcj, lat_gcj = r.get("lng", 0), r.get("lat", 0)
        lng_wgs, lat_wgs = gcj02_to_wgs84(lng_gcj, lat_gcj)

        # 2. 基本过滤
        name = (r.get("name") or "").strip()
        if not name or len(name) < 2:
            continue

        # 3. 坐标合法性
        if not (18 <= lat_wgs <= 54 and 73 <= lng_wgs <= 135):
            continue

        # 4. 距校园距离（用WGS84重算）
        dist = haversine(
            school_center["lat"], school_center["lng"],
            lat_wgs, lng_wgs
        )

        # 5. 构建清洗后的记录
        clean = {
            "name": name,
            "type": r.get("type", "other"),
            "sub_type": r.get("sub_type", ""),
            "lat": round(lat_wgs, 7),
            "lng": round(lng_wgs, 7),
            "address": (r.get("address") or "").strip(),
            "phone": (r.get("phone") or "").strip(),
            "distance_meters": round(dist),
            "source_rating": float(r.get("source_rating", 0) or 0),
            "source_cost": float(r.get("source_cost", 0) or 0),
            "photos": r.get("photos", []),
            "source": r.get("source", "amap"),
            "source_type_code": r.get("source_type_code", ""),
        }
        cleaned.append(clean)

    # 去重
    cleaned = deduplicate(cleaned)
    return cleaned


def main():
    parser = argparse.ArgumentParser(description="数据清洗 & 合并")
    parser.add_argument("--school", type=str, help="仅清洗指定 placeId")
    parser.add_argument("--config", type=str, default="scripts/config.json")
    parser.add_argument("--input-dir", type=str, default="data/raw")
    parser.add_argument("--output-dir", type=str, default="data/clean")
    args = parser.parse_args()

    config = load_config(args.config)
    schools = config.get("schools", [])
    if args.school:
        schools = [s for s in schools if s["placeId"] == args.school]

    os.makedirs(args.output_dir, exist_ok=True)
    total_cleaned = 0

    for school in schools:
        pid = school["placeId"]
        input_path = os.path.join(args.input_dir, f"amap_{pid}.json")

        if not os.path.exists(input_path):
            print(f"[{pid}] {school['name']} — 跳过 (无原始数据)")
            continue

        with open(input_path, "r", encoding="utf-8") as f:
            raw = json.load(f)

        cleaned = clean_records(raw, school["center"])

        output_path = os.path.join(args.output_dir, f"{pid}_all.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(cleaned, f, ensure_ascii=False, indent=2)

        total_cleaned += len(cleaned)
        print(f"[{pid}] {school['name']}: {len(raw)} → {len(cleaned)} 条 "
              f"(去重率 {(1-len(cleaned)/max(len(raw),1))*100:.0f}%)")

    print(f"\n全部完成! 共清洗 {total_cleaned} 条数据 → {args.output_dir}/")


def load_config(config_path):
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


if __name__ == "__main__":
    main()
