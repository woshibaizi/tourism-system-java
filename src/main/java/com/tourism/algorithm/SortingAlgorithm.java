package com.tourism.algorithm;

import org.springframework.stereotype.Component;

import java.util.*;
import java.util.function.Function;

/**
 * 排序算法集合
 * 包含快速排序、堆排序、归并排序、Top-K选择等
 * 所有方法使用泛型 + Function 代替Python key_func
 */
@Component
public class SortingAlgorithm {

    // ==================== 快速排序 ====================

    /**
     * 快速排序
     *
     * @param list    待排序列表（不会修改原列表）
     * @param keyFunc 提取排序键
     * @param reverse true=降序, false=升序
     * @return 排序后的新列表
     */
    public <T> List<T> quickSort(List<T> list, Function<T, Double> keyFunc, boolean reverse) {
        if (list == null || list.size() <= 1) return list == null ? Collections.emptyList() : new ArrayList<>(list);
        List<T> arr = new ArrayList<>(list);
        quickSortHelper(arr, 0, arr.size() - 1, keyFunc, reverse);
        return arr;
    }

    private <T> void quickSortHelper(List<T> arr, int low, int high,
                                     Function<T, Double> keyFunc, boolean reverse) {
        if (low < high) {
            int pivotIdx = partition(arr, low, high, keyFunc, reverse);
            quickSortHelper(arr, low, pivotIdx - 1, keyFunc, reverse);
            quickSortHelper(arr, pivotIdx + 1, high, keyFunc, reverse);
        }
    }

    private <T> int partition(List<T> arr, int low, int high,
                              Function<T, Double> keyFunc, boolean reverse) {
        // 三数取中法选择pivot
        int mid = low + (high - low) / 2;
        if (compare(keyFunc.apply(arr.get(low)), keyFunc.apply(arr.get(mid)), reverse) > 0)
            Collections.swap(arr, low, mid);
        if (compare(keyFunc.apply(arr.get(low)), keyFunc.apply(arr.get(high)), reverse) > 0)
            Collections.swap(arr, low, high);
        if (compare(keyFunc.apply(arr.get(mid)), keyFunc.apply(arr.get(high)), reverse) > 0)
            Collections.swap(arr, mid, high);
        Collections.swap(arr, mid, high); // pivot放到最后

        double pivotKey = keyFunc.apply(arr.get(high));
        int i = low - 1;
        for (int j = low; j < high; j++) {
            if (compare(keyFunc.apply(arr.get(j)), pivotKey, reverse) <= 0) {
                i++;
                Collections.swap(arr, i, j);
            }
        }
        Collections.swap(arr, i + 1, high);
        return i + 1;
    }

    private int compare(double a, double b, boolean reverse) {
        return reverse ? Double.compare(b, a) : Double.compare(a, b);
    }

    // ==================== 快速选择 Top-K ====================

    /**
     * 快速选择Top-K（基于QuickSelect，O(n)平均）
     */
    public <T> List<T> quickSelectTopK(List<T> list, Function<T, Double> keyFunc, int k, boolean reverse) {
        if (list == null || list.isEmpty() || k <= 0) return Collections.emptyList();
        k = Math.min(k, list.size());

        List<T> arr = new ArrayList<>(list);
        quickSelectHelper(arr, 0, arr.size() - 1, k - 1, keyFunc, reverse);

        // 取前k个并排序
        List<T> topK = new ArrayList<>(arr.subList(0, k));
        topK.sort((a, b) -> compare(keyFunc.apply(a), keyFunc.apply(b), reverse) < 0 ? -1 : 1);
        return topK;
    }

    private <T> void quickSelectHelper(List<T> arr, int low, int high, int k,
                                       Function<T, Double> keyFunc, boolean reverse) {
        if (low >= high) return;
        int pivotIdx = partition(arr, low, high, keyFunc, reverse);
        if (pivotIdx == k) return;
        else if (pivotIdx < k) quickSelectHelper(arr, pivotIdx + 1, high, k, keyFunc, reverse);
        else quickSelectHelper(arr, low, pivotIdx - 1, k, keyFunc, reverse);
    }

    // ==================== TopK通用入口 ====================

