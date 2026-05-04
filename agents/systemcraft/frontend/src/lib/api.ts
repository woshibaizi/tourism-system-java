import type {
  AuthLoginRequest,
  AuthPasswordChangeRequest,
  AuthProfileUpdateRequest,
  AuthRegisterRequest,
  AuthSessionResponse,
  AuthUser,
  FollowUpQuestionRequest,
  FollowUpQuestionResponse,
  LearningCardRequest,
  LearningCardResponse,
  ProjectCreateRequest,
  ProjectDetail,
  ProjectIterationRequest,
  ProjectSummary,
  ProjectUpdateRequest,
} from '../types/api';
import { getStoredSessionToken } from './user-session';

const DEFAULT_API_BASE_URL =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : 'http://localhost:8000';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL
).replace(/\/$/, '');

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  const sessionToken = getStoredSessionToken();

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken ? { 'X-Session-Token': sessionToken } : {}),
        ...(init?.headers ?? {}),
      },
      ...init,
    });
  } catch {
    throw new Error(`Unable to reach backend service at ${API_BASE_URL}.`);
  }

  if (!response.ok) {
    const fallbackMessage = `Request failed (${response.status})`;
    let detail = fallbackMessage;

    try {
      const errorPayload = (await response.json()) as { detail?: string };
      detail = errorPayload.detail ?? fallbackMessage;
    } catch {
      detail = fallbackMessage;
    }

    throw new ApiError(response.status, detail);
  }

  return (await response.json()) as T;
}

export function registerAccount(payload: AuthRegisterRequest) {
  return request<AuthSessionResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function loginAccount(payload: AuthLoginRequest) {
  return request<AuthSessionResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getCurrentSession() {
  return request<AuthUser>('/api/auth/session');
}

export function logoutAccount() {
  return request<{ message: string }>('/api/auth/logout', {
    method: 'POST',
  });
}

export function updateAccountProfile(payload: AuthProfileUpdateRequest) {
  return request<AuthUser>('/api/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function changeAccountPassword(payload: AuthPasswordChangeRequest) {
  return request<{ message: string }>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listProjects() {
  return request<ProjectSummary[]>('/api/projects');
}

export function getProject(projectId: string) {
  return request<ProjectDetail>(`/api/project/${projectId}`);
}

export function updateProject(projectId: string, payload: ProjectUpdateRequest) {
  return request<ProjectDetail>(`/api/project/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function createProject(payload: ProjectCreateRequest) {
  return request<ProjectDetail>('/api/project', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function iterateProject(projectId: string, payload: ProjectIterationRequest) {
  return request<ProjectDetail>(`/api/project/${projectId}/iterate`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteProject(projectId: string) {
  return request<{ message: string }>(`/api/project/${projectId}`, {
    method: 'DELETE',
  });
}

export function pauseProject(projectId: string) {
  return request<ProjectDetail>(`/api/project/${projectId}/pause`, {
    method: 'POST',
  });
}

export function resumeProject(projectId: string) {
  return request<ProjectDetail>(`/api/project/${projectId}/resume`, {
    method: 'POST',
  });
}

export function askProjectFollowUp(projectId: string, payload: FollowUpQuestionRequest) {
  return request<FollowUpQuestionResponse>(`/api/project/${projectId}/follow-up`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function addLearningCard(projectId: string, payload: LearningCardRequest) {
  return request<LearningCardResponse>(`/api/project/${projectId}/learning-card`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function makeProjectSocketUrl(projectId: string) {
  const url = new URL(API_BASE_URL);
  const sessionToken = getStoredSessionToken();
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `/ws/project/${projectId}`;
  if (sessionToken) {
    url.searchParams.set('token', sessionToken);
  }
  return url.toString();
}
