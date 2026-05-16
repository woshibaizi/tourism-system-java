"""
扔骰子旅行 Agent — 随机微任务生成器。

基于用户位置周边的真实场所和美食，从任务模板池中随机选取模板并填充槽位。
"""

from __future__ import annotations

import json
import logging
import random
from typing import Any

from app.agent.base_agent import AgentContext, AgentResponse, BaseAgent
from app.core.llm import get_llm, llm_available
from app.tools.registry import registry
from app.tools.tourism_api import tourism_api_client

logger = logging.getLogger(__name__)

# 任务模板池
TASK_TEMPLATES = [
    {
        "task": "找到离你最近的{place_type}，拍下{feature}",
        "then": "然后去吃一份你没吃过的{cuisine}",
        "note": "用三个emoji记录此刻心情并写一句话",
        "time_limit_minutes": 30,
        "penalty": "超时请发朋友圈说'我输了'",
    },
    {
        "task": "走向{direction}遇到的第一个{color}招牌的店",
        "then": "进去点一份招牌菜并拍照",
        "note": "如果店没开门，就继续往{direction}走，下一个有眼缘的店就是你的目标",
        "time_limit_minutes": 20,
        "penalty": "没完成的话请同行的人喝奶茶",
    },
    {
        "task": "在{place_name}里找到最丑的建筑并合影",
        "then": "发朋友圈让大家猜这是哪，第一个猜对的请吃饭",
        "note": "丑得有特色的也算！关键是你的发现",
        "time_limit_minutes": 25,
        "penalty": "找不到的话就拍一张最美的建筑代替",
    },
    {
        "task": "找一个{place_type}坐下来，观察路过的人",
        "then": "给第{number}个路过的人编一个背景故事",
        "note": "故事要有细节：TA从哪来，要往哪去，为什么出现在这里",
        "time_limit_minutes": 15,
        "penalty": "没有惩罚，但建议把这个故事写成一篇小红书",
    },
    {
        "task": "找到{place_name}附近评论最多的一家{cuisine}店",
        "then": "点评论里提到最多的那道菜",
        "note": "不要看评分，只看评论数——群众的脚比钱包诚实",
        "time_limit_minutes": 45,
        "penalty": "如果不好吃，拍照留证并写一条差评",
    },
    {
        "task": "在{place_name}找一处可以{activity}的地方，待够15分钟",
        "then": "记录下这15分钟里你注意到的3个细节",
        "note": "细节可以是：风吹树叶的声音/墙上某个涂鸦/路过的一条狗",
        "time_limit_minutes": 30,
        "penalty": "没待够就走的话，明天再来一次",
    },
    {
        "task": "随机选一个方向走{steps}步，停下看到的第一个{target}就是你的目的地",
        "then": "在这个地方做一件和平时不一样的事",
        "note": "如果走到了死胡同，恭喜你——这个任务以失败告终，但你可以拍下死胡同的照片留念",
        "time_limit_minutes": 20,
        "penalty": "自拍一张鬼脸发群里",
    },
    {
        "task": "找到离{place_name}最近的一棵大树",
        "then": "在树下许一个愿，拍下树影",
        "note": "认真许愿才有效！如果你笑了，愿望就不灵了",
        "time_limit_minutes": 15,
        "penalty": "下次来这棵树的时候要带一个朋友一起来许愿",
    },
]

FILLERS = {
    "place_type": ["咖啡馆", "图书馆", "便利店", "食堂", "花园", "喷泉", "操场", "书店"],
    "feature": ["阳光透过窗户的样子", "墙上的涂鸦", "门口的标志", "最好看的角度", "最热闹的一刻"],
    "cuisine": ["川菜", "粤菜", "日料", "甜品", "奶茶", "烧烤", "小吃", "面食"],
    "direction": ["向东", "向南", "向西", "向北", "左转", "右转"],
    "color": ["红色", "蓝色", "绿色", "黄色", "白色", "原木色"],
    "number": ["3", "5", "7", "9", "13"],
    "activity": ["坐下来什么都不做", "看日落", "听音乐", "读一本书", "画一幅速写"],
    "steps": ["50", "100", "200", "333", "500"],
    "target": ["建筑", "路牌", "树", "路灯", "店铺", "长椅"],
}


