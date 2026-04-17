INSERT INTO sys_user (id, username, password, interests, favorite_categories, avatar, deleted)
VALUES
  (1, 'tester', '$2a$10$B6qkDou0m6yQC64.47cz7u2MKfKhKL3ZxHjxmZKY9y6AjHY3e30du', '["校园","美食","建筑"]', '["校园","食堂","图书馆"]', 'uploads/images/avatar1.png', 0),
  (2, 'traveler', '$2a$10$B6qkDou0m6yQC64.47cz7u2MKfKhKL3ZxHjxmZKY9y6AjHY3e30du', '["景区","湖景","拍照"]', '["景区","步道","观景"]', 'uploads/images/avatar2.png', 0),
  (3, 'foodie', '$2a$10$B6qkDou0m6yQC64.47cz7u2MKfKhKL3ZxHjxmZKY9y6AjHY3e30du', '["川菜","甜品","咖啡"]', '["小吃街","咖啡馆","甜品站"]', 'uploads/images/avatar3.png', 0);

INSERT INTO spot_place (id, name, type, keywords, features, rating, rating_count, click_count, lat, lng, address, open_time, image, description, deleted)
VALUES
  ('place_campus', '星海校园', '校园', '["校园","图书馆","食堂","实验室"]', '["导航","学习","美食"]', 4.8, 26, 320, 39.9577000, 116.3577000, '北京市海淀区星海路1号', '06:30-23:00', 'uploads/images/campus.jpg', '用于测试导航、设施、美食与日记的校园场所', 0),
  ('place_scenic', '云山景区', '景区', '["景区","观景台","湖景","步道"]', '["徒步","拍照","自然风光"]', 4.9, 31, 410, 30.5728000, 104.0668000, '四川省成都市云山大道88号', '08:00-20:00', 'uploads/images/scenic.jpg', '覆盖景区浏览、导航和推荐测试的景区场所', 0),
  ('place_lake', '镜湖公园', '公园', '["公园","湖泊","散步","日落"]', '["散步","亲子","露营"]', 4.4, 18, 180, 31.2304000, 121.4737000, '上海市镜湖路9号', '全天开放', 'uploads/images/lake.jpg', '用于补充推荐和搜索排序的公园场所', 0);

INSERT INTO spot_food (id, name, place_id, cuisine, popularity, description, price, location, deleted)
VALUES
  ('food_campus_noodle', '兰州牛肉面', 'place_campus', '面食', 98, '一食堂招牌牛肉面窗口，汤底浓郁。', '18', '一食堂一层面食窗口', 0),
  ('food_campus_rice', '香辣小炒肉饭', 'place_campus', '湘菜', 86, '二食堂现炒窗口，适合午餐。', '22', '二食堂二层现炒区', 0),
  ('food_campus_cafe', '拿铁咖啡', 'place_campus', '咖啡', 72, '图书馆咖啡吧提供手冲和拿铁。', '24', '图书馆一层咖啡吧', 0),
  ('food_campus_dessert', '杨枝甘露', 'place_campus', '甜品', 79, '学生街甜品站热门冰品。', '16', '学生街甜品站', 0),
  ('food_campus_bbq', '炭烤鸡腿饭', 'place_campus', '烧烤', 91, '夜宵档口的热门烤鸡腿饭。', '25', '学生街夜宵窗口', 0),
  ('food_scenic_hotpot', '云山菌汤锅', 'place_scenic', '火锅', 95, '观景餐厅招牌菌汤锅，适合多人聚餐。', '88', '云山观景餐厅二层', 0),
  ('food_scenic_snack', '竹筒糯米饭', 'place_scenic', '小吃', 88, '湖边小吃亭限量供应竹筒糯米饭。', '20', '湖边小吃亭A窗口', 0),
  ('food_scenic_tea', '山野果茶', 'place_scenic', '饮品', 67, '步道补给站提供山野果茶。', '18', '山门补给站', 0),
  ('food_scenic_noodle', '山泉豆花面', 'place_scenic', '面食', 84, '景区游客中心旁的豆花面窗口。', '28', '游客中心美食广场1号窗口', 0),
  ('food_scenic_bakery', '抹茶蛋糕卷', 'place_scenic', '甜品', 74, '观景台甜品车供应抹茶蛋糕卷。', '26', '观景台甜品车', 0),
  ('food_lake_brunch', '湖畔班尼迪克蛋', 'place_lake', '西式', 69, '湖畔餐吧的早午餐招牌。', '48', '湖畔餐吧A区', 0),
  ('food_lake_toast', '烟熏三文鱼吐司', 'place_lake', '西式', 76, '镜湖公园咖啡馆的热门轻食。', '42', '镜湖咖啡馆2号窗口', 0);

