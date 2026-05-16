import api from './client';
import { fetchFacilitiesList } from './client';

export const facilityAPI = {
  getFacilities: async (params = {}) => fetchFacilitiesList(params),

  getFacility: (facilityId) => api.get(`/facilities/${facilityId}`),

  getFacilitiesByPlace: (placeId) => api.get(`/facilities/place/${placeId}`),

  getFacilitiesByPlaceAndType: (placeId, type) => api.get(`/facilities/place/${placeId}/type/${type}`),

  searchFacilities: (query, placeId, type) => api.get('/facilities/search', { params: { query, placeId, type } }),

  getNearbyFacilities: (location, type, maxDistance = 1000) =>
    api.get('/facilities/nearby', {
      params: {
        lat: location?.lat,
        lng: location?.lng,
        type,
        radius: maxDistance,
      },
    }),

  getNearestFacilities: (buildingId, placeId, facilityType = 'all') =>
    api.post('/facilities/nearest', { buildingId, placeId, facilityType }),
};

export const getFacilities = (placeId, type) => {
  const params = {};
  if (placeId) params.placeId = placeId;
  if (type) params.type = type;
  return facilityAPI.getFacilities(params);
};
export const searchFacilities = (query, placeId, type) => facilityAPI.searchFacilities(query, placeId, type);
export const getNearbyFacilities = (location, type, maxDistance) => facilityAPI.getNearbyFacilities(location, type, maxDistance);
export const getNearestFacilities = (buildingId, placeId, facilityType) => facilityAPI.getNearestFacilities(buildingId, placeId, facilityType);
