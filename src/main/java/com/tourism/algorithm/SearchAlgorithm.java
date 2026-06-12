package com.tourism.algorithm;

import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 搜索算法集合
 * 包含二分查找、模糊搜索（Jaccard）、TF-IDF全文检索、哈希索引搜索
 */
@Component
public class SearchAlgorithm {

    // ==================== 结果类 ====================

    public static class SearchResult<T> {
        private final T item;
        private final double score;
        private final String matchReason;

        public SearchResult(T item, double score, String matchReason) {
            this.item = item;
            this.score = score;
            this.matchReason = matchReason;
        }

        public T getItem() { return item; }
        public double getScore() { return score; }
        public String getMatchReason() { return matchReason; }
    }

    // ==================== 二分查找 ====================

    /**
     * 二分查找（要求列表已按keyFunc升序排序）
     *
     * @return 元素下标，不存在返回-1
     */
    public <T> int binarySearch(List<T> sortedList, double targetKey,
                                java.util.function.Function<T, Double> keyFunc) {
        if (sortedList == null || sortedList.isEmpty()) return -1;
        int low = 0, high = sortedList.size() - 1;
        while (low <= high) {
            int mid = low + (high - low) / 2;
            double midKey = keyFunc.apply(sortedList.get(mid));
            if (midKey == targetKey) return mid;
            else if (midKey < targetKey) low = mid + 1;
            else high = mid - 1;
        }
        return -1;
    }

    /**
     * 线性搜索（精确匹配某字段值）
     */
    public <T> List<T> linearSearch(List<T> items,
                                    java.util.function.Function<T, Object> fieldFunc,
                                    Object targetValue) {
        if (items == null || items.isEmpty()) return Collections.emptyList();
        return items.stream()
                .filter(item -> Objects.equals(fieldFunc.apply(item), targetValue))
                .collect(Collectors.toList());
    }

    // ==================== 模糊搜索（Jaccard相似度） ====================

    /**
     * 计算两个字符串的Jaccard相似度（基于字符集合）
     */
    public double jaccardSimilarity(String s1, String s2) {
        if (s1 == null || s2 == null) return 0;
        Set<Character> set1 = new HashSet<>();
        Set<Character> set2 = new HashSet<>();
        for (char c : s1.toCharArray()) set1.add(c);
        for (char c : s2.toCharArray()) set2.add(c);

        Set<Character> intersection = new HashSet<>(set1);
        intersection.retainAll(set2);

        Set<Character> union = new HashSet<>(set1);
        union.addAll(set2);

        return union.isEmpty() ? 0 : (double) intersection.size() / union.size();
    }

    /**
     * N-gram Jaccard相似度（考虑字符顺序，更适合中文搜索）
     */
    public double ngramJaccardSimilarity(String s1, String s2, int n) {
        if (s1 == null || s2 == null) return 0;
        Set<String> grams1 = getNgrams(s1, n);
        Set<String> grams2 = getNgrams(s2, n);

        if (grams1.isEmpty() && grams2.isEmpty()) return 1.0;
        if (grams1.isEmpty() || grams2.isEmpty()) return 0;

        Set<String> intersection = new HashSet<>(grams1);
        intersection.retainAll(grams2);

        Set<String> union = new HashSet<>(grams1);
        union.addAll(grams2);

        return (double) intersection.size() / union.size();
    }

    private Set<String> getNgrams(String s, int n) {
        Set<String> grams = new HashSet<>();
        for (int i = 0; i <= s.length() - n; i++) {
            grams.add(s.substring(i, i + n));
        }
        return grams;
    }

