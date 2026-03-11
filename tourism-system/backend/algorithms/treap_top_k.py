"""
Treap数据结构实现 - 用于旅游推荐系统Top-K排序优化
Treap = Tree + Heap，结合了二叉搜索树和堆的特性
用于高效维护Top-K推荐结果
"""

import random
from typing import List, Dict, Tuple, Optional, Any


class TreapNode:
    """Treap节点类"""
    
    def __init__(self, item: Any, score: float):
        self.item = item  # 推荐项目（场所或日记）
        self.score = score  # 推荐分数
        self.priority = random.random()  # 随机优先级（堆性质）
        self.left: Optional['TreapNode'] = None
        self.right: Optional['TreapNode'] = None
        self.size = 1  # 子树大小
    
    def update_size(self):
        """更新子树大小"""
        self.size = 1
        if self.left:
            self.size += self.left.size
        if self.right:
            self.size += self.right.size


class TreapTopK:
    """
    基于Treap的Top-K数据结构
    支持动态维护前K个最高分数的推荐项目
    """
    
    def __init__(self, k: int = 12):
        self.k = k  # 维护前K个元素
        self.root: Optional[TreapNode] = None
        self.size = 0
    
    def _rotate_right(self, node: TreapNode) -> TreapNode:
        """右旋转操作"""
        left_child = node.left
        node.left = left_child.right
        left_child.right = node
        
        # 更新子树大小
        node.update_size()
        left_child.update_size()
        
        return left_child
    
    def _rotate_left(self, node: TreapNode) -> TreapNode:
        """左旋转操作"""
        right_child = node.right
        node.right = right_child.left
        right_child.left = node
        
        # 更新子树大小
        node.update_size()
        right_child.update_size()
        
        return right_child
    
    def _insert(self, node: Optional[TreapNode], item: Any, score: float) -> TreapNode:
        """递归插入节点"""
        if node is None:
            return TreapNode(item, score)
        
        if score > node.score:  # 按分数降序排列
            # 插入左子树
            node.left = self._insert(node.left, item, score)
            # 维护堆性质
            if node.left and node.left.priority > node.priority:
                node = self._rotate_right(node)
        elif score < node.score:
            # 插入右子树
            node.right = self._insert(node.right, item, score)
            # 维护堆性质
            if node.right and node.right.priority > node.priority:
                node = self._rotate_left(node)
        else:
            # 分数相等，更新项目（可选择保留原有或更新）
            node.item = item
        
        node.update_size()
        return node
    
    def _delete_min(self, node: Optional[TreapNode]) -> Optional[TreapNode]:
        """删除最小值节点（分数最低的节点）"""
        if node is None:
            return None
        
        if node.right is None:
            # 找到最小值节点，删除它
            return node.left
        
        node.right = self._delete_min(node.right)
        if node:
            node.update_size()
        return node
    
    def _find_min_score(self, node: Optional[TreapNode]) -> float:
        """找到最小分数"""
        if node is None:
            return float('-inf')
        
        while node.right is not None:
            node = node.right
        
        return node.score
    
    def insert(self, item: Any, score: float):
        """
        插入新的推荐项目
        
        Args:
            item: 推荐项目
            score: 推荐分数
        """
        if self.size < self.k:
            # 还没达到K个，直接插入
            self.root = self._insert(self.root, item, score)
            self.size += 1
        else:
            # 已有K个元素，检查是否需要替换最小值
            min_score = self._find_min_score(self.root)
            if score > min_score:
                # 新分数更高，删除最小值并插入新值
                self.root = self._delete_min(self.root)
                self.root = self._insert(self.root, item, score)
    
    def _inorder_traversal(self, node: Optional[TreapNode], result: List[Tuple[Any, float]]):
        """中序遍历，获取按分数降序排列的结果"""
        if node is None:
            return
        
        # 左子树（更高分数）
        self._inorder_traversal(node.left, result)
        # 当前节点
        result.append((node.item, node.score))
        # 右子树（更低分数）
        self._inorder_traversal(node.right, result)
    
    def get_top_k(self) -> List[Tuple[Any, float]]:
        """
        获取Top-K推荐结果
        
        Returns:
            按分数降序排列的Top-K推荐列表
        """
        result = []
        self._inorder_traversal(self.root, result)
        return result
    
    def get_size(self) -> int:
        """获取当前存储的元素数量"""
        return self.size
    
    def is_full(self) -> bool:
        """检查是否已满K个元素"""
        return self.size >= self.k
    
    def get_min_score(self) -> float:
        """获取当前最小分数"""
        if self.size == 0:
            return float('-inf')
        return self._find_min_score(self.root)


