"""
智码学长 SystemCraft - 全局配置
从 .env 文件读取环境变量，统一管理所有配置项。
"""

import os
from dotenv import load_dotenv

# 加载 .env 文件（自动查找当前目录下的 .env）
load_dotenv()

# ── DeepSeek API 配置 ──
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

# ── 开发环境配置 ──
DEBUG = os.getenv("DEBUG", "false").lower() == "true"
MAX_ITERATIONS = int(os.getenv("MAX_ITERATIONS", "2"))
LLM_TIMEOUT_SECONDS = int(os.getenv("LLM_TIMEOUT_SECONDS", "120"))
LLM_MAX_RETRIES = int(os.getenv("LLM_MAX_RETRIES", "2"))
LLM_INVOKE_ATTEMPTS = int(os.getenv("LLM_INVOKE_ATTEMPTS", "4"))
LLM_RETRY_BACKOFF_SECONDS = float(os.getenv("LLM_RETRY_BACKOFF_SECONDS", "2"))


def validate_config():
    """启动时检查关键配置是否完整"""
    if not DEEPSEEK_API_KEY:
        raise ValueError(
            "\n❌ 未找到 DEEPSEEK_API_KEY！\n"
            "   请按以下步骤操作：\n"
            "   1. 复制 .env.example 为 .env：  cp .env.example .env\n"
            "   2. 编辑 .env，填入你的 DeepSeek API Key\n"
            "   3. API Key 获取地址：https://platform.deepseek.com\n"
        )
    if not DEEPSEEK_API_KEY.startswith("sk-"):
        raise ValueError(
            "\n❌ DEEPSEEK_API_KEY 格式不正确！\n"
            "   API Key 应以 'sk-' 开头，请检查 .env 文件。\n"
        )
    return True


def get_llm(temperature: float = 0.3, max_tokens: int = 2000):
    """
    创建一个连接 DeepSeek 的 LLM 实例。
    
    Args:
        temperature: 生成温度，越低越精确，越高越有创造力
                     - 0.3: 需求分析、架构设计（精确）
                     - 0.5: 导师解说（平衡）
                     - 0.7: 代码生成（创造力）
        max_tokens:  最大输出 Token 数
    
    Returns:
        ChatOpenAI 实例，已配置好 DeepSeek 连接
    """
    from langchain_openai import ChatOpenAI

    validate_config()

    return ChatOpenAI(
        api_key=DEEPSEEK_API_KEY,
        base_url=DEEPSEEK_BASE_URL,
        model=DEEPSEEK_MODEL,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout=LLM_TIMEOUT_SECONDS,
        max_retries=LLM_MAX_RETRIES,
    )
