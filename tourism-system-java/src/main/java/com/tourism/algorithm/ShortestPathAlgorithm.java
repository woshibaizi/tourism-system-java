package com.tourism.algorithm;

import com.tourism.mapper.PlaceMapper;
import com.tourism.mapper.RoadEdgeMapper;
import com.tourism.mapper.BuildingMapper;
import com.tourism.model.entity.SpotPlace;
import com.tourism.model.entity.SpotRoadEdge;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.util.*;

/**
 * 最短路径算法（方案B：注入Mapper，@PostConstruct 加载图到内存）
 * <p>
 * 支持：
 * - A* 算法（单目标，指定交通工具）
 * - Dijkstra（纯距离）
 * - 混合交通工具 Dijkstra（最短时间）
 * - TSP：最近邻 / 动态规划 / 模拟退火 / 遗传算法
 * - 多目标路径规划
 */
@Component
public class ShortestPathAlgorithm {

    // ==================== 结果类 ====================

    public static class PathResult {
        private final List<String> path;
        private final double cost;

        public PathResult(List<String> path, double cost) {
            this.path = path;
            this.cost = cost;
        }

        public List<String> getPath() { return path; }
        public double getCost() { return cost; }
        public boolean isReachable() { return !path.isEmpty() && cost != Double.MAX_VALUE; }
    }

    public static class RouteSegment {
        private final String from;
        private final String to;
        private final String vehicle;
        private final double time;
        private final double distance;

        public RouteSegment(String from, String to, String vehicle, double time, double distance) {
            this.from = from;
            this.to = to;
            this.vehicle = vehicle;
            this.time = time;
            this.distance = distance;
        }

        public String getFrom() { return from; }
        public String getTo() { return to; }
        public String getVehicle() { return vehicle; }
        public double getTime() { return time; }
        public double getDistance() { return distance; }
    }

    public static class RouteResult {
        private final List<String> path;
        private final List<String> targetPath;
        private final double totalDistance;
        private final Double totalTime;
        private final String vehicle;
        private final String strategy;
        private final String algorithm;
        private final List<String> unreachableDestinations;
        private final List<RouteSegment> segments;

        public RouteResult(List<String> path, List<String> targetPath, double totalDistance,
                           Double totalTime, String vehicle, String strategy, String algorithm,
                           List<String> unreachableDestinations, List<RouteSegment> segments) {
            this.path = path;
            this.targetPath = targetPath;
            this.totalDistance = totalDistance;
            this.totalTime = totalTime;
            this.vehicle = vehicle;
            this.strategy = strategy;
            this.algorithm = algorithm;
            this.unreachableDestinations = unreachableDestinations;
            this.segments = segments;
        }

        public List<String> getPath() { return path; }
        public List<String> getTargetPath() { return targetPath; }
        public double getTotalDistance() { return totalDistance; }
        public Double getTotalTime() { return totalTime; }
        public String getVehicle() { return vehicle; }
        public String getStrategy() { return strategy; }
        public String getAlgorithm() { return algorithm; }
        public List<String> getUnreachableDestinations() { return unreachableDestinations; }
        public List<RouteSegment> getSegments() { return segments; }
    }

    // ==================== 内部图边信息 ====================

    private static class RoadInfo {
        final double distance;
        final double idealSpeed;
        final double congestionRate;
        final List<String> allowedVehicles;
        final String roadType;

        RoadInfo(double distance, double idealSpeed, double congestionRate,
                 List<String> allowedVehicles, String roadType) {
            this.distance = distance;
            this.idealSpeed = idealSpeed;
            this.congestionRate = congestionRate;
            this.allowedVehicles = allowedVehicles;
            this.roadType = roadType;
        }
    }

    // ==================== Spring 注入 ====================

    @Autowired
    private RoadEdgeMapper roadEdgeMapper;

    @Autowired
    private PlaceMapper placeMapper;

    @Autowired(required = false)
    private BuildingMapper buildingMapper;

