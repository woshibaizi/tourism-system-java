import axios from 'axios';
import { message } from 'antd';

const DEFAULT_LIST_SIZE = 1000;

const normalizeEnvelope = (payload) => {
  if (payload && typeof payload.code === 'number') {
    return {
      success: payload.code === 200,
      code: payload.code,
      message: payload.message,
      data: payload.data,
    };
  }

  return {
    success: true,
    code: 200,
    message: 'success',
    data: payload,
  };
};

const unwrapPageRecords = (response) => {
  const data = response?.data;
  if (Array.isArray(data)) {
    return response;
  }
  if (data && Array.isArray(data.records)) {
    return {
      ...response,
      data: data.records,
      page: {
        current: data.current,
        size: data.size,
        total: data.total,
        pages: data.pages,
      },
    };
  }
  return response;
};

const successResult = (data = null, messageText = 'success') => ({
  success: true,
  code: 200,
  message: messageText,
  data,
});

const failResult = (messageText, code = 500, data = null) => ({
  success: false,
  code,
  message: messageText,
  data,
});

const isMissingEndpointError = (error) => [404, 405, 501].includes(error?.response?.status);

const buildListParams = (params = {}) => {
  const normalized = { ...params };
  if (normalized.pageSize != null && normalized.size == null) {
    normalized.size = normalized.pageSize;
  }
  delete normalized.pageSize;

  if (normalized.page == null) {
    normalized.page = 1;
  }
  if (normalized.size == null) {
    normalized.size = DEFAULT_LIST_SIZE;
  }

  return normalized;
};

