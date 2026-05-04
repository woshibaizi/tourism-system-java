"""
Architect Agent - System Designer
==================================
Reads:  requirements_doc
Writes: architecture_doc
"""

from agents.base_agent import BaseAgent
from graph.state import SystemCraftState


class ArchAgent(BaseAgent):
    def __init__(self):
        super().__init__(role="architect", temperature=0.3, max_tokens=2200)

    def run(self, state: SystemCraftState) -> dict:
        stage = "architecture_design"
        self.log_start(stage)

        requirements = state.get("requirements_doc", "")

        prompt = f"""You are a senior Software Architect with 10 years of experience.
Based on the requirements document below, design a complete technical architecture in Chinese.

Output format (use Markdown):

## 1. Technology Stack
| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend | ... | ... |
| Backend | ... | ... |
| Database | ... | ... |
| Deployment | ... | ... |

## 2. System Architecture
Describe the overall architecture (e.g., B/S, layered, MVC).
Explain the relationship between layers.

## 3. Database Design
Design at least 4 core tables with fields, types, and relationships.
Use this format for each table:
### Table: table_name
| Field | Type | Constraint | Description |
|-------|------|------------|-------------|

Include relationships (one-to-many, many-to-many, etc.)

## 4. API Design
Design core RESTful APIs:
| Method | Path | Description | Request Body | Response |
|--------|------|-------------|-------------|----------|

## 5. Module Breakdown
Split the system into independent modules. For each:
- Module name
- Responsibility
- Dependencies on other modules

---
Requirements Document:
{requirements}
"""

        response = self.invoke_prompt(prompt)
        output = response.content

        self.log_done()

        messages = self.append_messages(state, [
            self.create_message(
                'Designing architecture based on requirements...',
                stage, "thinking"
            ),
            self.create_message(output, stage, "output"),
        ])

        return {
            "architecture_doc": output,
            "current_stage": stage,
            "agent_messages": messages,
        }


_agent = ArchAgent()

def arch_node(state: SystemCraftState) -> dict:
    """LangGraph node function for Architect Agent."""
    return _agent.run(state)