    // ==================== 内存图结构 ====================

    /** 邻接表：nodeId → (neighborId → RoadInfo) */
    private Map<String, Map<String, RoadInfo>> graph = new HashMap<>();

    /** 坐标映射：nodeId → [lat, lng] */
    private Map<String, double[]> coordinates = new HashMap<>();

    private static final double DEFAULT_LAT = 39.9577;
    private static final double DEFAULT_LNG = 116.3577;

    // ==================== 初始化 ====================

    /**
     * 启动时从数据库加载图，之后所有请求复用内存图
     */
    @PostConstruct
    public void init() {
        try {
            List<SpotRoadEdge> edges = roadEdgeMapper.selectList(null);
            List<SpotPlace> places = placeMapper.selectList(null);
            buildGraph(edges);
            buildCoordinateMap(places);
            estimateIntersectionCoordinates(edges);
        } catch (Exception e) {
            // 测试环境或数据库未就绪时不阻塞启动
            System.err.println("[ShortestPathAlgorithm] 图加载失败（可能数据库未就绪）: " + e.getMessage());
        }
    }

    /**
     * 手动重新加载图（供管理接口调用）
     */
    public void reload() {
        graph.clear();
        coordinates.clear();
        init();
    }

    public void buildGraph(List<SpotRoadEdge> edges) {
        graph.clear();
        if (edges == null) return;
        for (SpotRoadEdge edge : edges) {
            String from = edge.getFromNode();
            String to = edge.getToNode();
            graph.computeIfAbsent(from, k -> new HashMap<>());
            graph.computeIfAbsent(to, k -> new HashMap<>());

            double dist = edge.getDistance() != null ? edge.getDistance().doubleValue() : 0;
            double speed = edge.getIdealSpeed() != null ? edge.getIdealSpeed().doubleValue() : 5;
            double congestion = edge.getCongestionRate() != null ? edge.getCongestionRate().doubleValue() : 1.0;
            List<String> vehicles = parseJsonArray(edge.getAllowedVehicles());
            String roadType = edge.getRoadType() != null ? edge.getRoadType() : "";

            RoadInfo info = new RoadInfo(dist, speed, congestion, vehicles, roadType);
            // 双向图
            graph.get(from).put(to, info);
            graph.get(to).put(from, info);
        }
    }

    public void buildCoordinateMap(List<SpotPlace> places) {
        if (places == null) return;
        for (SpotPlace place : places) {
            if (place.getLat() != null && place.getLng() != null) {
                coordinates.put(place.getId(),
                        new double[]{place.getLat().doubleValue(), place.getLng().doubleValue()});
            }
        }
    }

    private void estimateIntersectionCoordinates(List<SpotRoadEdge> edges) {
        if (edges == null) return;
        Set<String> unknownNodes = new HashSet<>(graph.keySet());
        unknownNodes.removeAll(coordinates.keySet());

        for (String node : unknownNodes) {
            List<double[]> neighborCoords = new ArrayList<>();
            if (edges != null) {
                for (SpotRoadEdge edge : edges) {
                    if (edge.getFromNode().equals(node) && coordinates.containsKey(edge.getToNode())) {
                        neighborCoords.add(coordinates.get(edge.getToNode()));
                    } else if (edge.getToNode().equals(node) && coordinates.containsKey(edge.getFromNode())) {
                        neighborCoords.add(coordinates.get(edge.getFromNode()));
                    }
                }
            }
            if (!neighborCoords.isEmpty()) {
                double avgLat = neighborCoords.stream().mapToDouble(c -> c[0]).average().orElse(DEFAULT_LAT);
                double avgLng = neighborCoords.stream().mapToDouble(c -> c[1]).average().orElse(DEFAULT_LNG);
                coordinates.put(node, new double[]{avgLat, avgLng});
            } else {
                coordinates.put(node, new double[]{DEFAULT_LAT, DEFAULT_LNG});
            }
        }
    }

    // ==================== 辅助方法 ====================

