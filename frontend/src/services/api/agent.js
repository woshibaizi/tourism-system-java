import api from './client';
import {
  successResult,
  failResult,
  normalizeAgentSessionSummary,
  normalizeAgentSessionDetail,
  normalizeAgentReply,
  normalizeBuddy,
  normalizeArrayItems,
} from './normalize';

const AGENT_STREAM_BASE = import.meta.env.VITE_AGENT_STREAM_URL || '';

// Wrap any API call so it NEVER throws — always returns {success, code, message, data}
const safe = async (fn) => {
  try {
    return await fn();
  } catch (error) {
    if (error?.response) {
      // HTTP error with response body
      const status = error.response.status;
      const msg = error.response.data?.message || error.response.statusText || `服务异常 (${status})`;
      if (status === 401) return failResult('登录已过期，请重新登录', 401);
      if (status === 403) return failResult('无权限访问', 403);
      if (status >= 500) return failResult(msg, status);
      return failResult(msg, status);
    }
    if (error?.code === 'ERR_NETWORK' || error?.message?.includes('Network Error')) {
      return failResult('无法连接到服务器，请确认后端服务已启动', 0);
    }
    return failResult(error?.message || '请求失败', 0);
  }
};

// Extract error message from API response (handles nested structures)
const errMsg = (response, fallback) =>
  response?.message || response?.data?.message || fallback;

// ==================== Agent API ====================

