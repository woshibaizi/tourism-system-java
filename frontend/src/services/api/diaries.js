import api from './client';
import { fetchDiariesList } from './client';
import { userAPI } from './auth';
import { successResult, failResult, normalizeDiary, normalizeArrayItems, toNumber } from './normalize';

export const diaryAPI = {
  getDiaries: async (params = {}) => {
    const response = await fetchDiariesList(params);
    return successResult(normalizeArrayItems(response.data, normalizeDiary), response.message);
  },

  getDiary: async (diaryId) => {
    const response = await api.get(`/diaries/${diaryId}`);
    return successResult(normalizeDiary(response.data), response.message);
  },

  getDiariesByAuthor: async (authorId) => {
    const response = await api.get(`/diaries/author/${authorId}`);
    return successResult(normalizeArrayItems(response.data, normalizeDiary), response.message);
  },

  getHotDiaries: async (limit = 10) => {
    const response = await api.get('/diaries/hot', { params: { limit } });
    return successResult(normalizeArrayItems(response.data, normalizeDiary), response.message);
  },

  createDiary: async (data) => {
    const response = await api.post('/diaries', data);
    if (!response.success && response.code !== 200) {
      return failResult(response.message || '创建日记失败', response.code || 500);
    }
    return successResult(normalizeDiary(response.data), response.message);
  },

  updateDiary: async (diaryId, data) => {
    const response = await api.put(`/diaries/${diaryId}`, data);
    return successResult(normalizeDiary(response.data), response.message);
  },

  deleteDiary: (diaryId) => api.delete(`/diaries/${diaryId}`),

  searchDiaries: async (query, type = 'fulltext') => {
    const response = await api.get('/diaries/search', { params: { query, type } });
    return successResult(normalizeArrayItems(response.data, normalizeDiary), response.message);
  },

  recommendDiaries: async (userId, algorithm = 'content') => {
    const response = await api.post('/diaries/recommend', { userId, algorithm });
    return successResult(normalizeArrayItems(response.data, normalizeDiary), response.message);
  },

  getUserDiaryRating: async (diaryId, userId) => {
    try {
      const response = await userAPI.getRatingHistory(userId);
      if (response.success && Array.isArray(response.data)) {
        const rating = response.data.find(
          (b) => b.targetId === diaryId && b.behaviorType === 'RATE'
        );
        if (rating) {
          return successResult({ userRating: toNumber(rating.score), hasRated: true });
        }
      }
      return successResult({ userRating: null, hasRated: false });
    } catch {
      return successResult({ userRating: null, hasRated: false });
    }
  },

  rateDiary: async (diaryId, rating, userId) => {
    try {
      return await api.post(`/diaries/${diaryId}/rate`, { rating, userId });
    } catch {
      return failResult('评分失败，请稍后重试');
    }
  },

  toggleLike: async (diaryId, userId) => {
    const response = await api.post(`/diaries/${diaryId}/like?userId=${userId}`);
    return successResult(response.data, response.message);
  },

  getLikeStatus: async (diaryId, userId) => {
    const response = await api.get(`/diaries/${diaryId}/like`, { params: { userId } });
    return successResult(response.data, response.message);
  },

  getLikedDiaries: async (userId) => {
    const response = await api.get('/diaries/liked', { params: { userId } });
    return successResult(normalizeArrayItems(response.data, normalizeDiary), response.message);
  },
};

export const getDiaries = (params) => diaryAPI.getDiaries(params);
export const getDiary = (diaryId) => diaryAPI.getDiary(diaryId);
export const createDiary = (data) => diaryAPI.createDiary(data);
export const updateDiary = (diaryId, data) => diaryAPI.updateDiary(diaryId, data);
export const deleteDiary = (diaryId) => diaryAPI.deleteDiary(diaryId);
export const searchDiaries = (query, type) => diaryAPI.searchDiaries(query, type);
export const getRecommendedDiaries = (userId, algorithm) => diaryAPI.recommendDiaries(userId, algorithm);
export const getUserDiaryRating = (diaryId, userId) => diaryAPI.getUserDiaryRating(diaryId, userId);
export const rateDiary = (diaryId, rating, userId) => diaryAPI.rateDiary(diaryId, rating, userId);
export const toggleLikeDiary = (diaryId, userId) => diaryAPI.toggleLike(diaryId, userId);
export const getLikeStatus = (diaryId, userId) => diaryAPI.getLikeStatus(diaryId, userId);
export const getLikedDiaries = (userId) => diaryAPI.getLikedDiaries(userId);
