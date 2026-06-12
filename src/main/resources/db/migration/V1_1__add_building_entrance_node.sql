-- 多点导航拓展：spot_building 表新增入口节点ID字段
-- 用于关联室内建筑到室外路网图节点
-- MySQL 8.0 不支持 ADD COLUMN IF NOT EXISTS，用 procedure 兼容

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

CALL add_col_if_missing('spot_building', 'entrance_node_id', 'VARCHAR(64)');

DROP PROCEDURE IF EXISTS add_col_if_missing;
