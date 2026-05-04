"""
SQLite-backed persistence for SystemCraft projects and authentication.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import secrets
import sqlite3
import threading
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

PROJECT_DATABASE_PATH = Path(__file__).resolve().parent / "data" / "systemcraft.db"
_DB_LOCK = threading.Lock()
SESSION_TTL_DAYS = 30
LEGACY_USER_ID = "legacy-default"
LEGACY_USER_NAME = "Legacy Workspace"

_PROJECT_COLUMN_DEFINITIONS = {
    "owner_user_id": f"TEXT NOT NULL DEFAULT '{LEGACY_USER_ID}'",
    "description": "TEXT NOT NULL DEFAULT ''",
    "difficulty": "TEXT NOT NULL DEFAULT 'medium'",
    "status": "TEXT NOT NULL DEFAULT 'queued'",
    "current_stage": "TEXT NOT NULL DEFAULT 'init'",
    "status_detail": "TEXT NOT NULL DEFAULT ''",
    "progress_percent": "INTEGER NOT NULL DEFAULT 0",
    "progress_message": "TEXT NOT NULL DEFAULT ''",
    "project_name": "TEXT NOT NULL DEFAULT ''",
    "requirements_doc": "TEXT NOT NULL DEFAULT ''",
    "architecture_doc": "TEXT NOT NULL DEFAULT ''",
    "code_artifacts": "TEXT NOT NULL DEFAULT ''",
    "test_report": "TEXT NOT NULL DEFAULT ''",
    "mentor_notes": "TEXT NOT NULL DEFAULT ''",
    "knowledge_cards": "TEXT NOT NULL DEFAULT ''",
    "iteration_count": "INTEGER NOT NULL DEFAULT 0",
    "next_stage": "TEXT",
    "state_json": "TEXT NOT NULL DEFAULT '{}'",
    "updated_at": "TEXT NOT NULL DEFAULT ''",
    "payload_json": "TEXT NOT NULL DEFAULT '{}'",
}

_USER_COLUMN_DEFINITIONS = {
    "username": "TEXT",
    "password_hash": "TEXT NOT NULL DEFAULT ''",
    "password_salt": "TEXT NOT NULL DEFAULT ''",
    "last_login_at": "TEXT NOT NULL DEFAULT ''",
    "is_legacy": "INTEGER NOT NULL DEFAULT 0",
}


def init_project_store():
    PROJECT_DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)

    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL DEFAULT '',
                username TEXT UNIQUE,
                password_hash TEXT NOT NULL DEFAULT '',
                password_salt TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT '',
                last_login_at TEXT NOT NULL DEFAULT '',
                is_legacy INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        _ensure_user_columns(conn)
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT '',
                expires_at TEXT NOT NULL DEFAULT '',
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)"
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                owner_user_id TEXT NOT NULL DEFAULT 'legacy-default',
                description TEXT NOT NULL DEFAULT '',
                difficulty TEXT NOT NULL DEFAULT 'medium',
                status TEXT NOT NULL DEFAULT 'queued',
                current_stage TEXT NOT NULL DEFAULT 'init',
                status_detail TEXT NOT NULL DEFAULT '',
                progress_percent INTEGER NOT NULL DEFAULT 0,
                progress_message TEXT NOT NULL DEFAULT '',
                project_name TEXT NOT NULL DEFAULT '',
                requirements_doc TEXT NOT NULL DEFAULT '',
                architecture_doc TEXT NOT NULL DEFAULT '',
                code_artifacts TEXT NOT NULL DEFAULT '',
                test_report TEXT NOT NULL DEFAULT '',
                mentor_notes TEXT NOT NULL DEFAULT '',
                knowledge_cards TEXT NOT NULL DEFAULT '',
                iteration_count INTEGER NOT NULL DEFAULT 0,
                next_stage TEXT,
                state_json TEXT NOT NULL DEFAULT '{}',
                updated_at TEXT NOT NULL DEFAULT '',
                payload_json TEXT NOT NULL DEFAULT '{}'
            )
            """
        )
        _ensure_project_columns(conn)
        legacy_user = _ensure_legacy_user(conn)
        _ensure_project_owners(conn, legacy_user["id"])
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS agent_messages (
                project_id TEXT NOT NULL,
                message_index INTEGER NOT NULL,
                agent_role TEXT NOT NULL DEFAULT '',
                agent_name TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL DEFAULT '',
                stage TEXT NOT NULL DEFAULT '',
                msg_type TEXT NOT NULL DEFAULT 'output',
                payload_json TEXT NOT NULL DEFAULT '{}',
                PRIMARY KEY (project_id, message_index),
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS learning_chat (
                project_id TEXT NOT NULL,
                message_index INTEGER NOT NULL,
                message_id TEXT NOT NULL DEFAULT '',
                role TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL DEFAULT '',
                added_to_knowledge_cards INTEGER NOT NULL DEFAULT 0,
                payload_json TEXT NOT NULL DEFAULT '{}',
                PRIMARY KEY (project_id, message_index),
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
            """
        )
        conn.commit()


def register_user_account(display_name: str, username: str, password: str) -> dict:
    normalized_display_name = " ".join(display_name.strip().split())
    normalized_username = username.strip().lower()
    _validate_account_credentials(normalized_display_name, normalized_username, password)

    init_project_store()

    with _DB_LOCK:
        with _connect() as conn:
            _ensure_legacy_user(conn)
            existing_row = conn.execute(
                """
                SELECT id, name, username, created_at, last_login_at, is_legacy
                FROM users
                WHERE lower(username) = lower(?)
                """,
                (normalized_username,),
            ).fetchone()
            if existing_row:
                raise ValueError("Username already exists")

            created_at = _utc_now()
            password_salt = secrets.token_hex(16)
            password_hash = _hash_password(password, password_salt)
            user = {
                "id": str(uuid.uuid4())[:8],
                "name": normalized_display_name,
                "username": normalized_username,
                "created_at": created_at,
                "last_login_at": created_at,
                "is_legacy": 0,
            }
            try:
                conn.execute(
                    """
                    INSERT INTO users (
                        id,
                        name,
                        username,
                        password_hash,
                        password_salt,
                        created_at,
                        last_login_at,
                        is_legacy
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        user["id"],
                        user["name"],
                        user["username"],
                        password_hash,
                        password_salt,
                        user["created_at"],
                        user["last_login_at"],
                        user["is_legacy"],
                    ),
                )
            except sqlite3.IntegrityError as exc:
                raise ValueError(
                    "This display name or username is already in use"
                ) from exc

            if _count_registered_users(conn) == 1:
                _transfer_projects(conn, LEGACY_USER_ID, user["id"])

            conn.commit()

    return user


def authenticate_user(username: str, password: str) -> dict | None:
    normalized_username = username.strip().lower()
    if not normalized_username or not password:
        return None

    init_project_store()

    with _DB_LOCK:
        with _connect() as conn:
            row = conn.execute(
                """
                SELECT id, name, username, password_hash, password_salt, created_at, last_login_at, is_legacy
                FROM users
                WHERE lower(username) = lower(?) AND is_legacy = 0
                """,
                (normalized_username,),
            ).fetchone()
            if not row:
                return None

            expected_hash = _hash_password(password, row["password_salt"])
            if not hmac.compare_digest(expected_hash, row["password_hash"]):
                return None

            last_login_at = _utc_now()
            conn.execute(
                "UPDATE users SET last_login_at = ? WHERE id = ?",
                (last_login_at, row["id"]),
            )
            conn.commit()

            user = _row_to_user(row)
            user["last_login_at"] = last_login_at
            return user


def update_user_profile(user_id: str, display_name: str, username: str) -> dict:
    normalized_display_name = " ".join(display_name.strip().split())
    normalized_username = username.strip().lower()
    _validate_account_profile(normalized_display_name, normalized_username)

    init_project_store()

    with _DB_LOCK:
        with _connect() as conn:
            existing_user = conn.execute(
                """
                SELECT id, name, username, created_at, last_login_at, is_legacy
                FROM users
                WHERE id = ? AND is_legacy = 0
                """,
                (user_id,),
            ).fetchone()
            if not existing_user:
                raise ValueError("User not found")

            conflicting_user = conn.execute(
                """
                SELECT id
                FROM users
                WHERE lower(username) = lower(?) AND id != ?
                """,
                (normalized_username, user_id),
            ).fetchone()
            if conflicting_user:
                raise ValueError("Username already exists")

            try:
                conn.execute(
                    """
                    UPDATE users
                    SET name = ?, username = ?
                    WHERE id = ?
                    """,
                    (normalized_display_name, normalized_username, user_id),
                )
            except sqlite3.IntegrityError as exc:
                raise ValueError("This display name or username is already in use") from exc
            conn.commit()

            row = conn.execute(
                """
                SELECT id, name, username, created_at, last_login_at, is_legacy
                FROM users
                WHERE id = ?
                """,
                (user_id,),
            ).fetchone()

    return _row_to_user(row)


def update_user_password(user_id: str, current_password: str, new_password: str) -> None:
    if not current_password:
        raise ValueError("Current password is required")
    if len(new_password) < 6:
        raise ValueError("New password must be at least 6 characters")

    init_project_store()

    with _DB_LOCK:
        with _connect() as conn:
            row = conn.execute(
                """
                SELECT id, password_hash, password_salt
                FROM users
                WHERE id = ? AND is_legacy = 0
                """,
                (user_id,),
            ).fetchone()
            if not row:
                raise ValueError("User not found")

            expected_hash = _hash_password(current_password, row["password_salt"])
            if not hmac.compare_digest(expected_hash, row["password_hash"]):
                raise ValueError("Current password is incorrect")

            next_salt = secrets.token_hex(16)
            next_hash = _hash_password(new_password, next_salt)
            conn.execute(
                """
                UPDATE users
                SET password_hash = ?, password_salt = ?
                WHERE id = ?
                """,
                (next_hash, next_salt, user_id),
            )
            conn.commit()


def create_user_session(user_id: str) -> dict:
    init_project_store()
    created_at = _utc_now()
    expires_at = (datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS)).isoformat()
    token = secrets.token_urlsafe(32)

    with _DB_LOCK:
        with _connect() as conn:
            conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
            conn.execute(
                """
                INSERT INTO sessions (token, user_id, created_at, expires_at)
                VALUES (?, ?, ?, ?)
                """,
                (token, user_id, created_at, expires_at),
            )
            conn.commit()

    return {
        "token": token,
        "created_at": created_at,
        "expires_at": expires_at,
    }


