#!/usr/bin/env python3
"""
景区/校园封面照片自动下载脚本 v2
=================================
功能:
  1. 从 MySQL 读取所有场所的名称和 image 字段
  2. 检测本地缺失的照片文件
  3. 通过 Pexels API 搜索并下载对应照片（含去重）
  4. 未找到的自动生成带名称的占位图片
  5. 支持断点续传 (已存在的文件跳过)
  6. MD5 去重：确保不同景区不会下载到同一张照片

使用方法:
  python scripts/fetch_images.py

环境要求:
  pip install pymysql pillow requests

可选 (Pexels API, 免费注册 https://www.pexels.com/api/):
  export PEXELS_API_KEY=your_key_here
"""

import os
import sys
import time
import json
import random
import hashlib
import logging
from pathlib import Path
from io import BytesIO
from urllib.parse import quote_plus

import requests
import pymysql
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ========== 配置 ==========
DB_CONFIG = {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "608052",
    "database": "tourism_db",
    "charset": "utf8mb4",
}

# 项目根目录
PROJECT_ROOT = Path(__file__).resolve().parent.parent
UPLOAD_DIR = PROJECT_ROOT / "uploads" / "images"
DEFAULT_WIDTH = 800
DEFAULT_HEIGHT = 600

# Pexels API key (从环境变量读取，免费申请: https://www.pexels.com/api/)
PEXELS_API_KEY = os.environ.get("PEXELS_API_KEY", "")
PEXELS_API_URL = "https://api.pexels.com/v1/search"

# 请求间隔 (秒)
REQUEST_DELAY = 2.0
BATCH_DELAY = 10.0

# 日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)


# ========== 数据库操作 ==========
def get_all_places():
    """从数据库读取所有场所的 id, name, image 字段"""
    conn = pymysql.connect(**DB_CONFIG)
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT id, name, image, type FROM spot_place WHERE deleted = 0")
            places = cursor.fetchall()
        log.info(f"从数据库读取到 {len(places)} 个场所")
        return places
    finally:
        conn.close()


def update_place_image(place_id, image_path):
    """更新数据库中场所的 image 字段"""
    conn = pymysql.connect(**DB_CONFIG)
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "UPDATE spot_place SET image = %s WHERE id = %s",
                (image_path, place_id),
            )
        conn.commit()
    finally:
        conn.close()


# ========== 图片处理 ==========
def get_local_filename(place):
    """
    根据场所的 image 字段解析目标文件名。
    例如 image='uploads/images/北海公园.jpg' → 北海公园.jpg
    """
    image_field = place.get("image", "")
    if image_field:
        filename = os.path.basename(image_field)
        if filename:
            return filename
    # fallback: 使用名称 + .jpg
    safe_name = place["name"].replace("/", "_").replace("\\", "_")
    return f"{safe_name}.jpg"


def file_exists(filename):
    """检查图片文件是否已存在 (非空文件)"""
    filepath = UPLOAD_DIR / filename
    return filepath.exists() and filepath.stat().st_size > 100


