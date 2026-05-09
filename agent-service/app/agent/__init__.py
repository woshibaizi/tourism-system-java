"""
Agent 模块初始化 — 注册所有 Agent 到 Dispatcher。
"""

from app.agent.dispatcher import Dispatcher, dispatcher
from app.agent.chat_agent import ChatAgent
from app.agent.diary_agent import DiaryAgent


def init_agents() -> Dispatcher:
    """注册所有 Agent，返回 Dispatcher 实例。"""
    dispatcher.register(ChatAgent(), intents=["plan_trip_route", "recommend_place", "general_chat"])
    dispatcher.register(DiaryAgent(), intents=["generate_diary"])
    return dispatcher
