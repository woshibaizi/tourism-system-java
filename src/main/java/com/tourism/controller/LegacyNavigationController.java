package com.tourism.controller;

import com.tourism.algorithm.IndoorNavigationAlgorithm;
import com.tourism.algorithm.ShortestPathAlgorithm;
import com.tourism.service.OutdoorRouteService;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 兼容旧前端的导航接口
 */
@RestController
@RequestMapping("/api")
public class LegacyNavigationController {

    private final ShortestPathAlgorithm shortestPathAlgorithm;
    private final IndoorNavigationAlgorithm indoorNavigationAlgorithm;
    private final OutdoorRouteService outdoorRouteService;

    public LegacyNavigationController(ShortestPathAlgorithm shortestPathAlgorithm,
                                      IndoorNavigationAlgorithm indoorNavigationAlgorithm,
                                      OutdoorRouteService outdoorRouteService) {
        this.shortestPathAlgorithm = shortestPathAlgorithm;
        this.indoorNavigationAlgorithm = indoorNavigationAlgorithm;
        this.outdoorRouteService = outdoorRouteService;
    }

    @PostMapping("/routes/single")
    public Map<String, Object> planSingleRoute(@RequestBody Map<String, Object> request) {
        String start = stringValue(request.get("start"));
        String end = stringValue(request.get("end"));
        String strategy = stringValue(request.getOrDefault("strategy", "distance"));
        String vehicle = stringValue(request.get("vehicle"));
        String placeType = stringValue(request.getOrDefault("placeType", "景区"));
        String provider = stringValue(request.get("provider"));
        Double startLat = doubleValue(request.get("startLat"));
        Double startLng = doubleValue(request.get("startLng"));
        Double endLat = doubleValue(request.get("endLat"));
        Double endLng = doubleValue(request.get("endLng"));
        boolean useMixedVehicles = Boolean.TRUE.equals(request.get("useMixedVehicles"));

        if (start == null && (startLat == null || startLng == null)) {
            return fail("起点不能为空");
        }
        if (end == null && (endLat == null || endLng == null)) {
            return fail("起点和终点不能为空");
        }

        if ("time".equals(strategy) && (useMixedVehicles || vehicle == null || vehicle.isBlank())) {
            if (start == null || end == null) {
                return fail("混合交通模式当前需要提供起点和终点节点 ID");
            }
            Map<String, Object> mixedRoute = outdoorRouteService.buildMixedVehicleRoute(start, end, placeType);
            if (mixedRoute.isEmpty()) {
                return fail("无法找到有效路径");
            }
            return success(toLegacyRoutePayload(mixedRoute, true));
        }

        OutdoorRouteService.PlannedRoute plannedRoute = outdoorRouteService.planSingleRoute(
                start,
                end,
                startLat,
                startLng,
                endLat,
                endLng,
                vehicle,
                strategy,
                placeType,
                provider
        );
        if (!plannedRoute.success()) {
            return fail(plannedRoute.message());
        }
        return success(toLegacyRoutePayload(plannedRoute.payload(), false));
    }

    @PostMapping("/routes/multi")
    public Map<String, Object> planMultiRoute(@RequestBody Map<String, Object> request) {
        String start = stringValue(request.get("start"));
        @SuppressWarnings("unchecked")
        List<String> destinations = (List<String>) request.get("destinations");
        String algorithm = stringValue(request.getOrDefault("algorithm", "nearest_neighbor"));

        if (start == null || destinations == null || destinations.isEmpty()) {
            return fail("起点和目标点不能为空");
        }

        ShortestPathAlgorithm.RouteResult result =
                shortestPathAlgorithm.multiDestinationRoute(start, destinations, algorithm);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("path", result.getPath());
        data.put("total_distance", result.getTotalDistance());
        data.put("algorithm_name", result.getAlgorithm());
        data.put("destinations_order", result.getTargetPath());
        data.put("target_path", result.getTargetPath());
        data.put("unreachable_destinations", result.getUnreachableDestinations());
        data.put("segments", result.getSegments());
        data.put("provider", "local");
        data.put("source", "multi_destination_tsp");
        data.put("fallback", false);
        data.put("message", "多目标路径规划完成（基于最短距离）");

        Map<String, Object> response = success(data);
        response.put("message", "多目标路径规划完成（基于最短距离）");
        return response;
    }

    @GetMapping("/indoor/building")
    public Map<String, Object> getBuildingInfo() {
        return success(indoorNavigationAlgorithm.getBuildingInfo());
    }

    @GetMapping("/indoor/rooms")
    public Map<String, Object> getRooms(@RequestParam(required = false) Integer floor) {
        if (floor != null) {
            return success(indoorNavigationAlgorithm.getFloorRooms(floor));
        }
        return success(indoorNavigationAlgorithm.getAllRooms());
    }

