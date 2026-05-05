"""
日记生成 Agent — 独立子 Agent，异步执行多阶段日记生成。

流程：
1. 图片理解（如果有图片 → 用多模态 LLM 识别内容）
2. 要素提取（从用户文本 + 图片识别结果中提取地点/活动/心情）
3. 正文撰写（基于要素 + 风格偏好生成日记正文）
4. 润色定稿（检查文字流畅度，添加话题标签）
5. 持久化到业务数据库（通过 tourism_api 调用 Java 后端）
"""

from __future__ import annotations

import logging
import threading
import uuid
from dataclasses import dataclass, field
from typing import Any

from app.agent.base_agent import AgentContext, AgentResponse, BaseAgent
from app.agent.prompts import DIARY_GENERATE_PROMPT
from app.tools.tourism_api import tourism_api_client

logger = logging.getLogger(__name__)

# 日记生成任务状态
_TASK_STATUS: dict[str, DiaryTask] = {}
_TASK_LOCK = threading.Lock()


@dataclass
class DiaryTask:
    task_id: str
    user_id: str
    status: str  # pending / running / completed / failed
    progress: int
    message: str
    result: dict[str, Any] | None = None
    error: str | None = None
    images: list[str] = field(default_factory=list)
    prompt: str = ""
    style: str = "小红书"


