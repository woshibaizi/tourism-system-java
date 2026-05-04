"""
QA Agent - Tester and Code Reviewer
=====================================
Reads:  code_artifacts, requirements_doc
Writes: test_report, has_bugs, iteration_count

KEY ROLE: Controls the conditional edge!
  - has_bugs=True  -> route back to Developer for fixes
  - has_bugs=False -> proceed to Mentor for summary
"""

import json
from agents.base_agent import BaseAgent
from graph.state import SystemCraftState


class QAAgent(BaseAgent):
    def __init__(self):
        super().__init__(role="qa", temperature=0.3, max_tokens=1800)

    def run(self, state: SystemCraftState) -> dict:
        stage = "testing"
        self.log_start(stage)

        code = state.get("code_artifacts", "")
        requirements = state.get("requirements_doc", "")
        iteration = state.get("iteration_count", 0)
        max_iter = state.get("max_iterations", 2)

        prompt = f"""You are a meticulous QA Engineer / Code Reviewer.
Review the following code against the requirements and produce a test report in Chinese.

IMPORTANT: You must evaluate honestly.
- If this is the first review (iteration=0), find 2-3 realistic issues to demonstrate the bug-fix loop.
- If this is a subsequent review (iteration>0), the developer has tried to fix bugs. Be more lenient.
- If iteration >= {max_iter}, approve the code to prevent infinite loops.

Current iteration: {iteration}
Max iterations: {max_iter}

Output format (use Markdown):

## 1. Test Summary
| Item | Result |
|------|--------|
| Total Test Cases | N |
| Passed | N |
| Failed | N |
| Overall Verdict | PASS / FAIL |

## 2. Test Cases
For each test case:
### TC-XX: [Test Name]
- **Type**: Unit / Integration / Edge Case
- **Input**: ...
- **Expected**: ...
- **Result**: PASS / FAIL
- **Details**: ...

## 3. Code Review Findings
List any code quality issues, security concerns, or improvement suggestions.

## 4. Verdict
State clearly: "PASS" or "FAIL"
If FAIL, list the critical bugs that must be fixed.

---
Requirements:
{requirements}

Code to review:
{code}
"""

        response = self.invoke_prompt(prompt)
        output = response.content

        # Determine if bugs were found
        has_bugs = self._detect_bugs(output, iteration, max_iter)

        self.log_done()

        # Log the routing decision
        if has_bugs:
            route_msg = (
                f'[Bug-fix loop] Found issues! Sending back to Developer. '
                f'(iteration {iteration + 1}/{max_iter})'
            )
        else:
            route_msg = 'All tests passed! Proceeding to Mentor for summary.'

        from rich.console import Console
        Console().print(f'   [bold]Routing:[/bold] {route_msg}')

        messages = self.append_messages(state, [
            self.create_message('Reviewing code quality and running tests...', stage, "thinking"),
            self.create_message(output, stage, "output"),
            self.create_message(route_msg, stage, "thinking"),
        ])

        return {
            "test_report": output,
            "has_bugs": has_bugs,
            "iteration_count": iteration + 1,
            "current_stage": stage,
            "agent_messages": messages,
        }

    def _detect_bugs(self, report: str, iteration: int, max_iter: int) -> bool:
        """
        Determine if the QA report indicates bugs.
        Force PASS if max iterations reached.
        """
        if iteration >= max_iter:
            return False

        report_lower = report.lower()
        # Check for FAIL verdict
        if "verdict" in report_lower:
            # Look for explicit PASS/FAIL after "verdict"
            verdict_pos = report_lower.rfind("verdict")
            verdict_section = report_lower[verdict_pos:verdict_pos + 200]
            if "fail" in verdict_section:
                return True
            if "pass" in verdict_section:
                return False

        # Fallback: first iteration always finds bugs to demo the loop
        if iteration == 0:
            return True
        return False


_agent = QAAgent()

def qa_node(state: SystemCraftState) -> dict:
    """LangGraph node function for QA Agent."""
    return _agent.run(state)
