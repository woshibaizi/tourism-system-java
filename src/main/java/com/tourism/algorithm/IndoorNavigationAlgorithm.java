package com.tourism.algorithm;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.io.InputStream;
import java.util.*;

/**
 * 室内导航算法（方案B：启动时加载JSON到内存图）
 * 支持基于时间权重/距离权重的Dijkstra，考虑楼层切换（电梯/楼梯）时间
 */
@Component
public class IndoorNavigationAlgorithm {

    private static final String DATA_FILE = "data/indoor_navigation.json";

    // ==================== 结果类 ====================

    public static class NavigationStep {
        private final int step;
        private final String from;
        private final String to;
        private final double distance;
        private final String description;
        private final boolean floorChange;
        private final String action;

        public NavigationStep(int step, String from, String to, double distance,
                              String description, boolean floorChange, String action) {
            this.step = step;
            this.from = from;
            this.to = to;
            this.distance = distance;
            this.description = description;
            this.floorChange = floorChange;
            this.action = action;
        }

        public int getStep() { return step; }
        public String getFrom() { return from; }
        public String getTo() { return to; }
        public double getDistance() { return distance; }
        public String getDescription() { return description; }
        public boolean isFloorChange() { return floorChange; }
        public String getAction() { return action; }
    }

    public static class FloorAnalysis {
        private final int totalFloorChanges;
        private final int elevatorChanges;
        private final int stairChanges;
        private final List<Integer> floorsVisited;

        public FloorAnalysis(int totalFloorChanges, int elevatorChanges,
                             int stairChanges, List<Integer> floorsVisited) {
            this.totalFloorChanges = totalFloorChanges;
            this.elevatorChanges = elevatorChanges;
            this.stairChanges = stairChanges;
            this.floorsVisited = floorsVisited;
        }

        public int getTotalFloorChanges() { return totalFloorChanges; }
        public int getElevatorChanges() { return elevatorChanges; }
        public int getStairChanges() { return stairChanges; }
        public List<Integer> getFloorsVisited() { return floorsVisited; }
    }

    public static class NavigationResult {
        private final boolean success;
        private final String message;
        private final Map<String, Object> destination;
        private final List<String> path;
        private final List<NavigationStep> navigationSteps;
        private final double totalDistance;
        private final double estimatedTime;
        private final FloorAnalysis floorAnalysis;
        private final String optimizationTarget;

        private NavigationResult(boolean success, String message) {
            this.success = success;
            this.message = message;
            this.destination = null;
            this.path = Collections.emptyList();
            this.navigationSteps = Collections.emptyList();
            this.totalDistance = 0;
            this.estimatedTime = 0;
            this.floorAnalysis = null;
            this.optimizationTarget = null;
        }

        private NavigationResult(Map<String, Object> destination, List<String> path,
                                  List<NavigationStep> steps, double totalDistance,
                                  double estimatedTime, FloorAnalysis floorAnalysis,
                                  String optimizationTarget) {
            this.success = true;
            this.message = "导航成功";
            this.destination = destination;
            this.path = path;
            this.navigationSteps = steps;
            this.totalDistance = totalDistance;
            this.estimatedTime = estimatedTime;
            this.floorAnalysis = floorAnalysis;
            this.optimizationTarget = optimizationTarget;
        }

        public static NavigationResult fail(String message) { return new NavigationResult(false, message); }
        public static NavigationResult success(Map<String, Object> destination, List<String> path,
                                               List<NavigationStep> steps, double totalDistance,
                                               double estimatedTime, FloorAnalysis floorAnalysis,
                                               String optimizationTarget) {
            return new NavigationResult(destination, path, steps, totalDistance, estimatedTime, floorAnalysis, optimizationTarget);
        }

