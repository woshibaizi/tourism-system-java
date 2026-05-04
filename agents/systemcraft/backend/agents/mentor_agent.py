"""
Mentor Agent - Learning Guide
===============================
Reads:  ALL previous outputs (requirements, architecture, code, test)
Writes: mentor_notes, knowledge_cards
"""

from agents.base_agent import BaseAgent
from graph.state import SystemCraftState


class MentorAgent(BaseAgent):
    def __init__(self):
        super().__init__(role="mentor", temperature=0.5, max_tokens=3000)

    def run(self, state: SystemCraftState) -> dict:
        stage = "mentor_review"
        self.log_start(stage)

        requirements = state.get("requirements_doc", "")
        architecture = state.get("architecture_doc", "")
        code = state.get("code_artifacts", "")
        test_report = state.get("test_report", "")
        iterations = state.get("iteration_count", 0)

        prompt = f"""You are a university professor and software engineering mentor.
A student just watched an AI team complete a software project. Your job is to
help the student LEARN from the entire process. Write everything in Chinese.

Output TWO sections.

---

# SECTION 1: Learning Summary

## Overall Review
Summarize the complete development process in teaching language.
Explain what happened at each stage and mention that the bug-fix loop ran {iterations} time(s).

## Key Decisions Explained
Pick 4-5 important decisions made during the project and explain:
- what the decision was
- why it was reasonable in this project
- what tradeoff it introduced

## Common Misunderstandings To Avoid
List 3-4 places where students are likely to misunderstand the process.

## What Went Well
## What Could Be Improved

## How To Review This Project Again
Provide a short but actionable review path for a student who wants to restudy this project.

---

# SECTION 2: Knowledge Cards

Create exactly 6 detailed knowledge cards:
1. Requirements
2. Architecture
3. Development
4. Testing
5. Iteration / Bug Fix Loop
6. Overall Engineering Thinking

Each card must follow this format exactly:

### Knowledge Card [N]: [Topic]
- **Stage**: Requirements / Architecture / Development / Testing / Overall
- **Concept**: one precise software engineering concept
- **Why It Matters**: 2-3 sentences
- **Explanation**: 3-4 sentences suitable for a CS student
- **Common Mistake**: one misunderstanding or pitfall
- **Mini Example**: one short example tied to this project
- **Practical Tip**: one actionable suggestion
- **Thinking Question**: one open-ended question to deepen understanding

---

Here is the complete project context:

REQUIREMENTS DOCUMENT:
{requirements[:2400]}

ARCHITECTURE DOCUMENT:
{architecture[:2400]}

CODE ARTIFACTS:
{code[:2400]}

TEST REPORT:
{test_report[:1800]}
"""

        response = self.invoke_prompt(prompt)
        output = response.content if hasattr(response, "content") else str(response)

        mentor_notes, knowledge_cards = self._split_output(output)

        self.log_done()

        messages = self.append_messages(
            state,
            [
                self.create_message(
                    "Reviewing the full process and extracting learning insights...",
                    stage,
                    "thinking",
                ),
                self.create_message(mentor_notes, stage, "output"),
                self.create_message(knowledge_cards, stage, "output"),
            ],
        )

        return {
            "mentor_notes": mentor_notes,
            "knowledge_cards": knowledge_cards,
            "current_stage": "completed",
            "agent_messages": messages,
        }

    def _split_output(self, output: str) -> tuple[str, str]:
        marker = "# SECTION 2"
        if marker in output:
            idx = output.index(marker)
            return output[:idx].strip(), output[idx:].strip()

        for marker_text in ["### Knowledge Card", "Knowledge Card", "knowledge card"]:
            if marker_text in output:
                idx = output.index(marker_text)
                return output[:idx].strip(), output[idx:].strip()

        return output.strip(), ""


_agent = MentorAgent()


def mentor_node(state: SystemCraftState) -> dict:
    return _agent.run(state)
