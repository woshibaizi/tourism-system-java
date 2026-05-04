"""
Base Agent - Parent class for all agents
=========================================
Provides shared LLM connection, logging, and message recording.
All 5 agents inherit from this class.
"""

import time

from rich.console import Console
from config import (
    LLM_INVOKE_ATTEMPTS,
    LLM_RETRY_BACKOFF_SECONDS,
    get_llm,
)
from graph.state import AgentMessage

console = Console()

# Agent color scheme for terminal display
AGENT_COLORS = {
    "pm":        {"color": "cyan",    "icon": "\U0001f9d1\u200d\U0001f4bc", "name": "PM Agent"},
    "architect": {"color": "magenta", "icon": "\U0001f3d7\ufe0f",  "name": "Arch Agent"},
    "developer": {"color": "yellow",  "icon": "\U0001f468\u200d\U0001f4bb", "name": "Dev Agent"},
    "qa":        {"color": "red",     "icon": "\U0001f50d", "name": "QA Agent"},
    "mentor":    {"color": "green",   "icon": "\U0001f393", "name": "Mentor Agent"},
}

# Agent Chinese display names
AGENT_NAMES_CN = {
    "pm":        "PM Agent",
    "architect": "Arch Agent",
    "developer": "Dev Agent",
    "qa":        "QA Agent",
    "mentor":    "Mentor Agent",
}


class BaseAgent:
    """
    Base class for all SystemCraft agents.

    Usage:
        class PMAgent(BaseAgent):
            def __init__(self):
                super().__init__(role="pm", temperature=0.3, max_tokens=2000)
    """

    def __init__(self, role: str, temperature: float = 0.3, max_tokens: int = 2000):
        self.role = role
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.style = AGENT_COLORS.get(role, {"color": "white", "icon": "", "name": role})
        self.cn_name = AGENT_NAMES_CN.get(role, role)

    def get_llm(self):
        """Get a configured LLM instance for this agent."""
        return get_llm(temperature=self.temperature, max_tokens=self.max_tokens)

    def invoke_prompt(self, prompt: str):
        """
        Invoke the model with extra retry protection for flaky network/protocol errors.
        """
        token_budget = self.max_tokens
        last_error = None

        for attempt in range(1, LLM_INVOKE_ATTEMPTS + 1):
            llm = get_llm(
                temperature=self.temperature,
                max_tokens=token_budget,
            )
            try:
                if attempt > 1:
                    console.print(
                        f'   [yellow]Retrying LLM request '
                        f'({attempt}/{LLM_INVOKE_ATTEMPTS})...[/yellow]'
                    )
                return llm.invoke(prompt)
            except Exception as exc:
                last_error = exc
                if not self._is_retryable_error(exc) or attempt >= LLM_INVOKE_ATTEMPTS:
                    raise

                wait_seconds = LLM_RETRY_BACKOFF_SECONDS * attempt
                token_budget = max(700, int(token_budget * 0.8))
                console.print(
                    f'   [yellow]Transient LLM error: {type(exc).__name__}. '
                    f'Waiting {wait_seconds:.1f}s before retry...[/yellow]'
                )
                time.sleep(wait_seconds)

        raise last_error

    def log_start(self, stage: str):
        """Print agent start message to terminal."""
        color = self.style["color"]
        icon = self.style["icon"]
        name = self.style["name"]
        console.print(
            f'\n{icon} [bold {color}][{name}][/bold {color}] started working...'
        )
        console.print(f'   Stage: {stage}')

    def log_done(self):
        """Print agent completion message."""
        color = self.style["color"]
        name = self.style["name"]
        console.print(f'   [green]OK[/green] [{name}] done, output written to State\n')

    def create_message(self, content: str, stage: str, msg_type: str = "output") -> dict:
        """Create a standard agent message dict."""
        return AgentMessage(
            agent_role=self.role,
            agent_name=self.cn_name,
            content=content,
            stage=stage,
            msg_type=msg_type,
        ).to_dict()

    def append_messages(self, state: dict, new_messages: list) -> list:
        """Safely append new messages to state's agent_messages list."""
        existing = state.get("agent_messages", []) or []
        return existing + new_messages

    def _is_retryable_error(self, exc: Exception) -> bool:
        """
        Retry on transient transport / timeout / connection failures.
        """
        retryable_names = {
            "APIConnectionError",
            "APITimeoutError",
            "RemoteProtocolError",
            "ReadTimeout",
            "ConnectTimeout",
            "ConnectError",
            "ReadError",
            "WriteError",
            "ProtocolError",
        }

        current = exc
        while current:
            error_name = type(current).__name__
            error_message = str(current).lower()
            if error_name in retryable_names:
                return True
            if "incomplete chunked read" in error_message:
                return True
            if "connection error" in error_message:
                return True
            if "peer closed connection" in error_message:
                return True
            current = current.__cause__ or current.__context__

        return False
