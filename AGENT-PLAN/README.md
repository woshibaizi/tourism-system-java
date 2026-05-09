# 个性化旅游助手 Python Agent 开发规划

本文档只做设计规划，不开始写业务代码。目标是把一个 Python agent 接入当前 Spring Boot 旅游系统，让它支持图片生成日记、对话式路线规划、skills 调用，以及通过 MCP 接入“小红书自动同步”能力。

## 1. 总体结论

建议采用“Java 主系统 + Python Agent 独立服务 + MCP Skills 服务”的结构。

```text
前端 / App
  |
  v
Spring Boot Java 后端
  | 1. 保存用户、图片、日记、景点、路线等业务数据
  | 2. 负责登录鉴权、数据库、已有旅游接口
  v
Python Agent 服务
  | 1. 理解用户问题
  | 2. 调用大模型
  | 3. 编排旅游工具和日记生成流程
  v
MCP Skills 服务
  | 1. 小红书同步
  | 2. 以后可扩展天气、酒店、门票、地图等工具
```

不建议把 Python agent 直接嵌到 Java 进程里。当前项目已经是 Spring Boot 后端，后续最清晰的方式是让 Python 作为一个独立 HTTP 服务运行，Java 通过接口调用它。

## 2. 当前 Java 项目可复用能力

已有模块可以直接作为 agent 的工具来源：

- 图片上传：`POST /api/upload/image`
- 日记 CRUD：`/api/diaries`
- 日记搜索和推荐：`GET /api/diaries/search`、`POST /api/diaries/recommend`
- 场所查询、搜索、推荐：`/api/places`
- 路线规划：`POST /api/navigation/shortest-path`、`POST /api/navigation/multi-destination`
- AIGC 脚本调用基础：当前 `AigcService` 已能调用 Python 脚本生成 GIF

所以第一阶段不需要推翻 Java 项目，只需要新增一个 agent 入口层，让它复用这些能力。

## 3. 推荐目录规划

后续真正开发时，可以在项目根目录新增：

```text
agent-service/
  README.md
  pyproject.toml
  .env.example
  app/
    main.py                 # FastAPI 入口
    config.py               # 环境变量配置
    schemas.py              # 请求/响应模型
    agent/
      orchestrator.py       # agent 编排核心
      prompts.py            # 提示词模板
      memory.py             # 用户偏好/上下文记忆
    tools/
      tourism_api.py        # 调 Java 后端接口
      image_diary.py        # 图片日记生成工具
      route_planner.py      # 路线规划工具
      skill_registry.py     # 本地 skills 注册
    mcp/
      client.py             # Python agent 作为 MCP client 调工具
      xiaohongshu_server.py # 将小红书 skill 包装成 MCP tool
    tests/
      test_diary_agent.py
      test_route_agent.py
      test_mcp_tools.py
```

本次只创建了 `AGENT-PLAN/` 规划文件夹，真正的 `agent-service/` 等开发目录等确认后再建。

## 4. 功能拆分

### 4.1 图片 + 提示词自动生成旅游日记

输入：

- 用户 ID
- 图片路径或图片 URL
- 用户提示词，例如“写得像小红书风格，轻松一点”
- 可选地点、日期、同行人、天气、心情、标签

处理流程：

1. 前端先调用 Java 的图片上传接口，拿到图片路径。
2. Java 调 Python agent 的 `/agent/diary/generate`。
3. Python agent 使用多模态模型理解图片内容。
4. agent 输出结构化 JSON：标题、正文、标签、地点候选、图片列表、是否适合发布小红书。
5. Java 调已有 `/api/diaries` 保存日记。
6. 用户确认后再调用小红书同步 skill。

建议输出契约：

```json
{
  "title": "傍晚的湖边散步",
  "content": "今天在湖边走了很久...",
  "tags": ["旅行", "校园", "日记"],
  "placeId": "place_001",
  "images": ["uploads/images/xxx.jpg"],
  "publishSuggestion": {
    "canPublishToXiaohongshu": true,
    "caption": "适合发小红书的短文案"
  }
}
```

### 4.2 根据用户询问规划旅游线路

输入例子：

- “我明天想在校园里玩半天，喜欢拍照和吃东西，帮我规划路线”
- “三天两晚去杭州，预算一般，想轻松一点”

agent 需要做的事：

1. 识别用户约束：时间、地点、预算、兴趣、出行方式、同行人、强制景点。
2. 如果信息缺失，先问 1 到 2 个关键问题。
3. 调 Java 的场所推荐接口拿候选景点。
4. 调 Java 的路线规划接口计算顺路关系。
5. 生成分时段行程：上午/下午/晚上，交通方式，预计耗时，注意事项。
6. 返回结构化 JSON，方便前端展示路线卡片。

建议输出契约：

```json
{
  "summary": "半日轻松拍照路线",
  "days": [
    {
      "day": 1,
      "items": [
        {
          "time": "09:00",
          "placeId": "place_001",
          "placeName": "图书馆",
          "reason": "适合拍照，人流较稳定",
          "stayMinutes": 60
        }
      ]
    }
  ],
  "route": {
    "totalDistance": 2300,
    "estimatedMinutes": 55,
    "provider": "local_or_amap"
  }
}
```

### 4.3 Skills 接入

先把 skills 理解成“agent 可以调用的能力”。不要一开始做得太复杂，可以分两层：

第一层：Python 内部 tool registry

- `generate_diary_from_images`
- `search_places`
- `recommend_places`
- `plan_route`
- `create_diary`
- `publish_to_xiaohongshu`

第二层：MCP 标准化暴露

