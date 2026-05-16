const DEFAULT_LIST_SIZE = 1000;
export const MEDIA_CACHE_VERSION = '20260509';

export const normalizeEnvelope = (payload) => {
  if (payload && typeof payload.code === 'number') {
    return {
      ...payload,
      success: payload.code === 200,
      code: payload.code,
      message: payload.message,
      data: payload.data,
    };
  }

  if (payload && typeof payload.success === 'boolean' && Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return {
      ...payload,
      success: payload.success,
      code: payload.code ?? (payload.success ? 200 : 500),
      message: payload.message ?? (payload.success ? 'success' : 'error'),
      data: payload.data,
    };
  }

  return {
    success: true,
    code: 200,
    message: 'success',
    data: payload,
  };
};

export const unwrapPageRecords = (response) => {
  const data = response?.data;
  if (Array.isArray(data)) {
    return response;
  }
  if (data && Array.isArray(data.records)) {
    return {
      ...response,
      data: data.records,
      page: {
        current: data.current,
        size: data.size,
        total: data.total,
        pages: data.pages,
      },
    };
  }
  return response;
};

export const successResult = (data = null, messageText = 'success') => ({
  success: true,
  code: 200,
  message: messageText,
  data,
});

export const failResult = (messageText, code = 500, data = null) => ({
  success: false,
  code,
  message: messageText,
  data,
});

export const buildListParams = (params = {}) => {
  const normalized = { ...params };
  if (normalized.pageSize != null && normalized.size == null) {
    normalized.size = normalized.pageSize;
  }
  delete normalized.pageSize;

  if (normalized.page == null) {
    normalized.page = 1;
  }
  if (normalized.size == null) {
    normalized.size = DEFAULT_LIST_SIZE;
  }

  return normalized;
};

export const buildPathFromSegments = (segments = []) => {
  if (!Array.isArray(segments) || segments.length === 0) {
    return [];
  }
  const path = [segments[0].from];
  segments.forEach((segment) => {
    if (segment?.to != null) {
      path.push(segment.to);
    }
  });
  return path;
};

export const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toCoordinateNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeLngLatPair = (value) => {
  if (Array.isArray(value) && value.length >= 2) {
    const lng = toCoordinateNumber(value[0]);
    const lat = toCoordinateNumber(value[1]);
    return lng != null && lat != null ? [lng, lat] : null;
  }

  if (typeof value === 'string') {
    const parts = value.split(',').map((item) => item.trim());
    if (parts.length >= 2) {
      const lng = toCoordinateNumber(parts[0]);
      const lat = toCoordinateNumber(parts[1]);
      return lng != null && lat != null ? [lng, lat] : null;
    }
    return null;
  }

  if (value && typeof value === 'object') {
    const lng = toCoordinateNumber(
      typeof value.getLng === 'function' ? value.getLng() : value.lng ?? value.longitude ?? value.lon ?? value.x
    );
    const lat = toCoordinateNumber(
      typeof value.getLat === 'function' ? value.getLat() : value.lat ?? value.latitude ?? value.y
    );
    return lng != null && lat != null ? [lng, lat] : null;
  }

  return null;
};

const parseLngLatCollection = (value) => {
  if (!value) {
    return [];
  }

  if (typeof value === 'string') {
    return value
      .split(';')
      .map((item) => normalizeLngLatPair(item))
      .filter(Boolean);
  }

  if (Array.isArray(value)) {
    if (value.length > 0 && !Array.isArray(value[0]) && typeof value[0] !== 'object') {
      const single = normalizeLngLatPair(value);
      return single ? [single] : [];
    }

    return value
      .map((item) => normalizeLngLatPair(item))
      .filter(Boolean);
  }

  const single = normalizeLngLatPair(value);
  return single ? [single] : [];
};

const flattenPolylineSegments = (segments = []) => {
  const merged = [];

  segments.forEach((segment) => {
    const points = Array.isArray(segment?.coordinates) ? segment.coordinates : [];
    points.forEach((point, index) => {
      const lastPoint = merged[merged.length - 1];
      if (
        index > 0 &&
        lastPoint &&
        lastPoint[0] === point[0] &&
        lastPoint[1] === point[1]
      ) {
        return;
      }
      merged.push(point);
    });
  });

  return merged;
};

