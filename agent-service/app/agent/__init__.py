"""
Agent 模块初始化 — 注册所有 Agent 到 Dispatcher。
"""

from app.agent.dispatcher import Dispatcher, dispatcher
from app.agent.chat_agent import ChatAgent
from app.agent.diary_agent import DiaryAgent
from app.agent.route_agent import RouteAgent
from app.agent.scene_agent import SceneAgent
from app.agent.dice_agent import DiceAgent
from app.agent.persona_agent import PersonaAgent
from app.agent.memory_agent import MemoryAgent


def init_agents() -> Dispatcher:
    """注册所有 Agent（8 个），返回 Dispatcher 实例。"""
    dispatcher.register(ChatAgent(), intents=["plan_trip_route", "recommend_place", "general_chat", "search_place", "reverse_recommend"])
    dispatcher.register(RouteAgent(), intents=["plan_trip_route"])
    dispatcher.register(DiaryAgent(), intents=["generate_diary"])
    dispatcher.register(SceneAgent(), intents=["scene_recommend"])
    dispatcher.register(DiceAgent(), intents=["dice_adventure"])
    dispatcher.register(PersonaAgent(), intents=["analyze_personality"])
    dispatcher.register(MemoryAgent(), intents=["generate_memory"])
    return dispatcher
