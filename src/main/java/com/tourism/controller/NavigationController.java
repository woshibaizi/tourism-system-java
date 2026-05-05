package com.tourism.controller;

import com.tourism.algorithm.IndoorNavigationAlgorithm;
import com.tourism.algorithm.ShortestPathAlgorithm;
import com.tourism.service.AmapNavigationService;
import com.tourism.service.OutdoorRouteService;
import com.tourism.utils.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 路径导航 API
 * 提供户外最短路径规划（A*、TSP）和室内导航功能
 */
@Tag(name = "NavigationController", description = "路径导航与规划")
@RestController
@RequestMapping("/api/navigation")
public class NavigationController {

    @Autowired
    private ShortestPathAlgorithm shortestPathAlgorithm;

    @Autowired
    private IndoorNavigationAlgorithm indoorNavigationAlgorithm;

    @Autowired
    private OutdoorRouteService outdoorRouteService;

    // ==================== 户外路径规划 ====================

    @Autowired
    private AmapNavigationService amapNavigationService;

    @Operation(summary = "获取高德地图前端配置")
    @GetMapping("/providers/amap/config")
    public Result<?> amapProviderConfig() {
        return Result.success(amapNavigationService.getFrontendConfig());
    }

    /**
     * 单目标最短路径（A* 算法）
     */
    @Operation(summary = "单目标最短路径规划（A*）")
    @PostMapping("/shortest-path")
    public Result<?> shortestPath(@RequestBody Map<String, Object> request) {
        String start = (String) request.get("start");
        String end = (String) request.get("end");
        Double startLat = doubleValue(request.get("startLat"));
        Double startLng = doubleValue(request.get("startLng"));
        Double endLat = doubleValue(request.get("endLat"));
        Double endLng = doubleValue(request.get("endLng"));
        String vehicle = (String) request.getOrDefault("vehicle", "步行");
        String strategy = (String) request.getOrDefault("strategy", "time");
        String placeType = (String) request.getOrDefault("placeType", "景区");
        String provider = (String) request.get("provider");

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
            return Result.fail(plannedRoute.message());
        }
        return Result.success(plannedRoute.payload());
    }

    /**
     * 混合交通工具最优时间路径
     */
    @Operation(summary = "混合交通工具最优路径（最短时间）")
    @PostMapping("/mixed-vehicle-path")
    public Result<?> mixedVehiclePath(@RequestBody Map<String, Object> request) {
        String start = (String) request.get("start");
        String end = (String) request.get("end");
        String placeType = (String) request.getOrDefault("placeType", "景区");

        if (start == null || end == null) {
            return Result.fail("起点(start)和终点(end)不能为空");
        }

        Map<String, Object> data = outdoorRouteService.buildMixedVehicleRoute(start, end, placeType);
        if (data.isEmpty()) {
            return Result.fail("从 [" + start + "] 到 [" + end + "] 无法到达（混合交通）");
        }
        return Result.success(data);
    }

    /**
     * 多目标路径规划（TSP）
     */
    @Operation(summary = "多目标 TSP 路径规划")
    @PostMapping("/multi-destination")
    public Result<?> multiDestination(@RequestBody Map<String, Object> request) {
        String start = (String) request.get("start");
        @SuppressWarnings("unchecked")
        List<String> destinations = (List<String>) request.get("destinations");
        String algorithm = (String) request.getOrDefault("algorithm", "nearest_neighbor");

        if (start == null || destinations == null || destinations.isEmpty()) {
            return Result.fail("起点(start)和目标点列表(destinations)不能为空");
        }

        String[] validAlgorithms = {"nearest_neighbor", "dynamic_programming",
                "simulated_annealing", "genetic_algorithm"};
        boolean validAlgo = false;
        for (String va : validAlgorithms) {
            if (va.equals(algorithm)) { validAlgo = true; break; }
        }
        if (!validAlgo) {
            return Result.fail("algorithm参数无效，支持: nearest_neighbor / dynamic_programming / simulated_annealing / genetic_algorithm");
        }

        ShortestPathAlgorithm.RouteResult result =
                shortestPathAlgorithm.multiDestinationRoute(start, destinations, algorithm);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("path", result.getPath());
        data.put("targetPath", result.getTargetPath());
        data.put("totalDistance", result.getTotalDistance());
        data.put("totalTime", result.getSegments().stream().mapToDouble(ShortestPathAlgorithm.RouteSegment::getTime).sum());
        data.put("algorithm", result.getAlgorithm());
        data.put("vehicle", result.getVehicle());
        data.put("strategy", result.getStrategy());
        data.put("unreachableDestinations", result.getUnreachableDestinations());
        data.put("segments", result.getSegments());
        data.put("nodeCoordinates", shortestPathAlgorithm.getNodeCoordinates(result.getPath()));
        return Result.success(outdoorRouteService.attachLocalMetadata(data, "multi_destination_tsp"));
    }

    @Operation(summary = "根据经纬度查找最近图节点")
    @PostMapping("/nearest-node")
    public Result<?> nearestNode(@RequestBody Map<String, Object> request) {
        Double lat = doubleValue(request.get("lat"));
        Double lng = doubleValue(request.get("lng"));
        if (lat == null || lng == null) {
            return Result.fail("经纬度(lat/lng)不能为空");
        }
        ShortestPathAlgorithm.NearestNodeResult nearestNode = shortestPathAlgorithm.findNearestNode(lat, lng);
        if (nearestNode == null) {
            return Result.fail("当前路图没有可用节点");
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("nodeId", nearestNode.getNodeId());
        data.put("distance", nearestNode.getDistance());
        data.put("coordinate", nearestNode.getCoordinate());
        data.put("provider", "local");
        data.put("source", "nearest_graph_node");
        return Result.success(data);
    }

    /**
     * 重新加载路图（管理接口，数据更新后调用）
     */
    @Operation(summary = "重新加载路图（管理接口）")
    @PostMapping("/reload-graph")
    public Result<?> reloadGraph() {
        shortestPathAlgorithm.reload();
        return Result.success("路图已重新加载，当前节点数: " + shortestPathAlgorithm.getNodeCount());
    }

    // ==================== 室内导航 ====================

    /**
     * 室内导航：从大门到指定房间
     */
    @Operation(summary = "室内导航：从大门导航到指定房间")
    @PostMapping("/indoor")
    public Result<?> indoorNavigate(@RequestBody Map<String, Object> request) {
        String roomId = (String) request.get("roomId");
        boolean avoidCongestion = Boolean.TRUE.equals(request.getOrDefault("avoidCongestion", true));
        boolean useTimeWeight = Boolean.TRUE.equals(request.getOrDefault("useTimeWeight", true));

        if (roomId == null || roomId.isEmpty()) {
            return Result.fail("房间ID(roomId)不能为空");
        }
        if (!indoorNavigationAlgorithm.isLoaded()) {
            return Result.fail("室内导航数据未加载，请检查资源文件");
        }

        IndoorNavigationAlgorithm.NavigationResult result =
                indoorNavigationAlgorithm.navigateToRoom(roomId, avoidCongestion, useTimeWeight);

        if (!result.isSuccess()) {
            return Result.fail(result.getMessage());
        }
        return Result.success(Map.of(
                "destination", result.getDestination(),
                "path", result.getPath(),
                "navigationSteps", result.getNavigationSteps(),
                "totalDistance", result.getTotalDistance(),
                "estimatedTimeMinutes", result.getEstimatedTime(),
                "floorAnalysis", result.getFloorAnalysis(),
                "optimizationTarget", result.getOptimizationTarget()
        ));
    }

    /**
     * 获取所有可导航房间列表
     */
    @Operation(summary = "获取所有室内房间列表")
    @GetMapping("/indoor/rooms")
    public Result<?> getAllRooms() {
        return Result.success(indoorNavigationAlgorithm.getAllRooms());
    }

    /**
     * 获取指定楼层房间列表
     */
    @Operation(summary = "获取指定楼层的房间列表")
    @GetMapping("/indoor/rooms/floor/{floor}")
    public Result<?> getFloorRooms(@PathVariable int floor) {
        return Result.success(indoorNavigationAlgorithm.getFloorRooms(floor));
    }

    /**
     * 获取建筑物基本信息
     */
    @Operation(summary = "获取室内建筑物信息")
    @GetMapping("/indoor/building-info")
    public Result<?> getBuildingInfo() {
        return Result.success(Map.of(
                "buildingInfo", indoorNavigationAlgorithm.getBuildingInfo(),
                "nodeCount", indoorNavigationAlgorithm.getNodeCount(),
                "loaded", indoorNavigationAlgorithm.isLoaded()
        ));
    }

    private List<String> buildPathFromSegments(List<ShortestPathAlgorithm.RouteSegment> segments) {
        if (segments == null || segments.isEmpty()) {
            return List.of();
        }
        List<String> path = new java.util.ArrayList<>();
        path.add(segments.get(0).getFrom());
        for (ShortestPathAlgorithm.RouteSegment segment : segments) {
            path.add(segment.getTo());
        }
        return path;
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
