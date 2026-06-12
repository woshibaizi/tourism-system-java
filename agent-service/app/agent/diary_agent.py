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
        style_profile = context.metadata.get("style_profile")  # 可选的结构化风格参数

        task_db.create_task(task_id, context.user_id, "diary")
        task_db.update_task(task_id, status="running", progress=0, message="任务已创建，等待执行...")

        # 在后台运行异步任务
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(self._execute_task(
                    task_id, context.user_id, message, images, style, style_profile,
                ))
            else:
                loop.run_until_complete(self._execute_task(
                    task_id, context.user_id, message, images, style, style_profile,
                ))
        except RuntimeError:
            # 无运行中的事件循环时，在新线程中运行
            import threading
            t = threading.Thread(
                target=lambda: asyncio.run(self._execute_task(
                    task_id, context.user_id, message, images, style, style_profile,
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
        style_profile: dict[str, Any] | None = None,
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
            draft = self._generate_draft(prompt, image_descriptions, elements, style, style_profile, user_id)

            task_db.update_task(task_id, status="running", progress=80, message="正文撰写完成，正在润色定稿...")

            # 阶段 4: 润色定稿 (80-95%)
            final = self._polish(draft, style, style_profile)

            task_db.update_task(task_id, status="running", progress=95, message="润色完成，正在保存日记...")

            # 阶段 5: 持久化到数据库 (95-100%)
            diary_result = self._save_diary(user_id, final, images)

            # 保存用户风格偏好（用于下次回显）
            if style_profile:
                try:
                    task_db.set_preference(user_id, "last_style_profile", style_profile)
                except Exception:
                    pass  # 偏好保存失败不影响主流程

            task_db.update_task(
                task_id, status="completed", progress=100,
                message="日记生成完成！",
                result={
                    "title": final.get("title", ""),
                    "content": final.get("content", ""),
                    "tags": final.get("tags", []),
                    "images": images,
                    "diary_id": diary_result.get("id", ""),
                    # 存储中间结果，供 regenerate 复用
                    "_intermediate": {
                        "image_descriptions": image_descriptions,
                        "elements": elements,
                        "prompt": prompt,
                        "style": style,
                        "style_profile": style_profile,
                    },
                },
            )
        except Exception as e:
            logger.exception("日记生成任务 %s 失败", task_id)
            task_db.update_task(task_id, status="failed", progress=0, message="生成失败", error=str(e))

    def regenerate(
        self, user_id: str, original_task_id: str,
        style: str, style_profile: dict[str, Any] | None = None,
    ) -> AgentResponse:
        """换风格重新生成：复用已有图片分析和要素提取，直接从阶段 3 开始。

        返回新的 task_id，前端轮询新任务的进度。
        """
        orig = task_db.get_task(original_task_id)
        if orig is None:
            return AgentResponse(
                content="原始任务不存在，请重新发起生成",
                intent="generate_diary",
                suggestions=["重新生成日记"],
                tools_used=["diary_agent"],
            )

        orig_result = orig.get("result", {}) or {}
        intermediate = orig_result.get("_intermediate", {})
        if not intermediate:
            # 降级：没有中间数据，用原始参数重新走全流程
            prompt = orig_result.get("title", "") or orig.get("message", "")
            images = orig_result.get("images", [])
            image_descriptions = []
            elements = {"place": "未知地点", "activity": "旅行", "mood": "愉快", "highlights": []}
        else:
            prompt = intermediate.get("prompt", "")
            images = orig_result.get("images", [])
            image_descriptions = intermediate.get("image_descriptions", [])
            elements = intermediate.get("elements", {"place": "未知地点", "activity": "旅行", "mood": "愉快", "highlights": []})

        task_id = f"diary_{uuid.uuid4().hex[:12]}"
        task_db.create_task(task_id, user_id, "diary")
        task_db.update_task(task_id, status="running", progress=0, message="换风格重新生成中...")

        async def _run():
            try:
                task_db.update_task(task_id, status="running", progress=40, message="正在用新风格撰写...")
                draft = self._generate_draft(prompt, image_descriptions, elements, style, style_profile, user_id)

                task_db.update_task(task_id, status="running", progress=70, message="正在润色定稿...")
                final = self._polish(draft, style, style_profile)

                task_db.update_task(task_id, status="running", progress=90, message="正在保存...")
                diary_result = self._save_diary(user_id, final, images)

                if style_profile:
                    try:
                        task_db.set_preference(user_id, "last_style_profile", style_profile)
                    except Exception:
                        pass

                task_db.update_task(
                    task_id, status="completed", progress=100,
                    message="日记重新生成完成！",
                    result={
                        "title": final.get("title", ""),
                        "content": final.get("content", ""),
                        "tags": final.get("tags", []),
                        "images": images,
                        "diary_id": diary_result.get("id", ""),
                        "original_task_id": original_task_id,
                        "_intermediate": {
                            "image_descriptions": image_descriptions,
                            "elements": elements,
                            "prompt": prompt,
                            "style": style,
                            "style_profile": style_profile,
                        },
                    },
                )
            except Exception as e:
                logger.exception("日记重新生成任务 %s 失败", task_id)
                task_db.update_task(task_id, status="failed", progress=0, message="重新生成失败", error=str(e))

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(_run())
            else:
                loop.run_until_complete(_run())
        except RuntimeError:
            import threading
            t = threading.Thread(target=lambda: asyncio.run(_run()), daemon=True)
            t.start()

        return AgentResponse(
            content=f"收到！正在用新风格重新生成你的旅行日记...\n\n任务 ID: {task_id}",
            intent="generate_diary",
            suggestions=["查看进度", "继续聊天"],
            tools_used=["diary_agent"],
            metadata={"task_id": task_id, "original_task_id": original_task_id},
        )

    # ==================== 轻量级 AI 辅助方法 ====================

    def polish_text(self, content: str, style_hint: str | None = None) -> str:
        """AI 润色已有文本——单次 LLM 调用，同步返回。"""
        if not llm_available():
            return content  # 降级：原样返回

        client = get_llm()
        assert client is not None

        hint_text = f"\n风格偏好：{style_hint}" if style_hint else ""
        msgs = [
            {"role": "system", "content": "你是资深旅行编辑，擅长文字润色。保持原意和语气，只修正错别字、不通顺、冗余表达。直接返回润色后的文本，不要加任何说明。"},
            {"role": "user", "content": f"请润色以下旅行笔记：{hint_text}\n\n{content}"},
        ]
        result = client.chat(msgs, temperature=0.4, max_tokens=2000)
        return (result.content or content).strip()

    def suggest_titles(self, content: str, count: int = 3) -> list[str]:
        """AI 根据内容生成标题候选。"""
        if not llm_available():
            return ["旅行日记"]

        client = get_llm()
        assert client is not None

        msgs = [
            {"role": "system", "content": "你是旅行文案高手，擅长起吸引人的标题。只返回 JSON 数组。"},
            {"role": "user", "content": (
                f"根据以下旅行笔记内容，生成 {count} 个吸引人的标题，每个标题 15 字以内。\n\n"
                f"{content[:2000]}\n\n"
                f'返回格式：["标题1", "标题2", "标题3"]'
            )},
        ]
        result = client.chat(msgs, temperature=0.8, max_tokens=200)
        try:
            import json
            raw = (result.content or "[]").strip()
            start = raw.find("[")
            end = raw.rfind("]")
            if start != -1 and end != -1:
                titles = json.loads(raw[start:end + 1])
                return titles[:count] if isinstance(titles, list) else ["旅行日记"]
        except Exception:
            pass
        return ["旅行日记"]

    def extract_tags(self, content: str, count: int = 5) -> list[str]:
        """AI 从内容中提取标签关键词。"""
        if not llm_available():
            # 降级：简单分词提取
            return _extract_tags(content)[:count] if _extract_tags(content) else ["旅行"]

        client = get_llm()
        assert client is not None

        msgs = [
            {"role": "system", "content": "你是内容标签专家。只返回 JSON 数组。"},
            {"role": "user", "content": (
                f"从以下旅行笔记中提取 {count} 个关键词标签（不含#号，每个2-4字）。\n\n"
                f"{content[:2000]}\n\n"
                f'返回格式：["标签1", "标签2", "标签3"]'
            )},
        ]
        result = client.chat(msgs, temperature=0.3, max_tokens=150)
        try:
            import json
            raw = (result.content or "[]").strip()
            start = raw.find("[")
            end = raw.rfind("]")
            if start != -1 and end != -1:
                tags = json.loads(raw[start:end + 1])
                return tags[:count] if isinstance(tags, list) else ["旅行"]
        except Exception:
            pass
        return ["旅行"]

    def describe_images(self, images: list[str]) -> list[str]:
        """AI 图生文——为每张图片生成描述。复用现有图片理解能力。"""
        return self._understand_images(images)

    def generate_from_conversation(
        self,
        user_id: str,
        session_messages: list[dict[str, Any]],
        style: str = "小红书",
        style_profile: dict[str, Any] | None = None,
        user_message: str = "",
        extra_images: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        从对话历史中提取素材并生成游记（对话式生成的核心方法）。

        Args:
            user_id: 用户 ID
            session_messages: 对话历史消息列表 [{"role": "...", "content": "..."}]
            style: 风格名称（如 "小红书"、"朋友圈"）
            style_profile: 结构化风格参数
            user_message: 用户当前消息（触发生成的这句）
            extra_images: 对话中未持久化的图片 URL（当前这条消息中的图片）

        Returns:
            {"title": "...", "content": "...", "tags": [...], "style": "...", "success": bool, "error": "..."}
        """
        if not llm_available():
            # 降级：从对话历史中手动提取关键信息生成简单的日记
            return self._simple_diary_from_chat(session_messages, user_message)

        client = get_llm()
        assert client is not None

        # Step 1: 从对话历史中提取素材
        conversation_text = "\n".join(
            f"{'用户' if m.get('role') == 'user' else 'AI'}: {m.get('content', '')[:300]}"
            for m in session_messages[-20:]  # 最近 20 条消息
        )

        from app.agent.prompts import DIARY_MATERIAL_EXTRACT_PROMPT
        extract_msgs = [
            {"role": "system", "content": DIARY_MATERIAL_EXTRACT_PROMPT},
            {"role": "user", "content": f"对话历史：\n{conversation_text}\n\n用户当前消息: {user_message}"},
        ]
        extract_result = client.chat(extract_msgs, temperature=0.3, max_tokens=500)
        material = _parse_json(extract_result.content or "")

        if not material.get("has_enough_material", True):
            missing = material.get("missing_info", ["更多旅行细节"])
            return {
                "title": "", "content": "", "tags": [],
                "success": False,
                "error": f"素材不足，需要补充：{'、'.join(missing)}",
                "material": material,
            }

        # Step 2: 构建 prompt（对话内容 → 日记素材）
        locations = "、".join(material.get("locations", [])) or "未知地点"
        foods = "、".join(material.get("foods", [])) or "无"
        feelings = "、".join(material.get("feelings", ["愉快"]))
        highlights = "、".join(material.get("highlights", material.get("activities", [])))
        time_ctx = material.get("time_context", "今天")
        companions = "、".join(material.get("companions", [])) or "独自"
        photo_text = "\n".join(f"- {d}" for d in material.get("photos_described", []))

        suggested_style = material.get("suggested_style", style)

        # Step 3: 生成正文
        elements = {
            "place": locations,
            "activity": highlights or "旅行",
            "mood": feelings,
            "highlights": material.get("highlights", material.get("activities", [])),
            "foods": material.get("foods", []),
        }

        prompt_text = (
            f"{time_ctx}去了{locations}，吃了{foods}，"
            f"感觉{feelings}。亮点：{highlights}。和{companions}一起。"
            f"用户补充：{user_message}"
        )

        draft = _generate_draft_content(
            prompt_text,
            [photo_text] if photo_text else [],
            elements,
            suggested_style,
            style_profile,
            user_id,
        )

        # Step 4: 润色
        polished = _polish_content(draft, suggested_style, style_profile)

        return {
            "title": polished.get("title", draft.get("title", f"{locations}游记")),
            "content": polished.get("content", draft.get("content", "")),
            "tags": polished.get("tags", []),
            "style": suggested_style,
            "success": True,
            "material": material,
        }

    def _simple_diary_from_chat(
        self, session_messages: list[dict[str, Any]], user_message: str,
    ) -> dict[str, Any]:
        """LLM 不可用时，从对话历史中简单提取信息生成日记。"""
        locations = []
        for m in session_messages:
            if m.get("role") == "user":
                content = m.get("content", "")
                for kw in ["去了", "在", "参观", "游览", "吃了", "拍了"]:
                    if kw in content:
                        idx = content.index(kw)
                        snippet = content[idx:idx + 20].strip()
                        if snippet and snippet not in locations:
                            locations.append(snippet)

        place_text = "、".join(locations[:5]) or "旅行途中"
        content = f"今天去了{place_text}，度过了一段美好的时光。{user_message}"
        return {
            "title": f"{place_text}游记",
            "content": content,
            "tags": ["旅行"],
            "style": "小红书",
            "success": True,
        }

    def publish_diary(
        self,
        user_id: str,
        title: str,
        content: str,
        images: list[str] | None = None,
        tags: list[str] | None = None,
        place_id: str = "",
        style: str = "小红书",
    ) -> dict[str, Any]:
        """
        一键发布：将对话中生成的游记保存到 Java 后端。

        Returns:
            {"diary_id": "...", "success": bool, "error": "..."}
        """
        import concurrent.futures

        def _do_create():
            return tourism_api_client.create_diary(
                title=title,
                content=content,
                user_id=user_id,
                images=images or [],
                tags=tags or [],
                place_id=place_id,
            )

        try:
            # 用线程池 + 超时包装 urllib 调用，防止 Windows 上 urlopen 超时不生效
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(_do_create)
                result = future.result(timeout=8)  # 8 秒兜底超时
        except concurrent.futures.TimeoutError:
            logger.error("一键发布超时: Java 后端 /api/diaries 无响应")
            return {"diary_id": "", "success": False, "error": "后端服务无响应，请稍后重试"}
        except Exception as e:
            logger.exception("一键发布失败")
            return {"diary_id": "", "success": False, "error": str(e)[:200]}

        if result and result.get("code") == 200:
            diary_data = result.get("data", {})
            return {
                "diary_id": diary_data.get("id", ""),
                "success": True,
                "title": title,
            }
        else:
            return {
                "diary_id": "",
                "success": False,
                "error": (result or {}).get("message", "保存失败"),
            }

    # ==================== 内部方法 ====================

    def _understand_images(self, images: list[str]) -> list[str]:
        """调用多模态视觉模型识别图片内容（使用 ModelRouter 路由到 Qwen VL）。"""
        if not images:
            return []

        from app.core.model_router import model_router

        if not model_router.vision_available():
            logger.warning("视觉模型不可用，图片理解跳过")
            return [f"[图片 {i+1}]（视觉模型未配置，请手动描述图片内容）" for i in range(len(images))]

        from app.agent.llm_client import build_vision_content

        descriptions: list[str] = []
        client = model_router.vision_client
        assert client is not None

        for i, img_url in enumerate(images):
            try:
                msgs = [
                    {
                        "role": "system",
                        "content": (
                            "你是一位旅行摄影师和地理专家，擅长从照片中识别景点、"
                            "建筑、美食和活动场景。请尽可能识别出具体地点名称。"
                            "如果认出知名景点/建筑/美食，请直接说出名称。"
                        ),
                    },
                    {
                        "role": "user",
                        "content": build_vision_content(
                            "请详细描述这张旅行照片的内容，包括：\n"
                            "1. 拍摄地点/场景（如能识别具体地点请明确指出）\n"
                            "2. 画面中的主要事物（建筑、自然景观、食物、人物活动等）\n"
                            "3. 画面传达的氛围和情绪\n"
                            "4. 如果是知名景点/建筑/美食，请直接说出名称",
                            [img_url],
                        ),
                    },
                ]
                result = client.chat(msgs, max_tokens=500)
                descriptions.append(result.content or "")
                logger.info("图片 %d/%d 识别完成: %s...", i + 1, len(images),
                           (result.content or "")[:80])
            except Exception as e:
                logger.warning("图片 %s 识别失败: %s", img_url, e)
                descriptions.append(f"[图片 {i+1}] 识别失败: {str(e)[:100]}")

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
        self, prompt: str, image_descs: list[str], elements: dict[str, Any],
        style: str, style_profile: dict[str, Any] | None = None,
        user_id: str = "anonymous",
    ) -> dict[str, Any]:
        return _generate_draft_content(prompt, image_descs, elements, style, style_profile, user_id)

    def _polish(
        self, draft: dict[str, Any], style: str,
        style_profile: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return _polish_content(draft, style, style_profile)

    def _save_diary(self, user_id: str, diary: dict[str, Any], images: list[str]) -> dict[str, Any]:
        """通过 Java 后端保存日记到数据库。返回后端 API 响应体中的 data 字段。"""
        try:
            result = tourism_api_client.create_diary(
                title=diary.get("title", "旅行日记"),
                content=diary.get("content", ""),
                user_id=user_id,
                images=images,
                tags=diary.get("tags", []),
            )
            # Java 后端返回 {code: 200, message: "success", data: {id: "diary_001", ...}}
            data = (result or {}).get("data", {})
            return data if isinstance(data, dict) else {}
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


def _load_buddy_personality(user_id: str) -> str | None:
    """加载用户当前偏好的出游搭子人格 prompt，供日记生成复用。"""
    try:
        from app.db.sqlite_store import buddy_db
        buddies = buddy_db.list_buddies(user_id)
        # 找偏好分数最高的搭子
        if buddies:
            best = max(buddies, key=lambda b: b.get("preference_score", 0))
            if best.get("personality"):
                name = best.get("name", "旅行搭子")
                personality = best.get("personality", "")
                speaking = best.get("speaking_style", "")
                return (
                    f"你是{name}，一位个性鲜明的旅行伙伴。\n"
                    f"性格设定：{personality}\n"
                    f"说话风格：{speaking or '自然随意'}\n"
                    "请用你独特的视角和语气来写这篇旅行日记。"
                )
    except Exception:
        pass
    # fallback：尝试预设搭子
    try:
        from app.agent.prompts import BUDDY_PRESETS, DEFAULT_BUDDY_ID
        preset = BUDDY_PRESETS.get(DEFAULT_BUDDY_ID)
        if preset:
            return (
                f"你是{preset['name']}，一位个性鲜明的旅行伙伴。\n"
                f"{preset['prompt']}\n"
                "请用你独特的视角和语气来写这篇旅行日记。"
            )
    except Exception:
        pass
    return None


# ==================== 风格 Prompt 构建器 ====================

# 预设风格 → StyleProfile 默认值映射
PRESET_DEFAULTS: dict[str, dict[str, Any]] = {
    "小红书": {
        "tone": "活泼", "length": "medium", "emoji_density": "high",
        "paragraph_style": "short", "person": "first",
        "focus_on": ["打卡", "美食", "风景"], "hashtag_count": 8,
    },
    "朋友圈": {
        "tone": "随性", "length": "short", "emoji_density": "medium",
        "paragraph_style": "short", "person": "first",
        "focus_on": ["打卡", "风景"], "hashtag_count": 0,
    },
    "游记": {
        "tone": "文艺", "length": "long", "emoji_density": "low",
        "paragraph_style": "flow", "person": "first",
        "focus_on": ["风景", "人文", "美食"], "hashtag_count": 3,
    },
    "随笔": {
        "tone": "文艺", "length": "long", "emoji_density": "none",
        "paragraph_style": "flow", "person": "first",
        "focus_on": ["人文", "风景"], "hashtag_count": 0,
    },
    "攻略": {
        "tone": "冷静", "length": "medium", "emoji_density": "low",
        "paragraph_style": "normal", "person": "second",
        "focus_on": ["攻略", "美食", "打卡"], "hashtag_count": 5,
    },
    "回忆": {
        "tone": "温暖", "length": "long", "emoji_density": "low",
        "paragraph_style": "flow", "person": "first",
        "focus_on": ["风景", "人文"], "hashtag_count": 3,
    },
    "幽默吐槽": {
        "tone": "幽默", "length": "medium", "emoji_density": "high",
        "paragraph_style": "short", "person": "first",
        "focus_on": ["美食", "打卡"], "hashtag_count": 5,
    },
}


# camelCase → snake_case 映射（Pydantic alias → Python field name）
_CAMEL_TO_SNAKE: dict[str, str] = {
    "emojiDensity": "emoji_density",
    "paragraphStyle": "paragraph_style",
    "hashtagCount": "hashtag_count",
    "customPrompt": "custom_prompt",
    "useBuddy": "use_buddy",
    "focusOn": "focus_on",
}


def _normalize_profile_keys(raw: dict[str, Any]) -> dict[str, Any]:
    """将前端传来的 camelCase key 统一转为 snake_case，确保后续处理一致。"""
    if not raw:
        return {}
    normalized: dict[str, Any] = {}
    for key, val in raw.items():
        snake = _CAMEL_TO_SNAKE.get(key, key)
        normalized[snake] = val
    return normalized


def _resolve_style_profile(style: str, style_profile: dict[str, Any] | None) -> dict[str, Any]:
    """将 style 字符串 + 可选 style_profile dict 合并为最终风格参数。

    自述模式（有 custom_prompt）→ 不套用任何预设，只返回 custom_prompt。
    调参/预设模式 → 用预设默认值打底，再用显式参数覆盖。
    """
    profile_in = _normalize_profile_keys(style_profile or {})

    # === 自述模式：不加载任何预设默认值 ===
    if profile_in.get("custom_prompt"):
        return {"custom_prompt": profile_in["custom_prompt"]}

    # === 调参/预设模式：预设默认值 + 显式覆盖 ===
    preset = profile_in.get("preset") or style
    defaults = PRESET_DEFAULTS.get(preset, PRESET_DEFAULTS["小红书"])

    profile = dict(defaults)
    for key in ("tone", "length", "emoji_density", "paragraph_style", "person", "hashtag_count", "use_buddy"):
        val = profile_in.get(key)
        if val is not None:
            profile[key] = val
    focus_val = profile_in.get("focus_on")
    if focus_val is not None and len(focus_val) > 0:
        profile["focus_on"] = focus_val

    return profile


def build_style_prompt(
    style: str, style_profile: dict[str, Any] | None = None,
    user_id: str = "anonymous",
) -> str:
    """根据 StyleProfile 构建 system prompt。

    自述模式 → custom_prompt 直接作为风格指令。
    搭子模式 → 加载搭子人格。
    预设/调参 → 结构化组装风格指令。
    """
    profile = _resolve_style_profile(style, style_profile)

    # use_buddy
    if profile.get("use_buddy"):
        buddy_personality = _load_buddy_personality(user_id)
        if buddy_personality:
            return (
                f"{buddy_personality}\n\n"
                "请用以上人格风格，根据用户提供的素材写一篇旅行日记。"
            )

    # custom_prompt —— 直接作为风格指令，不加任何限制
    custom = profile.get("custom_prompt")
    if custom:
        return (
            "你是一位风格多变的创意写手。\n\n"
            f"请严格按照以下风格描述来撰写一篇旅行日记：\n\n"
            f"「{custom}」\n\n"
            "注意：完全融入上述风格的语气、句式、节奏和用词习惯。"
            "不要套用任何默认模板。"
        )

    tone_guide: dict[str, str] = {
        "活泼": "语气轻松活泼，像在跟好朋友兴奋地分享旅行见闻。多用感叹号和语气词。",
        "文艺": "语气文艺细腻，注重画面感和情绪描写，像一篇精致的散文。",
        "幽默": "语气幽默风趣，可以自嘲、可以夸张，让读者会心一笑。",
        "毒舌": "语气犀利直接，看不惯的就说，但吐槽背后是真诚的推荐。",
        "温暖": "语气温暖治愈，像午后阳光一样让人感到舒适和安心。",
        "冷静": "语气客观理性，像一位专业旅行编辑在整理实用信息。",
        "热血": "语气充满激情和能量，像一位冒险家在讲述自己的壮举。",
        "随性": "语气随意自然，不刻意修饰，就像随手发的一条朋友圈。",
    }

    length_guide: dict[str, str] = {
        "short": "篇幅控制在 150 字左右，精炼有力，适合快速阅读。",
        "medium": "篇幅控制在 400 字左右，有足够的细节但不冗长。",
        "long": "篇幅控制在 800 字左右，充分展开叙述，有起承转合。",
    }

    emoji_guide: dict[str, str] = {
        "none": "不使用任何 emoji 表情。",
        "low": "偶尔使用 1-2 个 emoji 点缀。",
        "medium": "适度使用 emoji 增强表达，每段 1-2 个。",
        "high": "大量使用 emoji，几乎每句话都有表情点缀。",
    }

    person_guide: dict[str, str] = {
        "first": "以第一人称'我'的视角叙述，讲述自己的亲身经历和感受。",
        "second": "以第二人称'你'的视角叙述，像是在给读者做推荐和引导。",
        "third": "以第三人称视角客观描述，像是一篇旅行报道。",
    }

    focus_guide: dict[str, str] = {
        "风景": "重点描写自然/建筑景观的视觉体验和拍照角度。",
        "美食": "重点描写食物的味道、口感和用餐体验。",
        "人文": "重点描写当地文化、历史和人物故事。",
        "打卡": "重点标注打卡点和拍照机位，适合社交媒体分享。",
        "攻略": "重点提供实用信息：时间安排、路线建议、消费参考、避坑提示。",
    }

    # 组装 prompt
    parts: list[str] = ["你是一位专业的旅行文案写手。请根据以下素材写一篇旅行日记。"]

    tone = profile.get("tone", "活泼")
    if tone in tone_guide:
        parts.append(tone_guide[tone])

    length = profile.get("length", "medium")
    if length in length_guide:
        parts.append(length_guide[length])

    emoji = profile.get("emoji_density", "medium")
    if emoji in emoji_guide:
        parts.append(emoji_guide[emoji])

    person = profile.get("person", "first")
    if person in person_guide:
        parts.append(person_guide[person])

    focuses = profile.get("focus_on", ["风景", "美食"])
    parts.append("内容侧重：" + "；".join(focus_guide.get(f, f) for f in focuses))

    hashtag_count = profile.get("hashtag_count", 5)
    if hashtag_count > 0:
        parts.append(f"文末添加 {hashtag_count} 个 #话题标签。")
    else:
        parts.append("不需要添加话题标签。")

    para_style = profile.get("paragraph_style", "short")
    if para_style == "short":
        parts.append("使用短句分段，每段不超过 3 行。")
    elif para_style == "flow":
        parts.append("使用流畅的段落叙事，每段是一个完整的场景描述。")

    return "\n".join(parts)


def _generate_draft_content(
    prompt: str, image_descs: list[str], elements: dict[str, Any],
    style: str, style_profile: dict[str, Any] | None = None,
    user_id: str = "anonymous",
) -> dict[str, Any]:
    """基于要素生成日记正文（模块级可复用，MemoryAgent 也调用此函数）。

    Args:
        style: 风格名称字符串（如"小红书"），用于向后兼容
        style_profile: 结构化风格参数（可选，优先于 style 的简单描述）
        user_id: 用户 ID，用于加载搭子人格
    """
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

    # 使用结构化 prompt 构建器（含 buddy 支持）
    system_prompt = build_style_prompt(style, style_profile, user_id)

    # 解析 profile 以决定 user message 的格式要求
    profile = _resolve_style_profile(style, style_profile)
    is_custom = bool(profile.get("custom_prompt"))
    hashtag_count = profile.get("hashtag_count", 5)

    image_text = "\n".join(f"- {d}" for d in image_descs) if image_descs else "无图片"

    # 根据风格模式动态构造 user message
    if is_custom:
        user_content = (
            f"请根据以下素材写一篇旅行日记：\n\n"
            f"用户的话: {prompt}\n"
            f"地点: {elements.get('place', '未知')}\n"
            f"活动: {elements.get('activity', '旅行')}\n"
            f"图片内容:\n{image_text}\n\n"
            "请返回 JSON 格式:\n"
            '{"title": "日记标题", "content": "日记正文"}'
        )
    else:
        hashtag_hint = "（含 #话题标签）" if hashtag_count > 0 else ""
        user_content = (
            f"请根据以下素材生成一篇旅行日记：\n\n"
            f"用户的话: {prompt}\n"
            f"地点: {elements.get('place', '未知')}\n"
            f"活动: {elements.get('activity', '旅行')}\n"
            f"心情: {elements.get('mood', '愉快')}\n"
            f"亮点: {', '.join(elements.get('highlights', []))}\n"
            f"图片内容:\n{image_text}\n\n"
            "请返回 JSON 格式:\n"
            f'{{"title": "日记标题", "content": "日记正文{hashtag_hint}"}}'
        )

    msgs = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]
    raw = client.chat(msgs, temperature=0.8, max_tokens=2000)
    raw_content = raw.content or ""
    result = _parse_json(raw_content)
    result["raw"] = raw_content
    return result


def _polish_content(
    draft: dict[str, Any], style: str,
    style_profile: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """润色日记（模块级可复用，MemoryAgent 也调用此函数）。"""
    if not llm_available():
        content = draft.get("content", "")
        tags = _extract_tags(content)
        return {"title": draft.get("title", ""), "content": content, "tags": tags}

    client = get_llm()
    assert client is not None

    profile = _resolve_style_profile(style, style_profile)
    is_custom = bool(profile.get("custom_prompt"))
    hashtag_count = profile.get("hashtag_count", 5)

    content = draft.get("content", draft.get("raw", ""))

    # 根据风格模式动态构造润色指令
    if is_custom:
        polish_instruction = (
            f"请润色以下旅行日记，保持原有的风格和语气，只修正语句不通顺和错别字，"
            f"不要添加话题标签，不要改变文风：\n\n"
        )
        output_format = '{"title": "最终标题", "content": "润色后正文", "tags": []}'
    elif hashtag_count > 0:
        polish_instruction = (
            f"请润色以下旅行日记，保持原有风格，修正语句不通顺的地方，"
            f"为内容添加 {hashtag_count} 个合适的话题标签：\n\n"
        )
        output_format = '{"title": "最终标题", "content": "润色后正文", "tags": ["标签1", "标签2"]}'
    else:
        polish_instruction = (
            f"请润色以下旅行日记，保持原有风格，修正语句不通顺的地方，"
            f"不需要添加话题标签：\n\n"
        )
        output_format = '{"title": "最终标题", "content": "润色后正文", "tags": []}'

    msgs = [
        {"role": "system", "content": "你是资深旅行编辑，擅长文字润色。只返回 JSON。"},
        {
            "role": "user",
            "content": (
                f"{polish_instruction}"
                f"标题: {draft.get('title', '')}\n"
                f"正文:\n{content}\n\n"
                "返回 JSON:\n"
                f"{output_format}"
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
