"""
SystemCraft Graph Module
=========================
LangGraph workflow definition and state management.
"""

from graph.state import SystemCraftState, AgentMessage


def build_workflow():
    """
    Lazily import the workflow builder to avoid circular imports while
    `graph.state` is being imported by agent base classes.
    """
    from graph.workflow import build_workflow as _build_workflow

    return _build_workflow()


def run_workflow(user_input: str, difficulty: str = "medium"):
    """
    Lazily import the workflow runner to keep package-level imports cheap and
    safe during backend startup.
    """
    from graph.workflow import run_workflow as _run_workflow

    return _run_workflow(user_input, difficulty)


__all__ = ["build_workflow", "run_workflow", "SystemCraftState", "AgentMessage"]
