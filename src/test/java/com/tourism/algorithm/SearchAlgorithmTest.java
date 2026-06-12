package com.tourism.algorithm;

import org.junit.jupiter.api.Test;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class SearchAlgorithmTest {

    private final SearchAlgorithm search = new SearchAlgorithm();

    // --- binarySearch ---

    @Test
    void binarySearch_found() {
        List<Map<String, Object>> items = List.of(
                Map.of("id", (Object) 1.0),
                Map.of("id", 2.0),
                Map.of("id", 3.0));
        int idx = search.binarySearch(items, 2.0, item -> (Double) item.get("id"));
        assertEquals(1, idx);
    }

    @Test
    void binarySearch_notFound() {
        List<Map<String, Object>> items = List.of(Map.of("id", (Object) 1.0));
        assertEquals(-1, search.binarySearch(items, 99.0, item -> (Double) item.get("id")));
    }

    @Test
    void binarySearch_emptyList() {
        assertEquals(-1, search.binarySearch(Collections.emptyList(), 5.0, x -> 1.0));
    }

    // --- jaccardSimilarity ---

    @Test
    void jaccardSimilarity_identical() {
        assertEquals(1.0, search.jaccardSimilarity("hello", "hello"), 0.001);
    }

    @Test
    void jaccardSimilarity_noOverlap() {
        assertEquals(0.0, search.jaccardSimilarity("abc", "xyz"), 0.001);
    }

    @Test
    void jaccardSimilarity_nullInput() {
        assertEquals(0.0, search.jaccardSimilarity(null, "test"), 0.001);
        assertEquals(0.0, search.jaccardSimilarity("test", null), 0.001);
    }

    // --- ngramJaccardSimilarity ---

    @Test
    void ngramJaccardSimilarity_identical() {
        double sim = search.ngramJaccardSimilarity("hello", "hello", 2);
        assertEquals(1.0, sim, 0.001);
    }

    @Test
    void ngramJaccardSimilarity_different() {
        double sim = search.ngramJaccardSimilarity("hello", "world", 2);
        assertTrue(sim < 1.0);
    }

    // --- linearSearch ---

    @Test
    void linearSearch_findsMatching() {
        List<Map<String, Object>> items = List.of(
                Map.of("name", (Object) "Alice"),
                Map.of("name", "Bob"),
                Map.of("name", "Alice"));
        List<Map<String, Object>> result = search.linearSearch(items,
                item -> item.get("name"), "Alice");
        assertEquals(2, result.size());
    }

    // --- keywordSearch ---

    @Test
    void keywordSearch_matchesKeywords() {
        List<Map<String, Object>> items = List.of(
                Map.of("title", (Object) "西湖美景攻略"),
                Map.of("title", "北京故宫游记"));
        List<Map<String, Object>> result = search.keywordSearch(
                items, List.of("西湖"), List.of("title"));
        assertEquals(1, result.size());
        assertEquals(1, ((Number) result.get(0).get("_matchedKeywords")).intValue());
    }

    // --- fuzzySearch ---

    @Test
    void fuzzySearch_exactMatch() {
        List<Map<String, Object>> items = List.of(
                Map.of("name", (Object) "西湖"),
                Map.of("name", "故宫"));
        List<Map<String, Object>> result = search.fuzzySearch(
                items, "西湖", List.of("name"), 0.3);
        assertEquals(1, result.size());
        assertEquals(1.0, (Double) result.get(0).get("_similarity"), 0.001);
    }

    // --- fullTextSearch ---

    @Test
    void fullTextSearch_relevantResults() {
        List<Map<String, Object>> items = List.of(
                Map.of("content", (Object) "apple banana cherry"),
                Map.of("content", "dog cat mouse"));
        List<Map<String, Object>> result = search.fullTextSearch(items, "apple banana", "content");
        assertFalse(result.isEmpty());
        assertTrue((Double) result.get(0).get("_tfidfScore") > 0);
    }

    @Test
    void fullTextSearch_emptyQuery() {
        List<Map<String, Object>> items = List.of(Map.of("content", (Object) "test"));
        assertTrue(search.fullTextSearch(items, "", "content").isEmpty());
    }

    // --- buildHashIndex ---

    @Test
    void buildHashIndex_groupsByKey() {
        List<Map<String, Object>> items = List.of(
                Map.of("type", (Object) "A"),
                Map.of("type", "B"),
                Map.of("type", "A"));
        Map<String, List<Map<String, Object>>> index = search.buildHashIndex(
                items, item -> (String) item.get("type"));
        assertEquals(2, index.get("A").size());
        assertEquals(1, index.get("B").size());
    }
}
