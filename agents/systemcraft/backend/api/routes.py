"""
FastAPI routes for authentication and project workflows.
"""

from __future__ import annotations

import asyncio
import logging
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from agents.learning_agent import learning_agent
from api.websocket import manager
from graph.workflow import (
    FIRST_STAGE,
    get_initial_state,
    get_next_stage,
    get_stage_config,
    run_stage,
)
from project_store import (
    LEGACY_USER_ID,
    authenticate_user,
    create_user_session,
    delete_project_record,
    get_session_user,
    load_projects,
    migrate_legacy_json_store,
    register_user_account,
    revoke_session,
    save_project,
    update_user_password,
    update_user_profile,
)

router = APIRouter(prefix="/api", tags=["systemcraft"])
logger = logging.getLogger(__name__)

ACTIVE_PROJECT_STATUSES = {"queued", "running", "pausing", "paused"}
RUNNING_PROJECT_STATUSES = {"queued", "running", "pausing"}
LEGACY_PROJECT_STORAGE_PATH = Path(__file__).resolve().parents[1] / "data" / "projects.json"

# In-memory runtime cache backed by SQLite persistence.
projects: dict[str, dict] = {}
project_tasks: dict[str, asyncio.Task] = {}


class AuthRegisterRequest(BaseModel):
    display_name: str = Field(..., min_length=2, max_length=32)
    username: str = Field(..., min_length=3, max_length=32)
    password: str = Field(..., min_length=6, max_length=64)


class AuthLoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=32)
    password: str = Field(..., min_length=6, max_length=64)


class AuthProfileUpdateRequest(BaseModel):
    display_name: str = Field(..., min_length=2, max_length=32)
    username: str = Field(..., min_length=3, max_length=32)


class AuthPasswordChangeRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=64)
    new_password: str = Field(..., min_length=6, max_length=64)


class AuthUserResponse(BaseModel):
    id: str
    display_name: str
    username: str
    created_at: Optional[str] = None
    last_login_at: Optional[str] = None
    project_count: int = 0


class AuthSessionResponse(BaseModel):
    token: str
    user: AuthUserResponse


class ProjectCreateRequest(BaseModel):
    description: str = Field(..., min_length=5, description="Project requirement")
    difficulty: str = Field(default="medium", description="easy / medium / hard")
    template_id: Optional[str] = Field(default=None, max_length=64)
    template_label: Optional[str] = Field(default=None, max_length=80)
    template_category: Optional[str] = Field(default=None, max_length=80)


class FollowUpQuestionRequest(BaseModel):
    question: str = Field(..., min_length=2, description="Student follow-up question")
    add_to_knowledge_cards: bool = Field(
        default=False,
        description="Whether to convert this explanation into a new knowledge card",
    )
    source: str = Field(default="general", max_length=40)
    related_card_id: Optional[str] = Field(default=None, max_length=120)
    related_card_title: Optional[str] = Field(default=None, max_length=200)


class LearningCardRequest(BaseModel):
    question: str = Field(..., min_length=2, description="Original student question")
    answer: str = Field(..., min_length=8, description="Mentor answer content")
    mentor_message_id: Optional[str] = Field(default=None, max_length=120)
    source: str = Field(default="general", max_length=40)
    related_card_id: Optional[str] = Field(default=None, max_length=120)
    related_card_title: Optional[str] = Field(default=None, max_length=200)


class ProjectUpdateRequest(BaseModel):
    project_name: str = Field(..., min_length=1, max_length=80)


class ProjectIterationRequest(BaseModel):
    change_request: str = Field(..., min_length=4, max_length=2000)


class ProjectResponse(BaseModel):
    id: str
    owner_user_id: str
    description: str
    difficulty: str
    status: str
    current_stage: str = "init"
    status_detail: str = ""
    progress_percent: int = 0
    progress_message: str = ""
    project_name: Optional[str] = None
    template_id: Optional[str] = None
    template_label: Optional[str] = None
    template_category: Optional[str] = None
    requirements_doc: Optional[str] = None
    architecture_doc: Optional[str] = None
    code_artifacts: Optional[str] = None
    test_report: Optional[str] = None
    mentor_notes: Optional[str] = None
    knowledge_cards: Optional[str] = None
    iteration_count: int = 0
    updated_at: Optional[str] = None
    agent_messages: list = Field(default_factory=list)
    learning_chat: list = Field(default_factory=list)
    iteration_history: list = Field(default_factory=list)