    /**
     * Top-K排序（自适应选择算法：小数据用排序，大数据用QuickSelect）
     */
    public <T> List<T> topKSort(List<T> list, Function<T, Double> keyFunc, int k, boolean reverse) {
        if (list == null || list.isEmpty() || k <= 0) return Collections.emptyList();
        k = Math.min(k, list.size());

        if (list.size() <= 50 || k >= list.size() * 0.8) {
            List<T> sorted = quickSort(list, keyFunc, reverse);
            return sorted.subList(0, Math.min(k, sorted.size()));
        }
        return quickSelectTopK(list, keyFunc, k, reverse);
    }

    // ==================== 多键排序 ====================

    /**
     * 多键加权排序
     *
     * @param list     待排序列表
     * @param keyFuncs 多个键提取函数
     * @param weights  每个键的权重
     * @param reverse  true=降序
     * @return 排序后的列表
     */
    public <T> List<T> multiKeySort(List<T> list, List<Function<T, Double>> keyFuncs,
                                    List<Double> weights, boolean reverse) {
        if (list == null || list.isEmpty()) return Collections.emptyList();

        // 计算加权综合分数
        Function<T, Double> compositeKey = item -> {
            double total = 0;
            for (int i = 0; i < keyFuncs.size(); i++) {
                double weight = (i < weights.size()) ? weights.get(i) : 1.0;
                total += keyFuncs.get(i).apply(item) * weight;
            }
            return total;
        };

        return quickSort(list, compositeKey, reverse);
    }

    // ==================== 堆排序 ====================

    /**
     * 堆排序
     */
    public <T> List<T> heapSort(List<T> list, Function<T, Double> keyFunc, boolean reverse) {
        if (list == null || list.size() <= 1) return list == null ? Collections.emptyList() : new ArrayList<>(list);
        List<T> arr = new ArrayList<>(list);
        int n = arr.size();

        // 构建堆
        for (int i = n / 2 - 1; i >= 0; i--) {
            heapify(arr, n, i, keyFunc, reverse);
        }

        // 排序
        for (int i = n - 1; i > 0; i--) {
            Collections.swap(arr, 0, i);
            heapify(arr, i, 0, keyFunc, reverse);
        }
        return arr;
    }

    private <T> void heapify(List<T> arr, int n, int i,
                             Function<T, Double> keyFunc, boolean reverse) {
        int target = i;
        int left = 2 * i + 1;
        int right = 2 * i + 2;

        if (left < n && compare(keyFunc.apply(arr.get(left)), keyFunc.apply(arr.get(target)), !reverse) > 0) {
            target = left;
        }
        if (right < n && compare(keyFunc.apply(arr.get(right)), keyFunc.apply(arr.get(target)), !reverse) > 0) {
            target = right;
        }
        if (target != i) {
            Collections.swap(arr, i, target);
            heapify(arr, n, target, keyFunc, !reverse);
        }
    }

    /**
     * 堆排序Top-K（使用小顶堆/大顶堆，O(n log k)）
     */
    public <T> List<T> heapSortTopK(List<T> list, Function<T, Double> keyFunc, int k, boolean reverse) {
        if (list == null || list.isEmpty() || k <= 0) return Collections.emptyList();
        k = Math.min(k, list.size());

        // 使用Java PriorityQueue实现
        Comparator<T> comparator = reverse
                ? Comparator.comparingDouble(item -> keyFunc.apply(item))   // 小顶堆：淘汰最小的
                : Comparator.comparingDouble(item -> -keyFunc.apply(item)); // 大顶堆：淘汰最大的

        PriorityQueue<T> heap = new PriorityQueue<>(k, comparator);
        for (T item : list) {
            if (heap.size() < k) {
                heap.offer(item);
            } else {
                T top = heap.peek();
                boolean shouldReplace = reverse
                        ? keyFunc.apply(item) > keyFunc.apply(top)
                        : keyFunc.apply(item) < keyFunc.apply(top);
                if (shouldReplace) {
                    heap.poll();
                    heap.offer(item);
                }
            }
        }

        List<T> result = new ArrayList<>(heap);
        result.sort((a, b) -> {
            int cmp = Double.compare(keyFunc.apply(a), keyFunc.apply(b));
            return reverse ? -cmp : cmp;
        });
        return result;
    }

    // ==================== 归并排序 ====================

