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


export {
  routeAPI,
  indoorNavigationAPI,
  multiPointAPI,
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
  getRecommendedDiaries,
  getUserDiaryRating,
  rateDiary,
  toggleLikeDiary,
  getLikeStatus,
  getLikedDiaries,
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
  regenerateDiary,
  polishDiary,
  suggestDiaryTitle,
  extractDiaryTags,
  describeDiaryImages,
  generateDiaryFromChat,
  publishDiary,
  getStylePrefs,
  planRoute,
} from './api/agent';

export { uploadAPI, uploadImage, uploadVideo } from './api/media-upload';
export { aigcAPI, uploadAigcImage, convertImagesToAnimation } from './api/media';

export { statsAPI, getStatistics, recommendationAPI, searchAPI } from './api/stats';

export { surroundingAPI, getSurroundings, getSurroundingsByPlace, getSurroundingsByPlaceAndType, getSurroundingDetail, searchSurroundings, getNearbySurroundings, getHotSurroundings, getTopRatedSurroundings, getSurroundingCategoryCounts, getSurroundingCountsByPlace, rateSurrounding } from './api/surroundings';

export { xhsAPI, bindXhsAccount, unbindXhsAccount, getXhsStatus, publishDiaryToXhs, refreshPlaceXhs } from './api/xhs';

export { getFileUrl, formatFileSize, formatDistance, formatDuration, calculateDistance } from './api/utils';
