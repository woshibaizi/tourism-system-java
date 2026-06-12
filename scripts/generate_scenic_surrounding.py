"""
为景区生成周边数据 — 每处20条纯文字，LLM批量生成

用法:
    py scripts/generate_scenic_surrounding.py              # 全部200个景区
    py scripts/generate_scenic_surrounding.py --limit 3    # 仅前3个(测试)
    py scripts/generate_scenic_surrounding.py --ids place_102,place_103  # 指定景区
    py scripts/generate_scenic_surrounding.py --no-llm     # 跳过LLM, 用规则生成

输出: sql/scenic_surrounding_data.sql
"""

import json
import os
import sys
import time
import math
import random
import argparse
import urllib.request
import urllib.error
from datetime import datetime

# ─── LLM 提示词 ──────────────────────────────────
SYSTEM_PROMPT = """你是一个旅游数据编辑，为全国各大景区的周边环境生成简要的商户/设施数据。

为每个景区生成恰好20条周边商户/设施。每条数据的type可以是:
- restaurant: 周边的餐饮(餐馆、小吃、咖啡等)
- shopping: 购物场所(特产店、超市等)
- entertainment: 休闲娱乐
- hotel: 周边住宿
- transport: 交通设施(公交站、停车场、地铁站)
- service: 生活服务(银行、医院、卫生间等)

要求:
1. 商户名称要真实可信，结合景区所在地和景区特点
2. 生成的经纬度在景区坐标周边1-3km范围内
3. distance_meters在100-3000之间
4. description约15-40字简述
5. tags给2-3个标签
6. price_range根据类型合理设置(¥/¥¥/¥¥¥)
7. 不要生成已存在于高德地图中的真实商户名(避免重复)，用泛化名称即可

输出格式(每景区一个JSON数组, 20条):
[{"name":"景区附近小吃街","type":"restaurant","lat":39.9165,"lng":116.3978,"distance":520,"price_range":"¥","avg_cost":25,"description":"汇集各地特色小吃的步行街，价格实惠。","tags":["特色小吃","价格实惠"]},...]

仅输出JSON数组，不要markdown包裹。"""


def http_post_json(url, payload, headers, timeout=90):
    """urllib POST JSON"""
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8") if e.fp else str(e)
        raise RuntimeError(f"HTTP {e.code}: {err[:300]}")
    except urllib.error.URLError as e:
        raise ConnectionError(f"请求失败: {e}")


def load_dotenv(path):
    result = {}
    if not os.path.exists(path):
        return result
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            result[k.strip()] = v.strip().strip('"').strip("'")
    return result


def get_llm_config():
    """获取LLM配置"""
    api_key = ""
    base_url = "https://api.deepseek.com"
    model = "deepseek-chat"

    # agent-service/.env
    dotenv_path = os.path.join(os.path.dirname(__file__), "..", "agent-service", ".env")
    env = load_dotenv(dotenv_path)
    api_key = env.get("TEXT_LLM_API_KEY") or env.get("LLM_API_KEY") or ""
    base_url = env.get("TEXT_LLM_BASE_URL") or env.get("LLM_BASE_URL") or base_url
    model = env.get("TEXT_LLM_MODEL") or env.get("LLM_MODEL") or model

    if not api_key:
        api_key = os.environ.get("TEXT_LLM_API_KEY") or os.environ.get("LLM_API_KEY") or ""

    return api_key, base_url, model


def generate_with_llm(scenic_spot, api_key, base_url, model):
    """用LLM为一个景区生成20条周边数据"""
    prompt = f"""景区: {scenic_spot['name']}
地址: {scenic_spot.get('address', '')}
坐标: lat={scenic_spot['lat']}, lng={scenic_spot['lng']}
类型: 景区

请为此景区生成20条周边商户/设施数据。"""

    url = f"{base_url.rstrip('/')}/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.8,
        "max_tokens": 3000,
    }

    try:
        resp = http_post_json(url, payload, headers, timeout=90)
        content = resp["choices"][0]["message"]["content"] or ""
        # Extract JSON from response
        content = content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1]
            if content.endswith("```"):
                content = content[:-3]
        items = json.loads(content)
        return items
    except Exception as e:
        print(f"  LLM error: {e}")
        return None


