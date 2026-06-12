-- V2.0: 小红书内容抓取相关 DDL
-- 创建 spot_xhs_info 表
CREATE TABLE IF NOT EXISTS spot_xhs_info (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    place_id        VARCHAR(32)  NOT NULL UNIQUE,
    place_name      VARCHAR(128),
    trending_score  INT          DEFAULT 0,
    note_count      INT          DEFAULT 0,
    top_notes       MEDIUMTEXT,
    top_tags        TEXT,
    top_keywords    TEXT,
    search_queries  TEXT,
    cache_expires   DATETIME,
    last_updated    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_place (place_id)
);
