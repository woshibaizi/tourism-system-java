package com.tourism.algorithm;

import org.junit.jupiter.api.Test;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class TreapTopKTest {

    @Test
    void insert_upToK() {
        TreapTopK<String> treap = new TreapTopK<>(3);
        treap.insert("a", 1.0);
        treap.insert("b", 2.0);
        treap.insert("c", 3.0);
        assertEquals(3, treap.getSize());
        assertTrue(treap.isFull());
    }

    @Test
    void getTopK_descendingByScore() {
        TreapTopK<String> treap = new TreapTopK<>(3);
        treap.insert("low", 1.0);
        treap.insert("high", 10.0);
        treap.insert("mid", 5.0);

        List<TreapTopK.ScoredItem<String>> result = treap.getTopK();
        assertEquals(3, result.size());
        assertEquals(10.0, result.get(0).getScore(), 0.001);
        assertEquals("high", result.get(0).getItem());
    }

    @Test
    void insert_beyondK_replacesLowest() {
        TreapTopK<String> treap = new TreapTopK<>(3);
        treap.insert("a", 1.0);
        treap.insert("b", 2.0);
        treap.insert("c", 3.0);
        // Now full, insert higher score should replace lowest (1.0)
        treap.insert("d", 4.0);

        assertEquals(3, treap.getSize());
        double minScore = treap.getMinScore();
        assertTrue(minScore > 1.0, "Lowest should have been replaced, min is " + minScore);
    }

    @Test
    void insert_belowOrEqualMin_ignored() {
        TreapTopK<String> treap = new TreapTopK<>(3);
        treap.insert("a", 3.0);
        treap.insert("b", 5.0);
        treap.insert("c", 7.0);
        treap.insert("d", 1.0); // below min
        assertEquals(3, treap.getSize());
        assertTrue(treap.getMinScore() >= 3.0);
    }

    @Test
    void getMinScore_empty() {
        TreapTopK<String> treap = new TreapTopK<>(3);
        assertEquals(Double.NEGATIVE_INFINITY, treap.getMinScore());
    }

    @Test
    void topKRecommendations_smallDataset() {
        List<String> items = List.of("a", "b", "c", "d", "e");
        List<TreapTopK.ScoredItem<String>> result = TreapTopK.topKRecommendations(
                items, item -> (double) item.charAt(0), 3);
        assertEquals(3, result.size());
        assertEquals("e", result.get(0).getItem()); // highest char = highest score
    }

    @Test
    void topKRecommendations_largeDataset() {
        java.util.List<Integer> items = new java.util.ArrayList<>();
        for (int i = 1; i <= 200; i++) {
            items.add(i);
        }
        List<TreapTopK.ScoredItem<Integer>> result = TreapTopK.topKRecommendations(
                items, Integer::doubleValue, 5);
        assertEquals(5, result.size());
        assertEquals(200, result.get(0).getItem());
    }

    @Test
    void streamingTopK() {
        List<TreapTopK.ScoredItem<String>> stream = List.of(
                new TreapTopK.ScoredItem<>("a", 1.0),
                new TreapTopK.ScoredItem<>("b", 5.0),
                new TreapTopK.ScoredItem<>("c", 3.0),
                new TreapTopK.ScoredItem<>("d", 4.0));
        List<TreapTopK.ScoredItem<String>> result = TreapTopK.streamingTopK(stream, 2);
        assertEquals(2, result.size());
        assertEquals("b", result.get(0).getItem());
    }

    @Test
    void emptyInput() {
        assertTrue(TreapTopK.topKRecommendations(List.of(), x -> 1.0, 5).isEmpty());
        assertTrue(TreapTopK.topKRecommendations(null, x -> 1.0, 5).isEmpty());
    }
}
