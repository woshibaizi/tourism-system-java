import api from './client';
import { successResult, unwrapPageRecords } from './normalize';

const SURROUNDING_TYPE_LABELS = {
  restaurant: '美食餐饮',
  shopping: '购物消费',
  entertainment: '休闲娱乐',
  hotel: '住宿酒店',
  transport: '交通出行',
  service: '生活服务',
};

const SURROUNDING_TYPE_ICONS = {
  restaurant: '🍜',
  shopping: '🛍️',
  entertainment: '🎮',
  hotel: '🏨',
  transport: '🚇',
  service: '🏦',
};

export const surroundingAPI = {
  getTypeLabel: (type) => SURROUNDING_TYPE_LABELS[type] || type,
  getTypeIcon: (type) => SURROUNDING_TYPE_ICONS[type] || '📍',
  TYPES: SURROUNDING_TYPE_LABELS,

  /** 分页查询 */
  list: async (params = {}) => {
    try {
      const response = await api.get('/surroundings', { params });
      const data = response.data || {};
      return {
        success: true,
        data: unwrapPageRecords(data),
        total: data.total ?? 0,
        page: data.current ?? 1,
        size: data.size ?? 10,
      };
    } catch {
      return { success: false, data: [], total: 0 };
    }
  },

  /** 按校园查询 */
  listByPlace: async (placeId) => {
    try {
      const response = await api.get(`/surroundings/place/${placeId}`);
      return successResult(response.data || []);
    } catch {
      return successResult([]);
    }
  },

  /** 按校园+类型查询 */
  listByPlaceAndType: async (placeId, type) => {
    try {
      const response = await api.get(`/surroundings/place/${placeId}/type/${type}`);
      return successResult(response.data || []);
    } catch {
      return successResult([]);
    }
  },

  /** 商户详情 */
  getDetail: async (id) => {
    try {
      const response = await api.get(`/surroundings/${id}`);
      return successResult(response.data);
    } catch {
      return { success: false, data: null };
    }
  },

  /** 搜索 */
  search: async (query, placeId, type) => {
    try {
      const params = { query };
      if (placeId) params.placeId = placeId;
      if (type) params.type = type;
      const response = await api.get('/surroundings/search', { params });
      return successResult(response.data || []);
    } catch {
      return successResult([]);
    }
  },

  /** LBS 附近搜索 */
  nearby: async (lat, lng, radius = 3000, type) => {
    try {
      const params = { lat, lng, radius };
      if (type) params.type = type;
      const response = await api.get('/surroundings/nearby', { params });
      return successResult(response.data || []);
    } catch {
      return successResult([]);
    }
  },

  /** 热门推荐 */
  hot: async (limit = 20) => {
    try {
      const response = await api.get('/surroundings/hot', { params: { limit } });
      return successResult(response.data || []);
    } catch {
      return successResult([]);
    }
  },

  /** 高分排行 */
  topRated: async (limit = 20) => {
    try {
      const response = await api.get('/surroundings/top-rated', { params: { limit } });
      return successResult(response.data || []);
    } catch {
      return successResult([]);
    }
  },

  /** 分类统计 */
  getCategoryCounts: async (placeId) => {
    try {
      const response = await api.get(`/surroundings/categories/${placeId}`);
      return successResult(response.data || {});
    } catch {
      return successResult({});
    }
  },

  /** 获取所有地点的周边商户总数 Map<placeId, count> */
  getCountsByPlace: async () => {
    try {
      const response = await api.get('/surroundings/counts-by-place');
      return successResult(response.data || {});
    } catch {
      return successResult({});
    }
  },

  /** 评分 */
  rate: async (id, score) => {
    try {
      const response = await api.post(`/surroundings/${id}/rate`, null, { params: { score } });
      return { success: true, data: response.data };
    } catch {
      return { success: false };
    }
  },
};

export const getSurroundings = (params) => surroundingAPI.list(params);
export const getSurroundingsByPlace = (placeId) => surroundingAPI.listByPlace(placeId);
export const getSurroundingsByPlaceAndType = (placeId, type) => surroundingAPI.listByPlaceAndType(placeId, type);
export const getSurroundingDetail = (id) => surroundingAPI.getDetail(id);
export const searchSurroundings = (query, placeId, type) => surroundingAPI.search(query, placeId, type);
export const getNearbySurroundings = (lat, lng, radius, type) => surroundingAPI.nearby(lat, lng, radius, type);
export const getHotSurroundings = (limit) => surroundingAPI.hot(limit);
export const getTopRatedSurroundings = (limit) => surroundingAPI.topRated(limit);
export const getSurroundingCategoryCounts = (placeId) => surroundingAPI.getCategoryCounts(placeId);
export const getSurroundingCountsByPlace = () => surroundingAPI.getCountsByPlace();
export const rateSurrounding = (id, score) => surroundingAPI.rate(id, score);
