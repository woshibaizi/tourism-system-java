"""
Workflow - SystemCraft Multi-Agent Orchestration
=================================================
Provides the workflow stage metadata and execution helpers used by both
the synchronous demos and the async API runner.
"""

from typing import Callable

from rich.console import Console

from agents.arch_agent import arch_node
from agents.dev_agent import dev_node
from agents.mentor_agent import mentor_node
from agents.pm_agent import pm_node
from agents.qa_agent import qa_node
from graph.state import SystemCraftState

console = Console()


STAGE_CONFIG = {
    "requirements_analysis": {
        "role": "pm",
        "agent_name": "PM Agent",
        "label": "需求分析",
        "node": pm_node,
        "start_message": "PM Agent 已接收需求，正在拆解功能、角色与核心用例。",
    },
    "architecture_design": {
        "role": "architect",
        "agent_name": "Arch Agent",
        "label": "架构设计",
        "node": arch_node,
        "start_message": "Arch Agent 正在输出技术选型、数据库结构与接口设计。",
    },
    "development": {
        "role": "developer",
        "agent_name": "Dev Agent",
        "label": "开发实现",
        "node": dev_node,
        "start_message": "Dev Agent 正在根据架构方案生成核心代码与实现细节。",
    },
    "testing": {
        "role": "qa",
        "agent_name": "QA Agent",
        "label": "测试评审",
        "node": qa_node,
        "start_message": "QA Agent 正在执行测试用例并评审代码质量。",
    },
    "mentor_review": {
        "role": "mentor",
        "agent_name": "Mentor Agent",
        "label": "导师总结",
        "node": mentor_node,
        "start_message": "Mentor Agent 正在沉淀学习总结、知识卡片与复盘建议。",
    },
}

FIRST_STAGE = "requirements_analysis"
FINAL_STAGE = "mentor_review"


class WorkflowApp:
    """Compatibility wrapper that mimics the old compiled LangGraph app."""

    def invoke(self, initial_state: SystemCraftState) -> dict:
        state = dict(initial_state)
        current_stage = FIRST_STAGE

        while current_stage:
            result = run_stage(current_stage, state)
            state.update(result)
            current_stage = get_next_stage(current_stage, state)

        state["current_stage"] = "completed"
        return state


def qa_router(state: SystemCraftState) -> str:
    """
    Conditional edge function: decides where to go after QA.

    Returns:
        "developer" - if bugs found, go back to Dev
        "mentor"    - if all clear, proceed to Mentor
    """
    has_bugs = state.get("has_bugs", False)
    iteration = state.get("iteration_count", 0)
    max_iter = state.get("max_iterations", 2)

    if has_bugs and iteration < max_iter:
        console.print(
            f"   [bold red]>> ROUTING: Back to Developer "
            f"(iteration {iteration}/{max_iter})[/bold red]"
        )
        return "developer"

    if iteration >= max_iter:
        console.print(
            "   [bold yellow]>> ROUTING: Max iterations reached, "
            "proceeding to Mentor[/bold yellow]"
        )
    else:
        console.print(
            "   [bold green]>> ROUTING: All tests passed, "
            "proceeding to Mentor[/bold green]"
        )
    return "mentor"


def get_initial_state(user_input: str, difficulty: str = "medium") -> SystemCraftState:
    return {
        "user_input": user_input,
        "difficulty": difficulty,
        "project_name": "",
        "requirements_doc": "",
        "architecture_doc": "",
        "code_artifacts": "",
        "test_report": "",
        "mentor_notes": "",
        "knowledge_cards": "",
        "current_stage": "init",
        "has_bugs": False,
        "iteration_count": 0,
        "max_iterations": 2,
        "agent_messages": [],
    }


def get_stage_config(stage_id: str) -> dict:
    return STAGE_CONFIG[stage_id]


def build_workflow() -> WorkflowApp:
    """Backward-compatible builder kept for older imports and demos."""
    return WorkflowApp()


def run_stage(stage_id: str, state: SystemCraftState) -> dict:
    node: Callable[[SystemCraftState], dict] = STAGE_CONFIG[stage_id]["node"]
    return node(state)


def get_next_stage(current_stage: str, state: SystemCraftState) -> str | None:
    if current_stage == "requirements_analysis":
        return "architecture_design"

    if current_stage == "architecture_design":
        return "development"

    if current_stage == "development":
        return "testing"

    if current_stage == "testing":
        route = qa_router(state)
        return "development" if route == "developer" else "mentor_review"

    if current_stage == "mentor_review":
        return None

    return None


def run_workflow(user_input: str, difficulty: str = "medium") -> dict:
    """
    Execute the complete workflow for a given user requirement.
    """
    console.print("\n")
    console.print("=" * 60)
    console.print("[bold blue]SystemCraft Multi-Agent Workflow[/bold blue]")
    console.print("=" * 60)
    console.print(f"Requirement: {user_input}")
    console.print(f"Difficulty:  {difficulty}")
    console.print("=" * 60)
    console.print()
    console.print(
        "[dim]Flow: PM -> Architect -> Developer -> QA "
        "--(conditional)--> Developer(fix) or Mentor -> END[/dim]"
    )
    console.print()

    state = get_initial_state(user_input, difficulty)
    return build_workflow().invoke(state)