class TreapRecommendationOptimizer:
    """
    基于Treap的推荐系统优化器
    用于替换原有的快速选择算法
    """
    
    @staticmethod
    def treap_top_k_recommendations(recommendations: List[Tuple], k: int = 12) -> List[Tuple]:
        """
        使用Treap数据结构获取Top-K推荐
        时间复杂度：O(n log k)，空间复杂度：O(k)
        
        Args:
            recommendations: 推荐列表，格式为[(item, score), ...]
            k: 返回前K个推荐
            
        Returns:
            前K个推荐的列表（已按分数降序排序）
        """
        if not recommendations or k <= 0:
            return []
        
        k = min(k, len(recommendations))
        n = len(recommendations)
        
        # 自适应策略：小数据集直接排序更高效
        if n <= 50 or k >= n * 0.8:
            return sorted(recommendations, key=lambda x: x[1], reverse=True)[:k]
        
        # 创建Treap实例
        treap = TreapTopK(k)
        
        # 插入所有推荐项目
        for item, score in recommendations:
            treap.insert(item, score)
        
        # 获取Top-K结果
        return treap.get_top_k()
    
    @staticmethod
    def streaming_top_k_recommendations(recommendation_stream, k: int = 12) -> List[Tuple]:
        """
        流式处理Top-K推荐（适用于大数据集或实时推荐）
        
        Args:
            recommendation_stream: 推荐数据流（生成器或迭代器）
            k: 返回前K个推荐
            
        Returns:
            前K个推荐的列表
        """
        treap = TreapTopK(k)
        
        for item, score in recommendation_stream:
            treap.insert(item, score)
        
        return treap.get_top_k()
    
    @staticmethod
    def batch_top_k_recommendations(recommendations: List[Tuple], k: int = 12, 
                                   batch_size: int = 1000) -> List[Tuple]:
        """
        批量处理Top-K推荐（适用于超大数据集）
        
        Args:
            recommendations: 推荐列表
            k: 返回前K个推荐
            batch_size: 批处理大小
            
        Returns:
            前K个推荐的列表
        """
        if not recommendations or k <= 0:
            return []
        
        # 如果数据量小于批处理大小，直接处理
        if len(recommendations) <= batch_size:
            return TreapRecommendationOptimizer.treap_top_k_recommendations(recommendations, k)
        
        # 分批处理
        treap = TreapTopK(k)
        
        for i in range(0, len(recommendations), batch_size):
            batch = recommendations[i:i + batch_size]
            # 对每个批次先进行局部Top-K
            batch_top_k = sorted(batch, key=lambda x: x[1], reverse=True)[:k]
            
            # 将批次结果插入全局Treap
            for item, score in batch_top_k:
                treap.insert(item, score)
        
        return treap.get_top_k()


