package com.tourism.algorithm;

/**
 * 斐波那契堆 (Fibonacci Heap) 实现
 * 支持高效的优先队列操作，特别适用于图算法如Dijkstra和A*算法
 *
 * 时间复杂度:
 * - insert: O(1) 摊还
 * - findMin: O(1)
 * - extractMin: O(log n) 摊还
 * - decreaseKey: O(1) 摊还
 * - delete: O(log n) 摊还
 * - merge: O(1)
 *
 * @param <T> 节点数据类型
 */
public class FibonacciHeap<T> {

    // ==================== 节点定义 ====================

    /**
     * 斐波那契堆节点
     */
    public static class Node<T> {
        double key;
        T data;
        int degree;
        boolean marked;
        Node<T> parent;
        Node<T> child;
        Node<T> left;
        Node<T> right;

        public Node(double key, T data) {
            this.key = key;
            this.data = data;
            this.degree = 0;
            this.marked = false;
            this.parent = null;
            this.child = null;
            this.left = this;
            this.right = this;
        }

        public double getKey() { return key; }
        public T getData() { return data; }
    }

    // ==================== 堆属性 ====================

    private Node<T> minNode;
    private int numNodes;

    public FibonacciHeap() {
        this.minNode = null;
        this.numNodes = 0;
    }

    public boolean isEmpty() {
        return minNode == null;
    }

    public int size() {
        return numNodes;
    }

    public Node<T> findMin() {
        return minNode;
    }

    // ==================== 核心操作 ====================

    /**
     * 插入新节点 O(1) 摊还
     */
    public Node<T> insert(double key, T data) {
        Node<T> node = new Node<>(key, data);
        if (minNode == null) {
            minNode = node;
        } else {
            addToRootList(node);
            if (node.key < minNode.key) {
                minNode = node;
            }
        }
        numNodes++;
        return node;
    }

    /**
     * 提取并删除最小节点 O(log n) 摊还
     */
    public Node<T> extractMin() {
        Node<T> min = minNode;
        if (min != null) {
            // 将最小节点的所有子节点添加到根列表
            if (min.child != null) {
                Node<T> child = min.child;
                java.util.List<Node<T>> children = new java.util.ArrayList<>();
                do {
                    children.add(child);
                    child = child.right;
                } while (child != min.child);

                for (Node<T> c : children) {
                    removeFromChildList(min, c);
                    addToRootList(c);
                    c.parent = null;
                }
            }

            // 从根列表中移除最小节点
            removeFromRootList(min);

            if (min == min.right) {
                minNode = null;
            } else {
                minNode = min.right;
                consolidate();
            }
            numNodes--;
        }
        return min;
    }

    /**
     * 减少节点的键值 O(1) 摊还
     */
    public void decreaseKey(Node<T> node, double newKey) {
        if (newKey > node.key) {
            throw new IllegalArgumentException("新键值必须小于当前键值");
        }
        node.key = newKey;
        Node<T> parent = node.parent;

        if (parent != null && node.key < parent.key) {
            cut(node, parent);
            cascadingCut(parent);
        }
        if (node.key < minNode.key) {
            minNode = node;
        }
    }

    /**
     * 删除指定节点 O(log n) 摊还
     */
    public void delete(Node<T> node) {
        decreaseKey(node, Double.NEGATIVE_INFINITY);
        extractMin();
    }

    /**
     * 合并两个斐波那契堆 O(1)
     */
    public FibonacciHeap<T> merge(FibonacciHeap<T> other) {
        FibonacciHeap<T> newHeap = new FibonacciHeap<>();
        newHeap.minNode = this.minNode;

        if (newHeap.minNode != null) {
            if (other.minNode != null) {
                // 连接两个根列表
                newHeap.minNode.right.left = other.minNode.left;
                other.minNode.left.right = newHeap.minNode.right;
                newHeap.minNode.right = other.minNode;
                other.minNode.left = newHeap.minNode;

                if (other.minNode.key < newHeap.minNode.key) {
                    newHeap.minNode = other.minNode;
                }
            }
        } else {
            newHeap.minNode = other.minNode;
        }

        newHeap.numNodes = this.numNodes + other.numNodes;
        return newHeap;
    }

    // ==================== 内部辅助方法 ====================

    private void addToRootList(Node<T> node) {
        if (minNode == null) {
            minNode = node;
            node.left = node;
            node.right = node;
        } else {
            node.left = minNode;
            node.right = minNode.right;
            minNode.right.left = node;
            minNode.right = node;
        }
    }

    private void removeFromRootList(Node<T> node) {
        if (node.right == node) {
            minNode = null;
        } else {
            node.left.right = node.right;
            node.right.left = node.left;
            if (minNode == node) {
                minNode = node.right;
            }
        }
    }

    private void removeFromChildList(Node<T> parent, Node<T> child) {
        if (child.right == child) {
            parent.child = null;
        } else {
            child.left.right = child.right;
            child.right.left = child.left;
            if (parent.child == child) {
                parent.child = child.right;
            }
        }
        parent.degree--;
    }

    private void consolidate() {
        int maxDegree = (int) (Math.log(numNodes) * 2) + 2;
        @SuppressWarnings("unchecked")
        Node<T>[] degreeTable = new Node[maxDegree];

        // 收集所有根节点
        java.util.List<Node<T>> roots = new java.util.ArrayList<>();
        Node<T> root = minNode;
        if (root != null) {
            do {
                roots.add(root);
                root = root.right;
            } while (root != minNode);
        }

        // 合并度数相同的树
        for (Node<T> r : roots) {
            int degree = r.degree;
            while (degree < maxDegree && degreeTable[degree] != null) {
                Node<T> other = degreeTable[degree];
                if (r.key > other.key) {
                    Node<T> temp = r;
                    r = other;
                    other = temp;
                }
                link(other, r);
                degreeTable[degree] = null;
                degree++;
            }
            if (degree < maxDegree) {
                degreeTable[degree] = r;
            }
        }

        // 重建根列表并找到新的最小节点
        minNode = null;
        for (Node<T> node : degreeTable) {
            if (node != null) {
                if (minNode == null) {
                    minNode = node;
                    node.left = node;
                    node.right = node;
                } else {
                    addToRootList(node);
                    if (node.key < minNode.key) {
                        minNode = node;
                    }
                }
            }
        }
    }

    private void link(Node<T> child, Node<T> parent) {
        child.left.right = child.right;
        child.right.left = child.left;

        child.parent = parent;
        if (parent.child == null) {
            parent.child = child;
            child.left = child;
            child.right = child;
        } else {
            child.left = parent.child;
            child.right = parent.child.right;
            parent.child.right.left = child;
            parent.child.right = child;
        }
        parent.degree++;
        child.marked = false;
    }

    private void cut(Node<T> child, Node<T> parent) {
        removeFromChildList(parent, child);
        addToRootList(child);
        child.parent = null;
        child.marked = false;
    }

    private void cascadingCut(Node<T> node) {
        Node<T> parent = node.parent;
        if (parent != null) {
            if (!node.marked) {
                node.marked = true;
            } else {
                cut(node, parent);
                cascadingCut(parent);
            }
        }
    }
}
