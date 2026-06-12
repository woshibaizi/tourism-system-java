"""
Step 7: SQL 脚本生成

从最终校验通过的数据生成:
  1. surrounding_schema.sql — CREATE TABLE 建表语句
  2. surrounding_data.sql   — INSERT 数据语句

字段映射:
  JSON 字段          → SQL 列
  name               → name
  type               → type
  sub_type           → sub_type
  lat                → lat
  lng                → lng
  address            → address
  distance_meters    → distance_meters
  price_range        → price_range
  source_cost        → avg_cost
  description        → description
  detail_description → detail_description
  tags               → tags (JSON string)
  must_try           → must_try
  student_discount   → student_discount
  source_rating      → rating
  phone              → phone
  photos[0]          → image (第一张照片)

ID 生成规则: sr_{placeId后3位}_{序号}
  如: place_001 的第1条 = sr_001_01

用法:
    py scripts/generate_sql.py                      # 全部学校
    py scripts/generate_sql.py --school place_001   # 仅指定学校
"""

import json
import os
import argparse
from pathlib import Path
from datetime import datetime


# ─── SQL 模板 ─────────────────────────────────────
DDL_TEMPLATE = """-- ============================================================
-- 校园周边商户表
-- 生成时间: {timestamp}
-- ============================================================

DROP TABLE IF EXISTS `spot_surrounding`;

CREATE TABLE `spot_surrounding` (
    `id`              VARCHAR(32)    NOT NULL COMMENT '主键，如 sr_001_01',
    `name`            VARCHAR(100)   NOT NULL COMMENT '商户/场所名称',
    `type`            VARCHAR(30)    NOT NULL COMMENT '类型: restaurant/shopping/entertainment/hotel/transport/service',
    `sub_type`        VARCHAR(30)    DEFAULT NULL COMMENT '子类型: hotpot/milk_tea/cinema/ktv/metro 等',
    `place_id`        VARCHAR(32)    NOT NULL COMMENT '所属校园ID',
    `lat`             DECIMAL(10,7)  NOT NULL COMMENT '纬度 (WGS84)',
    `lng`             DECIMAL(10,7)  NOT NULL COMMENT '经度 (WGS84)',
    `address`         VARCHAR(255)   DEFAULT NULL COMMENT '详细地址',
    `distance_meters` INT            DEFAULT NULL COMMENT '距校园中心距离 (米)',
    `price_range`     VARCHAR(10)    DEFAULT NULL COMMENT '价格区间: ¥ / ¥¥ / ¥¥¥',
    `avg_cost`        DECIMAL(8,2)   DEFAULT NULL COMMENT '人均消费 (元)',
    `open_time`       VARCHAR(200)   DEFAULT NULL COMMENT '营业时间',
    `phone`           VARCHAR(30)    DEFAULT NULL COMMENT '联系电话',
    `image`           VARCHAR(500)   DEFAULT NULL COMMENT '封面图片路径',
    `images`          TEXT           DEFAULT NULL COMMENT '多图JSON数组',
    `tags`            TEXT           DEFAULT NULL COMMENT '标签JSON数组',
    `rating`          DECIMAL(2,1)   DEFAULT 0.0 COMMENT '综合评分 0.0~5.0',
    `rating_count`    INT            DEFAULT 0 COMMENT '评分人数',
    `click_count`     INT            DEFAULT 0 COMMENT '浏览量',
    `description`     VARCHAR(500)   DEFAULT NULL COMMENT '简要描述',
    `detail_description` TEXT        DEFAULT NULL COMMENT '详细介绍',
    `student_discount` TINYINT(1)    DEFAULT 0 COMMENT '是否学生优惠',
    `must_try`        VARCHAR(200)   DEFAULT NULL COMMENT '必点/必玩推荐',
    `deleted`         TINYINT(1)     DEFAULT 0 COMMENT '软删除',
    `created_at`      DATETIME       DEFAULT CURRENT_TIMESTAMP,
    `updated_at`      DATETIME       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_place_id` (`place_id`),
    INDEX `idx_type` (`type`),
    INDEX `idx_sub_type` (`sub_type`),
    INDEX `idx_rating` (`rating`),
    INDEX `idx_click_count` (`click_count`),
    INDEX `idx_distance` (`place_id`, `distance_meters`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='校园周边商户/场所';
"""

INSERT_HEADER = """-- ============================================================
-- 校园周边商户数据
-- 生成时间: {timestamp}
-- 总计: {total} 条
-- ============================================================

"""


def escape_sql(value):
    """SQL 字符串转义"""
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    s = str(value).replace("\\", "\\\\").replace("'", "\\'")
    return f"'{s}'"


def json_to_sql(value):
    """JSON 对象/数组 → SQL 字符串"""
    if value is None:
        return "NULL"
    if isinstance(value, (list, dict)):
        s = json.dumps(value, ensure_ascii=False).replace("\\", "\\\\").replace("'", "\\'")
        return f"'{s}'"
    s = str(value).replace("\\", "\\\\").replace("'", "\\'")
    return f"'{s}'"


