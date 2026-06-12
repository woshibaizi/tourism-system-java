import axios from 'axios';
import { normalizeEnvelope, unwrapPageRecords, buildListParams } from './normalize';

const toastEmitter = new EventTarget();
export { toastEmitter };

const api = axios.create({
  baseURL: import.meta.env.VITE_APP_API_URL || '/api',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

api.interceptors.response.use(
  (response) => {
    return normalizeEnvelope(response.data);
  },
  (error) => {
    const errorMessage = error.response?.data?.message || '网络错误，请稍后重试';
    if (!error.config?.skipErrorMessage) {
      toastEmitter.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: errorMessage } }));
    }
    return Promise.reject(error);
  }
);

export const fetchPlacesList = async (params = {}) =>
  unwrapPageRecords(await api.get('/places', { params: buildListParams(params) }));

export const fetchBuildingsList = async (params = {}) =>
  unwrapPageRecords(await api.get('/buildings', { params: buildListParams(params) }));

export const fetchFacilitiesList = async (params = {}) =>
  unwrapPageRecords(await api.get('/facilities', { params: buildListParams(params) }));

export const fetchDiariesList = async (params = {}) =>
  unwrapPageRecords(await api.get('/diaries', { params: buildListParams(params) }));

export default api;
