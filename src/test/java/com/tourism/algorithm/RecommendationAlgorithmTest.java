package com.tourism.algorithm;

import org.junit.jupiter.api.Test;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class RecommendationAlgorithmTest {

    private final RecommendationAlgorithm recommender = new RecommendationAlgorithm();

    // --- cosineSimilarity ---

    @Test
    void cosineSimilarity_identical() {
        Map<String, Double> v1 = Map.of("a", 1.0, "b", 2.0);
        assertEquals(1.0, recommender.cosineSimilarity(v1, v1), 0.001);
    }

    @Test
    void cosineSimilarity_orthogonal() {
        Map<String, Double> v1 = Map.of("a", 1.0);
        Map<String, Double> v2 = Map.of("b", 1.0);
        assertEquals(0.0, recommender.cosineSimilarity(v1, v2), 0.001);
    }

    @Test
    void cosineSimilarity_emptyVectors() {
        assertEquals(0.0, recommender.cosineSimilarity(Map.of(), Map.of("a", 1.0)), 0.001);
        assertEquals(0.0, recommender.cosineSimilarity(null, Map.of("a", 1.0)), 0.001);
    }

    // --- jaccardSimilarity ---

    @Test
    void jaccardSimilarity_sets() {
        assertEquals(0.2, recommender.jaccardSimilarity(
                Set.of("a", "b"), Set.of("b", "c", "d", "e")), 0.01);
    }

    @Test
    void jaccardSimilarity_identicalSets() {
        Set<String> s = Set.of("a", "b", "c");
        assertEquals(1.0, recommender.jaccardSimilarity(s, s), 0.001);
    }

    // --- buildUserProfile ---

    @Test
    void buildUserProfile_withInterests() {
        Map<String, Double> profile = recommender.buildUserProfile(
                List.of("历史", "文化"), List.of("博物馆"), List.of(), List.of());
        assertTrue(profile.containsKey("历史"));
        assertTrue(profile.containsKey("文化"));
    }

    @Test
    void buildUserProfile_emptyAll() {
        Map<String, Double> profile = recommender.buildUserProfile(
                List.of(), List.of(), List.of(), List.of());
        assertTrue(profile.isEmpty());
    }

    // --- buildItemProfile ---

    @Test
    void buildItemProfile_withKeywords() {
        Map<String, Object> item = Map.of(
                "type", (Object) "博物馆",
                "keywords", "[\"历史\",\"文化\"]",
                "rating", 8.0);
        Map<String, Double> profile = recommender.buildItemProfile(item);
        assertTrue(profile.containsKey("博物馆"));
        assertTrue(profile.containsKey("历史"));
        assertTrue(profile.containsKey("_rating_boost"));
    }

    @Test
    void buildItemProfile_nullItem() {
        assertTrue(recommender.buildItemProfile(null).isEmpty());
    }

    // --- contentBasedRecommendation ---

    @Test
    void contentBasedRecommendation_returnsTopK() {
        Map<String, Double> userProfile = Map.of("历史", 1.0, "文化", 0.8);
        List<Map<String, Object>> items = List.of(
                Map.of("id", (Object) "p1", "type", "博物馆", "keywords", "[\"历史\",\"文化\"]", "rating", 9.0),
                Map.of("id", "p2", "type", "公园", "keywords", "[\"自然\"]", "rating", 5.0),
                Map.of("id", "p3", "type", "遗址", "keywords", "[\"历史\"]", "rating", 7.0));
        List<RecommendationAlgorithm.ScoredItem> result = recommender.contentBasedRecommendation(
                userProfile, items, Set.of(), 2);
        assertEquals(2, result.size());
    }

    @Test
    void contentBasedRecommendation_excludesVisited() {
        Map<String, Double> userProfile = Map.of("历史", 1.0);
        List<Map<String, Object>> items = List.of(
                Map.of("id", (Object) "p1", "type", "博物馆", "keywords", "[\"历史\"]", "rating", 9.0),
                Map.of("id", "p2", "type", "公园", "keywords", "[\"自然\"]", "rating", 5.0));
        List<RecommendationAlgorithm.ScoredItem> result = recommender.contentBasedRecommendation(
                userProfile, items, Set.of("p1"), 2);
        assertEquals(1, result.size());
        assertEquals("p2", result.get(0).getId());
    }

    // --- popularityBasedRecommendation ---

    @Test
    void popularityBasedRecommendation_sortsByPopularity() {
        List<Map<String, Object>> items = List.of(
                Map.of("id", (Object) "a", "clickCount", 100, "rating", 8.0, "ratingCount", 50),
                Map.of("id", "b", "clickCount", 10, "rating", 5.0, "ratingCount", 3));
        List<RecommendationAlgorithm.ScoredItem> result = recommender.popularityBasedRecommendation(items, 2);
        assertEquals(2, result.size());
        assertEquals("a", result.get(0).getId());
    }

    @Test
    void popularityBasedRecommendation_empty() {
        assertTrue(recommender.popularityBasedRecommendation(List.of(), 5).isEmpty());
    }

    // --- recommendPlaces ---

    @Test
    void recommendPlaces_fallsBackToPopularityWhenNoProfile() {
        List<Map<String, Object>> places = List.of(
                Map.of("id", (Object) "p1", "type", "公园", "keywords", "[\"自然\"]",
                        "rating", 8.0, "clickCount", 200, "ratingCount", 100));
        List<RecommendationAlgorithm.ScoredItem> result = recommender.recommendPlaces(
                List.of(), List.of(), List.of(), places, 1);
        assertEquals(1, result.size());
        assertEquals("热度推荐", result.get(0).getReason());
    }

    // --- recommendDiaries ---

    @Test
    void recommendDiaries_withInterests() {
        List<Map<String, Object>> diaries = List.of(
                Map.of("id", (Object) "d1", "title", "西湖游记", "type", "旅游", "tags", "[\"西湖\",\"风景\"]",
                        "rating", 9.0, "clickCount", 500, "ratingCount", 100),
                Map.of("id", "d2", "title", "美食探店", "type", "美食", "tags", "[\"美食\"]",
                        "rating", 5.0, "clickCount", 50, "ratingCount", 10));
        List<RecommendationAlgorithm.ScoredItem> result = recommender.recommendDiaries(
                List.of("西湖", "风景"), diaries, 2);
        assertFalse(result.isEmpty());
    }

    @Test
    void recommendDiaries_emptyInterests_fallsBack() {
        List<Map<String, Object>> diaries = List.of(
                Map.of("id", (Object) "d1", "title", "test", "clickCount", 100,
                        "rating", 8.0, "ratingCount", 20));
        List<RecommendationAlgorithm.ScoredItem> result = recommender.recommendDiaries(
                List.of(), diaries, 1);
        assertEquals(1, result.size());
    }
}