        public boolean isSuccess() { return success; }
        public String getMessage() { return message; }
        public Map<String, Object> getDestination() { return destination; }
        public List<String> getPath() { return path; }
        public List<NavigationStep> getNavigationSteps() { return navigationSteps; }
        public double getTotalDistance() { return totalDistance; }
        public double getEstimatedTime() { return estimatedTime; }
        public FloorAnalysis getFloorAnalysis() { return floorAnalysis; }
        public String getOptimizationTarget() { return optimizationTarget; }
    }

    public static class MultiRoomSegment {
        private final String fromRoomId;
        private final String fromRoomName;
        private final String toRoomId;
        private final String toRoomName;
        private final List<String> path;
        private final List<NavigationStep> steps;
        private final double distance;
        private final double estimatedTime;
        private final FloorAnalysis floorAnalysis;

        public MultiRoomSegment(String fromRoomId, String fromRoomName, String toRoomId, String toRoomName,
                                List<String> path, List<NavigationStep> steps, double distance,
                                double estimatedTime, FloorAnalysis floorAnalysis) {
            this.fromRoomId = fromRoomId;
            this.fromRoomName = fromRoomName;
            this.toRoomId = toRoomId;
            this.toRoomName = toRoomName;
            this.path = path;
            this.steps = steps;
            this.distance = distance;
            this.estimatedTime = estimatedTime;
            this.floorAnalysis = floorAnalysis;
        }

        public String getFromRoomId() { return fromRoomId; }
        public String getFromRoomName() { return fromRoomName; }
        public String getToRoomId() { return toRoomId; }
        public String getToRoomName() { return toRoomName; }
        public List<String> getPath() { return path; }
        public List<NavigationStep> getSteps() { return steps; }
        public double getDistance() { return distance; }
        public double getEstimatedTime() { return estimatedTime; }
        public FloorAnalysis getFloorAnalysis() { return floorAnalysis; }
    }

    public static class MultiRoomNavigationResult {
        private final boolean success;
        private final String message;
        private final List<String> fullPath;
        private final List<NavigationStep> mergedSteps;
        private final List<MultiRoomSegment> segments;
        private final double totalDistance;
        private final double totalEstimatedTime;
        private final FloorAnalysis totalFloorAnalysis;
        private final String optimizationTarget;
        private final List<Map<String, Object>> roomsVisited;

        private MultiRoomNavigationResult(boolean success, String message) {
            this.success = success;
            this.message = message;
            this.fullPath = Collections.emptyList();
            this.mergedSteps = Collections.emptyList();
            this.segments = Collections.emptyList();
            this.totalDistance = 0;
            this.totalEstimatedTime = 0;
            this.totalFloorAnalysis = null;
            this.optimizationTarget = null;
            this.roomsVisited = Collections.emptyList();
        }

        private MultiRoomNavigationResult(List<String> fullPath, List<NavigationStep> mergedSteps,
                                          List<MultiRoomSegment> segments, double totalDistance,
                                          double totalEstimatedTime, FloorAnalysis totalFloorAnalysis,
                                          String optimizationTarget, List<Map<String, Object>> roomsVisited) {
            this.success = true;
            this.message = "多房间导航成功";
            this.fullPath = fullPath;
            this.mergedSteps = mergedSteps;
            this.segments = segments;
            this.totalDistance = totalDistance;
            this.totalEstimatedTime = totalEstimatedTime;
            this.totalFloorAnalysis = totalFloorAnalysis;
            this.optimizationTarget = optimizationTarget;
            this.roomsVisited = roomsVisited;
        }

        public static MultiRoomNavigationResult fail(String message) { return new MultiRoomNavigationResult(false, message); }
        public boolean isSuccess() { return success; }
        public String getMessage() { return message; }
        public List<String> getFullPath() { return fullPath; }
        public List<NavigationStep> getMergedSteps() { return mergedSteps; }
        public List<MultiRoomSegment> getSegments() { return segments; }
        public double getTotalDistance() { return totalDistance; }
        public double getTotalEstimatedTime() { return totalEstimatedTime; }
        public FloorAnalysis getTotalFloorAnalysis() { return totalFloorAnalysis; }
        public String getOptimizationTarget() { return optimizationTarget; }
        public List<Map<String, Object>> getRoomsVisited() { return roomsVisited; }
    }

