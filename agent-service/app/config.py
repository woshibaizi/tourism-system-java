from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def _resolve_trace_dir() -> Path:
    configured = os.getenv("AGENT_TRACE_DIR", "./data/traces")
    return Path(configured).expanduser().resolve()


@dataclass(frozen=True)
class Settings:
    """Python agent 服务运行所需的最小配置集合。"""

    # 服务基础元信息
    agent_name: str = os.getenv("AGENT_NAME", "personalized-travel-agent")
    agent_version: str = os.getenv("AGENT_VERSION", "0.1.0")

    # uvicorn / 容器启动配置
    host: str = os.getenv("AGENT_HOST", "0.0.0.0")
    port: int = int(os.getenv("AGENT_PORT", "9000"))

    # trace 统一落盘目录
    trace_dir: Path = _resolve_trace_dir()

    # 回调 Java 主系统的连接配置
    backend_base_url: str = os.getenv("TOURISM_BACKEND_BASE_URL", "http://127.0.0.1:8080")
    backend_timeout_ms: int = int(os.getenv("TOURISM_BACKEND_TIMEOUT_MS", "5000"))

    # ==================== 大模型统一配置 ====================

    # 提供商类型: openai_compatible / anthropic
    llm_provider: str = os.getenv("LLM_PROVIDER", "openai_compatible")

    # 模型名称，如 gpt-4o / claude-opus-4-7 / deepseek-chat
    llm_model: str = os.getenv("LLM_MODEL", "gpt-4o")

    # API 密钥（必填）
    llm_api_key: str = os.getenv("LLM_API_KEY", "")

    # API 地址（OpenAI 兼容接口可自定义，Anthropic 使用官方地址）
    llm_base_url: str = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")

    # 请求超时（毫秒）
    llm_timeout_ms: int = int(os.getenv("LLM_TIMEOUT_MS", "30000"))

    # 最大 Token 数
    llm_max_tokens: int = int(os.getenv("LLM_MAX_TOKENS", "4096"))

    # 温度
    llm_temperature: float = float(os.getenv("LLM_TEMPERATURE", "0.7"))

    # 是否启用流式输出
    llm_stream: bool = os.getenv("LLM_STREAM", "false").lower() == "true"


settings = Settings()
