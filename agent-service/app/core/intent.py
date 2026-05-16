"""
统一意图分类 — 9 种意图的 LLM 分类 + 关键词规则降级。

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
    "dice_adventure": "扔骰子冒险",
    "analyze_personality": "旅行人格分析",
    "generate_memory": "旅行回忆生成",
    "scene_recommend": "此刻出发推荐",
    "reverse_recommend": "反向推荐/别去",
    "general_chat": "闲聊/其他",
}


def classify_intent(message: str) -> dict[str, Any]:
    """意图识别 + 槽位抽取。LLM 可用时走模型分类，否则关键词规则。"""
    if llm_available():
        return _llm_classify(message)
    return _rule_classify(message)


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
    parsed = client._parse_json_safely(result.content or "", AVAILABLE_INTENTS)
    parsed.setdefault("slots", {})
    parsed.setdefault("missingSlots", parsed.pop("missing_context", []))
    parsed.setdefault("shouldAskClarifyingQuestion", parsed.get("confidence", 0) < 0.65)
    parsed.setdefault("clarifyingQuestion", "")
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
        return {
            "intent": "plan_trip_route",
            "confidence": 0.6,
            "slots": slots,
            "missingSlots": missing,
            "shouldAskClarifyingQuestion": bool(missing),
            "clarifyingQuestion": "告诉我目的地和可用时长，我帮你规划最佳路线～" if missing else "",
        }

    # 日记生成
    if any(kw in message for kw in ["日记", "游记", "文案", "小红书"]):
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

    # 扔骰子
    if any(kw in message for kw in ["扔骰子", "随机", "冒险", "摇一摇", "骰子"]):
        return _make_result("dice_adventure", 0.7, {})

    # 旅行人格
    if any(kw in message for kw in ["旅行人格", "我的画像", "旅行报告", "人格分析"]):
        return _make_result("analyze_personality", 0.7, {})

    # 旅行回忆
    if any(kw in message for kw in ["旅行回忆", "年度总结", "回顾", "回忆"]):
        return _make_result("generate_memory", 0.7, {})

    # 此刻出发
    if any(kw in message for kw in ["现在去哪", "此刻", "出发", "当下", "现在做什么"]):
        return _make_result("scene_recommend", 0.7, {})

    # 地点推荐
    if any(kw in message for kw in ["推荐", "好吃的", "好玩的", "附近", "有什么"]):
        interests = extract_interests(message)
        return _make_result("recommend_place", 0.5, {"preference": interests})

    # 搜索地点
    if any(kw in message for kw in ["搜索", "找", "查", "在哪", "有没有"]):
        return _make_result("search_place", 0.5, {"keyword": message})

    return _make_result("general_chat", 0.3, {})


def extract_route_slots(message: str) -> dict[str, Any]:
    slots: dict[str, Any] = {}
    for dest_kw in ["杭州", "西湖", "校园", "景区", "公园"]:
        if dest_kw in message:
            slots["destination"] = dest_kw
            break
    if "半天" in message:
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
