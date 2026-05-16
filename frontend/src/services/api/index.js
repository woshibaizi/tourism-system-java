export { default, toastEmitter } from './client';

export { userAPI, getUsers, getUser, login, register, getCurrentUser } from './auth';

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
} from './places';

export { buildingAPI, getBuildings, getBuildingsByPlace, searchBuildings } from './buildings';

export {
  facilityAPI,
  getFacilities,
  searchFacilities,
  getNearbyFacilities,
  getNearestFacilities,
} from './facilities';

export { foodAPI, getFoodsByPlace, getPopularFoods } from './foods';

export {
  routeAPI,
  indoorNavigationAPI,
  planSingleRoute,
  planMultiRoute,
  getIndoorBuildingInfo,
  getIndoorRooms,
  navigateIndoor,
} from './navigation';

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
} from './diaries';

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
} from './agent';

export { uploadAPI, uploadImage, uploadVideo } from './media-upload';
export { aigcAPI, uploadAigcImage, convertImagesToAnimation } from './media';

export { statsAPI, getStatistics, recommendationAPI, searchAPI } from './stats';

export { getFileUrl, formatFileSize, formatDistance, formatDuration, calculateDistance } from './utils';
