#!/usr/bin/env python3
"""
斐波那契堆 (Fibonacci Heap) 实现
支持高效的优先队列操作，特别适用于图算法如Dijkstra和Prim算法

时间复杂度:
- insert: O(1) 摊还
- find_min: O(1)
- extract_min: O(log n) 摊还
- decrease_key: O(1) 摊还
- delete: O(log n) 摊还
- merge: O(1)
"""

import math
from typing import Optional, List, Any


class FibonacciHeapNode:
    """斐波那契堆节点"""
    
    def __init__(self, key: float, data: Any = None):
        self.key = key
        self.data = data
        self.degree = 0  # 子节点数量
        self.marked = False  # 是否被标记
        self.parent: Optional['FibonacciHeapNode'] = None
        self.child: Optional['FibonacciHeapNode'] = None
        self.left: Optional['FibonacciHeapNode'] = self
        self.right: Optional['FibonacciHeapNode'] = self
    
    def __str__(self):
        return f"Node(key={self.key}, data={self.data})"
    
    def __repr__(self):
        return self.__str__()


class FibonacciHeap:
    """斐波那契堆实现"""
    
    def __init__(self):
        self.min_node: Optional[FibonacciHeapNode] = None
        self.num_nodes = 0
    
    def is_empty(self) -> bool:
        """检查堆是否为空"""
        return self.min_node is None
    
    def size(self) -> int:
        """返回堆中节点数量"""
        return self.num_nodes
    
    def find_min(self) -> Optional[FibonacciHeapNode]:
        """返回最小节点"""
        return self.min_node
    
    def insert(self, key: float, data: Any = None) -> FibonacciHeapNode:
        """
        插入新节点
        
        Args:
            key: 节点键值
            data: 节点数据
            
        Returns:
            插入的节点
        """
        node = FibonacciHeapNode(key, data)
        
        if self.min_node is None:
            self.min_node = node
        else:
            self._add_to_root_list(node)
            if node.key < self.min_node.key:
                self.min_node = node
        
        self.num_nodes += 1
        return node
    
    def extract_min(self) -> Optional[FibonacciHeapNode]:
        """
        提取并删除最小节点
        
        Returns:
            被删除的最小节点
        """
        min_node = self.min_node
        
        if min_node is not None:
            # 将最小节点的所有子节点添加到根列表
            if min_node.child is not None:
                children = []
                child = min_node.child
                while True:
                    children.append(child)
                    child = child.right
                    if child == min_node.child:
                        break
                
                for child in children:
                    self._remove_from_child_list(min_node, child)
                    self._add_to_root_list(child)
                    child.parent = None
            
            # 从根列表中移除最小节点
            self._remove_from_root_list(min_node)
            
            if min_node == min_node.right:
                # 堆中只有一个节点
                self.min_node = None
            else:
                self.min_node = min_node.right
                self._consolidate()
            
            self.num_nodes -= 1
        
        return min_node
    
    def decrease_key(self, node: FibonacciHeapNode, new_key: float):
        """
        减少节点的键值
        
        Args:
            node: 要修改的节点
            new_key: 新的键值（必须小于当前键值）
        """
        if new_key > node.key:
            raise ValueError("新键值必须小于当前键值")
        
        node.key = new_key
        parent = node.parent
        
        if parent is not None and node.key < parent.key:
            self._cut(node, parent)
            self._cascading_cut(parent)
        
        if node.key < self.min_node.key:
            self.min_node = node
    
    def delete(self, node: FibonacciHeapNode):
        """
        删除指定节点
        
        Args:
            node: 要删除的节点
        """
        self.decrease_key(node, float('-inf'))
        self.extract_min()
    
    def merge(self, other: 'FibonacciHeap') -> 'FibonacciHeap':
        """
        合并两个斐波那契堆
        
        Args:
            other: 另一个斐波那契堆
            
        Returns:
            合并后的新堆
        """
        new_heap = FibonacciHeap()
        new_heap.min_node = self.min_node
        
        if new_heap.min_node is not None:
            if other.min_node is not None:
                # 连接两个根列表
                new_heap.min_node.right.left = other.min_node.left
                other.min_node.left.right = new_heap.min_node.right
                new_heap.min_node.right = other.min_node
                other.min_node.left = new_heap.min_node
                
                if other.min_node.key < new_heap.min_node.key:
                    new_heap.min_node = other.min_node
        else:
            new_heap.min_node = other.min_node
        
        new_heap.num_nodes = self.num_nodes + other.num_nodes
        return new_heap
    
    def _add_to_root_list(self, node: FibonacciHeapNode):
        """将节点添加到根列表"""
        if self.min_node is None:
            self.min_node = node
            node.left = node.right = node
        else:
            node.left = self.min_node
            node.right = self.min_node.right
            self.min_node.right.left = node
            self.min_node.right = node
    
    def _remove_from_root_list(self, node: FibonacciHeapNode):
        """从根列表中移除节点"""
        if node.right == node:
            self.min_node = None
        else:
            node.left.right = node.right
            node.right.left = node.left
            if self.min_node == node:
                self.min_node = node.right
    
    def _remove_from_child_list(self, parent: FibonacciHeapNode, child: FibonacciHeapNode):
        """从子列表中移除节点"""
        if child.right == child:
            parent.child = None
        else:
            child.left.right = child.right
            child.right.left = child.left
            if parent.child == child:
                parent.child = child.right
        parent.degree -= 1
    
    def _consolidate(self):
        """合并度数相同的树"""
        max_degree = int(math.log(self.num_nodes) * 2) + 1
        degree_table = [None] * max_degree
        
        # 收集所有根节点
        roots = []
        root = self.min_node
        if root is not None:
            while True:
                roots.append(root)
                root = root.right
                if root == self.min_node:
                    break
        
        # 合并度数相同的树
        for root in roots:
            degree = root.degree
            while degree_table[degree] is not None:
                other = degree_table[degree]
                if root.key > other.key:
                    root, other = other, root
                
                self._link(other, root)
                degree_table[degree] = None
                degree += 1
            
            degree_table[degree] = root
        
        # 重建根列表并找到新的最小节点
        self.min_node = None
        for node in degree_table:
            if node is not None:
                if self.min_node is None:
                    self.min_node = node
                    node.left = node.right = node
                else:
                    self._add_to_root_list(node)
                    if node.key < self.min_node.key:
                        self.min_node = node
    
    def _link(self, child: FibonacciHeapNode, parent: FibonacciHeapNode):
        """将child链接为parent的子节点"""
        # 从根列表中移除child
        child.left.right = child.right
        child.right.left = child.left
        
        # 将child添加为parent的子节点
        child.parent = parent
        if parent.child is None:
            parent.child = child
            child.left = child.right = child
        else:
            child.left = parent.child
            child.right = parent.child.right
            parent.child.right.left = child
            parent.child.right = child
        
        parent.degree += 1
        child.marked = False
    
    def _cut(self, child: FibonacciHeapNode, parent: FibonacciHeapNode):
        """切断child与parent的连接"""
        self._remove_from_child_list(parent, child)
        self._add_to_root_list(child)
        child.parent = None
        child.marked = False
    
    def _cascading_cut(self, node: FibonacciHeapNode):
        """级联切断"""
        parent = node.parent
        if parent is not None:
            if not node.marked:
                node.marked = True
            else:
                self._cut(node, parent)
                self._cascading_cut(parent)
    
    def display(self):
        """显示堆的结构（用于调试）"""
        if self.is_empty():
            print("空堆")
            return
        
        print(f"斐波那契堆 (大小: {self.num_nodes})")
        print(f"最小节点: {self.min_node}")
        
        # 显示根列表
        print("根列表:")
        root = self.min_node
        while True:
            print(f"  {root} (度数: {root.degree})")
            if root.child:
                self._display_children(root.child, 2)
            root = root.right
            if root == self.min_node:
                break
    
    def _display_children(self, node: FibonacciHeapNode, indent: int):
        """递归显示子节点"""
        child = node
        while True:
            print("  " * indent + f"{child} (度数: {child.degree})")
            if child.child:
                self._display_children(child.child, indent + 1)
            child = child.right
            if child == node:
                break


