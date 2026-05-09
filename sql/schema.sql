-- =============================================
-- 个性化旅游系统 数据库建表脚本
-- 数据库: tourism_db
-- 字符集: utf8mb4
-- =============================================

CREATE DATABASE IF NOT EXISTS tourism_db
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE tourism_db;

-- =============================================
-- 1. 用户表 sys_user
-- =============================================
DROP TABLE IF EXISTS `sys_user`;
CREATE TABLE `sys_user` (
  `id`                  BIGINT       NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `username`            VARCHAR(50)  NOT NULL COMMENT '用户名',
  `password`            VARCHAR(255) NOT NULL COMMENT '加密密码 (BCrypt)',
  `interests`           JSON         DEFAULT NULL COMMENT '兴趣标签，如 ["历史文化","自然风光"]',
  `favorite_categories` JSON         DEFAULT NULL COMMENT '偏好分类，如 ["景区","博物馆"]',
  `avatar`              VARCHAR(500) DEFAULT NULL COMMENT '头像URL',
  `deleted`             TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记',
  `created_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- =============================================
-- 2. 场所表 spot_place（景区 / 校园，200+条）
-- =============================================
DROP TABLE IF EXISTS `spot_place`;
CREATE TABLE `spot_place` (
  `id`           VARCHAR(32)    NOT NULL COMMENT '场所ID，如 place_001',
  `name`         VARCHAR(100)   NOT NULL COMMENT '场所名称',
  `type`         VARCHAR(20)    NOT NULL COMMENT '类型：校园/景区/公园/博物馆等',
  `keywords`     JSON           DEFAULT NULL COMMENT '关键词数组',
  `features`     JSON           DEFAULT NULL COMMENT '特色标签数组',
  `rating`       DECIMAL(3,1)   DEFAULT 0.0 COMMENT '综合评分',
  `rating_count` INT            NOT NULL DEFAULT 0 COMMENT '评分人数',
  `click_count`  INT            NOT NULL DEFAULT 0 COMMENT '浏览量/热度',
  `lat`          DECIMAL(10,7)  DEFAULT NULL COMMENT '纬度',
  `lng`          DECIMAL(10,7)  DEFAULT NULL COMMENT '经度',
  `address`      VARCHAR(255)   DEFAULT NULL COMMENT '地址',
  `open_time`    VARCHAR(200)   DEFAULT NULL COMMENT '开放时间',
  `image`        VARCHAR(500)   DEFAULT NULL COMMENT '封面图片路径',
  `description`  TEXT           DEFAULT NULL COMMENT '场所描述',
  `deleted`      TINYINT(1)     NOT NULL DEFAULT 0 COMMENT '软删除',
  `created_at`   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_rating` (`rating`),
  KEY `idx_click_count` (`click_count`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='场所表（景区/校园）';

-- =============================================
-- 3. 美食表 spot_food（40条）
-- =============================================
DROP TABLE IF EXISTS `spot_food`;
CREATE TABLE `spot_food` (
  `id`          VARCHAR(32)   NOT NULL COMMENT '美食ID，如 food_001',
  `name`        VARCHAR(100)  NOT NULL COMMENT '美食名称',
  `place_id`    VARCHAR(32)   NOT NULL COMMENT '所属场所ID',
  `cuisine`     VARCHAR(30)   DEFAULT NULL COMMENT '菜系：中式/西式',
  `popularity`  INT           NOT NULL DEFAULT 0 COMMENT '人气值',
  `description` VARCHAR(500)  DEFAULT NULL COMMENT '描述',
  `price`       VARCHAR(30)   DEFAULT NULL COMMENT '价格',
  `location`    VARCHAR(200)  DEFAULT NULL COMMENT '位置（如食堂楼层）',
  `deleted`     TINYINT(1)    NOT NULL DEFAULT 0,
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_place_id` (`place_id`),
  KEY `idx_cuisine` (`cuisine`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='美食表';

-- =============================================
-- 4. 建筑物表 spot_building（50+条）
-- =============================================
DROP TABLE IF EXISTS `spot_building`;
CREATE TABLE `spot_building` (
  `id`          VARCHAR(50)   NOT NULL COMMENT '建筑物ID，如 building_344376272',
  `name`        VARCHAR(100)  NOT NULL COMMENT '建筑名称',
  `type`        VARCHAR(30)   DEFAULT NULL COMMENT '类型：教学楼/宿舍楼/行政楼/实验楼等',
  `place_id`    VARCHAR(32)   NOT NULL COMMENT '所属场所ID',
  `lat`         DECIMAL(11,7) DEFAULT NULL COMMENT '纬度',
  `lng`         DECIMAL(11,7) DEFAULT NULL COMMENT '经度',
  `description` VARCHAR(500)  DEFAULT NULL COMMENT '描述',
  `rating`      DECIMAL(3,1)  DEFAULT 0.0 COMMENT '评分',
  `deleted`     TINYINT(1)    NOT NULL DEFAULT 0,
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_place_id` (`place_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='建筑物表';

-- =============================================
-- 4. 服务设施表 spot_facility（10种类型，50+条）
-- =============================================
DROP TABLE IF EXISTS `spot_facility`;
CREATE TABLE `spot_facility` (
  `id`          VARCHAR(50)   NOT NULL COMMENT '设施ID',
  `name`        VARCHAR(100)  NOT NULL COMMENT '设施名称',
  `type`        VARCHAR(30)   NOT NULL COMMENT '类型：商店/饭店/洗手间/图书馆/食堂/超市/咖啡馆/公交站/停车场/医院/银行/邮局/其他',
  `place_id`    VARCHAR(32)   NOT NULL COMMENT '所属场所ID',
  `lat`         DECIMAL(11,7) DEFAULT NULL COMMENT '纬度',
  `lng`         DECIMAL(11,7) DEFAULT NULL COMMENT '经度',
  `description` VARCHAR(500)  DEFAULT NULL COMMENT '描述',
  `rating`      DECIMAL(3,1)  DEFAULT 0.0 COMMENT '评分',
  `deleted`     TINYINT(1)    NOT NULL DEFAULT 0,
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_place_id` (`place_id`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='服务设施表';

-- =============================================
-- 5. 道路拓扑表 spot_road_edge（200+条边）
-- =============================================
DROP TABLE IF EXISTS `spot_road_edge`;
CREATE TABLE `spot_road_edge` (
  `id`               VARCHAR(80)   NOT NULL COMMENT '道路ID',
  `from_node`        VARCHAR(80)   NOT NULL COMMENT '起始节点ID',
  `to_node`          VARCHAR(80)   NOT NULL COMMENT '终止节点ID',
  `distance`         DECIMAL(10,2) NOT NULL COMMENT '距离（米）',
  `ideal_speed`      DECIMAL(5,1)  DEFAULT 4.0 COMMENT '理想速度（km/h）',
  `congestion_rate`  DECIMAL(3,2)  DEFAULT 1.0 COMMENT '拥堵系数 0~1',
  `allowed_vehicles` JSON          DEFAULT NULL COMMENT '允许通行方式，如 ["步行","自行车"]',
  `road_type`        VARCHAR(30)   DEFAULT NULL COMMENT '道路类型',
  `place_id`         VARCHAR(32)   DEFAULT NULL COMMENT '所属场所ID（可为空）',
  `deleted`          TINYINT(1)    NOT NULL DEFAULT 0,
  `created_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_from_node` (`from_node`),
  KEY `idx_to_node` (`to_node`),
  KEY `idx_place_id` (`place_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='道路拓扑表';

-- =============================================
-- 6. 旅游日记表 travel_diary
-- =============================================
DROP TABLE IF EXISTS `travel_diary`;
CREATE TABLE `travel_diary` (
  `id`           VARCHAR(32)   NOT NULL COMMENT '日记ID，如 diary_001',
  `title`        VARCHAR(200)  NOT NULL COMMENT '标题',
  `content`      LONGTEXT      DEFAULT NULL COMMENT '正文内容',
  `place_id`     VARCHAR(32)   DEFAULT NULL COMMENT '关联场所ID',
  `author_id`    BIGINT        NOT NULL COMMENT '作者用户ID',
  `click_count`  INT           NOT NULL DEFAULT 0 COMMENT '浏览量',
  `rating`       DECIMAL(3,1)  DEFAULT 0.0 COMMENT '平均评分',
  `rating_count` INT           NOT NULL DEFAULT 0 COMMENT '评分人数',
  `images`       JSON          DEFAULT NULL COMMENT '图片URL列表',
  `videos`       JSON          DEFAULT NULL COMMENT '视频URL列表',
  `tags`         JSON          DEFAULT NULL COMMENT '标签列表',
  `deleted`      TINYINT(1)    NOT NULL DEFAULT 0,
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_author_id` (`author_id`),
  KEY `idx_place_id` (`place_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='旅游日记表';

-- =============================================
-- 7. 用户行为表 user_behavior（协同过滤数据源）
-- =============================================
DROP TABLE IF EXISTS `user_behavior`;
CREATE TABLE `user_behavior` (
  `id`            BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`       BIGINT       NOT NULL COMMENT '用户ID',
  `target_id`     VARCHAR(32)  NOT NULL COMMENT '目标ID（placeId 或 diaryId）',
  `behavior_type` VARCHAR(20)  NOT NULL COMMENT 'VIEW/LIKE/RATE/COLLECT',
  `score`         DECIMAL(3,1) DEFAULT 1.0 COMMENT '评分（仅 RATE 类型有效）',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_target_id` (`target_id`),
  KEY `idx_behavior_type` (`behavior_type`),
  UNIQUE KEY `uk_user_target_type` (`user_id`, `target_id`, `behavior_type`) COMMENT '防止重复行为'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户行为表（协同过滤数据源）';
