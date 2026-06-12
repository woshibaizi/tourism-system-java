"""
统一意图分类 — 6 种意图的 LLM 分类 + 关键词规则降级。

消除 dispatcher/chat_agent/route_planner 中重复的意图识别和槽位提取逻辑。
"""

from __future__ import annotations

import logging
from typing import Any

from app.core.llm import get_llm, llm_available

logger = logging.getLogger(__name__)

AVAILABLE_INTENTS: dict[str, str] = {
    "plan_trip_route": "路线规划",
    "generate_diary": "生成旅行日记",
    "recommend_place": "地点推荐",
    "search_place": "搜索地点",
    "reverse_recommend": "反向推荐/别去",
    "general_chat": "闲聊/其他",
}


# ═══════════════════════════════════════════════════════════════════
# Intent → Capability 映射层 (P2)
#
# 将 NLP 意图与系统能力解耦：
#   - conversational: 纯 LLM 对话回复，不涉及工具调用
#   - tool_execution: 需要调用后端工具获取数据（搜索、推荐、路线规划等）
#   - knowledge_retrieval: 需要 RAG 知识检索（预留扩展）
#
# 消费者：
#   - Agent 的 _process_with_llm(): 决定是否在 LLM 请求中携带 tools
#   - chat() 的 DSML 解析: 决定是否需要解析工具调用
#   - Dispatcher: 根据 capability 类型选择处理策略
# ═══════════════════════════════════════════════════════════════════


class IntentCapability:
    """意图能力的抽象表示。"""
    conversational = "conversational"
    tool_execution = "tool_execution"
    knowledge_retrieval = "knowledge_retrieval"


# Intent → Capability + 适用工具映射
# 每个 intent 映射到一种 capability，以及该 intent 下可用的工具列表
INTENT_CAPABILITY_MAP: dict[str, dict[str, Any]] = {
    "plan_trip_route": {
        "capability": IntentCapability.tool_execution,
        "description": "路线规划 — 需要路线计算和地点搜索工具",
        # 工具名用于白名单校验和 Agent 工具选择
        "tool_names": [
            "recommend_places", "plan_shortest_path", "plan_multi_dest",
            "get_foods_by_place", "get_nearest_facilities",
        ],
    },
    "generate_diary": {
        "capability": IntentCapability.tool_execution,
        "description": "日记生成 — 需要图片理解和内容生成",
        "tool_names": [],
    },
    "recommend_place": {
        "capability": IntentCapability.tool_execution,
        "description": "地点推荐 — 需要搜索、推荐、周边查询工具",
        "tool_names": [
            "search_places", "get_place_detail", "get_hot_places",
            "get_hot_foods", "get_foods_by_cuisine",
            "search_surroundings", "get_surroundings_by_place",
            "get_surrounding_hot", "xiaohongshu_search_notes",
        ],
    },
    "search_place": {
        "capability": IntentCapability.tool_execution,
        "description": "地点搜索 — 需要搜索和详情工具",
        "tool_names": ["search_places", "get_place_detail"],
    },
    "reverse_recommend": {
        "capability": IntentCapability.conversational,
        "description": "反向推荐 — 规则回复，无需工具",
        "tool_names": [],
    },
    "general_chat": {
        "capability": IntentCapability.conversational,
        "description": "闲聊 — 纯 LLM 对话，无需工具",
        "tool_names": [],
    },
}


def get_intent_capability(intent: str) -> str:
    """查询某个 intent 对应的 capability 类型。

    Returns:
        IntentCapability.conversational | tool_execution | knowledge_retrieval
        未识别的 intent 默认返回 conversational（安全降级）。
    """
    entry = INTENT_CAPABILITY_MAP.get(intent)
    if entry:
        return entry["capability"]
    logger.warning("未知 intent '%s'，降级为 conversational", intent)
    return IntentCapability.conversational


