import api from './client';
import { successResult } from './normalize';

export const foodAPI = {
  getFoodsByPlace: (placeId) => api.get(`/foods/place/${placeId}`),

  getFoodsByCuisine: (cuisine) => api.get(`/foods/cuisine/${cuisine}`),

  getPopularFoods: (placeId, limit = 10) => api.get('/foods/popular', { params: { placeId, limit } }),

  getFood: (foodId) => api.get(`/foods/${foodId}`),

  getCuisines: async (placeId) => {
    try {
      const response = await api.get('/foods/cuisines', { params: { placeId } });
      return successResult(Array.isArray(response.data) ? response.data : [], response.message);
    } catch {
      return successResult([]);
    }
  },

  searchFoods: async (placeId, params = {}) => {
    try {
      const response = await api.get('/foods', {
        params: {
          placeId,
          cuisine: params.cuisine,
          search: params.search,
          sortBy: params.sortBy,
          originBuildingId: params.originBuildingId,
          limit: params.limit,
        },
      });
      const payload = response.data || {};
      return {
        success: true,
        data: Array.isArray(payload.items) ? payload.items : [],
        total: payload.total ?? 0,
      };
    } catch {
      return { success: false, data: [], total: 0 };
    }
  },
};

export const getFoodsByPlace = (placeId) => foodAPI.getFoodsByPlace(placeId);
export const getPopularFoods = (placeId, limit) => foodAPI.getPopularFoods(placeId, limit);
