# 🎓 智码学长 SystemCraft

> 基于 LangGraph 多智能体协作的软件工程 AI 导师平台


## 📌 项目简介

智码学长是一款面向计算机专业学生的 AI 教学平台。它通过 5 个专业 AI 智能体（需求分析师、架构师、开发工程师、测试工程师、导师）的协作，模拟真实软件团队的工作流程，让学生在"做中学"中掌握软件工程全流程。

## ⚡ 技术栈

| 层级 | 技术 |
|------|------|
| 智能体编排 | LangGraph + LangChain |
| LLM 引擎 | DeepSeek API (deepseek-chat) |
| 后端 API | FastAPI + WebSocket |
| 前端界面 | React + TypeScript + Tailwind CSS |
| 流程可视化 | ReactFlow |

## 🚀 快速开始

### Windows 一键启动

在项目根目录直接运行下面任意脚本即可：

```bash
start-backend.cmd      # 启动后端
start-frontend.cmd     # 启动前端
start-systemcraft.cmd  # 同时启动前后端
```

说明：
- 后端脚本会在 `.venv` 不存在或缺少依赖时自动补齐环境。
- 前端脚本会在 `node_modules` 不存在时自动执行安装。
- 日常开发通常直接运行 `start-systemcraft.cmd` 即可。

### 1. 克隆项目
```bash
git clone <your-repo-url>
cd systemcraft
```

### 2. 配置后端环境
```bash
cd backend

# 创建虚拟环境
python -m venv .venv

# 激活虚拟环境
# Mac / Linux:
source .venv/bin/activate
# Windows PowerShell:
.venv\Scripts\Activate.ps1

# 安装依赖
pip install -r requirements.txt
```

### 3. 配置 DeepSeek API
```bash
cp .env.example .env
# 编辑 .env，填入你的 DeepSeek API Key
```

### 4. 运行测试
```bash
# Step 1.1: 测试 API 连接
python test_api.py

# Step 1.2: 单 Agent Demo
python demo_single_agent.py

# Step 1.3: 双 Agent 串联 Demo
python demo_two_agents.py
```

## 📁 项目结构

```
systemcraft/
├── backend/                    # Python 后端
│   ├── agents/                 # 5 个 AI Agent 实现
│   ├── graph/                  # LangGraph 工作流
│   ├── api/                    # FastAPI 接口层
│   ├── config.py               # 配置管理
│   ├── main.py                 # 后端入口
│   └── requirements.txt        # Python 依赖
├── frontend/                   # React 前端（Phase 3）
├── docs/                       # 项目文档
└── README.md
```

## 📋 开发阶段

- [x] **Phase 1**: 基础验证（DeepSeek 连接 + LangGraph 单/双 Agent）
- [ ] **Phase 2**: 核心流程（5 Agent 全流程 + FastAPI）
- [ ] **Phase 3**: 前端界面（React + 三栏工作台）
- [ ] **Phase 4**: 打磨亮点（学习引导 + 文档导出）

## 📄 License

MIT