def get_session_user(session_token: str | None) -> dict | None:
    if not session_token:
        return None

    init_project_store()

    with _DB_LOCK:
        with _connect() as conn:
            row = conn.execute(
                """
                SELECT
                    users.id,
                    users.name,
                    users.username,
                    users.created_at,
                    users.last_login_at,
                    users.is_legacy,
                    sessions.token,
                    sessions.created_at AS session_created_at,
                    sessions.expires_at
                FROM sessions
                JOIN users ON users.id = sessions.user_id
                WHERE sessions.token = ?
                """,
                (session_token,),
            ).fetchone()
            if not row:
                return None

            if row["expires_at"] and row["expires_at"] < _utc_now():
                conn.execute("DELETE FROM sessions WHERE token = ?", (session_token,))
                conn.commit()
                return None

    user = _row_to_user(row)
    user["session_token"] = row["token"]
    user["session_created_at"] = row["session_created_at"]
    user["session_expires_at"] = row["expires_at"]
    return user


def revoke_session(session_token: str | None):
    if not session_token:
        return

    init_project_store()

    with _DB_LOCK:
        with _connect() as conn:
            conn.execute("DELETE FROM sessions WHERE token = ?", (session_token,))
            conn.commit()


def get_user(user_id: str | None) -> dict | None:
    if not user_id:
        return None

    init_project_store()

    with _DB_LOCK:
        with _connect() as conn:
            row = conn.execute(
                """
                SELECT id, name, username, created_at, last_login_at, is_legacy
                FROM users
                WHERE id = ?
                """,
                (user_id,),
            ).fetchone()

    return _row_to_user(row) if row else None