    private double haversineDistance(String node1, String node2) {
        double[] c1 = coordinates.getOrDefault(node1, new double[]{DEFAULT_LAT, DEFAULT_LNG});
        double[] c2 = coordinates.getOrDefault(node2, new double[]{DEFAULT_LAT, DEFAULT_LNG});
        double R = 6371000;
        double dLat = Math.toRadians(c2[0] - c1[0]);
        double dLng = Math.toRadians(c2[1] - c1[1]);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(c1[0])) * Math.cos(Math.toRadians(c2[0]))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private double heuristic(String node, String goal, String vehicle) {
        double distance = haversineDistance(node, goal);
        double maxSpeed = switch (vehicle) {
            case "自行车" -> 15.0;
            case "电瓶车" -> 25.0;
            default -> 5.0;
        };
        return distance / (maxSpeed * 1000.0 / 3600.0);
    }

    public double calculateTravelTime(RoadInfo road, String vehicle) {
        if (road.allowedVehicles != null && !road.allowedVehicles.isEmpty()
                && !road.allowedVehicles.contains(vehicle)) {
            return Double.MAX_VALUE;
        }
        double speedMultiplier = switch (vehicle) {
            case "自行车" -> 3.0;
            case "电瓶车" -> 5.0;
            default -> 1.0;
        };
        double actualSpeed = road.idealSpeed * road.congestionRate * speedMultiplier;
        return actualSpeed <= 0 ? Double.MAX_VALUE : road.distance / actualSpeed;
    }

    public List<String> getAvailableVehicles(String placeType) {
        return switch (placeType) {
            case "校园" -> List.of("步行", "自行车");
            case "景区" -> List.of("步行", "电瓶车");
            default -> List.of("步行");
        };
    }

    // ==================== A* 算法 ====================

    /**
     * A* 最短路径，支持指定交通工具
     */
    public PathResult astar(String start, String end, String vehicle) {
        if (!graph.containsKey(start) || !graph.containsKey(end)) {
            return new PathResult(Collections.emptyList(), Double.MAX_VALUE);
        }
        Map<String, Double> gScore = new HashMap<>();
        Map<String, String> previous = new HashMap<>();
        Set<String> closedSet = new HashSet<>();
        gScore.put(start, 0.0);

        // 优先队列 [fScore, node]
        PriorityQueue<double[]> openSet = new PriorityQueue<>(Comparator.comparingDouble(a -> a[0]));
        Map<String, Double> fScore = new HashMap<>();
        fScore.put(start, heuristic(start, end, vehicle));
        openSet.offer(new double[]{fScore.get(start), start.hashCode()});
        Map<Double, String> hashToNode = new HashMap<>();
        hashToNode.put((double) start.hashCode(), start);

        // 由于hashCode可能碰撞，用完整map替代
        PriorityQueue<Object[]> pq = new PriorityQueue<>(Comparator.comparingDouble(a -> (double) a[0]));
        pq.offer(new Object[]{heuristic(start, end, vehicle), start});

        while (!pq.isEmpty()) {
            Object[] curr = pq.poll();
            String currentNode = (String) curr[1];

            if (closedSet.contains(currentNode)) continue;
            closedSet.add(currentNode);

            if (currentNode.equals(end)) break;

            Map<String, RoadInfo> neighbors = graph.getOrDefault(currentNode, Collections.emptyMap());
            for (Map.Entry<String, RoadInfo> entry : neighbors.entrySet()) {
                String neighbor = entry.getKey();
                if (closedSet.contains(neighbor)) continue;

                double travelTime = calculateTravelTime(entry.getValue(), vehicle);
                if (travelTime == Double.MAX_VALUE) continue;

                double tentativeG = gScore.getOrDefault(currentNode, Double.MAX_VALUE) + travelTime;
                if (tentativeG < gScore.getOrDefault(neighbor, Double.MAX_VALUE)) {
                    previous.put(neighbor, currentNode);
                    gScore.put(neighbor, tentativeG);
                    double f = tentativeG + heuristic(neighbor, end, vehicle);
                    pq.offer(new Object[]{f, neighbor});
                }
            }
        }

        return reconstructPath(start, end, previous, gScore);
    }