def intent_requires_tools(intent: str) -> bool:
    """判断某个 intent 是否需要工具调用支持。

    用于 Agent 决定是否在 LLM 请求中携带 tools 参数。
    conversational 类型的 intent 不应携带 tools，以避免 LLM 幻觉工具调用。
    """
    return get_intent_capability(intent) == IntentCapability.tool_execution


def get_tool_names_for_intent(intent: str) -> list[str]:
    """获取某个 intent 对应的工具名列表（用于白名单校验和 Agent 工具过滤）。"""
    entry = INTENT_CAPABILITY_MAP.get(intent)
    if entry:
        return entry.get("tool_names", [])
    return []


def classify_intent(message: str) -> dict[str, Any]:
    """意图识别 + 槽位抽取。LLM 可用时走模型分类，否则关键词规则。"""
    # 关键词强制覆盖：避免 LLM 意图分类器误判
    override = _keyword_override(message)
    if override is not None:
        logger.info("关键词强制覆盖意图: %s → %s", message[:40], override["intent"])
        return override

    if llm_available():
        return _llm_classify(message)
    return _rule_classify(message)


def _keyword_override(message: str) -> dict[str, Any] | None:
    """当消息包含强路线规划信号时，跳过 LLM 分类，直接用规则结果。

    返回 None 表示不覆盖，走正常分类流程。
    """
    # 强路线规划信号：规划/路线/行程/导航 + 地名或具体需求
    _route_signals = ["规划", "路线", "行程", "导航"]
    has_route_signal = any(kw in message for kw in _route_signals)

    if not has_route_signal:
        return None

    # 进一步确认：有目的地或具体场景（避免 "帮我规划一下人生" 误触发）
    has_destination = any(kw in message for kw in _KNOWN_DESTINATIONS)
    has_scene = any(kw in message for kw in ["去", "玩", "游", "逛", "绕", "一日", "半天", "两天", "三天"])

    if has_destination or has_scene:
        slots = extract_route_slots(message)
        # 检测关键槽位是否缺失，只有 LLM 可用时才放行让 LLM 追问
        missing = []
        if not slots.get("destination"):
            missing.append("destination")
        # 即使 destination 缺失也不拦截（conf >= 0.4），交给 RouteAgent 的 LLM 自行推断
        return {
            "intent": "plan_trip_route",
            "confidence": 0.6 if missing else 0.9,
            "slots": slots,
            "missingSlots": missing,
            "shouldAskClarifyingQuestion": False,  # 不拦截，让 Agent 处理
            "clarifyingQuestion": "",
        }

    return None


def _llm_classify(message: str) -> dict[str, Any]:
    from app.agent.prompts import INTENT_CLASSIFY_PROMPT  # 延迟导入避免循环依赖

    client = get_llm()
    assert client is not None
    labels = "\n".join(f"- {k}: {v}" for k, v in AVAILABLE_INTENTS.items())
    messages = [
        {
            "role": "system",
            "content": f"{INTENT_CLASSIFY_PROMPT}\n\n当前可用的意图列表：\n{labels}",
        },
        {"role": "user", "content": message},
    ]
    result = client.chat(messages, temperature=0.0, max_tokens=512)
    llm_raw = (result.content or "")[:300]

    # 直接从 LLM 原始 JSON 解析完整字段（_parse_json_safely 会丢弃 slots）
    from app.agent.llm_client import _extract_json

    raw_json = _extract_json(result.content or "")

    # 验证 intent 有效性：LLM 返回异常时降级为容错解析
    if not raw_json or raw_json.get("intent") not in AVAILABLE_INTENTS:
        logger.warning("LLM 意图分类返回异常 JSON，降级容错。raw=%s", llm_raw)
        safe = client._parse_json_safely(result.content or "", AVAILABLE_INTENTS)
        raw_json = {
            "intent": safe["intent"],
            "confidence": safe.get("confidence", 0.1),
        }
    else:
        logger.info("LLM 意图分类: intent=%s confidence=%s slots=%s",
                    raw_json.get("intent"), raw_json.get("confidence"),
                    raw_json.get("slots", {}))

    # 从 LLM 完整 JSON 构建 parsed，保留 slots / missingSlots 等全部字段
    parsed: dict[str, Any] = {
        "intent": raw_json.get("intent", "general_chat"),
        "confidence": float(raw_json.get("confidence", 0.5)),
        "slots": raw_json.get("slots", {}),
        "missingSlots": raw_json.get("missingSlots", raw_json.get("missing_context", [])),
        "shouldAskClarifyingQuestion": raw_json.get(
            "shouldAskClarifyingQuestion",
            float(raw_json.get("confidence", 0)) < 0.65,
        ),
        "clarifyingQuestion": raw_json.get("clarifyingQuestion", ""),
    }

    # 安全兜底：plan_trip_route 目的地缺失时强制追问（防止 LLM 漏报）
    if parsed.get("intent") == "plan_trip_route":
        slots = parsed.get("slots", {})
        if not slots.get("destination"):
            parsed.setdefault("missingSlots", [])
            if "destination" not in parsed["missingSlots"]:
                parsed["missingSlots"].append("destination")
            parsed["shouldAskClarifyingQuestion"] = True
            if not parsed.get("clarifyingQuestion"):
                parsed["clarifyingQuestion"] = "你想去哪里玩？告诉我目的地，我帮你规划最佳路线～"

    return parsed


