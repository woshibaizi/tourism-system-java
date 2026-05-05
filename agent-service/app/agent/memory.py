from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from app.config import settings
from app.schemas import ChatMessage, SessionDetail, SessionSummary


def utcnow() -> datetime:
    return datetime.utcnow()


@dataclass
class SessionRecord:
    """单个会话在内存中的存储结构。"""

    session_id: str
    user_id: str
    title: str
    preview: str
    mode: str
    created_at: datetime
    updated_at: datetime
    messages: list[ChatMessage] = field(default_factory=list)

    def to_summary(self) -> SessionSummary:
        return SessionSummary(
            session_id=self.session_id,
            user_id=self.user_id,
            title=self.title,
            preview=self.preview,
            mode=self.mode,
            created_at=self.created_at,
            updated_at=self.updated_at,
            message_count=len(self.messages),
        )

    def to_detail(self) -> SessionDetail:
        summary = self.to_summary()
        return SessionDetail(**summary.model_dump(), messages=self.messages)


class SessionStore:
    def __init__(self, trace_dir: Path) -> None:
        # 当前版本先使用进程内字典保存会话，后续可替换为 Redis / 数据库。
        self._sessions: dict[str, SessionRecord] = {}
        self._trace_file = trace_dir / "agent_trace.jsonl"
        self._trace_file.parent.mkdir(parents=True, exist_ok=True)

    def list_sessions(self, user_id: str) -> list[SessionSummary]:
        """只返回当前用户自己的会话摘要，避免历史会话串给其他用户。"""
        items = [
            session.to_summary()
            for session in self._sessions.values()
            if session.user_id == user_id
        ]
        return sorted(items, key=lambda item: item.updated_at, reverse=True)

    def get_session(self, user_id: str, session_id: str) -> SessionDetail | None:
        """按用户 + 会话 ID 双重约束读取详情。"""
        session = self._sessions.get(session_id)
        if session is None or session.user_id != user_id:
            return None
        return session.to_detail()

    def create_or_get_session(self, user_id: str, session_id: str | None, mode: str, first_message: str) -> SessionRecord:
        """
        获取现有会话或创建新会话。

        这里必须校验 session_id 的归属，防止用户伪造他人的 session_id 后串读/串写会话内容。
        """
        if session_id and session_id in self._sessions:
            existing_session = self._sessions[session_id]
            if existing_session.user_id != user_id:
                raise PermissionError("session does not belong to current user")
            return existing_session

        now = utcnow()
        new_session_id = session_id or f"session_{uuid.uuid4().hex[:12]}"
        title = self._build_title(first_message)
        record = SessionRecord(
            session_id=new_session_id,
            user_id=user_id,
            title=title,
            preview=first_message[:80],
            mode=mode,
            created_at=now,
            updated_at=now,
        )
        self._sessions[new_session_id] = record
        return record

    def append_messages(self, session: SessionRecord, user_message: str, assistant_message: str) -> SessionDetail:
        """
        将一问一答追加到会话中。

        现阶段前端展示的是双消息流，因此这里一次性落两条消息，保持会话详情结构稳定。
        """
        now = utcnow()
        session.messages.append(ChatMessage(role="user", content=user_message, created_at=now))
        session.messages.append(ChatMessage(role="assistant", content=assistant_message, created_at=now))
        session.updated_at = now
        if session.title == "新对话":
            session.title = self._build_title(user_message)
        session.preview = assistant_message[:80]
        return session.to_detail()

    def append_trace(self, payload: dict) -> None:
        """将每轮请求的最小 trace 追加到 jsonl，方便后续评测与排障。"""
        with self._trace_file.open("a", encoding="utf-8") as trace_file:
            trace_file.write(json.dumps(payload, ensure_ascii=False, default=str))
            trace_file.write("\n")

    @staticmethod
    def _build_title(message: str) -> str:
        normalized = " ".join(message.strip().split())
        if not normalized:
            return "新对话"
        return normalized[:18]


session_store = SessionStore(settings.trace_dir)