    /** Dijkstra（纯距离，不考虑交通工具限制） */
    public PathResult dijkstraDistanceOnly(String start, String end) {
        if (!graph.containsKey(start) || !graph.containsKey(end)) {
            return new PathResult(Collections.emptyList(), Double.MAX_VALUE);
        }
        Map<String, Double> dist = new HashMap<>();
        Map<String, String> previous = new HashMap<>();
        dist.put(start, 0.0);
        PriorityQueue<Object[]> pq = new PriorityQueue<>(Comparator.comparingDouble(a -> (double) a[0]));
        pq.offer(new Object[]{0.0, start});
        Set<String> visited = new HashSet<>();

        while (!pq.isEmpty()) {
            Object[] curr = pq.poll();
            String node = (String) curr[1];
            if (visited.contains(node)) continue;
            visited.add(node);
            if (node.equals(end)) break;

            for (Map.Entry<String, RoadInfo> entry : graph.getOrDefault(node, Collections.emptyMap()).entrySet()) {
                String neighbor = entry.getKey();
                if (visited.contains(neighbor)) continue;
                double newDist = dist.getOrDefault(node, Double.MAX_VALUE) + entry.getValue().distance;
                if (newDist < dist.getOrDefault(neighbor, Double.MAX_VALUE)) {
                    dist.put(neighbor, newDist);
                    previous.put(neighbor, node);
                    pq.offer(new Object[]{newDist, neighbor});
                }
            }
        }
        return reconstructPath(start, end, previous, dist);
    }

    private PathResult reconstructPath(String start, String end,
                                       Map<String, String> previous, Map<String, Double> cost) {
        if (!previous.containsKey(end) && !start.equals(end)) {
            return new PathResult(Collections.emptyList(), Double.MAX_VALUE);
        }
        List<String> path = new ArrayList<>();
        String cur = end;
        while (cur != null) {
            path.add(cur);
            cur = previous.get(cur);
        }
        Collections.reverse(path);
        return new PathResult(path, cost.getOrDefault(end, Double.MAX_VALUE));
    }

    // ==================== 混合交通工具 Dijkstra ====================

    public List<RouteSegment> dijkstraWithMixedVehicles(String start, String end, String placeType) {
        if (!graph.containsKey(start) || !graph.containsKey(end)) return Collections.emptyList();
        List<String> vehicles = getAvailableVehicles(placeType);

        // 状态：[node, vehicle]
        Map<String, Map<String, Double>> dist = new HashMap<>();
        Map<String, Object[]> previous = new HashMap<>();
        Set<String> visited = new HashSet<>();

        PriorityQueue<Object[]> pq = new PriorityQueue<>(Comparator.comparingDouble(a -> (double) a[0]));
        for (String v : vehicles) {
            dist.computeIfAbsent(start, k -> new HashMap<>()).put(v, 0.0);
            pq.offer(new Object[]{0.0, start, v});
        }

        while (!pq.isEmpty()) {
            Object[] curr = pq.poll();
            double time = (double) curr[0];
            String node = (String) curr[1];
            String vehicle = (String) curr[2];
            String stateKey = node + "|" + vehicle;

            if (visited.contains(stateKey)) continue;
            visited.add(stateKey);

            if (node.equals(end)) {
                // 回溯路径
                List<RouteSegment> segments = new ArrayList<>();
                String n = node;
                String v = vehicle;
                while (previous.containsKey(n + "|" + v)) {
                    Object[] prev = previous.get(n + "|" + v);
                    String prevNode = (String) prev[0];
                    String prevVehicle = (String) prev[1];
                    double segTime = (double) prev[2];
                    double segDist = (double) prev[3];
                    segments.add(new RouteSegment(prevNode, n, v, segTime, segDist));
                    n = prevNode;
                    v = prevVehicle;
                }
                Collections.reverse(segments);
                return segments;
            }

            for (Map.Entry<String, RoadInfo> entry : graph.getOrDefault(node, Collections.emptyMap()).entrySet()) {
                String neighbor = entry.getKey();
                for (String nextVehicle : vehicles) {
                    String nextKey = neighbor + "|" + nextVehicle;
                    if (visited.contains(nextKey)) continue;
                    double travelTime = calculateTravelTime(entry.getValue(), nextVehicle);
                    if (travelTime == Double.MAX_VALUE) continue;
                    double newTime = time + travelTime;
                    double curBest = dist.computeIfAbsent(neighbor, k -> new HashMap<>())
                            .getOrDefault(nextVehicle, Double.MAX_VALUE);
                    if (newTime < curBest) {
                        dist.get(neighbor).put(nextVehicle, newTime);
                        previous.put(nextKey, new Object[]{node, vehicle, travelTime, entry.getValue().distance});
                        pq.offer(new Object[]{newTime, neighbor, nextVehicle});
                    }
                }
            }
        }
        return Collections.emptyList();
    }