def test_fibonacci_heap():
    """测试斐波那契堆"""
    print("🔥 斐波那契堆测试")
    print("=" * 50)
    
    # 创建堆
    heap = FibonacciHeap()
    
    # 测试插入
    print("1. 测试插入操作:")
    nodes = []
    values = [10, 5, 15, 3, 8, 12, 20, 1, 6]
    for val in values:
        node = heap.insert(val, f"data_{val}")
        nodes.append(node)
        print(f"  插入 {val}")
    
    print(f"堆大小: {heap.size()}")
    print(f"最小值: {heap.find_min().key}")
    
    # 测试提取最小值
    print("\n2. 测试提取最小值:")
    for i in range(3):
        min_node = heap.extract_min()
        if min_node:
            print(f"  提取: {min_node.key}")
    
    print(f"堆大小: {heap.size()}")
    print(f"当前最小值: {heap.find_min().key}")
    
    # 测试减少键值
    print("\n3. 测试减少键值:")
    if len(nodes) > 5:
        old_key = nodes[5].key
        new_key = 2
        print(f"  将节点 {old_key} 的键值减少到 {new_key}")
        heap.decrease_key(nodes[5], new_key)
        print(f"  新的最小值: {heap.find_min().key}")
    
    # 测试删除节点
    print("\n4. 测试删除节点:")
    if len(nodes) > 6:
        delete_key = nodes[6].key
        print(f"  删除节点 {delete_key}")
        heap.delete(nodes[6])
        print(f"  堆大小: {heap.size()}")
    
    # 测试合并
    print("\n5. 测试堆合并:")
    heap2 = FibonacciHeap()
    for val in [25, 30, 35]:
        heap2.insert(val, f"data_{val}")
    
    print(f"  堆1大小: {heap.size()}, 最小值: {heap.find_min().key}")
    print(f"  堆2大小: {heap2.size()}, 最小值: {heap2.find_min().key}")
    
    merged_heap = heap.merge(heap2)
    print(f"  合并后大小: {merged_heap.size()}, 最小值: {merged_heap.find_min().key}")
    
    # 提取所有元素验证排序
    print("\n6. 验证堆排序:")
    result = []
    while not merged_heap.is_empty():
        min_node = merged_heap.extract_min()
        result.append(min_node.key)
    
    print(f"  排序结果: {result}")
    print(f"  是否有序: {result == sorted(result)}")