    /**
     * 模糊搜索：返回相似度超过阈值的结果
     *
     * @param items        数据列表（Map格式）
     * @param query        搜索词
     * @param searchFields 搜索字段名列表
     * @param threshold    相似度阈值（0~1）
     * @return 按相似度降序排列的结果列表
     */
    public List<Map<String, Object>> fuzzySearch(List<Map<String, Object>> items,
                                                  String query,
                                                  List<String> searchFields,
                                                  double threshold) {
        if (items == null || items.isEmpty() || query == null || query.isEmpty()) {
            return Collections.emptyList();
        }

        List<Map<String, Object>> results = new ArrayList<>();
        for (Map<String, Object> item : items) {
            double maxSim = 0;
            for (String field : searchFields) {
                Object val = item.get(field);
                if (val instanceof String) {
                    // 先尝试精确包含
                    String fieldVal = (String) val;
                    if (fieldVal.contains(query)) {
                        maxSim = 1.0;
                        break;
                    }
                    // 再尝试Jaccard相似度
                    double sim = Math.max(
                            jaccardSimilarity(fieldVal, query),
                            ngramJaccardSimilarity(fieldVal, query, Math.min(2, query.length()))
                    );
                    maxSim = Math.max(maxSim, sim);
                }
            }
            if (maxSim >= threshold) {
                Map<String, Object> resultItem = new LinkedHashMap<>(item);
                resultItem.put("_similarity", maxSim);
                results.add(resultItem);
            }
        }

        results.sort((a, b) -> Double.compare(
                (double) b.get("_similarity"),
                (double) a.get("_similarity")));
        return results;
    }

    // ==================== 关键词搜索 ====================

    /**
     * 关键词搜索（多关键词AND/OR逻辑）
     *
     * @param items        数据列表
     * @param keywords     关键词列表
     * @param searchFields 搜索字段
     * @return 匹配的结果列表
     */
    public List<Map<String, Object>> keywordSearch(List<Map<String, Object>> items,
                                                    List<String> keywords,
                                                    List<String> searchFields) {
        if (items == null || items.isEmpty() || keywords == null || keywords.isEmpty()) {
            return Collections.emptyList();
        }

        List<Map<String, Object>> results = new ArrayList<>();
        for (Map<String, Object> item : items) {
            // 计算匹配的关键词数量
            int matched = 0;
            for (String keyword : keywords) {
                for (String field : searchFields) {
                    Object val = item.get(field);
                    if (val instanceof String && ((String) val).contains(keyword)) {
                        matched++;
                        break;
                    }
                }
            }
            if (matched > 0) {
                Map<String, Object> resultItem = new LinkedHashMap<>(item);
                resultItem.put("_matchedKeywords", matched);
                resultItem.put("_matchScore", (double) matched / keywords.size());
                results.add(resultItem);
            }
        }

        results.sort((a, b) -> Integer.compare(
                (int) b.get("_matchedKeywords"),
                (int) a.get("_matchedKeywords")));
        return results;
    }

    // ==================== TF-IDF 全文检索 ====================

    /**
     * 计算TF（词频）
     */
    private Map<String, Double> computeTF(String text) {
        Map<String, Integer> wordCount = new HashMap<>();
        String[] words = text.split("[\\s\\p{Punct}，。！？、；：【】（）]+");
        int total = 0;
        for (String word : words) {
            if (word.length() < 1) continue;
            wordCount.merge(word, 1, Integer::sum);
            total++;
        }
        Map<String, Double> tf = new HashMap<>();
        int finalTotal = total;
        wordCount.forEach((w, count) -> tf.put(w, (double) count / finalTotal));
        return tf;
    }