INSERT INTO spot_building (id, name, type, place_id, lat, lng, description, rating, deleted)
VALUES
  ('building_campus_gate', '校园东门', '校门', 'place_campus', 39.9577000, 116.3577000, '星海校园东侧入口', 4.7, 0),
  ('building_campus_library', '星海图书馆', '图书馆', 'place_campus', 39.9577600, 116.3577700, '校园图书馆主楼', 4.9, 0),
  ('building_campus_lab', '创新实验楼', '实验楼', 'place_campus', 39.9578600, 116.3579200, '用于算法与实验课的实验楼', 4.6, 0),
  ('building_campus_canteen', '第一食堂', '食堂', 'place_campus', 39.9578100, 116.3578400, '校园食堂主楼', 4.5, 0),
  ('building_scenic_gate', '景区南门', '景区入口', 'place_scenic', 30.5728000, 104.0668000, '云山景区南门入口', 4.8, 0),
  ('building_scenic_center', '游客中心', '服务中心', 'place_scenic', 30.5729200, 104.0669500, '游客咨询和休息中心', 4.7, 0),
  ('building_scenic_peak', '云山观景台', '观景台', 'place_scenic', 30.5730800, 104.0671200, '景区高点观景台', 4.9, 0),
  ('building_scenic_museum', '山地文化馆', '展馆', 'place_scenic', 30.5729800, 104.0672500, '展示景区历史和文化', 4.5, 0);

INSERT INTO spot_facility (id, name, type, place_id, lat, lng, description, rating, deleted)
VALUES
  ('facility_campus_store', '校园超市', '超市', 'place_campus', 39.9577800, 116.3577900, '距离东门最近的校园超市', 4.6, 0),
  ('facility_campus_toilet', '图书馆洗手间', '洗手间', 'place_campus', 39.9578300, 116.3579000, '位于图书馆与实验楼之间', 4.2, 0),
  ('facility_campus_cafe', '书香咖啡站', '咖啡馆', 'place_campus', 39.9577600, 116.3577700, '图书馆一层咖啡站', 4.8, 0),
  ('facility_campus_clinic', '校园医务室', '医院', 'place_campus', 39.9579000, 116.3580000, '提供简单医疗服务', 4.3, 0),
  ('facility_scenic_toilet', '游客中心洗手间', '洗手间', 'place_scenic', 30.5729400, 104.0669700, '游客中心旁洗手间', 4.4, 0),
  ('facility_scenic_parking', '南门停车场', '停车场', 'place_scenic', 30.5727600, 104.0667600, '景区南门停车区域', 4.1, 0),
  ('facility_scenic_post', '观景台邮局', '邮局', 'place_scenic', 30.5730600, 104.0671500, '景区纪念邮局', 4.7, 0);

