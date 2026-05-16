"""
旅行人格分析 Agent — Spotify Wrapped 式旅行画像。

从用户行为数据聚合特征向量，规则引擎映射到 5 种人格类型。
数据不可用时降级为静态模板。
"""

from __future__ import annotations

import logging
from typing import Any

from app.agent.base_agent import AgentContext, AgentResponse, BaseAgent
from app.core.llm import get_llm, llm_available
from app.tools.registry import registry
from app.tools.tourism_api import tourism_api_client

logger = logging.getLogger(__name__)

PERSONA_TYPES: dict[str, dict[str, Any]] = {
    "food_hunter": {
        "name": "美食猎人",
        "icon": "🍜",
        "description_template": (
            "你的旅行词典里，'景点'的排名永远在'美食'后面。"
            "过去一个月你浏览了 {total_foods} 家餐厅，最爱的菜系是{favorite_cuisine}。"
            "对你来说，一个地方好不好玩，取决于那儿的厨房水平。"
        ),
        "recommendation": "下次试试第二食堂的酸菜鱼，据说是新来的川菜师傅掌勺。",
    },
    "photo_wanderer": {
        "name": "摄影漫游者",
        "icon": "📷",
        "description_template": (
            "你的手机相册就是最好的旅行地图。你偏爱那些'出片'的角落，"
            "对光线和构图有天然的直觉。过去一个月你浏览了 {total_places} 个景点，"
            "每次都能找到别人忽略的角度。"
        ),
        "recommendation": "日落时分去西湖边，下午四点半的光线穿过柳树洒在水面上，随手一拍都是大片。",
    },
    "culture_explorer": {
        "name": "文化探索者",
        "icon": "🏛",
        "description_template": (
            "你对每块砖背后的故事比对砖本身更感兴趣。博物馆、历史建筑、"
            "老街小巷是你的舒适区。别人走马观花，你走心。"
        ),
        "recommendation": "推荐你去看看本地的非遗展览，最近有个关于传统手工艺的特展。",
    },
    "efficient_pacer": {
        "name": "高效打卡族",
        "icon": "⚡",
        "description_template": (
            "你的旅行风格是：精准、高效、不浪费一分钟。一日多目标、路线紧凑、"
            "每个停留时间精确到分钟。别人一天逛 3 个地方，你能逛 8 个还附带两顿饭。"
        ),
        "recommendation": "试试'半日极速版'路线，4 个核心景点 + 2 家必吃餐厅，5 小时内搞定。",
    },
    "leisure_dreamer": {
        "name": "悠闲度假派",
        "icon": "🌿",
        "description_template": (
            "你深谙'慢就是快'的旅行哲学。不赶场、不打卡、不排队。"
            "一个咖啡馆能坐一下午，一片草地能躺到天黑。对你来说，最好的行程就是没有行程。"
        ),
        "recommendation": "找个阳光好的下午，带一本书去湖边的长椅上坐到日落，这就是你的完美旅行。",
    },
}


