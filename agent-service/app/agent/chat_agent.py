"""
主对话 Agent — 处理路线规划、地点推荐、闲聊。
支持 6 种预设出游搭子 + 用户自定义搭子实时切换。
使用 function calling 闭环：LLM 可主动调用工具获取真实数据。
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from app.agent.base_agent import AgentContext, AgentResponse, BaseAgent
from app.agent.prompts import (
    CONVERSATIONAL_DIARY_PROMPT,
    DIARY_GENERATE_PROMPT,
    REVERSE_RECOMMEND_PROMPT,
    ROUTE_PLAN_PROMPT,
    SYSTEM_PROMPT,
    load_buddy_prompt,
)
from app.core.llm import get_llm, llm_available
from app.tools.registry import registry
from app.tools.tourism_api import tourism_api_client

logger = logging.getLogger(__name__)

_MAX_TOOL_ROUNDS = 3


def _extract_xhs_notes_from_tool_results(tool_results: list[str]) -> list[dict[str, Any]]:
    """从 xiaohongshu_search_notes 工具调用结果中提取结构化笔记数据。

    用于在 SSE done 事件中返回 xhsNotes，供前端 ChatBubble 渲染笔记卡片。
    """
    notes: list[dict[str, Any]] = []
    seen: set[str] = set()
    for result_str in tool_results:
        try:
            data = json.loads(result_str)
            # 外层包装: {"ok": true, "data": "..."}
            inner = data.get("data", data)
            if isinstance(inner, str):
                inner = json.loads(inner)
            for note in inner.get("notes", []):
                nid = note.get("note_id", "")
                if nid and nid not in seen:
                    seen.add(nid)
                    notes.append({
                        "note_id": nid,
                        "title": note.get("title", ""),
                        "cover": note.get("cover", ""),
                        "likes": note.get("likes", 0),
                        "collects": note.get("collects", 0),
                        "comments": note.get("comments", 0),
                        "url": note.get("url", ""),
                        "author": note.get("author", {}),
                        "tags": note.get("tags", []),
                    })
        except (json.JSONDecodeError, TypeError, KeyError):
            continue
    return notes


class ChatAgent(BaseAgent):
    """主对话 Agent，处理日常对话和工具调用。支持出游搭子人格切换。"""

    @property
    def name(self) -> str:
        return "chat"

    @property
    def description(self) -> str:
        return "主对话助手：路线规划、地点推荐、信息查询、闲聊 + 出游搭子"

    def __init__(self) -> None:
        self._register_tools()
        # 记录每个会话已提议游记生成的次数，避免频繁骚扰
        self._diary_proposals: dict[str, int] = {}
        # 待确认风格：session_id → suggested_style（等用户确认后生成）
        self._pending_style_confirm: dict[str, str] = {}
        # 最近生成的游记内容：session_id → diary_content（用于修改检测）
        self._last_diary: dict[str, str] = {}
        # 图片理解缓存：session_id → image_description_text
        # 用于跨轮次保持图片理解结果（第1轮：理解图片+问风格，第2轮：生成日记）
        self._diary_image_descs: dict[str, str] = {}

    def _analyze_diary_potential(
        self, message: str, images: list[str], session_messages: list[dict[str, Any]],
    ) -> str | None:
        """分析对话历史中是否积累了足够的旅行素材，返回主动提议文案或 None。

        检测信号（关键词匹配，无 LLM 调用）：
        - 地点信号：去了/在/到/参观了/逛了 + 地点上下文
        - 美食信号：吃了/喝了/尝了/点了 + 食物
        - 拍照信号：发了图片
        - 感受信号：好看/好吃/值得/太美了/开心/累/人多

        至少命中 2 类信号才提议，避免误触发。
        """
        # 合并近 10 条消息内容 + 当前消息
        combined = message + "\n"
        for m in (session_messages or [])[-10:]:
            combined += m.get("content", "") + "\n"

        signals: dict[str, int] = {}

        # 地点信号
        _loc_kw = ["去了", "到了", "在", "参观了", "逛了", "游览", "去过了"]
        for kw in _loc_kw:
            if kw in combined:
                signals["location"] = signals.get("location", 0) + 1

        # 美食信号
        _food_kw = ["吃了", "喝了", "尝了", "点了一份", "点了", "好吃的", "美食",
                     "餐厅", "食堂", "小吃", "排队", "味道"]
        for kw in _food_kw:
            if kw in combined:
                signals["food"] = signals.get("food", 0) + 1

        # 拍照信号：发了图片
        if images and len(images) > 0:
            signals["photo"] = 2  # 图片是强信号
        # 也检查对话中提到的拍照
        _photo_kw = ["拍了", "拍照", "照片", "合影", "打卡"]
        for kw in _photo_kw:
            if kw in combined:
                signals["photo"] = signals.get("photo", 0) + 1

        # 感受信号
        _feeling_kw = ["好看", "好吃", "值得", "太美了", "漂亮", "开心",
                        "累但", "人多", "壮观", "氛围", "意境", "推荐"]
        for kw in _feeling_kw:
            if kw in combined:
                signals["feeling"] = signals.get("feeling", 0) + 1

        # 排除已明确说"游记""日记""文案""写一篇"的情况（用户已经主动触发了）
        if any(kw in message for kw in ["游记", "日记", "文案", "写一篇", "生成"]):
            return None

        # 至少 2 类信号
        signal_types = len(signals)
        if signal_types < 2:
            return None

        # 构建提议文案
        if signals.get("photo") and signal_types >= 2:
            return "📝 我注意到你分享了旅行照片和见闻，要不要我帮你把这些整理成一篇游记？"
        elif signals.get("location") and signals.get("food") and signal_types >= 2:
            return "😋 你提到了去的地方和吃的美食，想让我帮你写成一篇游记记录下来吗？"
        elif signals.get("location") and signal_types >= 2:
            return "📍 听你分享的旅行经历很有意思，要不要帮你整理成一篇游记？"
        elif signal_types >= 2:
            return "✨ 感觉你今天有不少旅行收获，要我帮你写成游记吗？"

        return None

    def _maybe_append_proposal(
        self, content: str, session_id: str | None, proposal: str | None,
    ) -> str:
        """如果满足条件，在回复末尾追加主动提议。同一会话最多提议 2 次。"""
        if not proposal:
            return content
        sid = session_id or "__no_session__"
        count = self._diary_proposals.get(sid, 0)
        if count >= 2:
            return content  # 已提议 2 次，不再骚扰
        self._diary_proposals[sid] = count + 1
        return content.rstrip() + "\n\n" + proposal

    def _register_tools(self) -> None:
        """ChatAgent 不再注册任何工具 — 搜索/发现工具已迁移至 DiscoverAgent。

        保留此方法作为扩展点：未来如需注册闲聊专用工具（如 emoji 翻译等），在此添加。
        """

    def get_system_prompt(self, context: AgentContext | None = None) -> str:
        """返回该 Agent 的系统提示词，支持出游搭子人格注入。"""
        if context and context.metadata:
            buddy_id = context.metadata.get("buddy_id")
            if buddy_id:
                return load_buddy_prompt(context.user_id, buddy_id)
        return SYSTEM_PROMPT

    def get_tools(self) -> list[dict[str, Any]]:
        """只返回 ChatAgent 作用域的工具 — Agent 作用域隔离。"""
        return registry.get_definitions_for_agent(self.name)

    def can_handle(self, intent: str) -> bool:
        # 搜索/推荐已迁移至 DiscoverAgent，路线规划已迁移至 RouteAgent
        return intent in ("general_chat", "generate_diary")

    def process(self, message: str, context: AgentContext) -> AgentResponse:
        images = context.metadata.get("images", [])
        sid = context.session_id or "__no_session__"

        # === 提议接受检测：AI 刚提议生成游记，用户说"好/可以/行" → 触发风格确认 ===
        _affirm = ["好", "可以", "行", "嗯", "是", "对", "OK", "ok", "Okay", "okay", "yes", "Yes",
                    "好啊", "好的", "好吧", "好呀", "行啊", "行吧", "可", "成", "中", "得", "搞"]
        if self._diary_proposals.get(sid, 0) > 0 and any(kw in message for kw in _affirm) and len(message) < 30:
            # 用户简单肯定 → 直接进入风格确认
            context.metadata["intent"] = "generate_diary"
            self._diary_proposals[sid] = 999  # 标记已处理，避免重复
            if images:
                from app.core.model_router import model_router
                if model_router.vision_available():
                    return self._process_with_images(message, images, context)
            if llm_available():
                return self._process_with_llm(message, context)
            return self._process_with_rules(message, context)

        # === 待确认风格：用户上轮触发日记生成但没选风格，本轮回应风格选择 ===
        if sid in self._pending_style_confirm:
            recommended = self._pending_style_confirm.pop(sid)
            chosen: str | None = None

            # 数字选择："1" / "第1个" / "就第一个" / "第一个"
            for i in range(1, 4):
                if any(s in message for s in [str(i), f"第{i}", f"第 {i}"]):
                    # 从最近的 AgentResponse metadata 中取 options（已丢失上下文，降级为 recommended）
                    chosen = recommended
                    break

            if not chosen:
                chosen = self._extract_style_from_message(message)

            # 用户简单确认 → 用推荐风格
            if not chosen and any(kw in message for kw in ["好", "可以", "行", "嗯", "是", "对", "OK", "ok", "就这个", "就用这个"]):
                chosen = recommended

            # 用户给了自己的描述（非 preset 关键词）→ 直接用用户的原话
            if not chosen:
                # 检测是否包含自定义风格描述的特征（较长或含特定词）
                if len(message) > 3 and not any(kw in message for kw in ["?","？","什么","怎么","哪个","换"]):
                    chosen = message.strip()  # 直接使用用户原话作为 custom_prompt

            # 最终兜底
            if not chosen:
                chosen = recommended

            # 判断是 custom_prompt 还是 preset 名
            preset_names = {"小红书", "朋友圈", "游记", "攻略", "文艺", "幽默", "随笔", "回忆"}
            if chosen in preset_names:
                context.metadata["diary_style"] = chosen
                context.metadata["diary_style_custom"] = ""
            else:
                # 创意风格 → 作为 custom_prompt
                context.metadata["diary_style"] = "自定义"
                context.metadata["diary_style_custom"] = chosen

            context.metadata["intent"] = "generate_diary"
            self._last_diary[sid] = ""
            if images:
                from app.core.model_router import model_router
                if model_router.vision_available():
                    return self._process_with_images(message, images, context)
            if llm_available():
                return self._process_with_llm(message, context)
            return self._process_with_rules(message, context)

        # === 日记修改检测：用户在刚生成的游记上提修改要求 ===
        if self._detect_diary_modification(message, sid) and self._last_diary.get(sid):
            return self._handle_diary_modification(message, context)

        if images:
            # 有图片：使用视觉模型处理
            from app.core.model_router import model_router
            if model_router.vision_available():
                return self._process_with_images(message, images, context)
            else:
                return AgentResponse(
                    content="你发送了图片，但图片理解功能暂未启用。请尝试用文字描述你的问题。",
                    intent="general_chat",
                    suggestions=["继续文字聊天", "生成游记"],
                    tools_used=["vision_unavailable"],
                )
        if llm_available():
            return self._process_with_llm(message, context)
        return self._process_with_rules(message, context)

    def _process_with_llm(self, message: str, context: AgentContext) -> AgentResponse:
        client = get_llm()
        assert client is not None

        sid = context.session_id or "__no_session__"

        # 搭子人格注入
        system = self.get_system_prompt(context)
        intent = context.metadata.get("intent", self._detect_intent_from_message(message))

        # 主动提议检测：分析对话中是否有游记素材（在非 generate_diary 意图时检测）
        _diary_proposal: str | None = None
        if intent != "generate_diary":
            _diary_proposal = self._analyze_diary_potential(
                message,
                context.metadata.get("images", []),
                context.session_messages,
            )

        # === 风格确认：优先使用用户明确指定的风格，否则 AI 推荐创意风格 ===
        if intent == "generate_diary":
            explicit_style = self._extract_style_from_message(message)
            override_style = context.metadata.get("diary_style")
            # 关键词匹配可能误判：用户说 "帮我写游记" 时，"游记" 被当成风格选择
            # 实际意图是请求生成日记而非指定风格 → 检查是否为日记请求而非风格选择
            if explicit_style and not override_style:
                _diary_req = any(p in message for p in
                    ["帮我写", "帮我生成", "写一篇", "写个", "来一篇",
                     "写游记", "写日记", "生成游记", "生成日记", "写攻略"])
                _style_spec = any(
                    f"{kw}风格" in message or f"{kw}风" in message
                    for kw in self._STYLE_KEYWORDS
                )
                if _diary_req and not _style_spec:
                    explicit_style = None
            if explicit_style or override_style:
                # 用户已指定风格，记录并直接生成
                context.metadata["diary_style"] = explicit_style or override_style
            else:
                # 未指定风格 → 分析对话上下文和图片，推荐 3 个创意风格
                styles = self._suggest_creative_style(message, context.session_messages)
                self._pending_style_confirm[sid] = styles["recommended"]
                options_list = [styles["recommended"]] + styles.get("options", [])
                options_text = "\n".join(f"{i+1}. {opt}" for i, opt in enumerate(options_list[:3]))
                return AgentResponse(
                    content=(
                        f"分析你的照片和对话感受，推荐这几种风格：\n\n"
                        f"{options_text}\n\n"
                        f"想要哪种？回复数字或者直接告诉我你想要的感觉～"
                    ),
                    intent="generate_diary",
                    suggestions=options_list[:3],
                    tools_used=["style_recommend"],
                    metadata={"style_options": options_list[:3]},
                )
        sys_prompt = {
            "plan_trip_route": ROUTE_PLAN_PROMPT,
            "generate_diary": CONVERSATIONAL_DIARY_PROMPT,
            "reverse_recommend": REVERSE_RECOMMEND_PROMPT,
        }.get(intent, system)

        # 注入图片理解结果，供 LLM 在游记中融入照片细节
        if intent == "generate_diary":
            image_descs = self._diary_image_descs.pop(
                context.session_id or "__no_session__", ""
            )
            if image_descs:
                sys_prompt += (
                    f"\n\n【用户旅行照片描述】\n{image_descs}\n\n"
                    "请在游记中自然地融入这些照片中的场景和细节，让读者有身临其境的感觉。"
                )

        # 如果有自定义创意风格，追加到 system prompt
        custom_style = context.metadata.get("diary_style_custom", "")
        if custom_style and intent == "generate_diary":
            sys_prompt += (
                "\n\n【重要风格指令】请严格按照以下风格描述来撰写这篇游记：\n\n"
                f"「{custom_style}」\n\n"
                "完全融入上述风格的语气、句式、节奏和用词习惯。不要套用任何默认模板。"
            )

        msgs: list[dict[str, Any]] = [{"role": "system", "content": sys_prompt}]
        for m in context.session_messages[-6:]:
            msgs.append({"role": m.get("role", "user"), "content": m.get("content", "")})

        msgs.append({"role": "user", "content": message})

        tools = self.get_tools()  # Agent 作用域隔离
        # P2: Intent-Capability 映射 — conversational 意图不携带 tools，防止 LLM 幻觉工具调用
        from app.core.intent import intent_requires_tools
        if not intent_requires_tools(intent):
            logger.info("ChatAgent: Intent '%s' 为 conversational 类型，不携带 tools", intent)
            tools = []
        tools_used: list[str] = []
        tool_latencies: list[dict[str, Any]] = []
        xhs_results_raw: list[str] = []  # 收集 XHS 工具调用结果

        # 多轮 tool calling 循环 (ReAct 模式，max 3 轮)
        for round_num in range(_MAX_TOOL_ROUNDS):
            result = client.chat(msgs, tools=tools if tools else None)

            if result.tool_calls:
                msgs.append({
                    "role": "assistant",
                    "content": result.content or None,
                    "tool_calls": result.tool_calls,
                })

                for tc in result.tool_calls:
                    func = tc["function"]
                    tool_name = func["name"]
                    try:
                        args = json.loads(func["arguments"])
                    except json.JSONDecodeError:
                        args = {}

                    t0 = time.time()
                    tool_result = registry.dispatch(tool_name, args)
                    elapsed_ms = int((time.time() - t0) * 1000)

                    tools_used.append(tool_name)
                    tool_latencies.append({"tool": tool_name, "latency_ms": elapsed_ms})

                    # 收集 XHS 搜索结果用于前端卡片渲染
                    if tool_name == "xiaohongshu_search_notes":
                        xhs_results_raw.append(tool_result)

                    msgs.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": tool_result,
                    })
            else:
                # 对话式游记生成：标记为 diary_card 消息类型
                extra_meta: dict[str, Any] = {}
                if tool_latencies:
                    extra_meta["tool_latencies"] = tool_latencies
                if context.metadata.get("buddy_id"):
                    extra_meta["buddy_id"] = context.metadata["buddy_id"]
                if intent == "generate_diary":
                    used_style = context.metadata.get("diary_style") or self._extract_style_from_message(message) or ""
                    if used_style:
                        extra_meta["diary_card"] = True
                        extra_meta["diary_style"] = used_style
                        # 存储日记内容，用于后续修改检测
                        self._last_diary[context.session_id or "__no_session__"] = result.content or ""

                # 主动提议追加
                final_content = self._maybe_append_proposal(
                    result.content or "",
                    context.session_id,
                    _diary_proposal,
                )

                # 提取 XHS 搜索结果用于前端卡片渲染
                if xhs_results_raw:
                    extra_meta["xhsNotes"] = _extract_xhs_notes_from_tool_results(xhs_results_raw)

                return AgentResponse(
                    content=final_content,
                    intent=intent,
                    suggestions=_extract_highlights(final_content),
                    tools_used=tools_used if tools_used else ["llm"],
                    metadata=extra_meta if extra_meta else {},
                )

        # 超过最大轮次，强制 LLM 生成最终回复
        final_result = client.chat(msgs)
        # 双重保险：inline regex 清理 LLM 残留的 invoke XML / 全角 DSML（防御纵深）
        final_text = final_result.content or ""
        import re as _re2
        if '<invoke' in final_text or '｜' in final_text or '／' in final_text:
            FW = '｜'; FS = '／'
            # Fullwidth DSML (FW{1,2} handles DeepSeek 1-2 bar instability)
            final_text = _re2.sub(r'<' + FW + r'{1,2}DSML' + FW + r'{1,2}tool_calls>.*?' + r'<' + FS + r'{1,2}DSML' + FW + r'{1,2}tool_calls>', '', final_text, flags=_re2.DOTALL)
            final_text = _re2.sub(r'<' + FW + r'{1,2}DSML' + FW + r'{1,2}invoke name="[^"]*">.*?' + r'<' + FS + r'{1,2}DSML' + FW + r'{1,2}invoke>', '', final_text, flags=_re2.DOTALL)
            # ASCII DSML
            final_text = _re2.sub(r'<DSML\s+function_calls>.*?</DSML\s+function_calls>', '', final_text, flags=_re2.DOTALL)
            final_text = _re2.sub(r'<invoke\s+name="[^"]+"\s*>.*?</invoke\s*>', '', final_text, flags=_re2.DOTALL)
            final_text = _re2.sub(r'<parameter\s+[^>]+>.*?</parameter\s*>', '', final_text, flags=_re2.DOTALL).strip()
        extra_meta_final: dict[str, Any] = {}
        if tool_latencies:
            extra_meta_final["tool_latencies"] = tool_latencies
        extra_meta_final["max_rounds_reached"] = True
        if context.metadata.get("buddy_id"):
            extra_meta_final["buddy_id"] = context.metadata["buddy_id"]
        if intent == "generate_diary":
            used_style = context.metadata.get("diary_style") or self._extract_style_from_message(message) or ""
            if used_style:
                extra_meta_final["diary_card"] = True
                extra_meta_final["diary_style"] = used_style
                self._last_diary[context.session_id or "__no_session__"] = final_text

        # 提取 XHS 搜索结果用于前端卡片渲染
        if xhs_results_raw:
            extra_meta_final["xhsNotes"] = _extract_xhs_notes_from_tool_results(xhs_results_raw)

        final_content = self._maybe_append_proposal(
            final_text,
            context.session_id,
            _diary_proposal,
        )

        return AgentResponse(
            content=final_content,
            intent=intent,
            suggestions=_extract_highlights(final_content),
            tools_used=tools_used if tools_used else ["llm"],
            metadata=extra_meta_final,
        )

    def _process_with_rules(self, message: str, context: AgentContext) -> AgentResponse:
        return AgentResponse(
            content=(
                "我是个性化旅游助手。\n\n"
                "你可以试试这些功能：\n"
                "- 🔍 搜索和推荐地点\n"
                "- 🗺️ 规划旅行路线\n"
                "- 📝 生成旅行日记\n\n"
                "告诉我你想做什么吧～"
            ),
            intent="general_chat",
            suggestions=["推荐景点", "规划路线", "写篇游记"],
            tools_used=["rule_fallback"],
        )

    def _process_with_images(
        self, message: str, images: list[str], context: AgentContext,
    ) -> AgentResponse:
        """使用视觉模型处理含图片的对话请求。

        图片 URL 优先级：
        1. image_data_urls（base64 data URLs，前端直接传入的预览数据）→ 最可靠
        2. images 相对路径 → 拼接后端 base URL 转为完整 HTTP URL
        3. images 完整 URL → 直接使用
        """
        from app.agent.llm_client import build_vision_content
        from app.core.model_router import model_router

        client = model_router.vision_client
        assert client is not None

        # 优先使用 base64 data URLs（不受网络可达性限制）
        data_urls = context.metadata.get("image_data_urls", [])
        if data_urls:
            vision_urls = list(data_urls)
            logger.info("使用 %d 张 base64 data URL 进行视觉分析", len(vision_urls))
        else:
            # 降级：将相对路径转为完整 URL
            from app.config import settings
            vision_urls = []
            for img in images:
                if img.startswith("data:"):
                    vision_urls.append(img)
                elif img.startswith("http://") or img.startswith("https://"):
                    vision_urls.append(img)
                else:
                    # 相对路径 → 拼接后端地址 → 转为完整 URL
                    backend = settings.backend_base_url.rstrip("/")
                    full_url = f"{backend}/{img.lstrip('/')}"
                    vision_urls.append(full_url)
            logger.info("使用 %d 张 HTTP URL 进行视觉分析 (base=%s)",
                       len(vision_urls), settings.backend_base_url)

        intent = context.metadata.get("intent", self._detect_intent_from_message(message))
        system = self.get_system_prompt(context)

        # 根据意图调整图片分析指令
        if intent == "generate_diary" or any(kw in message for kw in ["游记", "日记", "文案"]):
            analysis_prompt = (
                f"用户要求：{message or '根据图片生成旅行日记'}\n\n"
                "请仔细观察这些旅行照片，写出以下内容：\n"
                "1. 识别每张照片中的地点/场景/美食（如能认出具体名称请直接说出）\n"
                "2. 描述画面中的氛围、细节和亮点\n"
                "3. 基于这些照片，写一篇旅行日记（小红书风格，含emoji和#话题标签）"
            )
        else:
            analysis_prompt = (
                f"用户问题：{message or '请描述这些图片'}\n\n"
                "请仔细观察这些图片，回答用户的问题。\n"
                "如果图片中有景点/建筑/美食/地标，请直接说出名称和相关信息。\n"
                "给出有帮助、有洞察的回复。"
            )

        # 构建多模态消息（使用正确的 vision_urls）
        content_blocks = build_vision_content(analysis_prompt, vision_urls)
        msgs = [
            {"role": "system", "content": system},
            {"role": "user", "content": content_blocks},
        ]

        try:
            result = client.chat(msgs, max_tokens=1500)
            reply = result.content or "我已查看了你发送的图片，但无法生成文字回复。"
        except Exception as e:
            logger.exception("视觉模型调用失败")
            reply = f"图片分析暂时失败，请稍后重试。错误：{str(e)[:100]}"

        # 根据内容提取建议
        suggestions = _extract_highlights(reply)
        if not suggestions or suggestions == ["试试其他问题"]:
            suggestions = ["告诉我这是哪里", "推荐类似地点", "写篇游记"]

        img_meta: dict[str, Any] = {"image_count": len(vision_urls)}
        if intent == "generate_diary":
            img_meta["diary_card"] = True
            img_meta["diary_style"] = "小红书"
        return AgentResponse(
            content=reply,
            intent=intent,
            suggestions=suggestions[:5],
            tools_used=["vision_model"],
            metadata=img_meta,
        )

    def _understand_images_for_diary(self, images: list[str], context: AgentContext) -> str:
        """仅用视觉模型理解图片内容，不生成日记。

        返回图片的文本描述，供后续 LLM 日记生成使用。
        与 _process_with_images 不同：此方法只描述图片，不写日记。
        """
        from app.core.model_router import model_router

        if not model_router.vision_available():
            logger.warning("视觉模型不可用，图片理解跳过")
            return ""

        # 转换图片路径 → vision URL（优先 base64，其次可下载 HTTP，相对路径跳过）
        vision_urls: list[str] = []
        data_urls = context.metadata.get("image_data_urls", [])
        if data_urls:
            # base64 data URLs — 视觉模型可直接解码，不受网络可达性限制
            vision_urls = list(data_urls)
        else:
            # 仅保留可直接访问的 URL（data: 或 http(s):），跳过相对路径
            # 相对路径拼接后的 URL 在云视觉模型上不可达 → 400 Failed to download
            http_count = 0
            for img in images:
                if img.startswith("data:") or img.startswith("http://") or img.startswith("https://"):
                    vision_urls.append(img)
                    if img.startswith("http"):
                        http_count += 1
            if http_count > 0:
                logger.info("使用 %d 张 HTTP URL + %d 张 data URL 进行图片理解",
                           http_count, len(vision_urls) - http_count)

        if not vision_urls:
            # 无可用图片 URL（全是相对路径 或 无图片）→ 跳过视觉理解
            # LLM 仍可基于对话文本生成日记
            logger.warning(
                "缺少 image_data_urls 或可下载的 HTTP URL，跳过图片理解 "
                "(images=%d 张，均为相对路径，视觉模型无法下载)", len(images)
            )
            return ""

        system = self.get_system_prompt(context)
        content_blocks = build_vision_content(
            "请仔细观察这些旅行照片，详细描述每张照片的内容，用于后续撰写旅行日记：\n"
            "1. 识别拍摄地点/场景/建筑/美食（如能认出具体名称请直接说出）\n"
            "2. 描述画面中的关键元素、色彩、氛围和细节\n"
            "3. 如有文字/招牌/地标，请识别内容\n\n"
            "请用中文自然描述，控制在300字以内。",
            vision_urls,
        )
        msgs = [
            {"role": "system", "content": system},
            {"role": "user", "content": content_blocks},
        ]

        try:
            client = model_router.vision_client
            assert client is not None
            result = client.chat(msgs, max_tokens=500)
            desc = result.content or ""
            logger.info("图片理解完成 (%d 张图): %s...", len(vision_urls), desc[:80])
            return desc
        except Exception as e:
            logger.warning("图片理解失败: %s", e)
            return f"[共 {len(images)} 张旅行照片]"

    async def stream_process(self, message: str, context: AgentContext):
        """
        流式处理 — 异步生成器，逐 token/tool_call/tool_result 产出 SSE 事件。
        工具调用轮次走同步 chat()，最终回复走 chat_stream() 逐 token。

        含图片时：使用视觉模型分析，流式返回结果。
        """
        images = context.metadata.get("images", [])
        sid = context.session_id or "__no_session__"

        # === 提议接受检测：AI 刚提议生成游记，用户说"好/可以/行" → 触发风格确认 ===
        _affirm_stream = ["好", "可以", "行", "嗯", "是", "对", "OK", "ok", "Okay", "okay", "yes", "Yes",
                           "好啊", "好的", "好吧", "好呀", "行啊", "行吧", "可", "成", "中", "得", "搞"]
        if self._diary_proposals.get(sid, 0) > 0 and any(kw in message for kw in _affirm_stream) and len(message) < 30:
            context.metadata["intent"] = "generate_diary"
            self._diary_proposals[sid] = 999

        # === 待确认风格：用户上轮触发日记生成但没选风格，本轮回应风格选择 ===
        if sid in self._pending_style_confirm:
            recommended = self._pending_style_confirm.pop(sid)
            chosen_stream: str | None = None
            for i in range(1, 4):
                if any(s in message for s in [str(i), f"第{i}", f"第 {i}"]):
                    chosen_stream = recommended
                    break
            if not chosen_stream:
                chosen_stream = self._extract_style_from_message(message)
            if not chosen_stream and any(kw in message for kw in ["好", "可以", "行", "嗯", "是", "对", "OK", "ok", "就这个", "就用这个"]):
                chosen_stream = recommended
            if not chosen_stream and len(message) > 3 and not any(kw in message for kw in ["?","？","什么","怎么","哪个","换"]):
                chosen_stream = message.strip()
            if not chosen_stream:
                chosen_stream = recommended
            preset_names_stream = {"小红书", "朋友圈", "游记", "攻略", "文艺", "幽默", "随笔", "回忆"}
            if chosen_stream in preset_names_stream:
                context.metadata["diary_style"] = chosen_stream
                context.metadata["diary_style_custom"] = ""
            else:
                context.metadata["diary_style"] = "自定义"
                context.metadata["diary_style_custom"] = chosen_stream
            context.metadata["intent"] = "generate_diary"
            self._last_diary[sid] = ""

        # === 日记修改检测 ===
        if self._detect_diary_modification(message, sid) and self._last_diary.get(sid):
            import asyncio as _asyncio
            response = await _asyncio.to_thread(
                self._handle_diary_modification, message, context,
            )
            content = response.content
            chunk_size = 3
            for i in range(0, len(content), chunk_size):
                yield {"event": "token", "data": {"content": content[i:i + chunk_size]}}
            done_meta_mod: dict[str, Any] = {"diary_card": True}
            if response.metadata.get("diary_card"):
                done_meta_mod["diary_card"] = True
                done_meta_mod["diary_style"] = response.metadata.get("diary_style", "")
            yield {
                "event": "done",
                "data": {
                    "content": content,
                    "intent": "generate_diary",
                    "trace_id": context.session_id or "",
                    "suggestions": response.suggestions,
                    "tools_used": response.tools_used,
                    **done_meta_mod,
                },
            }
            return

        # 图片路径：根据 intent 分流
        if images:
            from app.core.model_router import model_router
            _img_intent = context.metadata.get("intent", "")
            if _img_intent == "generate_diary":
                # 日记生成 + 有图：仅做图片理解，不生成日记
                # 图片描述注入上下文后 fall through 到文本 LLM 路径，
                # 复用已有的风格确认 + 结构化日记生成流程
                if model_router.vision_available():
                    import asyncio as _asyncio
                    desc = await _asyncio.to_thread(
                        self._understand_images_for_diary, images, context
                    )
                    self._diary_image_descs[sid] = desc
                    yield {"event": "token", "data": {"content": "📷 正在分析你分享的照片...\n"}}
                    logger.info("图片理解完成，fall through 到 LLM 日记生成路径 (sid=%s)", sid)
                # 无论视觉模型是否可用，都 fall through 到文本路径
            elif model_router.vision_available():
                # 非日记的图片聊天：保持原行为（视觉模型分析 + 回复）
                import asyncio as _asyncio
                response = await _asyncio.to_thread(
                    self._process_with_images, message, images, context
                )
                # 模拟流式输出：逐字符产出
                content = response.content
                chunk_size = 3
                for i in range(0, len(content), chunk_size):
                    yield {
                        "event": "token",
                        "data": {"content": content[i:i + chunk_size]},
                    }
                # 传递 response.metadata（含 diary_card / diary_style 等），
                # 确保调度器能检测到 diary_card 并注入 all_session_images
                done_data: dict[str, Any] = {
                    "content": content,
                    "intent": response.intent,
                    "trace_id": context.session_id or "",
                    "suggestions": response.suggestions,
                    "tools_used": response.tools_used,
                }
                if response.metadata:
                    done_data.update(response.metadata)
                yield {"event": "done", "data": done_data}
                return
            else:
                # 视觉模型不可用
                msg = "你发送了图片，但图片理解功能暂未启用。请用文字描述你的问题。"
                yield {"event": "done", "data": {"content": msg, "intent": "general_chat", "suggestions": ["继续文字聊天"]}}
                return

        client = get_llm()
        if not client:
            yield {"event": "done", "data": {"content": "LLM 不可用，请稍后重试", "intent": "general_chat", "suggestions": []}}
            return

        system = self.get_system_prompt(context)
        intent = context.metadata.get("intent", self._detect_intent_from_message(message))

        # 主动提议检测：分析对话中是否有游记素材
        _diary_proposal_stream: str | None = None
        if intent != "generate_diary":
            _diary_proposal_stream = self._analyze_diary_potential(
                message, images, context.session_messages,
            )

        # === 风格确认：优先使用用户明确指定的风格，否则 AI 推荐创意风格 ===
        if intent == "generate_diary":
            explicit_style = self._extract_style_from_message(message)
            override_style = context.metadata.get("diary_style")
            # 关键词匹配可能误判：用户说 "帮我写游记" 时，"游记" 被当成风格选择
            # 实际意图是请求生成日记而非指定风格 → 检查是否为日记请求而非风格选择
            if explicit_style and not override_style:
                _diary_req = any(p in message for p in
                    ["帮我写", "帮我生成", "写一篇", "写个", "来一篇",
                     "写游记", "写日记", "生成游记", "生成日记", "写攻略"])
                _style_spec = any(
                    f"{kw}风格" in message or f"{kw}风" in message
                    for kw in self._STYLE_KEYWORDS
                )
                if _diary_req and not _style_spec:
                    explicit_style = None
            if explicit_style or override_style:
                # 用户已指定风格，记录并直接生成
                context.metadata["diary_style"] = explicit_style or override_style
            else:
                # 未指定风格 → 分析对话上下文和图片，推荐 3 个创意风格
                styles = self._suggest_creative_style(message, context.session_messages)
                self._pending_style_confirm[context.session_id or "__no_session__"] = styles["recommended"]
                options_list = [styles["recommended"]] + styles.get("options", [])
                options_text = "\n".join(f"{i+1}. {opt}" for i, opt in enumerate(options_list[:3]))
                full_question = (
                    f"分析你的照片和对话感受，推荐这几种风格：\n\n"
                    f"{options_text}\n\n"
                    f"想要哪种？回复数字或者直接告诉我你想要的感觉～"
                )
                yield {"event": "done", "data": {
                    "content": full_question,
                    "intent": "generate_diary",
                    "suggestions": options_list[:3],
                    "tools_used": ["style_recommend"],
                }}
                return

        sys_prompt = {
            "plan_trip_route": ROUTE_PLAN_PROMPT,
            "generate_diary": CONVERSATIONAL_DIARY_PROMPT,
            "reverse_recommend": REVERSE_RECOMMEND_PROMPT,
        }.get(intent, system)

        # 注入图片理解结果，供 LLM 在游记中融入照片细节
        if intent == "generate_diary":
            image_descs = self._diary_image_descs.pop(sid, "")
            if image_descs:
                sys_prompt += (
                    f"\n\n【用户旅行照片描述】\n{image_descs}\n\n"
                    "请在游记中自然地融入这些照片中的场景和细节，让读者有身临其境的感觉。"
                )

        # 如果有自定义创意风格，追加到 system prompt
        custom_style_stream = context.metadata.get("diary_style_custom", "")
        if custom_style_stream and intent == "generate_diary":
            sys_prompt += (
                "\n\n【重要风格指令】请严格按照以下风格描述来撰写这篇游记：\n\n"
                f"「{custom_style_stream}」\n\n"
                "完全融入上述风格的语气、句式、节奏和用词习惯。不要套用任何默认模板。"
            )

        msgs: list[dict[str, Any]] = [{"role": "system", "content": sys_prompt}]
        for m in context.session_messages[-6:]:
            msgs.append({"role": m.get("role", "user"), "content": m.get("content", "")})

        # 预注入周边数据
        sr_data = context.metadata.get("surrounding_data", "")
        effective_message = message
        if sr_data:
            effective_message = f"{message}\n\n[系统预查询结果 — 直接使用以下数据回答用户, 不要调用搜索工具]\n{sr_data}"
        msgs.append({"role": "user", "content": effective_message})

        tools = self.get_tools()  # Agent 作用域隔离
        # P2: Intent-Capability 映射 — conversational 意图不携带 tools
        from app.core.intent import intent_requires_tools
        if not intent_requires_tools(intent):
            logger.info("ChatAgent stream: Intent '%s' 为 conversational 类型，不携带 tools", intent)
            tools = []
        tools_used: list[str] = []
        xhs_results_raw: list[str] = []  # 收集 XHS 工具调用结果

        for round_num in range(_MAX_TOOL_ROUNDS):
            import asyncio as _asyncio
            result = await _asyncio.to_thread(client.chat, msgs, tools=tools if tools else None)

            if result.tool_calls:
                msgs.append({
                    "role": "assistant",
                    "content": result.content or None,
                    "tool_calls": result.tool_calls,
                })

                for tc in result.tool_calls:
                    func = tc["function"]
                    tool_name = func["name"]
                    try:
                        args = json.loads(func["arguments"])
                    except json.JSONDecodeError:
                        args = {}

                    yield {
                        "event": "tool_call",
                        "data": {"name": tool_name, "args": args},
                    }

                    tool_result = await _asyncio.to_thread(registry.dispatch, tool_name, args)
                    tools_used.append(tool_name)

                    # 收集 XHS 搜索结果用于前端卡片渲染
                    if tool_name == "xiaohongshu_search_notes":
                        xhs_results_raw.append(tool_result)

                    yield {
                        "event": "tool_result",
                        "data": {"name": tool_name, "result": tool_result},
                    }

                    msgs.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": tool_result,
                    })
            else:
                # 最终回复走流式输出
                tokens = await _asyncio.to_thread(_collect_stream, client, msgs)
                for token in tokens:
                    yield {"event": "token", "data": {"content": token}}

                full_content = "".join(tokens)
                # 主动提议：generate_diary 意图不追加（保持内容纯净，方便一键发布）
                if intent != "generate_diary":
                    full_content = self._maybe_append_proposal(
                        full_content, context.session_id, _diary_proposal_stream,
                    )
                done_meta: dict[str, Any] = {}
                if intent == "generate_diary":
                    stream_style = context.metadata.get("diary_style") or self._extract_style_from_message(message) or ""
                    if stream_style:
                        done_meta["diary_card"] = True
                        done_meta["diary_style"] = stream_style
                        self._last_diary[context.session_id or "__no_session__"] = full_content
                # 提取 XHS 搜索结果用于前端卡片渲染
                if xhs_results_raw:
                    done_meta["xhsNotes"] = _extract_xhs_notes_from_tool_results(xhs_results_raw)
                yield {
                    "event": "done",
                    "data": {
                        "content": full_content,
                        "intent": intent,
                        "trace_id": context.session_id or "",
                        "suggestions": _extract_highlights(full_content),
                        "tools_used": tools_used if tools_used else ["llm"],
                        **done_meta,
                    },
                }
                return

        # 超最大轮次，用非流式最终回复
        final = await _asyncio.to_thread(client.chat, msgs)
        # 双重保险：inline regex 清理 LLM 残留的 invoke XML / 全角 DSML（防御纵深）
        full_content = final.content or ""
        import re as _re3
        if '<invoke' in full_content or '｜' in full_content or '／' in full_content:
            FW = '｜'; FS = '／'
            # Fullwidth DSML (FW{1,2} handles DeepSeek 1-2 bar instability)
            full_content = _re3.sub(r'<' + FW + r'{1,2}DSML' + FW + r'{1,2}tool_calls>.*?' + r'<' + FS + r'{1,2}DSML' + FW + r'{1,2}tool_calls>', '', full_content, flags=_re3.DOTALL)
            full_content = _re3.sub(r'<' + FW + r'{1,2}DSML' + FW + r'{1,2}invoke name="[^"]*">.*?' + r'<' + FS + r'{1,2}DSML' + FW + r'{1,2}invoke>', '', full_content, flags=_re3.DOTALL)
            # ASCII DSML
            full_content = _re3.sub(r'<DSML\s+function_calls>.*?</DSML\s+function_calls>', '', full_content, flags=_re3.DOTALL)
            full_content = _re3.sub(r'<invoke\s+name="[^"]+"\s*>.*?</invoke\s*>', '', full_content, flags=_re3.DOTALL)
            full_content = _re3.sub(r'<parameter\s+[^>]+>.*?</parameter\s*>', '', full_content, flags=_re3.DOTALL).strip()
        # 主动提议：generate_diary 意图不追加（保持内容纯净）
        if intent != "generate_diary":
            full_content = self._maybe_append_proposal(
                full_content, context.session_id, _diary_proposal_stream,
            )
        done_meta_final: dict[str, Any] = {"max_rounds_reached": True}
        if intent == "generate_diary":
            stream_style_final = context.metadata.get("diary_style") or self._extract_style_from_message(message) or ""
            if stream_style_final:
                done_meta_final["diary_card"] = True
                done_meta_final["diary_style"] = stream_style_final
                self._last_diary[context.session_id or "__no_session__"] = full_content
        # 提取 XHS 搜索结果用于前端卡片渲染
        if xhs_results_raw:
            done_meta_final["xhsNotes"] = _extract_xhs_notes_from_tool_results(xhs_results_raw)
        yield {
            "event": "done",
            "data": {
                "content": full_content,
                "intent": intent,
                "trace_id": context.session_id or "",
                "suggestions": _extract_highlights(full_content),
                "tools_used": tools_used if tools_used else ["llm"],
                **done_meta_final,
            },
        }

    # ==================== 风格建议 & 修改检测 ====================

    # 风格关键词 → preset 名映射（用户明确说时使用）
    _STYLE_KEYWORDS: dict[str, str] = {
        "小红书": "小红书", "朋友圈": "朋友圈", "游记": "游记",
        "攻略": "攻略", "文艺": "文艺", "幽默": "幽默",
        "随笔": "随笔", "回忆": "回忆", "吐槽": "幽默",
        "长文": "游记", "种草": "小红书", "日常": "朋友圈",
        "轻松": "朋友圈", "详细": "攻略", "有趣": "幽默",
    }

    def _extract_style_from_message(self, message: str) -> str | None:
        """从用户消息中提取明确的风格偏好（支持 preset 名 + 自由描述）。"""
        for kw, style in self._STYLE_KEYWORDS.items():
            if kw in message:
                return style
        # 用户可能直接给了自由描述："用王家卫的风格" → 返回原句作为 custom_prompt
        for prefix in ["用", "像", "模仿", "写", "要"]:
            if prefix in message:
                rest = message[message.index(prefix):].strip()
                if len(rest) > 2 and len(rest) < 100:
                    return rest  # 作为 custom_prompt
        return None

    def _suggest_creative_style(
        self, message: str, session_messages: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """用 LLM 分析对话语气和内容，推荐 3 个有特色的游记风格。

        Returns: {"recommended": "...", "options": ["...", "...", "..."], "quick_pick": "..."}
        如果 LLM 不可用，降级为预设推荐。
        """
        if not llm_available():
            return {
                "recommended": "像发朋友圈一样，轻松随意地记录",
                "options": [
                    "像发朋友圈一样，轻松随意地记录",
                    "活泼种草风，多用 emoji 和感叹号",
                    "文艺散文风，注重画面感和情绪",
                ],
                "quick_pick": "朋友圈",
            }

        combined = "\n".join(
            f"{'用户' if m.get('role') == 'user' else 'AI'}: {m.get('content', '')[:200]}"
            for m in (session_messages or [])[-8:]
        )
        combined = f"{combined}\n用户: {message}"

        client = get_llm()
        assert client is not None

        prompt = (
            "你是一位文学编辑，擅长根据文字气质推荐写作风格。\n\n"
            "分析以下对话，感受用户的语气、情绪和表达方式，"
            "然后推荐 3 个有特色、有画面感的游记写作风格。\n\n"
            "要求：\n"
            "- 风格描述要具体、有辨识度，像在推荐一种'文笔滤镜'\n"
            "- 可以借用知名作家/导演/作品的语气（如：王家卫的独白、余华的冷峻、李娟的草原散文）\n"
            "- 也可以是氛围感描述（如：深夜电台的低语、旅途中写给自己的明信片）\n"
            "- 结合对话中用户的实际语气来推荐，不要千篇一律\n"
            "- 第一个是「最推荐」的风格，后两个是备选\n\n"
            f"对话内容：\n{combined[:3000]}\n\n"
            "返回 JSON 格式（只返回 JSON）：\n"
            '{"recommended": "最推荐的风格描述（一句话，有画面感）",'
            '"options": ["备选风格1", "备选风格2"],'
            '"quick_pick": "小红书/朋友圈/游记/攻略/文艺/幽默/自定义（选一个最接近的 preset）"}'
        )

        result = client.chat([
            {"role": "user", "content": prompt},
        ], temperature=0.8, max_tokens=300)

        try:
            import json
            raw = (result.content or "").strip()
            start = raw.find("{")
            end = raw.rfind("}")
            if start != -1 and end != -1:
                parsed = json.loads(raw[start:end + 1])
                return {
                    "recommended": parsed.get("recommended", "轻松随性的朋友圈风格"),
                    "options": parsed.get("options", ["小红书活泼风", "朋友圈日常风", "游记叙事风"])[:2],
                    "quick_pick": parsed.get("quick_pick", "小红书"),
                }
        except Exception:
            pass

        return {
            "recommended": "像发朋友圈一样，轻松随意地记录这段旅程",
            "options": ["小红书活泼种草风", "温暖治愈的日系散文风"],
            "quick_pick": "朋友圈",
        }

    def _detect_diary_modification(
        self, message: str, session_id: str | None,
    ) -> bool:
        """检测用户是否在对刚生成的游记提出修改要求。"""
        sid = session_id or "__no_session__"
        if sid not in self._last_diary:
            return False
        mod_kw = ["改", "换", "加", "删", "修", "调整", "润色", "缩短", "加长",
                   "多一点", "少一点", "太长了", "太短了", "加点", "去掉",
                   "换个风格", "换一种", "改成", "不好看", "再写"]
        return any(kw in message for kw in mod_kw)

    def _handle_diary_modification(
        self, message: str, context: AgentContext,
    ) -> AgentResponse:
        """处理用户对已生成游记的修改请求：换风格/改内容/调整细节。"""
        sid = context.session_id or "__no_session__"
        last_content = self._last_diary.get(sid, "")

        # 换风格
        new_style = self._extract_style_from_message(message)
        if new_style or any(kw in message for kw in ["换风格", "换个风格", "换一种", "换风", "风格改"]):
            if not new_style:
                new_style = self._analyze_context_style(message, context.session_messages)
            # 复用 regenerate 流程
            context.metadata["intent"] = "generate_diary"
            context.metadata["diary_style"] = new_style
            if llm_available():
                return self._process_with_llm(
                    f"请用{new_style}风格重新写这篇游记，保持原来的地点/美食/活动内容不变。\n\n原文供参考：\n{last_content[:2000]}",
                    context,
                )
            return AgentResponse(
                content=f"好的，我用{new_style}风重新写一版。\n\n（LLM 暂不可用，请稍后再试）",
                intent="generate_diary",
                suggestions=["再试一次"],
            )

        # 内容修改（改/加/删/润色）
        if llm_available():
            client = get_llm()
            assert client is not None
            mod_prompt = (
                "用户对以下游记提出了修改意见。请根据用户的要求修改游记内容，"
                "保持整体风格不变，只调整用户指定的部分。\n\n"
                f"原文：\n{last_content[:2000]}\n\n"
                f"修改要求：{message}\n\n"
                "请返回修改后的完整游记，保持和原文相同的格式和风格。"
                "只返回修改后的游记内容，不要返回其他解释。"
            )
            result = client.chat([
                {"role": "system", "content": "你是旅行文案编辑，擅长按要求修改文章。"},
                {"role": "user", "content": mod_prompt},
            ], temperature=0.7, max_tokens=2000)
            modified = result.content or last_content
            self._last_diary[sid] = modified
            return AgentResponse(
                content=f"已按要求修改～\n\n{modified}",
                intent="generate_diary",
                suggestions=["继续修改", "换风格", "一键发布"],
                tools_used=["diary_editor"],
                metadata={"diary_card": True, "diary_style": "已修改"},
            )
        else:
            return AgentResponse(
                content="我理解你想修改游记，但目前 LLM 不可用。请稍后再试，或手动编辑。",
                intent="general_chat",
                suggestions=["继续聊天"],
            )

    # ==================== 意图检测 ====================

    def _detect_intent_from_message(self, message: str) -> str:
        # ChatAgent 只负责闲聊和日记提议；路线/搜索/推荐由专门的 Agent 处理
        if any(kw in message for kw in ["日记", "游记", "文案"]):
            return "generate_diary"
        return "general_chat"


def _extract_highlights(text: str) -> list[str]:
    suggestions: list[str] = []
    for line in text.split("\n"):
        line = line.strip()
        if line and len(line) < 30:
            cleaned = line.lstrip("0123456789. -•#").strip()
            if 2 < len(cleaned) < 20:
                suggestions.append(cleaned)
    return suggestions[:5] if suggestions else ["试试其他问题"]


def _collect_stream(client, msgs) -> list[str]:
    """在后台线程中收集所有流式 token，避免阻塞事件循环。

    ═══ 关键修复: 流式 token 可能包含 DSML/XML 工具调用标签，
    必须清理后再返回，防止原始 XML 泄露到前端。 ═══
    """
    tokens = list(client.chat_stream(msgs))
    full_text = "".join(tokens)

    # 检测 DSML 特征标记（全角、ASCII invoke、DSML 标签）
    has_dsml = any(
        marker in full_text
        for marker in ('｜', '／', '<invoke name=', '<DSML', '<parameter ')
    )
    if has_dsml:
        from app.agent.llm_client import _strip_dsml_from_content
        cleaned = _strip_dsml_from_content(full_text)
        if cleaned != full_text:
            import logging
            logger = logging.getLogger(__name__)
            logger.info(
                "_collect_stream: DSML 标签已从流式输出中清理（%d → %d 字符）",
                len(full_text), len(cleaned),
            )
            return [cleaned]
    return tokens


def _safe_json(text: str) -> bool:
    """检查字符串是否可安全解析为 JSON 对象。"""
    import json as _json
    try:
        _json.loads(text)
        return True
    except (_json.JSONDecodeError, TypeError, ValueError):
        return False