def generate_fallback(scenic_spot):
    """规则生成20条周边(LLM不可用时的fallback)"""
    lat, lng = scenic_spot['lat'], scenic_spot['lng']
    templates = [
        # type, name_pattern, price, desc_pattern, tags
        ("restaurant", ["本地特色餐厅", "小吃一条街", "农家乐", "清真面馆", "土菜馆", "火锅店"], "¥", "景区周边的实惠餐饮，深受游客欢迎。", ["地方特色", "价格实惠"]),
        ("restaurant", ["咖啡厅", "茶馆", "烧烤大排档", "米粉店", "主题餐厅"], "¥¥", "环境舒适的特色餐饮，适合休憩品尝。", ["环境舒适", "特色美食"]),
        ("shopping", ["特产商行", "纪念品超市", "手工艺品店", "文创店"], "¥", "游客购买伴手礼和纪念品的好去处。", ["购物", "伴手礼"]),
        ("shopping", ["便利店", "小超市"], "¥", "满足游客日常补给需求。", ["便利"]),
        ("entertainment", ["KTV", "棋牌室", "演艺中心", "温泉会所"], "¥¥", "周边休闲娱乐场所，丰富旅程体验。", ["休闲娱乐"]),
        ("hotel", ["快捷酒店", "主题民宿", "青年旅舍"], "¥¥", "景区周边住宿，价格适中交通便利。", ["住宿", "交通便利"]),
        ("hotel", ["度假酒店", "精品客栈"], "¥¥¥", "品质住宿，适合休闲度假。", ["品质住宿", "休闲度假"]),
        ("transport", ["停车场", "游客集散中心"], None, "游客停车和集散中转。", ["停车", "交通枢纽"]),
        ("transport", ["公交站", "旅游专线站"], None, "直达景区的公共交通站点。", ["公交", "出行"]),
        ("service", ["游客服务中心", "ATM取款机", "药店", "卫生间"], None, "景区周边的便民服务设施。", ["便民服务"]),
    ]

    items = []
    for i in range(20):
        cat_idx = i % len(templates)
        cat, names, price, desc, tags = templates[cat_idx]
        name = random.choice(names)

        # Random offset within 3km
        angle = random.uniform(0, 2 * math.pi)
        dist = random.uniform(100, 3000)
        dlat = dist * math.cos(angle) / 111320
        dlng = dist * math.sin(angle) / (111320 * math.cos(math.radians(lat)))

        items.append({
            "name": f"{name}({scenic_spot['name']}周边)",
            "type": cat,
            "lat": round(lat + dlat, 7),
            "lng": round(lng + dlng, 7),
            "distance": round(dist),
            "price_range": price,
            "avg_cost": random.randint(15, 200) if price else None,
            "description": desc,
            "tags": tags,
        })
    return items


def record_to_sql(record, spot_id, idx):
    """单条记录 → INSERT VALUES"""
    rid = f"sr_{spot_id.replace('place_', '')}_{idx:02d}"

    def esc(v):
        if v is None: return "NULL"
        if isinstance(v, bool): return "1" if v else "0"
        if isinstance(v, (int, float)): return str(v)
        s = str(v).replace("\\", "\\\\").replace("'", "\\'")
        return f"'{s}'"

    def jesc(v):
        if v is None: return "NULL"
        if isinstance(v, (list, dict)):
            s = json.dumps(v, ensure_ascii=False).replace("\\", "\\\\").replace("'", "\\'")
            return f"'{s}'"
        return esc(v)

    return (
        f"INSERT INTO `spot_surrounding` "
        f"(`id`,`name`,`type`,`sub_type`,`place_id`,`lat`,`lng`,`address`,"
        f"`distance_meters`,`price_range`,`avg_cost`,`phone`,`image`,`images`,`tags`,"
        f"`rating`,`rating_count`,`click_count`,`description`,`detail_description`,"
        f"`student_discount`,`must_try`,`deleted`) VALUES ("
        f"{esc(rid)},{esc(record['name'])},{esc(record['type'])},NULL,"
        f"{esc(spot_id)},{esc(record['lat'])},{esc(record['lng'])},NULL,"
        f"{esc(record['distance'])},{esc(record.get('price_range'))},{esc(record.get('avg_cost'))},"
        f"NULL,NULL,NULL,{jesc(record.get('tags',[]))},"
        f"{esc(round(random.uniform(3.5,4.9),1))},0,0,"
        f"{esc(record['description'])},NULL,0,NULL,0)"
    )


