package com.tourism.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tourism.algorithm.ShortestPathAlgorithm;
import com.tourism.utils.CoordinateTransformUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Service
public class OutdoorRouteService {

    private static final String PROVIDER_AUTO = "auto";
    private static final String PROVIDER_AMAP = "amap";
    private static final String PROVIDER_LOCAL = "local";

    private final ShortestPathAlgorithm shortestPathAlgorithm;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Value("${app.navigation.default-provider:auto}")
    private String defaultProvider;

    @Value("${app.navigation.amap.enabled:true}")
    private boolean amapEnabled;

    @Value("${app.navigation.amap.key:}")
    private String amapKey;

    @Value("${app.navigation.amap.base-url:https://restapi.amap.com}")
    private String amapBaseUrl;

    @Value("${app.navigation.amap.timeout-ms:5000}")
    private long amapTimeoutMs;

    public OutdoorRouteService(ShortestPathAlgorithm shortestPathAlgorithm, ObjectMapper objectMapper) {
        this.shortestPathAlgorithm = shortestPathAlgorithm;
        this.objectMapper = objectMapper;
    }

    public PlannedRoute planSingleRoute(String start,
                                        String end,
                                        Double startLat,
                                        Double startLng,
                                        Double endLat,
                                        Double endLng,
                                        String vehicle,
                                        String strategy,
                                        String placeType,
                                        String providerPreference) {
        String normalizedStrategy = "distance".equalsIgnoreCase(strategy) ? "distance" : "time";
        String normalizedVehicle = normalizeVehicle(vehicle);
        String normalizedPlaceType = normalizePlaceType(placeType);
        String provider = normalizeProvider(providerPreference);
        ResolvedPoint origin = resolvePoint("起点", start, startLat, startLng, "current_location");
        if (!origin.success()) {
            return PlannedRoute.failed(origin.errorMessage());
        }
        ResolvedPoint destination = resolvePoint("终点", end, endLat, endLng, "destination_location");
        if (!destination.success()) {
            return PlannedRoute.failed(destination.errorMessage());
        }

        if (PROVIDER_LOCAL.equals(provider)) {
            return PlannedRoute.success(buildLocalRoute(
                    origin,
                    destination,
                    normalizedVehicle,
                    normalizedStrategy,
                    normalizedPlaceType,
                    false,
                    null,
                    "shortest_path_algorithm"
            ));
        }

        AmapAttempt amapAttempt = tryAmapRoute(origin, destination, normalizedVehicle, normalizedStrategy, normalizedPlaceType);
        if (amapAttempt.success()) {
            return PlannedRoute.success(amapAttempt.payload());
        }

        Map<String, Object> fallbackPayload = buildLocalRoute(
                origin,
                destination,
                normalizedVehicle,
                normalizedStrategy,
                normalizedPlaceType,
                true,
                amapAttempt.reason(),
                "shortest_path_algorithm_fallback"
        );
        return PlannedRoute.success(fallbackPayload);
    }

    public Map<String, Object> buildMixedVehicleRoute(String start, String end, String placeType) {
        String normalizedPlaceType = normalizePlaceType(placeType);
        List<ShortestPathAlgorithm.RouteSegment> segments =
                shortestPathAlgorithm.dijkstraWithMixedVehicles(start, end, normalizedPlaceType);

        if (segments.isEmpty()) {
            return Collections.emptyMap();
        }

        double totalTimeSeconds = segments.stream().mapToDouble(ShortestPathAlgorithm.RouteSegment::getTime).sum();
        double totalTimeMinutes = totalTimeSeconds / 60.0;
        double totalDistance = segments.stream().mapToDouble(ShortestPathAlgorithm.RouteSegment::getDistance).sum();
        List<String> path = buildPathFromSegments(segments);

        Map<String, Object> payload = buildBasePayload(
                path,
                "混合",
                "time",
                normalizedPlaceType,
                totalDistance,
                totalTimeMinutes,
                buildSegments(segments),
                shortestPathAlgorithm.getNodeCoordinates(path),
                resolvePoint("起点", start, null, null, "current_location"),
                resolvePoint("终点", end, null, null, "destination_location"),
                false,
                null,
                PROVIDER_LOCAL,
                "mixed_vehicle_dijkstra"
        );
        payload.put("cost", totalTimeMinutes);
        return payload;
    }

    // ==================== 多点导航 ====================

    /**
     * 多点有序途经点导航：按指定顺序依次经过每个途经点
     */
    public Map<String, Object> planWaypoints(String start, Double startLat, Double startLng,
                                              List<WaypointDef> waypoints,
                                              String end, Double endLat, Double endLng,
                                              String vehicle, String strategy,
                                              String placeType, String provider) {
        String normalizedVehicle = normalizeVehicle(vehicle);
        String normalizedStrategy = "distance".equalsIgnoreCase(strategy) ? "distance" : "time";
        String normalizedPlaceType = normalizePlaceType(placeType);
        String normalizedProvider = normalizeProvider(provider);

        if (waypoints == null || waypoints.isEmpty()) {
            // 降级为单段导航
            PlannedRoute route = planSingleRoute(start, end, startLat, startLng, endLat, endLng,
                    normalizedVehicle, normalizedStrategy, normalizedPlaceType, normalizedProvider);
            return route.success() ? route.payload() : Collections.emptyMap();
        }

        // 构建有序点位列表：起点 → waypoint[0] → waypoint[1] → ... → 终点
        List<PointDef> points = new ArrayList<>();
        points.add(new PointDef(start, startLat, startLng, "起点"));
        for (WaypointDef wp : waypoints) {
            points.add(new PointDef(wp.nodeId, wp.lat, wp.lng, wp.name));
        }
        if (end != null || endLat != null) {
            points.add(new PointDef(end, endLat, endLng, "终点"));
        } else if (!points.isEmpty()) {
            // 如果没指定终点且只有一个途经点，终点=起点形成闭环
        }

        return planSequentialRoute(points, normalizedVehicle, normalizedStrategy,
                normalizedPlaceType, normalizedProvider);
    }