# ========== Pexels API 下载 ==========
def search_pexels(query, max_results=15, random_page=True):
    """通过 Pexels API 搜索图片，返回图片URL列表。
    增加随机翻页避免总是返回相同的热门图片。"""
    if not PEXELS_API_KEY:
        return []

    headers = {"Authorization": PEXELS_API_KEY}
    page = random.randint(1, 5) if random_page else 1
    params = {
        "query": query,
        "per_page": min(max_results, 80),
        "page": page,
        "orientation": "landscape",
        "size": "large",
        "locale": "zh-CN",
    }

    try:
        resp = requests.get(PEXELS_API_URL, headers=headers, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        photos = data.get("photos", [])
        urls = []
        for photo in photos:
            src = photo.get("src", {})
            url = src.get("large2x") or src.get("large") or src.get("original") or src.get("medium")
            if url:
                urls.append(url)
        return urls
    except requests.exceptions.HTTPError as e:
        if e.response is not None and e.response.status_code == 429:
            log.warning("Pexels API rate limit, waiting 60s...")
            time.sleep(60)
        else:
            log.warning(f"Pexels API error: {e}")
        return []
    except Exception as e:
        log.warning(f"Pexels API exception: {e}")
        return []


def download_image(url, timeout=30):
    """从 URL 下载图片，返回 bytes"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        resp = requests.get(url, headers=headers, timeout=timeout)
        resp.raise_for_status()
        if len(resp.content) > 500:  # 至少500字节
            return resp.content
    except Exception as e:
        log.debug(f"下载失败 {url[:60]}: {e}")
    return None


# ========== PIL 占位图生成 ==========
def generate_placeholder(name, filename):
    """
    生成一张带有景区名称的精美占位图。
    颜色根据名称哈希生成，保证每个景区颜色不同但稳定。
    """
    width, height = DEFAULT_WIDTH, DEFAULT_HEIGHT

    # 用名称哈希生成稳定的背景色
    hash_val = int(hashlib.md5(name.encode()).hexdigest(), 16)
    hue = hash_val % 360
    # 转换为柔和的颜色 (低饱和度、中等亮度)
    import colorsys
    r, g, b = colorsys.hsv_to_rgb(hue / 360, 0.35, 0.65)
    bg_color = (int(r * 255), int(g * 255), int(b * 255))

    # 创建渐变背景
    img = Image.new("RGB", (width, height), bg_color)
    draw = ImageDraw.Draw(img)

    # 添加简单的渐变效果
    for y in range(height):
        factor = 1.0 - (y / height) * 0.3
        line_color = (
            int(bg_color[0] * factor),
            int(bg_color[1] * factor),
            int(bg_color[2] * factor),
        )
        draw.line([(0, y), (width, y)], fill=line_color)

    # 尝试加载中文字体
    font_large = None
    font_small = None
    font_paths = [
        # Windows
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/msyhbd.ttc",
        "C:/Windows/Fonts/simhei.ttf",
        "C:/Windows/Fonts/simsun.ttc",
        # macOS
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        # Linux
        "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    ]
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                font_large = ImageFont.truetype(fp, 52)
                font_small = ImageFont.truetype(fp, 28)
                break
            except Exception:
                continue

    if font_large is None:
        font_large = ImageFont.load_default()
        font_small = ImageFont.load_default()
        log.warning("未找到中文字体，使用默认字体（可能不支持中文）")

    # 绘制半透明装饰圆形
    overlay = Image.new("RGBA", (width, height), (255, 255, 255, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    cx, cy = width // 2, height // 2 - 40
    for i, radius in enumerate([200, 160, 120]):
        alpha = 15 + i * 10
        overlay_draw.ellipse(
            [cx - radius, cy - radius, cx + radius, cy + radius],
            fill=(255, 255, 255, alpha),
        )
    img = img.convert("RGBA")
    img = Image.alpha_composite(img, overlay)
    img = img.convert("RGB")

    draw = ImageDraw.Draw(img)

    # 绘制地点图标 (简单的山形)
    icon_cx, icon_cy = cx, cy - 50
    # 山形三角形
    mountain = [(icon_cx - 60, icon_cy + 40), (icon_cx, icon_cy - 60), (icon_cx + 60, icon_cy + 40)]
    draw.polygon(mountain, fill=(255, 255, 255, 160))
    # 太阳
    draw.ellipse([icon_cx + 30, icon_cy - 60, icon_cx + 70, icon_cy - 20], fill=(255, 255, 200, 180))

    # 绘制景区名称
    name_text = name
    # 计算文字位置（居中）
    try:
        bbox = draw.textbbox((0, 0), name_text, font=font_large)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
    except AttributeError:
        text_width, text_height = draw.textsize(name_text, font=font_large)

    text_x = (width - text_width) // 2
    text_y = height - 160
    # 文字阴影
    draw.text((text_x + 2, text_y + 2), name_text, fill=(0, 0, 0, 80), font=font_large)
    # 文字主体
    draw.text((text_x, text_y), name_text, fill=(255, 255, 255), font=font_large)

    # 副标题
    subtitle = "智慧旅游 · 景区导览"
    try:
        bbox = draw.textbbox((0, 0), subtitle, font=font_small)
        sub_w = bbox[2] - bbox[0]
    except AttributeError:
        sub_w, _ = draw.textsize(subtitle, font=font_small)
    sub_x = (width - sub_w) // 2
    draw.text((sub_x + 1, text_y + 70), subtitle, fill=(0, 0, 0, 50), font=font_small)
    draw.text((sub_x, text_y + 69), subtitle, fill=(255, 255, 255, 180), font=font_small)

    # 保存
    filepath = UPLOAD_DIR / filename
    img.save(filepath, "JPEG", quality=85)
    return True


# ========== 全局去重集合 ==========
# 存储已下载图片的 MD5 哈希，确保不同景区不会下载到同一张照片
DOWNLOADED_HASHES = set()


def load_existing_hashes():
    """启动时扫描已存在的图片文件，将其哈希加入去重集合"""
    count = 0
    if not UPLOAD_DIR.exists():
        return count
    for f in UPLOAD_DIR.iterdir():
        if f.suffix.lower() in ('.jpg', '.jpeg', '.png') and f.stat().st_size > 100:
            try:
                with open(f, 'rb') as fh:
                    h = hashlib.md5(fh.read()).hexdigest()
                DOWNLOADED_HASHES.add(h)
                count += 1
            except Exception:
                pass
    return count


# ========== 主流程 ==========
def build_search_queries(place):
    """根据场所信息构建搜索词，从精确到宽松逐步降级"""
    name = place.get("name", "")
    address = place.get("address", "")
    keywords_str = place.get("keywords", "[]")
    ptype = place.get("type", "")

    # 解析 JSON
    try:
        keywords = json.loads(keywords_str) if isinstance(keywords_str, str) else keywords_str
    except (json.JSONDecodeError, TypeError):
        keywords = []

    # 提取城市/省份
    city_province = ""
    if address:
        parts = address.replace("省", " ").replace("市", " ").replace("区", " ").replace("县", " ").split()
        if len(parts) >= 2:
            city_province = f"{parts[0]} {parts[1]}"
        elif len(parts) >= 1:
            city_province = parts[0]

    queries = []

    # 阶段1: 精确+地名限定（最优先）
    if city_province:
        queries.append(f"{name} {city_province} travel")
        queries.append(f"{name} {city_province} scenery")

    # 阶段2: 中文搜索
    queries.append(f"{name} 风景")
    queries.append(f"{name} 景区")

    # 阶段3: 类型+特征搜索
    if "山" in name or "山" in " ".join(keywords):
        queries.append(f"{name} mountain landscape")
    elif "湖" in name or "水" in name:
        queries.append(f"{name} lake water landscape")
    elif "寺庙" in name or "寺" in name or "宫" in name:
        queries.append(f"{name} temple architecture")
    elif "古城" in name or "古镇" in name:
        queries.append(f"{name} ancient town")
    elif "草原" in name:
        queries.append(f"{name} grassland")
    elif "瀑布" in name:
        queries.append(f"{name} waterfall")
    elif "沙漠" in name or "沙" in name:
        queries.append(f"{name} desert")
    elif "雪山" in name:
        queries.append(f"{name} snow mountain")

    # 阶段4: 英文通用搜索（加地名增加区分度）
    if city_province:
        queries.append(f"{name} China travel destination")

    # 阶段5: 纯名称（最宽泛）
    queries.append(name)

    return queries


def fetch_image_for_place(place, filename):
    """
    为一个场所下载图片。
    策略: Pexels 多关键词搜索 → MD5 去重 → 失败则生成占位图
    """
    name = place["name"]

    # 已存在则跳过（同时加载其哈希到去重集合）
    if file_exists(filename):
        try:
            with open(UPLOAD_DIR / filename, 'rb') as fh:
                DOWNLOADED_HASHES.add(hashlib.md5(fh.read()).hexdigest())
        except Exception:
            pass
        log.info(f"  [OK] exists: {filename}")
        return "exists"

    # 策略1: Pexels API（含去重）
    if PEXELS_API_KEY:
        search_queries = build_search_queries(place)
        tried_urls = set()

        for query in search_queries:
            urls = search_pexels(query, max_results=15, random_page=True)
            for url in urls:
                if url in tried_urls:
                    continue
                tried_urls.add(url)

                img_data = download_image(url)
                if not img_data:
                    continue

                # === MD5 去重检查 ===
                img_hash = hashlib.md5(img_data).hexdigest()
                if img_hash in DOWNLOADED_HASHES:
                    log.info(f"  [DUP] skip duplicate: {filename}")
                    continue  # 跳过重复，尝试下一张

                # 下载成功，保存并记录哈希
                DOWNLOADED_HASHES.add(img_hash)
                filepath = UPLOAD_DIR / filename
                filepath.write_bytes(img_data)
                log.info(f"  [Pexels] done: {filename} ({len(img_data)//1024}KB)")
                return "pexels"

            time.sleep(0.3)

    # 策略2: 所有URL都重复或无结果 → 生成占位图
    try:
        generate_placeholder(name, filename)
        log.info(f"  [GEN] placeholder: {filename}")
        return "placeholder"
    except Exception as e:
        log.error(f"  [FAIL] generate failed: {filename}: {e}")
        return "failed"


def main():
    # 确保上传目录存在
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # 加载已有图片哈希到去重集合
    existing_hashes = load_existing_hashes()
    log.info(f"Loaded {existing_hashes} existing image hashes for dedup")

    # 检查 Pexels API
    if PEXELS_API_KEY:
        log.info(f"Pexels API configured (key: {PEXELS_API_KEY[:8]}...)")
    else:
        log.warning("WARN: No PEXELS_API_KEY, will generate placeholders only")
        log.warning("  Get free key: https://www.pexels.com/api/")
        log.warning("  Then: export PEXELS_API_KEY=your_key")

    # 读取所有场所
    places = get_all_places()
    if not places:
        log.error("未读取到场所数据，检查数据库连接")
        return

    # 按类型分组统计
    types = {}
    for p in places:
        t = p.get("type", "未知")
        types[t] = types.get(t, 0) + 1
    log.info(f"场所类型分布: {types}")

    # 处理每个场所
    results = {"exists": 0, "pexels": 0, "placeholder": 0, "failed": 0}
    missing = []

    for i, place in enumerate(places):
        filename = get_local_filename(place)
        name = place["name"]
        ptype = place.get("type", "")

        log.info(f"[{i+1}/{len(places)}] {name} ({ptype})")

        status = fetch_image_for_place(place, filename)
        results[status] = results.get(status, 0) + 1

        if status == "failed":
            missing.append({"id": place["id"], "name": name, "filename": filename})

        # 请求间隔
        if status == "pexels":
            time.sleep(REQUEST_DELAY)

        # 每20个场所休息一下
        if (i + 1) % 20 == 0 and status != "exists":
            log.info(f"--- 进度: {i+1}/{len(places)}, 休息 {BATCH_DELAY} 秒 ---")
            time.sleep(BATCH_DELAY)

    # 报告
    log.info("=" * 50)
    log.info("DOWNLOAD COMPLETE!")
    log.info(f"  Existing files:   {results.get('exists', 0)}")
    if PEXELS_API_KEY:
        log.info(f"  Pexels downloads: {results.get('pexels', 0)}")
    log.info(f"  Placeholders:     {results.get('placeholder', 0)}")
    log.info(f"  Failed:           {results.get('failed', 0)}")
    log.info(f"  Unique hashes:    {len(DOWNLOADED_HASHES)}")
    log.info(f"  Image directory:  {UPLOAD_DIR}")

    if missing:
        log.warning(f"以下 {len(missing)} 个场所图片获取失败:")
        for m in missing:
            log.warning(f"  {m['id']} {m['name']} → {m['filename']}")


if __name__ == "__main__":
    main()
