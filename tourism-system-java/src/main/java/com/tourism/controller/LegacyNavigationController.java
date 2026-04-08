package com.tourism.controller;

import com.tourism.algorithm.IndoorNavigationAlgorithm;
import com.tourism.algorithm.ShortestPathAlgorithm;
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

    public LegacyNavigationController(ShortestPathAlgorithm shortestPathAlgorithm,
                                      IndoorNavigationAlgorithm indoorNavigationAlgorithm) {
        this.shortestPathAlgorithm = shortestPathAlgorithm;
        this.indoorNavigationAlgorithm = indoorNavigationAlgorithm;
    }

    @PostMapping("/routes/single")
    public Map<String, Object> planSingleRoute(@RequestBody Map<String, Object> request) {
        String start = stringValue(request.get("start"));
        String end = stringValue(request.get("end"));
        String strategy = stringValue(request.getOrDefault("strategy", "distance"));
        String vehicle = stringValue(request.get("vehicle"));
        String placeType = stringValue(request.getOrDefault("placeType", "景区"));
        boolean useMixedVehicles = Boolean.TRUE.equals(request.get("useMixedVehicles"));

        if (start == null || end == null) {
            return fail("起点和终点不能为空");
        }

        if ("time".equals(strategy) && (useMixedVehicles || vehicle == null || vehicle.isBlank())) {
            List<ShortestPathAlgorithm.RouteSegment> segments =
                    shortestPathAlgorithm.dijkstraWithMixedVehicles(start, end, placeType);
            if (segments.isEmpty()) {
                return fail("无法找到有效路径");
            }

            double totalDistance = segments.stream().mapToDouble(ShortestPathAlgorithm.RouteSegment::getDistance).sum();
            double totalTime = segments.stream().mapToDouble(ShortestPathAlgorithm.RouteSegment::getTime).sum();
            List<String> path = new java.util.ArrayList<>();
            path.add(start);
            for (ShortestPathAlgorithm.RouteSegment segment : segments) {
                path.add(segment.getTo());
            }

            Map<String, Object> detailedInfo = new LinkedHashMap<>();
            detailedInfo.put("path", path);
            detailedInfo.put("total_distance", totalDistance);
            detailedInfo.put("total_time", totalTime);
            detailedInfo.put("strategy", "time");
            detailedInfo.put("vehicle", "混合");
            detailedInfo.put("segments", segments);

            Map<String, Object> data = new LinkedHashMap<>();
            data.put("path", path);
            data.put("total_distance", totalDistance);
            data.put("total_time", totalTime);
            data.put("strategy", "time");
            data.put("vehicle", "混合");
            data.put("available_vehicles", shortestPathAlgorithm.getAvailableVehicles(placeType));
            data.put("detailed_info", detailedInfo);
            data.put("message", "路径规划完成");
            return success(data);
        }

        String normalizedVehicle = vehicle == null || vehicle.isBlank() ? "步行" : vehicle;
        ShortestPathAlgorithm.PathResult result;
        if ("distance".equals(strategy)) {
            result = shortestPathAlgorithm.dijkstraDistanceOnly(start, end);
        } else {
            result = shortestPathAlgorithm.astar(start, end, normalizedVehicle);
        }

        if (!result.isReachable()) {
            return fail("无法找到有效路径");
        }

        double totalDistance = shortestPathAlgorithm.calculatePathDistance(result.getPath());
        Double totalTime = "time".equals(strategy) ? result.getCost() : null;
        List<ShortestPathAlgorithm.RouteSegment> segments =
                "time".equals(strategy) ? shortestPathAlgorithm.buildPathSegments(result.getPath(), normalizedVehicle) : List.of();

        Map<String, Object> detailedInfo = new LinkedHashMap<>();
        detailedInfo.put("path", result.getPath());
        detailedInfo.put("total_distance", totalDistance);
        detailedInfo.put("total_time", totalTime);
        detailedInfo.put("strategy", strategy);
        detailedInfo.put("vehicle", "distance".equals(strategy) ? "不限" : normalizedVehicle);
        detailedInfo.put("segments", segments);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("path", result.getPath());
        data.put("total_distance", totalDistance);
        data.put("total_time", totalTime);
        data.put("strategy", strategy);
        data.put("vehicle", "distance".equals(strategy) ? "不限" : normalizedVehicle);
        data.put("available_vehicles", shortestPathAlgorithm.getAvailableVehicles(placeType));
        data.put("detailed_info", detailedInfo);
        data.put("message", "路径规划完成");
        return success(data);
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

    private String buildPathDescription(IndoorNavigationAlgorithm.NavigationResult result) {
        return "从大门出发，经过 " + Math.max(result.getPath().size() - 2, 0)
                + " 个关键节点，到达 " + result.getDestination().get("name")
                + "，预计 " + result.getEstimatedTime() + " 分钟。";
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
}
