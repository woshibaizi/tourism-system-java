-- =============================================
-- 添加 detail_description 列 (已有数据库升级用)
-- =============================================
SET NAMES utf8mb4;
USE tourism_db;

ALTER TABLE spot_place
  ADD COLUMN IF NOT EXISTS detail_description TEXT DEFAULT NULL
  COMMENT '详情页详细描述'
  AFTER description;
