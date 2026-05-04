"""
SystemCraft Agents Module
==========================
5 AI agents that collaborate to complete a software project.
"""

__all__ = ["pm_node", "arch_node", "dev_node", "qa_node", "mentor_node"]


def __getattr__(name: str):
    """
    Lazily expose agent nodes so importing a single submodule does not trigger
    the whole agent tree during package initialization.
    """
    if name == "pm_node":
        from agents.pm_agent import pm_node

        return pm_node
    if name == "arch_node":
        from agents.arch_agent import arch_node

        return arch_node
    if name == "dev_node":
        from agents.dev_agent import dev_node

        return dev_node
    if name == "qa_node":
        from agents.qa_agent import qa_node

        return qa_node
    if name == "mentor_node":
        from agents.mentor_agent import mentor_node

        return mentor_node
    raise AttributeError(f"module 'agents' has no attribute {name!r}")