def _rule_classify(message: str) -> dict[str, Any]:
    lowered = message.lower()

    # 反向推荐
    if any(kw in message for kw in ["别去", "劝退", "避雷", "踩坑", "不值得"]):
        return _make_result("reverse_recommend", 0.6, {})

    # 路线规划
    if any(kw in message for kw in ["路线", "行程", "导航", "怎么走", "规划"]) or "route" in lowered:
        slots = extract_route_slots(message)
        missing = []
        if not slots.get("destination"):
            missing.append("destination")
        if not slots.get("days"):
            missing.append("duration")
        clarifying_question = ""
        if missing:
            if "destination" in missing and "duration" not in missing:
                clarifying_question = "你想去哪里玩？告诉我目的地，我帮你规划最佳路线～"
            elif "destination" not in missing and "duration" in missing:
                clarifying_question = "你有多少时间？告诉我可用时长，我帮你规划最佳路线～"
            else:
                clarifying_question = "告诉我目的地和可用时长，我帮你规划最佳路线～"
        return {
            "intent": "plan_trip_route",
            "confidence": 0.6,
            "slots": slots,
            "missingSlots": missing,
            "shouldAskClarifyingQuestion": bool(missing),
            "clarifyingQuestion": clarifying_question,
        }

    # 日记生成
    # "小红书"需要区分场景：搜索/推荐上下文 → 走推荐/搜索分支；写作/文案上下文 → 走日记分支
    _has_xhs = "小红书" in message
    _is_diary_req = any(kw in message for kw in ["日记", "游记", "文案"])
    _is_write_req = any(kw in message for kw in ["写", "生成", "帮我写", "帮我生成", "写一篇"])
    _is_xhs_search = _has_xhs and any(
        kw in message for kw in ["有什么", "有哪些", "推荐", "最近火", "最近热门",
                                  "最近流行", "最近很火", "最近比较火", "网红", "种草",
                                  "爆火", "刷屏", "搜索", "找", "查", "好玩", "好吃",
                                  "值得去", "热门打卡", "必打卡"]
    )
    if _is_diary_req or (_has_xhs and _is_write_req) or (_has_xhs and not _is_xhs_search):
        slots = {"images": any(kw in message for kw in ["图片", "照片", "图"]), "style": "小红书"}
        missing = []
        if not slots["images"]:
            missing.append("images")
        return {
            "intent": "generate_diary",
            "confidence": 0.7,
            "slots": slots,
            "missingSlots": missing,
            "shouldAskClarifyingQuestion": bool(missing),
            "clarifyingQuestion": "有照片吗？上传几张图片我帮你生成旅行日记～" if missing else "",
        }

    # 地点推荐
    if any(kw in message for kw in ["推荐", "好吃的", "好玩的", "附近", "有什么", "有哪些",
                                     "值得去", "打卡", "好玩", "好吃", "最近火"]):
        interests = extract_interests(message)
        return _make_result("recommend_place", 0.5, {"preference": interests})

    # 搜索地点
    if any(kw in message for kw in ["搜索", "找", "查", "在哪", "有没有"]):
        return _make_result("search_place", 0.5, {"keyword": message})

    return _make_result("general_chat", 0.3, {})