const unwrapArrayData = (response) => {
  const normalized = unwrapPageRecords(response);
  return Array.isArray(normalized?.data) ? normalized.data : [];
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// 创建axios实例
const api = axios.create({
  baseURL: import.meta.env.VITE_APP_API_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return normalizeEnvelope(response.data);
  },
  (error) => {
    const errorMessage = error.response?.data?.message || '网络错误，请稍后重试';
    if (!error.config?.skipErrorMessage) {
      message.error(errorMessage);
    }
    return Promise.reject(error);
  }
);

// ==================== 内部分页请求 ====================

const fetchPlacesList = async (params = {}) => unwrapPageRecords(await api.get('/places', { params: buildListParams(params) }));
const fetchBuildingsList = async (params = {}) => unwrapPageRecords(await api.get('/buildings', { params: buildListParams(params) }));
const fetchFacilitiesList = async (params = {}) => unwrapPageRecords(await api.get('/facilities', { params: buildListParams(params) }));
const fetchDiariesList = async (params = {}) => unwrapPageRecords(await api.get('/diaries', { params: buildListParams(params) }));

// ==================== 用户相关API ====================

export const userAPI = {
  // 获取所有用户
  getUsers: () => api.get('/users'),

  // 获取特定用户
  getUser: (userId) => api.get(`/users/${userId}`),

  // 更新用户信息
  updateUser: (userId, data) => api.put(`/users/${userId}`, data),

  // 用户登录
  login: (credentials) => api.post('/auth/login', credentials),

  // 用户注册
  register: (payload) => api.post('/auth/register', payload),

  // 获取当前用户
  getCurrentUser: () => api.get('/auth/me'),

  // 记录用户行为（浏览/评分）
  recordBehavior: (userId, targetId, behaviorType, score) =>
    api.post(`/users/${userId}/behavior`, null, {
      params: { targetId, behaviorType, ...(score != null ? { score } : {}) },
    }),

  // 查询用户浏览历史
  getViewHistory: (userId) => api.get(`/users/${userId}/views`),

  // 查询用户评分历史
  getRatingHistory: (userId) => api.get(`/users/${userId}/ratings`),
};

export const getUsers = () => userAPI.getUsers();
export const getUser = (userId) => userAPI.getUser(userId);
export const login = (credentials) => userAPI.login(credentials);
export const register = (payload) => userAPI.register(payload);
export const getCurrentUser = () => userAPI.getCurrentUser();

// ==================== 场所相关API ====================

export const placeAPI = {
  // 获取场所列表（分页）
  getPlaces: async (params = {}) => fetchPlacesList(params),
  
  // 获取场所详情（含建筑物和设施）
  getPlace: (placeId) => api.get(`/places/${placeId}`),
  
  // 搜索场所
  searchPlaces: (query, type = 'fuzzy') => api.get('/places/search', { params: { query, type } }),

  // 获取热门场所（按浏览量排序）
  getHotPlaces: (limit = 10) => api.get('/places/hot', { params: { limit } }),

  // 获取高评分场所
  getTopRatedPlaces: (limit = 10) => api.get('/places/top-rated', { params: { limit } }),

  // 按类型查询场所
  getPlacesByType: (type) => api.get(`/places/type/${type}`),

  // 推荐场所（降级为热门场所）
  recommendPlaces: async (userId, algorithm = 'hybrid') => {
    try {
      return await api.post('/places/recommend', { userId, algorithm });
    } catch (error) {
      if (!isMissingEndpointError(error)) {
        throw error;
      }
      // 降级：使用热门场所接口
      try {
        return await api.get('/places/hot', { params: { limit: 12 } });
      } catch {
        // 兜底：从列表接口排序
        const places = unwrapArrayData(await fetchPlacesList());
        const sorted = [...places].sort((a, b) => {
          const clickDiff = toNumber(b.clickCount) - toNumber(a.clickCount);
          if (clickDiff !== 0) return clickDiff;
          return toNumber(b.rating) - toNumber(a.rating);
        });
        return successResult(sorted.slice(0, 12));
      }
    }
  },
  
  // 场所排序（使用Top-K优化）
  sortPlaces: async (sortType, topK = 12, placeIds = []) => {
    try {
      return await api.post('/places/sort', { sortType, topK, placeIds });
    } catch (error) {
      if (!isMissingEndpointError(error)) {
        throw error;
      }

      // 降级：使用后端已有的热门/高评分接口
      if (sortType === 'rating') {
        try {
          return await api.get('/places/top-rated', { params: { limit: topK } });
        } catch {
          // fall through
        }
      } else {
        try {
          return await api.get('/places/hot', { params: { limit: topK } });
        } catch {
          // fall through
        }
      }

      // 兜底：前端排序
      const places = unwrapArrayData(await fetchPlacesList());
      const filtered = placeIds.length > 0
        ? places.filter((place) => placeIds.includes(place.id))
        : places;

      const sorted = [...filtered].sort((a, b) => {
        if (sortType === 'rating') {
          return toNumber(b.rating) - toNumber(a.rating);
        }
        return toNumber(b.clickCount) - toNumber(a.clickCount);
      });

      return successResult(topK > 0 ? sorted.slice(0, topK) : sorted);
    }
  },
  
  // 获取用户对场所的评分（通过用户行为接口实现）
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
    } catch (error) {
      return successResult({ userRating: null, hasRated: false });
    }
  },
  
  // 为场所评分（通过用户行为接口实现）
  ratePlace: async (placeId, rating, userId) => {
    try {
      const response = await userAPI.recordBehavior(userId, placeId, 'RATE', rating);
      if (response.success) {
        return successResult({ rating, ratingCount: 0 });
      }
      return failResult('评分失败');
    } catch (error) {
      return failResult('评分失败，请稍后重试');
    }
  },
  
  // 记录访问历史（通过用户行为接口实现）
  recordVisit: async (placeId, userId) => {
    try {
      return await userAPI.recordBehavior(userId, placeId, 'VIEW', null);
    } catch (error) {
      return successResult();
    }
  },
};

// 简化的API导出
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

// ==================== 建筑物相关API ====================

export const buildingAPI = {
  // 获取建筑物列表（分页）
  getBuildings: async (params = {}) => fetchBuildingsList(params),
  
  // 获取建筑物详情
  getBuilding: (buildingId) => api.get(`/buildings/${buildingId}`),
  
  // 根据场所获取建筑物列表
  getBuildingsByPlace: async (placeId) => {
    try {
      return await api.get(`/buildings/place/${placeId}`);
    } catch (error) {
      if (!isMissingEndpointError(error)) throw error;
      return fetchBuildingsList({ placeId });
    }
  },
  
  // 搜索建筑物
  searchBuildings: (query, placeId) => api.get('/buildings/search', { params: { query, placeId } }),
};

// 简化的API导出
export const getBuildings = (placeId) => buildingAPI.getBuildings(placeId ? { placeId } : {});
export const getBuildingsByPlace = (placeId) => buildingAPI.getBuildingsByPlace(placeId);
export const searchBuildings = (query, placeId) => buildingAPI.searchBuildings(query, placeId);

// ==================== 设施相关API ====================

