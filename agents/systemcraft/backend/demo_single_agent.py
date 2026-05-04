"""
╔══════════════════════════════════════════════════╗
║   Step 1.2: 第一个 LangGraph 单 Agent Demo       ║
║   运行方式: python demo_single_agent.py           ║
╚══════════════════════════════════════════════════╝

🎯 本脚本的学习目标：
  1. 理解 LangGraph 的 3 个核心概念：State / Node / Edge
  2. 用 LangGraph 构建最简单的单节点工作流
  3. 观察 PM Agent 如何分析用户需求

📖 LangGraph 概念类比：
  State（状态）= 一张在各部门之间传递的工单
  Node（节点） = 流水线上的一个工作站
  Edge（边）   = 传送带，决定工单流向
  START / END  = 流水线的起点和终点
"""

from typing import TypedDict

from langgraph.graph import StateGraph, START, END
from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown

from config import get_llm

console = Console()


# ════════════════════════════════════════════════
# 第 1 步：定义 State（全局状态）
# ════════════════════════════════════════════════
# 类比：一张工单，PM 负责填写 "pm_output" 这一栏
class State(TypedDict):
    user_input: str   # 用户输入的原始需求
    pm_output: str    # PM Agent 的分析结果


# ════════════════════════════════════════════════
# 第 2 步：定义 Node 函数（PM Agent）
# ════════════════════════════════════════════════
# 类比：流水线上的一个工作站
# 规则：接收 State → 做一件事 → 返回要更新的字段
def pm_node(state: State) -> dict:
    """
    需求分析师 (PM Agent)
    
    职责：接收用户的自然语言需求，输出结构化的需求分析文档。
    输入：state["user_input"] — 用户的原始需求描述
    输出：{"pm_output": "..."} — 结构化需求分析
    """
    console.print("\n🧑‍💼 [bold cyan]PM Agent 开始工作...[/bold cyan]")

    llm = get_llm(temperature=0.3, max_tokens=2000)

    prompt = f"""你是一位经验丰富的软件需求分析师（Product Manager）。

请对以下用户需求进行专业分析，按以下结构输出：

## 1. 项目概述
简要描述项目目标和范围。

## 2. 用户角色
列出系统涉及的所有用户角色及其权限。

## 3. 功能需求（按优先级排列）
### 核心功能（P0 - 必须实现）
### 重要功能（P1 - 应该实现）
### 锦上添花（P2 - 可以实现）

## 4. 非功能性需求
包括性能、安全性、可用性等方面。

## 5. 核心用例（至少 3 个）
用 "作为[角色]，我想要[功能]，以便[价值]" 的格式描述。

---
用户需求：{state["user_input"]}
"""

    response = llm.invoke(prompt)

    console.print("✅ [bold green]PM Agent 完成需求分析[/bold green]")

    return {"pm_output": response.content}


# ════════════════════════════════════════════════
# 第 3 步：构建 Graph（编排工作流）
# ════════════════════════════════════════════════
# 类比：画流水线图纸
#   START → [PM Agent] → END
def build_single_agent_graph():
    """构建只有 PM Agent 的最简工作流"""
    graph = StateGraph(State)

    # 添加节点（工作站）
    graph.add_node("pm", pm_node)

    # 添加边（传送带）
    graph.add_edge(START, "pm")   # 起点 → PM
    graph.add_edge("pm", END)     # PM → 终点

    # 编译（让图纸变成可运行的流水线）
    return graph.compile()


# ════════════════════════════════════════════════
# 第 4 步：运行！
# ════════════════════════════════════════════════
def main():
    console.print("\n")
    console.print(
        Panel(
            "[bold blue]智码学长 SystemCraft[/bold blue]\n"
            "[dim]Step 1.2: 单 Agent LangGraph Demo[/dim]",
            border_style="blue",
            padding=(1, 2),
        )
    )

    # 用户需求（你可以修改这里的文字来测试不同的需求）
    user_requirement = "我想做一个在线图书管理系统，支持借阅、归还、搜索图书功能"

    console.print(f"\n📝 [bold]用户需求:[/bold] {user_requirement}")
    console.print("\n" + "─" * 50)

    # 构建并运行工作流
    app = build_single_agent_graph()
    result = app.invoke({"user_input": user_requirement})

    # 展示结果
    console.print("\n" + "═" * 50)
    console.print("📄 [bold]需求分析师的产出：[/bold]")
    console.print("═" * 50 + "\n")
    console.print(Markdown(result["pm_output"]))

    console.print("\n" + "─" * 50)
    console.print("🎉 [bold green]Step 1.2 完成！[/bold green]")
    console.print()
    console.print("📖 [bold]你学到了什么：[/bold]")
    console.print('   1. State    — 在 Agent 之间传递数据的「工单」')
    console.print('   2. Node     — 执行具体任务的「工作站」（即 Agent）')
    console.print('   3. Edge     — 连接节点的「传送带」')
    console.print('   4. compile  — 把图纸变成可运行的程序')
    console.print()
    console.print("👉 [dim]下一步: python demo_two_agents.py[/dim]\n")


if __name__ == "__main__":
    main()
