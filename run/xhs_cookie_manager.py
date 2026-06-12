#!/usr/bin/env python3
"""
小红书 Cookie 清洗 + 更新工具。

用法：
  python run/xhs_cookie_manager.py

步骤：
  1. 显示当前 .env 中的 Cookie（脱敏）
  2. 粘贴从 Chrome DevTools 复制的新 Cookie
  3. 自动清洗为 name=value; name=value 格式
  4. 写入 agent-service/.env 的 XHS_SYSTEM_COOKIES_STR
  5. 提示重启 Agent

无外部依赖，纯标准库。
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


# ─── 路径配置 ────────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parent.parent  # tourism-system-java/
AGENT_DIR = PROJECT_ROOT / "agent-service"
ENV_FILE = AGENT_DIR / ".env"
COOKIE_KEY = "XHS_SYSTEM_COOKIES_STR"

# ─── 关键的 Cookie 名（清洗时只保留这些，去掉噪音） ──────────────────────────
# 小红书 API 实际用到的主要 cookie
MAIN_COOKIE_KEYS = {
    "a1", "web_session", "webId", "id_token",
    "acw_tc", "gid", "abRequestId", "xsecappid",
    "x-rednote-datactry", "x-rednote-holderctry",
    "websectiga", "sec_poison_id",
    "loadts", "ets", "unread", "webBuild",
}


# ─── Cookie 清洗 ─────────────────────────────────────────────────────────────

def clean_cookie(raw: str) -> str:
    """清洗各种来源的小红书 Cookie 为统一格式 "name1=value1; name2=value2"。

    支持：
        - Chrome DevTools 表格粘贴 (Tab 分隔)
        - 标准 Cookie 字符串 "a1=xxx; web_session=yyy"
        - 多空格分隔（表格粘贴变体）
        - 混合格式
    """
    if not raw or not raw.strip():
        return ""

    lines = raw.strip().split("\n")
    pairs: dict[str, str] = {}  # key → value，同名 key 保留最后一次

    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue

        # 格式 1: Tab 分隔（Chrome DevTools）
        if "\t" in line:
            cols = line.split("\t")
            if len(cols) >= 2:
                name = cols[0].strip()
                value = cols[1].strip()
                if name:
                    pairs[name] = value
            continue

        # 格式 2: 标准 ; 分隔的 name=value 串
        if ";" in line and "=" in line and "\t" not in line:
            for seg in line.split(";"):
                seg = seg.strip()
                if "=" in seg and not seg.startswith("="):
                    key, _, val = seg.partition("=")
                    if key.strip():
                        pairs[key.strip()] = val.strip()
            continue

        # 格式 3: 多空格分隔（表格粘贴被转成空格）
        if re.search(r"\s{2,}", line):
            parts = re.split(r"\s{2,}", line)
            if len(parts) >= 2:
                name = parts[0].strip()
                value = parts[1].strip()
                if name:
                    pairs[name] = value
            continue

        # 格式 4: 单独一行 name=value
        if "=" in line:
            key, _, val = line.partition("=")
            if key.strip():
                pairs[key.strip()] = val.strip()

    # 按关键程度排序输出
    ordered: list[str] = []
    for key in MAIN_COOKIE_KEYS:
        if key in pairs:
            ordered.append(f"{key}={pairs[key]}")
            del pairs[key]
    # 追加剩余未在优先列表中的
    for key, val in pairs.items():
        ordered.append(f"{key}={val}")

    return "; ".join(ordered)


# ─── .env 读写 ────────────────────────────────────────────────────────────────

def read_env_cookie() -> str:
    """读取当前 .env 中已配置的 Cookie."""
    if not ENV_FILE.exists():
        return ""
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        if stripped.startswith(f"{COOKIE_KEY}=") or stripped.startswith(f"{COOKIE_KEY} ="):
            return stripped.partition("=")[2].strip()
    return ""


def write_env_cookie(cookie_str: str) -> None:
    """将 Cookie 写入 .env（替换已有行或追加）."""
    if not ENV_FILE.exists():
        ENV_FILE.write_text("", encoding="utf-8")

    content = ENV_FILE.read_text(encoding="utf-8")
    new_lines: list[str] = []
    found = False

    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith(f"{COOKIE_KEY}=") or stripped.startswith(f"{COOKIE_KEY} ="):
            new_lines.append(f"{COOKIE_KEY}={cookie_str}")
            found = True
        else:
            new_lines.append(line)

    if not found:
        new_lines.append("")
        new_lines.append(f"# 小红书系统 Cookie（由 run/xhs_cookie_manager.py 管理）")
        new_lines.append(f"{COOKIE_KEY}={cookie_str}")

    ENV_FILE.write_text("\n".join(new_lines).strip() + "\n", encoding="utf-8")


# ─── 辅助 ────────────────────────────────────────────────────────────────────

def mask(text: str, show: int = 18) -> str:
    """脱敏：只显示开头和结尾各 show 个字符."""
    if not text:
        return "(空)"
    if len(text) <= show * 2 + 3:
        return text
    return f"{text[:show]}...{text[-show:]}"


# ─── 入口 ────────────────────────────────────────────────────────────────────

def main() -> int:
    print("=" * 56)
    print("  📕 小红书 Cookie 清洗 & 更新")
    print("=" * 56)

    # 1. 显示当前 Cookie
    current = read_env_cookie()
    print(f"\n  📋 当前 Cookie: {mask(current)}")
    print(f"  📁 配置文件: {ENV_FILE}")
    print(f"  🔑 配置项:   {COOKIE_KEY}")

    # 2. 获取新 Cookie
    print(f"\n  {'─' * 52}")
    print("  请粘贴从浏览器复制的新 Cookie：\n")
    print("  Chrome/Edge:")
    print("    F12 → Application → Cookies → www.xiaohongshu.com")
    print("    Ctrl+A 全选所有行 → 复制 → 粘贴到下方\n")
    print("  (粘贴后按 Enter，再按 Ctrl+Z 并回车结束)")
    print(f"  {'─' * 52}\n")

    lines: list[str] = []
    try:
        while True:
            line = input()
            lines.append(line)
    except (EOFError, KeyboardInterrupt):
        pass

    raw = "\n".join(lines).strip()
    if not raw:
        print("\n  ❌ 未输入任何内容，已取消")
        return 1

    # 3. 清洗
    cleaned = clean_cookie(raw)
    if not cleaned:
        print("\n  ❌ 清洗失败：未能提取到有效键值对")
        return 1

    print(f"\n  ✅ 清洗完成 ({len(cleaned.split('; '))} 个键值对)")
    print(f"  📝 {mask(cleaned)}")

    # 4. 确认写入
    print(f"\n  是否写入 {ENV_FILE}? [Y/n] ", end="")
    try:
        confirm = input().strip().lower()
    except (EOFError, KeyboardInterrupt):
        confirm = ""
    if confirm and confirm not in ("y", "yes", ""):
        print("  已取消")
        return 0

    # 5. 写入
    write_env_cookie(cleaned)
    print(f"  ✅ 已写入 {ENV_FILE.name}")
    print(f"\n  ⚠️  请重启 Agent 服务使新 Cookie 生效:")
    print(f"     bash scripts/stop-all.sh && bash scripts/start-agent.sh")

    return 0


if __name__ == "__main__":
    sys.exit(main())