    /**
     * 归并排序
     */
    public <T> List<T> mergeSort(List<T> list, Function<T, Double> keyFunc, boolean reverse) {
        if (list == null || list.size() <= 1) return list == null ? Collections.emptyList() : new ArrayList<>(list);
        int mid = list.size() / 2;
        List<T> left = mergeSort(new ArrayList<>(list.subList(0, mid)), keyFunc, reverse);
        List<T> right = mergeSort(new ArrayList<>(list.subList(mid, list.size())), keyFunc, reverse);
        return merge(left, right, keyFunc, reverse);
    }

    private <T> List<T> merge(List<T> left, List<T> right,
                              Function<T, Double> keyFunc, boolean reverse) {
        List<T> result = new ArrayList<>();
        int i = 0, j = 0;
        while (i < left.size() && j < right.size()) {
            if (compare(keyFunc.apply(left.get(i)), keyFunc.apply(right.get(j)), reverse) <= 0) {
                result.add(left.get(i++));
            } else {
                result.add(right.get(j++));
            }
        }
        while (i < left.size()) result.add(left.get(i++));
        while (j < right.size()) result.add(right.get(j++));
        return result;
    }

    // ==================== 业务排序方法（使用Map） ====================

    /**
     * 按推荐分排序场所
     * 综合考虑评分、热度和用户兴趣匹配
     */
    public List<Map<String, Object>> sortPlacesByRecommendation(
            List<Map<String, Object>> places, List<String> userInterests, int k) {
        if (places == null || places.isEmpty()) return Collections.emptyList();

        Function<Map<String, Object>, Double> scoreFunc = place -> {
            double rating = getDouble(place, "rating", 0);
            double clickCount = getDouble(place, "clickCount", 0);

            // 归一化热度（对数处理防止极端值）
            double popularity = Math.log(clickCount + 1) / 10.0;

            // 兴趣匹配度
            double interestMatch = 0;
            if (userInterests != null && !userInterests.isEmpty()) {
                String keywords = getString(place, "keywords", "");
                String features = getString(place, "features", "");
                String combined = keywords + features;
                for (String interest : userInterests) {
                    if (combined.contains(interest)) {
                        interestMatch += 1.0;
                    }
                }
                interestMatch = interestMatch / userInterests.size();
            }

            // 综合评分 = 评分*0.4 + 热度*0.3 + 兴趣匹配*0.3
            return rating * 0.4 + popularity * 0.3 + interestMatch * 0.3 * 10;
        };

        return topKSort(places, scoreFunc, k, true);
    }

    /**
     * 按相关度排序日记
     */
    public List<Map<String, Object>> sortDiariesByRelevance(
            List<Map<String, Object>> diaries, String placeId,
            List<String> userInterests, int k) {
        if (diaries == null || diaries.isEmpty()) return Collections.emptyList();

        Function<Map<String, Object>, Double> scoreFunc = diary -> {
            double rating = getDouble(diary, "rating", 0);
            double clickCount = getDouble(diary, "clickCount", 0);
            double score = rating * 0.5 + Math.log(clickCount + 1) * 0.3;

            // 场所匹配加分
            if (placeId != null && placeId.equals(getString(diary, "placeId", ""))) {
                score += 2.0;
            }

            // 标签兴趣匹配加分
            if (userInterests != null) {
                String tags = getString(diary, "tags", "");
                for (String interest : userInterests) {
                    if (tags.contains(interest)) {
                        score += 0.5;
                    }
                }
            }
            return score;
        };

        return topKSort(diaries, scoreFunc, k, true);
    }

    /**
     * 按距离排序设施
     */
    public List<Map<String, Object>> sortFacilitiesByDistance(
            List<Map<String, Object>> facilities, double targetLat, double targetLng) {
        if (facilities == null || facilities.isEmpty()) return Collections.emptyList();

        Function<Map<String, Object>, Double> distFunc = facility -> {
            double lat = getDouble(facility, "lat", 0);
            double lng = getDouble(facility, "lng", 0);
            // Haversine距离计算
            return haversineDistance(targetLat, targetLng, lat, lng);
        };

        return quickSort(facilities, distFunc, false); // 升序
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
     * Haversine公式计算两点间距离（米）
     */
    public static double haversineDistance(double lat1, double lng1, double lat2, double lng2) {
        double R = 6371000; // 地球半径（米）
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                        Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}
