import axios from 'axios';
import { message } from 'antd';

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

// 创建axios实例
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8080/api',
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

// ==================== 用户相关API ====================

export const userAPI = {
  // 获取所有用户
  getUsers: () => api.get('/users'),

  // 获取特定用户
  getUser: (userId) => api.get(`/users/${userId}`),

  // 用户登录
  login: (credentials) => api.post('/auth/login', credentials),

  // 用户注册
  register: (payload) => api.post('/auth/register', payload),

  // 获取当前用户
  getCurrentUser: () => api.get('/auth/me'),
};

export const getUsers = () => userAPI.getUsers();
export const getUser = (userId) => userAPI.getUser(userId);
export const login = (credentials) => userAPI.login(credentials);
export const register = (payload) => userAPI.register(payload);
export const getCurrentUser = () => userAPI.getCurrentUser();

// ==================== 场所相关API ====================

export const placeAPI = {
  // 获取场所列表
  getPlaces: async (params = {}) => unwrapPageRecords(await api.get('/places', { params })),
  
  // 获取场所详情
  getPlace: (placeId) => api.get(`/places/${placeId}`),
  
  // 搜索场所
  searchPlaces: (query, type = 'fuzzy') => api.get('/places/search', { params: { query, type } }),
  
  // 推荐场所
  recommendPlaces: (userId, algorithm = 'hybrid') => api.post('/places/recommend', { userId, algorithm }),
  
  // 场所排序（使用Top-K优化）
  sortPlaces: (sortType, topK = 12, placeIds = []) => 
    api.post('/places/sort', { sortType, topK, placeIds }),
  
  // 获取用户对场所的评分
  getUserRating: (placeId, userId) => api.get(`/places/${placeId}/user-rating/${userId}`),
  
  // 为场所评分
  ratePlace: (placeId, rating, userId) => api.post(`/places/${placeId}/rate`, { rating, userId }),
  
  // 记录访问历史
  recordVisit: (placeId, userId) => api.post(`/places/${placeId}/visit`, { userId }),
};

// 简化的API导出
export const getPlaces = () => placeAPI.getPlaces();
export const getPlace = (placeId) => placeAPI.getPlace(placeId);
export const searchPlaces = (query, type) => placeAPI.searchPlaces(query, type);
export const getRecommendedPlaces = (userId, algorithm) => placeAPI.recommendPlaces(userId, algorithm);
export const sortPlaces = (sortType, topK, placeIds) => placeAPI.sortPlaces(sortType, topK, placeIds);
export const getUserRating = (placeId, userId) => placeAPI.getUserRating(placeId, userId);
export const ratePlace = (placeId, rating, userId) => placeAPI.ratePlace(placeId, rating, userId);
export const recordVisit = (placeId, userId) => placeAPI.recordVisit(placeId, userId);

// ==================== 建筑物相关API ====================

export const buildingAPI = {
  // 获取建筑物列表
  getBuildings: async (params = {}) => unwrapPageRecords(await api.get('/buildings', { params })),
  
  // 获取建筑物详情
  getBuilding: (buildingId) => api.get(`/buildings/${buildingId}`),
  
  // 根据场所获取建筑物
  getBuildingsByPlace: (placeId) => api.get('/buildings', { params: { placeId } }),
  
  // 搜索建筑物
  searchBuildings: (query, placeId) => api.get('/buildings/search', { params: { query, placeId } }),
};

// 简化的API导出
export const getBuildings = (placeId) => buildingAPI.getBuildings(placeId ? { placeId } : {});
export const getBuildingsByPlace = (placeId) => buildingAPI.getBuildingsByPlace(placeId);
export const searchBuildings = (query, placeId) => buildingAPI.searchBuildings(query, placeId);

// ==================== 设施相关API ====================