    /**
     * 统一多点导航（支持 ordered / optimized / mixed 三种模式）
     */
    public Map<String, Object> planMultiPointRoute(String start, Double startLat, Double startLng,
                                                    List<WaypointDef> waypoints,
                                                    String end, Double endLat, Double endLng,
                                                    String mode, String algorithm,
                                                    String vehicle, String strategy,
                                                    String placeType, String provider) {
        String normalizedMode = mode != null ? mode : "ordered";

        if ("optimized".equals(normalizedMode)) {
            return planOptimizedRoute(start, startLat, startLng, waypoints, end, endLat, endLng,
                    algorithm, placeType);
        }

        if ("mixed".equals(normalizedMode)) {
            return planMixedRoute(start, startLat, startLng, waypoints, end, endLat, endLng,
                    algorithm, vehicle, strategy, placeType, provider);
        }

        // 默认 ordered 模式
        return planWaypoints(start, startLat, startLng, waypoints, end, endLat, endLng,
                vehicle, strategy, placeType, provider);
    }

    /**
     * 有序串联导航：按 point 列表顺序逐段导航
     */
    private Map<String, Object> planSequentialRoute(List<PointDef> points, String vehicle,
                                                     String strategy, String placeType,
                                                     String provider) {
        if (points.size() < 2) return Collections.emptyMap();

        List<String> fullPath = new ArrayList<>();
        List<Map<String, Object>> allSegments = new ArrayList<>();
        List<Map<String, Object>> legPolylines = new ArrayList<>();
        double totalDistance = 0;
        double totalTimeMinutes = 0;
        ResolvedPoint firstStart = null;
        ResolvedPoint lastEnd = null;
        boolean anyFallback = false;
        String fallbackReason = null;

        for (int i = 0; i < points.size() - 1; i++) {
            PointDef from = points.get(i);
            PointDef to = points.get(i + 1);

            PlannedRoute segment = planSingleRoute(
                    from.nodeId, to.nodeId, from.lat, from.lng, to.lat, to.lng,
                    vehicle, strategy, placeType, provider
            );

            if (!segment.success()) {
                return Collections.emptyMap();
            }

            Map<String, Object> segPayload = segment.payload();

            // 收集当前 leg 的 polyline
            {
                List<List<Double>> polyline = extractPolylineFromPayload(segPayload);
                Map<String, Object> leg = new LinkedHashMap<>();
                leg.put("from", from.nodeId);
                leg.put("to", to.nodeId);
                leg.put("fromName", from.name != null ? from.name : from.nodeId);
                leg.put("toName", to.name != null ? to.name : to.nodeId);
                leg.put("polyline", polyline);
                double legDist = ((Number) segPayload.getOrDefault("totalDistance", 0)).doubleValue();
                double legTime = ((Number) segPayload.getOrDefault("totalTime", 0)).doubleValue();
                leg.put("distance", legDist);
                leg.put("time", legTime);
                legPolylines.add(leg);
            }

            // 拼接路径
            @SuppressWarnings("unchecked")
            List<String> segPath = (List<String>) segPayload.get("path");
            if (segPath != null) {
                if (i == 0) {
                    fullPath.addAll(segPath);
                } else if (segPath.size() > 1) {
                    fullPath.addAll(segPath.subList(1, segPath.size()));
                }
            }

            // 合并 segments
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> segSegments = (List<Map<String, Object>>) segPayload.get("segments");
            if (segSegments != null) {
                allSegments.addAll(segSegments);
            }

            totalDistance += ((Number) segPayload.getOrDefault("totalDistance", 0)).doubleValue();
            totalTimeMinutes += ((Number) segPayload.getOrDefault("totalTime", 0)).doubleValue();

            if (i == 0) {
                firstStart = extractResolvedPoint(segPayload, "start");
            }
            lastEnd = extractResolvedPoint(segPayload, "end");

            if (Boolean.TRUE.equals(segPayload.get("fallback"))) {
                anyFallback = true;
                if (segPayload.get("fallbackReason") != null) {
                    fallbackReason = (String) segPayload.get("fallbackReason");
                }
            }
        }

        // 构建汇总响应
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("path", fullPath);
        result.put("nodeCount", fullPath.size());
        result.put("waypointCount", points.size());
        result.put("vehicle", vehicle);
        result.put("strategy", strategy);
        result.put("placeType", placeType);
        result.put("totalDistance", totalDistance);
        result.put("totalTime", totalTimeMinutes);
        result.put("segments", allSegments);
        result.put("nodeCoordinates", CoordinateTransformUtils.toGcj02NodeCoordinates(shortestPathAlgorithm.getNodeCoordinates(fullPath)));
        result.put("legPolylines", legPolylines);

        // 拼接完整 polylineCoordinates 供地图渲染
        List<List<Double>> fullPolyline = new ArrayList<>();
        for (Map<String, Object> leg : legPolylines) {
            @SuppressWarnings("unchecked")
            List<List<Double>> legPoly = (List<List<Double>>) leg.get("polyline");
            if (legPoly != null) {
                fullPolyline.addAll(legPoly);
            }
        }
        if (!fullPolyline.isEmpty()) {
            result.put("polylineCoordinates", fullPolyline);
        }

        result.put("provider", provider != null ? provider : "auto");
        result.put("source", "multi_point_waypoints");
        result.put("mode", "ordered");
        result.put("fallback", anyFallback);
        if (fallbackReason != null) result.put("fallbackReason", fallbackReason);

        // 途经点信息
        List<Map<String, Object>> waypointInfo = new ArrayList<>();
        for (int i = 1; i < points.size() - 1; i++) {
            PointDef wp = points.get(i);
            Map<String, Object> info = new LinkedHashMap<>();
            info.put("index", i);
            info.put("nodeId", wp.nodeId);
            info.put("name", wp.name);
            waypointInfo.add(info);
        }
        result.put("waypoints", waypointInfo);

        if (firstStart != null) appendResolution(result, firstStart, "start");
        if (lastEnd != null) appendResolution(result, lastEnd, "end");

        return result;
    }

