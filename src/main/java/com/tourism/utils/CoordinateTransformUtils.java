package com.tourism.utils;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.tourism.model.entity.SpotBuilding;
import com.tourism.model.entity.SpotFacility;
import com.tourism.model.entity.SpotPlace;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class CoordinateTransformUtils {

    private static final double PI = 3.1415926535897932384626;
    private static final double AXIS = 6378245.0;
    private static final double EE = 0.00669342162296594323;

    private CoordinateTransformUtils() {
    }

    public static Coordinate wgs84ToGcj02(double lat, double lng) {
        if (outOfChina(lat, lng)) {
            return new Coordinate(lat, lng);
        }
        double deltaLat = transformLat(lng - 105.0, lat - 35.0);
        double deltaLng = transformLng(lng - 105.0, lat - 35.0);
        double radLat = lat / 180.0 * PI;
        double magic = Math.sin(radLat);
        magic = 1 - EE * magic * magic;
        double sqrtMagic = Math.sqrt(magic);
        deltaLat = (deltaLat * 180.0) / ((AXIS * (1 - EE)) / (magic * sqrtMagic) * PI);
        deltaLng = (deltaLng * 180.0) / (AXIS / sqrtMagic * Math.cos(radLat) * PI);
        return new Coordinate(lat + deltaLat, lng + deltaLng);
    }

    /**
     * 为前端地图展示标注坐标。
     * <p>
     * 数据库存储的 lat/lng 为 WGS-84 坐标系（OSM/原始采集数据），
     * 需要转换为 GCJ-02（高德坐标系）后写入 mapLat/mapLng 供前端 AMap 渲染。
     * 不做转换会导致在高德地图上产生约 100-700 米的偏移。
     */
    public static SpotPlace annotateForMap(SpotPlace place) {
        if (place == null) return null;
        place.setCoordSystem("wgs84");
        place.setMapCoordSystem("gcj02");
        if (place.getLat() != null && place.getLng() != null) {
            Coordinate gcj = wgs84ToGcj02(place.getLat().doubleValue(), place.getLng().doubleValue());
            place.setMapLat(BigDecimal.valueOf(gcj.lat()).setScale(7, RoundingMode.HALF_UP));
            place.setMapLng(BigDecimal.valueOf(gcj.lng()).setScale(7, RoundingMode.HALF_UP));
        }
        return place;
    }

    public static SpotBuilding annotateForMap(SpotBuilding building) {
        if (building == null) return null;
        building.setCoordSystem("wgs84");
        building.setMapCoordSystem("gcj02");
        if (building.getLat() != null && building.getLng() != null) {
            Coordinate gcj = wgs84ToGcj02(building.getLat().doubleValue(), building.getLng().doubleValue());
            building.setMapLat(BigDecimal.valueOf(gcj.lat()).setScale(7, RoundingMode.HALF_UP));
            building.setMapLng(BigDecimal.valueOf(gcj.lng()).setScale(7, RoundingMode.HALF_UP));
        }
        return building;
    }

    public static SpotFacility annotateForMap(SpotFacility facility) {
        if (facility == null) return null;
        facility.setCoordSystem("wgs84");
        facility.setMapCoordSystem("gcj02");
        if (facility.getLat() != null && facility.getLng() != null) {
            Coordinate gcj = wgs84ToGcj02(facility.getLat().doubleValue(), facility.getLng().doubleValue());
            facility.setMapLat(BigDecimal.valueOf(gcj.lat()).setScale(7, RoundingMode.HALF_UP));
            facility.setMapLng(BigDecimal.valueOf(gcj.lng()).setScale(7, RoundingMode.HALF_UP));
        }
        return facility;
    }

    public static List<SpotPlace> annotatePlaces(List<SpotPlace> places) {
        if (places != null) places.forEach(CoordinateTransformUtils::annotateForMap);
        return places;
    }

    public static List<SpotBuilding> annotateBuildings(List<SpotBuilding> buildings) {
        if (buildings != null) buildings.forEach(CoordinateTransformUtils::annotateForMap);
        return buildings;
    }

    public static List<SpotFacility> annotateFacilities(List<SpotFacility> facilities) {
        if (facilities != null) facilities.forEach(CoordinateTransformUtils::annotateForMap);
        return facilities;
    }

    public static IPage<SpotPlace> annotatePlacePage(IPage<SpotPlace> page) {
        if (page != null) annotatePlaces(page.getRecords());
        return page;
    }

    public static IPage<SpotBuilding> annotateBuildingPage(IPage<SpotBuilding> page) {
        if (page != null) annotateBuildings(page.getRecords());
        return page;
    }

    public static IPage<SpotFacility> annotateFacilityPage(IPage<SpotFacility> page) {
        if (page != null) annotateFacilities(page.getRecords());
        return page;
    }

    /**
     * 返回路网节点坐标，转换为 GCJ-02 坐标系供前端 AMap 渲染。
     * <p>
     * 数据库与路网图中存储的坐标为 WGS-84，需要转换为 GCJ-02。
     * 不做转换会导致路线 polyline 在高德地图上偏离真实道路 100-700 米。
     */
    public static Map<String, List<Double>> toGcj02NodeCoordinates(Map<String, List<Double>> rawCoordinates) {
        if (rawCoordinates == null) return new LinkedHashMap<>();
        Map<String, List<Double>> result = new LinkedHashMap<>();
        for (Map.Entry<String, List<Double>> entry : rawCoordinates.entrySet()) {
            List<Double> raw = entry.getValue();
            if (raw == null || raw.size() < 2) {
                result.put(entry.getKey(), raw);
                continue;
            }
            double lat = raw.get(0);
            double lng = raw.get(1);
            Coordinate gcj = wgs84ToGcj02(lat, lng);
            result.put(entry.getKey(), List.of(
                    round(gcj.lat()).doubleValue(),
                    round(gcj.lng()).doubleValue()
            ));
        }
        return result;
    }

    private static BigDecimal round(double value) {
        return BigDecimal.valueOf(value).setScale(7, RoundingMode.HALF_UP);
    }

    private static boolean outOfChina(double lat, double lng) {
        return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
    }

    private static double transformLat(double lng, double lat) {
        double ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
        ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(lat * PI) + 40.0 * Math.sin(lat / 3.0 * PI)) * 2.0 / 3.0;
        ret += (160.0 * Math.sin(lat / 12.0 * PI) + 320 * Math.sin(lat * PI / 30.0)) * 2.0 / 3.0;
        return ret;
    }

    private static double transformLng(double lng, double lat) {
        double ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
        ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(lng * PI) + 40.0 * Math.sin(lng / 3.0 * PI)) * 2.0 / 3.0;
        ret += (150.0 * Math.sin(lng / 12.0 * PI) + 300.0 * Math.sin(lng / 30.0 * PI)) * 2.0 / 3.0;
        return ret;
    }

    public record Coordinate(double lat, double lng) {
    }
}
