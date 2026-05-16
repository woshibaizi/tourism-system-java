"""
日记生成 Agent — 独立子 Agent，异步执行多阶段日记生成。

流程：
1. 图片理解（如果有图片 → 用多模态 LLM 识别内容）
2. 要素提取（从用户文本 + 图片识别结果中提取地点/活动/心情）
3. 正文撰写（基于要素 + 风格偏好生成日记正文）
4. 润色定稿（检查文字流畅度，添加话题标签）
5. 持久化到业务数据库（通过 tourism_api 调用 Java 后端）

任务状态持久化到 TaskDB（SQLite），服务重启不丢失。
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any

from app.agent.base_agent import AgentContext, AgentResponse, BaseAgent
from app.agent.prompts import DIARY_GENERATE_PROMPT
from app.core.llm import get_llm, llm_available
from app.db.sqlite_store import task_db
from app.tools.tourism_api import tourism_api_client

logger = logging.getLogger(__name__)


class DiaryAgent(BaseAgent):
    """独立日记生成 Agent，异步执行。任务状态持久化到 SQLite。"""

    @property
    def name(self) -> str:
        return "diary"

    @property
    def description(self) -> str:
        return "日记生成助手：根据图片和文字描述生成旅行日记"

    def get_system_prompt(self) -> str:
        return DIARY_GENERATE_PROMPT

    def can_handle(self, intent: str) -> bool:
        return intent == "generate_diary"

    def process(self, message: str, context: AgentContext) -> AgentResponse:
        """
        启动异步日记生成任务，立即返回任务 ID。
        前端通过轮询 /agent/diary/status/{task_id} 获取进度。
        """
        task_id = f"diary_{uuid.uuid4().hex[:12]}"
        images = context.metadata.get("images", [])
        style = context.metadata.get("style", "小红书")

        task_db.create_task(task_id, context.user_id, "diary")
        task_db.update_task(task_id, status="running", progress=0, message="任务已创建，等待执行...")

        # 在后台运行异步任务
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(self._execute_task(
                    task_id, context.user_id, message, images, style,
                ))
            else:
                loop.run_until_complete(self._execute_task(
                    task_id, context.user_id, message, images, style,
                ))
        except RuntimeError:
            # 无运行中的事件循环时，在新线程中运行
            import threading
            t = threading.Thread(
                target=lambda: asyncio.run(self._execute_task(
                    task_id, context.user_id, message, images, style,
                )),
                daemon=True,
            )
            t.start()

        return AgentResponse(
            content=f"收到！我正在为你生成旅行日记...\n\n任务 ID: {task_id}\n当前进度: 0%",
            intent="generate_diary",
            suggestions=["查看日记进度", "继续聊天"],
            tools_used=["diary_agent"],
            metadata={"task_id": task_id},
        )

    async def _execute_task(
        self, task_id: str, user_id: str, prompt: str,
        images: list[str], style: str,
    ) -> None:
        """异步执行日记生成流水线。"""
        try:
            # 阶段 1: 图片理解 (0-30%)
            task_db.update_task(task_id, status="running", progress=5, message="正在分析图片内容...")
            image_descriptions = self._understand_images(images)

            task_db.update_task(task_id, status="running", progress=30, message="图片分析完成，正在提取关键要素...")

            # 阶段 2: 要素提取 (30-50%)
            elements = self._extract_elements(prompt, image_descriptions)

            task_db.update_task(task_id, status="running", progress=50, message="要素提取完成，正在撰写日记正文...")

            # 阶段 3: 正文撰写 (50-80%)
            draft = self._generate_draft(prompt, image_descriptions, elements, style)

            task_db.update_task(task_id, status="running", progress=80, message="正文撰写完成，正在润色定稿...")

            # 阶段 4: 润色定稿 (80-95%)
            final = self._polish(draft, style)

            task_db.update_task(task_id, status="running", progress=95, message="润色完成，正在保存日记...")

            # 阶段 5: 持久化到数据库 (95-100%)
            diary_result = self._save_diary(user_id, final, images)

            task_db.update_task(
                task_id, status="completed", progress=100,
                message="日记生成完成！",
                result={
                    "title": final.get("title", ""),
                    "content": final.get("content", ""),
                    "tags": final.get("tags", []),
                    "images": images,
                    "diary_id": diary_result.get("id", ""),
                },
            )
        except Exception as e:
            logger.exception("日记生成任务 %s 失败", task_id)
            task_db.update_task(task_id, status="failed", progress=0, message="生成失败", error=str(e))

    def _understand_images(self, images: list[str]) -> list[str]:
        """调用多模态 LLM 识别图片内容（使用 vision content blocks）。"""
        if not images:
            return []

        if not llm_available():
            return [f"[图片 {i+1}]（LLM 不可用，请手动描述图片内容）" for i in range(len(images))]

        from app.agent.llm_client import build_vision_content

        descriptions: list[str] = []
        client = get_llm()
        assert client is not None

        for i, img_url in enumerate(images):
            try:
                msgs = [
                    {
                        "role": "system",
                        "content": "你是一位旅行摄影师，擅长从照片中识别景点、美食和活动场景。",
                    },
                    {
                        "role": "user",
                        "content": build_vision_content(
                            "请详细描述这张旅行照片的内容，包括：\n"
                            "1. 拍摄地点/场景\n"
                            "2. 画面中的主要事物（建筑、自然景观、食物、人物活动等）\n"
                            "3. 画面传达的氛围和情绪",
                            [img_url],
                        ),
                    },
                ]
                result = client.chat(msgs, max_tokens=500)
                descriptions.append(result.content or "")
            except Exception as e:
                logger.warning("图片 %s 识别失败: %s", img_url, e)
                descriptions.append(f"[图片 {i+1}] 识别失败")

        return descriptions

    def _extract_elements(self, prompt: str, image_descs: list[str]) -> dict[str, Any]:
        """从文本和图片描述中提取结构化要素。"""
        if not llm_available():
            return {"place": "未知地点", "activity": "旅行", "mood": "愉快", "highlights": []}

        client = get_llm()
        assert client is not None

        image_text = "\n".join(f"- {d}" for d in image_descs) if image_descs else "无图片"
        msgs = [
            {"role": "system", "content": "你是旅行日记编辑，擅长从素材中提取关键信息。只返回 JSON。"},
            {
                "role": "user",
                "content": (
                    f"用户描述: {prompt}\n\n图片内容:\n{image_text}\n\n"
                    "请提取以下信息，返回 JSON 格式（不要其他文字）：\n"
                    '{"place": "地点", "activity": "主要活动", "mood": "心情/氛围", '
                    '"highlights": ["亮点1", "亮点2"], "foods": ["食物1"]}'
                ),
            },
        ]
        result = client.chat(msgs, temperature=0.3, max_tokens=500)
        return _parse_json(result.content or "")

    def _generate_draft(
        self, prompt: str, image_descs: list[str], elements: dict[str, Any], style: str
    ) -> dict[str, Any]:
        return _generate_draft_content(prompt, image_descs, elements, style)

    def _polish(self, draft: dict[str, Any], style: str) -> dict[str, Any]:
        return _polish_content(draft, style)

    def _save_diary(self, user_id: str, diary: dict[str, Any], images: list[str]) -> dict[str, Any]:
        """通过 Java 后端保存日记到数据库。"""
        try:
            result = tourism_api_client.create_diary(
                title=diary.get("title", "旅行日记"),
                content=diary.get("content", ""),
                user_id=user_id,
                images=images,
                tags=diary.get("tags", []),
            )
            return result or {}
        except Exception as e:
            logger.warning("日记保存到后端失败: %s", e)
            return {}


# ==================== 工具函数 ====================


def get_task_status(task_id: str) -> dict[str, Any] | None:
    """从 TaskDB 读取任务状态（替代原内存 dict）。"""
    return task_db.get_task(task_id)


def _parse_json(raw: str) -> dict[str, Any]:
    """从 LLM 文本中提取 JSON 对象，支持嵌套结构。"""
    import json

    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or start >= end:
        return {}
    try:
        return json.loads(raw[start:end + 1])
    except (json.JSONDecodeError, TypeError):
        return {}


def _extract_tags(text: str) -> list[str]:
    import re
    tags = re.findall(r"#(\S+)", text)
    return tags[:8] if tags else []


def _generate_draft_content(
    prompt: str, image_descs: list[str], elements: dict[str, Any], style: str
) -> dict[str, Any]:
    """基于要素生成日记正文（模块级可复用，MemoryAgent 也调用此函数）。"""
    if not llm_available():
        return {
            "title": f"旅行回忆 - {elements.get('place', '未知')}",
            "content": (
                f"在{elements.get('place', '这段旅程')}，"
                f"体验了{elements.get('activity', '美好的旅行')}，"
                f"心情很{elements.get('mood', '愉快')}。\n\n{prompt}"
            ),
            "raw": "",
        }

    client = get_llm()
    assert client is not None

    style_guide = {
        "小红书": "活泼口语化，多用 emoji，短句分段，每段 2-3 行，加上 #话题标签",
        "随笔": "文艺细腻，叙事性强，段落流畅，有画面感和情绪起伏",
        "攻略": "实用条理清晰，分点列出 tips，时间/路线/花费明确",
        "回忆": "温暖怀旧，像翻看旧相册一样娓娓道来，有具体数字和细节",
    }
    style_prompt = style_guide.get(style, style_guide["小红书"])

    image_text = "\n".join(f"- {d}" for d in image_descs) if image_descs else "无图片"

    msgs = [
        {"role": "system", "content": f"你是旅行日记写手，擅长{style}风格。{style_prompt}"},
        {
            "role": "user",
            "content": (
                f"请根据以下素材生成一篇旅行日记（{style}风格）：\n\n"
                f"用户的话: {prompt}\n"
                f"地点: {elements.get('place', '未知')}\n"
                f"活动: {elements.get('activity', '旅行')}\n"
                f"心情: {elements.get('mood', '愉快')}\n"
                f"亮点: {', '.join(elements.get('highlights', []))}\n"
                f"图片内容:\n{image_text}\n\n"
                "请返回 JSON 格式:\n"
                '{"title": "日记标题", "content": "日记正文（含 #话题标签）"}'
            ),
        },
    ]
    raw = client.chat(msgs, temperature=0.8, max_tokens=2000)
    raw_content = raw.content or ""
    result = _parse_json(raw_content)
    result["raw"] = raw_content
    return result


def _polish_content(draft: dict[str, Any], style: str) -> dict[str, Any]:
    """润色日记（模块级可复用，MemoryAgent 也调用此函数）。"""
    if not llm_available():
        content = draft.get("content", "")
        tags = _extract_tags(content)
        return {"title": draft.get("title", ""), "content": content, "tags": tags}

    client = get_llm()
    assert client is not None

    content = draft.get("content", draft.get("raw", ""))
    msgs = [
        {"role": "system", "content": "你是资深旅行编辑，擅长文字润色和话题策划。只返回 JSON。"},
        {
            "role": "user",
            "content": (
                f"请润色以下旅行日记（{style}风格），保持原有风格，修正语句不通顺的地方，"
                "为内容添加 3-5 个合适的话题标签：\n\n"
                f"标题: {draft.get('title', '')}\n"
                f"正文:\n{content}\n\n"
                "返回 JSON:\n"
                '{"title": "最终标题", "content": "润色后正文", "tags": ["标签1", "标签2"]}'
            ),
        },
    ]
    raw = client.chat(msgs, temperature=0.6, max_tokens=2000)
    result = _parse_json(raw.content or "")
    if not result.get("content"):
        result["content"] = content
        result["title"] = result.get("title", draft.get("title", ""))
        result["tags"] = _extract_tags(content)
    return result
