USE tourism_db;

UPDATE `sys_user`
SET `password` = '$2a$10$B6qkDou0m6yQC64.47cz7u2MKfKhKL3ZxHjxmZKY9y6AjHY3e30du'
WHERE `username` IN ('张三', '李四', '王五', '赵六', '孙七', '周八', '吴九', '郑十', '钱十一', '陈十二');
