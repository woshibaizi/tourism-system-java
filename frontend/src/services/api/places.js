import api from './client';
import { fetchPlacesList } from './client';
import { userAPI } from './auth';
import { successResult, failResult, normalizePlace, normalizeArrayItems, toNumber } from './normalize';

export const placeAPI = {
  getPlaces: async (params = {}) => {
    const response = await fetchPlacesList(params);
    return successResult(normalizeArrayItems(response.data, normalizePlace), response.message);
  },

  getPlace: async (placeId) => {
    const response = await api.get(`/places/${placeId}`);
    const detail = response.data || {};
    return successResult({
      ...detail,
      place: normalizePlace(detail.place),
    }, response.message);
  },

  searchPlaces: async (query, type = 'fuzzy') => {
    const response = await api.get('/places/search', { params: { query, type } });
    return successResult(normalizeArrayItems(response.data, normalizePlace), response.message);
  },

  getHotPlaces: async (limit = 10) => {
    const response = await api.get('/places/hot', { params: { limit } });
    return successResult(normalizeArrayItems(response.data, normalizePlace), response.message);
  },

  getTopRatedPlaces: async (limit = 10) => {
    const response = await api.get('/places/top-rated', { params: { limit } });
    return successResult(normalizeArrayItems(response.data, normalizePlace), response.message);
  },

  getPlacesByType: async (type) => {
    const response = await api.get(`/places/type/${type}`);
    return successResult(normalizeArrayItems(response.data, normalizePlace), response.message);
  },

  recommendPlaces: async (userId, algorithm = 'hybrid') => {
    const response = await api.post('/places/recommend', { userId, algorithm });
    return successResult(normalizeArrayItems(response.data, normalizePlace), response.message);
  },

  sortPlaces: async (sortType, topK = 12, placeIds = []) => {
    const response = await api.post('/places/sort', { sortType, topK, placeIds });
    return successResult(normalizeArrayItems(response.data, normalizePlace), response.message);
  },

  getUserRating: async (placeId, userId) => {
    try {
      const response = await userAPI.getRatingHistory(userId);
      if (response.success && Array.isArray(response.data)) {
        const rating = response.data.find(
          (b) => b.targetId === placeId && b.behaviorType === 'RATE'
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

  ratePlace: async (placeId, rating, userId) => {
    try {
      return await api.post(`/places/${placeId}/rate`, { rating, userId });
    } catch {
      return failResult('评分失败，请稍后重试');
    }
  },

  recordVisit: async (placeId, userId) => {
    try {
      return await userAPI.recordBehavior(userId, placeId, 'VIEW', null);
    } catch {
      return successResult();
    }
  },
};

export const getPlaces = (params) => placeAPI.getPlaces(params);
export const getPlace = (placeId) => placeAPI.getPlace(placeId);
export const searchPlaces = (query, type) => placeAPI.searchPlaces(query, type);
export const getHotPlaces = (limit) => placeAPI.getHotPlaces(limit);
export const getTopRatedPlaces = (limit) => placeAPI.getTopRatedPlaces(limit);
export const getRecommendedPlaces = (userId, algorithm) => placeAPI.recommendPlaces(userId, algorithm);
export const sortPlaces = (sortType, topK, placeIds) => placeAPI.sortPlaces(sortType, topK, placeIds);
export const getUserRating = (placeId, userId) => placeAPI.getUserRating(placeId, userId);
export const ratePlace = (placeId, rating, userId) => placeAPI.ratePlace(placeId, rating, userId);
export const recordVisit = (placeId, userId) => placeAPI.recordVisit(placeId, userId);