class DiaryAgent(BaseAgent):
    """独立日记生成 Agent，异步执行。"""

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

        task = DiaryTask(
            task_id=task_id,
            user_id=context.user_id,
            status="pending",
            progress=0,
            message="任务已创建，等待执行...",
            images=images,
            prompt=message,
            style=context.metadata.get("style", "小红书"),
        )

        with _TASK_LOCK:
            _TASK_STATUS[task_id] = task

        # 在后台线程执行
        thread = threading.Thread(
            target=self._execute_task,
            args=(task_id,),
            daemon=True,
        )
        thread.start()

        return AgentResponse(
            content=f"收到！我正在为你生成旅行日记...\n\n任务 ID: {task_id}\n当前进度: 0%",
            intent="generate_diary",
            suggestions=["查看日记进度", "继续聊天"],
            tools_used=["diary_agent"],
            metadata={"task_id": task_id},
        )

    def _execute_task(self, task_id: str) -> None:
        """后台执行日记生成流水线。"""
        with _TASK_LOCK:
            task = _TASK_STATUS.get(task_id)
        if task is None:
            return

        try:
            # 阶段 1: 图片理解 (0-30%)
            self._update_task(task_id, "running", 5, "正在分析图片内容...")
            image_descriptions = self._understand_images(task.images)

            self._update_task(task_id, "running", 30, "图片分析完成，正在提取关键要素...")

            # 阶段 2: 要素提取 (30-50%)
            elements = self._extract_elements(task.prompt, image_descriptions)

            self._update_task(task_id, "running", 50, "要素提取完成，正在撰写日记正文...")

            # 阶段 3: 正文撰写 (50-80%)
            draft = self._generate_draft(task.prompt, image_descriptions, elements, task.style)

            self._update_task(task_id, "running", 80, "正文撰写完成，正在润色定稿...")

            # 阶段 4: 润色定稿 (80-95%)
            final = self._polish(draft, task.style)

            self._update_task(task_id, "running", 95, "润色完成，正在保存日记...")

            # 阶段 5: 持久化到数据库 (95-100%)
            # 尝试通过 Java 后端保存日记
            diary_result = self._save_diary(task.user_id, final, task.images)

            self._update_task(
                task_id, "completed", 100,
                "日记生成完成！",
                result={
                    "title": final.get("title", ""),
                    "content": final.get("content", ""),
                    "tags": final.get("tags", []),
                    "images": task.images,
                    "diary_id": diary_result.get("id", ""),
                },
            )
        except Exception as e:
            logger.exception("日记生成任务 %s 失败", task_id)
            self._update_task(task_id, "failed", 0, "生成失败", error=str(e))

    def _understand_images(self, images: list[str]) -> list[str]:
        """调用多模态 LLM 识别图片内容。"""
        if not images:
            return []

        if not _llm_available():
            return [f"[图片 {i+1}]（LLM 不可用，请手动描述图片内容）" for i in range(len(images))]

        descriptions: list[str] = []
        client = _get_llm()
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
                        "content": (
                            "请详细描述这张旅行照片的内容，包括：\n"
                            "1. 拍摄地点/场景\n"
                            "2. 画面中的主要事物（建筑、自然景观、食物、人物活动等）\n"
                            "3. 画面传达的氛围和情绪\n"
                            f"图片URL: {img_url}"
                        ),
                    },
                ]
                desc = client.chat(msgs, max_tokens=500)
                descriptions.append(desc)
            except Exception as e:
                logger.warning("图片 %s 识别失败: %s", img_url, e)
                descriptions.append(f"[图片 {i+1}] 识别失败")

        return descriptions

    def _extract_elements(self, prompt: str, image_descs: list[str]) -> dict[str, Any]:
        """从文本和图片描述中提取结构化要素。"""
        if not _llm_available():
            return {"place": "未知地点", "activity": "旅行", "mood": "愉快", "highlights": []}

        client = _get_llm()
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
        raw = client.chat(msgs, temperature=0.3, max_tokens=500)
        return _parse_json(raw)

    def _generate_draft(
        self, prompt: str, image_descs: list[str], elements: dict[str, Any], style: str
    ) -> dict[str, Any]:
        """基于要素生成日记正文。"""
        if not _llm_available():
            return {
                "title": f"旅行日记 - {elements.get('place', '未知')}",
                "content": (
                    f"今天去了{elements.get('place', '一个很棒的地方')}，"
                    f"体验了{elements.get('activity', '美好的旅行')}，"
                    f"心情很{elements.get('mood', '愉快')}。\n\n{prompt}"
                ),
                "raw": "",
            }

        client = _get_llm()
        assert client is not None

        style_guide = {
            "小红书": "活泼口语化，多用 emoji，短句分段，每段 2-3 行，加上 #话题标签",
            "随笔": "文艺细腻，叙事性强，段落流畅，有画面感和情绪起伏",
            "攻略": "实用条理清晰，分点列出 tips，时间/路线/花费明确",
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
        result = _parse_json(raw)
        result["raw"] = raw
        return result

    def _polish(self, draft: dict[str, Any], style: str) -> dict[str, Any]:
        """润色日记。"""
        if not _llm_available():
            # 从文本中提取 tag
            content = draft.get("content", "")
            tags = _extract_tags(content)
            return {"title": draft.get("title", ""), "content": content, "tags": tags}

        client = _get_llm()
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
        result = _parse_json(raw)
        if not result.get("content"):
            result["content"] = content
            result["title"] = result.get("title", draft.get("title", ""))
            result["tags"] = _extract_tags(content)
        return result

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

    def _update_task(self, task_id: str, status: str, progress: int, message: str, **kwargs: Any) -> None:
        with _TASK_LOCK:
            task = _TASK_STATUS.get(task_id)
            if task:
                task.status = status
                task.progress = progress
                task.message = message
                for k, v in kwargs.items():
                    setattr(task, k, v)


# ==================== 工具函数 ====================


def get_task_status(task_id: str) -> dict[str, Any] | None:
    with _TASK_LOCK:
        task = _TASK_STATUS.get(task_id)
        if task is None:
            return None
        return {
            "task_id": task.task_id,
            "status": task.status,
            "progress": task.progress,
            "message": task.message,
            "result": task.result,
            "error": task.error,
        }


def _parse_json(raw: str) -> dict[str, Any]:
    import json
    import re

    match = re.search(r"\{[^{}]*\}", raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except (json.JSONDecodeError, TypeError):
            pass
    return {}


def _extract_tags(text: str) -> list[str]:
    import re
    tags = re.findall(r"#(\S+)", text)
    return tags[:8] if tags else []


# LLM 客户端延迟加载
_llm_client: Any = None


def _get_llm():
    global _llm_client
    if _llm_client is None:
        try:
            from app.agent.llm_client import llm_client as client
            _llm_client = client
        except ImportError:
            _llm_client = False
    return _llm_client if _llm_client is not False else None


def _llm_available() -> bool:
    from app.config import settings
    client = _get_llm()
    return client is not None and bool(settings.llm_api_key)