# 规则降级路径：已知目的地关键词（按优先级排序，长词在前避免部分匹配）
_KNOWN_DESTINATIONS: list[str] = [
    # 浙江
    "西湖", "雷峰塔", "灵隐寺", "千岛湖", "乌镇", "西塘", "杭州",
    # 北京
    "故宫", "长城", "天安门", "颐和园", "天坛", "北海", "鸟巢", "三里屯",
    # 上海
    "外滩", "东方明珠", "迪士尼", "豫园", "南京路", "田子坊",
    # 其他热门
    "三亚", "丽江", "大理", "桂林", "张家界", "黄山", "泰山",
    "兵马俑", "鼓浪屿", "洪崖洞", "宽窄巷子", "九寨沟",
    # 通用
    "校园", "校区", "大学", "景区", "公园", "古镇", "老街", "博物馆",
    "步行街", "夜市", "美食街", "沙滩", "海岛",
]


def extract_route_slots(message: str) -> dict[str, Any]:
    slots: dict[str, Any] = {}

    # 1. 精确匹配已知目的地（长词优先）
    for dest_kw in _KNOWN_DESTINATIONS:
        if dest_kw in message:
            slots["destination"] = dest_kw
            break

    # 2. 精确匹配失败时，尝试正则提取 "去XX" "在XX" "到XX" 模式
    if not slots.get("destination"):
        import re

        # 非目的地常见词：正则匹配出的词若在此列表中则丢弃
        _NON_DESTINATION_WORDS = {
            "路线", "行程", "导航", "规划", "推荐", "今天", "明天", "周末",
            "一下", "半天", "一天", "两天", "三天", "攻略", "旅游",
        }

        _patterns = [
            r"去([一-龥]{2,6})(?:玩|逛|旅游|看看|拍照|吃东西|打卡|转转|吧|吗|呀)",
            r"在([一-龥]{2,6})(?:玩|逛|旅游|转转)",
            r"到([一-龥]{2,6})(?:玩|逛|旅游|看看)",
            r"想去([一-龥]{2,6})",
        ]
        for pattern in _patterns:
            match = re.search(pattern, message)
            if match:
                candidate = match.group(1)
                if candidate not in _NON_DESTINATION_WORDS:
                    slots["destination"] = candidate
                    break

    # 时间/天数提取
    if "半天" in message or "一下午" in message or "半日" in message:
        slots["days"] = 0.5
    elif "一天" in message or "一日" in message:
        slots["days"] = 1
    elif "两天" in message:
        slots["days"] = 2
    elif "三天" in message:
        slots["days"] = 3
    slots["interests"] = extract_interests(message)
    if any(w in message for w in ["轻松", "休闲", "慢"]):
        slots["pace"] = "relaxed"
    return slots


def extract_interests(message: str) -> list[str]:
    interests: list[str] = []
    if any(w in message for w in ["拍照", "摄影", "好看", "风景"]):
        interests.append("拍照")
    if any(w in message for w in ["美食", "好吃", "吃", "甜品", "咖啡", "小吃"]):
        interests.append("美食")
    if any(w in message for w in ["文化", "历史", "博物馆", "古迹"]):
        interests.append("文化")
    return interests


def _make_result(intent: str, confidence: float, slots: dict[str, Any]) -> dict[str, Any]:
    return {
        "intent": intent,
        "confidence": confidence,
        "slots": slots,
        "missingSlots": [],
        "shouldAskClarifyingQuestion": False,
        "clarifyingQuestion": "",
    }
