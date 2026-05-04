"""
╔══════════════════════════════════════════════════╗
║   Step 1.3: 双 Agent 串联流程                    ║
║   运行方式: python demo_two_agents.py             ║
╚══════════════════════════════════════════════════╝

🎯 本脚本的学习目标：
  1. 理解多 Agent 如何通过 State 传递信息
  2. 观察 PM → 架构师 的真实协作过程
  3. 掌握 "上一个 Agent 的输出 = 下一个 Agent 的输入" 模式

📖 核心概念：
  这就像真实公司里的流程：
  产品经理写完需求文档 → 交给架构师 → 架构师基于需求设计技术方案
  State 就是那份在部门之间流转的文档。
"""

import time
from typing import TypedDict

from langgraph.graph import StateGraph, START, END
from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown
from rich.progress import Progress, SpinnerColumn, TextColumn

from config import get_llm

console = Console()


# ════════════════════════════════════════════════
# 第 1 步：定义 State
# ════════════════════════════════════════════════
# 比 Step 1.2 多了 arch_output 字段——架构师要往"工单"上填写自己的方案
class State(TypedDict):
    user_input: str     # 用户原始需求
    pm_output: str      # PM Agent 的需求分析
    arch_output: str    # 架构师 Agent 的技术方案


# ════════════════════════════════════════════════
# 第 2 步：定义两个 Agent 节点
# ════════════════════════════════════════════════

def pm_node(state: State) -> dict:
    """
    需求分析师 (PM Agent)
    读取：user_input
    写入：pm_output
    """
    console.print("\n🧑‍💼 [bold cyan]【PM Agent · 需求分析师】开始工作[/bold cyan]")
    console.print("   📖 读取: user_input（用户原始需求）")
    console.print("   ✏️  写入: pm_output（结构化需求文档）\n")

    llm = get_llm(temperature=0.3, max_tokens=2000)

    prompt = f"""你是一位经验丰富的软件需求分析师。

请对以下需求进行专业分析，输出结构化文档：

## 1. 项目概述
## 2. 用户角色（列出角色和权限）
## 3. 功能需求
### 核心功能（P0）
### 重要功能（P1）
### 可选功能（P2）
## 4. 非功能性需求
## 5. 核心用例（至少 3 个，用"作为[角色]，我想要[功能]，以便[价值]"格式）

用户需求：{state["user_input"]}"""

    response = llm.invoke(prompt)
    console.print("   ✅ [green]PM Agent 完成，产出已写入 State[/green]\n")

    return {"pm_output": response.content}


def arch_node(state: State) -> dict:
    """
    架构师 (Architect Agent)
    读取：pm_output（上一个 Agent 的产出）
    写入：arch_output
    """
    console.print("🏗️  [bold magenta]【Arch Agent · 架构师】开始工作[/bold magenta]")
    console.print("   📖 读取: pm_output（PM 的需求文档）")
    console.print("   ✏️  写入: arch_output（技术架构方案）\n")

    llm = get_llm(temperature=0.3, max_tokens=3000)

    prompt = f"""你是一位拥有 10 年经验的软件架构师。

基于以下需求分析文档，请设计完整的技术架构方案，包括：

## 1. 技术选型
列出前端、后端、数据库、部署方案的选型及理由。

## 2. 系统架构图（用文字描述）
描述系统的整体架构，包括各层之间的关系。

## 3. 数据库设计
列出核心数据表、字段、关系（至少 3 张表）。

## 4. API 接口设计
列出核心 API 接口（RESTful 风格），包括路径、方法、参数。

## 5. 模块划分
将系统拆分为若干独立模块，说明各模块职责和边界。

---
需求文档：
{state["pm_output"]}"""

    response = llm.invoke(prompt)
    console.print("   ✅ [green]Arch Agent 完成，产出已写入 State[/green]\n")

    return {"arch_output": response.content}


# ════════════════════════════════════════════════
# 第 3 步：构建 Graph
# ════════════════════════════════════════════════
# 流程：START → PM → Architect → END
def build_two_agent_graph():
    """构建 PM → 架构师 的双 Agent 串联工作流"""
    graph = StateGraph(State)

    # 添加节点
    graph.add_node("pm", pm_node)
    graph.add_node("architect", arch_node)

    # 添加边（定义流转顺序）
    graph.add_edge(START, "pm")            # 起点 → PM
    graph.add_edge("pm", "architect")      # PM → 架构师
    graph.add_edge("architect", END)       # 架构师 → 终点

    return graph.compile()


# ════════════════════════════════════════════════
# 第 4 步：运行并展示结果
# ════════════════════════════════════════════════
def main():
    console.print("\n")
    console.print(
        Panel(
            "[bold blue]智码学长 SystemCraft[/bold blue]\n"
            "[dim]Step 1.3: 双 Agent 串联 Demo[/dim]\n\n"
            "[bold]流程: START → [PM Agent] → [Arch Agent] → END[/bold]",
            border_style="blue",
            padding=(1, 2),
        )
    )

    # ── 用户需求 ──
    user_requirement = "我想做一个在线图书管理系统，支持借阅、归还、搜索图书，有管理员和普通用户两种角色"

    console.print(f"\n📝 [bold]用户需求:[/bold]\n   {user_requirement}")
    console.print("\n" + "═" * 60)
    console.print("🚀 [bold]启动多 Agent 工作流...[/bold]")
    console.print("═" * 60)

    # ── 构建并运行 ──
    start_time = time.time()
    app = build_two_agent_graph()
    result = app.invoke({"user_input": user_requirement})
    elapsed = time.time() - start_time

    # ── 展示 PM 产出 ──
    console.print("\n" + "═" * 60)
    console.print("📄 [bold cyan]【产出 1】需求分析师的需求文档：[/bold cyan]")
    console.print("═" * 60)
    console.print(Markdown(result["pm_output"]))

    # ── 展示架构师产出 ──
    console.print("\n" + "═" * 60)
    console.print("📄 [bold magenta]【产出 2】架构师的技术方案：[/bold magenta]")
    console.print("═" * 60)
    console.print(Markdown(result["arch_output"]))

    # ── 总结 ──
    console.print("\n" + "═" * 60)
    console.print(
        Panel(
            f"[bold green]✅ 双 Agent 协作完成！[/bold green]\n\n"
            f"⏱️  总耗时: {elapsed:.1f} 秒\n"
            f"📊  Agent 数量: 2（PM + Architect）\n"
            f"📄  产出数量: 2 份文档\n\n"
            f"[bold]🎓 你学到了什么：[/bold]\n"
            f"  1. State 是 Agent 之间的「共享工单」\n"
            f"  2. PM 的 pm_output 自动成为架构师的输入\n"
            f"  3. 数据通过 State 在节点之间流转，无需手动传参\n"
            f"  4. 每个 Agent 只关心自己要读什么、写什么\n\n"
            f"[bold]🧠 思考题：[/bold]\n"
            f"  如果架构师发现 PM 的需求不完整，\n"
            f"  应该怎样让流程回退到 PM 重新分析？\n"
            f"  （提示：这就是 Phase 2 要学的 Conditional Edge！）",
            title="🎉 Phase 1 全部完成",
            border_style="green",
            padding=(1, 2),
        )
    )

    console.print("👉 [dim]下一步进入 Phase 2: 实现 5 个 Agent 的完整工作流[/dim]\n")


if __name__ == "__main__":
    main()
