-- V3.0: 小红书账号绑定 + 发布审计 + 日记扩展
-- 新建 user_xhs_account 表
CREATE TABLE IF NOT EXISTS user_xhs_account (
    id                 BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id            BIGINT       NOT NULL UNIQUE,
    encrypted_cookies  TEXT         NOT NULL,
    xhs_user_id        VARCHAR(64),
    xhs_username       VARCHAR(128),
    xhs_avatar         VARCHAR(512),
    status             TINYINT      DEFAULT 1,
    last_validated_at  DATETIME,
    created_at         DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user (user_id)
);

-- 新建 xhs_publish_log 表
CREATE TABLE IF NOT EXISTS xhs_publish_log (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id         BIGINT       NOT NULL,
    diary_id        VARCHAR(32)  NOT NULL,
    action          VARCHAR(20)  NOT NULL,
    request_summary TEXT,
    response_data   TEXT,
    error_msg       VARCHAR(500),
    ip_address      VARCHAR(45),
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_diary (diary_id),
    INDEX idx_user_time (user_id, created_at)
);

-- 扩展 travel_diary 表（MySQL 8.0 兼容写法）
CREATE PROCEDURE IF NOT EXISTS add_col_if_missing(
    IN tbl_name VARCHAR(128), IN col_name VARCHAR(128), IN col_def VARCHAR(512))
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = tbl_name AND column_name = col_name
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE ', tbl_name, ' ADD COLUMN ', col_name, ' ', col_def);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END;

CALL add_col_if_missing('travel_diary', 'xhs_publish_status', 'VARCHAR(20) DEFAULT NULL');
CALL add_col_if_missing('travel_diary', 'xhs_note_id',       'VARCHAR(64)  DEFAULT NULL');
CALL add_col_if_missing('travel_diary', 'xhs_publish_url',   'VARCHAR(512) DEFAULT NULL');
CALL add_col_if_missing('travel_diary', 'xhs_published_at',  'DATETIME     DEFAULT NULL');

DROP PROCEDURE IF EXISTS add_col_if_missing;
