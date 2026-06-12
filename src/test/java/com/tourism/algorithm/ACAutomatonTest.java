package com.tourism.algorithm;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ACAutomatonTest {

    private ACAutomaton ac;

    @BeforeEach
    void setUp() {
        ac = new ACAutomaton();
    }

    @Test
    void search_singlePattern() {
        ac.build(Arrays.asList("test"));
        List<ACAutomaton.MatchResult> results = ac.search("this is a test string");
        assertEquals(1, results.size());
        assertEquals("test", results.get(0).getPattern());
        assertEquals(10, results.get(0).getPosition());
    }

    @Test
    void search_multiplePatterns() {
        ac.build(Arrays.asList("he", "she", "his", "hers"));
        List<ACAutomaton.MatchResult> results = ac.search("ushers");
        assertEquals(3, results.size()); // she, he, hers
    }

    @Test
    void search_noMatch() {
        ac.build(Arrays.asList("abc", "xyz"));
        List<ACAutomaton.MatchResult> results = ac.search("hello world");
        assertTrue(results.isEmpty());
    }

    @Test
    void filterText_replacesSensitiveWords() {
        ac.build(Arrays.asList("敏感词", "违禁"));
        ACAutomaton.FilterResult result = ac.filterText("这是一段包含敏感词的文本，还有违禁内容");
        assertTrue(result.getFilteredText().contains("***"));
        assertTrue(result.getDetectedWords().contains("敏感词"));
        assertTrue(result.getDetectedWords().contains("违禁"));
        assertEquals(2, result.getTotalMatches());
    }

    @Test
    void filterText_noSensitiveWords() {
        ac.build(Arrays.asList("敏感词"));
        ACAutomaton.FilterResult result = ac.filterText("正常文本");
        assertEquals("正常文本", result.getFilteredText());
        assertEquals(0, result.getTotalMatches());
    }

    @Test
    void filterText_emptyText() {
        ac.build(Arrays.asList("test"));
        ACAutomaton.FilterResult result = ac.filterText("");
        assertEquals("", result.getFilteredText());
        assertEquals(0, result.getTotalMatches());
    }

    @Test
    void replacePatterns() {
        ac.build(Arrays.asList("bad", "worse"));
        String result = ac.replacePatterns("this is bad and worse thing", "***");
        assertEquals("this is *** and *** thing", result);
    }

    @Test
    void searchWithDetails() {
        ac.build(Arrays.asList("hello", "hello", "world"));
        ACAutomaton.SearchDetail detail = ac.searchWithDetails("hello world hello");
        assertTrue(detail.getTotalMatches() >= 2);
    }
}
