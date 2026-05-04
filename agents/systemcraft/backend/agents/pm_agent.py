"""
PM Agent - Requirements Analyst
================================
Reads:  user_input
Writes: requirements_doc, project_name
"""

from agents.base_agent import BaseAgent
from graph.state import SystemCraftState


class PMAgent(BaseAgent):
    def __init__(self):
        super().__init__(role="pm", temperature=0.3, max_tokens=1500)

    def run(self, state: SystemCraftState) -> dict:
        stage = "requirements_analysis"
        self.log_start(stage)

        user_input = state["user_input"]

        prompt = f"""You are an experienced Software Product Manager.
Analyze the following user requirement and produce a structured requirements document in Chinese.

Output format (use Markdown):

## 1. Project Overview
Brief description of project goals and scope. Suggest a project name.

## 2. User Roles
List all user roles and their permissions in a table.

## 3. Functional Requirements
### Core Features (P0 - Must Have)
### Important Features (P1 - Should Have)
### Nice to Have (P2 - Could Have)

## 4. Non-Functional Requirements
Performance, security, usability, etc.

## 5. Core Use Cases (at least 3)
Format: "As a [role], I want [feature], so that [value]"

## 6. Data Entities (preliminary)
List the main data objects the system needs to manage.

---
User Requirement: {user_input}
"""

        response = self.invoke_prompt(prompt)
        output = response.content

        # Extract a project name from the output (simple heuristic)
        project_name = self._extract_project_name(user_input)

        self.log_done()

        messages = self.append_messages(state, [
            self.create_message(
                f'Received requirement: {user_input}',
                stage, "thinking"
            ),
            self.create_message(output, stage, "output"),
        ])

        return {
            "requirements_doc": output,
            "project_name": project_name,
            "current_stage": stage,
            "agent_messages": messages,
        }

    def _extract_project_name(self, user_input: str) -> str:
        """Extract a simple project name from user input."""
        # Take first 20 chars as a simple name
        name = user_input.strip()
        if len(name) > 20:
            name = name[:20] + "..."
        return name


# Module-level function for LangGraph node
_agent = PMAgent()

def pm_node(state: SystemCraftState) -> dict:
    """LangGraph node function for PM Agent."""
    return _agent.run(state)