def dijkstra_with_fibonacci_heap(graph: dict, start: str):
    """
    使用斐波那契堆实现Dijkstra算法
    
    Args:
        graph: 图的邻接表表示 {node: [(neighbor, weight), ...]}
        start: 起始节点
        
    Returns:
        距离字典和前驱字典
    """
    distances = {node: float('inf') for node in graph}
    distances[start] = 0
    previous = {node: None for node in graph}
    
    # 使用斐波那契堆作为优先队列
    heap = FibonacciHeap()
    nodes_in_heap = {}
    
    # 初始化堆
    for node in graph:
        heap_node = heap.insert(distances[node], node)
        nodes_in_heap[node] = heap_node
    
    visited = set()
    
    while not heap.is_empty():
        # 提取距离最小的节点
        min_heap_node = heap.extract_min()
        current = min_heap_node.data
        
        if current in visited:
            continue
        
        visited.add(current)
        del nodes_in_heap[current]
        
        # 更新邻居节点的距离
        for neighbor, weight in graph.get(current, []):
            if neighbor not in visited:
                new_distance = distances[current] + weight
                
                if new_distance < distances[neighbor]:
                    distances[neighbor] = new_distance
                    previous[neighbor] = current
                    
                    # 减少键值
                    if neighbor in nodes_in_heap:
                        heap.decrease_key(nodes_in_heap[neighbor], new_distance)
    
    return distances, previous


def test_dijkstra():
    """测试使用斐波那契堆的Dijkstra算法"""
    print("\n🗺️ Dijkstra算法测试")
    print("=" * 50)
    
    # 创建测试图
    graph = {
        'A': [('B', 4), ('C', 2)],
        'B': [('C', 1), ('D', 5)],
        'C': [('D', 8), ('E', 10)],
        'D': [('E', 2)],
        'E': []
    }
    
    print("图结构:")
    for node, edges in graph.items():
        print(f"  {node}: {edges}")
    
    # 运行Dijkstra算法
    start = 'A'
    distances, previous = dijkstra_with_fibonacci_heap(graph, start)
    
    print(f"\n从节点 {start} 开始的最短距离:")
    for node, distance in distances.items():
        print(f"  到 {node}: {distance}")
    
    print(f"\n最短路径树:")
    for node, prev in previous.items():
        if prev is not None:
            print(f"  {prev} -> {node}")