const normalizeRouteSegment = (segment = {}, index = 0) => {
  const coordinates = parseLngLatCollection(
    segment.coordinates
    ?? segment.polyline
    ?? segment.path
    ?? segment.routePath
  );

  return {
    ...segment,
    key: segment.key ?? `segment-${index}`,
    from: segment.from ?? segment.startName ?? segment.start ?? segment.action ?? `第 ${index + 1} 段`,
    to: segment.to ?? segment.endName ?? segment.end ?? segment.assistant_action ?? segment.road ?? '继续前进',
    fromId: segment.fromId ?? segment.from_id ?? segment.from,
    toId: segment.toId ?? segment.to_id ?? segment.to,
    vehicle: segment.vehicle ?? segment.mode ?? segment.transportMode,
    distance: toNumber(segment.distance),
    time: segment.time != null ? toNumber(segment.time) : toNumber(segment.duration) / 60,
    instruction: segment.instruction ?? segment.description ?? '',
    coordinates,
  };
};

export const extractRoutePathsPayload = (payload = {}) => {
  if (Array.isArray(payload.paths) && payload.paths.length > 0) {
    return payload.paths[0];
  }
  if (payload.route && Array.isArray(payload.route.paths) && payload.route.paths.length > 0) {
    return payload.route.paths[0];
  }
  if (payload.data && Array.isArray(payload.data.paths) && payload.data.paths.length > 0) {
    return payload.data.paths[0];
  }
  return null;
};

const extractMapSegments = (payload = {}) => {
  const directSegments = Array.isArray(payload.segments)
    ? payload.segments.map((segment, index) => normalizeRouteSegment(segment, index))
    : [];

  if (directSegments.length > 0) {
    return directSegments;
  }

  const routePath = extractRoutePathsPayload(payload);
  const steps = Array.isArray(payload.steps)
    ? payload.steps
    : Array.isArray(routePath?.steps)
      ? routePath.steps
      : [];

  return steps.map((step, index) =>
    normalizeRouteSegment(
      {
        ...step,
        coordinates: step.polyline ?? step.path ?? step.coordinates,
        vehicle: step.vehicle ?? step.mode ?? payload.vehicle ?? routePath?.strategy,
        distance: step.distance,
        duration: step.duration,
      },
      index
    )
  );
};

export const extractMapPath = (payload = {}, segments = []) => {
  const directPath = parseLngLatCollection(
    payload.mapPath
    ?? payload.map_path
    ?? payload.polylineCoordinates
    ?? payload.polyline_coordinates
    ?? payload.routePolyline
    ?? payload.route_polyline
    ?? payload.polyline
    ?? payload.pathCoordinates
    ?? payload.path_coordinates
    ?? payload.amapPolyline
    ?? payload.amap_polyline
  );

  if (directPath.length > 0) {
    return directPath;
  }

  const routePath = extractRoutePathsPayload(payload);
  const routePolyline = parseLngLatCollection(
    routePath?.polyline
    ?? routePath?.path
    ?? routePath?.coordinates
  );

  if (routePolyline.length > 0) {
    return routePolyline;
  }

  const segmentPath = flattenPolylineSegments(segments);
  if (segmentPath.length > 0) {
    return segmentPath;
  }

  const nodeCoordinates = payload.nodeCoordinates ?? payload.node_coordinates ?? {};
  if (Array.isArray(payload.path) && nodeCoordinates && typeof nodeCoordinates === 'object') {
    return payload.path
      .map((nodeId) => {
        const coordinate = nodeCoordinates[nodeId];
        if (!Array.isArray(coordinate) || coordinate.length < 2) {
          return null;
        }
        const lat = toCoordinateNumber(coordinate[0]);
        const lng = toCoordinateNumber(coordinate[1]);
        return lat != null && lng != null ? [lng, lat] : null;
      })
      .filter(Boolean);
  }

  return [];
};

const extractRouteInstructions = (payload = {}, segments = []) => {
  if (Array.isArray(payload.detailed_path) && payload.detailed_path.length > 0) {
    return payload.detailed_path;
  }

  const instructions = segments
    .map((segment) => segment.instruction || `${segment.from} -> ${segment.to}`)
    .filter(Boolean);

  return instructions;
};