class ProjectSummaryResponse(BaseModel):
    id: str
    owner_user_id: str
    description: str
    difficulty: str
    status: str
    current_stage: str = "init"
    status_detail: str = ""
    progress_percent: int = 0
    progress_message: str = ""
    project_name: Optional[str] = None
    updated_at: Optional[str] = None
    template_id: Optional[str] = None
    template_label: Optional[str] = None
    template_category: Optional[str] = None


class FollowUpQuestionResponse(BaseModel):
    answer: str
    card_added: bool
    project: ProjectResponse


class LearningCardResponse(BaseModel):
    card_added: bool
    project: ProjectResponse


def _hydrate_runtime_project(raw_project: dict) -> dict:
    project = dict(raw_project)
    project["owner_user_id"] = project.get("owner_user_id") or LEGACY_USER_ID
    state = project.get("_state")
    if not isinstance(state, dict):
        state = get_initial_state(
            project.get("description", ""),
            project.get("difficulty", "medium"),
        )

    state.update(
        {
            "user_input": project.get("description", ""),
            "difficulty": project.get("difficulty", "medium"),
            "project_name": project.get("project_name", ""),
            "requirements_doc": project.get("requirements_doc", ""),
            "architecture_doc": project.get("architecture_doc", ""),
            "code_artifacts": project.get("code_artifacts", ""),
            "test_report": project.get("test_report", ""),
            "mentor_notes": project.get("mentor_notes", ""),
            "knowledge_cards": project.get("knowledge_cards", ""),
            "current_stage": project.get("current_stage", "init"),
            "iteration_count": project.get("iteration_count", 0),
            "agent_messages": project.get("agent_messages", []),
        }
    )
    project["_state"] = state
    project["_pause_requested"] = False
    project["_next_stage"] = project.get("_next_stage")

    if project.get("status") in RUNNING_PROJECT_STATUSES:
        project["status"] = "error"
        project["status_detail"] = (
            "Backend restarted while this project was running. Review the saved artifacts and rerun if needed."
        )
        project["progress_message"] = "The previous generation was interrupted by a backend restart."

    project.setdefault("learning_chat", [])
    project.setdefault("agent_messages", [])
    project.setdefault("iteration_history", [])
    project.setdefault("progress_percent", 0)
    project.setdefault("progress_message", "")
    project.setdefault("status_detail", "")
    project.setdefault("updated_at", "")
    project.setdefault("template_id", None)
    project.setdefault("template_label", None)
    project.setdefault("template_category", None)
    return project


def _restore_projects():
    migrate_legacy_json_store(LEGACY_PROJECT_STORAGE_PATH)

    for project_id, raw_project in load_projects().items():
        project = _hydrate_runtime_project(raw_project)
        projects[project_id] = project
        save_project(project)

    if projects:
        logger.info("Restored %s persisted project(s) from SQLite", len(projects))


def _public_project(project: dict) -> dict:
    return {
        "id": project["id"],
        "owner_user_id": project["owner_user_id"],
        "description": project["description"],
        "difficulty": project["difficulty"],
        "status": project["status"],
        "current_stage": project.get("current_stage", "init"),
        "status_detail": project.get("status_detail", ""),
        "progress_percent": project.get("progress_percent", 0),
        "progress_message": project.get("progress_message", ""),
        "project_name": project.get("project_name"),
        "template_id": project.get("template_id"),
        "template_label": project.get("template_label"),
        "template_category": project.get("template_category"),
        "requirements_doc": project.get("requirements_doc"),
        "architecture_doc": project.get("architecture_doc"),
        "code_artifacts": project.get("code_artifacts"),
        "test_report": project.get("test_report"),
        "mentor_notes": project.get("mentor_notes"),
        "knowledge_cards": project.get("knowledge_cards"),
        "iteration_count": project.get("iteration_count", 0),
        "updated_at": project.get("updated_at"),
        "agent_messages": project.get("agent_messages", []),
        "learning_chat": project.get("learning_chat", []),
        "iteration_history": project.get("iteration_history", []),
    }