    @PostMapping("/indoor/navigate")
    public Map<String, Object> navigateIndoor(@RequestBody Map<String, Object> request) {
        String roomId = stringValue(request.get("roomId"));
        boolean avoidCongestion = !Boolean.FALSE.equals(request.get("avoidCongestion"));
        boolean useTimeWeight = !Boolean.FALSE.equals(request.getOrDefault("useTimeWeight", true));

        if (roomId == null || roomId.isBlank()) {
            return fail("请提供房间ID");
        }

        IndoorNavigationAlgorithm.NavigationResult result =
                indoorNavigationAlgorithm.navigateToRoom(roomId, avoidCongestion, useTimeWeight);

        if (!result.isSuccess()) {
            return fail(result.getMessage());
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("destination", result.getDestination());
        data.put("path", result.getPath());
        data.put("navigation_steps", result.getNavigationSteps().stream().map(step -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("step", step.getStep());
            item.put("from", step.getFrom());
            item.put("to", step.getTo());
            item.put("distance", step.getDistance());
            item.put("description", step.getDescription());
            item.put("floor_change", step.isFloorChange());
            item.put("action", step.getAction());
            return item;
        }).toList());
        data.put("total_distance", result.getTotalDistance());
        data.put("estimated_time", result.getEstimatedTime());
        data.put("avoid_congestion", avoidCongestion);
        data.put("path_description", buildPathDescription(result));
        data.put("floor_analysis", result.getFloorAnalysis());
        data.put("optimization_target", result.getOptimizationTarget());
        return success(data);
    }

    @PostMapping("/nearest-node")
    public Map<String, Object> nearestNode(@RequestBody Map<String, Object> request) {
        Double lat = doubleValue(request.get("lat"));
        Double lng = doubleValue(request.get("lng"));
        if (lat == null || lng == null) {
            return fail("经纬度不能为空");
        }
        ShortestPathAlgorithm.NearestNodeResult nearestNode = shortestPathAlgorithm.findNearestNode(lat, lng);
        if (nearestNode == null) {
            return fail("当前路图没有可用节点");
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("node_id", nearestNode.getNodeId());
        data.put("distance", nearestNode.getDistance());
        data.put("coordinate", nearestNode.getCoordinate());
        data.put("provider", "local");
        data.put("source", "nearest_graph_node");
        return success(data);
    }

    private String buildPathDescription(IndoorNavigationAlgorithm.NavigationResult result) {
        return "从大门出发，经过 " + Math.max(result.getPath().size() - 2, 0)
                + " 个关键节点，到达 " + result.getDestination().get("name")
                + "，预计 " + result.getEstimatedTime() + " 分钟。";
    }

    private Map<String, Object> toLegacyRoutePayload(Map<String, Object> payload, boolean mixedVehicle) {
        Map<String, Object> data = new LinkedHashMap<>();
        Object vehicle = mixedVehicle ? "混合" : ("distance".equals(payload.get("strategy")) ? "不限" : payload.get("vehicle"));
        Map<String, Object> detailedInfo = new LinkedHashMap<>();
        detailedInfo.put("path", payload.get("path"));
        detailedInfo.put("total_distance", payload.get("totalDistance"));
        detailedInfo.put("total_time", payload.get("totalTime"));
        detailedInfo.put("strategy", payload.get("strategy"));
        detailedInfo.put("vehicle", vehicle);
        detailedInfo.put("segments", payload.get("segments"));

        data.put("path", payload.get("path"));
        data.put("total_distance", payload.get("totalDistance"));
        data.put("total_time", payload.get("totalTime"));
        data.put("strategy", payload.get("strategy"));
        data.put("vehicle", vehicle);
        data.put("available_vehicles", payload.get("availableVehicles"));
        data.put("provider", payload.get("provider"));
        data.put("source", payload.get("source"));
        data.put("fallback", payload.get("fallback"));
        if (payload.containsKey("fallbackReason")) {
            data.put("fallback_reason", payload.get("fallbackReason"));
        }
        if (payload.containsKey("requestedStart")) {
            data.put("requested_start", payload.get("requestedStart"));
        }
        if (payload.containsKey("requestedEnd")) {
            data.put("requested_end", payload.get("requestedEnd"));
        }
        if (payload.containsKey("resolvedStartNode")) {
            data.put("resolved_start_node", payload.get("resolvedStartNode"));
        }
        if (payload.containsKey("resolvedEndNode")) {
            data.put("resolved_end_node", payload.get("resolvedEndNode"));
        }
        if (payload.containsKey("startResolution")) {
            data.put("start_resolution", payload.get("startResolution"));
            data.put("start_nearest_node_distance", payload.get("startNearestNodeDistance"));
        }
        if (payload.containsKey("endResolution")) {
            data.put("end_resolution", payload.get("endResolution"));
            data.put("end_nearest_node_distance", payload.get("endNearestNodeDistance"));
        }
        if (payload.containsKey("detailed_path")) {
            data.put("detailed_path", payload.get("detailed_path"));
        }
        data.put("detailed_info", detailedInfo);
        data.put("message", "路径规划完成");
        return data;
    }

    private Map<String, Object> success(Object data) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("data", data);
        response.put("message", "success");
        return response;
    }

    private Map<String, Object> fail(String message) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", false);
        response.put("message", message);
        response.put("data", null);
        return response;
    }

    private String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private Double doubleValue(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }
}