export const normalizeRouteResponse = (payload = {}, fallback = {}) => {
  const segments = extractMapSegments(payload);
  const normalizedPath = Array.isArray(payload.path) && payload.path.length > 0
    ? payload.path
    : buildPathFromSegments(segments);
  const mapPath = extractMapPath(payload, segments);
  const routePathPayload = extractRoutePathsPayload(payload);

  const totalDistance = toNumber(payload.totalDistance ?? payload.total_distance ?? payload.cost);
  const totalTime = toNumber(
    payload.totalTime
    ?? payload.total_time
    ?? (routePathPayload?.duration != null ? Number(routePathPayload.duration) / 60 : null)
    ?? (payload.duration != null ? Number(payload.duration) / 60 : null)
    ?? segments.reduce((sum, segment) => sum + toNumber(segment?.time), 0)
  );

  return {
    ...payload,
    path: normalizedPath,
    coordinates: mapPath,
    steps: segments,
    distance: totalDistance,
    duration: totalTime,
    vehicle: payload.vehicle ?? fallback.vehicle ?? '步行',
    strategy: payload.strategy ?? fallback.strategy ?? 'distance',
    total_distance: totalDistance,
    total_time: totalTime,
    algorithm_name: payload.algorithm ?? payload.algorithm_name ?? fallback.algorithm_name,
    available_vehicles: payload.availableVehicles ?? payload.available_vehicles ?? fallback.available_vehicles ?? [],
    detailed_info: {
      ...(payload.detailed_info && typeof payload.detailed_info === 'object' ? payload.detailed_info : {}),
      segments,
    },
    detailed_path: extractRouteInstructions(payload, segments),
    nodeCoordinates: payload.nodeCoordinates ?? payload.node_coordinates ?? {},
    mapProvider: payload.mapProvider ?? payload.map_provider ?? payload.provider ?? (mapPath.length > 0 ? 'amap' : 'legacy'),
    mapPath,
    mapSegments: segments,
    fallback: Boolean(payload.fallback),
    fallbackReason: payload.fallbackReason ?? payload.fallback_reason ?? payload.message,
    source: payload.source,
    amapMode: payload.amapMode ?? payload.amap_mode,
  };
};

export const parseJsonArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (value == null) {
    return [];
  }

  const text = String(value).trim();
  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return text
      .split(/[，,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

export const normalizeMediaPath = (value) => {
  if (!value) {
    return '';
  }
  if (typeof value === 'object') {
    return value.url ?? value.path ?? value.videoPath ?? value.imagePath ?? '';
  }

  const text = String(value).trim();
  if (!text) {
    return '';
  }

  const pathMatch = text.match(/(?:^|[,{\s])path=([^,}\s]+)/);
  if (pathMatch?.[1]) {
    return pathMatch[1];
  }
  const urlMatch = text.match(/(?:^|[,{\s])url=([^,}\s]+)/);
  if (urlMatch?.[1]) {
    return urlMatch[1];
  }
  return text;
};

export const normalizeMediaList = (value) => {
  if (Array.isArray(value)) {
    return value.map(normalizeMediaPath).filter(Boolean);
  }
  if (value == null) {
    return [];
  }

  const text = String(value).trim();
  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.map(normalizeMediaPath).filter(Boolean) : [];
  } catch {
    const extracted = Array.from(text.matchAll(/(?:path|url|videoPath|imagePath)=([^,}\]\s]+)/g))
      .map((match) => match[1])
      .filter(Boolean);
    if (extracted.length > 0) {
      return extracted;
    }
    return text
      .split(/[，,]/)
      .map(normalizeMediaPath)
      .filter(Boolean);
  }
};

export const normalizeUser = (user) => {
  if (!user || typeof user !== 'object') {
    return user;
  }
  return {
    ...user,
    interests: parseJsonArray(user.interests),
    favoriteCategories: parseJsonArray(user.favoriteCategories),
  };
};

export const normalizePlace = (place) => {
  if (!place || typeof place !== 'object') {
    return place;
  }
  return {
    ...place,
    keywords: parseJsonArray(place.keywords),
    features: parseJsonArray(place.features),
  };
};

export const normalizeDiary = (diary) => {
  if (!diary || typeof diary !== 'object') {
    return diary;
  }
  return {
    ...diary,
    images: normalizeMediaList(diary.images),
    videos: normalizeMediaList(diary.videos),
    tags: parseJsonArray(diary.tags),
  };
};

export const normalizeArrayItems = (items, normalizer) =>
  Array.isArray(items) ? items.map(normalizer) : [];

export const getApiFileUrl = (path) => {
  if (!path) return null;
  const normalizedPath = normalizeMediaPath(path);
  if (!normalizedPath) return null;
  const appendMediaVersion = (url) => {
    if (!url.includes('/uploads/')) {
      return url;
    }
    return `${url}${url.includes('?') ? '&' : '?'}v=${MEDIA_CACHE_VERSION}`;
  };
  if (
    normalizedPath.startsWith('http') ||
    normalizedPath.startsWith('blob:') ||
    normalizedPath.startsWith('data:')
  ) {
    return normalizedPath;
  }
  if (normalizedPath.startsWith('/api/')) {
    return appendMediaVersion(encodeURI(normalizedPath));
  }
  const basePath = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
  return appendMediaVersion(`${import.meta.env.VITE_APP_API_URL || '/api'}${encodeURI(basePath)}`);
};