def _public_project_summary(project: dict) -> dict:
    return {
        "id": project["id"],
        "owner_user_id": project["owner_user_id"],
        "description": project["description"],
        "difficulty": project["difficulty"],
        "status": project["status"],
        "current_stage": project.get("current_stage", "init"),
        "status_detail": project.get("status_detail", ""),
        "progress_percent": project.get("progress_percent", 0),
        "progress_message": project.get("progress_message", ""),
        "project_name": project.get("project_name"),
        "updated_at": project.get("updated_at"),
        "template_id": project.get("template_id"),
        "template_label": project.get("template_label"),
        "template_category": project.get("template_category"),
    }


def _build_auth_user_response(user: dict) -> dict:
    return {
        "id": user["id"],
        "display_name": user["name"],
        "username": user["username"],
        "created_at": user.get("created_at"),
        "last_login_at": user.get("last_login_at"),
        "project_count": sum(
            1 for project in projects.values() if project.get("owner_user_id") == user["id"]
        ),
    }


async def _broadcast_project_state(project_id: str):
    project = projects.get(project_id)
    if not project:
        return

    save_project(project)
    await manager.broadcast(
        project_id,
        {
            "type": "project_state",
            "project": _public_project(project),
        },
    )


async def _broadcast_agent_message(project_id: str, message: dict):
    await manager.broadcast(
        project_id,
        {
            "type": "agent_message",
            **message,
        },
    )


def _sync_project_from_state(project: dict):
    state = project["_state"]
    project.update(
        {
            "project_name": state.get("project_name", ""),
            "requirements_doc": state.get("requirements_doc", ""),
            "architecture_doc": state.get("architecture_doc", ""),
            "code_artifacts": state.get("code_artifacts", ""),
            "test_report": state.get("test_report", ""),
            "mentor_notes": state.get("mentor_notes", ""),
            "knowledge_cards": state.get("knowledge_cards", ""),
            "iteration_count": state.get("iteration_count", 0),
            "current_stage": state.get("current_stage", project.get("current_stage", "init")),
            "agent_messages": state.get("agent_messages", []),
        }
    )


def _append_message(project: dict, message: dict):
    state = project["_state"]
    messages = [*state.get("agent_messages", []), message]
    state["agent_messages"] = messages
    project["agent_messages"] = messages


def _append_learning_message(
    project: dict,
    *,
    role: str,
    content: str,
    added_to_knowledge_cards: bool = False,
    **extra,
) -> dict:
    message = {
        "id": str(uuid.uuid4())[:8],
        "role": role,
        "content": content,
        "added_to_knowledge_cards": added_to_knowledge_cards,
    }
    message.update({key: value for key, value in extra.items() if value not in (None, "")})
    project["learning_chat"] = [*project.get("learning_chat", []), message]
    return message


def _update_learning_message(project: dict, message_id: str, **changes) -> bool:
    if not message_id:
        return False

    messages = [*project.get("learning_chat", [])]
    updated = False
    for index, message in enumerate(messages):
        if message.get("id") != message_id:
            continue

        next_message = dict(message)
        next_message.update(changes)
        messages[index] = next_message
        updated = True
        break

    if updated:
        project["learning_chat"] = messages

    return updated


def _count_knowledge_cards(markdown: str) -> int:
    return len(re.findall(r"(?m)^###\s+", markdown or ""))


def _truncate_block(content: str, limit: int = 1800) -> str:
    normalized = (content or "").strip()
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[:limit].rstrip()}\n...[truncated]"


