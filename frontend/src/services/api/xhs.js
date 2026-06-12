import api from './client';
import { successResult, failResult } from './normalize';

export const xhsAPI = {
  /** 绑定小红书账号 — POST /api/xhs/bind {cookies_str, user_id} */
  bind: async (userId, cookiesStr) => {
    try {
      const response = await api.post('/xhs/bind', { cookies_str: cookiesStr, user_id: userId });
      return successResult(response.data, response.message);
    } catch (e) {
      return failResult(e.response?.data?.message || '绑定失败，请检查 Cookie 是否有效');
    }
  },

  /** 解除绑定 — DELETE /api/xhs/unbind?userId= */
  unbind: async (userId) => {
    try {
      const response = await api.delete('/xhs/unbind', { params: { userId } });
      return successResult(response.data, response.message);
    } catch (e) {
      return failResult(e.response?.data?.message || '解绑失败');
    }
  },

  /** 查询绑定状态 — GET /api/xhs/status?userId= */
  getStatus: async (userId) => {
    try {
      const response = await api.get('/xhs/status', { params: { userId } });
      return successResult(response.data, response.message);
    } catch (e) {
      return failResult(e.response?.data?.message || '查询绑定状态失败');
    }
  },

  /** 发布日记到小红书 — POST /api/diaries/{id}/xhs-publish */
  publishDiary: async (diaryId, userId) => {
    try {
      const response = await api.post(`/diaries/${diaryId}/xhs-publish`, { userId });
      return successResult(response.data, response.message);
    } catch (e) {
      return failResult(e.response?.data?.message || '发布失败');
    }
  },

  /** 刷新景点小红书热度 — POST /api/places/{id}/refresh-xhs */
  refreshPlace: async (placeId) => {
    try {
      const response = await api.post(`/places/${placeId}/refresh-xhs`);
      return successResult(response.data, response.message);
    } catch (e) {
      return failResult(e.response?.data?.message || '刷新小红书数据失败');
    }
  },
};

export const bindXhsAccount = (userId, cookiesStr) => xhsAPI.bind(userId, cookiesStr);
export const unbindXhsAccount = (userId) => xhsAPI.unbind(userId);
export const getXhsStatus = (userId) => xhsAPI.getStatus(userId);
export const publishDiaryToXhs = (diaryId, userId) => xhsAPI.publishDiary(diaryId, userId);
export const refreshPlaceXhs = (placeId) => xhsAPI.refreshPlace(placeId);
