import api from './client';
import { successResult, normalizeUser, normalizeArrayItems } from './normalize';

export const userAPI = {
  getUsers: async () => {
    const response = await api.get('/users');
    return successResult(normalizeArrayItems(response.data, normalizeUser), response.message);
  },

  getUser: async (userId) => {
    const response = await api.get(`/users/${userId}`);
    return successResult(normalizeUser(response.data), response.message);
  },

  updateUser: (userId, data) => api.put(`/users/${userId}`, data),

  login: (credentials) => api.post('/auth/login', credentials),

  register: (payload) => api.post('/auth/register', payload),

  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return successResult(normalizeUser(response.data), response.message);
  },

  recordBehavior: (userId, targetId, behaviorType, score) =>
    api.post(`/users/${userId}/behavior`, null, {
      params: { targetId, behaviorType, ...(score != null ? { score } : {}) },
    }),

  getViewHistory: (userId) => api.get(`/users/${userId}/views`),

  getRatingHistory: (userId) => api.get(`/users/${userId}/ratings`),
};

export const getUsers = () => userAPI.getUsers();
export const getUser = (userId) => userAPI.getUser(userId);
export const login = (credentials) => userAPI.login(credentials);
export const register = (payload) => userAPI.register(payload);
export const getCurrentUser = () => userAPI.getCurrentUser();
