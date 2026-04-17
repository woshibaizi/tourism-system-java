import axios from 'axios';
import { message } from 'antd';

const DEFAULT_LIST_SIZE = 1000;

const normalizeEnvelope = (payload) => {
  if (payload && typeof payload.code === 'number') {
    return {
      ...payload,
      success: payload.code === 200,
      code: payload.code,
      message: payload.message,
      data: payload.data,
    };
  }

  if (payload && typeof payload.success === 'boolean' && Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return {
      ...payload,
      success: payload.success,
      code: payload.code ?? (payload.success ? 200 : 500),
      message: payload.message ?? (payload.success ? 'success' : 'error'),
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

const buildPathFromSegments = (segments = []) => {
  if (!Array.isArray(segments) || segments.length === 0) {
    return [];
  }
  const path = [segments[0].from];
  segments.forEach((segment) => {
    if (segment?.to != null) {
      path.push(segment.to);
    }
  });
  return path;
};

const normalizeRouteResponse = (payload = {}, fallback = {}) => {
  const segments = Array.isArray(payload.segments) ? payload.segments : [];
  const normalizedPath = Array.isArray(payload.path) && payload.path.length > 0
    ? payload.path
    : buildPathFromSegments(segments);

  const totalDistance = toNumber(payload.totalDistance ?? payload.total_distance ?? payload.cost);
  const totalTime = toNumber(
    payload.totalTime
    ?? payload.total_time
    ?? segments.reduce((sum, segment) => sum + toNumber(segment?.time), 0)
  );

  return {
    ...payload,
    path: normalizedPath,
    vehicle: payload.vehicle ?? fallback.vehicle ?? '步行',
    strategy: payload.strategy ?? fallback.strategy ?? 'distance',
    total_distance: totalDistance,
    total_time: totalTime,
    algorithm_name: payload.algorithm ?? payload.algorithm_name ?? fallback.algorithm_name,
    available_vehicles: payload.availableVehicles ?? payload.available_vehicles ?? fallback.available_vehicles ?? [],
    detailed_info: {
      segments,
    },
    nodeCoordinates: payload.nodeCoordinates ?? payload.node_coordinates ?? {},
  };
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseJsonArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (value == null) {
    return [];
  }

  const text = String(value).trim();
  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return text
      .split(/[，,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

const normalizeUser = (user) => {
  if (!user || typeof user !== 'object') {
    return user;
  }
  return {
    ...user,
    interests: parseJsonArray(user.interests),
    favoriteCategories: parseJsonArray(user.favoriteCategories),
  };
};

const normalizePlace = (place) => {
  if (!place || typeof place !== 'object') {
    return place;
  }
  return {
    ...place,
    keywords: parseJsonArray(place.keywords),
    features: parseJsonArray(place.features),
  };
};

const normalizeDiary = (diary) => {
  if (!diary || typeof diary !== 'object') {
    return diary;
  }
  return {
    ...diary,
    images: parseJsonArray(diary.images),
    videos: parseJsonArray(diary.videos),
    tags: parseJsonArray(diary.tags),
  };
};

const normalizeArrayItems = (items, normalizer) =>
  Array.isArray(items) ? items.map(normalizer) : [];

const getApiFileUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('/api/')) return path;
  const basePath = path.startsWith('/') ? path : `/${path}`;
  return `${import.meta.env.VITE_APP_API_URL || '/api'}${basePath}`;
};

const normalizeIndoorBuildingInfo = (payload = {}) => {
  const building = payload.buildingInfo || payload;
  return {
    ...building,
    nodeCount: payload.nodeCount ?? building.nodeCount,
    loaded: payload.loaded ?? building.loaded ?? true,
  };
};

const normalizeIndoorNavigationResult = (payload = {}, options = {}) => {
  const steps = Array.isArray(payload.navigationSteps)
    ? payload.navigationSteps
    : Array.isArray(payload.navigation_steps)
      ? payload.navigation_steps
      : [];

  const normalizedSteps = steps.map((step, index) => ({
    ...step,
    step: step.step ?? index + 1,
    floor_change: step.floor_change ?? step.floorChange ?? false,
    description: step.description ?? step.action ?? '',
    distance: toNumber(step.distance),
  }));

  const destination = payload.destination || {};
  return {
    ...payload,
    destination,
    path: Array.isArray(payload.path) ? payload.path : [],
    navigation_steps: normalizedSteps,
    navigationSteps: normalizedSteps,
    total_distance: toNumber(payload.totalDistance ?? payload.total_distance),
    totalDistance: toNumber(payload.totalDistance ?? payload.total_distance),
    estimated_time: toNumber(payload.estimatedTimeMinutes ?? payload.estimated_time),
    estimatedTimeMinutes: toNumber(payload.estimatedTimeMinutes ?? payload.estimated_time),
    avoid_congestion: options.avoidCongestion ?? payload.avoidCongestion ?? payload.avoid_congestion,
    path_description: normalizedSteps.length > 0
      ? normalizedSteps.map((step) => step.description).filter(Boolean).join('，')
      : '已生成室内导航路径',
    optimizationTarget: payload.optimizationTarget,
    floorAnalysis: payload.floorAnalysis,
  };
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
  getUsers: async () => {
    const response = await api.get('/users');
    return successResult(normalizeArrayItems(response.data, normalizeUser), response.message);
  },

  // 获取特定用户
  getUser: async (userId) => {
    const response = await api.get(`/users/${userId}`);
    return successResult(normalizeUser(response.data), response.message);
  },

  // 更新用户信息
  updateUser: (userId, data) => api.put(`/users/${userId}`, data),

  // 用户登录
  login: (credentials) => api.post('/auth/login', credentials),

  // 用户注册
  register: (payload) => api.post('/auth/register', payload),

  // 获取当前用户
  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return successResult(normalizeUser(response.data), response.message);
  },

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
  getPlaces: async (params = {}) => {
    const response = await fetchPlacesList(params);
    return successResult(normalizeArrayItems(response.data, normalizePlace), response.message);
  },
  
  // 获取场所详情（含建筑物和设施）
  getPlace: async (placeId) => {
    const response = await api.get(`/places/${placeId}`);
    const detail = response.data || {};
    return successResult({
      ...detail,
      place: normalizePlace(detail.place),
    }, response.message);
  },
  
  // 搜索场所
  searchPlaces: async (query, type = 'fuzzy') => {
    const response = await api.get('/places/search', { params: { query, type } });
    return successResult(normalizeArrayItems(response.data, normalizePlace), response.message);
  },

  // 获取热门场所（按浏览量排序）
  getHotPlaces: async (limit = 10) => {
    const response = await api.get('/places/hot', { params: { limit } });
    return successResult(normalizeArrayItems(response.data, normalizePlace), response.message);
  },

  // 获取高评分场所
  getTopRatedPlaces: async (limit = 10) => {
    const response = await api.get('/places/top-rated', { params: { limit } });
    return successResult(normalizeArrayItems(response.data, normalizePlace), response.message);
  },

  // 按类型查询场所
  getPlacesByType: async (type) => {
    const response = await api.get(`/places/type/${type}`);
    return successResult(normalizeArrayItems(response.data, normalizePlace), response.message);
  },

  // 推荐场所（降级为热门场所）
  recommendPlaces: async (userId, algorithm = 'hybrid') => {
    try {
      const response = await api.post('/places/recommend', { userId, algorithm });
      return successResult(normalizeArrayItems(response.data, normalizePlace), response.message);
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
      const response = await api.post('/places/sort', { sortType, topK, placeIds });
      return successResult(normalizeArrayItems(response.data, normalizePlace), response.message);
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
    } catch {
      return successResult({ userRating: null, hasRated: false });
    }
  },
  
  // 为场所评分（通过用户行为接口实现）
  ratePlace: async (placeId, rating, userId) => {
    try {
      return await api.post(`/places/${placeId}/rate`, { rating, userId });
    } catch {
      return failResult('评分失败，请稍后重试');
    }
  },
  
  // 记录访问历史（通过用户行为接口实现）
  recordVisit: async (placeId, userId) => {
    try {
      return await userAPI.recordBehavior(userId, placeId, 'VIEW', null);
    } catch {
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
      const response = await api.get('/foods/cuisines', { params: { placeId } });
      return successResult(Array.isArray(response.data) ? response.data : [], response.message);
    } catch {
      return successResult([]);
    }
  },

  // 搜索美食
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

// ==================== 路径规划相关API ====================

export const routeAPI = {
  // 计算最短路径
  calculateShortestRoute: async (data) => {
    try {
      const shouldUseMixedVehicles = Boolean(data?.useMixedVehicles) && data?.strategy === 'time';
      const response = shouldUseMixedVehicles
        ? await api.post('/navigation/mixed-vehicle-path', {
            start: data?.start,
            end: data?.end,
            placeType: data?.placeType,
          })
        : await api.post('/navigation/shortest-path', {
            start: data?.start,
            end: data?.end,
            vehicle: data?.vehicle,
            strategy: data?.strategy,
            placeType: data?.placeType,
          });

      if (!response.success) {
        return response;
      }

      return successResult(
        normalizeRouteResponse(response.data, {
          vehicle: shouldUseMixedVehicles ? '混合' : data?.vehicle,
          strategy: data?.strategy,
          available_vehicles: data?.placeType === '校园' ? ['步行', '自行车'] : ['步行', '电瓶车'],
          algorithm_name: shouldUseMixedVehicles ? 'mixed_vehicle_dijkstra' : data?.strategy === 'distance' ? 'dijkstra' : 'astar',
        }),
        response.message
      );
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
      const response = await api.post('/navigation/multi-destination', {
        start: data?.start,
        destinations: data?.destinations,
        algorithm: data?.algorithm,
      });

      if (!response.success) {
        return response;
      }

      return successResult(
        normalizeRouteResponse(response.data, {
          vehicle: '步行',
          strategy: 'distance',
          algorithm_name: data?.algorithm,
        }),
        response.message
      );
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

// ==================== 室内导航相关API ====================

export const indoorNavigationAPI = {
  getBuildingInfo: async () => {
    const response = await api.get('/navigation/indoor/building-info');
    return successResult(normalizeIndoorBuildingInfo(response.data), response.message);
  },

  getRooms: async () => {
    const response = await api.get('/navigation/indoor/rooms');
    return successResult(Array.isArray(response.data) ? response.data : [], response.message);
  },

  getFloorRooms: async (floor) => {
    const response = await api.get(`/navigation/indoor/rooms/floor/${floor}`);
    return successResult(Array.isArray(response.data) ? response.data : [], response.message);
  },

  navigate: async ({ roomId, avoidCongestion = true, useTimeWeight = true }) => {
    const response = await api.post('/navigation/indoor', {
      roomId,
      avoidCongestion,
      useTimeWeight,
    });
    if (!response.success) {
      return response;
    }
    return successResult(
      normalizeIndoorNavigationResult(response.data, { avoidCongestion, useTimeWeight }),
      response.message
    );
  },
};

export const getIndoorBuildingInfo = () => indoorNavigationAPI.getBuildingInfo();
export const getIndoorRooms = () => indoorNavigationAPI.getRooms();
export const navigateIndoor = (data) => indoorNavigationAPI.navigate(data);

// ==================== 旅游日记相关API ====================

export const diaryAPI = {
  // 获取日记列表（分页）
  getDiaries: async (params = {}) => {
    const response = await fetchDiariesList(params);
    return successResult(normalizeArrayItems(response.data, normalizeDiary), response.message);
  },
  
  // 获取日记详情
  getDiary: async (diaryId) => {
    const response = await api.get(`/diaries/${diaryId}`);
    return successResult(normalizeDiary(response.data), response.message);
  },

  // 根据作者查询日记
  getDiariesByAuthor: async (authorId) => {
    const response = await api.get(`/diaries/author/${authorId}`);
    return successResult(normalizeArrayItems(response.data, normalizeDiary), response.message);
  },

  // 获取热门日记
  getHotDiaries: async (limit = 10) => {
    const response = await api.get('/diaries/hot', { params: { limit } });
    return successResult(normalizeArrayItems(response.data, normalizeDiary), response.message);
  },
  
  // 创建日记
  createDiary: async (data) => {
    const response = await api.post('/diaries', data);
    return successResult(normalizeDiary(response.data), response.message);
  },
  
  // 更新日记
  updateDiary: async (diaryId, data) => {
    const response = await api.put(`/diaries/${diaryId}`, data);
    return successResult(normalizeDiary(response.data), response.message);
  },
  
  // 删除日记
  deleteDiary: (diaryId) => api.delete(`/diaries/${diaryId}`),
  
  // 搜索日记（前端过滤）
  searchDiaries: async (query, type = 'fulltext') => {
    try {
      const response = await api.get('/diaries/search', { params: { query, type } });
      return successResult(normalizeArrayItems(response.data, normalizeDiary), response.message);
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

      return successResult(normalizeArrayItems(matched, normalizeDiary));
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
      const response = await api.post('/diaries/recommend', { userId, algorithm });
      return successResult(normalizeArrayItems(response.data, normalizeDiary), response.message);
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
        return successResult(normalizeArrayItems(sorted.slice(0, 12), normalizeDiary));
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
    } catch {
      return successResult({ userRating: null, hasRated: false });
    }
  },
  
  // 为日记评分（通过用户行为接口实现）
  rateDiary: async (diaryId, rating, userId) => {
    try {
      return await api.post(`/diaries/${diaryId}/rate`, { rating, userId });
    } catch {
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

// ==================== AIGC相关API ====================

export const aigcAPI = {
  uploadImage: async (file) => {
    const response = await uploadAPI.uploadImage(file);
    if (!response.success) {
      return response;
    }
    return successResult({
      ...response.data,
      url: getApiFileUrl(response.data?.path),
    }, response.message);
  },

  convertToAnimation: async ({
    imagePaths,
    description,
    outputFormat = 'gif',
    fps = 6,
    width = 848,
    height = 480,
  }) => {
    const response = await api.post('/aigc/convert-to-video', {
      imagePaths,
      description,
      outputFormat,
      fps,
      width,
      height,
    });

    if (!response.success) {
      return response;
    }

    const videoPath = response.data?.videoPath || response.data?.path || response.data?.outputPath;
    return successResult({
      ...response.data,
      videoPath,
      videoUrl: getApiFileUrl(videoPath),
      outputFormat,
    }, response.message);
  },
};

export const uploadAigcImage = (file) => aigcAPI.uploadImage(file);
export const convertImagesToAnimation = (payload) => aigcAPI.convertToAnimation(payload);

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
  return getApiFileUrl(path);
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