    // ==================== TSP 算法 ====================

    /** 距离矩阵：o(n²) Dijkstra预计算 */
    private Map<String, Map<String, Double>> buildDistanceMatrix(List<String> nodes) {
        Map<String, Map<String, Double>> matrix = new HashMap<>();
        for (String n1 : nodes) {
            matrix.put(n1, new HashMap<>());
            for (String n2 : nodes) {
                if (n1.equals(n2)) {
                    matrix.get(n1).put(n2, 0.0);
                } else {
                    PathResult result = dijkstraDistanceOnly(n1, n2);
                    matrix.get(n1).put(n2, result.getCost());
                }
            }
        }
        return matrix;
    }

    private double pathDistance(List<String> path, Map<String, Map<String, Double>> matrix) {
        double total = 0;
        for (int i = 0; i < path.size() - 1; i++) {
            total += matrix.getOrDefault(path.get(i), Collections.emptyMap())
                    .getOrDefault(path.get(i + 1), Double.MAX_VALUE / 2);
        }
        // 回到起点
        if (path.size() > 1 && !path.get(path.size() - 1).equals(path.get(0))) {
            total += matrix.getOrDefault(path.get(path.size() - 1), Collections.emptyMap())
                    .getOrDefault(path.get(0), Double.MAX_VALUE / 2);
        }
        return total;
    }

    /** TSP 最近邻算法（距离） */
    public PathResult tspNearestNeighborDistanceOnly(String start, List<String> destinations) {
        if (destinations == null || destinations.isEmpty()) return new PathResult(List.of(start), 0);
        List<String> allNodes = new ArrayList<>();
        allNodes.add(start);
        allNodes.addAll(destinations);
        Map<String, Map<String, Double>> matrix = buildDistanceMatrix(allNodes);

        List<String> unvisited = new ArrayList<>(destinations);
        List<String> path = new ArrayList<>();
        path.add(start);
        String current = start;
        double totalDist = 0;

        while (!unvisited.isEmpty()) {
            String nearest = null;
            double minDist = Double.MAX_VALUE;
            for (String dest : unvisited) {
                double d = matrix.getOrDefault(current, Collections.emptyMap())
                        .getOrDefault(dest, Double.MAX_VALUE);
                if (d < minDist) {
                    minDist = d;
                    nearest = dest;
                }
            }
            if (nearest == null) break;
            path.add(nearest);
            totalDist += minDist;
            unvisited.remove(nearest);
            current = nearest;
        }
        // 回到起点
        totalDist += matrix.getOrDefault(current, Collections.emptyMap())
                .getOrDefault(start, 0.0);
        path.add(start);
        return new PathResult(path, totalDist);
    }

