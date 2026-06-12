"""
Step 1: 高德地图 POI 周边搜索 → 批量采集校园周边商户数据

用法:
    py scripts/scrape_amap.py                      # 采集 config.json 中所有学校
    py scripts/scrape_amap.py --school place_001   # 仅采集指定学校

输出:
    data/raw/amap_{placeId}.json  — 原始 POI 全量数据
    data/raw/_summary.json        — 采集汇总

依赖: 纯 Python 标准库，无需 pip install
"""

import json
import time
import os
import sys
import argparse
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime

# ─── 配置 ───────────────────────────────────────────
AMAP_AROUND_URL = "https://restapi.amap.com/v3/place/around"

# 高德 POI 分类码 → 我们的 type
CATEGORY_MAP = {
    "050000": "restaurant",     # 餐饮服务
    "060000": "shopping",       # 购物服务
    "070000": "service",        # 生活服务
    "080000": "entertainment",  # 体育休闲
    "100000": "hotel",          # 住宿服务
    "150000": "transport",      # 交通设施
}

# 高德子分类 → sub_type
SUBTYPE_MAP = {
    "050100": "restaurant", "050200": "fast_food", "050300": "cafe",
    "050400": "bar", "050500": "snack", "050600": "canteen",
    "050700": "cold_drink", "050800": "bakery",
    "060100": "mall", "060200": "supermarket", "060300": "convenience",
    "060400": "electronics", "060500": "clothing", "060600": "bookstore",
    "070100": "bank", "070200": "hospital", "070300": "pharmacy",
    "070400": "barber", "070500": "laundry", "070600": "express",
    "080100": "cinema", "080200": "ktv", "080300": "gym",
    "080400": "gaming", "080500": "billiard", "080600": "park",
    "100100": "hotel", "100200": "hostel", "100300": "bnb",
    "150100": "metro", "150200": "bus", "150300": "parking",
}


def http_get(url, params=None, timeout=10):
    """urllib GET 请求，返回解析后的 JSON"""
    if params:
        query_string = urllib.parse.urlencode(params)
        url = f"{url}?{query_string}"

    req = urllib.request.Request(url, headers={
        "User-Agent": "TourismSystem/1.0"
    })

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body)
    except urllib.error.URLError as e:
        raise ConnectionError(f"请求失败: {e}")
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON 解析失败: {e}")


def load_config(config_path="scripts/config.json"):
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


def scrape_school(school, api_key, config, output_dir="data/raw"):
    """采集单个学校的周边 POI，返回 POI 列表"""
    center = school["center"]
    location = f"{center['lng']},{center['lat']}"
    radius = school.get("radius", config.get("amap", {}).get("radius", 3000))
    categories = config.get("amap", {}).get("categories",
        ["050000", "060000", "070000", "080000", "100000", "150000"])

    all_pois = []
    stats = {}

    for cat_code in categories:
        cat_name = CATEGORY_MAP.get(cat_code, cat_code)
        page = 1
        cat_pois = []

        while True:
            params = {
                "key": api_key,
                "location": location,
                "radius": str(radius),
                "types": cat_code,
                "offset": "25",
                "page": str(page),
                "extensions": "all",
            }
            try:
                data = http_get(AMAP_AROUND_URL, params, timeout=10)
            except Exception as e:
                print(f"  [{school['name']}] {cat_name} page={page} 请求失败: {e}")
                break

            if data.get("status") != "1":
                print(f"  [{school['name']}] {cat_name} API 错误: {data.get('info', 'unknown')}")
                break

            pois = data.get("pois", [])
            if not pois:
                break

            # 转换为统一格式
            for poi in pois:
                loc = poi.get("location", "0,0").split(",")
                biz = poi.get("biz_ext", {}) or {}
                photos = poi.get("photos", []) or []

                record = {
                    "name": poi.get("name", ""),
                    "type": CATEGORY_MAP.get(cat_code, "other"),
                    "sub_type": SUBTYPE_MAP.get(poi.get("typecode", ""), ""),
                    "address": poi.get("address", ""),
                    "lat": float(loc[1]) if len(loc) > 1 else 0,
                    "lng": float(loc[0]) if len(loc) > 0 else 0,
                    "phone": poi.get("tel", ""),
                    "distance_meters": int(poi.get("distance", 0)),
                    "source_rating": float(biz.get("rating", 0) or 0),
                    "source_cost": float(biz.get("cost", 0) or 0),
                    "photos": [p.get("url", "") for p in photos[:3] if p.get("url")],
                    "source": "amap",
                    "source_type_code": poi.get("typecode", ""),
                    "source_type_name": poi.get("type", ""),
                }
                cat_pois.append(record)

            total = int(data.get("count", 0))
            print(f"  [{school['name']}] {cat_name} page={page}: got {len(pois)}, total={total}")

            if page * 25 >= min(total, 1000) or page >= 40:
                break
            page += 1
            time.sleep(0.15)  # 遵守高德 API 限速

        stats[cat_name] = len(cat_pois)
        all_pois.extend(cat_pois)

    # 保存
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, f"amap_{school['placeId']}.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_pois, f, ensure_ascii=False, indent=2)

    return all_pois, stats