def record_to_insert(record, place_id, idx):
    """单条记录 → INSERT VALUES"""
    # 生成 ID
    pid_num = place_id.replace("place_", "")
    record_id = f"sr_{pid_num}_{idx:02d}"

    fields = {
        "id": escape_sql(record_id),
        "name": escape_sql(record.get("name", "")),
        "type": escape_sql(record.get("type", "")),
        "sub_type": escape_sql(record.get("sub_type")),
        "place_id": escape_sql(place_id),
        "lat": escape_sql(record.get("lat")),
        "lng": escape_sql(record.get("lng")),
        "address": escape_sql(record.get("address")),
        "distance_meters": escape_sql(record.get("distance_meters")),
        "price_range": escape_sql(record.get("price_range")),
        "avg_cost": escape_sql(record.get("source_cost")),
        "phone": escape_sql(record.get("phone")),
        "image": escape_sql(_get_cover_image(record)),
        "images": json_to_sql(record.get("photos")),
        "tags": json_to_sql(record.get("tags")),
        "rating": escape_sql(round(float(record.get("source_rating", 0) or 0), 1)),
        "rating_count": "0",
        "click_count": "0",
        "description": escape_sql(record.get("description")),
        "detail_description": escape_sql(record.get("detail_description")),
        "student_discount": escape_sql(record.get("student_discount", False)),
        "must_try": escape_sql(record.get("must_try")),
    }

    cols = ", ".join(f"`{k}`" for k in fields)
    vals = ", ".join(fields[k] for k in fields)
    return f"INSERT INTO `spot_surrounding` ({cols}) VALUES ({vals});"


def _get_cover_image(record):
    """提取封面图片: 第一张照片, 或生成占位路径"""
    photos = record.get("photos", [])
    if photos and isinstance(photos, list) and len(photos) > 0:
        return photos[0]
    name = record.get("name", "unknown")
    return f"uploads/images/surrounding/{name}.jpg"


def generate_schema(output_dir, timestamp):
    """生成 DDL 文件"""
    ddl = DDL_TEMPLATE.format(timestamp=timestamp)

    schema_path = os.path.join(output_dir, "surrounding_schema.sql")
    with open(schema_path, "w", encoding="utf-8") as f:
        f.write(ddl.strip() + "\n")

    print(f"DDL → {schema_path}")
    return schema_path


def generate_data(all_inserts, output_dir, timestamp):
    """生成数据 SQL 文件"""
    total = len(all_inserts)
    content = INSERT_HEADER.format(timestamp=timestamp, total=total)
    content += "\n".join(all_inserts) + "\n"

    data_path = os.path.join(output_dir, "surrounding_data.sql")
    with open(data_path, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"数据 → {data_path} ({total} 条 INSERT)")
    return data_path


def load_config(config_path="scripts/config.json"):
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser(description="SQL生成")
    parser.add_argument("--school", type=str, help="仅处理指定 placeId")
    parser.add_argument("--config", type=str, default="scripts/config.json")
    parser.add_argument("--input-dir", type=str, default="data/validated")
    parser.add_argument("--output-dir", type=str, default="sql")
    parser.add_argument("--split", action="store_true", help="每校生成独立SQL文件")
    args = parser.parse_args()

    config = load_config(args.config)
    schools = config.get("schools", [])
    if args.school:
        schools = [s for s in schools if s["placeId"] == args.school]

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 生成 DDL
    generate_schema(args.output_dir, timestamp)

    # 收集所有 INSERT
    all_inserts = []
    stats = {}

    for school in schools:
        pid = school["placeId"]
        name = school["name"]
        input_path = os.path.join(args.input_dir, f"{pid}_ok.json")

        if not os.path.exists(input_path):
            # 尝试 enriched 目录
            input_path = os.path.join("data/enriched", f"{pid}_enriched.json")
            if not os.path.exists(input_path):
                print(f"[{pid}] {name} — 跳过 (无校验通过数据)")
                continue

        with open(input_path, "r", encoding="utf-8") as f:
            records = json.load(f)

        inserts = []
        for i, r in enumerate(records):
            sql = record_to_insert(r, pid, i + 1)
            inserts.append(sql)

        if args.split:
            # 每校单独 SQL
            school_sql_path = os.path.join(args.output_dir, f"surrounding_{pid}.sql")
            with open(school_sql_path, "w", encoding="utf-8") as f:
                f.write(f"-- {name} ({pid}) — {len(inserts)} 条\n")
                f.write("\n".join(inserts) + "\n")
            print(f"[{pid}] {name}: {len(inserts)} 条 → {school_sql_path}")

        all_inserts.extend(inserts)
        stats[pid] = {"name": name, "count": len(inserts)}

    # 生成汇总数据文件
    generate_data(all_inserts, args.output_dir, timestamp)

    # 统计
    print(f"\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"总计: {len(all_inserts)} 条 INSERT")
    print(f"覆盖: {len(stats)} 所学校")
    print(f"输出: {args.output_dir}/")


if __name__ == "__main__":
    main()