    /** TSP 动态规划（距离，适合 ≤15 个目标点） */
    public PathResult tspDynamicProgrammingDistanceOnly(String start, List<String> destinations) {
        if (destinations == null || destinations.isEmpty()) return new PathResult(List.of(start), 0);
        if (destinations.size() > 15) {
            return tspNearestNeighborDistanceOnly(start, destinations);
        }
        List<String> allNodes = new ArrayList<>();
        allNodes.add(start);
        allNodes.addAll(destinations);
        int n = allNodes.size();
        Map<String, Map<String, Double>> matrix = buildDistanceMatrix(allNodes);

        double[][] dp = new double[1 << n][n];
        int[][] parent = new int[1 << n][n];
        for (double[] row : dp) Arrays.fill(row, Double.MAX_VALUE / 2);
        for (int[] row : parent) Arrays.fill(row, -1);
        dp[1][0] = 0;

        for (int mask = 1; mask < (1 << n); mask++) {
            for (int u = 0; u < n; u++) {
                if ((mask & (1 << u)) == 0) continue;
                if (dp[mask][u] == Double.MAX_VALUE / 2) continue;
                for (int v = 0; v < n; v++) {
                    if ((mask & (1 << v)) != 0) continue;
                    double d = matrix.get(allNodes.get(u)).getOrDefault(allNodes.get(v), Double.MAX_VALUE / 2);
                    int newMask = mask | (1 << v);
                    if (dp[mask][u] + d < dp[newMask][v]) {
                        dp[newMask][v] = dp[mask][u] + d;
                        parent[newMask][v] = u;
                    }
                }
            }
        }

        int fullMask = (1 << n) - 1;
        double minCost = Double.MAX_VALUE;
        int lastNode = -1;
        for (int u = 1; u < n; u++) {
            double d = matrix.get(allNodes.get(u)).getOrDefault(allNodes.get(0), Double.MAX_VALUE / 2);
            double total = dp[fullMask][u] + d;
            if (total < minCost) {
                minCost = total;
                lastNode = u;
            }
        }

        // 回溯路径
        List<Integer> pathIndices = new ArrayList<>();
        int mask = fullMask;
        int cur = lastNode;
        while (cur != -1) {
            pathIndices.add(cur);
            int prev = parent[mask][cur];
            mask ^= (1 << cur);
            cur = prev;
        }
        Collections.reverse(pathIndices);
        pathIndices.add(0); // 回到起点

        List<String> path = new ArrayList<>();
        for (int idx : pathIndices) path.add(allNodes.get(idx));
        return new PathResult(path, minCost);
    }

    /** TSP 模拟退火算法（大规模，距离） */
    public PathResult tspSimulatedAnnealingDistanceOnly(String start, List<String> destinations,
                                                         double initialTemp, double coolingRate,
                                                         int maxIterations) {
        if (destinations == null || destinations.isEmpty()) return new PathResult(List.of(start), 0);
        List<String> allNodes = new ArrayList<>();
        allNodes.add(start);
        allNodes.addAll(destinations);
        Map<String, Map<String, Double>> matrix = buildDistanceMatrix(allNodes);

        // 初始解（最近邻）
        PathResult init = tspNearestNeighborDistanceOnly(start, destinations);
        List<String> current = new ArrayList<>(init.getPath());
        if (!current.isEmpty() && current.get(current.size() - 1).equals(start)) {
            current.remove(current.size() - 1);
        }

        List<String> best = new ArrayList<>(current);
        double bestCost = pathDistance(best, matrix);
        double temperature = initialTemp;
        Random rnd = new Random(42);

        for (int iter = 0; iter < maxIterations && temperature > 1e-9; iter++) {
            // 2-opt 移动
            List<String> newPath = new ArrayList<>(current);
            if (newPath.size() > 2) {
                int i = 1 + rnd.nextInt(newPath.size() - 2);
                int j = i + 1 + rnd.nextInt(newPath.size() - i);
                Collections.reverse(newPath.subList(i, j + 1));
            }

            double curCost = pathDistance(current, matrix);
            double newCost = pathDistance(newPath, matrix);
            if (newCost < curCost || rnd.nextDouble() < Math.exp((curCost - newCost) / temperature)) {
                current = newPath;
                if (newCost < bestCost) {
                    best = new ArrayList<>(newPath);
                    bestCost = newCost;
                }
            }
            temperature *= coolingRate;
        }

        best.add(start);
        return new PathResult(best, bestCost);
    }

