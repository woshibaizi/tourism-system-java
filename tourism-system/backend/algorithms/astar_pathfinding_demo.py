#!/usr/bin/env python3
"""
基于斐波那契堆的A*算法演示
展示A*算法在路径规划、游戏AI、机器人导航等场景中的应用

A*算法的优势：
1. 最优性：保证找到最短路径（在启发式函数可接受的情况下）
2. 高效性：相比Dijkstra算法，A*使用启发式函数指导搜索方向
3. 灵活性：支持不同的启发式函数和代价计算方式

斐波那契堆的优势：
1. decrease_key操作：O(1)摊还时间复杂度
2. 适合频繁更新优先级的场景
3. 在稠密图中性能优于二叉堆
"""

import math
import time
import random
from typing import List, Tuple, Dict, Set, Optional
from fibonacci_heap import FibonacciHeap, AStarPathfinder, AStarNode, create_sample_grid, visualize_path


class GameMapPathfinder(AStarPathfinder):
    """游戏地图路径规划器"""
    
    def __init__(self, game_map: List[List[int]], terrain_costs: Dict[int, float] = None):
        """
        初始化游戏地图路径规划器
        
        Args:
            game_map: 游戏地图，不同数值代表不同地形
            terrain_costs: 地形代价映射
        """
        super().__init__(game_map, heuristic='diagonal')
        self.terrain_costs = terrain_costs or {
            0: 1.0,    # 平地
            1: float('inf'),  # 障碍物
            2: 2.0,    # 沙地
            3: 1.5,    # 草地
            4: 3.0,    # 沼泽
            5: 0.8     # 道路
        }
    
    def _is_valid_position(self, pos: Tuple[int, int]) -> bool:
        """检查位置是否有效（可通行）"""
        x, y = pos
        return (0 <= x < self.rows and 
                0 <= y < self.cols and 
                self.terrain_costs.get(self.grid[x][y], float('inf')) < float('inf'))
    
    def _get_neighbors(self, node: AStarNode) -> List[Tuple[Tuple[int, int], float]]:
        """获取节点的所有有效邻居，考虑地形代价"""
        neighbors = []
        x, y = node.position
        
        for dx, dy, base_cost in self.directions:
            new_pos = (x + dx, y + dy)
            if self._is_valid_position(new_pos):
                terrain_type = self.grid[new_pos[0]][new_pos[1]]
                terrain_cost = self.terrain_costs.get(terrain_type, 1.0)
                total_cost = base_cost * terrain_cost
                neighbors.append((new_pos, total_cost))
        
        return neighbors


class RobotNavigator:
    """机器人导航系统"""
    
    def __init__(self, environment_map: List[List[int]], robot_size: int = 1):
        """
        初始化机器人导航系统
        
        Args:
            environment_map: 环境地图
            robot_size: 机器人尺寸（半径）
        """
        self.original_map = environment_map
        self.robot_size = robot_size
        self.expanded_map = self._expand_obstacles()
        self.pathfinder = AStarPathfinder(self.expanded_map, heuristic='euclidean')
    
    def _expand_obstacles(self) -> List[List[int]]:
        """扩展障碍物以考虑机器人尺寸"""
        rows, cols = len(self.original_map), len(self.original_map[0])
        expanded = [[0 for _ in range(cols)] for _ in range(rows)]
        
        # 找到所有障碍物位置
        obstacles = []
        for i in range(rows):
            for j in range(cols):
                if self.original_map[i][j] == 1:
                    obstacles.append((i, j))
        
        # 扩展每个障碍物
        for obs_x, obs_y in obstacles:
            for i in range(max(0, obs_x - self.robot_size), 
                          min(rows, obs_x + self.robot_size + 1)):
                for j in range(max(0, obs_y - self.robot_size), 
                              min(cols, obs_y + self.robot_size + 1)):
                    if math.sqrt((i - obs_x)**2 + (j - obs_y)**2) <= self.robot_size:
                        expanded[i][j] = 1
        
        return expanded
    
    def plan_path(self, start: Tuple[int, int], goal: Tuple[int, int]) -> Tuple[List[Tuple[int, int]], Dict]:
        """规划机器人路径"""
        return self.pathfinder.find_path(start, goal)
    
    def plan_patrol_route(self, waypoints: List[Tuple[int, int]]) -> Dict:
        """规划巡逻路线"""
        if len(waypoints) < 2:
            return {"error": "至少需要2个巡逻点"}
        
        total_path = []
        total_cost = 0
        route_stats = []
        
        for i in range(len(waypoints)):
            start = waypoints[i]
            goal = waypoints[(i + 1) % len(waypoints)]  # 循环路线
            
            path, stats = self.plan_path(start, goal)
            if not stats.get('success', False):
                return {"error": f"无法从 {start} 到达 {goal}"}
            
            # 避免重复添加起点
            if i > 0:
                path = path[1:]
            
            total_path.extend(path)
            total_cost += stats['path_cost']
            route_stats.append(stats)
        
        return {
            "patrol_route": total_path,
            "total_cost": total_cost,
            "total_distance": len(total_path),
            "segment_stats": route_stats,
            "success": True
        }


