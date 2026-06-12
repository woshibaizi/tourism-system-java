package com.tourism.model.dto;

import java.util.List;

/**
 * 多点导航请求模型
 */
public class MultiPointRouteRequest {

    private String start;
    private Double startLat;
    private Double startLng;
    private List<Waypoint> waypoints;
    private String end;
    private Double endLat;
    private Double endLng;
    private String mode;       // "ordered" / "optimized" / "mixed"
    private String algorithm;  // TSP算法（optimized / mixed模式）
    private String vehicle;    // 默认交通方式
    private String strategy;   // "time" / "distance"
    private String placeType;
    private String provider;

    public static class Waypoint {
        private String nodeId;
        private String name;
        private Double lat;
        private Double lng;
        private Boolean fixed;     // mixed模式下是否固定顺序
        private String vehicle;    // 到此点的交通方式

        public String getNodeId() { return nodeId; }
        public void setNodeId(String nodeId) { this.nodeId = nodeId; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public Double getLat() { return lat; }
        public void setLat(Double lat) { this.lat = lat; }
        public Double getLng() { return lng; }
        public void setLng(Double lng) { this.lng = lng; }
        public Boolean getFixed() { return fixed != null && fixed; }
        public void setFixed(Boolean fixed) { this.fixed = fixed; }
        public String getVehicle() { return vehicle; }
        public void setVehicle(String vehicle) { this.vehicle = vehicle; }
    }

    public String getStart() { return start; }
    public void setStart(String start) { this.start = start; }
    public Double getStartLat() { return startLat; }
    public void setStartLat(Double startLat) { this.startLat = startLat; }
    public Double getStartLng() { return startLng; }
    public void setStartLng(Double startLng) { this.startLng = startLng; }
    public List<Waypoint> getWaypoints() { return waypoints; }
    public void setWaypoints(List<Waypoint> waypoints) { this.waypoints = waypoints; }
    public String getEnd() { return end; }
    public void setEnd(String end) { this.end = end; }
    public Double getEndLat() { return endLat; }
    public void setEndLat(Double endLat) { this.endLat = endLat; }
    public Double getEndLng() { return endLng; }
    public void setEndLng(Double endLng) { this.endLng = endLng; }
    public String getMode() { return mode != null ? mode : "ordered"; }
    public void setMode(String mode) { this.mode = mode; }
    public String getAlgorithm() { return algorithm != null ? algorithm : "nearest_neighbor"; }
    public void setAlgorithm(String algorithm) { this.algorithm = algorithm; }
    public String getVehicle() { return vehicle != null ? vehicle : "步行"; }
    public void setVehicle(String vehicle) { this.vehicle = vehicle; }
    public String getStrategy() { return strategy != null ? strategy : "time"; }
    public void setStrategy(String strategy) { this.strategy = strategy; }
    public String getPlaceType() { return placeType != null ? placeType : "景区"; }
    public void setPlaceType(String placeType) { this.placeType = placeType; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
}