def _capture_artifact_snapshot(project: dict) -> dict:
    return {
        "project_name": project.get("project_name", ""),
        "requirements_doc": project.get("requirements_doc", ""),
        "architecture_doc": project.get("architecture_doc", ""),
        "code_artifacts": project.get("code_artifacts", ""),
        "test_report": project.get("test_report", ""),
        "mentor_notes": project.get("mentor_notes", ""),
        "knowledge_cards": project.get("knowledge_cards", ""),
    }


def _build_iteration_input(project: dict, change_request: str) -> str:
    sections = [
        "You are updating an existing software project with a new iteration request.",
        f"Original project requirement:\n{project.get('description', '').strip()}",
    ]

    if project.get("project_name"):
        sections.append(f"Current project name:\n{project['project_name']}")
    if project.get("requirements_doc"):
        sections.append(
            "Current requirements baseline:\n"
            f"{_truncate_block(project.get('requirements_doc', ''))}"
        )
    if project.get("architecture_doc"):
        sections.append(
            "Current architecture baseline:\n"
            f"{_truncate_block(project.get('architecture_doc', ''))}"
        )
    if project.get("code_artifacts"):
        sections.append(
            "Current implementation summary:\n"
            f"{_truncate_block(project.get('code_artifacts', ''))}"
        )
    if project.get("test_report"):
        sections.append(
            "Current testing baseline:\n"
            f"{_truncate_block(project.get('test_report', ''))}"
        )

    sections.append(f"New change request:\n{change_request.strip()}")
    sections.append(
        "Please update the project deliverables so the new request is incorporated while preserving existing valid functionality."
    )
    return "\n\n".join(section for section in sections if section.strip())


def _append_iteration_history(project: dict, change_request: str, before_snapshot: dict) -> dict:
    entry = {
        "id": str(uuid.uuid4())[:8],
        "change_request": change_request.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "running",
        "before_snapshot": before_snapshot,
    }
    project["iteration_history"] = [*project.get("iteration_history", []), entry]
    return entry


def _get_pending_iteration_entry(project: dict) -> Optional[dict]:
    for entry in reversed(project.get("iteration_history", [])):
        if entry.get("status") == "running":
            return entry
    return None


def _estimate_progress(stage_id: str, phase: str, iteration_count: int = 0) -> int:
    if stage_id == "requirements_analysis":
        return 8 if phase == "start" else 18
    if stage_id == "architecture_design":
        return 24 if phase == "start" else 38
    if stage_id == "development":
        if iteration_count > 0:
            return 76 if phase == "start" else 84
        return 44 if phase == "start" else 58
    if stage_id == "testing":
        if iteration_count > 0:
            return 86 if phase == "start" else 92
        return 64 if phase == "start" else 74
    if stage_id == "mentor_review":
        return 95 if phase == "start" else 100
    return 0


def _set_progress(project: dict, progress_percent: int, progress_message: Optional[str] = None):
    project["progress_percent"] = max(project.get("progress_percent", 0), progress_percent)
    if progress_message is not None:
        project["progress_message"] = progress_message


def _active_project(owner_user_id: str, exclude_project_id: Optional[str] = None) -> Optional[dict]:
    for project in projects.values():
        if exclude_project_id and project["id"] == exclude_project_id:
            continue
        if project.get("owner_user_id") != owner_user_id:
            continue
        if project["status"] in ACTIVE_PROJECT_STATUSES:
            return project
    return None