export const facilityAPI = {
  // 获取设施列表（分页）
  getFacilities: async (params = {}) => fetchFacilitiesList(params),

  // 获取设施详情
  getFacility: (facilityId) => api.get(`/facilities/${facilityId}`),

  // 根据场所获取设施列表
  getFacilitiesByPlace: (placeId) => api.get(`/facilities/place/${placeId}`),

  // 根据场所和类型获取设施列表
  getFacilitiesByPlaceAndType: (placeId, type) => api.get(`/facilities/place/${placeId}/type/${type}`),
  
  // 搜索设施
  searchFacilities: (query, placeId, type) => api.get('/facilities/search', { params: { query, placeId, type } }),
  
  // 获取附近设施（LBS）
  getNearbyFacilities: (location, type, maxDistance = 1000) =>
    api.get('/facilities/nearby', {
      params: {
        lat: location?.lat,
        lng: location?.lng,
        type,
        radius: maxDistance,
      },
    }),
  
  // 获取最近设施（基于建筑坐标距离排序）
  getNearestFacilities: async (buildingId, placeId, facilityType = 'all') => {
    try {
      return await api.post('/facilities/nearest', { buildingId, placeId, facilityType });
    } catch (error) {
      if (!isMissingEndpointError(error)) {
        throw error;
      }

      // 降级：前端计算距离
      const [buildingsResponse, facilitiesResponse] = await Promise.all([
        fetchBuildingsList({ placeId }),
        fetchFacilitiesList(
          facilityType && facilityType !== 'all'
            ? { placeId, type: facilityType }
            : { placeId }
        ),
      ]);

      const building = unwrapArrayData(buildingsResponse).find((item) => item.id === buildingId);
      if (!building?.lat || !building?.lng) {
        return failResult('当前建筑物缺少坐标信息', 400);
      }

      const nearestFacilities = unwrapArrayData(facilitiesResponse)
        .filter((facility) => facility?.lat != null && facility?.lng != null)
        .map((facility) => ({
          ...facility,
          distance: Math.round(
            calculateDistance(
              toNumber(building.lat),
              toNumber(building.lng),
              toNumber(facility.lat),
              toNumber(facility.lng)
            )
          ),
        }))
        .sort((a, b) => a.distance - b.distance);

      return successResult(nearestFacilities);
    }
  },
};

// 简化的API导出
export const getFacilities = (placeId, type) => {
  const params = {};
  if (placeId) params.placeId = placeId;
  if (type) params.type = type;
  return facilityAPI.getFacilities(params);
};
export const searchFacilities = (query, placeId, type) => facilityAPI.searchFacilities(query, placeId, type);
export const getNearbyFacilities = (location, type, maxDistance) => facilityAPI.getNearbyFacilities(location, type, maxDistance);
export const getNearestFacilities = (buildingId, placeId, facilityType) => facilityAPI.getNearestFacilities(buildingId, placeId, facilityType);

// ==================== 美食相关API ====================

export const foodAPI = {
  // 根据场所ID获取美食列表
  getFoodsByPlace: (placeId) => api.get(`/foods/place/${placeId}`),

  // 根据菜系筛选美食
  getFoodsByCuisine: (cuisine) => api.get(`/foods/cuisine/${cuisine}`),

  // 获取热门美食
  getPopularFoods: (placeId, limit = 10) => api.get('/foods/popular', { params: { placeId, limit } }),

  // 获取美食详情
  getFood: (foodId) => api.get(`/foods/${foodId}`),

  // 获取菜系列表（从美食数据中提取）
  getCuisines: async (placeId) => {
    try {
      const response = await api.get(`/foods/place/${placeId}`);
      if (response.success && Array.isArray(response.data)) {
        const cuisines = [...new Set(response.data.map((f) => f.cuisine).filter(Boolean))];
        return successResult(cuisines);
      }
      return successResult([]);
    } catch {
      return successResult([]);
    }
  },

  // 搜索美食（从列表中前端过滤）
  searchFoods: async (placeId, params = {}) => {
    try {
      let foods;
      if (params.cuisine) {
        const response = await api.get(`/foods/cuisine/${params.cuisine}`);
        foods = response.success ? response.data : [];
        // 按场所过滤
        if (placeId) {
          foods = foods.filter((f) => f.placeId === placeId);
        }
      } else if (placeId) {
        const response = await api.get(`/foods/place/${placeId}`);
        foods = response.success ? response.data : [];
      } else {
        const response = await api.get('/foods/popular', { params: { limit: 100 } });
        foods = response.success ? response.data : [];
      }

      // 搜索过滤
      if (params.search) {
        const keyword = params.search.toLowerCase();
        foods = foods.filter(
          (f) =>
            (f.name || '').toLowerCase().includes(keyword) ||
            (f.description || '').toLowerCase().includes(keyword)
        );
      }

      // 按热度排序
      if (params.sortBy === 'popularity') {
        foods.sort((a, b) => toNumber(b.popularity) - toNumber(a.popularity));
      }

      // 限制条数
      const limit = params.limit || 12;
      const result = foods.slice(0, limit);

      return {
        success: true,
        data: result,
        total: foods.length,
      };
    } catch {
      return { success: false, data: [], total: 0 };
    }
  },
};