export const agentAPI = {

  // ---------- 健康 & 会话 ----------

  getHealth: () => safe(async () => {
    const r = await api.get('/agent/health');
    return successResult(r.data, r.message);
  }),

  getSessions: () => safe(async () => {
    const r = await api.get('/agent/sessions');
    return successResult(normalizeArrayItems(r.data, normalizeAgentSessionSummary), r.message);
  }),

  getSession: (sessionId) => safe(async () => {
    const r = await api.get(`/agent/sessions/${sessionId}`);
    return successResult(normalizeAgentSessionDetail(r.data), r.message);
  }),

  deleteSession: (sessionId, userId) => safe(async () => {
    await api.delete(`/agent/sessions/${sessionId}`, { params: { user_id: userId || 'anonymous' } });
    return successResult(null, '删除成功');
  }),

  renameSession: (sessionId, userId, title) => safe(async () => {
    const r = await api.put(`/agent/sessions/${sessionId}/rename`, { user_id: userId, title });
    return successResult(r.data, r.message);
  }),

  // ---------- 聊天 ----------

  chat: (payload) => safe(async () => {
    const body = {
      user_id: String(payload.userId || payload.user_id || 'anonymous'),
      message: payload.message,
      session_id: payload.sessionId || payload.session_id || null,
      mode: payload.mode || (payload.metadata && payload.metadata.mode) || 'travel_assistant',
      metadata: payload.metadata || {},
    };
    const r = await api.post('/agent/chat', body);
    if (!r.success) return failResult(errMsg(r, '发送失败'), r.code || 500);
    return successResult({
      session: normalizeAgentSessionDetail(r.data?.session),
      reply: normalizeAgentReply(r.data?.reply),
    }, r.message);
  }),

  /**
   * SSE 流式聊天 — 返回异步生成器，逐事件产出。
   * 永远不会 throw；错误以 {event:"error", data:{message}} 事件产出。
   */
  chatStream: async function* (payload) {
    const token = localStorage.getItem('token');
    const url = `${AGENT_STREAM_BASE}/agent/chat/stream`;
    const sessionId = payload.sessionId || payload.session_id || null;
    const body = JSON.stringify({
      userId: String(payload.userId || payload.user_id || 'anonymous'),
      message: payload.message,
      sessionId: sessionId,
      mode: payload.mode || 'travel_assistant',
      metadata: payload.metadata || {},
    });

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body,
      });
    } catch {
      yield { event: 'error', data: { message: '无法连接到 Agent 服务，请确认服务已启动 (端口 9000)' } };
      return;
    }

    if (!response.ok) {
      yield { event: 'error', data: { message: `Agent 服务异常 (HTTP ${response.status})` } };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { event: 'error', data: { message: '浏览器不支持流式读取' } };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              yield { event: eventType || 'done', data: parsed };
            } catch {
              // skip unparseable chunks
            }
            eventType = '';
          }
        }
      }
    } catch {
      yield { event: 'error', data: { message: '流式连接中断' } };
    } finally {
      reader.releaseLock();
    }
  },

  // ---------- 出游搭子 ----------

  getBuddies: (userId) => safe(async () => {
    const r = await api.get('/agent/user/buddy', { params: { user_id: userId || 'anonymous' } });
    if (!r.success) return failResult(errMsg(r, '获取搭子失败'), r.code || 500);
    return successResult(normalizeArrayItems(r.data, normalizeBuddy), r.message);
  }),

  createBuddy: (payload) => safe(async () => {
    const r = await api.put('/agent/user/buddy', {
      user_id: payload.userId || 'anonymous',
      name: payload.name,
      personality: payload.personality || '',
      speaking_style: payload.speakingStyle || payload.speaking_style || '',
    });
    if (!r.success) return failResult(errMsg(r, '创建搭子失败'), r.code || 500);
    return successResult({
      id: r.data?.id, name: r.data?.name,
      personality: r.data?.personality || '',
      speakingStyle: r.data?.speaking_style || r.data?.speakingStyle || '',
      isPreset: r.data?.is_preset ?? r.data?.isPreset ?? false,
      preferenceScore: r.data?.preference_score ?? r.data?.preferenceScore ?? 0,
    }, r.message);
  }),

  updateBuddy: (buddyId, payload) => safe(async () => {
    const r = await api.put('/agent/user/buddy', {
      buddy_id: buddyId, user_id: payload.userId || 'anonymous',
      name: payload.name, personality: payload.personality || '',
      speaking_style: payload.speakingStyle || payload.speaking_style || '',
    });
    if (!r.success) return failResult(errMsg(r, '更新搭子失败'), r.code || 500);
    return successResult(r.data, r.message);
  }),

  deleteBuddy: (buddyId, userId) => safe(async () => {
    await api.delete(`/agent/user/buddy/${buddyId}`, { params: { user_id: userId || 'anonymous' } });
    return successResult(null, '搭子已删除');
  }),

  useBuddy: (buddyId, userId) => safe(async () => {
    const r = await api.post(`/agent/user/buddy/${buddyId}/use`, null, {
      params: { user_id: userId || 'anonymous' },
    });
    return successResult(r.data, r.message);
  }),

  // ---------- 日记生成 ----------

  generateDiary: (payload) => safe(async () => {
    const r = await api.post('/agent/diary/generate', {
      user_id: String(payload.userId || 'anonymous'),
      prompt: payload.prompt || '生成旅行日记',
      images: payload.images || [],
      style: payload.style || '小红书',
      metadata: payload.metadata || {},
    });
    if (!r.success) return failResult(errMsg(r, '日记生成失败'), r.code || 500);
    return successResult({
      taskId: r.data?.task_id || r.data?.taskId || '',
      status: r.data?.status || 'running',
      progress: r.data?.progress ?? 0,
      message: r.data?.message || '',
    }, r.message);
  }),

  getDiaryTaskStatus: (taskId) => safe(async () => {
    const r = await api.get(`/agent/diary/status/${taskId}`);
    if (!r.success) return failResult(errMsg(r, '查询进度失败'), r.code || 500);
    return successResult({
      taskId: r.data?.task_id || taskId,
      status: r.data?.status || 'unknown',
      progress: r.data?.progress ?? 0,
      result: r.data?.result || null,
      error: r.data?.error || null,
    }, r.message);
  }),

  // ---------- 路线规划 ----------

  planRoute: (payload) => safe(async () => {
    const r = await api.post('/agent/route/plan', {
      user_id: String(payload.userId || 'anonymous'),
      requirement: payload.requirement || payload.message || '',
    });
    if (!r.success) return failResult(errMsg(r, '路线规划失败'), r.code || 500);
    return successResult({
      summary: r.data?.result?.summary || '',
      itinerary: r.data?.result?.itinerary || {},
      toolsUsed: r.data?.result?.tools_used || [],
      traceId: r.data?.result?.trace_id || '',
      status: r.data?.status || 'ok',
    }, r.message);
  }),
};

// ==================== 便捷导出 ====================

export const getAgentHealth = () => agentAPI.getHealth();
export const getAgentSessions = () => agentAPI.getSessions();
export const getAgentSession = (sessionId) => agentAPI.getSession(sessionId);
export const deleteAgentSession = (sessionId, userId) => agentAPI.deleteSession(sessionId, userId);
export const renameAgentSession = (sessionId, userId, title) => agentAPI.renameSession(sessionId, userId, title);
export const chatWithAgent = (payload) => agentAPI.chat(payload);
export const chatWithAgentStream = (payload) => agentAPI.chatStream(payload);
export const getBuddies = (userId) => agentAPI.getBuddies(userId);
export const createBuddy = (payload) => agentAPI.createBuddy(payload);
export const updateBuddy = (buddyId, payload) => agentAPI.updateBuddy(buddyId, payload);
export const deleteBuddy = (buddyId, userId) => agentAPI.deleteBuddy(buddyId, userId);
export const useBuddy = (buddyId, userId) => agentAPI.useBuddy(buddyId, userId);
export const generateDiary = (payload) => agentAPI.generateDiary(payload);
export const getDiaryTaskStatus = (taskId) => agentAPI.getDiaryTaskStatus(taskId);
export const planRoute = (payload) => agentAPI.planRoute(payload);