    /**
     * 计算TF-IDF全文相似度（使用余弦相似度）
     *
     * @param items        数据列表
     * @param query        查询文本
     * @param contentField 内容字段名
     * @return 按TF-IDF相关度降序排列
     */
    public List<Map<String, Object>> fullTextSearch(List<Map<String, Object>> items,
                                                     String query,
                                                     String contentField) {
        if (items == null || items.isEmpty() || query == null || query.isEmpty()) {
            return Collections.emptyList();
        }

        // 构建语料库词频
        Map<String, Integer> docFreq = new HashMap<>();
        List<Map<String, Double>> allTFs = new ArrayList<>();
        for (Map<String, Object> item : items) {
            String content = getString(item, contentField, "");
            Map<String, Double> tf = computeTF(content);
            allTFs.add(tf);
            for (String word : tf.keySet()) {
                docFreq.merge(word, 1, Integer::sum);
            }
        }

        Map<String, Double> queryTF = computeTF(query);
        int docCount = items.size();

        // 计算每个文档与query的TF-IDF余弦相似度
        List<Map<String, Object>> results = new ArrayList<>();
        for (int i = 0; i < items.size(); i++) {
            Map<String, Double> docTF = allTFs.get(i);
            double dotProduct = 0, docNorm = 0, queryNorm = 0;

            for (Map.Entry<String, Double> entry : queryTF.entrySet()) {
                String word = entry.getKey();
                double idf = Math.log((double) docCount / (docFreq.getOrDefault(word, 0) + 1)) + 1;
                double queryTFIDF = entry.getValue() * idf;
                double docTFIDF = docTF.getOrDefault(word, 0.0) * idf;
                dotProduct += queryTFIDF * docTFIDF;
                queryNorm += queryTFIDF * queryTFIDF;
            }

            for (Map.Entry<String, Double> entry : docTF.entrySet()) {
                String word = entry.getKey();
                double idf = Math.log((double) docCount / (docFreq.getOrDefault(word, 0) + 1)) + 1;
                double docTFIDF = entry.getValue() * idf;
                docNorm += docTFIDF * docTFIDF;
            }

            double similarity = 0;
            if (queryNorm > 0 && docNorm > 0) {
                similarity = dotProduct / (Math.sqrt(queryNorm) * Math.sqrt(docNorm));
            }

            if (similarity > 0) {
                Map<String, Object> resultItem = new LinkedHashMap<>(items.get(i));
                resultItem.put("_tfidfScore", similarity);
                results.add(resultItem);
            }
        }

        results.sort((a, b) -> Double.compare(
                (double) b.get("_tfidfScore"),
                (double) a.get("_tfidfScore")));
        return results;
    }

    // ==================== 哈希索引搜索 ====================

    /**
     * 构建哈希索引（字段值 → 文档列表）
     */
    public <T> Map<String, List<T>> buildHashIndex(List<T> items,
                                                    java.util.function.Function<T, String> keyFunc) {
        Map<String, List<T>> index = new HashMap<>();
        if (items == null) return index;
        for (T item : items) {
            String key = keyFunc.apply(item);
            if (key != null) {
                index.computeIfAbsent(key, k -> new ArrayList<>()).add(item);
            }
        }
        return index;
    }

    /**
     * 哈希索引搜索设施类别（三级匹配：精确→单词→关键词）
     */
    public List<Map<String, Object>> hashSearchFacilityCategories(
            String input, List<Map<String, Object>> facilities) {
        if (facilities == null || input == null) return Collections.emptyList();

        // 第一级：精确匹配 category 字段
        List<Map<String, Object>> exact = facilities.stream()
                .filter(f -> input.equalsIgnoreCase(getString(f, "category", "")))
                .collect(Collectors.toList());
        if (!exact.isEmpty()) return exact;

        // 第二级：包含匹配
        List<Map<String, Object>> partial = facilities.stream()
                .filter(f -> {
                    String cat = getString(f, "category", "");
                    String name = getString(f, "name", "");
                    return cat.contains(input) || name.contains(input) ||
                            input.contains(cat) || input.contains(name);
                })
                .collect(Collectors.toList());
        if (!partial.isEmpty()) return partial;

        // 第三级：关键词匹配
        return facilities.stream()
                .filter(f -> {
                    String cat = getString(f, "category", "");
                    String desc = getString(f, "description", "");
                    return jaccardSimilarity(cat, input) > 0.3 ||
                            jaccardSimilarity(desc, input) > 0.3;
                })
                .collect(Collectors.toList());
    }