INSERT INTO spot_road_edge (id, from_node, to_node, distance, ideal_speed, congestion_rate, allowed_vehicles, road_type, place_id, deleted)
VALUES
  ('edge_campus_01', 'building_campus_gate', 'campus_cross_1', 6, 4, 1.0, '["步行","自行车"]', '校园主路', 'place_campus', 0),
  ('edge_campus_02', 'campus_cross_1', 'facility_campus_store', 4, 4, 1.0, '["步行","自行车"]', '商业支路', 'place_campus', 0),
  ('edge_campus_03', 'campus_cross_1', 'building_campus_library', 5, 4, 0.9, '["步行","自行车"]', '林荫道', 'place_campus', 0),
  ('edge_campus_04', 'building_campus_library', 'facility_campus_cafe', 2, 3, 1.0, '["步行"]', '馆内连接道', 'place_campus', 0),
  ('edge_campus_05', 'building_campus_library', 'campus_cross_2', 5, 4, 0.8, '["步行","自行车"]', '校园主路', 'place_campus', 0),
  ('edge_campus_06', 'campus_cross_2', 'building_campus_canteen', 4, 4, 1.1, '["步行","自行车"]', '食堂连廊', 'place_campus', 0),
  ('edge_campus_07', 'campus_cross_2', 'facility_campus_toilet', 3, 3, 1.0, '["步行"]', '生活服务道', 'place_campus', 0),
  ('edge_campus_08', 'campus_cross_2', 'building_campus_lab', 6, 4, 0.9, '["步行","自行车"]', '实验楼通道', 'place_campus', 0),
  ('edge_campus_09', 'building_campus_lab', 'facility_campus_clinic', 4, 3, 1.0, '["步行"]', '服务通道', 'place_campus', 0),
  ('edge_campus_10', 'building_campus_canteen', 'facility_campus_clinic', 8, 4, 1.2, '["步行","自行车"]', '后勤道路', 'place_campus', 0),
  ('edge_scenic_01', 'building_scenic_gate', 'scenic_cross_1', 10, 4, 1.0, '["步行","观光车"]', '景区主路', 'place_scenic', 0),
  ('edge_scenic_02', 'scenic_cross_1', 'building_scenic_center', 5, 4, 1.0, '["步行","观光车"]', '游客中心引导路', 'place_scenic', 0),
  ('edge_scenic_03', 'building_scenic_center', 'facility_scenic_toilet', 2, 3, 1.0, '["步行"]', '服务小道', 'place_scenic', 0),
  ('edge_scenic_04', 'scenic_cross_1', 'facility_scenic_parking', 3, 4, 1.0, '["步行","观光车"]', '停车场连路', 'place_scenic', 0),
  ('edge_scenic_05', 'building_scenic_center', 'scenic_cross_2', 8, 4, 1.1, '["步行","观光车"]', '山间步道', 'place_scenic', 0),
  ('edge_scenic_06', 'scenic_cross_2', 'building_scenic_peak', 6, 3, 1.2, '["步行"]', '登山步道', 'place_scenic', 0),
  ('edge_scenic_07', 'building_scenic_peak', 'facility_scenic_post', 2, 3, 1.0, '["步行"]', '观景台支路', 'place_scenic', 0),
  ('edge_scenic_08', 'scenic_cross_2', 'building_scenic_museum', 5, 4, 0.9, '["步行","观光车"]', '文化馆连路', 'place_scenic', 0);

INSERT INTO travel_diary (id, title, content, place_id, author_id, click_count, rating, rating_count, images, videos, tags, deleted)
VALUES
  ('diary_001', '星海校园晨跑路线', '星海校园东门到图书馆的晨跑路线很适合新手。', 'place_campus', 1, 56, 4.6, 3, '["uploads/images/campus_run.jpg"]', '[]', '["校园","运动","路线"]', 0),
  ('diary_002', '图书馆自习和咖啡', '图书馆一层咖啡站适合自习休息，拿铁很受欢迎。', 'place_campus', 1, 42, 4.4, 2, '["uploads/images/library.jpg"]', '[]', '["校园","咖啡","学习"]', 0),
  ('diary_003', '云山景区观景攻略', '云山景区游客中心到观景台的步道风景很好。', 'place_scenic', 2, 88, 4.9, 4, '["uploads/images/scenic_view.jpg"]', '[]', '["景区","观景","徒步"]', 0),
  ('diary_004', '湖边竹筒饭和邮局打卡', '湖边小吃亭的竹筒饭和观景台邮局都值得打卡。', 'place_scenic', 2, 61, 4.7, 3, '["uploads/images/food.jpg"]', '[]', '["景区","美食","邮局"]', 0),
  ('diary_005', '镜湖日落散步', '镜湖公园适合日落散步和亲子露营。', 'place_lake', 3, 35, 4.2, 1, '["uploads/images/lake.jpg"]', '[]', '["公园","日落","散步"]', 0),
  ('diary_006', '学生街夜宵推荐', '学生街夜宵窗口的炭烤鸡腿饭很适合晚间补给。', 'place_campus', 3, 49, 4.8, 2, '["uploads/images/snack.jpg"]', '[]', '["校园","夜宵","美食"]', 0);

INSERT INTO user_behavior (id, user_id, target_id, behavior_type, score)
VALUES
  (1, 1, 'place_campus', 'VIEW', 1.0),
  (2, 1, 'place_campus', 'RATE', 5.0),
  (3, 1, 'diary_006', 'VIEW', 1.0),
  (4, 1, 'diary_006', 'RATE', 4.0),
  (5, 2, 'place_scenic', 'VIEW', 1.0),
  (6, 2, 'place_scenic', 'RATE', 5.0),
  (7, 2, 'diary_003', 'VIEW', 1.0),
  (8, 2, 'diary_003', 'RATE', 5.0),
  (9, 3, 'place_campus', 'VIEW', 1.0),
  (10, 3, 'place_lake', 'VIEW', 1.0),
  (11, 3, 'diary_002', 'VIEW', 1.0),
  (12, 3, 'diary_002', 'RATE', 4.0);
