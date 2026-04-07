package com.tourism.controller;

import com.tourism.algorithm.IndoorNavigationAlgorithm;
import com.tourism.algorithm.ShortestPathAlgorithm;
import com.tourism.utils.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
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

    // ==================== 户外路径规划 ====================

    /**
     * 单目标最短路径（A* 算法）
     */
    @Operation(summary = "单目标最短路径规划（A*）")
    @PostMapping("/shortest-path")
    public Result<?> shortestPath(@RequestBody Map<String, Object> request) {
        String start = (String) request.get("start");
        String end = (String) request.get("end");
        String vehicle = (String) request.getOrDefault("vehicle", "步行");
        String strategy = (String) request.getOrDefault("strategy", "time");

        if (start == null || end == null) {
            return Result.fail("起点(start)和终点(end)不能为空");
        }
        if (!shortestPathAlgorithm.containsNode(start)) {
            return Result.fail("起点节点 [" + start + "] 不存在");
        }
        if (!shortestPathAlgorithm.containsNode(end)) {
            return Result.fail("终点节点 [" + end + "] 不存在");
        }

        ShortestPathAlgorithm.PathResult result;
        if ("distance".equals(strategy)) {
            result = shortestPathAlgorithm.dijkstraDistanceOnly(start, end);
        } else {
            result = shortestPathAlgorithm.astar(start, end, vehicle);
        }

        if (!result.isReachable()) {
            return Result.fail("从 [" + start + "] 到 [" + end + "] 无法到达");
        }

        return Result.success(Map.of(
                "path", result.getPath(),
                "cost", result.getCost(),
                "nodeCount", result.getPath().size(),
                "vehicle", vehicle,
                "strategy", strategy
        ));
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

        List<ShortestPathAlgorithm.RouteSegment> segments =
                shortestPathAlgorithm.dijkstraWithMixedVehicles(start, end, placeType);

        if (segments.isEmpty()) {
            return Result.fail("从 [" + start + "] 到 [" + end + "] 无法到达（混合交通）");
        }

        double totalTime = segments.stream().mapToDouble(ShortestPathAlgorithm.RouteSegment::getTime).sum();
        double totalDistance = segments.stream().mapToDouble(ShortestPathAlgorithm.RouteSegment::getDistance).sum();

        return Result.success(Map.of(
                "segments", segments,
                "totalTime", totalTime,
                "totalDistance", totalDistance,
                "placeType", placeType
        ));
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

        return Result.success(Map.of(
                "path", result.getPath(),
                "targetPath", result.getTargetPath(),
                "totalDistance", result.getTotalDistance(),
                "algorithm", result.getAlgorithm(),
                "unreachableDestinations", result.getUnreachableDestinations(),
                "segments", result.getSegments()
        ));
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
}