def _require_project(project_id: str, owner_user_id: str) -> dict:
    project = projects.get(project_id)
    if not project or project.get("owner_user_id") != owner_user_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def get_current_user(
    x_session_token: Optional[str] = Header(default=None, alias="X-Session-Token"),
) -> dict:
    user = get_session_user(x_session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


def get_current_user_id(current_user: dict = Depends(get_current_user)) -> str:
    return current_user["id"]


def get_current_session_token(
    x_session_token: Optional[str] = Header(default=None, alias="X-Session-Token"),
) -> str:
    if not x_session_token:
        raise HTTPException(status_code=401, detail="Authentication required")
    return x_session_token


_restore_projects()


@router.post("/auth/register", response_model=AuthSessionResponse)
async def register_account(req: AuthRegisterRequest):
    try:
        user = register_user_account(req.display_name, req.username, req.password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    for project in projects.values():
        if project.get("owner_user_id") != LEGACY_USER_ID:
            continue
        project["owner_user_id"] = user["id"]
        save_project(project)

    session = create_user_session(user["id"])
    return AuthSessionResponse(
        token=session["token"],
        user=AuthUserResponse(**_build_auth_user_response(user)),
    )


@router.post("/auth/login", response_model=AuthSessionResponse)
async def login_account(req: AuthLoginRequest):
    user = authenticate_user(req.username, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    session = create_user_session(user["id"])
    return AuthSessionResponse(
        token=session["token"],
        user=AuthUserResponse(**_build_auth_user_response(user)),
    )


@router.get("/auth/session", response_model=AuthUserResponse)
async def get_auth_session(current_user: dict = Depends(get_current_user)):
    return AuthUserResponse(**_build_auth_user_response(current_user))


@router.patch("/auth/profile", response_model=AuthUserResponse)
async def update_auth_profile(
    req: AuthProfileUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        updated_user = update_user_profile(
            current_user["id"],
            req.display_name,
            req.username,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return AuthUserResponse(**_build_auth_user_response(updated_user))


@router.post("/auth/change-password")
async def change_auth_password(
    req: AuthPasswordChangeRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        update_user_password(
            current_user["id"],
            req.current_password,
            req.new_password,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {"message": "Password updated"}


@router.post("/auth/logout")
async def logout_account(session_token: str = Depends(get_current_session_token)):
    revoke_session(session_token)
    return {"message": "Logged out"}


async def _pause_before_stage(project: dict, next_stage: str) -> bool:
    if not project.get("_pause_requested", False):
        return False

    project["status"] = "paused"
    project["status_detail"] = "Generation paused. Resume when you are ready."
    project["_next_stage"] = next_stage
    await _broadcast_project_state(project["id"])
    return True


async def _run_project_workflow(project_id: str):
    project = projects[project_id]
    state = project["_state"]
    stage_id = project.get("_next_stage") or FIRST_STAGE

    try:
        while stage_id:
            if await _pause_before_stage(project, stage_id):
                return

            stage = get_stage_config(stage_id)
            project["status"] = "running"
            project["status_detail"] = f"{stage['label']} is running..."
            project["current_stage"] = stage_id
            project["_next_stage"] = stage_id
            _set_progress(
                project,
                _estimate_progress(stage_id, "start", state.get("iteration_count", 0)),
                stage["start_message"],
            )

            stage_start_message = {
                "agent_role": stage["role"],
                "agent_name": stage["agent_name"],
                "content": stage["start_message"],
                "stage": stage_id,
                "msg_type": "thinking",
            }
            _append_message(project, stage_start_message)

            await _broadcast_project_state(project_id)
            await _broadcast_agent_message(project_id, stage_start_message)

            existing_message_count = len(state.get("agent_messages", []))
            result = await asyncio.to_thread(run_stage, stage_id, state)
            state.update(result)
            _sync_project_from_state(project)
            _set_progress(
                project,
                _estimate_progress(stage_id, "complete", state.get("iteration_count", 0)),
                f"{stage['label']} completed. Preparing the next stage...",
            )

            new_messages = state.get("agent_messages", [])[existing_message_count:]
            for message in new_messages:
                await _broadcast_agent_message(project_id, message)

            await _broadcast_project_state(project_id)

            next_stage = get_next_stage(stage_id, state)
            if project.get("_pause_requested", False) and next_stage:
                project["status"] = "paused"
                project["status_detail"] = f"{stage['label']} completed. The workflow is paused."
                project["progress_message"] = "Paused after the current safe checkpoint."
                project["_next_stage"] = next_stage
                await _broadcast_project_state(project_id)
                return

            stage_id = next_stage
            project["_next_stage"] = stage_id

        project["status"] = "completed"
        project["current_stage"] = "completed"
        project["status_detail"] = "All agents have finished and the project package is ready."
        project["progress_percent"] = 100
        project["progress_message"] = "Generation complete. You can review, export, or continue asking questions."
        project["_next_stage"] = None
        iteration_entry = _get_pending_iteration_entry(project)
        if iteration_entry:
            iteration_entry["status"] = "completed"
            iteration_entry["completed_at"] = datetime.now(timezone.utc).isoformat()
            iteration_entry["after_snapshot"] = _capture_artifact_snapshot(project)
        await _broadcast_project_state(project_id)

    except Exception as exc:
        logger.exception("Project workflow failed for %s", project_id)
        error_message = {
            "agent_role": "system",
            "agent_name": "System",
            "content": f"Project execution failed: {exc}",
            "stage": project.get("current_stage", "init"),
            "msg_type": "error",
        }
        _append_message(project, error_message)
        project["status"] = "error"
        project["status_detail"] = f"Workflow failed: {exc}"
        project["progress_message"] = "Generation stopped because of an error."
        iteration_entry = _get_pending_iteration_entry(project)
        if iteration_entry:
            iteration_entry["status"] = "failed"
            iteration_entry["failed_at"] = datetime.now(timezone.utc).isoformat()
            iteration_entry["after_snapshot"] = _capture_artifact_snapshot(project)
        await _broadcast_agent_message(project_id, error_message)
        await _broadcast_project_state(project_id)

    finally:
        project["_pause_requested"] = False
        project_tasks.pop(project_id, None)
        save_project(project)


@router.post("/project", response_model=ProjectResponse)
async def create_project(
    req: ProjectCreateRequest,
    current_user_id: str = Depends(get_current_user_id),
):
    active_project = _active_project(current_user_id)
    if active_project:
        raise HTTPException(
            status_code=409,
            detail="You already have an active project. Please finish or pause it before creating a new one.",
        )

    project_id = str(uuid.uuid4())[:8]
    initial_state = get_initial_state(req.description, req.difficulty)
    project = {
        "id": project_id,
        "owner_user_id": current_user_id,
        "description": req.description,
        "difficulty": req.difficulty,
        "template_id": req.template_id,
        "template_label": req.template_label,
        "template_category": req.template_category,
        "status": "queued",
        "current_stage": "init",
        "status_detail": "Project created. Waiting for the PM agent to begin.",
        "progress_percent": 2,
        "progress_message": "Project created. Preparing to start the workflow.",
        "project_name": "",
        "requirements_doc": "",
        "architecture_doc": "",
        "code_artifacts": "",
        "test_report": "",
        "mentor_notes": "",
        "knowledge_cards": "",
        "iteration_count": 0,
        "updated_at": "",
        "agent_messages": [],
        "learning_chat": [],
        "iteration_history": [],
        "_state": initial_state,
        "_pause_requested": False,
        "_next_stage": FIRST_STAGE,
    }

    projects[project_id] = project
    save_project(project)
    project_tasks[project_id] = asyncio.create_task(_run_project_workflow(project_id))
    return ProjectResponse(**_public_project(project))


@router.get("/project/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    project = _require_project(project_id, current_user_id)
    return ProjectResponse(**_public_project(project))


@router.patch("/project/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    req: ProjectUpdateRequest,
    current_user_id: str = Depends(get_current_user_id),
):
    project = _require_project(project_id, current_user_id)
    next_project_name = req.project_name.strip()
    if not next_project_name:
        raise HTTPException(status_code=400, detail="Project name cannot be empty")
    project["project_name"] = next_project_name
    save_project(project)
    return ProjectResponse(**_public_project(project))


@router.post("/project/{project_id}/iterate", response_model=ProjectResponse)
async def iterate_project(
    project_id: str,
    req: ProjectIterationRequest,
    current_user_id: str = Depends(get_current_user_id),
):
    project = _require_project(project_id, current_user_id)

    if project["status"] != "completed":
        raise HTTPException(
            status_code=400,
            detail="Only completed projects can start a new iteration.",
        )

    if _active_project(current_user_id, exclude_project_id=project_id):
        raise HTTPException(
            status_code=409,
            detail="You already have another active project. Finish or pause it before starting a new iteration.",
        )

    change_request = req.change_request.strip()
    if not change_request:
        raise HTTPException(status_code=400, detail="Change request cannot be empty")

    _append_iteration_history(project, change_request, _capture_artifact_snapshot(project))

    project["_state"] = get_initial_state(
        _build_iteration_input(project, change_request),
        project.get("difficulty", "medium"),
    )
    project["status"] = "queued"
    project["current_stage"] = "init"
    project["status_detail"] = "Iteration request accepted. Preparing the updated workflow."
    project["progress_percent"] = 3
    project["progress_message"] = "The revision is being scheduled for the PM agent."
    project["_pause_requested"] = False
    project["_next_stage"] = FIRST_STAGE

    iteration_message = {
        "agent_role": "system",
        "agent_name": "System",
        "content": f"New iteration request received: {change_request}",
        "stage": "iteration_request",
        "msg_type": "thinking",
    }
    _append_message(project, iteration_message)
    save_project(project)

    project_tasks[project_id] = asyncio.create_task(_run_project_workflow(project_id))
    await _broadcast_project_state(project_id)
    await _broadcast_agent_message(project_id, iteration_message)

    return ProjectResponse(**_public_project(project))


@router.post("/project/{project_id}/pause", response_model=ProjectResponse)
async def pause_project(
    project_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    project = _require_project(project_id, current_user_id)

    if project["status"] == "paused":
        return ProjectResponse(**_public_project(project))

    if project["status"] not in RUNNING_PROJECT_STATUSES:
        raise HTTPException(status_code=400, detail="Only running projects can be paused")

    project["_pause_requested"] = True
    project["status"] = "pausing"
    project["status_detail"] = "Pause requested. Waiting for the current agent call to finish."
    project["progress_message"] = "Pause requested. The workflow will stop at the next safe checkpoint."
    await _broadcast_project_state(project_id)
    return ProjectResponse(**_public_project(project))


@router.post("/project/{project_id}/resume", response_model=ProjectResponse)
async def resume_project(
    project_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    project = _require_project(project_id, current_user_id)

    if project["status"] != "paused":
        raise HTTPException(status_code=400, detail="Only paused projects can be resumed")

    if _active_project(current_user_id, exclude_project_id=project_id):
        raise HTTPException(
            status_code=409,
            detail="You already have another active project. Pause or finish it before resuming this one.",
        )

    project["_pause_requested"] = False
    project["status"] = "queued"
    project["status_detail"] = "Resuming the workflow."
    project["progress_message"] = "The next agent is being scheduled."
    project_tasks[project_id] = asyncio.create_task(_run_project_workflow(project_id))
    await _broadcast_project_state(project_id)
    return ProjectResponse(**_public_project(project))


@router.post("/project/{project_id}/follow-up", response_model=FollowUpQuestionResponse)
async def ask_follow_up_question(
    project_id: str,
    req: FollowUpQuestionRequest,
    current_user_id: str = Depends(get_current_user_id),
):
    project = _require_project(project_id, current_user_id)

    if project["status"] != "completed":
        raise HTTPException(status_code=400, detail="Only completed projects support follow-up Q&A")

    _append_learning_message(
        project,
        role="user",
        content=req.question,
        source=req.source,
        related_card_id=req.related_card_id,
        related_card_title=req.related_card_title,
        question=req.question,
    )

    next_card_index = _count_knowledge_cards(project.get("knowledge_cards", "")) + 1
    answer_result = await asyncio.to_thread(
        learning_agent.answer_question,
        question=req.question,
        project_name=project.get("project_name", ""),
        project_description=project.get("description", ""),
        requirements_doc=project.get("requirements_doc", ""),
        architecture_doc=project.get("architecture_doc", ""),
        code_artifacts=project.get("code_artifacts", ""),
        test_report=project.get("test_report", ""),
        mentor_notes=project.get("mentor_notes", ""),
        knowledge_cards=project.get("knowledge_cards", ""),
        add_to_knowledge_cards=req.add_to_knowledge_cards,
        next_card_index=next_card_index,
    )

    knowledge_card = answer_result.get("knowledge_card", "").strip()
    if knowledge_card:
        existing_cards = (project.get("knowledge_cards", "") or "").strip()
        project["knowledge_cards"] = (
            f"{existing_cards}\n\n{knowledge_card}".strip()
            if existing_cards
            else knowledge_card
        )
        project["_state"]["knowledge_cards"] = project["knowledge_cards"]

    _append_learning_message(
        project,
        role="mentor",
        content=answer_result["answer"],
        added_to_knowledge_cards=bool(knowledge_card),
        source=req.source,
        related_card_id=req.related_card_id,
        related_card_title=req.related_card_title,
        question=req.question,
    )

    await _broadcast_project_state(project_id)

    return FollowUpQuestionResponse(
        answer=answer_result["answer"],
        card_added=bool(knowledge_card),
        project=ProjectResponse(**_public_project(project)),
    )


@router.post("/project/{project_id}/learning-card", response_model=LearningCardResponse)
async def create_learning_card(
    project_id: str,
    req: LearningCardRequest,
    current_user_id: str = Depends(get_current_user_id),
):
    project = _require_project(project_id, current_user_id)

    if project["status"] != "completed":
        raise HTTPException(status_code=400, detail="Only completed projects support knowledge cards")

    if req.mentor_message_id:
        existing_message = next(
            (message for message in project.get("learning_chat", []) if message.get("id") == req.mentor_message_id),
            None,
        )
        if existing_message and existing_message.get("added_to_knowledge_cards"):
            return LearningCardResponse(
                card_added=False,
                project=ProjectResponse(**_public_project(project)),
            )

    next_card_index = _count_knowledge_cards(project.get("knowledge_cards", "")) + 1
    knowledge_card = await asyncio.to_thread(
        learning_agent.create_knowledge_card,
        question=req.question,
        answer=req.answer,
        project_name=project.get("project_name", ""),
        project_description=project.get("description", ""),
        requirements_doc=project.get("requirements_doc", ""),
        architecture_doc=project.get("architecture_doc", ""),
        code_artifacts=project.get("code_artifacts", ""),
        test_report=project.get("test_report", ""),
        mentor_notes=project.get("mentor_notes", ""),
        knowledge_cards=project.get("knowledge_cards", ""),
        next_card_index=next_card_index,
    )

    knowledge_card = (knowledge_card or "").strip()
    if not knowledge_card:
        raise HTTPException(status_code=500, detail="Failed to create knowledge card")

    existing_cards = (project.get("knowledge_cards", "") or "").strip()
    project["knowledge_cards"] = (
        f"{existing_cards}\n\n{knowledge_card}".strip()
        if existing_cards
        else knowledge_card
    )
    project["_state"]["knowledge_cards"] = project["knowledge_cards"]

    if req.mentor_message_id:
        _update_learning_message(project, req.mentor_message_id, added_to_knowledge_cards=True)

    await _broadcast_project_state(project_id)

    return LearningCardResponse(
        card_added=True,
        project=ProjectResponse(**_public_project(project)),
    )


@router.get("/projects", response_model=list[ProjectSummaryResponse])
async def list_projects(current_user_id: str = Depends(get_current_user_id)):
    user_projects = [
        _public_project_summary(project)
        for project in projects.values()
        if project.get("owner_user_id") == current_user_id
    ]
    ordered_projects = sorted(
        user_projects,
        key=lambda project: project.get("updated_at") or "",
        reverse=True,
    )
    return [ProjectSummaryResponse(**project) for project in ordered_projects]


@router.delete("/project/{project_id}")
async def delete_project(
    project_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    project = _require_project(project_id, current_user_id)
    if project["status"] in RUNNING_PROJECT_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Project is still running. Pause it before deleting it.",
        )
    projects.pop(project_id, None)
    project_tasks.pop(project_id, None)
    delete_project_record(project_id)
    return {"message": "Project deleted"}