    /**
     * 智能优化模式：使用 TSP 重排所有途经点顺序
     */
    private Map<String, Object> planOptimizedRoute(String start, Double startLat, Double startLng,
                                                    List<WaypointDef> waypoints,
                                                    String end, Double endLat, Double endLng,
                                                    String algorithm, String placeType) {
        if (waypoints == null || waypoints.isEmpty()) return Collections.emptyMap();

        // 解析起点
        ResolvedPoint origin = resolvePoint("起点", start, startLat, startLng, "current_location");
        if (!origin.success()) return Collections.emptyMap();

        // 收集所有目标点ID（途经点 + 终点）
        List<String> destIds = new ArrayList<>();
        for (WaypointDef wp : waypoints) {
            if (wp.nodeId != null) {
                destIds.add(wp.nodeId);
            } else if (wp.lat != null && wp.lng != null) {
                ShortestPathAlgorithm.NearestNodeResult nearest =
                        shortestPathAlgorithm.findNearestNode(wp.lat, wp.lng);
                if (nearest != null) destIds.add(nearest.getNodeId());
            }
        }

        // 如果指定了终点且不在途经点中，加入目标列表
        String endNodeId = null;
        if (end != null || endLat != null) {
            ResolvedPoint endPoint = resolvePoint("终点", end, endLat, endLng, "destination_location");
            if (endPoint.success()) {
                endNodeId = endPoint.nodeId();
                if (!destIds.contains(endNodeId)) {
                    destIds.add(endNodeId);
                }
            }
        }

        if (destIds.isEmpty()) return Collections.emptyMap();

        // 多点导航不应自动返回起点
        ShortestPathAlgorithm.RouteResult tspResult =
                shortestPathAlgorithm.multiDestinationRoute(origin.nodeId(), destIds, algorithm, false);

        // 计算总时间（步行速度约 1.4 m/s = 84 m/min）
        double walkingSpeedMperMin = 84.0;
        double totalTimeMinutes = tspResult.getTotalDistance() / walkingSpeedMperMin;
        double segmentTimeMinutes = tspResult.getSegments().stream()
                .mapToDouble(s -> s.getDistance() / walkingSpeedMperMin).sum();
        totalTimeMinutes = segmentTimeMinutes > 0 ? segmentTimeMinutes : totalTimeMinutes;

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("path", tspResult.getPath());
        data.put("targetPath", tspResult.getTargetPath());
        data.put("totalDistance", tspResult.getTotalDistance());
        data.put("totalTime", totalTimeMinutes);
        data.put("algorithm", tspResult.getAlgorithm());
        data.put("vehicle", "步行");
        data.put("strategy", "distance");
        data.put("unreachableDestinations", tspResult.getUnreachableDestinations());
        data.put("segments", tspResult.getSegments());
        data.put("nodeCoordinates", CoordinateTransformUtils.toGcj02NodeCoordinates(shortestPathAlgorithm.getNodeCoordinates(tspResult.getPath())));
        data.put("mode", "optimized");
        data.put("waypointCount", destIds.size());

        // 构建 per-leg polylines + 拼接完整 polylineCoordinates
        {
            List<String> tspPath = tspResult.getPath();
            Map<String, java.util.List<Double>> rawCoords = shortestPathAlgorithm.getNodeCoordinates(tspPath);
            Map<String, java.util.List<Double>> gcj02Coords = CoordinateTransformUtils.toGcj02NodeCoordinates(rawCoords);
            List<Map<String, Object>> legPolylines = new ArrayList<>();
            List<List<Double>> fullPolyline = new ArrayList<>();
            for (ShortestPathAlgorithm.RouteSegment seg : tspResult.getSegments()) {
                int fromIdx = tspPath.indexOf(seg.getFrom());
                int toIdx = tspPath.lastIndexOf(seg.getTo());
                List<List<Double>> polyline = new ArrayList<>();
                if (fromIdx >= 0 && toIdx >= fromIdx) {
                    for (int j = fromIdx; j <= toIdx && j < tspPath.size(); j++) {
                        java.util.List<Double> coord = gcj02Coords.get(tspPath.get(j));
                        if (coord != null && coord.size() >= 2) {
                            // nodeCoordinates 是 [lat, lng]，转为 AMap 期望的 [lng, lat]
                            polyline.add(List.of(coord.get(1), coord.get(0)));
                        }
                    }
                }
                fullPolyline.addAll(polyline);
                Map<String, Object> leg = new LinkedHashMap<>();
                leg.put("from", seg.getFrom());
                leg.put("to", seg.getTo());
                leg.put("polyline", polyline);
                leg.put("distance", seg.getDistance());
                leg.put("time", seg.getDistance() / walkingSpeedMperMin);
                legPolylines.add(leg);
            }
            data.put("legPolylines", legPolylines);
            if (!fullPolyline.isEmpty()) {
                data.put("polylineCoordinates", fullPolyline);
            }
        }

        return attachLocalMetadata(data, "multi_point_tsp");
    }

