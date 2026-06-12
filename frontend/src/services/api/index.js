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


export {
  routeAPI,
  indoorNavigationAPI,
  multiPointAPI,
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
  regenerateDiary,
  polishDiary,
  suggestDiaryTitle,
  extractDiaryTags,
  describeDiaryImages,
  generateDiaryFromChat,
  publishDiary,
  getStylePrefs,
  planRoute,
} from './agent';

export { uploadAPI, uploadImage, uploadVideo } from './media-upload';
export { aigcAPI, uploadAigcImage, convertImagesToAnimation } from './media';

export { statsAPI, getStatistics, recommendationAPI, searchAPI } from './stats';

export { surroundingAPI, getSurroundings, getSurroundingsByPlace, getSurroundingsByPlaceAndType, getSurroundingDetail, searchSurroundings, getNearbySurroundings, getHotSurroundings, getTopRatedSurroundings, getSurroundingCategoryCounts, rateSurrounding } from './surroundings';

export { xhsAPI, bindXhsAccount, unbindXhsAccount, getXhsStatus, publishDiaryToXhs, refreshPlaceXhs } from './xhs';

export { getFileUrl, formatFileSize, formatDistance, formatDuration, calculateDistance } from './utils';
