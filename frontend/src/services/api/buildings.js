import api from './client';
import { fetchBuildingsList } from './client';

export const buildingAPI = {
  getBuildings: async (params = {}) => fetchBuildingsList(params),

  getBuilding: (buildingId) => api.get(`/buildings/${buildingId}`),

  getBuildingsByPlace: (placeId) => api.get(`/buildings/place/${placeId}`),

  searchBuildings: (query, placeId) => api.get('/buildings/search', { params: { query, placeId } }),
};

export const getBuildings = (placeId) => buildingAPI.getBuildings(placeId ? { placeId } : {});
export const getBuildingsByPlace = (placeId) => buildingAPI.getBuildingsByPlace(placeId);
export const searchBuildings = (query, placeId) => buildingAPI.searchBuildings(query, placeId);