class MultiAgentPathfinder:
    """多智能体路径规划"""
    
    def __init__(self, grid: List[List[int]]):
        self.grid = grid
        self.pathfinder = AStarPathfinder(grid, heuristic='manhattan')
    
    def plan_multiple_agents(self, agents: List[Dict]) -> Dict:
        """
        为多个智能体规划路径
        
        Args:
            agents: 智能体列表，每个包含 {'id': str, 'start': tuple, 'goal': tuple}
        """
        results = {}
        occupied_positions = {}  # 时间 -> 位置集合
        
        # 按优先级排序（可以根据需要调整）
        agents_sorted = sorted(agents, key=lambda x: x.get('priority', 0), reverse=True)
        
        for agent in agents_sorted:
            agent_id = agent['id']
            start = agent['start']
            goal = agent['goal']
            
            # 为当前智能体规划路径
            path, stats = self._plan_with_collision_avoidance(
                start, goal, occupied_positions
            )
            
            if stats.get('success', False):
                # 记录路径占用的时空位置
                for t, pos in enumerate(path):
                    if t not in occupied_positions:
                        occupied_positions[t] = set()
                    occupied_positions[t].add(pos)
                
                results[agent_id] = {
                    "path": path,
                    "stats": stats,
                    "success": True
                }
            else:
                results[agent_id] = {
                    "path": [],
                    "stats": stats,
                    "success": False
                }
        
        return results
    
    def _plan_with_collision_avoidance(self, start: Tuple[int, int], goal: Tuple[int, int], 
                                     occupied: Dict[int, Set[Tuple[int, int]]]) -> Tuple[List[Tuple[int, int]], Dict]:
        """考虑碰撞避免的路径规划"""
        # 简化版本：先规划基本路径，然后检查冲突
        path, stats = self.pathfinder.find_path(start, goal)
        
        if not stats.get('success', False):
            return path, stats
        
        # 检查时空冲突
        conflicts = []
        for t, pos in enumerate(path):
            if t in occupied and pos in occupied[t]:
                conflicts.append((t, pos))
        
        if conflicts:
            # 简单的冲突解决：延迟出发
            delay = len(conflicts)
            delayed_path = [start] * delay + path
            stats['path_cost'] += delay
            stats['path_length'] = len(delayed_path)
            stats['conflicts_resolved'] = len(conflicts)
            return delayed_path, stats
        
        return path, stats


def create_game_map() -> List[List[int]]:
    """创建游戏地图示例"""
    # 0: 平地, 1: 障碍物, 2: 沙地, 3: 草地, 4: 沼泽, 5: 道路
    game_map = [
        [0, 0, 3, 3, 1, 1, 1, 0, 0, 0],
        [0, 5, 5, 5, 5, 5, 1, 0, 2, 2],
        [0, 5, 0, 0, 0, 5, 1, 0, 2, 2],
        [3, 5, 0, 4, 4, 5, 0, 0, 0, 0],
        [3, 5, 0, 4, 4, 5, 0, 1, 1, 0],
        [0, 5, 0, 0, 0, 5, 0, 1, 1, 0],
        [0, 5, 5, 5, 5, 5, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 3, 3, 3],
        [2, 2, 0, 0, 0, 0, 0, 3, 3, 3],
        [2, 2, 0, 0, 0, 0, 0, 0, 0, 0]
    ]
    return game_map


