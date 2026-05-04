"""
Learning Agent - Post-project mentor Q&A
=========================================
Provides follow-up learning conversations after a project is completed.
It can also convert a confusing point into an extra knowledge card.
"""

import re

from agents.base_agent import BaseAgent


class LearningAgent(BaseAgent):
    def __init__(self):
        super().__init__(role="mentor", temperature=0.4, max_tokens=2200)

    def answer_question(
        self,
        *,
        question: str,
        project_name: str,
        project_description: str,
        requirements_doc: str,
        architecture_doc: str,
        code_artifacts: str,
        test_report: str,
        mentor_notes: str,
        knowledge_cards: str,
        add_to_knowledge_cards: bool,
        next_card_index: int,
    ) -> dict:
        card_instruction = f"""
If the student explicitly wants to save this explanation, create ONE additional
review-only knowledge card under <knowledge_card>. This follow-up card is for
review and consolidation, not for generating a new thinking exercise.

The card must use this exact markdown format:

### Knowledge Card [{next_card_index}]: [Topic]
- **Stage**: Follow-up
- **Concept**: one precise knowledge point
- **Why It Matters**: 2-3 sentences
- **Explanation**: 3-4 sentences, concrete and easy for a student to understand
- **Common Mistake**: one common misunderstanding or pitfall
- **Mini Example**: one short example tied to this project
- **Practical Tip**: one actionable suggestion
- **Source**: Follow-up Q&A

Important:
- Do NOT include a "Thinking Question" field.
- Keep the card focused on review and clarification.

If no card should be added, return an empty <knowledge_card></knowledge_card>.
""" if add_to_knowledge_cards else """
Do not create a knowledge card. Return an empty <knowledge_card></knowledge_card>.
"""

        prompt = f"""You are a patient Chinese software engineering mentor.
The student has already completed a project and now wants a follow-up explanation.

Your tasks:
1. Answer the student's question in Chinese.
2. Explain with teaching clarity instead of just restating the result.
3. When helpful, connect the answer to requirements, architecture, code, testing, and engineering tradeoffs.
4. Keep the answer practical and educational.

Output must follow this XML-like structure exactly:
<answer>
[Your detailed answer in Chinese]
</answer>
<knowledge_card>
[Optional extra knowledge card markdown]
</knowledge_card>

{card_instruction}

Project name:
{project_name or "未命名项目"}

Project requirement:
{project_description[:1200]}

Requirements:
{requirements_doc[:2200]}

Architecture:
{architecture_doc[:2200]}

Code:
{code_artifacts[:2200]}

Test report:
{test_report[:1800]}

Mentor notes:
{mentor_notes[:1800]}

Existing knowledge cards:
{knowledge_cards[:2200]}

Student question:
{question}
"""

        response = self.invoke_prompt(prompt)
        content = response.content if hasattr(response, "content") else str(response)
        answer = self._extract_tag(content, "answer").strip() or content.strip()
        knowledge_card = self._extract_tag(content, "knowledge_card").strip()

        if add_to_knowledge_cards and knowledge_card and not knowledge_card.startswith("###"):
            # Keep the storage format consistent even if the model omits the heading marker.
            knowledge_card = f"### Knowledge Card [{next_card_index}]: Follow-up Insight\n{knowledge_card}"

        return {
            "answer": answer,
            "knowledge_card": knowledge_card,
        }

    def create_knowledge_card(
        self,
        *,
        question: str,
        answer: str,
        project_name: str,
        project_description: str,
        requirements_doc: str,
        architecture_doc: str,
        code_artifacts: str,
        test_report: str,
        mentor_notes: str,
        knowledge_cards: str,
        next_card_index: int,
    ) -> str:
        prompt = f"""You are a patient Chinese software engineering mentor.
Convert the answered question below into ONE additional review-only knowledge card.

This card is only for review and recall. Do not generate a new thinking exercise.

Output must follow this XML-like structure exactly:
<knowledge_card>
### Knowledge Card [{next_card_index}]: [Topic]
- **Stage**: Follow-up
- **Concept**: one precise knowledge point
- **Why It Matters**: 2-3 sentences
- **Explanation**: 3-4 sentences, concrete and easy for a student to understand
- **Common Mistake**: one common misunderstanding or pitfall
- **Mini Example**: one short example tied to this project
- **Practical Tip**: one actionable suggestion
- **Source**: Follow-up Q&A
</knowledge_card>

Important:
- Do NOT include a "Thinking Question" field.
- Avoid repeating an existing knowledge card too closely.
- Keep the wording concise, clear, and educational.

Project name:
{project_name or "未命名项目"}

Project requirement:
{project_description[:1200]}

Requirements:
{requirements_doc[:1800]}

Architecture:
{architecture_doc[:1800]}

Code:
{code_artifacts[:1800]}

Test report:
{test_report[:1500]}

Mentor notes:
{mentor_notes[:1500]}

Existing knowledge cards:
{knowledge_cards[:2200]}

Student question:
{question}

Mentor answer:
{answer}
"""

        response = self.invoke_prompt(prompt)
        content = response.content if hasattr(response, "content") else str(response)
        knowledge_card = self._extract_tag(content, "knowledge_card").strip() or content.strip()

        if knowledge_card and not knowledge_card.startswith("###"):
            knowledge_card = f"### Knowledge Card [{next_card_index}]: Follow-up Insight\n{knowledge_card}"

        return knowledge_card

    @staticmethod
    def _extract_tag(content: str, tag: str) -> str:
        match = re.search(rf"<{tag}>\s*(.*?)\s*</{tag}>", content, re.DOTALL | re.IGNORECASE)
        return match.group(1) if match else ""


learning_agent = LearningAgent()
