import api from './client';
import { successResult, normalizeRouteResponse, normalizeIndoorBuildingInfo, normalizeIndoorNavigationResult } from './normalize';

export const routeAPI = {
  calculateShortestRoute: async (data) => {
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
          startLat: data?.startLat,
          startLng: data?.startLng,
          startName: data?.startName,
          endLat: data?.endLat,
          endLng: data?.endLng,
          endName: data?.endName,
          placeId: data?.placeId,
          vehicle: data?.vehicle,
          strategy: data?.strategy,
          placeType: data?.placeType,
          provider: data?.provider ?? 'local',
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
  },

  calculateMultiDestinationRoute: async (data) => {
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
  },

  planSingleRoute: async (data) => routeAPI.calculateShortestRoute(data),
};

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

// ==================== 多点导航 API ====================

export const multiPointAPI = {
  planMultiPointRoute: async (data) => {
    const response = await api.post('/navigation/multi-point', {
      start: data?.start,
      startLat: data?.startLat,
      startLng: data?.startLng,
      waypoints: data?.waypoints,
      end: data?.end,
      endLat: data?.endLat,
      endLng: data?.endLng,
      mode: data?.mode ?? 'ordered',
      algorithm: data?.algorithm ?? 'nearest_neighbor',
      vehicle: data?.vehicle ?? '步行',
      strategy: data?.strategy ?? 'time',
      placeType: data?.placeType ?? '景区',
      provider: data?.provider ?? 'auto',
    });
    if (!response.success) return response;
    return successResult(normalizeRouteResponse(response.data, {
      vehicle: data?.vehicle,
      strategy: data?.strategy,
      algorithm_name: data?.mode === 'optimized' ? data?.algorithm : 'sequential',
      available_vehicles: data?.placeType === '校园' ? ['步行', '自行车'] : ['步行', '电瓶车'],
    }), response.message);
  },

  planWaypoints: async (data) => {
    const response = await api.post('/navigation/waypoints', {
      start: data?.start,
      startLat: data?.startLat,
      startLng: data?.startLng,
      waypoints: data?.waypoints,
      end: data?.end,
      endLat: data?.endLat,
      endLng: data?.endLng,
      vehicle: data?.vehicle ?? '步行',
      strategy: data?.strategy ?? 'time',
      placeType: data?.placeType ?? '景区',
      provider: data?.provider ?? 'auto',
    });
    if (!response.success) return response;
    return successResult(normalizeRouteResponse(response.data, {
      vehicle: data?.vehicle,
      strategy: data?.strategy,
      algorithm_name: 'waypoints_sequential',
    }), response.message);
  },

  planIndoorMultiRoom: async (data) => {
    const response = await api.post('/navigation/indoor/multi-room', {
      roomIds: data?.roomIds,
      avoidCongestion: data?.avoidCongestion ?? true,
      useTimeWeight: data?.useTimeWeight ?? true,
    });
    if (!response.success) return response;
    return successResult(response.data, response.message);
  },

  planIndoorRoomToRoom: async (data) => {
    const response = await api.post('/navigation/indoor/room-to-room', {
      from: data?.from,
      to: data?.to,
      avoidCongestion: data?.avoidCongestion ?? true,
      useTimeWeight: data?.useTimeWeight ?? true,
    });
    if (!response.success) return response;
    return successResult(normalizeIndoorNavigationResult(response.data, {
      avoidCongestion: data?.avoidCongestion,
      useTimeWeight: data?.useTimeWeight,
    }), response.message);
  },

  planIndoorOutdoor: async (data) => {
    const response = await api.post('/navigation/indoor-outdoor', {
      roomId: data?.roomId,
      outdoorDest: data?.outdoorDest,
      destLat: data?.destLat,
      destLng: data?.destLng,
      vehicle: data?.vehicle ?? '步行',
      strategy: data?.strategy ?? 'time',
      placeType: data?.placeType ?? '景区',
    });
    if (!response.success) return response;
    return successResult(response.data, response.message);
  },
};

export const planSingleRoute = (data) => routeAPI.calculateShortestRoute(data);
export const planMultiRoute = (data) => routeAPI.calculateMultiDestinationRoute(data);
export const getIndoorBuildingInfo = () => indoorNavigationAPI.getBuildingInfo();
export const getIndoorRooms = () => indoorNavigationAPI.getRooms();
export const navigateIndoor = (data) => indoorNavigationAPI.navigate(data);