# ==================== A* 算法实现 ====================

import heapq
from typing import Tuple, Set, Dict, Callable, Union


class AStarNode:
    """A*算法中的节点"""
    
    def __init__(self, position: Tuple[int, int], g_cost: float = 0, h_cost: float = 0, parent: 'AStarNode' = None):
        self.position = position  # 节点位置 (x, y)
        self.g_cost = g_cost     # 从起点到当前节点的实际代价
        self.h_cost = h_cost     # 从当前节点到终点的启发式代价
        self.f_cost = g_cost + h_cost  # 总代价 f = g + h
        self.parent = parent     # 父节点，用于重构路径
        self.heap_node: Optional[FibonacciHeapNode] = None  # 在斐波那契堆中的节点引用
    
    def __str__(self):
        return f"AStarNode(pos={self.position}, f={self.f_cost:.2f}, g={self.g_cost:.2f}, h={self.h_cost:.2f})"
    
    def __repr__(self):
        return self.__str__()
    
    def __eq__(self, other):
        return isinstance(other, AStarNode) and self.position == other.position
    
    def __hash__(self):
        return hash(self.position)


class AStarPathfinder:
    """基于斐波那契堆的A*路径规划器"""
    
    def __init__(self, grid: List[List[int]], heuristic: str = 'manhattan'):
        """
        初始化A*路径规划器
        
        Args:
            grid: 二维网格，0表示可通行，1表示障碍物
            heuristic: 启发式函数类型 ('manhattan', 'euclidean', 'diagonal')
        """
        self.grid = grid
        self.rows = len(grid)
        self.cols = len(grid[0]) if grid else 0
        self.heuristic_func = self._get_heuristic_function(heuristic)
        
        # 8个方向的移动（包括对角线）
        self.directions = [
            (-1, -1, 1.414), (-1, 0, 1.0), (-1, 1, 1.414),
            (0, -1, 1.0),                   (0, 1, 1.0),
            (1, -1, 1.414),  (1, 0, 1.0),  (1, 1, 1.414)
        ]
    
    def _get_heuristic_function(self, heuristic: str) -> Callable:
        """获取启发式函数"""
        if heuristic == 'manhattan':
            return self._manhattan_distance
        elif heuristic == 'euclidean':
            return self._euclidean_distance
        elif heuristic == 'diagonal':
            return self._diagonal_distance
        else:
            raise ValueError(f"未知的启发式函数: {heuristic}")
    
    def _manhattan_distance(self, pos1: Tuple[int, int], pos2: Tuple[int, int]) -> float:
        """曼哈顿距离"""
        return abs(pos1[0] - pos2[0]) + abs(pos1[1] - pos2[1])
    
    def _euclidean_distance(self, pos1: Tuple[int, int], pos2: Tuple[int, int]) -> float:
        """欧几里得距离"""
        return math.sqrt((pos1[0] - pos2[0])**2 + (pos1[1] - pos2[1])**2)
    
    def _diagonal_distance(self, pos1: Tuple[int, int], pos2: Tuple[int, int]) -> float:
        """对角线距离（Chebyshev距离的变种）"""
        dx = abs(pos1[0] - pos2[0])
        dy = abs(pos1[1] - pos2[1])
        return max(dx, dy) + (1.414 - 1) * min(dx, dy)
    
    def _is_valid_position(self, pos: Tuple[int, int]) -> bool:
        """检查位置是否有效"""
        x, y = pos
        return (0 <= x < self.rows and 
                0 <= y < self.cols and 
                self.grid[x][y] == 0)
    
    def _get_neighbors(self, node: AStarNode) -> List[Tuple[Tuple[int, int], float]]:
        """获取节点的所有有效邻居"""
        neighbors = []
        x, y = node.position
        
        for dx, dy, cost in self.directions:
            new_pos = (x + dx, y + dy)
            if self._is_valid_position(new_pos):
                neighbors.append((new_pos, cost))
        
        return neighbors
    
    def _reconstruct_path(self, node: AStarNode) -> List[Tuple[int, int]]:
        """重构路径"""
        path = []
        current = node
        while current:
            path.append(current.position)
            current = current.parent
        return path[::-1]  # 反转路径
    
    def find_path(self, start: Tuple[int, int], goal: Tuple[int, int]) -> Tuple[List[Tuple[int, int]], Dict]:
        """
        使用A*算法寻找路径
        
        Args:
            start: 起始位置
            goal: 目标位置
            
        Returns:
            (路径, 统计信息)
        """
        if not self._is_valid_position(start) or not self._is_valid_position(goal):
            return [], {"error": "起始位置或目标位置无效"}
        
        if start == goal:
            return [start], {"nodes_explored": 0, "path_length": 0, "path_cost": 0}
        
        # 使用斐波那契堆作为开放列表
        open_heap = FibonacciHeap()
        open_set: Dict[Tuple[int, int], AStarNode] = {}  # 位置 -> 节点映射
        closed_set: Set[Tuple[int, int]] = set()  # 已探索的位置
        
        # 创建起始节点
        start_node = AStarNode(
            position=start,
            g_cost=0,
            h_cost=self.heuristic_func(start, goal)
        )
        
        # 将起始节点添加到开放列表
        heap_node = open_heap.insert(start_node.f_cost, start_node)
        start_node.heap_node = heap_node
        open_set[start] = start_node
        
        nodes_explored = 0
        
        while not open_heap.is_empty():
            # 从开放列表中取出f值最小的节点
            min_heap_node = open_heap.extract_min()
            current_node = min_heap_node.data
            current_pos = current_node.position
            
            # 从开放列表中移除
            if current_pos in open_set:
                del open_set[current_pos]
            
            # 添加到已探索列表
            closed_set.add(current_pos)
            nodes_explored += 1
            
            # 检查是否到达目标
            if current_pos == goal:
                path = self._reconstruct_path(current_node)
                return path, {
                    "nodes_explored": nodes_explored,
                    "path_length": len(path),
                    "path_cost": current_node.g_cost,
                    "success": True
                }
            
            # 探索邻居节点
            for neighbor_pos, move_cost in self._get_neighbors(current_node):
                if neighbor_pos in closed_set:
                    continue
                
                # 计算新的g值
                tentative_g = current_node.g_cost + move_cost
                
                # 检查邻居是否已在开放列表中
                if neighbor_pos in open_set:
                    neighbor_node = open_set[neighbor_pos]
                    
                    # 如果找到更好的路径，更新节点
                    if tentative_g < neighbor_node.g_cost:
                        neighbor_node.g_cost = tentative_g
                        neighbor_node.f_cost = tentative_g + neighbor_node.h_cost
                        neighbor_node.parent = current_node
                        
                        # 使用斐波那契堆的decrease_key操作
                        open_heap.decrease_key(neighbor_node.heap_node, neighbor_node.f_cost)
                else:
                    # 创建新的邻居节点
                    neighbor_node = AStarNode(
                        position=neighbor_pos,
                        g_cost=tentative_g,
                        h_cost=self.heuristic_func(neighbor_pos, goal),
                        parent=current_node
                    )
                    
                    # 添加到开放列表
                    heap_node = open_heap.insert(neighbor_node.f_cost, neighbor_node)
                    neighbor_node.heap_node = heap_node
                    open_set[neighbor_pos] = neighbor_node
        
        # 没有找到路径
        return [], {
            "nodes_explored": nodes_explored,
            "path_length": 0,
            "path_cost": float('inf'),
            "success": False,
            "error": "无法找到路径"
        }
    
    def find_multiple_paths(self, start: Tuple[int, int], goals: List[Tuple[int, int]]) -> Dict:
        """
        寻找从起点到多个目标点的最短路径
        
        Args:
            start: 起始位置
            goals: 目标位置列表
            
        Returns:
            包含所有路径的字典
        """
        results = {}
        total_stats = {
            "total_nodes_explored": 0,
            "successful_paths": 0,
            "failed_paths": 0
        }
        
        for i, goal in enumerate(goals):
            path, stats = self.find_path(start, goal)
            results[f"goal_{i}_{goal}"] = {
                "path": path,
                "stats": stats
            }
            
            total_stats["total_nodes_explored"] += stats.get("nodes_explored", 0)
            if stats.get("success", False):
                total_stats["successful_paths"] += 1
            else:
                total_stats["failed_paths"] += 1
        
        results["summary"] = total_stats
        return results