def list_registered_users() -> list[dict]:
    init_project_store()

    with _DB_LOCK:
        with _connect() as conn:
            rows = conn.execute(
                """
                SELECT id, name, username, created_at, last_login_at, is_legacy
                FROM users
                WHERE is_legacy = 0
                ORDER BY created_at ASC, id ASC
                """
            ).fetchall()

    return [_row_to_user(row) for row in rows]


def get_or_create_default_user() -> dict:
    init_project_store()

    with _DB_LOCK:
        with _connect() as conn:
            user = _ensure_legacy_user(conn)
            conn.commit()

    return user


def transfer_legacy_projects_to_user(user_id: str):
    init_project_store()

    with _DB_LOCK:
        with _connect() as conn:
            _transfer_projects(conn, LEGACY_USER_ID, user_id)
            conn.commit()


def get_project_owner(project_id: str) -> str | None:
    init_project_store()

    with _DB_LOCK:
        with _connect() as conn:
            row = conn.execute(
                "SELECT owner_user_id FROM projects WHERE id = ?",
                (project_id,),
            ).fetchone()

    return row["owner_user_id"] if row else None


def load_projects() -> dict[str, dict]:
    init_project_store()

    with _DB_LOCK:
        with _connect() as conn:
            rows = conn.execute(
                """
                SELECT
                    id,
                    owner_user_id,
                    description,
                    difficulty,
                    status,
                    current_stage,
                    status_detail,
                    progress_percent,
                    progress_message,
                    project_name,
                    requirements_doc,
                    architecture_doc,
                    code_artifacts,
                    test_report,
                    mentor_notes,
                    knowledge_cards,
                    iteration_count,
                    next_stage,
                    state_json,
                    payload_json,
                    updated_at
                FROM projects
                ORDER BY updated_at DESC, id DESC
                """
            ).fetchall()

            loaded_projects: dict[str, dict] = {}
            for row in rows:
                project = _row_to_project(conn, row)
                if project.get("id"):
                    loaded_projects[project["id"]] = project

    return loaded_projects