    /** TSP 遗传算法（大规模，距离） */
    public PathResult tspGeneticAlgorithmDistanceOnly(String start, List<String> destinations,
                                                       int populationSize, int generations,
                                                       double mutationRate) {
        if (destinations == null || destinations.isEmpty()) return new PathResult(List.of(start), 0);
        List<String> allNodes = new ArrayList<>();
        allNodes.add(start);
        allNodes.addAll(destinations);
        Map<String, Map<String, Double>> matrix = buildDistanceMatrix(allNodes);
        Random rnd = new Random(42);

        // 初始化种群
        List<List<String>> population = new ArrayList<>();
        for (int i = 0; i < populationSize; i++) {
            List<String> ind = new ArrayList<>(destinations);
            Collections.shuffle(ind, rnd);
            ind.add(0, start);
            population.add(ind);
        }

        List<String> bestIndividual = null;
        double bestFitness = 0;

        for (int gen = 0; gen < generations; gen++) {
            // 计算适应度
            List<Double> fitnesses = new ArrayList<>();
            for (List<String> ind : population) {
                double d = pathDistance(ind, matrix);
                fitnesses.add(1.0 / (d + 1));
            }

            // 更新最优
            for (int i = 0; i < population.size(); i++) {
                if (fitnesses.get(i) > bestFitness) {
                    bestFitness = fitnesses.get(i);
                    bestIndividual = new ArrayList<>(population.get(i));
                }
            }

            // 精英选择（前20%直接传入下一代）
            int eliteSize = Math.max(1, populationSize / 5);
            List<Integer> sortedIdx = new ArrayList<>();
            for (int i = 0; i < population.size(); i++) sortedIdx.add(i);
            sortedIdx.sort((a, b) -> Double.compare(fitnesses.get(b), fitnesses.get(a)));

            List<List<String>> newPop = new ArrayList<>();
            for (int i = 0; i < eliteSize; i++) newPop.add(new ArrayList<>(population.get(sortedIdx.get(i))));

            // 交叉 + 变异
            double totalFitness = fitnesses.stream().mapToDouble(Double::doubleValue).sum();
            while (newPop.size() < populationSize) {
                List<String> p1 = rouletteSelect(population, fitnesses, totalFitness, rnd);
                List<String> p2 = rouletteSelect(population, fitnesses, totalFitness, rnd);
                List<String> child = pmxCrossover(p1, p2, start, destinations, rnd);
                if (rnd.nextDouble() < mutationRate && child.size() > 2) {
                    int i = 1 + rnd.nextInt(child.size() - 1);
                    int j = 1 + rnd.nextInt(child.size() - 1);
                    Collections.swap(child, i, j);
                }
                newPop.add(child);
            }
            population = newPop;
        }

        if (bestIndividual == null) bestIndividual = population.get(0);
        bestIndividual.add(start);
        double cost = 1.0 / bestFitness - 1;
        return new PathResult(bestIndividual, cost);
    }

    private List<String> rouletteSelect(List<List<String>> population,
                                         List<Double> fitnesses, double total, Random rnd) {
        double pick = rnd.nextDouble() * total;
        double cumulative = 0;
        for (int i = 0; i < population.size(); i++) {
            cumulative += fitnesses.get(i);
            if (cumulative >= pick) return population.get(i);
        }
        return population.get(population.size() - 1);
    }

