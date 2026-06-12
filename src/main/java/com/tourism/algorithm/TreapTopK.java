package com.tourism.algorithm;

import java.util.*;
import java.util.function.Function;

/**
 * 基于Treap的Top-K数据结构
 * Treap = Tree + Heap，结合了二叉搜索树和堆的特性
 * 用于高效维护Top-K推荐结果
 *
 * @param <T> 元素类型
 */
public class TreapTopK<T> {

    // ==================== 结果类 ====================

    public static class ScoredItem<T> {
        private final T item;
        private final double score;

        public ScoredItem(T item, double score) {
            this.item = item;
            this.score = score;
        }

        public T getItem() { return item; }
        public double getScore() { return score; }

        @Override
        public String toString() {
            return "ScoredItem{item=" + item + ", score=" + score + "}";
        }
    }

    // ==================== Treap节点 ====================

    private static class TreapNode<T> {
        T item;
        double score;
        double priority; // 随机优先级（堆性质）
        TreapNode<T> left;
        TreapNode<T> right;
        int size;

        TreapNode(T item, double score) {
            this.item = item;
            this.score = score;
            this.priority = Math.random();
            this.left = null;
            this.right = null;
            this.size = 1;
        }

        void updateSize() {
            this.size = 1;
            if (left != null) this.size += left.size;
            if (right != null) this.size += right.size;
        }
    }

    // ==================== 属性 ====================

    private final int k;
    private TreapNode<T> root;
    private int currentSize;

    public TreapTopK(int k) {
        this.k = k;
        this.root = null;
        this.currentSize = 0;
    }

    // ==================== 核心操作 ====================

    /**
     * 插入新的推荐项目
     */
    public void insert(T item, double score) {
        if (currentSize < k) {
            root = insertNode(root, item, score);
            currentSize++;
        } else {
            double minScore = findMinScore(root);
            if (score > minScore) {
                root = deleteMin(root);
                root = insertNode(root, item, score);
            }
        }
    }

    /**
     * 获取Top-K推荐结果（按分数降序）
     */
    public List<ScoredItem<T>> getTopK() {
        List<ScoredItem<T>> result = new ArrayList<>();
        inorderTraversal(root, result);
        return result;
    }

    public int getSize() { return currentSize; }
    public boolean isFull() { return currentSize >= k; }

    public double getMinScore() {
        if (currentSize == 0) return Double.NEGATIVE_INFINITY;
        return findMinScore(root);
    }

    // ==================== 内部方法 ====================

    private TreapNode<T> rotateRight(TreapNode<T> node) {
        TreapNode<T> leftChild = node.left;
        node.left = leftChild.right;
        leftChild.right = node;
        node.updateSize();
        leftChild.updateSize();
        return leftChild;
    }

    private TreapNode<T> rotateLeft(TreapNode<T> node) {
        TreapNode<T> rightChild = node.right;
        node.right = rightChild.left;
        rightChild.left = node;
        node.updateSize();
        rightChild.updateSize();
        return rightChild;
    }

    private TreapNode<T> insertNode(TreapNode<T> node, T item, double score) {
        if (node == null) {
            return new TreapNode<>(item, score);
        }
        if (score > node.score) {
            node.left = insertNode(node.left, item, score);
            if (node.left != null && node.left.priority > node.priority) {
                node = rotateRight(node);
            }
        } else if (score < node.score) {
            node.right = insertNode(node.right, item, score);
            if (node.right != null && node.right.priority > node.priority) {
                node = rotateLeft(node);
            }
        } else {
            node.item = item; // 分数相等，更新项目
        }
        node.updateSize();
        return node;
    }

    private TreapNode<T> deleteMin(TreapNode<T> node) {
        if (node == null) return null;
        if (node.right == null) return node.left;
        node.right = deleteMin(node.right);
        if (node != null) node.updateSize();
        return node;
    }

    private double findMinScore(TreapNode<T> node) {
        if (node == null) return Double.NEGATIVE_INFINITY;
        while (node.right != null) {
            node = node.right;
        }
        return node.score;
    }

    private void inorderTraversal(TreapNode<T> node, List<ScoredItem<T>> result) {
        if (node == null) return;
        inorderTraversal(node.left, result);  // 高分在左
        result.add(new ScoredItem<>(node.item, node.score));
        inorderTraversal(node.right, result); // 低分在右
    }

    // ==================== 静态工具方法 ====================

    /**
     * 使用Treap数据结构获取Top-K推荐（自适应策略）
     * 小数据集直接排序，大数据集使用Treap
     *
     * @param items 待排序列表
     * @param scoreFunc 评分函数
     * @param k Top-K
     * @return Top-K结果列表
     */
    public static <T> List<ScoredItem<T>> topKRecommendations(
            List<T> items, Function<T, Double> scoreFunc, int k) {
        if (items == null || items.isEmpty() || k <= 0) {
            return Collections.emptyList();
        }
        k = Math.min(k, items.size());
        int n = items.size();

        // 自适应策略：小数据集直接排序更高效
        if (n <= 50 || k >= n * 0.8) {
            List<ScoredItem<T>> scored = new ArrayList<>();
            for (T item : items) {
                scored.add(new ScoredItem<>(item, scoreFunc.apply(item)));
            }
            scored.sort((a, b) -> Double.compare(b.getScore(), a.getScore()));
            return scored.subList(0, Math.min(k, scored.size()));
        }

        // 大数据集使用Treap
        TreapTopK<T> treap = new TreapTopK<>(k);
        for (T item : items) {
            treap.insert(item, scoreFunc.apply(item));
        }
        return treap.getTopK();
    }

    /**
     * 流式处理Top-K推荐
     */
    public static <T> List<ScoredItem<T>> streamingTopK(
            Iterable<ScoredItem<T>> stream, int k) {
        TreapTopK<T> treap = new TreapTopK<>(k);
        for (ScoredItem<T> item : stream) {
            treap.insert(item.getItem(), item.getScore());
        }
        return treap.getTopK();
    }
}