def save_project(project: dict):
    init_project_store()

    project_id = project.get("id")
    if not project_id:
        raise ValueError("Project must have an id before it can be persisted")

    updated_at = _utc_now()
    project["updated_at"] = updated_at
    payload_json = json.dumps(project, ensure_ascii=False)
    state_json = json.dumps(project.get("_state", {}), ensure_ascii=False)
    next_stage = project.get("_next_stage")

    with _DB_LOCK:
        with _connect() as conn:
            owner_user_id = project.get("owner_user_id") or _ensure_legacy_user(conn)["id"]
            project["owner_user_id"] = owner_user_id
            conn.execute(
                """
                INSERT INTO projects (
                    id,
                    owner_user_id,
                    description,
                    difficulty,
                    status,
                    current_stage,
                    status_detail,
                    progress_percent,
                    progress_message,
                    project_name,
                    requirements_doc,
                    architecture_doc,
                    code_artifacts,
                    test_report,
                    mentor_notes,
                    knowledge_cards,
                    iteration_count,
                    next_stage,
                    state_json,
                    updated_at,
                    payload_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    owner_user_id = excluded.owner_user_id,
                    description = excluded.description,
                    difficulty = excluded.difficulty,
                    status = excluded.status,
                    current_stage = excluded.current_stage,
                    status_detail = excluded.status_detail,
                    progress_percent = excluded.progress_percent,
                    progress_message = excluded.progress_message,
                    project_name = excluded.project_name,
                    requirements_doc = excluded.requirements_doc,
                    architecture_doc = excluded.architecture_doc,
                    code_artifacts = excluded.code_artifacts,
                    test_report = excluded.test_report,
                    mentor_notes = excluded.mentor_notes,
                    knowledge_cards = excluded.knowledge_cards,
                    iteration_count = excluded.iteration_count,
                    next_stage = excluded.next_stage,
                    state_json = excluded.state_json,
                    updated_at = excluded.updated_at,
                    payload_json = excluded.payload_json
                """,
                (
                    project_id,
                    owner_user_id,
                    project.get("description", ""),
                    project.get("difficulty", "medium"),
                    project.get("status", "queued"),
                    project.get("current_stage", "init"),
                    project.get("status_detail", ""),
                    int(project.get("progress_percent", 0) or 0),
                    project.get("progress_message", ""),
                    project.get("project_name", ""),
                    project.get("requirements_doc", ""),
                    project.get("architecture_doc", ""),
                    project.get("code_artifacts", ""),
                    project.get("test_report", ""),
                    project.get("mentor_notes", ""),
                    project.get("knowledge_cards", ""),
                    int(project.get("iteration_count", 0) or 0),
                    next_stage,
                    state_json,
                    updated_at,
                    payload_json,
                ),
            )

            conn.execute("DELETE FROM agent_messages WHERE project_id = ?", (project_id,))
            conn.executemany(
                """
                INSERT INTO agent_messages (
                    project_id,
                    message_index,
                    agent_role,
                    agent_name,
                    content,
                    stage,
                    msg_type,
                    payload_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        project_id,
                        index,
                        message.get("agent_role", ""),
                        message.get("agent_name", ""),
                        message.get("content", ""),
                        message.get("stage", ""),
                        message.get("msg_type", "output"),
                        json.dumps(message, ensure_ascii=False),
                    )
                    for index, message in enumerate(project.get("agent_messages", []) or [])
                ],
            )

            conn.execute("DELETE FROM learning_chat WHERE project_id = ?", (project_id,))
            conn.executemany(
                """
                INSERT INTO learning_chat (
                    project_id,
                    message_index,
                    message_id,
                    role,
                    content,
                    added_to_knowledge_cards,
                    payload_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        project_id,
                        index,
                        message.get("id", ""),
                        message.get("role", ""),
                        message.get("content", ""),
                        1 if message.get("added_to_knowledge_cards", False) else 0,
                        json.dumps(message, ensure_ascii=False),
                    )
                    for index, message in enumerate(project.get("learning_chat", []) or [])
                ],
            )
            conn.commit()


