-- ============================================================
-- 校园周边商户表
-- 生成时间: 2026-06-10 15:53:08
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