def visualize_game_map(game_map: List[List[int]], path: List[Tuple[int, int]] = None,
                      start: Tuple[int, int] = None, goal: Tuple[int, int] = None):
    """可视化游戏地图"""
    symbols = {
        0: '·',  # 平地
        1: '█',  # 障碍物
        2: '~',  # 沙地
        3: '"',  # 草地
        4: '≈',  # 沼泽
        5: '=',  # 道路
        6: '○',  # 路径
        7: 'S',  # 起点
        8: 'G'   # 终点
    }
    
    # 创建可视化地图
    vis_map = [row[:] for row in game_map]
    
    # 标记路径
    if path:
        for pos in path:
            if pos != start and pos != goal:
                vis_map[pos[0]][pos[1]] = 6
    
    # 标记起点和终点
    if start:
        vis_map[start[0]][start[1]] = 7
    if goal:
        vis_map[goal[0]][goal[1]] = 8
    
    print("\n游戏地图可视化:")
    print("  ", end="")
    for j in range(len(vis_map[0])):
        print(f"{j:2}", end="")
    print()
    
    for i, row in enumerate(vis_map):
        print(f"{i:2}", end="")
        for cell in row:
            print(f" {symbols[cell]}", end="")
        print()
    
    print("\n图例:")
    print("S=起点, G=终点, ○=路径, █=障碍物, ·=平地")
    print("~=沙地, \"=草地, ≈=沼泽, ==道路")


def demo_game_pathfinding():
    """演示游戏路径规划"""
    print("=" * 60)
    print("游戏路径规划演示")
    print("=" * 60)
    
    game_map = create_game_map()
    pathfinder = GameMapPathfinder(game_map)
    
    # 测试不同地形的路径规划
    start = (0, 0)
    goal = (9, 9)
    
    path, stats = pathfinder.find_path(start, goal)
    
    print(f"从 {start} 到 {goal} 的路径规划:")
    print(f"路径长度: {stats['path_length']}")
    print(f"路径代价: {stats['path_cost']:.2f}")
    print(f"探索节点: {stats['nodes_explored']}")
    
    visualize_game_map(game_map, path, start, goal)
    
    # 分析路径经过的地形
    terrain_names = {0: '平地', 1: '障碍物', 2: '沙地', 3: '草地', 4: '沼泽', 5: '道路'}
    terrain_count = {}
    
    for pos in path:
        terrain = game_map[pos[0]][pos[1]]
        terrain_name = terrain_names.get(terrain, '未知')
        terrain_count[terrain_name] = terrain_count.get(terrain_name, 0) + 1
    
    print(f"\n路径地形分析:")
    for terrain, count in terrain_count.items():
        print(f"  {terrain}: {count} 格")


def demo_robot_navigation():
    """演示机器人导航"""
    print("\n" + "=" * 60)
    print("机器人导航演示")
    print("=" * 60)
    
    # 创建环境地图
    env_map = create_sample_grid(15, 15, obstacle_ratio=0.3)
    
    # 创建不同尺寸的机器人导航器
    robot_sizes = [0, 1, 2]
    
    start = (1, 1)
    goal = (13, 13)
    
    for size in robot_sizes:
        print(f"\n机器人尺寸: {size}")
        print("-" * 30)
        
        navigator = RobotNavigator(env_map, robot_size=size)
        path, stats = navigator.plan_path(start, goal)
        
        if stats.get('success', False):
            print(f"路径长度: {stats['path_length']}")
            print(f"路径代价: {stats['path_cost']:.2f}")
            print(f"探索节点: {stats['nodes_explored']}")
        else:
            print("无法找到路径（机器人太大或起终点被阻挡）")
    
    # 演示巡逻路线规划
    print(f"\n巡逻路线规划:")
    print("-" * 30)
    
    navigator = RobotNavigator(env_map, robot_size=1)
    waypoints = [(2, 2), (2, 12), (12, 12), (12, 2)]
    
    patrol_result = navigator.plan_patrol_route(waypoints)
    
    if patrol_result.get('success', False):
        print(f"巡逻路线总长度: {patrol_result['total_distance']}")
        print(f"巡逻路线总代价: {patrol_result['total_cost']:.2f}")
        print(f"巡逻点: {waypoints}")
    else:
        print(f"巡逻路线规划失败: {patrol_result.get('error', '未知错误')}")


