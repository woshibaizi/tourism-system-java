package com.tourism.algorithm;

import org.springframework.stereotype.Component;

import java.util.*;

/**
 * AC自动机（Aho-Corasick）实现
 * 多模式字符串匹配，用于敏感词过滤和文本匹配
 */
@Component
public class ACAutomaton {

    // ==================== 结果类 ====================

    public static class MatchResult {
        private final int position;
        private final String pattern;

        public MatchResult(int position, String pattern) {
            this.position = position;
            this.pattern = pattern;
        }

        public int getPosition() { return position; }
        public String getPattern() { return pattern; }

        @Override
        public String toString() {
            return "Match{pos=" + position + ", pattern='" + pattern + "'}";
        }
    }

    public static class FilterResult {
        private final String filteredText;
        private final List<String> detectedWords;
        private final int totalMatches;

        public FilterResult(String filteredText, List<String> detectedWords, int totalMatches) {
            this.filteredText = filteredText;
            this.detectedWords = detectedWords;
            this.totalMatches = totalMatches;
        }

        public String getFilteredText() { return filteredText; }
        public List<String> getDetectedWords() { return detectedWords; }
        public int getTotalMatches() { return totalMatches; }
    }

    public static class SearchDetail {
        private final List<MatchResult> matches;
        private final Map<String, Integer> patternCounts;
        private final int totalMatches;

        public SearchDetail(List<MatchResult> matches, Map<String, Integer> patternCounts, int totalMatches) {
            this.matches = matches;
            this.patternCounts = patternCounts;
            this.totalMatches = totalMatches;
        }

        public List<MatchResult> getMatches() { return matches; }
        public Map<String, Integer> getPatternCounts() { return patternCounts; }
        public int getTotalMatches() { return totalMatches; }
    }

    // ==================== AC节点 ====================

    private static class ACNode {
        Map<Character, ACNode> children = new HashMap<>();
        ACNode fail = null;
        List<String> output = new ArrayList<>(); // 该节点对应的完整模式
    }

    // ==================== 属性 ====================

    private ACNode root;
    private boolean built;

    public ACAutomaton() {
        this.root = new ACNode();
        this.built = false;
    }

    // ==================== 构建方法 ====================

    /**
     * 添加一个模式串
     */
    public void addPattern(String pattern) {
        if (pattern == null || pattern.isEmpty()) return;
        ACNode current = root;
        for (char ch : pattern.toCharArray()) {
            current.children.putIfAbsent(ch, new ACNode());
            current = current.children.get(ch);
        }
        current.output.add(pattern);
        this.built = false;
    }

    /**
     * BFS构建失败指针
     */
    public void buildFailureLinks() {
        Queue<ACNode> queue = new LinkedList<>();
        // 根节点的子节点的fail指针指向根
        for (ACNode child : root.children.values()) {
            child.fail = root;
            queue.add(child);
        }

        while (!queue.isEmpty()) {
            ACNode current = queue.poll();
            for (Map.Entry<Character, ACNode> entry : current.children.entrySet()) {
                char ch = entry.getKey();
                ACNode child = entry.getValue();

                // 寻找fail指针
                ACNode failNode = current.fail;
                while (failNode != null && !failNode.children.containsKey(ch)) {
                    failNode = failNode.fail;
                }
                child.fail = (failNode != null) ? failNode.children.get(ch) : root;

                // 合并output
                if (child.fail != null) {
                    child.output.addAll(child.fail.output);
                }

                queue.add(child);
            }
        }
        this.built = true;
    }

    /**
     * 一键构建：添加多个模式 + 构建失败指针
     */
    public void build(List<String> patterns) {
        this.root = new ACNode();
        this.built = false;
        if (patterns != null) {
            for (String pattern : patterns) {
                addPattern(pattern);
            }
        }
        buildFailureLinks();
    }

    // ==================== 搜索方法 ====================

    /**
     * 在文本中搜索所有模式的出现位置
     */
    public List<MatchResult> search(String text) {
        if (!built) buildFailureLinks();
        List<MatchResult> results = new ArrayList<>();
        if (text == null || text.isEmpty()) return results;

        ACNode current = root;
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);

            while (current != root && !current.children.containsKey(ch)) {
                current = current.fail;
            }
            if (current.children.containsKey(ch)) {
                current = current.children.get(ch);
            }

            // 收集匹配结果
            for (String pattern : current.output) {
                int startPos = i - pattern.length() + 1;
                results.add(new MatchResult(startPos, pattern));
            }
        }
        return results;
    }

    /**
     * 搜索并返回详细统计
     */
    public SearchDetail searchWithDetails(String text) {
        List<MatchResult> matches = search(text);
        Map<String, Integer> patternCounts = new LinkedHashMap<>();
        for (MatchResult m : matches) {
            patternCounts.merge(m.getPattern(), 1, Integer::sum);
        }
        return new SearchDetail(matches, patternCounts, matches.size());
    }

    // ==================== 替换和过滤 ====================

    /**
     * 替换文本中所有匹配的模式
     */
    public String replacePatterns(String text, String replacement) {
        if (!built) buildFailureLinks();
        if (text == null || text.isEmpty()) return text;

        List<MatchResult> matches = search(text);
        if (matches.isEmpty()) return text;

        // 按位置排序，处理重叠
        matches.sort(Comparator.comparingInt(MatchResult::getPosition));

        StringBuilder result = new StringBuilder();
        int lastEnd = 0;
        for (MatchResult match : matches) {
            int start = match.getPosition();
            int end = start + match.getPattern().length();
            if (start >= lastEnd) {
                result.append(text, lastEnd, start);
                result.append(replacement);
                lastEnd = end;
            }
        }
        result.append(text.substring(lastEnd));
        return result.toString();
    }

    /**
     * 敏感词过滤：将匹配的词替换为 *
     */
    public FilterResult filterText(String text) {
        if (!built) buildFailureLinks();
        if (text == null || text.isEmpty()) {
            return new FilterResult(text, Collections.emptyList(), 0);
        }

        List<MatchResult> matches = search(text);
        Set<String> detectedWords = new LinkedHashSet<>();
        for (MatchResult m : matches) {
            detectedWords.add(m.getPattern());
        }

        // 按位置排序
        matches.sort(Comparator.comparingInt(MatchResult::getPosition));

        StringBuilder filtered = new StringBuilder();
        int lastEnd = 0;
        for (MatchResult match : matches) {
            int start = match.getPosition();
            int end = start + match.getPattern().length();
            if (start >= lastEnd) {
                filtered.append(text, lastEnd, start);
                // 用 * 替换，长度与原词相同
                for (int i = 0; i < match.getPattern().length(); i++) {
                    filtered.append('*');
                }
                lastEnd = end;
            }
        }
        filtered.append(text.substring(lastEnd));

        return new FilterResult(
                filtered.toString(),
                new ArrayList<>(detectedWords),
                matches.size()
        );
    }

    /**
     * 重置自动机
     */
    public void reset() {
        this.root = new ACNode();
        this.built = false;
    }
}
