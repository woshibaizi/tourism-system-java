import api from './client';
import { placeAPI } from './places';
import { diaryAPI } from './diaries';

export const statsAPI = {
  getStatistics: () => api.get('/stats'),

  getPopularPlaces: (limit = 10) => placeAPI.getHotPlaces(limit),
};

export const getStatistics = () => statsAPI.getStatistics();

export const recommendationAPI = {
  recommendPlaces: (params = {}) => placeAPI.recommendPlaces(params.userId),

  recommendDiaries: (params = {}) => diaryAPI.recommendDiaries(params.userId),
};

export const searchAPI = {
  globalSearch: async (query) => {
    const [placesResult, diariesResult] = await Promise.allSettled([
      placeAPI.searchPlaces(query),
      diaryAPI.searchDiaries(query),
    ]);

    return {
      places: placesResult.status === 'fulfilled' ? placesResult.value.data : [],
      diaries: diariesResult.status === 'fulfilled' ? diariesResult.value.data : [],
    };
  },
};
