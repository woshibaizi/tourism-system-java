export { default, toastEmitter } from './api/client';

export { userAPI, getUsers, getUser, login, register, getCurrentUser } from './api/auth';

export {
  placeAPI,
  getPlaces,
  getPlace,
  searchPlaces,
  getHotPlaces,
  getTopRatedPlaces,
  getRecommendedPlaces,
  sortPlaces,
  getUserRating,
  ratePlace,
  recordVisit,
} from './api/places';

export { buildingAPI, getBuildings, getBuildingsByPlace, searchBuildings } from './api/buildings';

export {
  facilityAPI,
  getFacilities,
  searchFacilities,
  getNearbyFacilities,
  getNearestFacilities,
} from './api/facilities';

export { foodAPI, getFoodsByPlace, getPopularFoods } from './api/foods';

export {
  routeAPI,
  indoorNavigationAPI,
  planSingleRoute,
  planMultiRoute,
  getIndoorBuildingInfo,
  getIndoorRooms,
  navigateIndoor,
} from './api/navigation';

export {
  diaryAPI,
  getDiaries,
  getDiary,
  createDiary,
  updateDiary,
  deleteDiary,
  searchDiaries,
  searchDiariesByTitle,
  searchDiariesByContent,
  searchDiariesByDestination,
  getRecommendedDiaries,
  getUserDiaryRating,
  rateDiary,
} from './api/diaries';

export {
  agentAPI,
  getAgentHealth,
  getAgentSessions,
  getAgentSession,
  deleteAgentSession,
  renameAgentSession,
  chatWithAgent,
  chatWithAgentStream,
  getBuddies,
  createBuddy,
  updateBuddy,
  deleteBuddy,
  useBuddy,
  generateDiary,
  getDiaryTaskStatus,
  planRoute,
} from './api/agent';

export { uploadAPI, uploadImage, uploadVideo } from './api/media-upload';
export { aigcAPI, uploadAigcImage, convertImagesToAnimation } from './api/media';

export { statsAPI, getStatistics, recommendationAPI, searchAPI } from './api/stats';

export { getFileUrl, formatFileSize, formatDistance, formatDuration, calculateDistance } from './api/utils';