export const normalizeAgentMessage = (messageItem) => {
  if (!messageItem || typeof messageItem !== 'object') {
    return messageItem;
  }

  return {
    ...messageItem,
    role: messageItem.role || 'assistant',
    content: messageItem.content || '',
    createdAt: messageItem.createdAt ?? messageItem.created_at ?? new Date().toISOString(),
  };
};

export const normalizeAgentSessionSummary = (session) => {
  if (!session || typeof session !== 'object') {
    return session;
  }

  return {
    ...session,
    sessionId: session.sessionId ?? session.session_id,
    userId: session.userId ?? session.user_id,
    title: session.title || '新对话',
    preview: session.preview || '',
    mode: session.mode || 'travel_assistant',
    createdAt: session.createdAt ?? session.created_at,
    updatedAt: session.updatedAt ?? session.updated_at,
    messageCount: Number(session.messageCount ?? session.message_count ?? 0),
  };
};

export const normalizeAgentSessionDetail = (session) => {
  const normalized = normalizeAgentSessionSummary(session);
  if (!normalized || typeof normalized !== 'object') {
    return normalized;
  }

  return {
    ...normalized,
    messages: normalizeArrayItems(session?.messages, normalizeAgentMessage),
  };
};

export const normalizeBuddy = (buddy) => {
  if (!buddy || typeof buddy !== 'object') {
    return buddy;
  }

  return {
    ...buddy,
    id: buddy.id || '',
    name: buddy.name || '',
    personality: buddy.personality || '',
    speakingStyle: buddy.speakingStyle ?? buddy.speaking_style ?? '',
    isPreset: buddy.isPreset ?? buddy.is_preset ?? false,
    preferenceScore: buddy.preferenceScore ?? buddy.preference_score ?? 0,
  };
};

export const normalizeAgentReply = (reply) => {
  if (!reply || typeof reply !== 'object') {
    return reply;
  }

  return {
    ...reply,
    content: reply.content || '',
    intent: reply.intent || 'general_travel_chat',
    traceId: reply.traceId ?? reply.trace_id,
    suggestions: Array.isArray(reply.suggestions) ? reply.suggestions : [],
    toolsUsed: Array.isArray(reply.toolsUsed ?? reply.tools_used)
      ? (reply.toolsUsed ?? reply.tools_used)
      : [],
  };
};

export const normalizeIndoorBuildingInfo = (payload = {}) => {
  const building = payload.buildingInfo || payload;
  return {
    ...building,
    nodeCount: payload.nodeCount ?? building.nodeCount,
    loaded: payload.loaded ?? building.loaded ?? true,
  };
};

export const normalizeIndoorNavigationResult = (payload = {}, options = {}) => {
  const steps = Array.isArray(payload.navigationSteps)
    ? payload.navigationSteps
    : Array.isArray(payload.navigation_steps)
      ? payload.navigation_steps
      : [];

  const normalizedSteps = steps.map((step, index) => ({
    ...step,
    step: step.step ?? index + 1,
    floor_change: step.floor_change ?? step.floorChange ?? false,
    description: step.description ?? step.action ?? '',
    distance: toNumber(step.distance),
  }));

  const destination = payload.destination || {};
  const destinationName = typeof destination === 'string'
    ? destination
    : destination.name ?? destination.roomName ?? destination.id ?? '';
  const totalDistance = toNumber(payload.totalDistance ?? payload.total_distance);
  const estimatedTime = toNumber(payload.estimatedTimeMinutes ?? payload.estimated_time);
  return {
    ...payload,
    destination,
    destinationName,
    path: Array.isArray(payload.path) ? payload.path : [],
    navigation_steps: normalizedSteps,
    navigationSteps: normalizedSteps,
    steps: normalizedSteps,
    total_distance: totalDistance,
    totalDistance,
    distance: totalDistance,
    estimated_time: estimatedTime,
    estimatedTimeMinutes: estimatedTime,
    duration: estimatedTime,
    avoid_congestion: options.avoidCongestion ?? payload.avoidCongestion ?? payload.avoid_congestion,
    path_description: normalizedSteps.length > 0
      ? normalizedSteps.map((step) => step.description).filter(Boolean).join('，')
      : '已生成室内导航路径',
    optimizationTarget: payload.optimizationTarget,
    floorAnalysis: payload.floorAnalysis,
  };
};
