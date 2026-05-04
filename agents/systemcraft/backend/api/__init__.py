"""
SystemCraft API Module
=======================
FastAPI routes and WebSocket handlers.
"""

from api.routes import router as api_router
from api.websocket import router as ws_router

__all__ = ["api_router", "ws_router"]
