package com.tourism.algorithm;

import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 推荐算法
 * 包含内容推荐、协同过滤、混合推荐和热度推荐
 * 采用方案A：无状态纯逻辑，数据由Service层传入
 */
@Component
public class RecommendationAlgorithm {

    // ==================== 结果类 ====================

    public static class ScoredItem {
        private final String id;
        private final Map<String, Object> item;
        private final double score;
        private final String reason;

        public ScoredItem(String id, Map<String, Object> item, double score, String reason) {
            this.id = id;
            this.item = item;
            this.score = score;
            this.reason = reason;
        }

        public String getId() { return id; }
        public Map<String, Object> getItem() { return item; }
        public double getScore() { return score; }
        public String getReason() { return reason; }
    }

    // ==================== 相似度计算 ====================

    /**
     * 余弦相似度（向量空间模型）
     */
    public double cosineSimilarity(Map<String, Double> vec1, Map<String, Double> vec2) {
        if (vec1 == null || vec2 == null || vec1.isEmpty() || vec2.isEmpty()) return 0;

        double dotProduct = 0;
        double norm1 = 0;
        double norm2 = 0;

        for (Map.Entry<String, Double> entry : vec1.entrySet()) {
            double v2 = vec2.getOrDefault(entry.getKey(), 0.0);
            dotProduct += entry.getValue() * v2;
            norm1 += entry.getValue() * entry.getValue();
        }
        for (double v : vec2.values()) {
            norm2 += v * v;
        }

        if (norm1 == 0 || norm2 == 0) return 0;
        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }

    /**
     * Jaccard相似度（集合重叠度）
     */
    public double jaccardSimilarity(Set<String> set1, Set<String> set2) {
        if (set1 == null || set2 == null || set1.isEmpty() || set2.isEmpty()) return 0;
        Set<String> intersection = new HashSet<>(set1);
        intersection.retainAll(set2);
        Set<String> union = new HashSet<>(set1);
        union.addAll(set2);
        return union.isEmpty() ? 0 : (double) intersection.size() / union.size();
    }

    // ==================== 用户/物品画像构建 ====================

    /**
     * 构建用户画像向量
     *
     * @param userInterests      用户兴趣标签列表（来自SysUser.interests）
     * @param userFavCategories  用户偏好分类列表
     * @param visitedPlaceIds    用户历史访问场所ID列表
     * @param allPlaces          全量场所数据（用于提取关键词权重）
     * @return 用户画像向量
     */
    public Map<String, Double> buildUserProfile(List<String> userInterests,
                                                 List<String> userFavCategories,
                                                 List<String> visitedPlaceIds,
                                                 List<Map<String, Object>> allPlaces) {
        Map<String, Double> profile = new HashMap<>();

        // 显式兴趣标签权重1.5
        if (userInterests != null) {
            for (String interest : userInterests) {
                profile.merge(interest, 1.5, Double::sum);
            }
        }

        // 偏好分类权重1.2
        if (userFavCategories != null) {
            for (String cat : userFavCategories) {
                profile.merge(cat, 1.2, Double::sum);
            }
        }

        // 从历史访问场所中提取关键词权重1.0
        if (visitedPlaceIds != null && allPlaces != null) {
            Set<String> visitedSet = new HashSet<>(visitedPlaceIds);
            for (Map<String, Object> place : allPlaces) {
                String placeId = getString(place, "id", "");
                if (visitedSet.contains(placeId)) {
                    // 提取关键词
                    String keywords = getString(place, "keywords", "");
                    String features = getString(place, "features", "");
                    for (String tag : parseJsonArray(keywords)) {
                        profile.merge(tag, 1.0, Double::sum);
                    }
                    for (String tag : parseJsonArray(features)) {
                        profile.merge(tag, 0.8, Double::sum);
                    }
                    String type = getString(place, "type", "");
                    if (!type.isEmpty()) {
                        profile.merge(type, 0.5, Double::sum);
                    }
                }
            }
        }

        // 归一化
        double maxVal = profile.values().stream().mapToDouble(Double::doubleValue).max().orElse(1.0);
        if (maxVal > 0) {
            profile.replaceAll((k, v) -> v / maxVal);
        }
        return profile;
    }

