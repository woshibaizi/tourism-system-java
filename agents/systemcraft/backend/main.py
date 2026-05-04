"""
SystemCraft Backend - FastAPI Entry Point
==========================================
Start:  python main.py
  or:   uvicorn main:app --reload --port 8000

API Docs: http://localhost:8000/docs
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router as api_router
from api.websocket import router as ws_router
from config import validate_config, DEBUG

# ── Validate config on startup ──
validate_config()

# ── Create FastAPI app ──
app = FastAPI(
    title="SystemCraft API",
    description="Multi-Agent Software Engineering Learning Platform",
    version="0.2.0",
)

# ── CORS middleware (allows frontend to connect) ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # In production, restrict to your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routes ──
app.include_router(api_router)
app.include_router(ws_router)


@app.get("/")
async def root():
    return {
        "name": "SystemCraft API",
        "version": "0.2.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


# ── Run with: python main.py ──
if __name__ == "__main__":
    import uvicorn
    print("\n" + "=" * 50)
    print("  SystemCraft Backend Starting...")
    print("  API Docs: http://localhost:8000/docs")
    print("=" * 50 + "\n")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=DEBUG)