    // ==================== 内部节点/边 ====================

    private static class IndoorNode {
        final String id;
        final String name;
        final int floor;
        final String type; // entrance / elevator / stair / corridor / room
        final String description;

        IndoorNode(String id, String name, int floor, String type, String description) {
            this.id = id;
            this.name = name;
            this.floor = floor;
            this.type = type;
            this.description = description;
        }
    }

    private static class EdgeInfo {
        final double distance;
        final double weight;      // 距离权重（考虑拥挤度）
        final double timeWeight;  // 时间权重（考虑拥挤度+楼层切换）
        final double congestionFactor;
        final String description;

        EdgeInfo(double distance, double weight, double timeWeight,
                 double congestionFactor, String description) {
            this.distance = distance;
            this.weight = weight;
            this.timeWeight = timeWeight;
            this.congestionFactor = congestionFactor;
            this.description = description;
        }
    }

    // ==================== 属性 ====================

    private Map<String, IndoorNode> nodes = new HashMap<>();
    private Map<String, Map<String, EdgeInfo>> graph = new HashMap<>();
    private Map<String, Object> buildingInfo = new HashMap<>();
    private boolean loaded = false;

    // ==================== 初始化 ====================

    @PostConstruct
    public void init() {
        try {
            ClassPathResource resource = new ClassPathResource(DATA_FILE);
            try (InputStream is = resource.getInputStream()) {
                loadData(is);
            }
        } catch (Exception e) {
            System.err.println("[IndoorNavigationAlgorithm] 加载室内导航数据失败: " + e.getMessage());
        }
    }

    public void loadData(InputStream is) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        JsonNode root = mapper.readTree(is);

        // 加载建筑信息
        JsonNode buildingNode = root.get("building");
        if (buildingNode != null) {
            buildingInfo.put("id", buildingNode.path("id").asText());
            buildingInfo.put("name", buildingNode.path("name").asText());
            buildingInfo.put("floors", buildingNode.path("floors").asInt());
            buildingInfo.put("description", buildingNode.path("description").asText());
            buildingInfo.put("outdoorNodeId", buildingNode.path("outdoorNodeId").asText());
        }

        // 加载节点
        nodes.clear();
        JsonNode nodesArr = root.get("nodes");
        if (nodesArr != null) {
            for (JsonNode n : nodesArr) {
                String id = n.path("id").asText();
                nodes.put(id, new IndoorNode(
                        id,
                        n.path("name").asText(),
                        n.path("floor").asInt(),
                        n.path("type").asText(),
                        n.path("description").asText("")
                ));
                graph.put(id, new HashMap<>());
            }
        }

        // 加载连接（构建双向图）
        JsonNode connections = root.get("connections");
        if (connections != null) {
            for (JsonNode conn : connections) {
                String from = conn.path("from").asText();
                String to = conn.path("to").asText();
                double distance = conn.path("distance").asDouble();
                double congestion = conn.path("congestion_factor").asDouble(1.0);
                String desc = conn.path("description").asText("");

                EdgeInfo edge = buildEdgeInfo(from, to, distance, congestion, desc);
                graph.computeIfAbsent(from, k -> new HashMap<>()).put(to, edge);
                graph.computeIfAbsent(to, k -> new HashMap<>()).put(from, edge);
            }
        }