def main():
    parser = argparse.ArgumentParser(description="高德地图 POI 周边搜索")
    parser.add_argument("--school", type=str, help="仅采集指定 placeId")
    parser.add_argument("--config", type=str, default="scripts/config.json")
    parser.add_argument("--output", type=str, default="data/raw")
    parser.add_argument("--apikey", type=str, help="高德 Web API Key (也可设环境变量)")
    args = parser.parse_args()

    config = load_config(args.config)

    # API Key 读取优先级: 命令行 > 环境变量(跟后端一致) > config.json
    api_key = args.apikey
    if not api_key:
        for env_name in ["TOURISM_AMAP_WEB_KEY", "TOURISM_AMAP_KEY", "AMAP_WEB_KEY"]:
            api_key = os.environ.get(env_name, "")
            if api_key:
                break
    if not api_key:
        api_key = config.get("amap", {}).get("apiKey", "")

    if not api_key:
        print("=" * 60)
        print("错误: 未找到高德 API Key")
        print("=" * 60)
        print("请通过以下任一方式提供:")
        print("  1. 系统环境变量: TOURISM_AMAP_WEB_KEY (与后端共用)")
        print("  2. 系统环境变量: AMAP_WEB_KEY")
        print("  3. 命令行参数:   --apikey YOUR_KEY")
        print("  4. config.json: amap.apiKey 字段")
        print()
        print("如果后端能正常调用高德 API，说明环境变量已设置。")
        print("请检查 IDE 的运行配置或系统环境变量。")
        sys.exit(1)

    schools = config.get("schools", [])
    if args.school:
        schools = [s for s in schools if s["placeId"] == args.school]
        if not schools:
            print(f"未找到学校: {args.school}")
            sys.exit(1)

    print(f"开始采集 {len(schools)} 所学校...")
    print(f"API Key: {api_key[:8]}...{api_key[-4:]}")
    print()

    summary = {"updated": datetime.now().isoformat(), "schools": {}}
    total_pois = 0

    for i, school in enumerate(schools):
        pid = school["placeId"]
        name = school["name"]
        max_items = school.get("maxItems", config.get("defaultMaxItems", 20))
        limit_str = "不限量" if max_items == 0 else f"最多{max_items}条"

        print(f"[{i+1}/{len(schools)}] {name} ({pid}) — {limit_str}")

        try:
            pois, stats = scrape_school(school, api_key, config, args.output)
            total_pois += len(pois)
            summary["schools"][pid] = {
                "name": name,
                "total_raw": len(pois),
                "by_category": stats,
                "maxItems": max_items,
            }
            print(f"  → 采集完成: {len(pois)} 条原始数据")
            # 打印分类统计
            for cat, cnt in sorted(stats.items()):
                print(f"     {cat}: {cnt}")
            print()
        except Exception as e:
            print(f"  → 采集失败: {e}\n")
            summary["schools"][pid] = {"name": name, "error": str(e)}

    # 写汇总
    summary["total_raw_pois"] = total_pois
    summary_path = os.path.join(args.output, "_summary.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print(f"{'='*60}")
    print(f"全部完成! 共 {len(schools)} 所学校, {total_pois} 条原始 POI")
    print(f"数据目录: {args.output}/")
    print(f"汇总文件: {summary_path}")


if __name__ == "__main__":
    main()