    /**
     * 混合模式：固定点保持顺序，非固定点在固定点之间做TSP优化
     */
    private Map<String, Object> planMixedRoute(String start, Double startLat, Double startLng,
                                                List<WaypointDef> waypoints,
                                                String end, Double endLat, Double endLng,
                                                String algorithm, String vehicle,
                                                String strategy, String placeType,
                                                String provider) {
        if (waypoints == null || waypoints.isEmpty()) {
            return planWaypoints(start, startLat, startLng, waypoints, end, endLat, endLng,
                    vehicle, strategy, placeType, provider);
        }

        String normalizedVehicle = normalizeVehicle(vehicle);
        String normalizedStrategy = "distance".equalsIgnoreCase(strategy) ? "distance" : "time";
        String normalizedPlaceType = normalizePlaceType(placeType);
        String normalizedProvider = normalizeProvider(provider);
        double walkingSpeedMperMin = 84.0;

        List<String> fullPath = new ArrayList<>();
        List<Map<String, Object>> allSegments = new ArrayList<>();
        double totalDistance = 0;
        double totalTimeMinutes = 0;

        // 收集所有点位：起点 + waypoints + 终点
        List<WaypointDef> allWaypoints = new ArrayList<>(waypoints);
        List<PointDef> orderedPoints = new ArrayList<>();
        orderedPoints.add(new PointDef(start, startLat, startLng, "起点"));
        for (WaypointDef wp : allWaypoints) {
            orderedPoints.add(new PointDef(wp.nodeId, wp.lat, wp.lng, wp.name));
        }
        if (end != null || endLat != null) {
            orderedPoints.add(new PointDef(end, endLat, endLng, "终点"));
        }

        // 分段：固定点之间可以有非固定点的优化块
        int segStart = 0;
        for (int i = segStart + 1; i < orderedPoints.size(); i++) {
            boolean isLast = (i == orderedPoints.size() - 1);
            // isFixed: 检查 orderedPoints[i-1] 是否对应一个被标记为 fixed 的 waypoint
            boolean isFixed = (i - 1 < allWaypoints.size()) && allWaypoints.get(i - 1).fixed;

            if (isFixed || isLast) {
                PointDef from = orderedPoints.get(segStart);
                PointDef to = orderedPoints.get(i);

                // 收集该块中间的非固定点
                List<String> middleIds = new ArrayList<>();
                for (int j = segStart + 1; j < i; j++) {
                    String nid = orderedPoints.get(j).nodeId;
                    if (nid != null) middleIds.add(nid);
                }

                if (middleIds.isEmpty()) {
                    // 没有非固定点，直接单段导航
                    PlannedRoute route = planSingleRoute(
                            from.nodeId, to.nodeId, from.lat, from.lng, to.lat, to.lng,
                            normalizedVehicle, normalizedStrategy, normalizedPlaceType, normalizedProvider);
                    if (route.success()) {
                        accumulateMixedSegment(route.payload(), from, to, fullPath, allSegments,
                                walkingSpeedMperMin);
                        totalDistance += ((Number) route.payload().getOrDefault("totalDistance", 0)).doubleValue();
                        totalTimeMinutes += ((Number) route.payload().getOrDefault("totalTime", 0)).doubleValue();
                    }
                } else {
                    // 有非固定点：TSP 优化从 from 出发经 middleIds 到达 to
                    // Step 1: 把 to 也加入目标列表，确保路径以 to 结束
                    List<String> allDests = new ArrayList<>(middleIds);
                    if (to.nodeId != null && !allDests.contains(to.nodeId)) {
                        allDests.add(to.nodeId);
                    }
                    ShortestPathAlgorithm.RouteResult tspResult =
                            shortestPathAlgorithm.multiDestinationRoute(
                                    from.nodeId, allDests, algorithm, false);
                    if (!tspResult.getPath().isEmpty()) {
                        fullPath.addAll(tspResult.getPath());
                        for (ShortestPathAlgorithm.RouteSegment seg : tspResult.getSegments()) {
                            Map<String, Object> sm = new LinkedHashMap<>();
                            sm.put("from", seg.getFrom());
                            sm.put("to", seg.getTo());
                            sm.put("vehicle", seg.getVehicle());
                            sm.put("time", seg.getDistance() / walkingSpeedMperMin);
                            sm.put("distance", seg.getDistance());
                            allSegments.add(sm);
                        }
                        totalDistance += tspResult.getTotalDistance();
                        totalTimeMinutes += tspResult.getTotalDistance() / walkingSpeedMperMin;
                    }
                }
                segStart = i;
            }
        }

        // 构建节点坐标
        Map<String, java.util.List<Double>> rawCoords = shortestPathAlgorithm.getNodeCoordinates(fullPath);
        Map<String, java.util.List<Double>> gcj02Coords = CoordinateTransformUtils.toGcj02NodeCoordinates(rawCoords);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("path", fullPath);
        result.put("totalDistance", totalDistance);
        result.put("totalTime", totalTimeMinutes);
        result.put("segments", allSegments);
        result.put("nodeCoordinates", gcj02Coords);
        result.put("mode", "mixed");
        result.put("algorithm", algorithm);
        result.put("provider", "local");
        result.put("source", "multi_point_mixed");
        result.put("waypointCount", waypoints.size());

        // 构建 per-leg polylines + 完整 polylineCoordinates
        {
            List<Map<String, Object>> legPolylines = new ArrayList<>();
            List<List<Double>> fullPolyline = new ArrayList<>();
            for (Map<String, Object> seg : allSegments) {
                String fromId = (String) seg.get("from");
                String toId = (String) seg.get("to");
                int fromIdx = fullPath.indexOf(fromId);
                int toIdx = fullPath.lastIndexOf(toId);
                List<List<Double>> polyline = new ArrayList<>();
                if (fromIdx >= 0 && toIdx >= fromIdx && gcj02Coords != null) {
                    for (int j = fromIdx; j <= toIdx && j < fullPath.size(); j++) {
                        java.util.List<Double> coord = gcj02Coords.get(fullPath.get(j));
                        if (coord != null && coord.size() >= 2) {
                            polyline.add(List.of(coord.get(1), coord.get(0)));
                        }
                    }
                }
                fullPolyline.addAll(polyline);
                Map<String, Object> leg = new LinkedHashMap<>();
                leg.put("from", fromId);
                leg.put("to", toId);
                leg.put("polyline", polyline);
                leg.put("distance", ((Number) seg.getOrDefault("distance", 0)).doubleValue());
                leg.put("time", ((Number) seg.getOrDefault("time", 0)).doubleValue());
                legPolylines.add(leg);
            }
            result.put("legPolylines", legPolylines);
            if (!fullPolyline.isEmpty()) {
                result.put("polylineCoordinates", fullPolyline);
            }
        }

        return result;
    }

