"""
Agent 模块初始化 — 注册 OrchestratorAgent 为统一入口。

架构层次:
  Dispatcher (HTTP 路由)
    └─ OrchestratorAgent (意图分类 + 子Agent调度 + SSE透传)
         ├─ ChatAgent     (闲聊 + 搭子人格 + 日记提议)
         ├─ DiscoverAgent (搜索/推荐/周边/小红书)
         └─ RouteAgent    (路线规划 5 工具)

DiaryAgent 通过专用端点 /agent/diary/* 直接调用，不经过 Orchestrator。
"""

from app.agent.dispatcher import Dispatcher, dispatcher
from app.agent.diary_agent import DiaryAgent
from app.agent.orchestrator_agent import OrchestratorAgent


def init_agents() -> Dispatcher:
    """注册 OrchestratorAgent（统一入口）+ DiaryAgent（专用端点）+ XHS Tools。"""
    # OrchestratorAgent 覆盖所有意图，是对话的唯一入口
    # 子 Agent (Chat/Discover/Route) 由 Orchestrator 内部管理，不直接注册
    dispatcher.register(
        OrchestratorAgent(),
        intents=[
            "plan_trip_route", "recommend_place", "search_place",
            "reverse_recommend", "generate_diary", "general_chat",
        ],
    )
    # DiaryAgent 仅通过专用端点 /agent/diary/* 直接调用
    dispatcher.register(DiaryAgent(), intents=[])

    # 注册小红书 Agent Tools（归属 DiscoverAgent — Orchestrator 初始化时自动注册）
    try:
        from app.tools.xhs_tool import register_xhs_tools
        register_xhs_tools()
    except ImportError as e:
        import logging
        logging.getLogger(__name__).warning(
            "XHS tools not registered — XhsSkills runtime unavailable: %s", e
        )
    except Exception:
        import logging
        logging.getLogger(__name__).exception(
            "XHS tools registration failed with unexpected error"
        )

    return dispatcher
