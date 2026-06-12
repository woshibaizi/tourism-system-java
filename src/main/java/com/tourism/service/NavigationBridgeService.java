package com.tourism.service;

import com.tourism.algorithm.IndoorNavigationAlgorithm;
import com.tourism.algorithm.ShortestPathAlgorithm;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * 室内外导航衔接服务
 * 处理室内→室外→室内的跨场景导航
 */
@Service
public class NavigationBridgeService {

    private final IndoorNavigationAlgorithm indoorNav;
    private final ShortestPathAlgorithm shortestPath;
    private final OutdoorRouteService outdoorRoute;

    public NavigationBridgeService(IndoorNavigationAlgorithm indoorNav,
                                    ShortestPathAlgorithm shortestPath,
                                    OutdoorRouteService outdoorRoute) {
        this.indoorNav = indoorNav;
        this.shortestPath = shortestPath;
        this.outdoorRoute = outdoorRoute;
    }

    /**
     * 获取室内建筑的室外入口节点ID
     */
    public String getOutdoorNodeId() {
        Map<String, Object> info = indoorNav.getBuildingInfo();
        String outdoorNodeId = (String) info.get("outdoorNodeId");
        if (outdoorNodeId != null && !outdoorNodeId.isBlank() && shortestPath.containsNode(outdoorNodeId)) {
            return outdoorNodeId;
        }
        return null;
    }

    /**
     * 室内房间 → 室外目的地
     */
    public Map<String, Object> indoorToOutdoor(String roomId, boolean avoidCongestion, boolean useTimeWeight,
                                                String outdoorDest, Double destLat, Double destLng,
                                                String vehicle, String strategy, String placeType) {
        if (!indoorNav.isLoaded()) return Collections.emptyMap();

        String buildingEntrance = getOutdoorNodeId();
        if (buildingEntrance == null) return Collections.emptyMap();

        // 室内段：房间 → 建筑入口
        IndoorNavigationAlgorithm.NavigationResult indoorResult =
                indoorNav.navigate(roomId, "entrance", avoidCongestion, useTimeWeight);
        if (!indoorResult.isSuccess()) return Collections.emptyMap();

        // 室外段：建筑入口 → 目的地
        OutdoorRouteService.PlannedRoute outdoorResult =
                outdoorRoute.planSingleRoute(buildingEntrance, outdoorDest,
                        null, null, destLat, destLng,
                        vehicle, strategy, placeType, null);

        if (!outdoorResult.success()) return Collections.emptyMap();

        Map<String, Object> outdoorPayload = outdoorResult.payload();
        return mergeIndoorOutdoor(indoorResult, outdoorPayload, "indoor_to_outdoor");
    }

    /**
     * 室外起点 → 室内房间
     */
    public Map<String, Object> outdoorToIndoor(String outdoorStart, Double startLat, Double startLng,
                                                String roomId, boolean avoidCongestion, boolean useTimeWeight,
                                                String vehicle, String strategy, String placeType) {
        if (!indoorNav.isLoaded()) return Collections.emptyMap();

        String buildingEntrance = getOutdoorNodeId();
        if (buildingEntrance == null) return Collections.emptyMap();

        // 室外段：起点 → 建筑入口
        OutdoorRouteService.PlannedRoute outdoorResult =
                outdoorRoute.planSingleRoute(outdoorStart, buildingEntrance,
                        startLat, startLng, null, null,
                        vehicle, strategy, placeType, null);
        if (!outdoorResult.success()) return Collections.emptyMap();

        // 室内段：入口 → 房间
        IndoorNavigationAlgorithm.NavigationResult indoorResult =
                indoorNav.navigate("entrance", roomId, avoidCongestion, useTimeWeight);
        if (!indoorResult.isSuccess()) return Collections.emptyMap();

        Map<String, Object> outdoorPayload = outdoorResult.payload();
        return mergeIndoorOutdoor(indoorResult, outdoorPayload, "outdoor_to_indoor");
    }

