"""
Graph State - Global State Definition
======================================
All agents share this state object.
Think of it as a work order passed between departments.
Each agent reads what it needs and writes its own output.
"""

from typing import TypedDict, Literal
from dataclasses import dataclass, field


class SystemCraftState(TypedDict, total=False):
    """
    Multi-Agent shared state.

    Data flow:
        user_input
            -> pm_agent writes requirements_doc
            -> arch_agent writes architecture_doc
            -> dev_agent writes code_artifacts
            -> qa_agent writes test_report + has_bugs
            -> mentor_agent writes mentor_notes + knowledge_cards
    """

    # ── User Input ──
    user_input: str             # Raw requirement from user
    project_name: str           # Project name (extracted by PM)
    difficulty: str             # easy / medium / hard

    # ── Agent Outputs ──
    requirements_doc: str       # PM Agent output
    architecture_doc: str       # Architect Agent output
    code_artifacts: str         # Developer Agent output
    test_report: str            # QA Agent output
    mentor_notes: str           # Mentor Agent output
    knowledge_cards: str        # Mentor Agent: learning content

    # ── Flow Control ──
    current_stage: str          # Current stage name
    has_bugs: bool              # QA found bugs? Controls conditional edge
    iteration_count: int        # Bug-fix loop counter
    max_iterations: int         # Max allowed loops (prevent infinite)

    # ── Message Log ──
    agent_messages: list        # All agent dialogue history


@dataclass
class AgentMessage:
    """A single message from an agent, used for chat stream display."""
    agent_role: str       # pm / architect / developer / qa / mentor
    agent_name: str       # Display name in Chinese
    content: str          # Message content
    stage: str            # Which stage this belongs to
    msg_type: str = "output"  # output / thinking / error

    def to_dict(self) -> dict:
        return {
            "agent_role": self.agent_role,
            "agent_name": self.agent_name,
            "content": self.content,
            "stage": self.stage,
            "msg_type": self.msg_type,
        }