export const getFoodsByPlace = (placeId) => foodAPI.getFoodsByPlace(placeId);
export const getPopularFoods = (placeId, limit) => foodAPI.getPopularFoods(placeId, limit);

// ==================== 路径规划相关API ====================

export const routeAPI = {
  // 计算最短路径
  calculateShortestRoute: async (data) => {
    try {
      return await api.post('/routes/single', data);
    } catch (error) {
      if (!isMissingEndpointError(error)) {
        throw error;
      }
      return failResult('当前后端未实现单目标路径规划接口', 501);
    }
  },
  
  // 计算多目标路径(TSP)
  calculateMultiDestinationRoute: async (data) => {
    try {
      return await api.post('/routes/multi', data);
    } catch (error) {
      if (!isMissingEndpointError(error)) {
        throw error;
      }
      return failResult('当前后端未实现多目标路径规划接口', 501);
    }
  },
};

// 简化的API导出
export const planSingleRoute = (data) => routeAPI.calculateShortestRoute(data);
export const planMultiRoute = (data) => routeAPI.calculateMultiDestinationRoute(data);

// ==================== 旅游日记相关API ====================

export const diaryAPI = {
  // 获取日记列表（分页）
  getDiaries: async (params = {}) => fetchDiariesList(params),
  
  // 获取日记详情
  getDiary: (diaryId) => api.get(`/diaries/${diaryId}`),

  // 根据作者查询日记
  getDiariesByAuthor: (authorId) => api.get(`/diaries/author/${authorId}`),

  // 获取热门日记
  getHotDiaries: (limit = 10) => api.get('/diaries/hot', { params: { limit } }),
  
  // 创建日记
  createDiary: (data) => api.post('/diaries', data),
  
  // 更新日记
  updateDiary: (diaryId, data) => api.put(`/diaries/${diaryId}`, data),
  
  // 删除日记
  deleteDiary: (diaryId) => api.delete(`/diaries/${diaryId}`),
  
  // 搜索日记（前端过滤）
  searchDiaries: async (query, type = 'fulltext') => {
    try {
      return await api.get('/diaries/search', { params: { query, type } });
    } catch (error) {
      if (!isMissingEndpointError(error)) {
        throw error;
      }

      const normalizedQuery = String(query || '').trim().toLowerCase();
      const [diariesResponse, placesResponse] = await Promise.all([
        fetchDiariesList(),
        fetchPlacesList(),
      ]);

      const placeNameMap = new Map(
        unwrapArrayData(placesResponse).map((place) => [place.id, place.name || ''])
      );

      const matched = unwrapArrayData(diariesResponse).filter((diary) => {
        const title = String(diary.title || '').toLowerCase();
        const content = String(diary.content || '').toLowerCase();
        const destination = String(placeNameMap.get(diary.placeId) || diary.placeId || '').toLowerCase();

        if (type === 'title') {
          return title.includes(normalizedQuery);
        }
        if (type === 'content') {
          return content.includes(normalizedQuery);
        }
        if (type === 'destination') {
          return destination.includes(normalizedQuery);
        }

        return title.includes(normalizedQuery)
          || content.includes(normalizedQuery)
          || destination.includes(normalizedQuery);
      });

      return successResult(matched);
    }
  },
  
  // 按标题精准搜索日记
  searchDiariesByTitle: (title) => diaryAPI.searchDiaries(title, 'title'),
  
  // 按内容搜索日记
  searchDiariesByContent: (content) => diaryAPI.searchDiaries(content, 'content'),
  
  // 按目的地搜索日记
  searchDiariesByDestination: (destination) => diaryAPI.searchDiaries(destination, 'destination'),
  
  // 推荐日记（降级为热门日记）
  recommendDiaries: async (userId, algorithm = 'content') => {
    try {
      return await api.post('/diaries/recommend', { userId, algorithm });
    } catch (error) {
      if (!isMissingEndpointError(error)) {
        throw error;
      }
      // 降级：使用热门日记接口
      try {
        return await api.get('/diaries/hot', { params: { limit: 12 } });
      } catch {
        // 兜底：前端排序
        const diaries = unwrapArrayData(await fetchDiariesList());
        const sorted = [...diaries].sort((a, b) => {
          const clickDiff = toNumber(b.clickCount) - toNumber(a.clickCount);
          if (clickDiff !== 0) return clickDiff;
          return toNumber(b.rating) - toNumber(a.rating);
        });
        return successResult(sorted.slice(0, 12));
      }
    }
  },
  
  // 获取用户对日记的评分（通过用户行为接口实现）
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
    } catch (error) {
      return successResult({ userRating: null, hasRated: false });
    }
  },
  
  // 为日记评分（通过用户行为接口实现）
  rateDiary: async (diaryId, rating, userId) => {
    try {
      const response = await userAPI.recordBehavior(userId, diaryId, 'RATE', rating);
      if (response.success) {
        return successResult({ rating, ratingCount: 0 });
      }
      return failResult('评分失败');
    } catch (error) {
      return failResult('评分失败，请稍后重试');
    }
  },
};