- 将已有“小红书自动同步 skill”包装成 MCP tool。
- 后续天气、酒店、门票、地图等工具也按 MCP tool 接入。
- Python agent 做 MCP client，根据任务选择调用哪个 tool。

### 4.4 小红书自动同步 MCP 设计

建议把“小红书同步”设计成有副作用的工具，不直接让大模型无保护地发布。

MCP tool 初版可以这样设计：

- `xiaohongshu_create_draft`：创建草稿，推荐第一阶段先做这个。
- `xiaohongshu_publish_note`：确认发布，第二阶段再开放。
- `xiaohongshu_check_publish_status`：查询发布结果。

输入参数：

```json
{
  "title": "旅行日记标题",
  "content": "正文内容",
  "images": ["uploads/images/xxx.jpg"],
  "tags": ["旅行", "校园"],
  "userId": 1,
  "dryRun": true
}
```

关键约束：

- Cookie、token、账号密码不能写进代码。
- 默认先 `dryRun` 或草稿，确认后再发布。
- 每次发布保存日志：用户、标题、图片数量、发布时间、返回结果。
- 发布失败要返回可读错误，例如“登录失效，需要重新授权”。

## 5. Python Agent 技术路线

面向刚学习 agent 的阶段，建议分阶段做，不要一开始引入太重的框架。

第一阶段：FastAPI + 手写工具编排

- 优点：容易理解，调试简单。
- 做法：用普通 Python 函数封装工具，agent 根据模型返回的意图调用函数。
- 目标：先跑通图片日记和路线规划两个闭环。

第二阶段：接入 MCP

- 用 Python MCP SDK / FastMCP 包装小红书 skill。
- agent 作为 MCP client 调用 `xiaohongshu_create_draft`。
- 本地先用 stdio 或 localhost HTTP，远程部署再考虑 Streamable HTTP。

第三阶段：引入更完整的 agent 框架

- 如果流程开始复杂，再考虑 LangGraph / LlamaIndex / OpenAI Agents SDK 等。
- 这时可以把“日记生成”“路线规划”“发布小红书”拆成明确节点。

## 6. Java 与 Python 的接口边界

Java 后端建议新增一个薄适配层，名字可以是：

- `AgentController`
- `AgentService`
- `AgentClient`

Java 只负责：

- 用户鉴权
- 图片上传和文件路径管理
- 调 Python agent
- 保存最终日记
- 记录发布状态

Python 只负责：

- 调大模型
- 理解图片和文本
- 编排行程规划
- 调 MCP skills
- 返回结构化结果

推荐 Python 服务接口：

```text
POST /agent/diary/generate
POST /agent/chat
POST /agent/route/plan
POST /agent/xiaohongshu/draft
GET  /health
```

## 7. 开发顺序

### 阶段 0：确认接口契约

先写请求/响应 JSON，不写模型调用。用假数据跑通 Java -> Python -> Java。

验收标准：

- Java 能成功请求 Python `/health`。
- Java 能把图片路径和提示词传给 Python。
- Python 能返回固定格式 JSON。

### 阶段 1：图片日记 agent

实现图片 + prompt 生成日记。

验收标准：

- 上传 1 到 6 张图片。
- 传入一句提示词。
- 返回标题、正文、标签、图片列表。
- Java 可以把结果保存到 `travel_diary`。

### 阶段 2：路线规划 agent

实现对话式旅游线路规划。

验收标准：

- 用户说自然语言需求。
- agent 能提取地点、时间、兴趣。
- agent 能调用现有场所和导航接口。
- 返回可展示的路线 JSON。

### 阶段 3：MCP + 小红书 skill

先做草稿，不直接发布。

验收标准：

- agent 能调用 MCP tool。
- 小红书 skill 能收到标题、正文、图片、标签。
- 返回草稿 ID 或模拟发布结果。
- 发布行为有日志。

### 阶段 4：完善安全和部署

增加鉴权、超时、限流、日志和错误处理。

验收标准：

- Python 服务不能被任意外部调用。
- 小红书发布需要用户确认或明确参数。
- LLM key、小红书凭证、Java token 都来自环境变量。

## 8. 推荐最小可运行版本

第一个可交付版本不要做太多功能，只做：

1. Python FastAPI 服务。
2. `/agent/diary/generate`：图片 + 提示词生成日记 JSON。
3. `/agent/route/plan`：自然语言规划路线 JSON。
4. MCP 包装一个 `xiaohongshu_create_draft` 工具，先 dry-run。
5. Java 新增 `AgentController` 调 Python。

这样就能展示完整闭环：

```text
用户上传图片和提示词
  -> Java 保存图片
  -> Python agent 生成日记
  -> Java 保存日记
  -> 用户确认
  -> MCP 调小红书 skill 生成草稿
```

## 9. 主要风险

- 多模态模型成本较高，需要限制图片数量和大小。
- 小红书自动发布可能涉及账号风控，建议先做草稿或半自动同步。
- 大模型输出不稳定，所以必须让 Python 返回固定 JSON schema。
- Python 直接读取 Java 上传目录时，要避免路径穿越问题。
- MCP tool 有副作用时，必须记录日志和用户确认状态。

## 10. 下一步建议

下一次开始开发时，先不要碰 MCP。建议按下面顺序落地：

1. 新建 `agent-service/`。
2. 搭 FastAPI `/health`。
3. 写 `POST /agent/diary/generate` 的假数据版本。
4. Java 新增 agent client，确认 Java 能调 Python。
5. 再接真实大模型和 MCP。

这样学习曲线最平滑，也最容易调试。
