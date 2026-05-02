from __future__ import annotations


def build_diary_draft(prompt: str, images: list[str]) -> dict:
    """
    生成日记草稿占位结果。

    这里暂时不做图像理解，只根据用户 prompt 生成一个可演示的结构化返回，
    目的是先验证 Java -> Python -> Frontend 的闭环链路。
    """
    title = "旅途片段记录"
    if "校园" in prompt:
        title = "校园散步日记"
    elif "湖" in prompt:
        title = "湖边慢游日记"

    return {
        "title": title,
        "content": f"根据你的提示“{prompt}”，我先生成了一版适合继续润色的旅行日记草稿。",
        "tags": ["旅行", "记录", "草稿"],
        "images": images,
    }
