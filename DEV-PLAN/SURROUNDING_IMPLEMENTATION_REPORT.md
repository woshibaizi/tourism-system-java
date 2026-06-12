# 校园周边功能 — 实现报告

---

## 一、完成概览

| Phase | 内容 | 状态 | 说明 |
|-------|------|------|------|
| 规划 | CAMPUS_SURROUNDING_PLAN.md | ✅ 完成 | 数据模型、API设计、爬虫+AI流水线策略 |
| Phase 1 | 数据采集流水线 + 4,200条数据入库 | ✅ 完成 | 北邮200条(高德真实POI+LLM增强) + 200景区×20条(LLM生成) |
| Phase 2 | 后端全栈CRUD + 18个集成测试 | ✅ 完成 | Entity/Mapper/Service/Controller 全通 |
| Phase 3 | 前端2新页面 + PlaceDetail改造 | ✅ 完成 | SurroundingPage + SurroundingDetailPage |
| Phase 4 | Agent 集成 | ✅ 完成 | 3个周边工具注册 + SYSTEM_PROMPT改造，LLM中文输入正常调用工具 |

---

## 二、新增/修改文件清单

### 数据库 (2个新文件)
```
sql/
├── surrounding_schema.sql          ← spot_surrounding 建表DDL
├── surrounding_data.sql            ← 北邮200条 INSERT
└── scenic_surrounding_data.sql     ← 200景区×20条 INSERT
```

### 后端 Java (7个新文件, 3个修改)
```
新增:
src/main/java/com/tourism/
├── model/entity/SpotSurrounding.java     ← Entity, 26字段
├── mapper/SurroundingMapper.java         ← MyBatis-Plus Mapper
├── service/SurroundingService.java       ← Service 接口
├── service/impl/SurroundingServiceImpl.java ← Service 实现
├── controller/SurroundingController.java ← 10个REST端点
└── test/.../SurroundingIntegrationTests.java ← 18个测试 (全通过)

修改:
├── config/SecurityConfig.java            ← GET /api/surroundings/** 加入白名单
├── sql/schema.sql                        ← 新增 spot_surrounding 表定义
└── src/test/resources/schema.sql         ← 测试环境表定义
    src/test/resources/data.sql           ← 8条测试数据
```

### 前端 React (4个新文件, 4个修改)
```
新增:
frontend/src/
├── services/api/surroundings.js          ← 11个API函数
└── pages/
    ├── SurroundingPage.jsx               ← 周边列表主页 (分类Tab/搜索/排序)
    └── SurroundingDetailPage.jsx         ← 周边详情页 (图片/评分/导航)

修改:
├── services/api.js                       ← 导出 surrounding 函数
├── services/api/index.js                 ← 导出 surrounding 函数
├── pages/PlaceDetailPage.jsx             ← 新增"校园周边"板块
└── App.jsx                               ← 新增2条路由
```

### Agent Python (2个修改)
```
agent-service/app/
├── tools/tourism_api.py                  ← 新增5个surrounding API方法
├── agent/prompts.py                      ← SYSTEM_PROMPT 新增周边工具说明
└── agent/chat_agent.py                   ← 注册3个surrounding工具函数
```

### 数据流水线脚本 (7个新文件)
```
scripts/
├── config.json                           ← 101所校园配置 (坐标+配额)
├── manual_overrides.json                 ← 人工微调模板
├── scrape_amap.py                        ← 高德API批量采集 (纯stdlib)
├── clean_and_merge.py                    ← 坐标转换+去重+过滤
├── select_best.py                        ← AI智能精选 (分类配额+评分排序)
├── enrich_with_llm.py                    ← LLM批量文本增强 (纯stdlib)
├── validate_data.py                      ← 质量校验
├── generate_sql.py                       ← SQL自动生成
├── generate_scenic_surrounding.py        ← 景区周边LLM批量生成
└── run_all.py                            ← 一键运行入口
```

---