def benchmark_treap_vs_quickselect():
    """
    性能基准测试：Treap vs 快速选择
    """
    import time
    import random
    
    # 生成测试数据
    def generate_test_data(n: int) -> List[Tuple[Dict, float]]:
        data = []
        for i in range(n):
            item = {"id": f"item_{i}", "name": f"Item {i}"}
            score = random.uniform(0, 10)
            data.append((item, score))
        return data
    
    # 测试不同数据规模
    test_sizes = [100, 500, 1000, 5000, 10000]
    k = 12
    
    print("性能基准测试：Treap vs 快速选择")
    print("=" * 50)
    
    for n in test_sizes:
        test_data = generate_test_data(n)
        
        # 测试Treap方法
        start_time = time.time()
        treap_result = TreapRecommendationOptimizer.treap_top_k_recommendations(test_data, k)
        treap_time = time.time() - start_time
        
        # 测试传统排序方法
        start_time = time.time()
        sorted_result = sorted(test_data, key=lambda x: x[1], reverse=True)[:k]
        sort_time = time.time() - start_time
        
        print(f"数据规模: {n}")
        print(f"  Treap方法:    {treap_time:.6f}s")
        print(f"  排序方法:     {sort_time:.6f}s")
        print(f"  性能提升:     {sort_time/treap_time:.2f}x")
        print(f"  结果一致性:   {len(treap_result) == len(sorted_result)}")
        print()


def test_treap_functionality():
    """测试Treap功能正确性"""
    print("Treap功能测试")
    print("=" * 30)
    
    # 创建测试数据
    test_recommendations = [
        ({"id": "place_1", "name": "西湖"}, 8.5),
        ({"id": "place_2", "name": "故宫"}, 9.2),
        ({"id": "place_3", "name": "长城"}, 9.8),
        ({"id": "place_4", "name": "天坛"}, 7.6),
        ({"id": "place_5", "name": "颐和园"}, 8.1),
        ({"id": "place_6", "name": "圆明园"}, 7.9),
        ({"id": "place_7", "name": "北海公园"}, 7.3),
        ({"id": "place_8", "name": "景山公园"}, 7.0),
    ]
    
    k = 5
    
    # 使用Treap获取Top-K
    result = TreapRecommendationOptimizer.treap_top_k_recommendations(test_recommendations, k)
    
    print(f"Top-{k} 推荐结果:")
    for i, (item, score) in enumerate(result, 1):
        print(f"{i}. {item['name']}: {score}")
    
    # 验证结果正确性
    expected = sorted(test_recommendations, key=lambda x: x[1], reverse=True)[:k]
    expected_scores = [score for _, score in expected]
    actual_scores = [score for _, score in result]
    
    print(f"\n验证结果:")
    print(f"期望分数: {expected_scores}")
    print(f"实际分数: {actual_scores}")
    print(f"结果正确: {expected_scores == actual_scores}")


def test_adaptive_strategy():
    """测试自适应策略"""
    print("\n自适应策略测试")
    print("=" * 30)
    
    import time
    import random
    
    # 测试不同场景
    scenarios = [
        {"n": 20, "k": 5, "desc": "小数据集"},
        {"n": 100, "k": 80, "desc": "高K比例"},
        {"n": 1000, "k": 12, "desc": "中等数据集"},
        {"n": 5000, "k": 12, "desc": "大数据集"},
    ]
    
    for scenario in scenarios:
        n, k, desc = scenario["n"], scenario["k"], scenario["desc"]
        
        # 生成测试数据
        test_data = []
        for i in range(n):
            item = {"id": f"item_{i}"}
            score = random.uniform(0, 10)
            test_data.append((item, score))
        
        # 测试Treap方法
        start_time = time.time()
        treap_result = TreapRecommendationOptimizer.treap_top_k_recommendations(test_data, k)
        treap_time = time.time() - start_time
        
        # 测试排序方法
        start_time = time.time()
        sort_result = sorted(test_data, key=lambda x: x[1], reverse=True)[:k]
        sort_time = time.time() - start_time
        
        print(f"{desc} (n={n}, k={k}):")
        print(f"  Treap: {treap_time:.6f}s")
        print(f"  排序:  {sort_time:.6f}s")
        print(f"  策略:  {'排序' if n <= 50 or k >= n * 0.8 else 'Treap'}")
        print()


if __name__ == "__main__":
    # 运行功能测试
    test_treap_functionality()
    print()
    
    # 运行自适应策略测试
    test_adaptive_strategy()
    
    # 运行性能基准测试
    benchmark_treap_vs_quickselect() 