    private List<String> pmxCrossover(List<String> p1, List<String> p2,
                                       String start, List<String> destinations, Random rnd) {
        if (p1.size() <= 2) return new ArrayList<>(p1);
        int size = p1.size();
        int s = 1 + rnd.nextInt(size - 2);
        int e = s + rnd.nextInt(size - s);

        String[] child = new String[size];
        child[0] = start;
        for (int i = s; i <= e && i < size; i++) child[i] = p1.get(i);

        Set<String> used = new HashSet<>(Arrays.asList(child));
        used.remove(null);
        List<String> remaining = new ArrayList<>();
        for (String node : p2.subList(1, p2.size())) {
            if (!used.contains(node)) remaining.add(node);
        }
        int ri = 0;
        for (int i = 1; i < size; i++) {
            if (child[i] == null) child[i] = remaining.get(ri++);
        }
        return new ArrayList<>(Arrays.asList(child));
    }

    // ==================== 多目标路径规划 ====================

    /**
     * 多目标路径规划（TSP + 详细路径）
     *
     * @param start        起点
     * @param destinations 目标点列表
     * @param algorithm    算法：nearest_neighbor / dynamic_programming / simulated_annealing / genetic_algorithm
     * @return 路径规划结果
     */
    public RouteResult multiDestinationRoute(String start, List<String> destinations, String algorithm) {
        List<String> reachable = new ArrayList<>();
        List<String> unreachable = new ArrayList<>();

        for (String dest : destinations) {
            PathResult check = dijkstraDistanceOnly(start, dest);
            if (check.isReachable()) reachable.add(dest);
            else unreachable.add(dest);
        }

        if (reachable.isEmpty()) {
            return new RouteResult(Collections.emptyList(), List.of(start), Double.MAX_VALUE,
                    null, "步行", "distance", algorithm, unreachable, Collections.emptyList());
        }

        PathResult tspResult = switch (algorithm) {
            case "dynamic_programming" -> tspDynamicProgrammingDistanceOnly(start, reachable);
            case "simulated_annealing" -> tspSimulatedAnnealingDistanceOnly(start, reachable, 1000, 0.995, 5000);
            case "genetic_algorithm" -> tspGeneticAlgorithmDistanceOnly(start, reachable, 100, 500, 0.1);
            default -> tspNearestNeighborDistanceOnly(start, reachable);
        };

        // 展开完整路径
        List<String> fullPath = new ArrayList<>();
        List<RouteSegment> segments = new ArrayList<>();
        List<String> targetPath = tspResult.getPath();

        double totalDist = 0;
        for (int i = 0; i < targetPath.size() - 1; i++) {
            PathResult seg = dijkstraDistanceOnly(targetPath.get(i), targetPath.get(i + 1));
            if (!seg.isReachable()) continue;
            if (i == 0) fullPath.addAll(seg.getPath());
            else if (seg.getPath().size() > 1) fullPath.addAll(seg.getPath().subList(1, seg.getPath().size()));
            totalDist += seg.getCost();
            for (int j = 0; j < seg.getPath().size() - 1; j++) {
                String fn = seg.getPath().get(j);
                String tn = seg.getPath().get(j + 1);
                double d = graph.getOrDefault(fn, Collections.emptyMap())
                        .getOrDefault(tn, new RoadInfo(0, 5, 1, List.of("步行"), "")).distance;
                segments.add(new RouteSegment(fn, tn, "步行", 0, d));
            }
        }

        return new RouteResult(fullPath, targetPath, totalDist, null, "步行",
                "distance", algorithm, unreachable, segments);
    }

    // ==================== 工具方法 ====================

    public int getNodeCount() { return graph.size(); }
    public boolean containsNode(String nodeId) { return graph.containsKey(nodeId); }

    private List<String> parseJsonArray(String json) {
        if (json == null || json.trim().isEmpty() || json.equals("[]")) return List.of("步行");
        List<String> result = new ArrayList<>();
        String cleaned = json.replaceAll("[\\[\\]\"]", "").trim();
        for (String s : cleaned.split(",")) {
            String t = s.trim();
            if (!t.isEmpty()) result.add(t);
        }
        return result.isEmpty() ? List.of("步行") : result;
    }
}
