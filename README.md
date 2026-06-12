# 🌍 个性化旅游系统 (Personalized Tourism System)

> 一个面向个性化旅游场景的全栈智能平台，集成 **Spring Boot 后端 + React 前端 + Python AI Agent + 小红书同步能力**。

[![Java](https://img.shields.io/badge/Java-17%2B-orange)](https://openjdk.org/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3.5-brightgreen)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev/)
[![Python](https://img.shields.io/badge/Python-3.8%2B-yellow)](https://www.python.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-blue)](https://www.mysql.com/)
[![Redis](https://img.shields.io/badge/Redis-7%2B-red)](https://redis.io/)

---

## 📖 目录

- [系统概述](#系统概述)
- [功能特性](#功能特性)
- [系统架构](#系统架构)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [API 文档](#api-文档)
- [AI Agent 服务](#ai-agent-服务)
- [小红书集成](#小红书集成)
- [测试](#测试)
- [开发日志](#开发日志)
- [常见问题](#常见问题)

---

## 系统概述

本系统是一个面向校园、景区和城市的个性化旅游服务平台。用户可以浏览景点、规划路线、写旅行日记、搜索美食、查询设施，并通过 AI Agent 实现**自然语言路线规划**和**图片自动生成旅行日记**。

### 核心亮点

- 🗺️ **智能路径规划** — 基于 A*、Dijkstra、TSP（动态规划/模拟退火/遗传算法）的多目标路径优化，支持室内外混合导航
- 🤖 **AI 旅游助手** — 多 Agent 架构（ChatAgent + DiaryAgent + RouteAgent），支持自然语言对话式路线规划、图片生成旅行日记
- 📱 **多端覆盖** — Web 前端（React + Glass Frost 设计系统）+ iOS App（SwiftUI）+ REST API
- 🔴 **小红书同步** — 通过 MCP 协议封装小红书 PC 端和创作者平台 API，支持草稿创建和发布同步
- 🎨 **Glass Frost 设计系统** — 统一的毛玻璃视觉风格，含 CSS 变量体系、组件覆盖和动画过渡
- 📊 **算法演示** — Huffman 压缩、AC 自动机敏感词过滤、Treap Top-K 排序等课程算法实现

---

## 功能特性

### 1. 用户认证

| 功能 | 说明 |
|------|------|
| 注册/登录 | JWT 令牌认证，Spring Security 鉴权 |
| 个人中心 | 用户信息、浏览历史、评分记录 |
| 出游搭子 | AI 人格定制（6 种搭子人格：吃货/文艺/探险/佛系/打卡/学霸） |

### 2. 旅游地点

| 功能 | 说明 |
|------|------|
| 地点搜索 | 名称/类别/关键字模糊搜索 |
| 地点详情 | 图片、描述、评分、标签 |
| 智能推荐 | 基于 TF-IDF 内容相似度和协同过滤的地点推荐 |
| 热度/评分排序 | Top-K 排序，支持热度、评分等多维度 |

### 3. 路径规划

| 功能 | 说明 |
|------|------|
| 单目标路径 | A* / Dijkstra 算法，支持最短距离/最短时间策略 |
| 多目标回路 | TSP 求解（最近邻/动态规划/模拟退火/遗传算法），可调起点 |
| 混合交通工具 | 步行 + 自行车 + 校内巴士混合最短时间路径 |
| 室内导航 | 建筑物内部房间级导航，支持楼层切换 |
| 附近设施 | 基于可通行路径距离排序（非直线距离），含类别过滤 |

### 4. 旅行日记

| 功能 | 说明 |
|------|------|
| 日记 CRUD | 创建、编辑、删除、查看旅行日记 |
| 日记搜索 | 标题/内容/目的地多维检索 |
| 日记推荐 | 内容相似度推荐 + 热门推荐 |
| 日记评分 | 用户对日记打分 |
| AI 生成日记 | 上传图片 + 提示词，AI 自动生成结构化日记（5 阶段流水线） |

### 5. 美食搜索

| 功能 | 说明 |
|------|------|
| 美食列表 | 分页、过滤、模糊搜索、排序 |
| 热门美食 | 按评分和浏览量排序 |
| 菜系列表 | 川菜、粤菜、西餐等分类浏览 |
| 场所美食 | 查询特定地点的美食 |

### 6. AI 旅游助手

| 功能 | 说明 |
|------|------|
| 对话式路线规划 | "周末想和朋友在校园玩半天，喜欢拍照和美食" → 结构化行程 |
| AI 生成日记 | 上传 1-6 张图片 + 风格选择 → 5 阶段自动生成（图片理解→要素提取→正文→润色→保存） |
| 意图识别 | 6 类意图自动路由（路线规划/地点推荐/搜索/日记生成/反向推荐/闲聊） |
| 出游搭子 | 6 种人格模式，影响回复风格和推荐偏好 |
| SSE 流式响应 | 实时打字机效果，支持 tool_call/tool_result 事件 |

### 7. 小红书同步

| 功能 | 说明 |
|------|------|
| PC 端 API | 笔记搜索、用户信息、笔记详情 |
| 创作者 API | 创建草稿、发布笔记、查询发布状态 |
| 安全策略 | 默认仅创建草稿，发布需用户确认，全量审计日志 |

### 8. 算法演示（教学用途）

| 算法 | 接口 |
|------|------|
| Huffman 压缩/解压 | `POST /api/algorithm/compress` / `decompress` |
| AC 自动机敏感词过滤 | `POST /api/algorithm/filter-text` |
| Treap Top-K 排序 | 内部排序算法 |

---

## 系统架构

```
┌──────────────────────────────────────────────────────────────┐
│                        前端层                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │ React Web App │  │ iOS SwiftUI  │  │ 第三方 API 调用    │   │
│  │ (Vite +       │  │ App          │  │                   │   │
│  │  Glass Frost) │  │              │  │                   │   │
│  └──────┬────────┘  └──────┬───────┘  └────────┬──────────┘   │
│         │                  │                    │              │
├─────────┼──────────────────┼────────────────────┼──────────────┤
│         ▼                  ▼                    │              │
│  ┌──────────────────────────────────────────────┴──────────┐  │
│  │              Spring Boot Java 后端 (:8080)               │  │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌─────────────┐   │  │
│  │  │ Controllers│ │Services │ │Mapper  │ │ Algorithms  │   │  │
│  │  │ (REST API)│ │(业务逻辑)│ │(MyBatis)│ │(A*/TSP/...) │   │  │
│  │  └─────────┘ └──────────┘ └────────┘ └─────────────┘   │  │
│  │       │            │           │            │           │  │
│  │       ▼            ▼           ▼            ▼           │  │
│  │  ┌──────────┐  ┌──────────┐                             │  │
│  │  │ MySQL 8  │  │ Redis 7  │                             │  │
│  │  └──────────┘  └──────────┘                             │  │
│  └─────────────────────────────────────────────────────────┘  │
│         │                                                     │
├─────────┼─────────────────────────────────────────────────────┤
│         ▼                                                     │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │           Python AI Agent 服务 (:9000)                    │ │
│  │  ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌───────────┐   │ │
│  │  │Intent    │ │ChatAgent │ │Diary    │ │RouteAgent │   │ │
│  │  │Router    │ │(工具集)   │ │Agent    │ │(路线规划) │   │ │
│  │  └──────────┘ └──────────┘ └─────────┘ └───────────┘   │ │
│  │       │              │           │           │          │ │
│  │       ▼              ▼           ▼           ▼          │ │
│  │  ┌──────────────────────────────────────────────────┐   │ │
│  │  │         Tool Registry + MCP Tools                │   │ │
│  │  └──────────────────────────────────────────────────┘   │ │
│  │       │                                                  │ │
│  │       ▼                                                  │ │
│  │  ┌───────────┐  ┌────────────────┐                      │ │
│  │  │ SQLite DB │  │ LLM Provider   │                      │ │
│  │  │ (会话存储) │  │ (OpenAI兼容/   │                      │ │
│  │  └───────────┘  │  Anthropic)    │                      │ │
│  │                 └────────────────┘                      │ │
│  └──────────────────────────────────────────────────────────┘  │
│         │                                                     │
│         ▼                                                     │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │           XhsSkills (小红书技能包)                         │ │
│  │  ┌────────────────┐  ┌─────────────────────┐             │ │
│  │  │ xhs_pc_apis    │  │ xhs_creator_apis    │             │ │
│  │  │ (搜索/用户/笔记)│  │ (草稿/发布/状态)     │             │ │
│  │  └────────────────┘  └─────────────────────┘             │ │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 技术栈

| 层次 | 技术 | 版本 |
|------|------|------|
| **后端框架** | Spring Boot | 3.3.5 |
| **安全认证** | Spring Security + JWT | jjwt 0.12.6 |
| **持久层** | MyBatis-Plus | 3.5.8 |
| **数据库** | MySQL | 8.0 |
| **缓存** | Redis (Lettuce) | 7+ |
| **API 文档** | Springdoc OpenAPI (Swagger) | 2.6.0 |
| **图算法** | JGraphT | 1.5.2 |
| **构建工具** | Maven | 3.9+ |
| **JDK** | OpenJDK | 17+ |
| **前端框架** | React + Vite | 19 / 8 |
| **UI 组件** | Ant Design + Tailwind CSS | 5 / 4 |
| **地图** | Leaflet + react-leaflet | 1.9 / 5 |
| **图表** | Recharts | 3.8 |
| **动画** | Framer Motion | 12 |
| **Agent 服务** | Python FastAPI + Uvicorn | 3.8+ |
| **Agent 会话** | SQLite (WAL 模式) | — |
| **LLM** | OpenAI 兼容接口 / Anthropic | 可配置 |
| **iOS App** | SwiftUI + MapKit | iOS 17+ |

---

## 快速开始

### 前置条件

| 工具 | 最低版本 | 用途 |
|------|----------|------|
| JDK | 17+ | 编译运行 Java 后端 |
| Maven | 3.9+ | 后端构建 |
| MySQL | 8.0 | 业务数据存储 |
| Redis | 7+ | 缓存与会话 |
| Node.js | 18+ | 前端开发 |
| Python | 3.8+ | Agent 服务 + 数据迁移脚本 |
| Git | 2.0+ | 代码管理 |

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd tour
```

### 2. 数据库初始化

```bash
# 登录 MySQL 并创建数据库
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS tourism DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 执行建表脚本
mysql -u root -p tourism < tourism-system-java/sql/schema.sql
```

### 3. 配置后端

编辑 `src/main/resources/application.yml`：

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/tourism?useUnicode=true&characterEncoding=utf-8&serverTimezone=Asia/Shanghai
    username: root
    password: your_password    # ← 改成你的密码
  data:
    redis:
      host: localhost
      port: 6379
```

### 4. 数据迁移（可选）

如果已有 JSON 格式的种子数据：

```bash
pip install pymysql bcrypt

cd scripts
python migrate_data.py \
  --host localhost \
  --port 3306 \
  --user root \
  --password your_password \
  --data-dir ../../tourism-system/backend/data
```

### 5. 启动后端

```bash
cd tourism-system-java
mvn spring-boot:run
```

后端启动后访问：
- API 文档: http://localhost:8080/swagger-ui.html
- 健康检查: http://localhost:8080/actuator/health

### 6. 启动前端

```bash
cd frontend

# 安装依赖
npm install

# 开发模式启动
npm run dev
```

前端默认运行在 http://localhost:5173

### 7. 启动 AI Agent 服务（可选）

```bash
cd agent-service

# 安装依赖
pip install -e .

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入 LLM_API_KEY（可选 — 不填则降级为规则模式）

# 启动 Agent 服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 9000
```

Agent 服务运行在 http://localhost:9000，健康检查: http://localhost:9000/agent/health

### 8. 一键启动（推荐）

项目提供了便捷脚本：

```bash
# 启动所有服务（后端 + 前端 + Agent）
bash scripts/start-all.sh

# 单独启动
bash scripts/start-backend.sh   # 后端 :8080
bash scripts/start-frontend.sh   # 前端 :5173
bash scripts/start-agent.sh      # Agent :9000

# 停止所有服务
bash scripts/stop-all.sh
```

---

## 项目结构

```
tour/
├── README.md                              ← 本文件
├── FEATURE-REMOVAL-PLAN.md                ← 功能精简计划
│
├── tourism-system-java/                   ← ☕ Java Spring Boot 后端
│   ├── pom.xml                            ← Maven 配置
│   ├── sql/schema.sql                     ← 建表 DDL
│   ├── scripts/                           ← 数据迁移/数据处理脚本
│   │   ├── migrate_data.py                ← JSON → MySQL 迁移
│   │   ├── start-backend.sh               ← 启动后端
│   │   ├── start-frontend.sh              ← 启动前端
│   │   ├── start-agent.sh                 ← 启动 Agent
│   │   ├── start-all.sh                   ← 一键启动所有服务
│   │   └── stop-all.sh                    ← 停止所有服务
│   ├── src/main/java/com/tourism/
│   │   ├── TourismApplication.java        ← 应用入口
│   │   ├── config/                        ← Spring 配置
│   │   ├── security/                      ← JWT 认证
│   │   ├── controller/                    ← 14 个 REST 控制器
│   │   ├── service/                       ← 业务逻辑接口
│   │   ├── service/impl/                  ← 业务逻辑实现
│   │   ├── mapper/                        ← MyBatis Mapper
│   │   ├── model/entity/                  ← 12 张数据库实体
│   │   ├── model/dto/                     ← 请求 DTO
│   │   ├── model/vo/                      ← 响应 VO
│   │   ├── algorithm/                     ← 算法实现
│   │   ├── exception/                     ← 全局异常处理
│   │   └── utils/                         ← 工具类
│   └── src/test/                          ← 测试代码
│
├── agent-service/                         ← 🤖 Python AI Agent 服务
│   ├── app/
│   │   ├── main.py                        ← FastAPI 入口
│   │   ├── config.py                      ← 配置管理
│   │   ├── schemas.py                     ← Pydantic 模型
│   │   ├── agent/
│   │   │   ├── base_agent.py              ← Agent 基类
│   │   │   ├── dispatcher.py              ← 意图分发器
│   │   │   ├── chat_agent.py              ← 主对话 Agent
│   │   │   ├── diary_agent.py             ← 日记生成 Agent
│   │   │   ├── route_agent.py             ← 路线规划 Agent
│   │   │   ├── discover_agent.py          ← 发现探索 Agent
│   │   │   ├── orchestrator_agent.py      ← 编排 Agent
│   │   │   ├── llm_client.py              ← LLM 抽象层
│   │   │   └── prompts.py                 ← 提示词管理
│   │   ├── core/
│   │   │   ├── intent.py                  ← 意图分类器
│   │   │   ├── llm.py                     ← LLM 核心
│   │   │   └── model_router.py            ← 模型路由
│   │   ├── tools/
│   │   │   ├── registry.py                ← 工具注册表
│   │   │   ├── tourism_api.py             ← Java 后端客户端
│   │   │   ├── route_planner.py           ← 路线规划工具
│   │   │   ├── image_diary.py             ← 图片日记工具
│   │   │   └── xhs_tool.py / xhs_scraper.py ← 小红书工具
│   │   └── db/
│   │       └── sqlite_store.py            ← SQLite 会话存储
│   └── tests/                             ← Agent 测试
│
├── frontend/                              ← 🎨 React Web 前端
│   ├── src/
│   │   ├── App.jsx                        ← 路由 + 布局
│   │   ├── main.jsx                       ← 入口
│   │   ├── index.css                      ← Glass Frost 设计系统
│   │   ├── pages/                         ← 20+ 页面组件
│   │   ├── components/                    ← 通用组件
│   │   ├── services/api.js                ← API 统一接入层
│   │   └── hooks/                         ← 自定义 Hooks
│   ├── public/loading/                    ← 启动加载页图片
│   └── vite.config.js                     ← Vite 配置
│
├── XhsSkills/                             ← 🔴 小红书技能包
│   └── skills/xhs-apis/
│       ├── scripts/
│       │   ├── xhs_pc_apis.py             ← PC 端接口
│       │   ├── xhs_creator_apis.py        ← 创作者平台接口
│       │   └── xhs_api_tool.py            ← CLI 工具
│       └── agents/
│
├── AGENT-PLAN/                            ← 📋 Agent 设计文档
│   ├── README.md                          ← Agent 规划
│   └── DEEP_AGENT_ROADMAP.md              ← 深度路线图
│
└── DEV-PLAN/                              ← 📝 开发日志与验收矩阵
    ├── DEV_LOG01.md ~ DEV_LOG10.md        ← 10 轮开发日志
    ├── REQUIREMENTS_API_TEST_MATRIX.md    ← 需求-API-测试矩阵
    └── GAODE_NAVIGATION_TEST_CHECKLIST.md ← 高德导航测试清单
```

---

## API 文档

### 统一响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": { ... }
}
```

### 后端 REST API 一览

#### 认证 (`/api/auth`)
| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/auth/login` | 用户登录 | 否 |
| POST | `/api/auth/register` | 用户注册 | 否 |
| GET | `/api/auth/me` | 当前用户信息 | 是 |

#### 地点 (`/api/places`)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/places` | 分页查询 |
| GET | `/api/places/{id}` | 地点详情 |
| GET | `/api/places/search` | 名称/类别/关键字搜索 |
| POST | `/api/places/recommend` | 智能推荐 |
| POST | `/api/places/sort` | 热度/评分排序 |
| POST | `/api/places/{id}/rate` | 评分 |

#### 路径规划 (`/api/navigation`)
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/navigation/shortest-path` | 单目标最短路径 |
| POST | `/api/navigation/mixed-vehicle-path` | 混合交通工具路径 |
| POST | `/api/navigation/multi-destination` | 多目标回路 |
| POST | `/api/navigation/indoor` | 室内导航 |
| GET | `/api/navigation/indoor/rooms` | 室内房间列表 |
| GET | `/api/navigation/indoor/building-info` | 建筑结构信息 |

#### 日记 (`/api/diaries`)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/diaries` | 分页查询 |
| GET | `/api/diaries/{id}` | 日记详情 |
| POST | `/api/diaries` | 创建日记 |
| PUT | `/api/diaries/{id}` | 编辑日记 |
| DELETE | `/api/diaries/{id}` | 删除日记 |
| GET | `/api/diaries/search` | 标题/内容搜索 |
| POST | `/api/diaries/recommend` | 日记推荐 |
| POST | `/api/diaries/{id}/rate` | 日记评分 |

#### 美食 (`/api/foods`)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/foods` | 列表/过滤/搜索/排序 |
| GET | `/api/foods/popular` | 热门美食 |
| GET | `/api/foods/cuisines` | 菜系列表 |
| GET | `/api/foods/place/{placeId}` | 场所美食 |

#### 设施 (`/api/facilities`)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/facilities` | 按场所查询 |
| POST | `/api/facilities/nearest` | 基于路径距离的附近设施排序 |

#### 媒体 (`/api/upload`, `/api/aigc`)
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/upload/image` | 图片上传 |
| POST | `/api/upload/video` | 视频上传 |
| POST | `/api/aigc/convert-to-video` | 图片+描述生成动画 |

#### 算法 (`/api/algorithm`)
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/algorithm/compress` | Huffman 压缩 |
| POST | `/api/algorithm/decompress` | Huffman 解压 |
| POST | `/api/algorithm/filter-text` | AC 自动机敏感词过滤 |

### Agent API (`/agent` - 端口 9000)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/agent/health` | 健康检查 + Agent 列表 |
| POST | `/agent/chat` | 同步对话 |
| POST | `/agent/chat/stream` | SSE 流式对话 |
| GET | `/agent/sessions` | 会话列表 |
| GET | `/agent/sessions/{id}` | 会话详情 |
| DELETE | `/agent/sessions/{id}` | 删除会话 |
| POST | `/agent/diary/generate` | 启动日记生成任务 |
| GET | `/agent/diary/status/{task_id}` | 轮询日记生成进度 |
| POST | `/agent/route/plan` | 自然语言路线规划 |
| GET/PUT/DELETE | `/agent/user/buddy` | 出游搭子管理 |

> 📘 完整 Swagger 文档启动后端后访问 http://localhost:8080/swagger-ui.html

---

## AI Agent 服务

### Agent 架构

```
用户消息 → Dispatcher（意图识别）
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
ChatAgent  DiaryAgent  RouteAgent
(工具集模式) (异步流水线) (5工具+4轮规划)
```

### 意图分类

| 意图 | 路由目标 | 说明 |
|------|----------|------|
| `plan_trip_route` | RouteAgent / ChatAgent | 路线规划 |
| `recommend_place` | ChatAgent | 地点推荐 |
| `search_place` | ChatAgent | 地点搜索 |
| `generate_diary` | DiaryAgent | AI 生成日记 |
| `reverse_recommend` | ChatAgent | 反向推荐 |
| `general_chat` | ChatAgent | 闲聊 |

### LLM 配置

Agent 支持多种大模型，切换只需修改 `.env`：

```env
# OpenAI 兼容接口（默认）
LLM_PROVIDER=openai_compatible
LLM_MODEL=gpt-4o
LLM_API_KEY=your-api-key-here
LLM_BASE_URL=https://api.openai.com/v1

# 或 Anthropic
# LLM_PROVIDER=anthropic
# LLM_MODEL=claude-opus-4-7
# LLM_API_KEY=your-anthropic-api-key
```

> **未配置 API Key 时自动降级为规则模式**，不影响服务启动，但只能使用模板回复。

### 日记生成流水线

```
上传图片 + 提示词
    │
    ▼
阶段 1: 图片理解 (0%→30%)
    │  多模态 LLM 识别景点、美食、活动
    ▼
阶段 2: 要素提取 (30%→50%)
    │  结构化提取地点/活动/心情/亮点
    ▼
阶段 3: 正文撰写 (50%→80%)
    │  按风格（小红书/随笔/攻略）生成
    ▼
阶段 4: 润色定稿 (80%→95%)
    │  修正语句，添加 #话题标签
    ▼
阶段 5: 持久化 (95%→100%)
    │  通过 Java 后端 API 保存到 MySQL
    ▼
  返回结构化日记 JSON
```

---

## 小红书集成

`XhsSkills` 目录封装了基于 [Spider_XHS](https://github.com/cv-cat/Spider_XHS) 的小红书 API 技能包：

```bash
# 安装依赖
pip install -r XhsSkills/skills/xhs-apis/scripts/requirements.txt
cd XhsSkills/skills/xhs-apis/scripts && npm install

# 查看可用方法
python XhsSkills/skills/xhs-apis/scripts/xhs_api_tool.py list
```

### 可用接口

**PC 端 (`xhs_pc_apis.py`)**
- 搜索笔记
- 获取用户信息
- 获取笔记详情

**创作者平台 (`xhs_creator_apis.py`)**
- 创建草稿
- 发布笔记（需用户确认）
- 查询发布状态

> ⚠️ 安全策略：默认只创建草稿，发布需 `userConfirmed=true`，所有发布行为记录审计日志。

---

## 前端页面

| 路由 | 页面 | 功能 |
|------|------|------|
| `/` | HomePage | 首页推荐 |
| `/location-search` | LocationSearchPage | 地点搜索/推荐 |
| `/places/:placeId` | PlaceDetailPage | 地点详情 |
| `/diaries` | DiariesPage | 日记浏览 |
| `/diaries/:diaryId` | DiaryDetailPage | 日记详情 |
| `/navigation` | NavigationPage | 路径规划（校园/景区/多目标） |
| `/travel-assistant` | PersonalTravelAssistantPage | AI 旅游助手 |
| `/search` | MixedSearchPage | 综合搜索 |
| `/my-diaries` | MyDiariesPage | 我的日记 |
| `/diary-management` | DiaryManagementPage | 日记管理 |
| `/profile` | ProfilePage | 个人中心 |
| `/surrounding/:placeId` | SurroundingPage | 周边信息 |
| `/stats` | StatsPage | 系统统计 |
| `/concurrency-test` | ConcurrencyTestPage | 并发测试 |

---

## 测试

### 后端测试

```bash
cd tourism-system-java
mvn test
```

测试使用 H2 内存数据库，覆盖：
- 导航（单目标、混合交通、多目标路径）
- 设施（按路径距离排序）
- 日记（搜索、评分）
- 算法（压缩/解压、敏感词过滤）

### 前端验证

```bash
cd frontend
npm run build    # 构建（必须通过）
npm run lint     # ESLint 检查
```

### Agent 测试

```bash
cd agent-service
python -m pytest tests/ -v
```

### 发布前检查清单

- [x] `mvn test` 全部通过
- [x] `npm run build` 构建成功
- [x] Swagger 文档可访问
- [x] 业务页面不依赖 404/405/501 fallback
- [x] Agent 健康检查正常

---

## 开发日志

详细开发记录见 `DEV-PLAN/`：

| 日志 | 日期 | 主要内容 |
|------|------|----------|
| DEV_LOG01 | 2026-04 | 项目初始化、Spring Boot 搭建 |
| DEV_LOG02 | 2026-04 | 实体建模、数据迁移 |
| DEV_LOG03 | 2026-04 | 路径规划算法（A*/Dijkstra/TSP） |
| DEV_LOG04 | 2026-04 | 场所推荐、日记 CRUD |
| DEV_LOG05 | 2026-04 | 美食模块、设施查询 |
| DEV_LOG06 | 2026-04 | 认证鉴权、前端路由 |
| DEV_LOG07 | 2026-04 | 室内导航、算法演示 |
| DEV_LOG08 | 2026-05 | 前端多页面联调 |
| DEV_LOG09 | 2026-05 | Agent 接入前端、Glass Frost 设计系统 |
| DEV_LOG10 | 2026-05 | 多 Agent 架构、日记自动生成、SQLite 持久化 |

---

## 常见问题

### Q: 启动后端时报 MySQL 连接错误？
确保 MySQL 服务已启动，`application.yml` 中的密码正确，且已执行 `sql/schema.sql` 建表。

### Q: Redis 连接失败？
确保 Redis 服务已启动。如果本地没有 Redis，可以注释掉 `application.yml` 中的 Redis 配置（部分缓存功能会降级）。

### Q: 前端请求后端报 CORS 错误？
后端已配置 CORS，确保前端通过 Vite 代理访问（`vite.config.js` 中 `/api` 转发到 `localhost:8080`）。

### Q: Agent 服务启动后没有智能回复？
检查 `.env` 文件中是否配置了 `LLM_API_KEY`。未配置时自动降级为规则模式，使用模板回复。

### Q: 数据迁移脚本报错？
确保已安装 `pymysql` 和 `bcrypt`（`pip install pymysql bcrypt`），且 `--data-dir` 路径正确。

### Q: 端口被占用？
后端默认 :8080，前端 :5173，Agent :9000。如果端口冲突，可修改配置或先用 `stop-all.sh` 清理。

---

## 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 代码规范

- **后端**: 遵循 Spring Boot 标准分层，Controller → Service → Mapper
- **前端**: ESLint 规则 + Prettier，`npm run lint` 必须通过
- **Agent**: Python 类型标注 + Pydantic 模型验证
- **提交**: 使用清晰的中文或英文提交信息

---

## 许可证

本项目仅供学习和研究使用。

---

*🤖 部分内容由 AI 辅助生成 | 最后更新: 2026-06*