class DiceAgent(BaseAgent):
    """扔骰子旅行 — 随机微任务生成器。"""

    @property
    def name(self) -> str:
        return "dice"

    @property
    def description(self) -> str:
        return "扔骰子旅行：生成随机微任务，基于真实地点和美食数据"

    def __init__(self) -> None:
        self._register_tools()

    def _register_tools(self) -> None:
        @registry.register(
            name="get_nearby_places",
            description="获取当前位置附近的场所列表",
            parameters={
                "type": "object",
                "properties": {
                    "lat": {"type": "number", "description": "纬度"},
                    "lng": {"type": "number", "description": "经度"},
                    "radius": {"type": "number", "description": "搜索半径（米），默认3000"},
                },
                "required": ["lat", "lng"],
            },
        )
        def get_nearby_places(lat: float, lng: float, radius: float = 3000) -> str:
            facilities = tourism_api_client.get_nearest_facilities(lat, lng)
            if not facilities:
                places = tourism_api_client.get_hot_places(8)
                names = [p.get("name", "") for p in places if p.get("name")]
                return "\n".join(names) if names else "暂无附近地点"
            import json as _json
            return _json.dumps([
                {"name": f.get("name"), "type": f.get("type", "未知"), "distance": f.get("distance", 0)}
                for f in facilities[:8]
            ], ensure_ascii=False)

        @registry.register(
            name="get_nearby_foods",
            description="获取附近美食列表",
            parameters={
                "type": "object",
                "properties": {
                    "lat": {"type": "number", "description": "纬度"},
                    "lng": {"type": "number", "description": "经度"},
                },
                "required": ["lat", "lng"],
            },
        )
        def get_nearby_foods(lat: float, lng: float) -> str:
            foods = tourism_api_client.get_hot_foods(10)
            if not foods:
                return "暂无美食数据"
            import json as _json
            return _json.dumps([
                {"name": f.get("name", ""), "price": f.get("price", 0), "cuisine": f.get("description", "")[:20]}
                for f in foods[:8] if f.get("name")
            ], ensure_ascii=False)

        @registry.register(
            name="get_random_task_template",
            description="从任务模板池中随机选取一个任务模板",
            parameters={
                "type": "object",
                "properties": {},
                "required": [],
            },
        )
        def get_random_task_template() -> str:
            template = random.choice(TASK_TEMPLATES)
            return json.dumps(template, ensure_ascii=False)

    def get_system_prompt(self) -> str:
        return (
            "你是'扔骰子旅行'任务生成器。你会生成有趣、随机的微任务，"
            "让用户的旅行充满惊喜和意外。任务要有趣但不危险，简单但有仪式感。"
            "基于真实的地点数据填充任务中的槽位。"
        )

    def get_tools(self) -> list[dict[str, Any]]:
        return registry.get_definitions()

    def can_handle(self, intent: str) -> bool:
        return intent == "dice_adventure"

    def process(self, message: str, context: AgentContext) -> AgentResponse:
        lat = context.metadata.get("lat", 30.259)
        lng = context.metadata.get("lng", 120.149)

        # 获取真实地点数据
        nearby_places = self._get_place_names(lat, lng)
        nearby_foods = self._get_food_names()

        # 随机选模板
        template = random.choice(TASK_TEMPLATES)

        # 填充槽位
        place_name = random.choice(nearby_places) if nearby_places else "附近"
        place_type = random.choice(FILLERS["place_type"])
        cuisine = random.choice(FILLERS["cuisine"])
        if nearby_foods:
            cuisine = random.choice(nearby_foods)

        filled_task = template["task"].format(
            place_type=place_type,
            place_name=place_name,
            feature=random.choice(FILLERS["feature"]),
            direction=random.choice(FILLERS["direction"]),
            color=random.choice(FILLERS["color"]),
            cuisine=cuisine,
            number=random.choice(FILLERS["number"]),
            activity=random.choice(FILLERS["activity"]),
            steps=random.choice(FILLERS["steps"]),
            target=random.choice(FILLERS["target"]),
        )
        filled_then = _safe_format(template["then"], **{
            "direction": random.choice(FILLERS["direction"]),
            "cuisine": cuisine,
            "place_name": place_name,
            "place_type": place_type,
        })

        dice_value = random.randint(1, 6)

        result = {
            "dice_value": dice_value,
            "task": filled_task,
            "then": filled_then,
            "note": template["note"],
            "time_limit_minutes": template["time_limit_minutes"],
            "penalty": template["penalty"],
        }

        # LLM 增强
        if llm_available():
            client = get_llm()
            if client:
                try:
                    msgs = [
                        {"role": "system", "content": self.get_system_prompt()},
                        {"role": "user", "content": (
                            f"用户掷出了骰子点数: {dice_value}\n"
                            f"附近地点: {', '.join(nearby_places[:5]) if nearby_places else '未知'}\n"
                            f"附近美食: {', '.join(nearby_foods[:5]) if nearby_foods else '未知'}\n\n"
                            "请基于以上数据生成一个有趣的随机微任务。返回 JSON 格式（不要其他文字）：\n"
                            '{"task": "任务描述（一句话）", "then": "完成后的下一步", '
                            '"note": "备注/提示", "time_limit_minutes": 30, "penalty": "惩罚"}'
                        )},
                    ]
                    llm_result = client.chat(msgs, max_tokens=400)
                    parsed = _parse_json(llm_result.content or "")
                    if parsed and parsed.get("task"):
                        result.update(parsed)
                except Exception:
                    pass

        content = (
            f"🎲 你掷出了 **{dice_value}** 点！\n\n"
            f"**任务**: {result['task']}\n\n"
            f"**然后**: {result['then']}\n\n"
            f"📝 {result['note']}\n\n"
            f"⏱ 限时: {result['time_limit_minutes']} 分钟\n"
            f"💀 惩罚: {result['penalty']}"
        )

        return AgentResponse(
            content=content,
            intent="dice_adventure",
            suggestions=["再来一次 🎲", "换个任务", "记录完成"],
            tools_used=["dice_agent"] + (["llm"] if llm_available() else []),
            metadata={"dice_result": result},
        )

    @staticmethod
    def _get_place_names(lat: float, lng: float) -> list[str]:
        try:
            places = tourism_api_client.get_hot_places(8)
            return [p.get("name", "") for p in places if p.get("name")]
        except Exception:
            return []

    @staticmethod
    def _get_food_names() -> list[str]:
        try:
            foods = tourism_api_client.get_hot_foods(8)
            return [f.get("name", "") for f in foods if f.get("name")]
        except Exception:
            return []


def _safe_format(template: str, **kwargs) -> str:
    """安全格式化，忽略缺失的占位符。"""
    try:
        return template.format(**kwargs)
    except KeyError:
        import re
        for key, val in kwargs.items():
            template = template.replace("{" + key + "}", str(val))
        return re.sub(r"\{[^}]*\}", "这里", template)


def _parse_json(raw: str) -> dict[str, Any]:
    """从 LLM 文本中提取 JSON 对象。"""
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or start >= end:
        return {}
    try:
        return json.loads(raw[start:end + 1])
    except (json.JSONDecodeError, TypeError):
        return {}
