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

        double totalTime = segments.stream().mapToDouble(ShortestPathAlgorithm.RouteSegment::getTime).sum();
        double totalDistance = segments.stream().mapToDouble(ShortestPathAlgorithm.RouteSegment::getDistance).sum();
        List<String> path = buildPathFromSegments(segments);

        Map<String, Object> payload = buildBasePayload(
                path,
                "混合",
                "time",
                normalizedPlaceType,
                totalDistance,
                totalTime,
                buildSegments(segments),
                shortestPathAlgorithm.getNodeCoordinates(path),
                resolvePoint("起点", start, null, null, "current_location"),
                resolvePoint("终点", end, null, null, "destination_location"),
                false,
                null,
                PROVIDER_LOCAL,
                "mixed_vehicle_dijkstra"
        );
        payload.put("cost", totalTime);
        return payload;
    }

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
        double totalTime = "distance".equals(strategy)
                ? shortestPathAlgorithm.calculatePathTravelTime(result.getPath(), vehicle)
                : result.getCost();

        Map<String, Object> payload = buildBasePayload(
                result.getPath(),
                vehicle,
                strategy,
                placeType,
                totalDistance,
                totalTime,
                buildSegments(segments),
                CoordinateTransformUtils.toGcj02NodeCoordinates(shortestPathAlgorithm.getNodeCoordinates(result.getPath())),
                start,
                end,
                fallback,
                fallbackReason,
                PROVIDER_LOCAL,
                source
        );
        payload.put("cost", result.getCost());
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
            item.put("time", segment.getTime());
            item.put("distance", segment.getDistance());
            mapped.add(item);
        }
        return mapped;
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