        loaded = true;
        System.out.println("[IndoorNavigationAlgorithm] 加载成功: " + nodes.size() + " 个节点");
    }

    private EdgeInfo buildEdgeInfo(String fromId, String toId, double distance,
                                    double congestion, String desc) {
        IndoorNode fromNode = nodes.get(fromId);
        IndoorNode toNode = nodes.get(toId);

        // 基础步行时间（秒）: 60m/min = 1m/s
        double walkingTime = distance; // distance(m) / 1(m/s) = seconds

        double timeWeight = walkingTime;

        if (fromNode != null && toNode != null && fromNode.floor != toNode.floor) {
            int floorDiff = Math.abs(toNode.floor - fromNode.floor);
            double floorChangeTime;
            if ("elevator".equals(fromNode.type) && "elevator".equals(toNode.type)) {
                floorChangeTime = 60 + 15.0 * floorDiff; // 等候+运行
            } else {
                // 楼梯
                floorChangeTime = floorDiff == 1 ? 30 : 45 + 15.0 * floorDiff;
            }
            timeWeight = floorChangeTime * congestion;
        } else {
            timeWeight = walkingTime * congestion;
        }

        double distanceWeight = distance * congestion;
        return new EdgeInfo(distance, distanceWeight, timeWeight, congestion, desc);
    }

    // ==================== Dijkstra ====================

    /**
     * Dijkstra最短路径（支持时间权重/距离权重 + 拥挤度避让）
     */
    public List<String> dijkstra(String start, String end,
                                  boolean avoidCongestion, boolean useTimeWeight) {
        if (!nodes.containsKey(start) || !nodes.containsKey(end)) return Collections.emptyList();

        Map<String, Double> distances = new HashMap<>();
        Map<String, String> previous = new HashMap<>();
        for (String id : nodes.keySet()) distances.put(id, Double.MAX_VALUE);
        distances.put(start, 0.0);

        PriorityQueue<Object[]> pq = new PriorityQueue<>(Comparator.comparingDouble(a -> (double) a[0]));
        pq.offer(new Object[]{0.0, start});
        Set<String> visited = new HashSet<>();

        while (!pq.isEmpty()) {
            Object[] curr = pq.poll();
            String node = (String) curr[1];
            if (visited.contains(node)) continue;
            visited.add(node);
            if (node.equals(end)) break;

            for (Map.Entry<String, EdgeInfo> entry : graph.getOrDefault(node, Collections.emptyMap()).entrySet()) {
                String neighbor = entry.getKey();
                if (visited.contains(neighbor)) continue;
                EdgeInfo edge = entry.getValue();

                double w;
                if (useTimeWeight) {
                    w = avoidCongestion ? edge.timeWeight : edge.timeWeight / edge.congestionFactor;
                } else {
                    w = avoidCongestion ? edge.weight : edge.distance;
                }

                double newDist = distances.get(node) + w;
                if (newDist < distances.get(neighbor)) {
                    distances.put(neighbor, newDist);
                    previous.put(neighbor, node);
                    pq.offer(new Object[]{newDist, neighbor});
                }
            }
        }

        // 重构路径
        if (!previous.containsKey(end) && !start.equals(end)) return Collections.emptyList();
        List<String> path = new ArrayList<>();
        String cur = end;
        while (cur != null) {
            path.add(cur);
            cur = previous.get(cur);
        }
        Collections.reverse(path);
        return path;
    }

    // ==================== 导航到房间 ====================

    /**
     * 从大门（entrance）导航到指定房间
     */
    public NavigationResult navigateToRoom(String roomId, boolean avoidCongestion, boolean useTimeWeight) {
        if (!nodes.containsKey(roomId)) {
            return NavigationResult.fail("房间 " + roomId + " 不存在");
        }
        IndoorNode room = nodes.get(roomId);
        if (!"room".equals(room.type)) {
            return NavigationResult.fail(roomId + " 不是一个房间");
        }

        List<String> path = dijkstra("entrance", roomId, avoidCongestion, useTimeWeight);
        if (path.isEmpty()) {
            return NavigationResult.fail("无法找到到达 " + room.name + " 的路径");
        }

        List<NavigationStep> steps = generateNavigationSteps(path);
        double actualDistance = calculateActualDistance(path);
        double estimatedTime = estimateTimeWithFloorChanges(path);
        FloorAnalysis floorAnalysis = analyzeFloorChanges(path);

        Map<String, Object> destination = new LinkedHashMap<>();
        destination.put("id", room.id);
        destination.put("name", room.name);
        destination.put("floor", room.floor);
        destination.put("description", room.description);

        return NavigationResult.success(
                destination, path, steps, actualDistance, estimatedTime,
                floorAnalysis, useTimeWeight ? "时间最优" : "距离最优"
        );
    }

    // ==================== 通用房间到房间导航 ====================

    /**
     * 从任意节点导航到另一节点（通用方法）
     */
    public NavigationResult navigate(String from, String to, boolean avoidCongestion, boolean useTimeWeight) {
        if (!nodes.containsKey(from)) {
            return NavigationResult.fail("起点 " + from + " 不存在");
        }
        if (!nodes.containsKey(to)) {
            return NavigationResult.fail("终点 " + to + " 不存在");
        }

        IndoorNode fromNode = nodes.get(from);
        IndoorNode toNode = nodes.get(to);

        List<String> path = dijkstra(from, to, avoidCongestion, useTimeWeight);
        if (path.isEmpty()) {
            return NavigationResult.fail("无法找到从 " + fromNode.name + " 到 " + toNode.name + " 的路径");
        }

        List<NavigationStep> steps = generateNavigationSteps(path);
        double actualDistance = calculateActualDistance(path);
        double estimatedTime = estimateTimeWithFloorChanges(path);
        FloorAnalysis floorAnalysis = analyzeFloorChanges(path);

        Map<String, Object> destination = new LinkedHashMap<>();
        destination.put("id", toNode.id);
        destination.put("name", toNode.name);
        destination.put("floor", toNode.floor);
        destination.put("description", toNode.description);

        return NavigationResult.success(
                destination, path, steps, actualDistance, estimatedTime,
                floorAnalysis, useTimeWeight ? "时间最优" : "距离最优"
        );
    }

    // ==================== 多房间串联导航 ====================

    /**
     * 多房间串联导航：按顺序访问多个房间
     * @param roomIds 按访问顺序排列的房间ID列表（至少2个）
     */
    public MultiRoomNavigationResult navigateMultiRoom(List<String> roomIds,
                                                        boolean avoidCongestion,
                                                        boolean useTimeWeight) {
        if (roomIds == null || roomIds.size() < 2) {
            return MultiRoomNavigationResult.fail("至少需要2个房间才能进行多房间导航");
        }

        // 校验所有房间存在且为room类型
        for (String roomId : roomIds) {
            if (!nodes.containsKey(roomId)) {
                return MultiRoomNavigationResult.fail("房间 " + roomId + " 不存在");
            }
            IndoorNode room = nodes.get(roomId);
            if (!"room".equals(room.type)) {
                return MultiRoomNavigationResult.fail(roomId + " 不是一个房间");
            }
        }

        List<String> fullPath = new ArrayList<>();
        List<NavigationStep> mergedSteps = new ArrayList<>();
        List<MultiRoomSegment> segments = new ArrayList<>();
        List<Map<String, Object>> roomsVisited = new ArrayList<>();
        double totalDistance = 0;
        double totalEstimatedTime = 0;

        for (int i = 0; i < roomIds.size() - 1; i++) {
            String fromId = roomIds.get(i);
            String toId = roomIds.get(i + 1);

            List<String> segPath = dijkstra(fromId, toId, avoidCongestion, useTimeWeight);
            if (segPath.isEmpty()) {
                return MultiRoomNavigationResult.fail(
                        "无法找到从 " + nodes.get(fromId).name + " 到 " + nodes.get(toId).name + " 的路径");
            }

            IndoorNode fromNode = nodes.get(fromId);
            IndoorNode toNode = nodes.get(toId);

            // 拼接路径（避免重复连接节点）
            if (i == 0) {
                fullPath.addAll(segPath);
            } else {
                if (segPath.size() > 1) {
                    fullPath.addAll(segPath.subList(1, segPath.size()));
                }
            }

            double segDist = calculateActualDistance(segPath);
            double segTime = estimateTimeWithFloorChanges(segPath);
            FloorAnalysis segFloor = analyzeFloorChanges(segPath);

            totalDistance += segDist;
            totalEstimatedTime += segTime;

            List<NavigationStep> segSteps = generateNavigationSteps(segPath);
            for (NavigationStep step : segSteps) {
                mergedSteps.add(new NavigationStep(
                        mergedSteps.size() + 1, step.getFrom(), step.getTo(),
                        step.getDistance(), step.getDescription(),
                        step.isFloorChange(), step.getAction()
                ));
            }

            segments.add(new MultiRoomSegment(
                    fromId, fromNode.name, toId, toNode.name,
                    segPath, segSteps, segDist, segTime, segFloor
            ));

            // 记录访问的房间（最后一段也加入终点）
            if (i == 0) {
                Map<String, Object> fromInfo = new LinkedHashMap<>();
                fromInfo.put("id", fromNode.id);
                fromInfo.put("name", fromNode.name);
                fromInfo.put("floor", fromNode.floor);
                roomsVisited.add(fromInfo);
            }
            Map<String, Object> toInfo = new LinkedHashMap<>();
            toInfo.put("id", toNode.id);
            toInfo.put("name", toNode.name);
            toInfo.put("floor", toNode.floor);
            roomsVisited.add(toInfo);
        }

        FloorAnalysis totalFloorAnalysis = analyzeFloorChanges(fullPath);

        return new MultiRoomNavigationResult(
                fullPath, mergedSteps, segments, totalDistance, totalEstimatedTime,
                totalFloorAnalysis, useTimeWeight ? "时间最优" : "距离最优", roomsVisited
        );
    }

    /**
     * 多房间串联导航：从指定起点出发，经由多个房间
     * @param startRoomId 起点房间ID
     * @param targetRoomIds 目标房间ID列表（按顺序访问）
     */
    public MultiRoomNavigationResult navigateMultiRoom(String startRoomId,
                                                        List<String> targetRoomIds,
                                                        boolean avoidCongestion,
                                                        boolean useTimeWeight) {
        List<String> allRoomIds = new ArrayList<>();
        allRoomIds.add(startRoomId);
        if (targetRoomIds != null) {
            allRoomIds.addAll(targetRoomIds);
        }
        return navigateMultiRoom(allRoomIds, avoidCongestion, useTimeWeight);
    }

    // ==================== 辅助方法 ====================

    private List<NavigationStep> generateNavigationSteps(List<String> path) {
        List<NavigationStep> steps = new ArrayList<>();
        for (int i = 0; i < path.size() - 1; i++) {
            IndoorNode cur = nodes.get(path.get(i));
            IndoorNode next = nodes.get(path.get(i + 1));
            if (cur == null || next == null) continue;

            EdgeInfo edge = graph.getOrDefault(path.get(i), Collections.emptyMap()).get(path.get(i + 1));
            double dist = edge != null ? edge.distance : 0;
            String desc = edge != null ? edge.description : "";
            boolean floorChange = cur.floor != next.floor;

            String action;
            if ("elevator".equals(cur.type) && "elevator".equals(next.type)) {
                action = "乘坐电梯从" + cur.floor + "楼到" + next.floor + "楼";
            } else if ("elevator".equals(next.type)) {
                action = "前往" + next.name;
            } else if ("elevator".equals(cur.type)) {
                action = "从电梯出来，前往" + next.name;
            } else {
                action = "从" + cur.name + "前往" + next.name;
            }

            steps.add(new NavigationStep(i + 1, cur.name, next.name, dist, desc, floorChange, action));
        }
        return steps;
    }

    private double calculateActualDistance(List<String> path) {
        double total = 0;
        for (int i = 0; i < path.size() - 1; i++) {
            EdgeInfo edge = graph.getOrDefault(path.get(i), Collections.emptyMap()).get(path.get(i + 1));
            if (edge != null) total += edge.distance;
        }
        return total;
    }

    /**
     * 估算包含楼层切换的总时间（分钟）
     * 楼梯相邻楼层30s，多层45+15*floors；电梯60+15*floors
     */
    private double estimateTimeWithFloorChanges(List<String> path) {
        double totalSeconds = 0;
        for (int i = 0; i < path.size() - 1; i++) {
            IndoorNode cur = nodes.get(path.get(i));
            IndoorNode next = nodes.get(path.get(i + 1));
            EdgeInfo edge = graph.getOrDefault(path.get(i), Collections.emptyMap()).get(path.get(i + 1));
            if (cur == null || next == null) continue;

            if (cur.floor != next.floor) {
                int floorDiff = Math.abs(next.floor - cur.floor);
                if ("elevator".equals(cur.type) && "elevator".equals(next.type)) {
                    totalSeconds += 60 + 15.0 * floorDiff;
                } else {
                    totalSeconds += floorDiff == 1 ? 30 : 45 + 15.0 * floorDiff;
                }
            } else {
                totalSeconds += edge != null ? edge.distance : 0;
            }
        }
        return Math.round(totalSeconds / 60.0 * 10) / 10.0; // 分钟，保留1位小数
    }

    private FloorAnalysis analyzeFloorChanges(List<String> path) {
        int total = 0, elevatorChanges = 0, stairChanges = 0;
        Set<Integer> floorsVisited = new TreeSet<>();

        for (int i = 0; i < path.size(); i++) {
            IndoorNode n = nodes.get(path.get(i));
            if (n != null) floorsVisited.add(n.floor);

            if (i < path.size() - 1) {
                IndoorNode cur = nodes.get(path.get(i));
                IndoorNode next = nodes.get(path.get(i + 1));
                if (cur != null && next != null && cur.floor != next.floor) {
                    total++;
                    if ("elevator".equals(cur.type) && "elevator".equals(next.type)) elevatorChanges++;
                    else stairChanges++;
                }
            }
        }
        return new FloorAnalysis(total, elevatorChanges, stairChanges, new ArrayList<>(floorsVisited));
    }

    // ==================== 查询方法 ====================

    public List<Map<String, Object>> getAllRooms() {
        List<Map<String, Object>> rooms = new ArrayList<>();
        for (IndoorNode node : nodes.values()) {
            if ("room".equals(node.type)) {
                Map<String, Object> room = new LinkedHashMap<>();
                room.put("id", node.id);
                room.put("name", node.name);
                room.put("floor", node.floor);
                room.put("description", node.description);
                rooms.add(room);
            }
        }
        rooms.sort(Comparator.comparingInt((Map<String, Object> r) -> (int) r.get("floor"))
                .thenComparing(r -> (String) r.get("name")));
        return rooms;
    }

    public List<Map<String, Object>> getFloorRooms(int floor) {
        List<Map<String, Object>> rooms = new ArrayList<>();
        for (IndoorNode node : nodes.values()) {
            if ("room".equals(node.type) && node.floor == floor) {
                Map<String, Object> room = new LinkedHashMap<>();
                room.put("id", node.id);
                room.put("name", node.name);
                room.put("floor", node.floor);
                room.put("description", node.description);
                rooms.add(room);
            }
        }
        rooms.sort(Comparator.comparing(r -> (String) r.get("name")));
        return rooms;
    }

    public Map<String, Object> getBuildingInfo() { return Collections.unmodifiableMap(buildingInfo); }
    public boolean isLoaded() { return loaded; }
    public int getNodeCount() { return nodes.size(); }
}