    /**
     * 室内房间 → 室内房间（可能跨建筑，经过室外）
     */
    public Map<String, Object> indoorRoomToIndoorRoom(String fromRoom, String toRoom,
                                                       boolean avoidCongestion, boolean useTimeWeight) {
        if (!indoorNav.isLoaded()) return Collections.emptyMap();

        // 先尝试纯室内路径（同一建筑）
        IndoorNavigationAlgorithm.NavigationResult directResult =
                indoorNav.navigate(fromRoom, toRoom, avoidCongestion, useTimeWeight);
        if (directResult.isSuccess()) {
            // 纯室内可达
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("fullPath", directResult.getPath());
            result.put("navigationSteps", directResult.getNavigationSteps());
            result.put("totalDistance", directResult.getTotalDistance());
            result.put("estimatedTimeMinutes", directResult.getEstimatedTime());
            result.put("floorAnalysis", directResult.getFloorAnalysis());
            result.put("type", "indoor_only");
            return result;
        }

        // 不可直达则通过室外衔接
        String buildingEntrance = getOutdoorNodeId();
        if (buildingEntrance == null) return Collections.emptyMap();

        // 房间A → 入口 → (室外) → 入口 → 房间B
        // 简化处理：from → entrance → outdoor → entrance → to
        IndoorNavigationAlgorithm.NavigationResult indoor1 =
                indoorNav.navigate(fromRoom, "entrance", avoidCongestion, useTimeWeight);
        IndoorNavigationAlgorithm.NavigationResult indoor2 =
                indoorNav.navigate("entrance", toRoom, avoidCongestion, useTimeWeight);

        if (!indoor1.isSuccess() || !indoor2.isSuccess()) return Collections.emptyMap();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("type", "indoor_outdoor_indoor");
        result.put("outdoorNeeded", true);

        List<String> fullPath = new ArrayList<>(indoor1.getPath());
        if (!indoor2.getPath().isEmpty()) {
            fullPath.addAll(indoor2.getPath().subList(1, indoor2.getPath().size()));
        }
        result.put("fullPath", fullPath);

        result.put("indoorSegment1", buildIndoorSegmentMap(indoor1));
        result.put("indoorSegment2", buildIndoorSegmentMap(indoor2));

        double totalDist = indoor1.getTotalDistance() + indoor2.getTotalDistance();
        double totalTime = indoor1.getEstimatedTime() + indoor2.getEstimatedTime();
        result.put("totalDistance", totalDist);
        result.put("estimatedTimeMinutes", totalTime);

        return result;
    }

    private Map<String, Object> mergeIndoorOutdoor(IndoorNavigationAlgorithm.NavigationResult indoor,
                                                    Map<String, Object> outdoorPayload,
                                                    String type) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("type", type);

        // 室内分段
        result.put("indoorSegment", buildIndoorSegmentMap(indoor));

        // 室外分段
        result.put("outdoorSegment", outdoorPayload);

        // 合并路径
        @SuppressWarnings("unchecked")
        List<String> outdoorPath = (List<String>) outdoorPayload.get("path");
        List<String> fullPath = new ArrayList<>(indoor.getPath());
        if (outdoorPath != null && outdoorPath.size() > 1) {
            fullPath.addAll(outdoorPath.subList(1, outdoorPath.size()));
        }
        result.put("fullPath", fullPath);

        // 汇总
        double outdoorDist = ((Number) outdoorPayload.getOrDefault("totalDistance", 0)).doubleValue();
        double outdoorTime = ((Number) outdoorPayload.getOrDefault("totalTime", 0)).doubleValue();
        result.put("totalDistance", indoor.getTotalDistance() + outdoorDist);
        result.put("totalTimeMinutes", indoor.getEstimatedTime() + outdoorTime);

        return result;
    }

    private Map<String, Object> buildIndoorSegmentMap(IndoorNavigationAlgorithm.NavigationResult result) {
        Map<String, Object> seg = new LinkedHashMap<>();
        seg.put("destination", result.getDestination());
        seg.put("path", result.getPath());
        seg.put("navigationSteps", result.getNavigationSteps());
        seg.put("totalDistance", result.getTotalDistance());
        seg.put("estimatedTimeMinutes", result.getEstimatedTime());
        seg.put("floorAnalysis", result.getFloorAnalysis());
        return seg;
    }
}
