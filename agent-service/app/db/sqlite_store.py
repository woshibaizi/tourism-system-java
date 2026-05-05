"""
SQLite 会话持久化存储。

仿 hermes-agent SessionDB 设计：
- WAL 模式，支持并发读
- 用户隔离，session_id + user_id 双重校验
- 消息完整持久化，服务重启不丢失
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)


def _utcnow() -> str:
    return datetime.utcnow().isoformat()


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS sessions (
    session_id  TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    title       TEXT NOT NULL DEFAULT '新对话',
    preview     TEXT NOT NULL DEFAULT '',
    mode        TEXT NOT NULL DEFAULT 'travel_assistant',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    role        TEXT NOT NULL,
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_session
    ON messages(session_id, id);

CREATE INDEX IF NOT EXISTS idx_sessions_user
    ON sessions(user_id, updated_at DESC);
"""


class SessionDB:
    """SQLite 会话存储，线程安全。"""

    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path
        self._lock = threading.Lock()
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self._db_path), check_same_thread=False)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._get_conn() as conn:
            conn.executescript(SCHEMA_SQL)

    # ==================== 会话操作 ====================

    def list_sessions(self, user_id: str) -> list[dict[str, Any]]:
        with self._get_conn() as conn:
            rows = conn.execute(
                "SELECT session_id, user_id, title, preview, mode, created_at, updated_at, "
                "(SELECT COUNT(*) FROM messages WHERE messages.session_id = sessions.session_id) AS message_count "
                "FROM sessions WHERE user_id = ? ORDER BY updated_at DESC",
                (user_id,),
            ).fetchall()
            return [dict(r) for r in rows]

    def get_session(self, user_id: str, session_id: str) -> dict[str, Any] | None:
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT session_id, user_id, title, preview, mode, created_at, updated_at, "
                "(SELECT COUNT(*) FROM messages WHERE messages.session_id = sessions.session_id) AS message_count "
                "FROM sessions WHERE session_id = ? AND user_id = ?",
                (session_id, user_id),
            ).fetchone()
            if row is None:
                return None
            result = dict(row)
            msgs = conn.execute(
                "SELECT role, content, created_at FROM messages WHERE session_id = ? ORDER BY id ASC",
                (session_id,),
            ).fetchall()
            result["messages"] = [dict(m) for m in msgs]
            return result

    def create_or_get_session(
        self, user_id: str, session_id: str | None, mode: str, first_message: str
    ) -> dict[str, Any]:
        with self._lock:
            with self._get_conn() as conn:
                if session_id:
                    row = conn.execute(
                        "SELECT session_id FROM sessions WHERE session_id = ? AND user_id = ?",
                        (session_id, user_id),
                    ).fetchone()
                    if row is None:
                        raise PermissionError("session does not belong to current user")
                    return self.get_session(user_id, session_id)  # type: ignore

                new_id = session_id or f"session_{uuid.uuid4().hex[:12]}"
                now = _utcnow()
                title = first_message[:18] if first_message.strip() else "新对话"
                conn.execute(
                    "INSERT INTO sessions (session_id, user_id, title, preview, mode, created_at, updated_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (new_id, user_id, title, first_message[:80], mode, now, now),
                )
                return {
                    "session_id": new_id,
                    "user_id": user_id,
                    "title": title,
                    "preview": first_message[:80],
                    "mode": mode,
                    "created_at": now,
                    "updated_at": now,
                    "message_count": 0,
                    "messages": [],
                }

    def append_messages(self, session_id: str, user_message: str, assistant_message: str) -> dict[str, Any]:
        with self._lock:
            with self._get_conn() as conn:
                session = conn.execute(
                    "SELECT user_id, title FROM sessions WHERE session_id = ?",
                    (session_id,),
                ).fetchone()
                if session is None:
                    raise ValueError("session not found")

                now = _utcnow()
                conn.execute(
                    "INSERT INTO messages (session_id, role, content, created_at) VALUES (?, 'user', ?, ?)",
                    (session_id, user_message, now),
                )
                conn.execute(
                    "INSERT INTO messages (session_id, role, content, created_at) VALUES (?, 'assistant', ?, ?)",
                    (session_id, assistant_message, now),
                )

                title = session["title"]
                if title == "新对话":
                    title = user_message[:18] if user_message.strip() else "新对话"

                conn.execute(
                    "UPDATE sessions SET preview = ?, title = ?, updated_at = ? WHERE session_id = ?",
                    (assistant_message[:80], title, now, session_id),
                )
                conn.commit()

                # 在同一连接上读取（避免 WAL 模式下未提交不可见的问题）
                row = conn.execute(
                    "SELECT session_id, user_id, title, preview, mode, created_at, updated_at, "
                    "(SELECT COUNT(*) FROM messages WHERE messages.session_id = sessions.session_id) AS message_count "
                    "FROM sessions WHERE session_id = ?",
                    (session_id,),
                ).fetchone()
                result = dict(row)
                msgs = conn.execute(
                    "SELECT role, content, created_at FROM messages WHERE session_id = ? ORDER BY id ASC",
                    (session_id,),
                ).fetchall()
                result["messages"] = [dict(m) for m in msgs]
                return result

    def delete_session(self, user_id: str, session_id: str) -> bool:
        with self._lock:
            with self._get_conn() as conn:
                cur = conn.execute(
                    "DELETE FROM sessions WHERE session_id = ? AND user_id = ?",
                    (session_id, user_id),
                )
                return cur.rowcount > 0

    def rename_session(self, user_id: str, session_id: str, title: str) -> bool:
        with self._lock:
            with self._get_conn() as conn:
                cur = conn.execute(
                    "UPDATE sessions SET title = ?, updated_at = ? WHERE session_id = ? AND user_id = ?",
                    (title, _utcnow(), session_id, user_id),
                )
                return cur.rowcount > 0

    # ==================== trace 写入（保留兼容） ====================

    def append_trace(self, payload: dict[str, Any]) -> None:
        trace_file = settings.trace_dir / "agent_trace.jsonl"
        trace_file.parent.mkdir(parents=True, exist_ok=True)
        with trace_file.open("a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=False, default=str))
            f.write("\n")


# 模块级单例
_session_db: SessionDB | None = None


def _get_db_path() -> Path:
    db_dir = Path(os.getenv("AGENT_DB_DIR", str(Path(__file__).resolve().parent.parent.parent / "data")))
    return (db_dir / "agent_sessions.db").resolve()


def _create_session_db() -> SessionDB:
    global _session_db
    if _session_db is None:
        _session_db = SessionDB(_get_db_path())
    return _session_db


session_db = _create_session_db()