    /**
     * 日记标题哈希索引（精确匹配 O(1)）
     */
    public Map<String, List<Map<String, Object>>> buildDiaryTitleIndex(
            List<Map<String, Object>> diaries) {
        return diaries.stream()
                .filter(d -> d.containsKey("title"))
                .collect(Collectors.groupingBy(d -> getString(d, "title", "")));
    }

    /**
     * 通过标题哈希索引查询日记
     */
    public List<Map<String, Object>> searchDiaryByTitleHash(
            Map<String, List<Map<String, Object>>> titleIndex, String title) {
        if (titleIndex == null || title == null) return Collections.emptyList();
        return titleIndex.getOrDefault(title, Collections.emptyList());
    }

    /**
     * 模糊标题搜索（遍历索引进行Jaccard匹配）
     */
    public List<Map<String, Object>> searchDiaryByTitleHashFuzzy(
            Map<String, List<Map<String, Object>>> titleIndex,
            String title, double threshold) {
        if (titleIndex == null || title == null) return Collections.emptyList();

        List<Map<String, Object>> results = new ArrayList<>();
        for (Map.Entry<String, List<Map<String, Object>>> entry : titleIndex.entrySet()) {
            double sim = Math.max(
                    jaccardSimilarity(entry.getKey(), title),
                    entry.getKey().contains(title) ? 1.0 : 0.0
            );
            if (sim >= threshold) {
                results.addAll(entry.getValue());
            }
        }
        results.sort((a, b) -> {
            double simA = jaccardSimilarity(getString(a, "title", ""), title);
            double simB = jaccardSimilarity(getString(b, "title", ""), title);
            return Double.compare(simB, simA);
        });
        return results;
    }

    // ==================== 统一业务搜索接口 ====================

    /**
     * 统一搜索入口（自动判断搜索策略）
     *
     * @param items        数据列表
     * @param query        搜索词
     * @param searchFields 搜索字段
     * @param contentField 全文索引字段（可为null，跳过TF-IDF）
     * @return 搜索结果列表（已去重，按相关度排序）
     */
    public List<Map<String, Object>> unifiedSearch(List<Map<String, Object>> items,
                                                    String query,
                                                    List<String> searchFields,
                                                    String contentField) {
        if (items == null || items.isEmpty() || query == null || query.isEmpty()) {
            return Collections.emptyList();
        }

        // 1. 关键词搜索
        List<String> keywords = Arrays.asList(query.split("[\\s，。]+"));
        List<Map<String, Object>> keywordResults = keywordSearch(items, keywords, searchFields);

        // 2. 模糊搜索
        List<Map<String, Object>> fuzzyResults = fuzzySearch(items, query, searchFields, 0.2);

        // 3. 合并去重
        Set<Object> seenIds = new HashSet<>();
        List<Map<String, Object>> merged = new ArrayList<>();

        for (Map<String, Object> item : keywordResults) {
            Object id = item.get("id");
            if (id != null && seenIds.add(id)) merged.add(item);
        }
        for (Map<String, Object> item : fuzzyResults) {
            Object id = item.get("id");
            if (id != null && seenIds.add(id)) merged.add(item);
        }

        // 4. 可选：TF-IDF全文搜索
        if (contentField != null && !contentField.isEmpty()) {
            List<Map<String, Object>> tfidfResults = fullTextSearch(items, query, contentField);
            for (Map<String, Object> item : tfidfResults) {
                Object id = item.get("id");
                if (id != null && seenIds.add(id)) merged.add(item);
            }
        }

        return merged;
    }

    // ==================== 工具方法 ====================

    private String getString(Map<String, Object> map, String key, String defaultVal) {
        Object val = map.get(key);
        return val instanceof String ? (String) val : defaultVal;
    }
}