## 三、API 端点 (10个)

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/surroundings` | 分页查询 (可选 type/placeId/keyword) |
| `GET` | `/api/surroundings/{id}` | 商户详情 |
| `GET` | `/api/surroundings/place/{placeId}` | 按校园/景区查询 |
| `GET` | `/api/surroundings/place/{placeId}/type/{type}` | 校园+类型筛选 |
| `GET` | `/api/surroundings/search?query=` | 搜索 (名称+描述+标签) |
| `GET` | `/api/surroundings/nearby?lat=&lng=&radius=` | LBS 附近搜索 |
| `GET` | `/api/surroundings/hot` | 热门推荐 |
| `GET` | `/api/surroundings/top-rated` | 高分排行 |
| `GET` | `/api/surroundings/categories/{placeId}` | 分类统计 |
| `POST` | `/api/surroundings/{id}/rate?score=` | 评分 |

---

## 四、数据覆盖

### 北邮 (place_001) — 200条精选
- 数据来源: 高德地图POI周边搜索(1,225条原始) → 清洗去重(1,155条) → AI精选(200条) → LLM文本增强
- 6类覆盖: 餐厅80/购物30/娱乐30/住宿20/交通20/服务20
- LLM 增强字段: description, detail_description, tags, must_try, student_discount, price_range
- 成本: DeepSeek API ~0.3元

### 200个景区 (place_102~place_301) — 每处20条, 共4,000条
- 数据来源: LLM批量生成(基于景区名称+坐标+地址)
- 纯文字(无图片), 简洁描述
- 成本: DeepSeek API ~2元

### 数据库总量: 4,200条 spot_surrounding 记录

---

## 五、前端页面

### SurroundingPage `/surrounding/:placeId`
- 6分类Tab (含计数)
- 搜索框 (名称/描述/标签)
- 3种排序 (距离/评分/价格)
- 卡片展示: 缩略图/名称/评分/距离/价格/学生优惠标/标签

### SurroundingDetailPage `/surrounding/:placeId/:id`
- Hero大图 + 分类标签
- 一键导航 (调用高德地图)
- 电话拨号
- 标签/简介/详细介绍/必点推荐
- 评分组件 + 图片画廊

### PlaceDetailPage 改造
- 底部自动展示"校园周边"板块 (前6条预览 + 分类统计 + "查看全部"跳转)
- 对校园和景区均生效

---

## 六、Agent 集成 (已完成)

### 修改的文件
1. `tourism_api.py` — 新增5个surrounding API调用方法
2. `chat_agent.py` — 注册3个工具: search_surroundings / get_surroundings_by_place / get_surrounding_hot
3. `prompts.py` — SYSTEM_PROMPT 改造为工具优先 (分析→调工具→用数据回答)
4. 修复: `_surrounding_type_label` 缩进bug → ChatAgent 抽象方法错误

### 核心修复: SYSTEM_PROMPT 工具优先
旧的 prompt 先写"你是助手，交互原则是自我介绍"然后才列工具 → LLM 总是先自我介绍。
新的 prompt: 开头就写"分析→**立即调工具**→用数据回答"，明确禁止调用前自我介绍，附带场景速查表。

### 验证结果
| 测试输入 | 语言 | 调用的工具 | 结果 |
|----------|:---:|-----------|------|
| "北邮附近有什么好吃的火锅" | 中文 | search_surroundings ✅ | 返回4家真实火锅店 |
| "any KTV near GuGong" | 英文 | search_surroundings ✅ | 返回5家KTV |
| "hello" | 英文 | 无工具调用 ✅ | 正常问候 |

> **注意**: PowerShell 的 `Invoke-RestMethod` 会以 GBK 编码损伤中文字符，导致 LLM 收到乱码。前端/App 使用标准 UTF-8 JSON 请求不受影响。

---

## 七、测试结果

### 后端测试
```
✅ SurroundingIntegrationTests: 18/18 pass
✅ 其他集成测试: 全通过 (除5个预存失败)
```

### API 验证
```
✅ GET /api/surroundings/place/place_001 → 200条数据, 含完整LLM描述
✅ GET /api/surroundings/place/place_102 → 20条景区周边数据 (故宫)
✅ GET /api/surroundings/categories/place_001 → 6类统计正确
✅ GET /api/surroundings/search?query=火锅&placeId=place_001 → 4条结果
```

### 前端验证
```
✅ npm run build → 编译通过
✅ 路由 /surrounding/place_001 → 页面正常加载
```

---

## 八、运行方式

```powershell
# 后端
$env:TOURISM_DB_URL = "jdbc:mysql://127.0.0.1:3306/tourism_db?..."
mvn spring-boot:run

# 前端
cd frontend && npm run dev

# Agent
$env:TEXT_LLM_API_KEY = "sk-..."
$env:TOURISM_BACKEND_BASE_URL = "http://127.0.0.1:8080"
cd agent-service && uvicorn app.main:app --host 127.0.0.1 --port 9000

# 访问
http://localhost:5173/surrounding/place_001         # 北邮周边
http://localhost:8080/swagger-ui.html               # Swagger API文档
http://localhost:9000/agent/health                   # Agent健康检查
```