def create_sample_grid(rows: int, cols: int, obstacle_ratio: float = 0.2) -> List[List[int]]:
    """
    创建示例网格
    
    Args:
        rows: 行数
        cols: 列数
        obstacle_ratio: 障碍物比例
        
    Returns:
        二维网格
    """
    import random
    
    grid = [[0 for _ in range(cols)] for _ in range(rows)]
    
    # 随机添加障碍物
    num_obstacles = int(rows * cols * obstacle_ratio)
    for _ in range(num_obstacles):
        x = random.randint(0, rows - 1)
        y = random.randint(0, cols - 1)
        grid[x][y] = 1
    
    return grid


def visualize_path(grid: List[List[int]], path: List[Tuple[int, int]], 
                  start: Tuple[int, int], goal: Tuple[int, int]):
    """
    可视化路径
    
    Args:
        grid: 网格
        path: 路径
        start: 起点
        goal: 终点
    """
    if not path:
        print("没有找到路径！")
        return
    
    # 创建可视化网格
    vis_grid = [row[:] for row in grid]  # 复制网格
    
    # 标记路径
    for pos in path:
        if pos != start and pos != goal:
            vis_grid[pos[0]][pos[1]] = 2  # 路径标记
    
    # 标记起点和终点
    vis_grid[start[0]][start[1]] = 3  # 起点
    vis_grid[goal[0]][goal[1]] = 4    # 终点
    
    # 打印网格
    symbols = {0: '·', 1: '█', 2: '○', 3: 'S', 4: 'G'}
    print("\n网格可视化:")
    print("  ", end="")
    for j in range(len(vis_grid[0])):
        print(f"{j:2}", end="")
    print()
    
    for i, row in enumerate(vis_grid):
        print(f"{i:2}", end="")
        for cell in row:
            print(f" {symbols[cell]}", end="")
        print()
    
    print(f"\n图例: S=起点, G=终点, ○=路径, █=障碍物, ·=空地")
    print(f"路径长度: {len(path)}")


