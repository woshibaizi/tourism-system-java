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

    public static SpotPlace annotateForMap(SpotPlace place) {
        if (place == null) return null;
        place.setCoordSystem("wgs84");
        place.setMapCoordSystem("gcj02");
        if (place.getLat() != null && place.getLng() != null) {
            Coordinate c = wgs84ToGcj02(place.getLat().doubleValue(), place.getLng().doubleValue());
            place.setMapLat(round(c.lat()));
            place.setMapLng(round(c.lng()));
        }
        return place;
    }

    public static SpotBuilding annotateForMap(SpotBuilding building) {
        if (building == null) return null;
        building.setCoordSystem("wgs84");
        building.setMapCoordSystem("gcj02");
        if (building.getLat() != null && building.getLng() != null) {
            Coordinate c = wgs84ToGcj02(building.getLat().doubleValue(), building.getLng().doubleValue());
            building.setMapLat(round(c.lat()));
            building.setMapLng(round(c.lng()));
        }
        return building;
    }

    public static SpotFacility annotateForMap(SpotFacility facility) {
        if (facility == null) return null;
        facility.setCoordSystem("wgs84");
        facility.setMapCoordSystem("gcj02");
        if (facility.getLat() != null && facility.getLng() != null) {
            Coordinate c = wgs84ToGcj02(facility.getLat().doubleValue(), facility.getLng().doubleValue());
            facility.setMapLat(round(c.lat()));
            facility.setMapLng(round(c.lng()));
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

    public static Map<String, List<Double>> toGcj02NodeCoordinates(Map<String, List<Double>> rawCoordinates) {
        Map<String, List<Double>> transformed = new LinkedHashMap<>();
        if (rawCoordinates == null) return transformed;
        rawCoordinates.forEach((nodeId, coordinate) -> {
            if (coordinate == null || coordinate.size() < 2) return;
            Coordinate c = wgs84ToGcj02(coordinate.get(0), coordinate.get(1));
            transformed.put(nodeId, List.of(c.lat(), c.lng()));
        });
        return transformed;
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