def demo_multi_agent_pathfinding():
    """演示多智能体路径规划"""
    print("\n" + "=" * 60)
    print("多智能体路径规划演示")
    print("=" * 60)
    
    # 创建测试环境
    grid = create_sample_grid(12, 12, obstacle_ratio=0.2)
    multi_pathfinder = MultiAgentPathfinder(grid)
    
    # 定义多个智能体
    agents = [
        {'id': 'Agent_A', 'start': (0, 0), 'goal': (11, 11), 'priority': 1},
        {'id': 'Agent_B', 'start': (0, 11), 'goal': (11, 0), 'priority': 2},
        {'id': 'Agent_C', 'start': (5, 0), 'goal': (5, 11), 'priority': 3},
        {'id': 'Agent_D', 'start': (0, 5), 'goal': (11, 5), 'priority': 1}
    ]
    
    # 规划多智能体路径
    results = multi_pathfinder.plan_multiple_agents(agents)
    
    print("多智能体路径规划结果:")
    for agent_id, result in results.items():
        if result['success']:
            stats = result['stats']
            print(f"{agent_id}:")
            print(f"  路径长度: {stats['path_length']}")
            print(f"  路径代价: {stats['path_cost']:.2f}")
            if 'conflicts_resolved' in stats:
                print(f"  解决冲突: {stats['conflicts_resolved']} 个")
        else:
            print(f"{agent_id}: 路径规划失败")


def performance_benchmark():
    """性能基准测试"""
    print("\n" + "=" * 60)
    print("A*算法性能基准测试")
    print("=" * 60)
    
    test_cases = [
        {"size": (20, 20), "obstacles": 0.2, "tests": 10},
        {"size": (50, 50), "obstacles": 0.3, "tests": 5},
        {"size": (100, 100), "obstacles": 0.25, "tests": 3}
    ]
    
    for case in test_cases:
        rows, cols = case["size"]
        obstacle_ratio = case["obstacles"]
        num_tests = case["tests"]
        
        print(f"\n测试规模: {rows}x{cols}, 障碍物比例: {obstacle_ratio:.1%}")
        print("-" * 50)
        
        total_time = 0
        successful_paths = 0
        total_nodes_explored = 0
        
        for i in range(num_tests):
            # 创建随机地图
            grid = create_sample_grid(rows, cols, obstacle_ratio)
            pathfinder = AStarPathfinder(grid, heuristic='diagonal')
            
            # 随机起点和终点
            start = (random.randint(0, rows-1), random.randint(0, cols-1))
            goal = (random.randint(0, rows-1), random.randint(0, cols-1))
            
            # 确保起点和终点可通行
            while grid[start[0]][start[1]] != 0:
                start = (random.randint(0, rows-1), random.randint(0, cols-1))
            while grid[goal[0]][goal[1]] != 0:
                goal = (random.randint(0, rows-1), random.randint(0, cols-1))
            
            # 执行路径规划
            start_time = time.time()
            path, stats = pathfinder.find_path(start, goal)
            end_time = time.time()
            
            total_time += (end_time - start_time)
            if stats.get('success', False):
                successful_paths += 1
                total_nodes_explored += stats['nodes_explored']
        
        # 输出统计结果
        avg_time = total_time / num_tests * 1000  # 转换为毫秒
        success_rate = successful_paths / num_tests * 100
        avg_nodes = total_nodes_explored / max(successful_paths, 1)
        
        print(f"平均执行时间: {avg_time:.2f} ms")
        print(f"成功率: {success_rate:.1f}%")
        print(f"平均探索节点: {avg_nodes:.0f}")
        print(f"吞吐量: {1000/avg_time:.1f} 次/秒")


def main():
    """主演示函数"""
    print("🌟 基于斐波那契堆的A*算法综合演示")
    print("=" * 60)
    
    # 1. 游戏路径规划演示
    demo_game_pathfinding()
    
    # 2. 机器人导航演示
    demo_robot_navigation()
    
    # 3. 多智能体路径规划演示
    demo_multi_agent_pathfinding()
    
    # 4. 性能基准测试
    performance_benchmark()
    
    print("\n" + "=" * 60)
    print("演示完成！")
    print("=" * 60)
    
    print("\nA*算法特点总结:")
    print("✓ 最优性：保证找到最短路径")
    print("✓ 高效性：启发式函数指导搜索")
    print("✓ 灵活性：支持不同地形和代价")
    print("✓ 实用性：适用于游戏、机器人、导航等领域")
    
    print("\n斐波那契堆优势:")
    print("✓ decrease_key: O(1) 摊还时间")
    print("✓ 适合频繁更新优先级的场景")
    print("✓ 在稠密图中性能优异")


if __name__ == "__main__":
    main() 