#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据迁移脚本：将 tourism-system/backend/data/ 中的 JSON 数据
导入到 MySQL tourism_db 数据库。

依赖：
    pip install pymysql bcrypt

用法：
    python migrate_data.py \
        --host localhost \
        --port 3306 \
        --user root \
        --password your_password \
        --data-dir ../tourism-system/backend/data
"""

import json
import os
import sys
import argparse
import logging
from pathlib import Path

try:
    import pymysql
    import pymysql.cursors
except ImportError:
    print("请先安装依赖: pip install pymysql bcrypt")
    sys.exit(1)

try:
    import bcrypt
    def hash_password(raw: str) -> str:
        return bcrypt.hashpw(raw.encode(), bcrypt.gensalt()).decode()
except ImportError:
    # 若 bcrypt 未安装，使用占位符（生产环境请务必安装）
    def hash_password(raw: str) -> str:
        return "$2b$12$PLACEHOLDER_" + raw  # 仅用于开发测试

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def load_json(path: Path) -> list:
    if not path.exists():
        logger.warning(f"文件不存在，跳过: {path}")
        return []
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    logger.info(f"加载 {path.name}: {len(data)} 条记录")
    return data


def migrate_users(cursor, users: list):
    """迁移用户数据，密码使用 BCrypt 重新加密"""
    sql = """
        INSERT IGNORE INTO sys_user
            (username, password, interests, favorite_categories, created_at, updated_at)
        VALUES (%s, %s, %s, %s, NOW(), NOW())
    """
    count = 0
    for u in users:
        interests = json.dumps(u.get("interests", []), ensure_ascii=False)
        fav_cats  = json.dumps(u.get("favoriteCategories", []), ensure_ascii=False)
        raw_pwd   = u.get("password", "123456")
        hashed    = hash_password(str(raw_pwd))
        cursor.execute(sql, (u["username"], hashed, interests, fav_cats))
        count += 1
    logger.info(f"  ✓ 用户 迁移 {count} 条")


def migrate_places(cursor, places: list):
    """迁移场所数据"""
    sql = """
        INSERT IGNORE INTO spot_place
            (id, name, type, keywords, features, rating, rating_count, click_count,
             lat, lng, address, open_time, image, `description`, created_at, updated_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())
    """
    count = 0
    for p in places:
        loc = p.get("location", {})
        cursor.execute(sql, (
            p["id"],
            p.get("name", ""),
            p.get("type", ""),
            json.dumps(p.get("keywords", []), ensure_ascii=False),
            json.dumps(p.get("features", []), ensure_ascii=False),
            p.get("rating", 0),
            p.get("ratingCount", 0),
            p.get("clickCount", 0),
            loc.get("lat"),
            loc.get("lng"),
            p.get("address"),
            p.get("openTime"),
            p.get("image"),
            p.get("description"),
        ))
        count += 1
    logger.info(f"  ✓ 场所 迁移 {count} 条")


def migrate_buildings(cursor, buildings: list):
    """迁移建筑物数据"""
    sql = """
        INSERT IGNORE INTO spot_building
            (id, name, type, place_id, lat, lng, `description`, rating, created_at, updated_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())
    """
    count = 0
    for b in buildings:
        loc = b.get("location", {})
        cursor.execute(sql, (
            b["id"],
            b.get("name", ""),
            b.get("type"),
            b.get("placeId", ""),
            loc.get("lat"),
            loc.get("lng"),
            b.get("description"),
            b.get("rating", 0),
        ))
        count += 1
    logger.info(f"  ✓ 建筑物 迁移 {count} 条")


def migrate_facilities(cursor, facilities: list):
    """迁移服务设施数据"""
    sql = """
        INSERT IGNORE INTO spot_facility
            (id, name, type, place_id, lat, lng, `description`, rating, created_at, updated_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())
    """
    count = 0
    for f in facilities:
        loc = f.get("location", {})
        cursor.execute(sql, (
            f["id"],
            f.get("name", ""),
            f.get("type", "其他"),
            f.get("placeId", ""),
            loc.get("lat"),
            loc.get("lng"),
            f.get("description"),
            f.get("rating", 0),
        ))
        count += 1
    logger.info(f"  ✓ 服务设施 迁移 {count} 条")


def migrate_roads(cursor, roads: list):
    """迁移道路拓扑数据"""
    sql = """
        INSERT IGNORE INTO spot_road_edge
            (id, from_node, to_node, distance, ideal_speed, congestion_rate,
             allowed_vehicles, road_type, created_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,NOW())
    """
    count = 0
    for r in roads:
        cursor.execute(sql, (
            r["id"],
            r.get("from", ""),
            r.get("to", ""),
            r.get("distance", 0),
            r.get("idealSpeed", 4),
            r.get("congestionRate", 1.0),
            json.dumps(r.get("allowedVehicles", []), ensure_ascii=False),
            r.get("roadType"),
        ))
        count += 1
    logger.info(f"  ✓ 道路边 迁移 {count} 条")


def migrate_diaries(cursor, diaries: list, user_id_map: dict):
    """迁移旅游日记数据"""
    sql = """
        INSERT IGNORE INTO travel_diary
            (id, title, `content`, place_id, author_id, click_count,
             rating, rating_count, images, videos, tags, created_at, updated_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
    """
    count = 0
    for d in diaries:
        author_str = d.get("authorId", "user_001")
        author_id  = user_id_map.get(author_str, 1)
        created_at = d.get("createdAt", "2025-01-01T00:00:00Z").replace("Z", "").replace("T", " ")[:19]
        cursor.execute(sql, (
            d["id"],
            d.get("title", ""),
            d.get("content", ""),
            d.get("placeId"),
            author_id,
            d.get("clickCount", 0),
            d.get("rating", 0),
            d.get("ratingCount", 0),
            json.dumps(d.get("images", []), ensure_ascii=False),
            json.dumps(d.get("videos", []), ensure_ascii=False),
            json.dumps(d.get("tags", []), ensure_ascii=False),
            created_at,
        ))
        count += 1
    logger.info(f"  ✓ 旅游日记 迁移 {count} 条")


def migrate_behaviors(cursor, users: list, user_id_map: dict):
    """从 users.json 的 visitHistory / ratingHistory 生成用户行为记录"""
    sql = """
        INSERT IGNORE INTO user_behavior
            (user_id, target_id, behavior_type, score, created_at)
        VALUES (%s,%s,%s,%s,%s)
    """
    count = 0
    for u in users:
        uid = user_id_map.get(u["id"], 1)

        # 浏览历史 -> VIEW
        for place_id in u.get("visitHistory", []):
            try:
                cursor.execute(sql, (uid, place_id, "VIEW", 1.0, "2025-01-01 00:00:00"))
                count += 1
            except Exception:
                pass  # 忽略重复

        # 评分历史 -> RATE
        for rec in u.get("ratingHistory", []):
            created = rec.get("date", "2025-01-01T00:00:00Z").replace("Z", "").replace("T", " ")[:19]
            try:
                cursor.execute(sql, (uid, rec["placeId"], "RATE", rec["rating"], created))
                count += 1
            except Exception:
                pass

    logger.info(f"  ✓ 用户行为 迁移 {count} 条")


def main():
    parser = argparse.ArgumentParser(description="旅游系统数据迁移脚本")
    parser.add_argument("--host",     default="localhost",  help="MySQL 主机")
    parser.add_argument("--port",     type=int, default=3306, help="MySQL 端口")
    parser.add_argument("--user",     default="root",        help="MySQL 用户名")
    parser.add_argument("--password", default="",            help="MySQL 密码")
    parser.add_argument("--database", default="tourism_db",  help="目标数据库")
    parser.add_argument("--data-dir", default="../tourism-system/backend/data", help="JSON 数据目录")
    args = parser.parse_args()

    data_dir = Path(args.data_dir).resolve()
    logger.info(f"数据目录: {data_dir}")

    # 连接数据库
    try:
        conn = pymysql.connect(
            host=args.host, port=args.port,
            user=args.user, password=args.password,
            database=args.database,
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor,
        )
    except Exception as e:
        logger.error(f"数据库连接失败: {e}")
        logger.error("请确认 MySQL 已启动，并已执行 sql/schema.sql 建表")
        sys.exit(1)

    # 加载 JSON 数据
    users     = load_json(data_dir / "users.json")
    places    = load_json(data_dir / "places.json")
    buildings = load_json(data_dir / "buildings.json")
    facilities= load_json(data_dir / "facilities.json")
    roads     = load_json(data_dir / "roads.json")
    diaries   = load_json(data_dir / "diaries.json")

    with conn:
        with conn.cursor() as cursor:
            logger.info("=== 开始迁移 ===")

            # 1. 迁移用户（先生成 user_id_map）
            migrate_users(cursor, users)
            conn.commit()

            # 查询用户 username -> id 映射（用于日记/行为）
            cursor.execute("SELECT id, username FROM sys_user")
            username_map = {row["username"]: row["id"] for row in cursor.fetchall()}

            # 原始 user_xxx -> db_id 映射
            user_id_map = {}
            for u in users:
                uname = u.get("username")
                if uname in username_map:
                    user_id_map[u["id"]] = username_map[uname]

            # 2. 迁移场所
            migrate_places(cursor, places)
            conn.commit()

            # 3. 迁移建筑物
            migrate_buildings(cursor, buildings)
            conn.commit()

            # 4. 迁移设施
            migrate_facilities(cursor, facilities)
            conn.commit()

            # 5. 迁移道路
            migrate_roads(cursor, roads)
            conn.commit()

            # 6. 迁移日记
            migrate_diaries(cursor, diaries, user_id_map)
            conn.commit()

            # 7. 迁移用户行为
            migrate_behaviors(cursor, users, user_id_map)
            conn.commit()

            logger.info("=== 迁移完成 ===")

            # 统计
            for table in ["sys_user", "spot_place", "spot_building",
                          "spot_facility", "spot_road_edge", "travel_diary", "user_behavior"]:
                cursor.execute(f"SELECT COUNT(*) AS cnt FROM `{table}`")
                cnt = cursor.fetchone()["cnt"]
                logger.info(f"  {table}: {cnt} 条")


if __name__ == "__main__":
    main()
