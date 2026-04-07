package com.tourism.controller;

import com.tourism.algorithm.*;
import com.tourism.utils.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * 算法能力 API
 * 提供搜索、推荐、压缩、敏感词过滤等算法功能
 */
@Tag(name = "AlgorithmController", description = "算法服务：搜索/推荐/压缩/敏感词过滤")
@RestController
@RequestMapping("/api/algorithm")
public class AlgorithmController {

    @Autowired
    private SearchAlgorithm searchAlgorithm;

    @Autowired
    private RecommendationAlgorithm recommendationAlgorithm;

    @Autowired
    private HuffmanCompression huffmanCompression;

    @Autowired
    private ACAutomaton acAutomaton;

    @Autowired
    private SortingAlgorithm sortingAlgorithm;

    // ==================== 搜索 ====================

    /**
     * 统一搜索接口
     * 自动选择策略：关键词 → 模糊 → TF-IDF
     */
    @Operation(summary = "统一搜索（自动策略）")
    @PostMapping("/search")
    public Result<?> search(@RequestBody Map<String, Object> request) {
        String query = (String) request.get("query");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) request.get("items");
        @SuppressWarnings("unchecked")
        List<String> searchFields = (List<String>) request.getOrDefault("searchFields",
                List.of("name", "description", "keywords"));
        String contentField = (String) request.get("contentField");

        if (query == null || query.isEmpty()) return Result.fail("搜索词(query)不能为空");
        if (items == null) return Result.fail("数据列表(items)不能为空");