export const facilityAPI = {
  // 获取设施列表
  getFacilities: async (params = {}) => unwrapPageRecords(await api.get('/facilities', { params })),
  
  // 搜索设施
  searchFacilities: (query, placeId, type) => api.get('/facilities/search', { params: { query, placeId, type } }),
  
  // 获取附近设施
  getNearbyFacilities: (location, type, maxDistance = 1000) =>
    api.get('/facilities/nearby', {
      params: {
        lat: location?.lat,
        lng: location?.lng,
        type,
        radius: maxDistance,
      },
    }),
  
  // 获取最近设施（基于路径距离）
  getNearestFacilities: (buildingId, placeId, facilityType = 'all') =>
    api.post('/facilities/nearest', { buildingId, placeId, facilityType }),
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

// ==================== 路径规划相关API ====================

export const routeAPI = {
  // 计算最短路径
  calculateShortestRoute: (data) => api.post('/routes/single', data),
  
  // 计算多目标路径(TSP)
  calculateMultiDestinationRoute: (data) => api.post('/routes/multi', data),
};

// 简化的API导出
export const planSingleRoute = (data) => routeAPI.calculateShortestRoute(data);
export const planMultiRoute = (data) => routeAPI.calculateMultiDestinationRoute(data);

// ==================== 推荐系统相关API ====================

export const recommendationAPI = {
  // 推荐场所
  recommendPlaces: (params = {}) => api.get('/recommendations/places', { params }),
  
  // 推荐日记
  recommendDiaries: (params = {}) => api.get('/recommendations/diaries', { params }),
};

// ==================== 旅游日记相关API ====================

export const diaryAPI = {
  // 获取日记列表
  getDiaries: (params = {}) => api.get('/diaries', { params }),
  
  // 获取日记详情
  getDiary: (diaryId) => api.get(`/diaries/${diaryId}`),
  
  // 创建日记
  createDiary: (data) => api.post('/diaries', data),
  
  // 更新日记
  updateDiary: (diaryId, data) => api.put(`/diaries/${diaryId}`, data),
  
  // 删除日记
  deleteDiary: (diaryId) => api.delete(`/diaries/${diaryId}`),
  
  // 搜索日记
  searchDiaries: (query, type = 'fulltext') => api.get('/diaries/search', { params: { query, type } }),
  
  // 按标题精准搜索日记
  searchDiariesByTitle: (title) => api.get('/diaries/search', { params: { query: title, type: 'title' } }),
  
  // 按内容搜索日记
  searchDiariesByContent: (content) => api.get('/diaries/search', { params: { query: content, type: 'content' } }),
  
  // 按目的地搜索日记
  searchDiariesByDestination: (destination) => api.get('/diaries/search', { params: { query: destination, type: 'destination' } }),
  
  // 推荐日记
  recommendDiaries: (userId, algorithm = 'content') => api.post('/diaries/recommend', { userId, algorithm }),
  
  // 获取用户对日记的评分
  getUserDiaryRating: (diaryId, userId) => api.get(`/diaries/${diaryId}/user-rating/${userId}`),
  
  // 为日记评分
  rateDiary: (diaryId, rating, userId) => api.post(`/diaries/${diaryId}/rate`, { rating, userId }),
};

// 简化的API导出
export const getDiaries = (params) => diaryAPI.getDiaries(params);
export const getDiary = (diaryId) => diaryAPI.getDiary(diaryId);
export const createDiary = (data) => diaryAPI.createDiary(data);
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
  // 获取系统统计信息
  getStatistics: () => api.get('/stats'),
  
  // 获取热门场所统计
  getPopularPlaces: (limit = 10) => api.get('/stats/popular-places', { params: { limit } }),
  
  // 获取压缩统计
  getCompressionStats: () => api.get('/stats/compression'),
};

// 简化的API导出
export const getStatistics = () => statsAPI.getStatistics();



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
  return `${process.env.REACT_APP_API_URL || 'http://localhost:8080/api'}${basePath}`;
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

// 计算两点间距离（简化版，实际应用中建议使用更精确的算法）
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
