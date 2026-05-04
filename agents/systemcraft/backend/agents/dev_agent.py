"""
Developer Agent - Code Generator
==================================
Reads:  architecture_doc, test_report (on bug-fix iterations)
Writes: code_artifacts
"""

from agents.base_agent import BaseAgent
from graph.state import SystemCraftState


class DevAgent(BaseAgent):
    def __init__(self):
        super().__init__(role="developer", temperature=0.7, max_tokens=2600)

    def run(self, state: SystemCraftState) -> dict:
        stage = "development"
        self.log_start(stage)

        architecture = state.get("architecture_doc", "")
        test_report = state.get("test_report", "")
        iteration = state.get("iteration_count", 0)

        # If this is a bug-fix iteration, include the test report
        bug_fix_context = ""
        if iteration > 0 and test_report:
            bug_fix_context = f"""

IMPORTANT - BUG FIX ITERATION #{iteration}:
The QA team found the following issues. Please fix them:

{test_report}

Focus on fixing the reported bugs while keeping existing correct code intact.
"""

        prompt = f"""You are a skilled Software Developer.
Based on the architecture design below, generate the core implementation code in Chinese comments.
{bug_fix_context}

Output format (use Markdown with code blocks):

## 1. Project Structure
Show the file/folder structure of the implementation.

## 2. Data Models
```python
# Database models (using SQLAlchemy or similar ORM style)
```

## 3. Core Business Logic
```python
# Service layer - main business functions
```

## 4. API Routes
```python
# FastAPI route handlers
```

## 5. Configuration
```python
# App config and database connection
```

Requirements:
- Use Python as the primary language
- Follow clean code principles
- Add Chinese comments explaining key logic
- Include error handling
- Include input validation

---
Architecture Document:
{architecture}
"""

        response = self.invoke_prompt(prompt)
        output = response.content

        self.log_done()

        msg_text = 'Fixing bugs from QA report...' if iteration > 0 else 'Writing code based on architecture...'
        messages = self.append_messages(state, [
            self.create_message(msg_text, stage, "thinking"),
            self.create_message(output, stage, "output"),
        ])

        return {
            "code_artifacts": output,
            "current_stage": stage,
            "agent_messages": messages,
        }


_agent = DevAgent()

def dev_node(state: SystemCraftState) -> dict:
    """LangGraph node function for Developer Agent."""
    return _agent.run(state)