def delete_project_record(project_id: str):
    init_project_store()

    with _DB_LOCK:
        with _connect() as conn:
            conn.execute("DELETE FROM agent_messages WHERE project_id = ?", (project_id,))
            conn.execute("DELETE FROM learning_chat WHERE project_id = ?", (project_id,))
            conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
            conn.commit()


def migrate_legacy_json_store(legacy_json_path: Path) -> int:
    init_project_store()

    if _count_projects() > 0 or not legacy_json_path.exists():
        return 0

    try:
        payload = json.loads(legacy_json_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        logger.exception("Failed to read legacy JSON project store from %s", legacy_json_path)
        return 0

    if not isinstance(payload, dict):
        logger.warning("Unexpected legacy JSON store format in %s", legacy_json_path)
        return 0

    imported = 0
    for raw_project in payload.values():
        if not isinstance(raw_project, dict) or not raw_project.get("id"):
            continue
        raw_project.setdefault("owner_user_id", LEGACY_USER_ID)
        save_project(raw_project)
        imported += 1

    if imported:
        logger.info("Imported %s project(s) from legacy JSON store", imported)

    return imported


def _count_projects() -> int:
    with _DB_LOCK:
        with _connect() as conn:
            row = conn.execute("SELECT COUNT(*) AS count FROM projects").fetchone()
    return int(row["count"]) if row else 0


def _count_registered_users(conn: sqlite3.Connection) -> int:
    row = conn.execute(
        "SELECT COUNT(*) AS count FROM users WHERE is_legacy = 0"
    ).fetchone()
    return int(row["count"]) if row else 0


def _row_to_project(conn: sqlite3.Connection, row: sqlite3.Row) -> dict:
    payload = _load_json_payload(row["payload_json"], default={})
    state = _load_json_payload(row["state_json"], default={})
    project_id = row["id"] or payload.get("id")

    project = dict(payload)
    project.update(
        {
            "id": project_id,
            "owner_user_id": row["owner_user_id"] or payload.get("owner_user_id") or LEGACY_USER_ID,
            "description": row["description"] or payload.get("description", ""),
            "difficulty": row["difficulty"] or payload.get("difficulty", "medium"),
            "status": row["status"] or payload.get("status", "queued"),
            "current_stage": row["current_stage"] or payload.get("current_stage", "init"),
            "status_detail": row["status_detail"] or payload.get("status_detail", ""),
            "progress_percent": int(
                row["progress_percent"]
                if row["progress_percent"] is not None
                else payload.get("progress_percent", 0)
            ),
            "progress_message": row["progress_message"] or payload.get("progress_message", ""),
            "project_name": row["project_name"] or payload.get("project_name", ""),
            "requirements_doc": row["requirements_doc"] or payload.get("requirements_doc", ""),
            "architecture_doc": row["architecture_doc"] or payload.get("architecture_doc", ""),
            "code_artifacts": row["code_artifacts"] or payload.get("code_artifacts", ""),
            "test_report": row["test_report"] or payload.get("test_report", ""),
            "mentor_notes": row["mentor_notes"] or payload.get("mentor_notes", ""),
            "knowledge_cards": row["knowledge_cards"] or payload.get("knowledge_cards", ""),
            "iteration_count": int(
                row["iteration_count"]
                if row["iteration_count"] is not None
                else payload.get("iteration_count", 0)
            ),
            "updated_at": row["updated_at"] or payload.get("updated_at", ""),
            "_next_stage": row["next_stage"] if row["next_stage"] is not None else payload.get("_next_stage"),
            "_state": state if isinstance(state, dict) else payload.get("_state", {}),
        }
    )

    agent_messages = _load_agent_messages(conn, project_id)
    learning_chat = _load_learning_chat(conn, project_id)

    project["agent_messages"] = agent_messages if agent_messages else payload.get("agent_messages", [])
    project["learning_chat"] = learning_chat if learning_chat else payload.get("learning_chat", [])

    return project


def _load_agent_messages(conn: sqlite3.Connection, project_id: str) -> list[dict]:
    if not project_id:
        return []

    rows = conn.execute(
        """
        SELECT agent_role, agent_name, content, stage, msg_type, payload_json
        FROM agent_messages
        WHERE project_id = ?
        ORDER BY message_index ASC
        """,
        (project_id,),
    ).fetchall()

    messages: list[dict] = []
    for row in rows:
        payload = _load_json_payload(row["payload_json"], default={})
        if isinstance(payload, dict) and payload:
            messages.append(payload)
            continue

        messages.append(
            {
                "agent_role": row["agent_role"],
                "agent_name": row["agent_name"],
                "content": row["content"],
                "stage": row["stage"],
                "msg_type": row["msg_type"],
            }
        )

    return messages


def _load_learning_chat(conn: sqlite3.Connection, project_id: str) -> list[dict]:
    if not project_id:
        return []

    rows = conn.execute(
        """
        SELECT message_id, role, content, added_to_knowledge_cards, payload_json
        FROM learning_chat
        WHERE project_id = ?
        ORDER BY message_index ASC
        """,
        (project_id,),
    ).fetchall()

    messages: list[dict] = []
    for row in rows:
        payload = _load_json_payload(row["payload_json"], default={})
        if isinstance(payload, dict) and payload:
            messages.append(payload)
            continue

        messages.append(
            {
                "id": row["message_id"],
                "role": row["role"],
                "content": row["content"],
                "added_to_knowledge_cards": bool(row["added_to_knowledge_cards"]),
            }
        )

    return messages


def _load_json_payload(payload: str, default):
    try:
        value = json.loads(payload)
    except (TypeError, json.JSONDecodeError):
        logger.exception("Failed to decode persisted JSON payload")
        return default

    return value if value is not None else default


def _row_to_user(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "username": row["username"],
        "created_at": row["created_at"],
        "last_login_at": row["last_login_at"],
        "is_legacy": bool(row["is_legacy"]),
    }


def _ensure_legacy_user(conn: sqlite3.Connection) -> dict:
    row = conn.execute(
        """
        SELECT id, name, username, created_at, last_login_at, is_legacy
        FROM users
        WHERE id = ?
        """,
        (LEGACY_USER_ID,),
    ).fetchone()
    if row:
        return _row_to_user(row)

    created_at = _utc_now()
    conn.execute(
        """
        INSERT INTO users (
            id,
            name,
            username,
            password_hash,
            password_salt,
            created_at,
            last_login_at,
            is_legacy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, is_legacy = excluded.is_legacy
        """,
        (LEGACY_USER_ID, LEGACY_USER_NAME, None, "", "", created_at, "", 1),
    )
    return {
        "id": LEGACY_USER_ID,
        "name": LEGACY_USER_NAME,
        "username": None,
        "created_at": created_at,
        "last_login_at": "",
        "is_legacy": True,
    }


def _transfer_projects(conn: sqlite3.Connection, from_user_id: str, to_user_id: str):
    conn.execute(
        """
        UPDATE projects
        SET owner_user_id = ?
        WHERE owner_user_id = ?
        """,
        (to_user_id, from_user_id),
    )


def _ensure_project_owners(conn: sqlite3.Connection, default_user_id: str):
    conn.execute(
        """
        UPDATE projects
        SET owner_user_id = ?
        WHERE owner_user_id IS NULL OR owner_user_id = ''
        """,
        (default_user_id,),
    )


def _ensure_project_columns(conn: sqlite3.Connection):
    existing_columns = {
        row["name"] for row in conn.execute("PRAGMA table_info(projects)").fetchall()
    }

    for column_name, definition in _PROJECT_COLUMN_DEFINITIONS.items():
        if column_name in existing_columns:
            continue
        conn.execute(f"ALTER TABLE projects ADD COLUMN {column_name} {definition}")


def _ensure_user_columns(conn: sqlite3.Connection):
    existing_columns = {
        row["name"] for row in conn.execute("PRAGMA table_info(users)").fetchall()
    }

    for column_name, definition in _USER_COLUMN_DEFINITIONS.items():
        if column_name in existing_columns:
            continue
        conn.execute(f"ALTER TABLE users ADD COLUMN {column_name} {definition}")


def _validate_account_credentials(display_name: str, username: str, password: str):
    _validate_account_profile(display_name, username)
    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters")


def _validate_account_profile(display_name: str, username: str):
    if len(display_name) < 2:
        raise ValueError("Display name must be at least 2 characters")
    if len(username) < 3 or not username.replace("_", "").replace("-", "").isalnum():
        raise ValueError("Username must be at least 3 characters and use letters, numbers, _ or -")


def _hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        200_000,
    ).hex()


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _connect():
    conn = sqlite3.connect(PROJECT_DATABASE_PATH, timeout=30, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


init_project_store()