    /**
     * 将单段导航结果累积到混合模式的汇总数据中
     */
    private void accumulateMixedSegment(Map<String, Object> segPayload,
                                         PointDef from, PointDef to,
                                         List<String> fullPath,
                                         List<Map<String, Object>> allSegments,
                                         double walkingSpeedMperMin) {
        @SuppressWarnings("unchecked")
        List<String> segPath = (List<String>) segPayload.get("path");
        if (segPath != null) {
            if (fullPath.isEmpty()) {
                fullPath.addAll(segPath);
            } else if (segPath.size() > 1) {
                fullPath.addAll(segPath.subList(1, segPath.size()));
            }
        }

        double segDist = ((Number) segPayload.getOrDefault("totalDistance", 0)).doubleValue();
        double segTime = ((Number) segPayload.getOrDefault("totalTime", 0)).doubleValue();

        Map<String, Object> sm = new LinkedHashMap<>();
        sm.put("from", from.nodeId);
        sm.put("to", to.nodeId);
        sm.put("fromName", from.name != null ? from.name : from.nodeId);
        sm.put("toName", to.name != null ? to.name : to.nodeId);
        sm.put("vehicle", segPayload.getOrDefault("vehicle", "步行"));
        sm.put("time", segTime);
        sm.put("distance", segDist);
        allSegments.add(sm);
    }

    private ResolvedPoint extractResolvedPoint(Map<String, Object> payload, String prefix) {
        String cap = prefix.substring(0, 1).toUpperCase() + prefix.substring(1);
        String resolvedKey = "resolved" + cap + "Node";
        if (payload.containsKey(resolvedKey)) {
            String nodeId = (String) payload.get(resolvedKey);
            String requested = (String) payload.get("requested" + cap);
            return new ResolvedPoint(true, null, requested, nodeId, null, false, null, null);
        }
        return null;
    }

    public record WaypointDef(String nodeId, String name, Double lat, Double lng, boolean fixed) {
        public WaypointDef(String nodeId, String name, Double lat, Double lng) {
            this(nodeId, name, lat, lng, false);
        }
    }

    private record PointDef(String nodeId, Double lat, Double lng, String name) {}

    public Map<String, Object> attachLocalMetadata(Map<String, Object> payload, String source) {
        if (payload == null || payload.isEmpty()) {
            return payload;
        }
        payload.put("provider", PROVIDER_LOCAL);
        payload.put("source", source);
        payload.putIfAbsent("fallback", false);
        return payload;
    }

    private Map<String, Object> buildLocalRoute(String start,
                                                String end,
                                                String vehicle,
                                                String strategy,
                                                String placeType,
                                                boolean fallback,
                                                String fallbackReason,
                                                String source) {
        return buildLocalRoute(
                resolvePoint("起点", start, null, null, "current_location"),
                resolvePoint("终点", end, null, null, "destination_location"),
                vehicle,
                strategy,
                placeType,
                fallback,
                fallbackReason,
                source
        );
    }

    private Map<String, Object> buildLocalRoute(ResolvedPoint start,
                                                ResolvedPoint end,
                                                String vehicle,
                                                String strategy,
                                                String placeType,
                                                boolean fallback,
                                                String fallbackReason,
                                                String source) {
        if (start == null || end == null || !start.success() || !end.success()) {
            return Collections.emptyMap();
        }
        ShortestPathAlgorithm.PathResult result;
        if ("distance".equals(strategy)) {
            result = shortestPathAlgorithm.dijkstraDistanceOnly(start.nodeId(), end.nodeId());
        } else {
            result = shortestPathAlgorithm.astar(start.nodeId(), end.nodeId(), vehicle);
        }

        if (!result.isReachable()) {
            return Collections.emptyMap();
        }

        List<ShortestPathAlgorithm.RouteSegment> segments = shortestPathAlgorithm.buildPathSegments(result.getPath(), vehicle);
        double totalDistance = "distance".equals(strategy)
                ? result.getCost()
                : shortestPathAlgorithm.calculatePathDistance(result.getPath());
        double totalTimeSeconds = "distance".equals(strategy)
                ? shortestPathAlgorithm.calculatePathTravelTime(result.getPath(), vehicle)
                : result.getCost();
        double totalTimeMinutes = totalTimeSeconds / 60.0;

        Map<String, Object> payload = buildBasePayload(
                result.getPath(),
                vehicle,
                strategy,
                placeType,
                totalDistance,
                totalTimeMinutes,
                buildSegments(segments),
                CoordinateTransformUtils.toGcj02NodeCoordinates(shortestPathAlgorithm.getNodeCoordinates(result.getPath())),
                start,
                end,
                fallback,
                fallbackReason,
                PROVIDER_LOCAL,
                source
        );
        payload.put("cost", totalTimeMinutes);
        return payload;
    }