class PersonaAgent(BaseAgent):
    """旅行人格分析 — 聚合用户行为生成旅行画像。"""

    @property
    def name(self) -> str:
        return "persona"

    @property
    def description(self) -> str:
        return "旅行人格分析：分析用户行为偏好，生成专属旅行画像"

    def __init__(self) -> None:
        self._register_tools()

    def _register_tools(self) -> None:
        @registry.register(
            name="analyze_user_behavior",
            description="分析用户行为数据，提取特征向量（浏览偏好、评分习惯、活跃时段等）",
            parameters={
                "type": "object",
                "properties": {
                    "user_id": {"type": "string", "description": "用户 ID"},
                },
                "required": ["user_id"],
            },
        )
        def analyze_user_behavior(user_id: str) -> str:
            import json as _json
            behavior = tourism_api_client.get_user_behavior(user_id)
            ratings = tourism_api_client.get_user_ratings(user_id)
            stats = tourism_api_client.get_stats()

            features = {
                "total_places": 0,
                "total_foods": 0,
                "total_diaries": 0,
                "avg_rating": 4.0,
                "favorite_cuisine": "未知",
                "favorite_place_type": "未知",
                "active_hours": [],
                "keywords": [],
            }

            if behavior:
                features["total_places"] = behavior.get("placeViews", 0)
                features["total_foods"] = behavior.get("foodViews", 0)
                features["total_diaries"] = behavior.get("diaryCount", 0)
                features["active_hours"] = behavior.get("activeHours", [])
                features["keywords"] = behavior.get("keywords", [])

            if ratings:
                features["avg_rating"] = sum(
                    r.get("rating", 0) for r in ratings if isinstance(r, dict)
                ) / max(len(ratings), 1) or 4.0

            if stats:
                features["favorite_cuisine"] = stats.get("topCuisine", "未知")
                features["favorite_place_type"] = stats.get("topPlaceType", "未知")

            return _json.dumps(features, ensure_ascii=False)

    def get_system_prompt(self) -> str:
        return (
            "你是旅行人格分析师。根据用户的行为数据，用温暖、有趣的语气描述"
            "用户的旅行风格，像 Spotify Wrapped 那样给人惊喜感。"
            "不要用数据堆砌，而是用故事化的语言让用户感到'这说的就是我！'"
        )

    def get_tools(self) -> list[dict[str, Any]]:
        return registry.get_definitions()

    def can_handle(self, intent: str) -> bool:
        return intent == "analyze_personality"

    def process(self, message: str, context: AgentContext) -> AgentResponse:
        user_id = context.user_id

        # 尝试从后端获取真实数据
        features = self._collect_features(user_id)

        # 规则引擎：根据特征映射人格
        persona = self._classify_persona(features)

        # 生成描述
        description = persona["description_template"].format(
            total_places=features.get("total_places", "?"),
            total_foods=features.get("total_foods", "?"),
            total_diaries=features.get("total_diaries", "?"),
            favorite_cuisine=features.get("favorite_cuisine", "未知"),
            favorite_place_type=features.get("favorite_place_type", "未知"),
            avg_rating=round(features.get("avg_rating", 4.0), 1),
        )

        # LLM 增强
        if llm_available():
            client = get_llm()
            if client:
                try:
                    msgs = [
                        {"role": "system", "content": self.get_system_prompt()},
                        {"role": "user", "content": (
                            f"用户数据: {features}\n"
                            f"规则判定人格: {persona['name']}\n"
                            f"规则生成描述: {description}\n\n"
                            "请基于数据写一段更有温度的旅行人格描述（3-4句），"
                            "然后给一条具体的旅行建议。"
                            "返回 JSON 格式: "
                            '{"persona": "人格名", "description": "描述", "recommendation": "建议"}'
                        )},
                    ]
                    result = client.chat(msgs, max_tokens=400)
                    parsed = _parse_json(result.content or "")
                    if parsed:
                        description = parsed.get("description", description)
                        persona["recommendation"] = parsed.get("recommendation", persona["recommendation"])
                except Exception:
                    pass

        content = (
            f"{persona['icon']} 你的旅行人格：**{persona['name']}**\n\n"
            f"{description}\n\n"
            f"📊 数据一览:\n"
            f"  - 浏览过的地点: {features.get('total_places', '?')}\n"
            f"  - 浏览过的美食: {features.get('total_foods', '?')}\n"
            f"  - 平均评分: {round(features.get('avg_rating', 4.0), 1)}\n"
            f"  - 最爱菜系: {features.get('favorite_cuisine', '未知')}\n\n"
            f"💡 {persona['recommendation']}"
        )

        return AgentResponse(
            content=content,
            intent="analyze_personality",
            suggestions=["查看完整画像", "基于人格推荐路线", "换个风格试试"],
            tools_used=["persona_rule_engine"] + (["llm"] if llm_available() else []),
            metadata={
                "persona": persona["name"],
                "persona_key": features.get("persona_key", "unknown"),
                "features": features,
            },
        )

    @staticmethod
    def _collect_features(user_id: str) -> dict[str, Any]:
        """从后端或降级规则收集用户特征。"""
        features = {
            "total_places": 0,
            "total_foods": 0,
            "total_diaries": 0,
            "avg_rating": 4.0,
            "favorite_cuisine": "未知",
            "favorite_place_type": "未知",
            "active_hours": [],
            "keywords": [],
        }
        try:
            behavior = tourism_api_client.get_user_behavior(user_id)
            if behavior:
                features["total_places"] = behavior.get("placeViews", features["total_places"])
                features["total_foods"] = behavior.get("foodViews", features["total_foods"])
                features["total_diaries"] = behavior.get("diaryCount", features["total_diaries"])
                features["active_hours"] = behavior.get("activeHours", [])
                features["keywords"] = behavior.get("keywords", [])
        except Exception:
            pass

        try:
            ratings = tourism_api_client.get_user_ratings(user_id)
            if ratings:
                vals = [r.get("rating", 0) for r in ratings if isinstance(r, dict)]
                if vals:
                    features["avg_rating"] = sum(vals) / len(vals)
        except Exception:
            pass

        try:
            stats = tourism_api_client.get_stats()
            if stats:
                features["favorite_cuisine"] = stats.get("topCuisine", features["favorite_cuisine"])
                features["favorite_place_type"] = stats.get("topPlaceType", features["favorite_place_type"])
        except Exception:
            pass

        return features

    @staticmethod
    def _classify_persona(features: dict[str, Any]) -> dict[str, Any]:
        """规则引擎：根据特征向量映射人格类型。"""
        total_places = features.get("total_places", 0)
        total_foods = features.get("total_foods", 0)
        total = max(total_places + total_foods, 1)
        food_ratio = total_foods / total
        keywords = [k.lower() for k in features.get("keywords", [])]
        active_hours = features.get("active_hours", [])

        # keyword signals are stronger than ratio
        if any(kw in keywords for kw in ["拍照", "摄影", "好看", "风景", "照片"]):
            return PERSONA_TYPES["photo_wanderer"]
        if any(kw in keywords for kw in ["博物馆", "历史", "文化", "古迹", "展览"]):
            return PERSONA_TYPES["culture_explorer"]
        if food_ratio > 0.4:
            return PERSONA_TYPES["food_hunter"]
        if total_places >= 10 and len(active_hours) >= 3:
            return PERSONA_TYPES["efficient_pacer"]
        if total_places > 0 and total_places < 6:
            return PERSONA_TYPES["leisure_dreamer"]

        # 随机选一个作为默认
        import random
        return random.choice(list(PERSONA_TYPES.values()))


def _parse_json(raw: str) -> dict[str, Any]:
    """从 LLM 文本中提取 JSON 对象。"""
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or start >= end:
        return {}
    import json as _json
    try:
        return _json.loads(raw[start:end + 1])
    except (_json.JSONDecodeError, TypeError):
        return {}
