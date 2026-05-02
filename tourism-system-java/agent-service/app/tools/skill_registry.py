from __future__ import annotations


def list_available_skills() -> list[dict]:
    """
    返回当前 agent 已知的技能清单。

    目前只放规划中的占位信息，主要用于 trace 和前端调试观察。
    """
    return [
        {
            "id": "xiaohongshu_create_draft",
            "name": "小红书草稿",
            "side_effect": "draft_only",
            "status": "planned",
        }
    ]
