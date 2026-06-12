package com.tourism.utils;

/**
 * 地理坐标距离计算工具（Haversine 公式）
 */
public class GeoUtils {

    /** 地球半径（米） */
    private static final double EARTH_RADIUS = 6371000.0;

    private GeoUtils() {}

    /**
     * 计算两点间球面距离（米）
     */
    public static double distance(double lat1, double lng1, double lat2, double lng2) {
        double radLat1 = Math.toRadians(lat1);
        double radLat2 = Math.toRadians(lat2);
        double deltaLat = Math.toRadians(lat2 - lat1);
        double deltaLng = Math.toRadians(lng2 - lng1);

        double a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2)
                + Math.cos(radLat1) * Math.cos(radLat2)
                * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS * c;
    }

    /**
     * 启发函数：直线距离估计（用于 A* 算法）
     */
    public static double heuristic(double lat1, double lng1, double lat2, double lng2) {
        return distance(lat1, lng1, lat2, lng2);
    }
}