        List<Map<String, Object>> results = searchAlgorithm.unifiedSearch(items, query, searchFields, contentField);
        return Result.success(Map.of("results", results, "total", results.size(), "query", query));
    }

    /**
     * 模糊搜索
     */
    @Operation(summary = "Jaccard模糊搜索")
    @PostMapping("/search/fuzzy")
    public Result<?> fuzzySearch(@RequestBody Map<String, Object> request) {
        String query = (String) request.get("query");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) request.get("items");
        @SuppressWarnings("unchecked")
        List<String> searchFields = (List<String>) request.getOrDefault("searchFields", List.of("name"));
        double threshold = ((Number) request.getOrDefault("threshold", 0.2)).doubleValue();

        if (query == null || items == null) return Result.fail("query和items不能为空");
        List<Map<String, Object>> results = searchAlgorithm.fuzzySearch(items, query, searchFields, threshold);
        return Result.success(Map.of("results", results, "total", results.size()));
    }

    /**
     * TF-IDF 全文搜索
     */
    @Operation(summary = "TF-IDF 全文搜索")
    @PostMapping("/search/fulltext")
    public Result<?> fullTextSearch(@RequestBody Map<String, Object> request) {
        String query = (String) request.get("query");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) request.get("items");
        String contentField = (String) request.getOrDefault("contentField", "content");

        if (query == null || items == null) return Result.fail("query和items不能为空");
        List<Map<String, Object>> results = searchAlgorithm.fullTextSearch(items, query, contentField);
        return Result.success(Map.of("results", results, "total", results.size()));
    }

    // ==================== 推荐 ====================

    /**
     * 场所推荐（混合策略）
     */
    @Operation(summary = "场所推荐（混合：内容+热度）")
    @PostMapping("/recommend/places")
    public Result<?> recommendPlaces(@RequestBody Map<String, Object> request) {
        @SuppressWarnings("unchecked")
        List<String> userInterests = (List<String>) request.get("userInterests");
        @SuppressWarnings("unchecked")
        List<String> userFavCategories = (List<String>) request.get("userFavCategories");
        @SuppressWarnings("unchecked")
        List<String> visitedPlaceIds = (List<String>) request.get("visitedPlaceIds");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> allPlaces = (List<Map<String, Object>>) request.get("allPlaces");
        int topK = ((Number) request.getOrDefault("topK", 12)).intValue();

        if (allPlaces == null || allPlaces.isEmpty()) return Result.fail("场所数据(allPlaces)不能为空");

        List<RecommendationAlgorithm.ScoredItem> results = recommendationAlgorithm.recommendPlaces(
                userInterests, userFavCategories, visitedPlaceIds, allPlaces, topK);

        List<Map<String, Object>> data = new ArrayList<>();
        for (RecommendationAlgorithm.ScoredItem si : results) {
            Map<String, Object> item = new LinkedHashMap<>(si.getItem());
            item.put("_recommScore", si.getScore());
            item.put("_recommReason", si.getReason());
            data.add(item);
        }
        return Result.success(Map.of("recommendations", data, "total", data.size()));
    }

    /**
     * 日记推荐（基于内容）
     */
    @Operation(summary = "日记推荐（内容过滤）")
    @PostMapping("/recommend/diaries")
    public Result<?> recommendDiaries(@RequestBody Map<String, Object> request) {
        @SuppressWarnings("unchecked")
        List<String> userInterests = (List<String>) request.get("userInterests");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> allDiaries = (List<Map<String, Object>>) request.get("allDiaries");
        int topK = ((Number) request.getOrDefault("topK", 12)).intValue();

        if (allDiaries == null || allDiaries.isEmpty()) return Result.fail("日记数据(allDiaries)不能为空");

        List<RecommendationAlgorithm.ScoredItem> results =
                recommendationAlgorithm.recommendDiaries(userInterests, allDiaries, topK);

        List<Map<String, Object>> data = new ArrayList<>();
        for (RecommendationAlgorithm.ScoredItem si : results) {
            Map<String, Object> item = new LinkedHashMap<>(si.getItem());
            item.put("_recommScore", si.getScore());
            data.add(item);
        }
        return Result.success(Map.of("recommendations", data, "total", data.size()));
    }

    /**
     * 热度推荐（无需用户画像）
     */
    @Operation(summary = "热度推荐（不依赖用户画像）")
    @PostMapping("/recommend/popular")
    public Result<?> popularRecommend(@RequestBody Map<String, Object> request) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) request.get("items");
        int topK = ((Number) request.getOrDefault("topK", 12)).intValue();

        if (items == null || items.isEmpty()) return Result.fail("数据(items)不能为空");

        List<RecommendationAlgorithm.ScoredItem> results =
                recommendationAlgorithm.popularityBasedRecommendation(items, topK);

        List<Map<String, Object>> data = new ArrayList<>();
        for (RecommendationAlgorithm.ScoredItem si : results) {
            Map<String, Object> item = new LinkedHashMap<>(si.getItem());
            item.put("_popularityScore", si.getScore());
            data.add(item);
        }
        return Result.success(Map.of("recommendations", data, "total", data.size()));
    }

    // ==================== 压缩 ====================

    /**
     * 日记内容压缩
     */
    @Operation(summary = "日记内容 Huffman 压缩")
    @PostMapping("/compress")
    public Result<?> compress(@RequestBody Map<String, Object> request) {
        String content = (String) request.get("content");
        if (content == null || content.isEmpty()) return Result.fail("内容(content)不能为空");

        Map<String, Object> result = huffmanCompression.compressDiaryContent(content);
        return Result.success(result);
    }

    /**
     * 日记内容解压
     */
    @Operation(summary = "日记内容 Huffman 解压")
    @PostMapping("/decompress")
    public Result<?> decompress(@RequestBody Map<String, Object> request) {
        @SuppressWarnings("unchecked")
        Map<String, Object> compressedInfo = (Map<String, Object>) request.get("compressedInfo");
        if (compressedInfo == null) return Result.fail("压缩信息(compressedInfo)不能为空");

        String original = huffmanCompression.decompressDiaryContent(compressedInfo);
        return Result.success(Map.of("content", original, "length", original.length()));
    }

    /**
     * 获取压缩统计信息
     */
    @Operation(summary = "获取文本压缩统计")
    @PostMapping("/compression-stats")
    public Result<?> compressionStats(@RequestBody Map<String, Object> request) {
        String content = (String) request.get("content");
        if (content == null || content.isEmpty()) return Result.fail("内容(content)不能为空");

        Map<String, Object> stats = huffmanCompression.getCompressionStats(content);
        return Result.success(stats);
    }

    // ==================== 敏感词过滤（AC自动机） ====================

    /**
     * 初始化敏感词词库
     */
    @Operation(summary = "初始化 AC 自动机敏感词库")
    @PostMapping("/ac-automaton/build")
    public Result<?> buildACAutomaton(@RequestBody Map<String, Object> request) {
        @SuppressWarnings("unchecked")
        List<String> patterns = (List<String>) request.get("patterns");
        if (patterns == null || patterns.isEmpty()) return Result.fail("模式列表(patterns)不能为空");

        acAutomaton.build(patterns);
        return Result.success("AC自动机构建完成，共 " + patterns.size() + " 个模式");
    }

    /**
     * 敏感词过滤
     */
    @Operation(summary = "敏感词过滤（AC自动机）")
    @PostMapping("/filter-text")
    public Result<?> filterText(@RequestBody Map<String, Object> request) {
        String text = (String) request.get("text");
        @SuppressWarnings("unchecked")
        List<String> patterns = (List<String>) request.get("patterns");

        if (text == null) return Result.fail("文本(text)不能为空");

        // 如果请求里带了新词库，先重建
        if (patterns != null && !patterns.isEmpty()) {
            acAutomaton.build(patterns);
        }

        ACAutomaton.FilterResult result = acAutomaton.filterText(text);
        return Result.success(Map.of(
                "filteredText", result.getFilteredText(),
                "detectedWords", result.getDetectedWords(),
                "totalMatches", result.getTotalMatches(),
                "isClean", result.getTotalMatches() == 0
        ));
    }

    /**
     * 文本搜索（AC自动机多模式匹配）
     */
    @Operation(summary = "AC自动机多模式文本搜索")
    @PostMapping("/ac-automaton/search")
    public Result<?> acSearch(@RequestBody Map<String, Object> request) {
        String text = (String) request.get("text");
        @SuppressWarnings("unchecked")
        List<String> patterns = (List<String>) request.get("patterns");

        if (text == null) return Result.fail("文本(text)不能为空");
        if (patterns != null && !patterns.isEmpty()) acAutomaton.build(patterns);

        ACAutomaton.SearchDetail detail = acAutomaton.searchWithDetails(text);
        return Result.success(Map.of(
                "matches", detail.getMatches(),
                "patternCounts", detail.getPatternCounts(),
                "totalMatches", detail.getTotalMatches()
        ));
    }

    // ==================== 排序 ====================

    /**
     * 场所综合排序
     */
    @Operation(summary = "场所综合排序（评分+热度+兴趣）")
    @PostMapping("/sort/places")
    public Result<?> sortPlaces(@RequestBody Map<String, Object> request) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> places = (List<Map<String, Object>>) request.get("places");
        @SuppressWarnings("unchecked")
        List<String> userInterests = (List<String>) request.getOrDefault("userInterests", Collections.emptyList());
        int topK = ((Number) request.getOrDefault("topK", 20)).intValue();

        if (places == null || places.isEmpty()) return Result.fail("场所列表(places)不能为空");

        List<Map<String, Object>> sorted = sortingAlgorithm.sortPlacesByRecommendation(places, userInterests, topK);
        return Result.success(Map.of("sorted", sorted, "total", sorted.size()));
    }

    /**
     * 日记相关度排序
     */
    @Operation(summary = "日记相关度排序")
    @PostMapping("/sort/diaries")
    public Result<?> sortDiaries(@RequestBody Map<String, Object> request) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> diaries = (List<Map<String, Object>>) request.get("diaries");
        String placeId = (String) request.get("placeId");
        @SuppressWarnings("unchecked")
        List<String> userInterests = (List<String>) request.getOrDefault("userInterests", Collections.emptyList());
        int topK = ((Number) request.getOrDefault("topK", 20)).intValue();

        if (diaries == null || diaries.isEmpty()) return Result.fail("日记列表(diaries)不能为空");

        List<Map<String, Object>> sorted = sortingAlgorithm.sortDiariesByRelevance(diaries, placeId, userInterests, topK);
        return Result.success(Map.of("sorted", sorted, "total", sorted.size()));
    }
}