def main():
    parser = argparse.ArgumentParser(description="景区周边数据生成")
    parser.add_argument("--limit", type=int, help="仅处理前N个景区")
    parser.add_argument("--ids", type=str, help="指定景区ID,逗号分隔")
    parser.add_argument("--no-llm", action="store_true", help="跳过LLM,用规则生成")
    parser.add_argument("--output", type=str, default="sql/scenic_surrounding_data.sql")
    args = parser.parse_args()

    # ── 从数据库获取景区列表 ────────────────────
    import subprocess
    result = subprocess.run(
        ["C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe",
         "--default-character-set=utf8mb4", "-u", "root", "-p608052", "tourism_db",
         "-e", "SELECT id, name, lat, lng, address FROM spot_place WHERE type='景区' AND deleted=0 ORDER BY id"],
        capture_output=True
    )

    stdout = result.stdout.decode("utf-8", errors="replace") if result.stdout else ""
    spots = []
    for line in stdout.strip().split("\n")[1:]:
        parts = line.split("\t")
        if len(parts) >= 5:
            try:
                spots.append({
                    "id": parts[0], "name": parts[1],
                    "lat": float(parts[2]), "lng": float(parts[3]),
                    "address": parts[4] if len(parts) > 4 else "",
                })
            except (ValueError, IndexError):
                continue

    if args.ids:
        ids_set = set(args.ids.split(","))
        spots = [s for s in spots if s["id"] in ids_set]
    if args.limit:
        spots = spots[:args.limit]

    print(f"景区总数: {len(spots)}")
    if len(spots) == 0:
        print("没有找到景区!")
        return

    # ── LLM 配置 ──────────────────────────────
    api_key, base_url, model = get_llm_config()
    use_llm = not args.no_llm and bool(api_key)

    if use_llm:
        print(f"LLM: {model} @ {base_url}")
    else:
        print("模式: 规则生成 (fallback)")

    print()

    # ── 逐景区生成 ─────────────────────────────
    all_sql = []
    ok_count = 0

    for i, spot in enumerate(spots):
        sid = spot['id']
        print(f"[{i+1}/{len(spots)}] {spot['name']} ({sid})...", end=" ", flush=True)

        items = None
        if use_llm:
            try:
                items = generate_with_llm(spot, api_key, base_url, model)
                time.sleep(0.3)  # rate limit
            except Exception as e:
                print(f"LLM失败: {e}")
                items = None

        if items is None:
            items = generate_fallback(spot)

        # Generate SQL for this spot
        for j, item in enumerate(items[:20]):
            all_sql.append(record_to_sql(item, sid, j + 1))

        ok_count += 1
        print(f"{len(items[:20])}条")

    # ── 输出 SQL ───────────────────────────────
    output_path = args.output
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    header = f"""-- ============================================================
-- 景区周边商户数据 (纯文字)
-- 生成时间: {timestamp}
-- 总计: {len(all_sql)} 条
-- 覆盖: {ok_count} 个景区
-- 模式: {'LLM' if use_llm else '规则生成'}
-- ============================================================

"""

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(header)
        f.write(";\n".join(all_sql))
        f.write(";\n")

    # Data size estimation
    total = len(all_sql)
    print(f"\n{'='*60}")
    print(f"全部完成! {total} 条 INSERT → {output_path}")
    print(f"预估: {total}条 / 20每处 = {total//20} 景区")


if __name__ == "__main__":
    main()
