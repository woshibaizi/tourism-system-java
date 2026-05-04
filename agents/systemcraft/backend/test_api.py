"""
╔══════════════════════════════════════════════════╗
║   Step 1.1: 验证 DeepSeek API 连接              ║
║   运行方式: python test_api.py                   ║
╚══════════════════════════════════════════════════╝

这是你的第一个脚本！它的唯一目标是验证：
  ✅ .env 配置正确
  ✅ DeepSeek API Key 有效
  ✅ langchain-openai 能正常调用 DeepSeek

如果这个脚本能成功运行，说明你的"地基"已经打好了。
"""

from rich.console import Console
from rich.panel import Panel

from config import get_llm, DEEPSEEK_MODEL, DEEPSEEK_BASE_URL

console = Console()


def main():
    console.print("\n")
    console.print(
        Panel(
            "[bold blue]智码学长 SystemCraft[/bold blue]\n"
            "[dim]Step 1.1: DeepSeek API 连接测试[/dim]",
            border_style="blue",
            padding=(1, 2),
        )
    )

    # ── 1. 显示当前配置 ──
    console.print("\n📋 [bold]当前配置:[/bold]")
    console.print(f"   模型:     {DEEPSEEK_MODEL}")
    console.print(f"   接口地址: {DEEPSEEK_BASE_URL}")
    console.print()

    # ── 2. 创建 LLM 实例 ──
    console.print("🔌 正在连接 DeepSeek...", style="yellow")
    try:
        llm = get_llm(temperature=0.3, max_tokens=200)
    except ValueError as e:
        console.print(f"\n{e}", style="bold red")
        return

    # ── 3. 发送测试消息 ──
    console.print("📤 正在发送测试消息...", style="yellow")
    try:
        response = llm.invoke("你好，请用一句话介绍你自己。")
    except Exception as e:
        console.print(f"\n❌ API 调用失败: {e}", style="bold red")
        console.print("\n💡 [dim]请检查：[/dim]")
        console.print("   1. API Key 是否正确")
        console.print("   2. 网络是否能访问 api.deepseek.com")
        console.print("   3. 账户余额是否充足")
        return

    # ── 4. 显示结果 ──
    console.print("\n✅ [bold green]连接成功！DeepSeek 回复：[/bold green]\n")
    console.print(
        Panel(
            response.content,
            title="🤖 DeepSeek 回复",
            border_style="green",
            padding=(1, 2),
        )
    )

    # ── 5. 显示 Token 使用情况 ──
    if hasattr(response, "response_metadata"):
        metadata = response.response_metadata
        usage = metadata.get("token_usage", metadata.get("usage", {}))
        if usage:
            console.print(f"\n📊 [dim]Token 使用: "
                          f"输入 {usage.get('prompt_tokens', '?')} + "
                          f"输出 {usage.get('completion_tokens', '?')} = "
                          f"合计 {usage.get('total_tokens', '?')}[/dim]")

    console.print("\n🎉 [bold green]Step 1.1 完成！你的开发环境已就绪。[/bold green]")
    console.print("👉 [dim]下一步: python demo_single_agent.py[/dim]\n")


if __name__ == "__main__":
    main()