    /**
     * 构建物品画像向量（场所或日记）
     */
    public Map<String, Double> buildItemProfile(Map<String, Object> item) {
        Map<String, Double> profile = new HashMap<>();
        if (item == null) return profile;

        // 类型权重1.0
        String type = getString(item, "type", "");
        if (!type.isEmpty()) profile.put(type, 1.0);

        // 关键词权重0.8
        for (String tag : parseJsonArray(getString(item, "keywords", ""))) {
            profile.merge(tag, 0.8, Double::sum);
        }

        // 特色标签权重0.6
        for (String tag : parseJsonArray(getString(item, "features", ""))) {
            profile.merge(tag, 0.6, Double::sum);
        }

        // 标签权重0.7（日记专用）
        for (String tag : parseJsonArray(getString(item, "tags", ""))) {
            profile.merge(tag, 0.7, Double::sum);
        }

        // 评分归一化影响 (0~10 → 0~1)
        double rating = getDouble(item, "rating", 0);
        if (rating > 0) profile.put("_rating_boost", rating / 10.0);

        return profile;
    }

    // ==================== 内容推荐 ====================

    /**
     * 基于内容的推荐
     *
     * @param userProfile    用户画像向量
     * @param items          候选物品列表
     * @param excludeIds     排除的物品ID（已访问过）
     * @param topK           返回前K个
     * @return 推荐结果（按相似度降序）
     */
    public List<ScoredItem> contentBasedRecommendation(
            Map<String, Double> userProfile,
            List<Map<String, Object>> items,
            Set<String> excludeIds,
            int topK) {

        if (userProfile == null || items == null || items.isEmpty()) return Collections.emptyList();

        TreapTopK<Map<String, Object>> treap = new TreapTopK<>(topK);

        for (Map<String, Object> item : items) {
            String id = getString(item, "id", "");
            if (excludeIds != null && excludeIds.contains(id)) continue;

            Map<String, Double> itemProfile = buildItemProfile(item);
            double similarity = cosineSimilarity(userProfile, itemProfile);

            // 评分加成（直接使用评分提升分数）
            double rating = getDouble(item, "rating", 0);
            double boostScore = similarity * 0.7 + (rating / 10.0) * 0.3;

            treap.insert(item, boostScore);
        }

        return treap.getTopK().stream()
                .map(si -> new ScoredItem(
                        getString(si.getItem(), "id", ""),
                        si.getItem(),
                        si.getScore(),
                        "内容推荐"
                ))
                .collect(Collectors.toList());
    }

    // ==================== 协同过滤 ====================

