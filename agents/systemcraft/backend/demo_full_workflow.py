"""
Phase 2 Demo: Complete 5-Agent Workflow
========================================
Run: python demo_full_workflow.py

This demonstrates the complete multi-agent pipeline:
  PM -> Architect -> Developer -> QA -> (bug-fix loop) -> Mentor

Watch the terminal to see:
  1. Each agent starting and finishing
  2. The QA agent finding bugs and routing back to Developer
  3. The bug-fix loop in action
  4. The Mentor summarizing everything for learning
"""

import time
import sys

from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown

# Add parent dir to path so imports work
sys.path.insert(0, ".")

from graph.workflow import run_workflow

console = Console()


def main():
    console.print("\n")
    console.print(
        Panel(
            "[bold blue]SystemCraft[/bold blue]\n"
            "[dim]Phase 2 Demo: 5-Agent Complete Workflow[/dim]\n\n"
            "[bold]START -> PM -> Arch -> Dev -> QA --(loop)--> Mentor -> END[/bold]",
            border_style="blue",
            padding=(1, 2),
        )
    )

    # ── You can change this requirement to test different projects ──
    user_input = input(
        "\nPlease enter your project requirement "
        "(press Enter for default): "
    ).strip()

    if not user_input:
        user_input = (
            "I want to build an online library management system "
            "with book borrowing, returning, searching, "
            "admin and regular user roles, "
            "overdue reminders, and reading statistics."
        )
        console.print(f'\n[dim]Using default: {user_input}[/dim]')

    # ── Run the workflow ──
    start_time = time.time()

    try:
        result = run_workflow(user_input, difficulty="medium")
    except Exception as e:
        console.print(f'\n[bold red]Error: {e}[/bold red]')
        console.print('[dim]Please check your .env file and API key.[/dim]')
        return

    elapsed = time.time() - start_time

    # ── Display all outputs ──
    console.print("\n" + "=" * 60)
    console.print("[bold]ALL AGENT OUTPUTS[/bold]")
    console.print("=" * 60)

    sections = [
        ("PM Agent - Requirements", "requirements_doc", "cyan"),
        ("Arch Agent - Architecture", "architecture_doc", "magenta"),
        ("Dev Agent - Code", "code_artifacts", "yellow"),
        ("QA Agent - Test Report", "test_report", "red"),
        ("Mentor - Learning Notes", "mentor_notes", "green"),
        ("Mentor - Knowledge Cards", "knowledge_cards", "green"),
    ]

    for title, key, color in sections:
        content = result.get(key, "")
        if content:
            console.print(f'\n{"=" * 60}')
            console.print(f'[bold {color}]{title}[/bold {color}]')
            console.print("=" * 60)
            # Truncate for readability
            display = content if len(content) < 3000 else content[:3000] + "\n\n... (truncated)"
            console.print(Markdown(display))

    # ── Summary ──
    iterations = result.get("iteration_count", 0)
    msg_count = len(result.get("agent_messages", []))

    console.print("\n" + "=" * 60)
    console.print(
        Panel(
            f"[bold green]Workflow Complete![/bold green]\n\n"
            f"Time elapsed:     {elapsed:.1f}s\n"
            f"Agents involved:  5 (PM, Architect, Developer, QA, Mentor)\n"
            f"Bug-fix loops:    {iterations}\n"
            f"Messages logged:  {msg_count}\n"
            f"Documents output: 6\n\n"
            f"[bold]What you learned:[/bold]\n"
            f"  1. Multi-agent collaboration through shared State\n"
            f"  2. Conditional edges for dynamic routing (bug-fix loop)\n"
            f"  3. Each agent reads previous output as its input\n"
            f"  4. The QA -> Dev loop mimics real code review cycles\n\n"
            f"[bold]Next step:[/bold]\n"
            f"  Run the FastAPI server: python main.py\n"
            f"  Then visit: http://localhost:8000/docs",
            title="Phase 2 Complete",
            border_style="green",
            padding=(1, 2),
        )
    )


if __name__ == "__main__":
    main()
