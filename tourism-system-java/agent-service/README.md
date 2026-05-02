# Personalized Travel Agent Service

根据 `AGENT-PLAN/README.md` 落地的最小可运行 Python Agent 服务。

当前版本目标：

- 提供 `health` 检查。
- 提供统一 `chat` 入口。
- 提供会话列表和会话详情，支持前端 GPT 风格聊天页。
- 记录最小 trace，便于后续接入真实模型、工具和 MCP。

## 运行

1. 安装依赖：

```bash
pip install -e .
```

2. 启动服务：

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 9000
```

3. 访问：

- `GET /health`
- `GET /agent/sessions?user_id=1`
- `POST /agent/chat`

## 说明

- 目前没有接真实大模型，使用规则路由和模板回复，先打通 Java -> Python -> Frontend 链路。
- trace 会写入 `agent-service/data/traces/agent_trace.jsonl`。
- 会话先用进程内内存保存，后续可替换为 Redis / MySQL。