    /**
     * 基于用户的协同过滤推荐
     *
     * @param targetUserProfile   目标用户画像
     * @param targetVisitedIds    目标用户已访问ID集合
     * @param allUsersProfiles    所有用户的画像列表（每个元素包含userId、profile、visitedIds）
     * @param allItems            全量物品数据
     * @param topK                返回前K个
     * @return 推荐结果
     */
    public List<ScoredItem> collaborativeFilteringRecommendation(
            Map<String, Double> targetUserProfile,
            Set<String> targetVisitedIds,
            List<Map<String, Object>> allUsersProfiles,
            List<Map<String, Object>> allItems,
            int topK) {

        if (targetUserProfile == null || allUsersProfiles == null || allItems.isEmpty()) {
            return Collections.emptyList();
        }

        // 计算与每个用户的相似度
        List<double[]> userSimilarities = new ArrayList<>();
        for (int i = 0; i < allUsersProfiles.size(); i++) {
            @SuppressWarnings("unchecked")
            Map<String, Double> otherProfile = (Map<String, Double>) allUsersProfiles.get(i).get("profile");
            if (otherProfile != null) {
                double sim = cosineSimilarity(targetUserProfile, otherProfile);
                userSimilarities.add(new double[]{i, sim});
            }
        }

        // 取相似度top-20的邻居用户
        userSimilarities.sort((a, b) -> Double.compare(b[1], a[1]));
        List<double[]> topNeighbors = userSimilarities.subList(0, Math.min(20, userSimilarities.size()));

        // 统计邻居用户访问过但目标用户没有访问过的物品
        Map<String, Double> itemScores = new HashMap<>();
        for (double[] neighbor : topNeighbors) {
            int idx = (int) neighbor[0];
            double similarity = neighbor[1];
            if (similarity <= 0) continue;

            @SuppressWarnings("unchecked")
            List<String> neighborVisited = (List<String>) allUsersProfiles.get(idx).get("visitedIds");
            if (neighborVisited == null) continue;

            for (String itemId : neighborVisited) {
                if (targetVisitedIds == null || !targetVisitedIds.contains(itemId)) {
                    itemScores.merge(itemId, similarity, Double::sum);
                }
            }
        }

        // 构建物品ID→物品映射
        Map<String, Map<String, Object>> itemMap = new HashMap<>();
        for (Map<String, Object> item : allItems) {
            String id = getString(item, "id", "");
            if (!id.isEmpty()) itemMap.put(id, item);
        }

        // 返回Top-K
        TreapTopK<Map<String, Object>> treap = new TreapTopK<>(topK);
        for (Map.Entry<String, Double> entry : itemScores.entrySet()) {
            Map<String, Object> item = itemMap.get(entry.getKey());
            if (item != null) {
                treap.insert(item, entry.getValue());
            }
        }

        return treap.getTopK().stream()
                .map(si -> new ScoredItem(
                        getString(si.getItem(), "id", ""),
                        si.getItem(),
                        si.getScore(),
                        "协同过滤"
                ))
                .collect(Collectors.toList());
    }

    // ==================== 混合推荐 ====================

    /**
     * 混合推荐（内容推荐 + 协同过滤 + 热度）
     *
     * @param userProfile        用户画像
     * @param targetVisitedIds   目标用户已访问ID
     * @param allItems           全量物品
     * @param cfResults          协同过滤推荐结果（可为null）
     * @param topK               返回Top-K
     * @param contentWeight      内容推荐权重
     * @param cfWeight           协同过滤权重
     * @param popularityWeight   热度权重
     * @return 混合推荐结果
     */
    public List<ScoredItem> hybridRecommendation(
            Map<String, Double> userProfile,
            Set<String> targetVisitedIds,
            List<Map<String, Object>> allItems,
            List<ScoredItem> cfResults,
            int topK,
            double contentWeight,
            double cfWeight,
            double popularityWeight) {

        // 内容推荐分
        List<ScoredItem> contentResults = contentBasedRecommendation(
                userProfile, allItems, targetVisitedIds, allItems.size());
        Map<String, Double> contentScores = contentResults.stream()
                .collect(Collectors.toMap(ScoredItem::getId, ScoredItem::getScore, Double::max));

        // 协同过滤分
        Map<String, Double> cfScores = new HashMap<>();
        if (cfResults != null) {
            cfResults.forEach(si -> cfScores.put(si.getId(), si.getScore()));
        }

        // 热度分（归一化点击量）
        double maxClicks = allItems.stream()
                .mapToDouble(item -> getDouble(item, "clickCount", 0))
                .max().orElse(1.0);

        // 合并分数
        TreapTopK<Map<String, Object>> treap = new TreapTopK<>(topK);
        Map<String, Map<String, Object>> itemMap = new HashMap<>();
        for (Map<String, Object> item : allItems) {
            String id = getString(item, "id", "");
            if (targetVisitedIds != null && targetVisitedIds.contains(id)) continue;
            itemMap.put(id, item);
        }

        for (Map.Entry<String, Map<String, Object>> entry : itemMap.entrySet()) {
            String id = entry.getKey();
            Map<String, Object> item = entry.getValue();

            double contentScore = contentScores.getOrDefault(id, 0.0) * contentWeight;
            double cfScore = cfScores.getOrDefault(id, 0.0) * cfWeight;
            double popularity = (getDouble(item, "clickCount", 0) / maxClicks) * popularityWeight;
            double finalScore = contentScore + cfScore + popularity;

            treap.insert(item, finalScore);
        }

        return treap.getTopK().stream()
                .map(si -> new ScoredItem(
                        getString(si.getItem(), "id", ""),
                        si.getItem(),
                        si.getScore(),
                        "混合推荐"
                ))
                .collect(Collectors.toList());
    }

