package com.tourism.algorithm;

import org.junit.jupiter.api.Test;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class SortingAlgorithmTest {

    private final SortingAlgorithm sorter = new SortingAlgorithm();

    // --- quickSort ---

    @Test
    void quickSort_ascending() {
        List<Map<String, Object>> items = List.of(
                Map.of("score", (Object) 3.0),
                Map.of("score", 1.0),
                Map.of("score", 5.0));
        List<Map<String, Object>> sorted = sorter.quickSort(items,
                item -> (Double) item.get("score"), false);
        assertEquals(1.0, (Double) sorted.get(0).get("score"));
        assertEquals(3.0, (Double) sorted.get(1).get("score"));
        assertEquals(5.0, (Double) sorted.get(2).get("score"));
    }

    @Test
    void quickSort_descending() {
        List<Map<String, Object>> items = List.of(
                Map.of("score", (Object) 3.0),
                Map.of("score", 1.0),
                Map.of("score", 5.0));
        List<Map<String, Object>> sorted = sorter.quickSort(items,
                item -> (Double) item.get("score"), true);
        assertEquals(5.0, (Double) sorted.get(0).get("score"));
        assertEquals(1.0, (Double) sorted.get(2).get("score"));
    }

    @Test
    void quickSort_emptyList() {
        assertTrue(sorter.quickSort(Collections.emptyList(), x -> 1.0, false).isEmpty());
    }

    @Test
    void quickSort_nullList() {
        assertTrue(sorter.quickSort(null, x -> 1.0, false).isEmpty());
    }

    // --- heapSort ---

    @Test
    void heapSort_preservesAllElements() {
        List<Map<String, Object>> items = List.of(
                Map.of("val", (Object) 3.0),
                Map.of("val", 1.0),
                Map.of("val", 2.0));
        List<Map<String, Object>> sorted = sorter.heapSort(items,
                item -> (Double) item.get("val"), false);
        assertEquals(3, sorted.size());
        double sum = sorted.stream().mapToDouble(m -> (Double) m.get("val")).sum();
        assertEquals(6.0, sum, 0.001);
    }

    // --- mergeSort ---

    @Test
    void mergeSort_ascending() {
        List<Map<String, Object>> items = List.of(
                Map.of("val", (Object) 3.0),
                Map.of("val", 1.0),
                Map.of("val", 2.0));
        List<Map<String, Object>> sorted = sorter.mergeSort(items,
                item -> (Double) item.get("val"), false);
        assertEquals(1.0, (Double) sorted.get(0).get("val"));
    }

    // --- topKSort ---

    @Test
    void topKSort_returnsTopK() {
        List<Map<String, Object>> items = new ArrayList<>();
        for (int i = 1; i <= 100; i++) {
            items.add(Map.of("score", (Object) (double) i));
        }
        List<Map<String, Object>> top = sorter.topKSort(items,
                item -> (Double) item.get("score"), 5, true);
        assertEquals(5, top.size());
        assertEquals(100.0, (Double) top.get(0).get("score"));
        assertEquals(96.0, (Double) top.get(4).get("score"));
    }

    // --- multiKeySort ---

    @Test
    void multiKeySort() {
        List<Map<String, Object>> items = List.of(
                Map.of("a", (Object) 1.0, "b", 10.0),
                Map.of("a", 2.0, "b", 5.0));
        List<Map<String, Object>> sorted = sorter.multiKeySort(items,
                List.of(item -> (Double) item.get("a"), item -> (Double) item.get("b")),
                List.of(0.5, 0.5), true);
        // item0: a=1,b=10 → 5.5, item1: a=2,b=5 → 3.5. Desc: item0 first
        assertEquals(1.0, (Double) sorted.get(0).get("a"), 0.01);
        assertEquals(2.0, (Double) sorted.get(1).get("a"), 0.01);
    }

    // --- haversineDistance ---

    @Test
    void haversineDistance_samePoint() {
        assertEquals(0.0, SortingAlgorithm.haversineDistance(30.0, 120.0, 30.0, 120.0), 0.01);
    }

    @Test
    void haversineDistance_knownDistance() {
        // Beijing (39.9, 116.4) to Shanghai (31.2, 121.5) ≈ 1068 km
        double dist = SortingAlgorithm.haversineDistance(39.9, 116.4, 31.2, 121.5);
        assertTrue(dist > 1_000_000 && dist < 1_200_000,
                "Expected ~1068km, got " + dist + "m");
    }

    // --- sortPlacesByRecommendation ---

    @Test
    void sortPlacesByRecommendation_withInterests() {
        List<Map<String, Object>> places = List.of(
                Map.of("rating", (Object) 4.5, "clickCount", 100, "keywords", "历史,文化", "features", "博物馆"),
                Map.of("rating", 3.0, "clickCount", 10, "keywords", "自然,公园", "features", "湖泊"));
        List<Map<String, Object>> result = sorter.sortPlacesByRecommendation(
                places, List.of("历史", "文化"), 2);
        assertEquals(2, result.size());
    }

    // --- sortFacilitiesByDistance ---

    @Test
    void sortFacilitiesByDistance() {
        List<Map<String, Object>> facilities = List.of(
                Map.of("lat", (Object) 30.1, "lng", 120.1),
                Map.of("lat", 30.0, "lng", 120.0));
        List<Map<String, Object>> sorted = sorter.sortFacilitiesByDistance(facilities, 30.0, 120.0);
        // Second item is at (30.0,120.0) = target, should be first
        assertEquals(30.0, (Double) sorted.get(0).get("lat"), 0.01);
    }
}