    private AmapAttempt tryAmapRoute(ResolvedPoint start,
                                     ResolvedPoint end,
                                     String vehicle,
                                     String strategy,
                                     String placeType) {
        if (!amapEnabled) {
            return AmapAttempt.failed("高德路线规划已禁用");
        }
        if (amapKey == null || amapKey.isBlank()) {
            return AmapAttempt.failed("高德 Web 服务 key 未配置");
        }

        double[] startCoordinate = start.routeCoordinate();
        double[] endCoordinate = end.routeCoordinate();
        if (!isValidCoordinate(startCoordinate) || !isValidCoordinate(endCoordinate)) {
            return AmapAttempt.failed("起终点缺少可用于高德路径规划的经纬度");
        }

        TravelMode mode = resolveTravelMode(vehicle, strategy, placeType);
        URI uri = UriComponentsBuilder
                .fromUriString(amapBaseUrl + mode.path())
                .queryParam("key", amapKey)
                .queryParam("origin", toAmapCoordinate(startCoordinate))
                .queryParam("destination", toAmapCoordinate(endCoordinate))
                .queryParam("show_fields", "cost,navi,polyline")
                .queryParam("output", "JSON")
                .build(true)
                .toUri();

        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofMillis(Math.max(amapTimeoutMs, 1000)))
                .GET()
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return AmapAttempt.failed("高德路径规划 HTTP " + response.statusCode());
            }

            JsonNode root = objectMapper.readTree(response.body());
            String status = root.path("status").asText("");
            if (!Objects.equals(status, "1")) {
                String info = root.path("info").asText("高德路径规划失败");
                String infocode = root.path("infocode").asText("");
                return AmapAttempt.failed(infocode.isBlank() ? info : info + " (" + infocode + ")");
            }

            JsonNode pathNode = extractFirstPath(root.path("route").path("paths"));
            if (pathNode == null || pathNode.isMissingNode()) {
                return AmapAttempt.failed("高德路径规划未返回有效路径");
            }

            double totalDistance = parseDouble(pathNode.path("distance").asText());
            double totalTimeSeconds = extractDurationSeconds(pathNode);
            double totalTimeMinutes = totalTimeSeconds > 0 ? totalTimeSeconds / 60.0 : 0.0;

            List<Map<String, Object>> segments = List.of(Map.of(
                    "from", start.responseLabel(),
                    "to", end.responseLabel(),
                    "vehicle", mode.displayVehicle(vehicle),
                    "distance", totalDistance,
                    "time", totalTimeMinutes
            ));
            List<List<Double>> polylineCoordinates = extractPolylineCoordinates(pathNode.path("steps"));
            Map<String, List<Double>> nodeCoordinates = new LinkedHashMap<>();
            nodeCoordinates.put(start.responseLabel(), List.of(startCoordinate[0], startCoordinate[1]));
            nodeCoordinates.put(end.responseLabel(), List.of(endCoordinate[0], endCoordinate[1]));

            List<String> detailedPath = extractStepInstructions(pathNode.path("steps"));
            Map<String, Object> payload = buildBasePayload(
                    List.of(start.responseLabel(), end.responseLabel()),
                    mode.displayVehicle(vehicle),
                    strategy,
                    placeType,
                    totalDistance,
                    totalTimeMinutes,
                    segments,
                    nodeCoordinates,
                    start,
                    end,
                    false,
                    null,
                    PROVIDER_AMAP,
                    mode.source()
            );
            payload.put("cost", "distance".equals(strategy) ? totalDistance : totalTimeMinutes);
            payload.put("polylineCoordinates", polylineCoordinates);
            payload.put("detailedPath", detailedPath);
            payload.put("detailed_path", detailedPath);
            payload.put("amapMode", mode.code());
            return AmapAttempt.success(payload);
        } catch (IOException e) {
            return AmapAttempt.failed("高德路径规划响应解析失败: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return AmapAttempt.failed("高德路径规划请求被中断");
        } catch (Exception e) {
            return AmapAttempt.failed("高德路径规划调用异常: " + e.getMessage());
        }
    }

    private Map<String, Object> buildBasePayload(List<String> path,
                                                 String vehicle,
                                                 String strategy,
                                                 String placeType,
                                                 double totalDistance,
                                                 double totalTime,
                                                 List<Map<String, Object>> segments,
                                                 Map<String, List<Double>> nodeCoordinates,
                                                 ResolvedPoint start,
                                                 ResolvedPoint end,
                                                 boolean fallback,
                                                 String fallbackReason,
                                                 String provider,
                                                 String source) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("path", path);
        payload.put("nodeCount", path == null ? 0 : path.size());
        payload.put("vehicle", vehicle);
        payload.put("strategy", strategy);
        payload.put("placeType", placeType);
        payload.put("availableVehicles", shortestPathAlgorithm.getAvailableVehicles(placeType));
        payload.put("totalDistance", totalDistance);
        payload.put("totalTime", totalTime);
        payload.put("segments", segments);
        payload.put("nodeCoordinates", nodeCoordinates);
        payload.put("provider", provider);
        payload.put("source", source);
        payload.put("fallback", fallback);
        appendResolution(payload, start, "start");
        appendResolution(payload, end, "end");
        if (fallbackReason != null && !fallbackReason.isBlank()) {
            payload.put("fallbackReason", fallbackReason);
        }
        return payload;
    }

    private List<Map<String, Object>> buildSegments(List<ShortestPathAlgorithm.RouteSegment> segments) {
        if (segments == null || segments.isEmpty()) {
            return List.of();
        }
        List<Map<String, Object>> mapped = new ArrayList<>();
        for (ShortestPathAlgorithm.RouteSegment segment : segments) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("from", segment.getFrom());
            item.put("to", segment.getTo());
            item.put("vehicle", segment.getVehicle());
            item.put("time", segment.getTime() / 60.0);
            item.put("distance", segment.getDistance());
            mapped.add(item);
        }
        return mapped;
    }

    @SuppressWarnings("unchecked")
    private List<List<Double>> extractPolylineFromPayload(Map<String, Object> payload) {
        List<List<Double>> amapPolyline = (List<List<Double>>) payload.get("polylineCoordinates");
        if (amapPolyline != null && !amapPolyline.isEmpty()) {
            return amapPolyline;
        }

        Map<String, List<Double>> nodeCoords = (Map<String, List<Double>>) payload.get("nodeCoordinates");
        List<String> path = (List<String>) payload.get("path");

        if (nodeCoords != null && path != null && !path.isEmpty()) {
            List<List<Double>> polyline = new ArrayList<>();
            for (String nodeId : path) {
                List<Double> coord = nodeCoords.get(nodeId);
                if (coord != null && coord.size() >= 2) {
                    // nodeCoordinates 是 [lat, lng]，转为 AMap 期望的 [lng, lat]
                    polyline.add(List.of(coord.get(1), coord.get(0)));
                }
            }
            if (!polyline.isEmpty()) {
                return polyline;
            }
        }

        return List.of();
    }

    private List<String> buildPathFromSegments(List<ShortestPathAlgorithm.RouteSegment> segments) {
        if (segments == null || segments.isEmpty()) {
            return List.of();
        }
        List<String> path = new ArrayList<>();
        path.add(segments.get(0).getFrom());
        for (ShortestPathAlgorithm.RouteSegment segment : segments) {
            path.add(segment.getTo());
        }
        return path;
    }

    private JsonNode extractFirstPath(JsonNode pathsNode) {
        if (pathsNode == null || pathsNode.isMissingNode() || pathsNode.isNull()) {
            return null;
        }
        if (pathsNode.isArray()) {
            return pathsNode.isEmpty() ? null : pathsNode.get(0);
        }
        return pathsNode;
    }

    private double extractDurationSeconds(JsonNode pathNode) {
        if (pathNode == null || pathNode.isMissingNode()) {
            return 0.0;
        }
        double duration = parseDouble(pathNode.path("cost").path("duration").asText());
        if (duration > 0) {
            return duration;
        }

        if (pathNode.has("duration")) {
            duration = parseDouble(pathNode.path("duration").asText());
        }
        if (duration > 0) {
            return duration;
        }

        JsonNode stepsNode = pathNode.path("steps");
        if (stepsNode.isArray()) {
            double total = 0;
            for (JsonNode step : stepsNode) {
                total += parseDouble(step.path("cost").path("duration").asText());
                if (total <= 0) {
                    total += parseDouble(step.path("duration").asText());
                }
            }
            return total;
        }
        return 0.0;
    }

    private List<String> extractStepInstructions(JsonNode stepsNode) {
        if (stepsNode == null || !stepsNode.isArray()) {
            return List.of();
        }
        List<String> instructions = new ArrayList<>();
        for (JsonNode step : stepsNode) {
            String instruction = step.path("instruction").asText("");
            if (!instruction.isBlank()) {
                instructions.add(instruction);
            }
        }
        return instructions;
    }

    private List<List<Double>> extractPolylineCoordinates(JsonNode stepsNode) {
        if (stepsNode == null || !stepsNode.isArray()) {
            return List.of();
        }
        List<List<Double>> coordinates = new ArrayList<>();
        for (JsonNode step : stepsNode) {
            String polyline = step.path("polyline").asText("");
            if (polyline.isBlank()) {
                polyline = step.path("cost").path("navi").path("polyline").asText("");
            }
            if (polyline.isBlank()) {
                continue;
            }
            for (String point : polyline.split(";")) {
                String[] parts = point.split(",");
                if (parts.length != 2) {
                    continue;
                }
                double lng = parseDouble(parts[0]);
                double lat = parseDouble(parts[1]);
                coordinates.add(List.of(lng, lat));
            }
        }
        return coordinates;
    }

    private TravelMode resolveTravelMode(String vehicle, String strategy, String placeType) {
        if ("distance".equals(strategy) || "步行".equals(vehicle)) {
            return TravelMode.WALKING;
        }
        if ("自行车".equals(vehicle)) {
            return TravelMode.BICYCLING;
        }
        if ("电瓶车".equals(vehicle)) {
            return TravelMode.ELECTROBIKE;
        }
        if ("校园".equals(placeType)) {
            return TravelMode.BICYCLING;
        }
        return TravelMode.WALKING;
    }

    private ResolvedPoint resolvePoint(String role,
                                       String nodeId,
                                       Double lat,
                                       Double lng,
                                       String fallbackLabel) {
        String requestedLabel = nodeId == null || nodeId.isBlank() ? fallbackLabel : nodeId;
        if (nodeId != null && !nodeId.isBlank() && shortestPathAlgorithm.containsNode(nodeId)) {
            return ResolvedPoint.node(requestedLabel, nodeId, shortestPathAlgorithm.getNodeCoordinate(nodeId));
        }

        if (lat != null && lng != null) {
            // 前端传入坐标与路网图存储均为 GCJ-02，直接匹配最近节点即可
            ShortestPathAlgorithm.NearestNodeResult nearestNode = shortestPathAlgorithm.findNearestNode(lat, lng);
            if (nearestNode == null) {
                return ResolvedPoint.failed(role + "缺少可映射的图节点");
            }
            return ResolvedPoint.mapped(
                    requestedLabel,
                    nearestNode.getNodeId(),
                    new double[]{lat, lng},
                    nearestNode.getDistance(),
                    nearestNode.getCoordinate()
            );
        }

        if (nodeId != null && !nodeId.isBlank()) {
            return ResolvedPoint.failed(role + "节点 [" + nodeId + "] 不存在，且未提供可用于最近节点映射的坐标");
        }
        return ResolvedPoint.failed(role + "不能为空，至少需要提供节点 ID 或经纬度");
    }

    private void appendResolution(Map<String, Object> payload, ResolvedPoint point, String prefix) {
        if (payload == null || point == null || !point.success()) {
            return;
        }
        payload.put("requested" + capitalize(prefix), point.requestedLabel());
        payload.put("resolved" + capitalize(prefix) + "Node", point.nodeId());
        if (point.mappedFromCoordinate()) {
            payload.put(prefix + "Resolution", "nearest_graph_node");
            payload.put(prefix + "NearestNodeDistance", point.mappingDistanceMeters());
            payload.put(prefix + "NearestNodeCoordinate", point.nodeCoordinate());
        }
    }

    private String capitalize(String value) {
        if (value == null || value.isEmpty()) {
            return value;
        }
        return Character.toUpperCase(value.charAt(0)) + value.substring(1);
    }

    private String normalizeProvider(String providerPreference) {
        String provider = providerPreference;
        if (provider == null || provider.isBlank()) {
            provider = defaultProvider;
        }
        provider = provider == null ? PROVIDER_AUTO : provider.trim().toLowerCase(Locale.ROOT);
        return switch (provider) {
            case PROVIDER_LOCAL -> PROVIDER_LOCAL;
            case PROVIDER_AMAP -> PROVIDER_AMAP;
            default -> PROVIDER_AUTO;
        };
    }

    private String normalizeVehicle(String vehicle) {
        return vehicle == null || vehicle.isBlank() ? "步行" : vehicle;
    }

    private String normalizePlaceType(String placeType) {
        return placeType == null || placeType.isBlank() ? "景区" : placeType;
    }

    private boolean isValidCoordinate(double[] coordinate) {
        return coordinate != null
                && coordinate.length >= 2
                && Double.isFinite(coordinate[0])
                && Double.isFinite(coordinate[1]);
    }

    private String toAmapCoordinate(double[] coordinate) {
        return String.format(Locale.US, "%.6f,%.6f", coordinate[1], coordinate[0]);
    }

    private double parseDouble(String value) {
        if (value == null || value.isBlank()) {
            return 0.0;
        }
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException ignored) {
            return 0.0;
        }
    }

    public record PlannedRoute(boolean success, String message, Map<String, Object> payload) {
        public static PlannedRoute success(Map<String, Object> payload) {
            if (payload == null || payload.isEmpty()) {
                return failed("无法找到有效路径");
            }
            return new PlannedRoute(true, "success", payload);
        }

        public static PlannedRoute failed(String message) {
            return new PlannedRoute(false, message, Collections.emptyMap());
        }
    }

    private record AmapAttempt(boolean success, String reason, Map<String, Object> payload) {
        static AmapAttempt success(Map<String, Object> payload) {
            return new AmapAttempt(true, null, payload);
        }

        static AmapAttempt failed(String reason) {
            return new AmapAttempt(false, reason, Collections.emptyMap());
        }
    }

    private record ResolvedPoint(boolean success,
                                 String errorMessage,
                                 String requestedLabel,
                                 String nodeId,
                                 double[] routeCoordinate,
                                 boolean mappedFromCoordinate,
                                 Double mappingDistanceMeters,
                                 List<Double> nodeCoordinate) {
        static ResolvedPoint node(String requestedLabel, String nodeId, double[] routeCoordinate) {
            List<Double> coordinate = routeCoordinate == null || routeCoordinate.length < 2
                    ? null
                    : List.of(routeCoordinate[0], routeCoordinate[1]);
            return new ResolvedPoint(true, null, requestedLabel, nodeId, routeCoordinate, false, null, coordinate);
        }

        static ResolvedPoint mapped(String requestedLabel,
                                    String nodeId,
                                    double[] routeCoordinate,
                                    double mappingDistanceMeters,
                                    List<Double> nodeCoordinate) {
            return new ResolvedPoint(true, null, requestedLabel, nodeId, routeCoordinate, true, mappingDistanceMeters, nodeCoordinate);
        }

        static ResolvedPoint failed(String errorMessage) {
            return new ResolvedPoint(false, errorMessage, null, null, null, false, null, null);
        }

        String responseLabel() {
            return requestedLabel == null || requestedLabel.isBlank() ? nodeId : requestedLabel;
        }
    }

    private enum TravelMode {
        WALKING("/v5/direction/walking", "walking", "amap_direction_walking"),
        BICYCLING("/v5/direction/bicycling", "bicycling", "amap_direction_bicycling"),
        ELECTROBIKE("/v5/direction/electrobike", "electrobike", "amap_direction_electrobike");

        private final String path;
        private final String code;
        private final String source;

        TravelMode(String path, String code, String source) {
            this.path = path;
            this.code = code;
            this.source = source;
        }

        public String path() {
            return path;
        }

        public String code() {
            return code;
        }

        public String source() {
            return source;
        }

        public String displayVehicle(String requestVehicle) {
            if (requestVehicle != null && !requestVehicle.isBlank()) {
                return requestVehicle;
            }
            return switch (this) {
                case WALKING -> "步行";
                case BICYCLING -> "自行车";
                case ELECTROBIKE -> "电瓶车";
            };
        }
    }
}