    /**
     * 热度推荐（无需用户画像）
     */
    public List<ScoredItem> popularityBasedRecommendation(
            List<Map<String, Object>> items, int topK) {
        if (items == null || items.isEmpty()) return Collections.emptyList();

        double maxClicks = items.stream()
                .mapToDouble(item -> getDouble(item, "clickCount", 0))
                .max().orElse(1.0);
        double maxRating = items.stream()
                .mapToDouble(item -> getDouble(item, "rating", 0))
                .max().orElse(10.0);

        TreapTopK<Map<String, Object>> treap = new TreapTopK<>(topK);
        for (Map<String, Object> item : items) {
            double clicks = getDouble(item, "clickCount", 0) / maxClicks;
            double rating = getDouble(item, "rating", 0) / maxRating;
            double ratingCount = Math.log(getDouble(item, "ratingCount", 0) + 1) / 10.0;
            double score = clicks * 0.4 + rating * 0.4 + ratingCount * 0.2;
            treap.insert(item, score);
        }

        return treap.getTopK().stream()
                .map(si -> new ScoredItem(
                        getString(si.getItem(), "id", ""),
                        si.getItem(),
                        si.getScore(),
                        "热度推荐"
                ))
                .collect(Collectors.toList());
    }

    // ==================== 业务推荐方法 ====================

    /**
     * 推荐场所（混合策略）
     */
    public List<ScoredItem> recommendPlaces(
            List<String> userInterests,
            List<String> userFavCategories,
            List<String> visitedPlaceIds,
            List<Map<String, Object>> allPlaces,
            int topK) {

        Map<String, Double> userProfile = buildUserProfile(
                userInterests, userFavCategories, visitedPlaceIds, allPlaces);

        if (userProfile.isEmpty()) {
            return popularityBasedRecommendation(allPlaces, topK);
        }

        Set<String> excludeIds = visitedPlaceIds == null ?
                Collections.emptySet() : new HashSet<>(visitedPlaceIds);

        return hybridRecommendation(
                userProfile, excludeIds, allPlaces, null, topK,
                0.5, 0.2, 0.3);
    }

    /**
     * 推荐日记（基于内容）
     */
    public List<ScoredItem> recommendDiaries(
            List<String> userInterests,
            List<Map<String, Object>> allDiaries,
            int topK) {

        if (userInterests == null || userInterests.isEmpty()) {
            return popularityBasedRecommendation(allDiaries, topK);
        }

        Map<String, Double> userProfile = new HashMap<>();
        for (String interest : userInterests) {
            userProfile.put(interest, 1.0);
        }

        return contentBasedRecommendation(userProfile, allDiaries, Collections.emptySet(), topK);
    }

    // ==================== 工具方法 ====================

    private double getDouble(Map<String, Object> map, String key, double defaultVal) {
        Object val = map.get(key);
        if (val instanceof Number) return ((Number) val).doubleValue();
        return defaultVal;
    }

    private String getString(Map<String, Object> map, String key, String defaultVal) {
        Object val = map.get(key);
        if (val instanceof String) return (String) val;
        return defaultVal;
    }

    /**
     * 解析JSON数组字符串为列表（简单实现，处理 ["tag1","tag2"] 格式）
     */
    private List<String> parseJsonArray(String json) {
        if (json == null || json.trim().isEmpty() || json.equals("[]")) return Collections.emptyList();
        List<String> result = new ArrayList<>();
        // 移除括号，按逗号分割
        String cleaned = json.replaceAll("[\\[\\]\"]", "").trim();
        if (cleaned.isEmpty()) return result;
        for (String s : cleaned.split(",")) {
            String trimmed = s.trim();
            if (!trimmed.isEmpty()) result.add(trimmed);
        }
        return result;
    }
}