// 简化的API导出
export const getDiaries = (params) => diaryAPI.getDiaries(params);
export const getDiary = (diaryId) => diaryAPI.getDiary(diaryId);
export const createDiary = (data) => diaryAPI.createDiary(data);
export const updateDiary = (diaryId, data) => diaryAPI.updateDiary(diaryId, data);
export const deleteDiary = (diaryId) => diaryAPI.deleteDiary(diaryId);
export const searchDiaries = (query, type) => diaryAPI.searchDiaries(query, type);
export const searchDiariesByTitle = (title) => diaryAPI.searchDiariesByTitle(title);
export const searchDiariesByContent = (content) => diaryAPI.searchDiariesByContent(content);
export const searchDiariesByDestination = (destination) => diaryAPI.searchDiariesByDestination(destination);
export const getRecommendedDiaries = (userId, algorithm) => diaryAPI.recommendDiaries(userId, algorithm);
export const getUserDiaryRating = (diaryId, userId) => diaryAPI.getUserDiaryRating(diaryId, userId);
export const rateDiary = (diaryId, rating, userId) => diaryAPI.rateDiary(diaryId, rating, userId);

// ==================== 文件上传相关API ====================

export const uploadAPI = {
  // 上传图片
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // 上传视频
  uploadVideo: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload/video', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

// 简化的API导出
export const uploadImage = (file) => uploadAPI.uploadImage(file);
export const uploadVideo = (file) => uploadAPI.uploadVideo(file);

// ==================== 统计分析相关API ====================

export const statsAPI = {
  // 获取系统统计信息（对接 Java 后端 GET /api/stats）
  getStatistics: async () => {
    try {
      return await api.get('/stats');
    } catch (error) {
      if (!isMissingEndpointError(error)) {
        throw error;
      }

      const [placesResponse, diariesResponse, usersResponse] = await Promise.all([
        fetchPlacesList(),
        fetchDiariesList(),
        userAPI.getUsers(),
      ]);

      return successResult({
        places: unwrapArrayData(placesResponse).length,
        diaries: unwrapArrayData(diariesResponse).length,
        users: Array.isArray(usersResponse?.data) ? usersResponse.data.length : 0,
        roads: 0,
      });
    }
  },
  
  // 获取热门场所统计（使用新后端接口）
  getPopularPlaces: (limit = 10) => placeAPI.getHotPlaces(limit),
};

// 简化的API导出
export const getStatistics = () => statsAPI.getStatistics();

// ==================== 推荐系统相关API ====================

export const recommendationAPI = {
  // 推荐场所
  recommendPlaces: (params = {}) => placeAPI.recommendPlaces(params.userId),
  
  // 推荐日记
  recommendDiaries: (params = {}) => diaryAPI.recommendDiaries(params.userId),
};

// ==================== 搜索相关API ====================

export const searchAPI = {
  // 全局搜索
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

// ==================== 工具函数 ====================

// 获取文件URL
export const getFileUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const basePath = path.startsWith('/') ? path : `/${path}`;
  return `${import.meta.env.VITE_APP_API_URL || '/api'}${basePath}`;
};

// 格式化文件大小
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 格式化距离
export const formatDistance = (meters) => {
  if (meters < 1000) {
    return `${Math.round(meters)}米`;
  } else {
    return `${(meters / 1000).toFixed(1)}公里`;
  }
};

// 格式化时间
export const formatDuration = (minutes) => {
  if (minutes < 60) {
    return `${Math.round(minutes)}分钟`;
  } else {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}小时${mins > 0 ? mins + '分钟' : ''}`;
  }
};

// 计算两点间距离（Haversine公式）
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // 地球半径（公里）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c * 1000; // 返回米
};

export default api; 