def test_astar_algorithm():
    """测试A*算法"""
    print("=" * 60)
    print("测试基于斐波那契堆的A*算法")
    print("=" * 60)
    
    # 创建测试网格
    grid = [
        [0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
        [0, 1, 1, 0, 1, 0, 1, 1, 1, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
        [0, 1, 1, 1, 1, 1, 1, 0, 1, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
        [1, 1, 1, 1, 0, 1, 1, 1, 1, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    ]
    
    pathfinder = AStarPathfinder(grid, heuristic='manhattan')
    
    # 测试1: 基本路径查找
    print("\n1. 基本路径查找测试")
    start = (0, 0)
    goal = (9, 9)
    
    path, stats = pathfinder.find_path(start, goal)
    print(f"从 {start} 到 {goal}:")
    print(f"路径: {path[:5]}...{path[-5:] if len(path) > 10 else path}")
    print(f"统计: {stats}")
    
    visualize_path(grid, path, start, goal)
    
    # 测试2: 不同启发式函数比较
    print("\n2. 不同启发式函数比较")
    heuristics = ['manhattan', 'euclidean', 'diagonal']
    
    for heuristic in heuristics:
        pathfinder_h = AStarPathfinder(grid, heuristic=heuristic)
        path_h, stats_h = pathfinder_h.find_path(start, goal)
        print(f"{heuristic:10}: 路径长度={stats_h['path_length']:2}, "
              f"路径代价={stats_h['path_cost']:6.2f}, "
              f"探索节点={stats_h['nodes_explored']:3}")
    
    # 测试3: 多目标路径查找
    print("\n3. 多目标路径查找测试")
    goals = [(2, 8), (6, 9), (8, 2), (9, 9)]
    results = pathfinder.find_multiple_paths(start, goals)
    
    print(f"从 {start} 到多个目标:")
    for key, result in results.items():
        if key != "summary":
            stats = result["stats"]
            if stats.get("success", False):
                print(f"  {key}: 路径长度={stats['path_length']}, 代价={stats['path_cost']:.2f}")
            else:
                print(f"  {key}: 失败 - {stats.get('error', '未知错误')}")
    
    print(f"总结: {results['summary']}")
    
    # 测试4: 性能测试
    print("\n4. 性能测试")
    import time
    
    # 创建大网格
    large_grid = create_sample_grid(50, 50, obstacle_ratio=0.3)
    large_pathfinder = AStarPathfinder(large_grid, heuristic='manhattan')
    
    start_time = time.time()
    large_path, large_stats = large_pathfinder.find_path((0, 0), (49, 49))
    end_time = time.time()
    
    print(f"大网格 (50x50) 测试:")
    print(f"  执行时间: {(end_time - start_time)*1000:.2f} ms")
    print(f"  路径长度: {large_stats['path_length']}")
    print(f"  路径代价: {large_stats['path_cost']:.2f}")
    print(f"  探索节点: {large_stats['nodes_explored']}")
    print(f"  成功: {large_stats.get('success', False)}")


def compare_astar_implementations():
    """比较基于斐波那契堆和标准堆的A*算法性能"""
    print("\n" + "=" * 60)
    print("A*算法性能比较: 斐波那契堆 vs 标准堆")
    print("=" * 60)
    
    import time
    import heapq
    
    # 标准堆实现的A*算法（用于比较）
    def astar_with_heapq(grid, start, goal):
        """使用标准堆的A*算法"""
        if start == goal:
            return [start], {"nodes_explored": 0}
        
        def heuristic(pos1, pos2):
            return abs(pos1[0] - pos2[0]) + abs(pos1[1] - pos2[1])
        
        open_list = []
        heapq.heappush(open_list, (0, 0, start, [start]))  # (f, g, pos, path)
        closed_set = set()
        nodes_explored = 0
        
        directions = [(-1,-1,1.414), (-1,0,1), (-1,1,1.414), (0,-1,1), (0,1,1), (1,-1,1.414), (1,0,1), (1,1,1.414)]
        
        while open_list:
            f, g, current, path = heapq.heappop(open_list)
            
            if current in closed_set:
                continue
                
            closed_set.add(current)
            nodes_explored += 1
            
            if current == goal:
                return path, {"nodes_explored": nodes_explored}
            
            x, y = current
            for dx, dy, cost in directions:
                nx, ny = x + dx, y + dy
                if (0 <= nx < len(grid) and 0 <= ny < len(grid[0]) and 
                    grid[nx][ny] == 0 and (nx, ny) not in closed_set):
                    
                    new_g = g + cost
                    new_f = new_g + heuristic((nx, ny), goal)
                    heapq.heappush(open_list, (new_f, new_g, (nx, ny), path + [(nx, ny)]))
        
        return [], {"nodes_explored": nodes_explored}
    
    # 测试不同大小的网格
    test_sizes = [(20, 20), (30, 30), (40, 40)]
    
    for rows, cols in test_sizes:
        print(f"\n测试网格大小: {rows}x{cols}")
        print("-" * 40)
        
        # 创建测试网格
        grid = create_sample_grid(rows, cols, obstacle_ratio=0.25)
        start = (0, 0)
        goal = (rows-1, cols-1)
        
        # 测试斐波那契堆版本
        pathfinder = AStarPathfinder(grid, heuristic='manhattan')
        
        start_time = time.time()
        fib_path, fib_stats = pathfinder.find_path(start, goal)
        fib_time = time.time() - start_time
        
        # 测试标准堆版本
        start_time = time.time()
        heap_path, heap_stats = astar_with_heapq(grid, start, goal)
        heap_time = time.time() - start_time
        
        # 输出比较结果
        print(f"斐波那契堆版本:")
        print(f"  时间: {fib_time*1000:.2f} ms")
        print(f"  路径长度: {len(fib_path)}")
        print(f"  探索节点: {fib_stats.get('nodes_explored', 0)}")
        
        print(f"标准堆版本:")
        print(f"  时间: {heap_time*1000:.2f} ms")
        print(f"  路径长度: {len(heap_path)}")
        print(f"  探索节点: {heap_stats.get('nodes_explored', 0)}")
        
        if heap_time > 0:
            speedup = fib_time / heap_time
            print(f"性能比较: {'斐波那契堆更快' if speedup < 1 else '标准堆更快'} "
                  f"({abs(1-speedup)*100:.1f}%)")


if __name__ == "__main__":
    # 运行斐波那契堆测试
    test_fibonacci_heap()
    
    # 运行Dijkstra算法测试
    test_dijkstra()
    
    # 运行A*算法测试
    test_astar_algorithm()
    
    # 运行性能比较测试
    compare_astar_implementations() 