"""
最短路径算法模块
实现A*算法和TSP（旅行商问题）算法
"""

import heapq
import math
from typing import List, Dict, Tuple, Optional, Set
from itertools import permutations


class ShortestPathAlgorithm:
    """最短路径算法类"""
    
    def __init__(self, roads: List[Dict], places: List[Dict] = None, buildings: List[Dict] = None):
        """
        初始化路径算法
        
        Args:
            roads: 道路数据列表
            places: 场所数据列表（用于坐标信息）
            buildings: 建筑物数据列表（用于坐标信息）
        """
        self.roads = roads
        self.places = places or []
        self.buildings = buildings or []
        self.graph = self._build_graph()
        self.coordinates = self._build_coordinate_map()
    
    def _build_coordinate_map(self) -> Dict[str, Tuple[float, float]]:
        """
        构建节点坐标映射
        
        Returns:
            节点ID到坐标的映射
        """
        coordinates = {}
        
        # 添加场所坐标
        for place in self.places:
            if 'location' in place:
                coordinates[place['id']] = (place['location']['lat'], place['location']['lng'])
        
        # 添加建筑物坐标
        for building in self.buildings:
            if 'location' in building:
                coordinates[building['id']] = (building['location']['lat'], building['location']['lng'])
        
        # 为路口节点估算坐标（基于连接的已知节点）
        self._estimate_intersection_coordinates(coordinates)
        
        return coordinates
    
    def _estimate_intersection_coordinates(self, coordinates: Dict[str, Tuple[float, float]]):
        """
        估算路口节点的坐标
        
        Args:
            coordinates: 已知坐标的映射
        """
        # 收集所有节点
        all_nodes = set()
        for road in self.roads:
            all_nodes.add(road['from'])
            all_nodes.add(road['to'])
        
        # 为没有坐标的节点（通常是路口）估算坐标
        unknown_nodes = all_nodes - set(coordinates.keys())
        
        for node in unknown_nodes:
            # 找到与该节点相连的已知坐标节点
            connected_known_nodes = []
            for road in self.roads:
                if road['from'] == node and road['to'] in coordinates:
                    connected_known_nodes.append(coordinates[road['to']])
                elif road['to'] == node and road['from'] in coordinates:
                    connected_known_nodes.append(coordinates[road['from']])
            
            if connected_known_nodes:
                # 计算平均坐标
                avg_lat = sum(coord[0] for coord in connected_known_nodes) / len(connected_known_nodes)
                avg_lng = sum(coord[1] for coord in connected_known_nodes) / len(connected_known_nodes)
                coordinates[node] = (avg_lat, avg_lng)
            else:
                # 如果没有连接的已知节点，使用默认坐标（北京邮电大学附近）
                coordinates[node] = (39.9577, 116.3577)
    
    def _haversine_distance(self, coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
        """
        计算两个坐标点之间的哈弗辛距离（米）
        
        Args:
            coord1: 坐标1 (lat, lng)
            coord2: 坐标2 (lat, lng)
            
        Returns:
            距离（米）
        """
        lat1, lng1 = coord1
        lat2, lng2 = coord2
        
        # 转换为弧度
        lat1, lng1, lat2, lng2 = map(math.radians, [lat1, lng1, lat2, lng2])
        
        # 哈弗辛公式
        dlat = lat2 - lat1
        dlng = lng2 - lng1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        # 地球半径（米）
        r = 6371000
        
        return c * r
    
    def _heuristic(self, node: str, goal: str, vehicle: str = '步行') -> float:
        """
        A*算法的启发式函数
        
        Args:
            node: 当前节点
            goal: 目标节点
            vehicle: 交通工具
            
        Returns:
            启发式估计值（时间）
        """
        if node not in self.coordinates or goal not in self.coordinates:
            return 0
        
        # 计算直线距离
        distance = self._haversine_distance(self.coordinates[node], self.coordinates[goal])
        
        # 根据交通工具估算最快速度
        max_speed = {
            '步行': 5.0,      # 5 km/h
            '自行车': 15.0,   # 15 km/h
            '电瓶车': 25.0    # 25 km/h
        }.get(vehicle, 5.0)
        
        # 转换为 m/s
        max_speed_ms = max_speed * 1000 / 3600
        
        # 返回最乐观的时间估计
        return distance / max_speed_ms
    
    def _build_graph(self) -> Dict[str, Dict[str, Dict]]:
        """
        构建图结构
        
        Returns:
            图的邻接表表示
        """
        graph = {}
        
        for road in self.roads:
            from_node = road['from']
            to_node = road['to']
            
            # 初始化节点
            if from_node not in graph:
                graph[from_node] = {}
            if to_node not in graph:
                graph[to_node] = {}
            
            # 添加边（双向）
            graph[from_node][to_node] = road
            graph[to_node][from_node] = road
        
        return graph
    
    def calculate_travel_time(self, road: Dict, vehicle: str = '步行') -> float:
        """
        计算通过道路的时间
        
        Args:
            road: 道路信息
            vehicle: 交通工具
            
        Returns:
            通行时间
        """
        distance = road.get('distance', 0)
        ideal_speed = road.get('idealSpeed', 1)
        congestion_rate = road.get('congestionRate', 1.0)
        allowed_vehicles = road.get('allowedVehicles', ['步行'])
        
        # 检查交通工具是否允许
        if vehicle not in allowed_vehicles:
            return float('inf')  # 不允许通行
        
        # 根据交通工具调整速度
        speed_multiplier = {
            '步行': 1.0,
            '自行车': 3.0,
            '电瓶车': 5.0
        }.get(vehicle, 1.0)
        
        # 计算实际速度
        actual_speed = ideal_speed * congestion_rate * speed_multiplier
        
        if actual_speed <= 0:
            return float('inf')
        
        return distance / actual_speed
    
    def astar(self, start: str, end: str, vehicle: str = '步行') -> Tuple[List[str], float]:
        """
        A*最短路径算法
        
        Args:
            start: 起点
            end: 终点
            vehicle: 交通工具
            
        Returns:
            (路径节点列表, 总时间)
        """
        if start not in self.graph or end not in self.graph:
            return [], float('inf')
        
        # 初始化
        g_score = {node: float('inf') for node in self.graph}  # 从起点到节点的实际代价
        f_score = {node: float('inf') for node in self.graph}  # g_score + 启发式估计
        g_score[start] = 0
        f_score[start] = self._heuristic(start, end, vehicle)
        
        previous = {}
        open_set = [(f_score[start], start)]  # 优先队列：(f_score, 节点)
        closed_set = set()
        
        while open_set:
            current_f, current_node = heapq.heappop(open_set)
            
            if current_node in closed_set:
                continue
            
            closed_set.add(current_node)
            
            if current_node == end:
                break
            
            # 检查所有邻居
            for neighbor, road in self.graph[current_node].items():
                if neighbor in closed_set:
                    continue
                
                # 计算通过这条路的时间
                travel_time = self.calculate_travel_time(road, vehicle)
                tentative_g_score = g_score[current_node] + travel_time
                
                if tentative_g_score < g_score[neighbor]:
                    # 找到更好的路径
                    previous[neighbor] = current_node
                    g_score[neighbor] = tentative_g_score
                    f_score[neighbor] = tentative_g_score + self._heuristic(neighbor, end, vehicle)
                    heapq.heappush(open_set, (f_score[neighbor], neighbor))
        
        # 重构路径
        if end not in previous and start != end:
            return [], float('inf')
        
        path = []
        current = end
        while current is not None:
            path.append(current)
            current = previous.get(current)
        
        path.reverse()
        return path, g_score[end]
    
    # 保持向后兼容性，dijkstra方法现在调用A*算法
    def dijkstra(self, start: str, end: str, vehicle: str = '步行') -> Tuple[List[str], float]:
        """
        Dijkstra最短路径算法（现在使用A*实现）
        
        Args:
            start: 起点
            end: 终点
            vehicle: 交通工具
            
        Returns:
            (路径节点列表, 总时间)
        """
        return self.astar(start, end, vehicle)
    
    def get_available_vehicles_for_place(self, place_type: str) -> List[str]:
        """
        根据场所类型获取可用的交通工具
        
        Args:
            place_type: 场所类型 ('校园' 或 '景区')
            
        Returns:
            可用交通工具列表
        """
        if place_type == '校园':
            return ['步行', '自行车']
        elif place_type == '景区':
            return ['步行', '电瓶车']
        else:
            return ['步行']
    
    def dijkstra_with_mixed_vehicles(self, start: str, end: str, place_type: str = '景区') -> Tuple[List[Dict], float]:
        """
        支持混合交通工具的Dijkstra算法（最短时间）
        
        Args:
            start: 起点
            end: 终点
            place_type: 场所类型
            
        Returns:
            (路径段列表[{node, vehicle, time}], 总时间)
        """
        if start not in self.graph or end not in self.graph:
            return [], float('inf')
        
        available_vehicles = self.get_available_vehicles_for_place(place_type)
        
        # 状态：(节点, 当前交通工具)
        # 距离字典：{(节点, 交通工具): 最短时间}
        distances = {}
        previous = {}
        visited = set()
        
        # 初始化起点（可以使用任何交通工具开始）
        for vehicle in available_vehicles:
            distances[(start, vehicle)] = 0
        
        # 优先队列：(时间, 节点, 当前交通工具)
        pq = [(0, start, vehicle) for vehicle in available_vehicles]
        heapq.heapify(pq)
        
        while pq:
            current_time, current_node, current_vehicle = heapq.heappop(pq)
            
            state = (current_node, current_vehicle)
            if state in visited:
                continue
            
            visited.add(state)
            
            # 如果到达终点，重构路径
            if current_node == end:
                path = []
                curr_state = state
                
                while curr_state in previous:
                    prev_state, road_info = previous[curr_state]
                    path.append({
                        'from': prev_state[0],
                        'to': curr_state[0],
                        'vehicle': curr_state[1],
                        'time': road_info['time'],
                        'distance': road_info['distance']
                    })
                    curr_state = prev_state
                
                path.reverse()
                return path, current_time
            
            # 检查所有邻居
            for neighbor, road in self.graph[current_node].items():
                if neighbor == current_node:
                    continue
                
                # 尝试所有可能的交通工具
                for next_vehicle in available_vehicles:
                    next_state = (neighbor, next_vehicle)
                    
                    if next_state in visited:
                        continue
                    
                    # 计算使用next_vehicle通过这条路的时间
                    travel_time = self.calculate_travel_time(road, next_vehicle)
                    
                    if travel_time == float('inf'):
                        continue
                    
                    # 如果换交通工具，可能需要额外时间（这里假设换乘时间为0）
                    switch_time = 0
                    if current_vehicle != next_vehicle:
                        switch_time = 0  # 可以根据需要调整换乘时间
                    
                    new_time = current_time + travel_time + switch_time
                    
                    if next_state not in distances or new_time < distances[next_state]:
                        distances[next_state] = new_time
                        previous[next_state] = (state, {
                            'time': travel_time,
                            'distance': road.get('distance', 0)
                        })
                        heapq.heappush(pq, (new_time, neighbor, next_vehicle))
        
        return [], float('inf')
    
    def find_shortest_path_with_strategy(self, start: str, end: str, 
                                       strategy: str = 'time', vehicle: str = '步行',
                                       place_type: str = '景区') -> Tuple[List[str], float]:
        """
        根据策略寻找最短路径
        
        Args:
            start: 起点
            end: 终点
            strategy: 策略 ('distance', 'time')
            vehicle: 交通工具（仅在strategy='time'且不使用混合模式时使用）
            place_type: 场所类型
            
        Returns:
            (路径节点列表, 总成本)
        """
        if start not in self.graph or end not in self.graph:
            return [], float('inf')
        
        if strategy == 'distance':
            # 最短距离策略：不考虑交通工具，只考虑距离
            return self._dijkstra_distance_only(start, end)
        elif strategy == 'time':
            # 最短时间策略：考虑混合交通工具
            path_segments, total_time = self.dijkstra_with_mixed_vehicles(start, end, place_type)
            
            if not path_segments:
                return [], float('inf')
            
            # 提取节点路径
            path = [start]
            for segment in path_segments:
                path.append(segment['to'])
            
            return path, total_time
        else:
            return [], float('inf')
    
    def _dijkstra_distance_only(self, start: str, end: str) -> Tuple[List[str], float]:
        """
        仅考虑距离的Dijkstra算法
        
        Args:
            start: 起点
            end: 终点
            
        Returns:
            (路径节点列表, 总距离)
        """
        distances = {node: float('inf') for node in self.graph}
        distances[start] = 0
        previous = {}
        visited = set()
        pq = [(0, start)]
        
        while pq:
            current_dist, current_node = heapq.heappop(pq)
            
            if current_node in visited:
                continue
            
            visited.add(current_node)
            
            if current_node == end:
                break
            
            for neighbor, road in self.graph[current_node].items():
                if neighbor in visited:
                    continue
                
                edge_distance = road.get('distance', 0)
                new_dist = current_dist + edge_distance
                
                if new_dist < distances[neighbor]:
                    distances[neighbor] = new_dist
                    previous[neighbor] = current_node
                    heapq.heappush(pq, (new_dist, neighbor))
        
        # 重构路径
        if end not in previous and start != end:
            return [], float('inf')
        
        path = []
        current = end
        while current is not None:
            path.append(current)
            current = previous.get(current)
        
        path.reverse()
        return path, distances[end]
    
    def tsp_nearest_neighbor(self, start: str, destinations: List[str], 
                           vehicle: str = '步行') -> Tuple[List[str], float]:
        """
        TSP问题的最近邻算法（贪心算法）
        
        Args:
            start: 起点
            destinations: 目标点列表
            vehicle: 交通工具
            
        Returns:
            (完整路径, 总时间)
        """
        if not destinations:
            return [start], 0
        
        # 构建距离矩阵
        all_nodes = [start] + destinations
        distance_matrix = {}
        
        for i, node1 in enumerate(all_nodes):
            distance_matrix[node1] = {}
            for j, node2 in enumerate(all_nodes):
                if i == j:
                    distance_matrix[node1][node2] = 0
                else:
                    _, dist = self.dijkstra(node1, node2, vehicle)
                    distance_matrix[node1][node2] = dist
        
        # 最近邻算法
        unvisited = set(destinations)
        current = start
        path = [start]
        total_time = 0
        
        while unvisited:
            nearest = min(unvisited, key=lambda x: distance_matrix[current][x])
            total_time += distance_matrix[current][nearest]
            current = nearest
            path.append(current)
            unvisited.remove(current)
        
        # 返回起点
        total_time += distance_matrix[current][start]
        path.append(start)
        
        return path, total_time
    
    def tsp_dynamic_programming(self, start: str, destinations: List[str], 
                              vehicle: str = '步行') -> Tuple[List[str], float]:
        """
        TSP问题的动态规划算法（适用于小规模问题）
        
        Args:
            start: 起点
            destinations: 目标点列表
            vehicle: 交通工具
            
        Returns:
            (完整路径, 总时间)
        """
        if not destinations:
            return [start], 0
        
        if len(destinations) > 10:  # 对于大规模问题使用近似算法
            return self.tsp_nearest_neighbor(start, destinations, vehicle)
        
        # 构建距离矩阵
        all_nodes = [start] + destinations
        n = len(all_nodes)
        distance_matrix = [[float('inf')] * n for _ in range(n)]
        
        for i in range(n):
            for j in range(n):
                if i == j:
                    distance_matrix[i][j] = 0
                else:
                    _, dist = self.dijkstra(all_nodes[i], all_nodes[j], vehicle)
                    distance_matrix[i][j] = dist
        
        # 动态规划
        # dp[mask][i] = 从起点出发，访问mask中的所有城市，最后到达城市i的最短距离
        dp = {}
        parent = {}
        
        # 初始化
        for i in range(1, n):
            dp[(1 << i, i)] = distance_matrix[0][i]
            parent[(1 << i, i)] = 0
        
        # 填充DP表
        for mask in range(1, 1 << n):
            for u in range(n):
                if not (mask & (1 << u)):
                    continue
                
                for v in range(n):
                    if u == v or not (mask & (1 << v)):
                        continue
                    
                    prev_mask = mask ^ (1 << u)
                    if (prev_mask, v) in dp:
                        new_dist = dp[(prev_mask, v)] + distance_matrix[v][u]
                        if (mask, u) not in dp or new_dist < dp[(mask, u)]:
                            dp[(mask, u)] = new_dist
                            parent[(mask, u)] = v
        
        # 找到最优解
        final_mask = (1 << n) - 1 - 1  # 除了起点的所有点
        min_cost = float('inf')
        last_city = -1
        
        for i in range(1, n):
            if (final_mask, i) in dp:
                cost = dp[(final_mask, i)] + distance_matrix[i][0]
                if cost < min_cost:
                    min_cost = cost
                    last_city = i
        
        if last_city == -1:
            return self.tsp_nearest_neighbor(start, destinations, vehicle)
        
        # 重构路径
        path = []
        mask = final_mask
        current = last_city
        
        while (mask, current) in parent:
            path.append(all_nodes[current])
            next_city = parent[(mask, current)]
            mask ^= (1 << current)
            current = next_city
        
        path.append(start)
        path.reverse()
        path.append(start)  # 回到起点
        
        return path, min_cost
    
    def tsp_nearest_neighbor_distance_only(self, start: str, destinations: List[str]) -> Tuple[List[str], float]:
        """
        多目标路径规划的最近邻算法（只考虑距离，回到起点形成回路）
        
        Args:
            start: 起点
            destinations: 目标点列表
            
        Returns:
            (完整路径, 总距离)
        """
        if not destinations:
            return [start], 0
        
        # 构建距离矩阵
        all_nodes = [start] + destinations
        distance_matrix = {}
        
        for i, node1 in enumerate(all_nodes):
            distance_matrix[node1] = {}
            for j, node2 in enumerate(all_nodes):
                if i == j:
                    distance_matrix[node1][node2] = 0
                else:
                    _, dist = self._dijkstra_distance_only(node1, node2)
                    distance_matrix[node1][node2] = dist
        
        # 最近邻算法
        unvisited = set(destinations)
        current = start
        path = [start]
        total_distance = 0
        
        while unvisited:
            nearest = min(unvisited, key=lambda x: distance_matrix[current][x])
            total_distance += distance_matrix[current][nearest]
            current = nearest
            path.append(current)
            unvisited.remove(current)
        
        # 回到起点，形成完整回路
        total_distance += distance_matrix[current][start]
        path.append(start)
        
        return path, total_distance
    
    def tsp_dynamic_programming_distance_only(self, start: str, destinations: List[str]) -> Tuple[List[str], float]:
        """
        多目标路径规划的动态规划算法（只考虑距离，回到起点形成回路，适用于小规模问题）
        
        Args:
            start: 起点
            destinations: 目标点列表
            
        Returns:
            (完整路径, 总距离)
        """
        if not destinations:
            return [start], 0
        
        if len(destinations) > 10:  # 对于大规模问题使用近似算法
            return self.tsp_nearest_neighbor_distance_only(start, destinations)
        
        # 构建距离矩阵
        all_nodes = [start] + destinations
        n = len(all_nodes)
        distance_matrix = [[float('inf')] * n for _ in range(n)]
        
        for i in range(n):
            for j in range(n):
                if i == j:
                    distance_matrix[i][j] = 0
                else:
                    _, dist = self._dijkstra_distance_only(all_nodes[i], all_nodes[j])
                    distance_matrix[i][j] = dist
        
        # 动态规划
        # dp[mask][i] = 从起点出发，访问mask中的所有城市，最后到达城市i的最短距离
        dp = {}
        parent = {}
        
        # 初始化
        for i in range(1, n):
            dp[(1 << i, i)] = distance_matrix[0][i]
            parent[(1 << i, i)] = 0
        
        # 填充DP表
        for mask in range(1, 1 << n):
            for u in range(n):
                if not (mask & (1 << u)):
                    continue
                
                for v in range(n):
                    if u == v or not (mask & (1 << v)):
                        continue
                    
                    prev_mask = mask ^ (1 << u)
                    if (prev_mask, v) in dp:
                        new_dist = dp[(prev_mask, v)] + distance_matrix[v][u]
                        if (mask, u) not in dp or new_dist < dp[(mask, u)]:
                            dp[(mask, u)] = new_dist
                            parent[(mask, u)] = v
        
        # 找到最优解（回到起点）
        final_mask = (1 << n) - 1 - 1  # 除了起点的所有点
        min_cost = float('inf')
        last_city = -1
        
        for i in range(1, n):
            if (final_mask, i) in dp:
                cost = dp[(final_mask, i)] + distance_matrix[i][0]  # 加上回到起点的距离
                if cost < min_cost:
                    min_cost = cost
                    last_city = i
        
        if last_city == -1:
            return self.tsp_nearest_neighbor_distance_only(start, destinations)
        
        # 重构路径
        path = []
        mask = final_mask
        current = last_city
        
        while (mask, current) in parent:
            path.append(all_nodes[current])
            next_city = parent[(mask, current)]
            mask ^= (1 << current)
            current = next_city
        
        path.append(start)
        path.reverse()
        path.append(start)  # 回到起点
        
        return path, min_cost
    
    def tsp_simulated_annealing_distance_only(self, start: str, destinations: List[str], 
                                            max_iterations: int = 10000, 
                                            initial_temp: float = 1000.0,
                                            cooling_rate: float = 0.995,
                                            min_temp: float = 1.0) -> Tuple[List[str], float]:
        """
        多目标路径规划的模拟退火算法（只考虑距离，回到起点形成回路）
        
        Args:
            start: 起点
            destinations: 目标点列表
            max_iterations: 最大迭代次数
            initial_temp: 初始温度
            cooling_rate: 冷却率
            min_temp: 最低温度
            
        Returns:
            (完整路径, 总距离)
        """
        import random
        import math
        
        if not destinations:
            return [start], 0
        
        # 构建距离矩阵
        all_nodes = [start] + destinations
        n = len(all_nodes)
        distance_matrix = {}
        
        for i, node1 in enumerate(all_nodes):
            distance_matrix[node1] = {}
            for j, node2 in enumerate(all_nodes):
                if i == j:
                    distance_matrix[node1][node2] = 0
                else:
                    _, dist = self._dijkstra_distance_only(node1, node2)
                    distance_matrix[node1][node2] = dist
        
        def calculate_path_distance(path):
            """计算路径总距离（包括回到起点）"""
            total_dist = 0
            for i in range(len(path) - 1):
                total_dist += distance_matrix[path[i]][path[i + 1]]
            # 如果路径不是以起点结尾，添加回到起点的距离
            if len(path) > 1 and path[-1] != path[0]:
                total_dist += distance_matrix[path[-1]][path[0]]
            return total_dist
        
        def generate_neighbor(current_path):
            """生成邻居解（使用2-opt操作）"""
            # 注意：current_path应该是不包含最后回到起点的路径
            if len(current_path) <= 3:
                # 对于短路径，使用简单的交换操作
                new_path = current_path.copy()
                if len(new_path) > 2:
                    i, j = random.sample(range(1, len(new_path)), 2)  # 不交换起点
                    new_path[i], new_path[j] = new_path[j], new_path[i]
                return new_path
            
            # 2-opt操作：选择两个边，重新连接
            new_path = current_path.copy()
            i = random.randint(1, len(new_path) - 3)  # 不包括起点
            j = random.randint(i + 1, len(new_path) - 1)
            
            # 反转i到j之间的路径段
            new_path[i:j+1] = reversed(new_path[i:j+1])
            return new_path
        
        def acceptance_probability(current_cost, new_cost, temperature):
            """计算接受概率"""
            if new_cost < current_cost:
                return 1.0
            return math.exp((current_cost - new_cost) / temperature)
        
        # 初始解：使用最近邻算法
        initial_path, _ = self.tsp_nearest_neighbor_distance_only(start, destinations)
        # 移除最后的起点，因为calculate_path_distance会自动添加
        if len(initial_path) > 1 and initial_path[-1] == start:
            current_path = initial_path[:-1]
        else:
            current_path = initial_path
        
        current_cost = calculate_path_distance(current_path)
        best_path = current_path.copy()
        best_cost = current_cost
        
        temperature = initial_temp
        
        for iteration in range(max_iterations):
            if temperature < min_temp:
                break
            
            # 生成邻居解
            new_path = generate_neighbor(current_path)
            new_cost = calculate_path_distance(new_path)
            
            # 决定是否接受新解
            if random.random() < acceptance_probability(current_cost, new_cost, temperature):
                current_path = new_path
                current_cost = new_cost
                
                # 更新最优解
                if new_cost < best_cost:
                    best_path = new_path.copy()
                    best_cost = new_cost
            
            # 降温
            temperature *= cooling_rate
        
        # 返回完整路径（包括回到起点）
        final_path = best_path + [start]
        return final_path, best_cost
    
    def tsp_genetic_algorithm_distance_only(self, start: str, destinations: List[str],
                                          population_size: int = 100,
                                          generations: int = 500,
                                          mutation_rate: float = 0.1,
                                          elite_size: int = 20) -> Tuple[List[str], float]:
        """
        多目标路径规划的遗传算法（只考虑距离，回到起点形成回路）
        
        Args:
            start: 起点
            destinations: 目标点列表
            population_size: 种群大小
            generations: 进化代数
            mutation_rate: 变异率
            elite_size: 精英个体数量
            
        Returns:
            (完整路径, 总距离)
        """
        import random
        
        if not destinations:
            return [start], 0
        
        # 构建距离矩阵
        all_nodes = [start] + destinations
        n = len(all_nodes)
        distance_matrix = {}
        
        for i, node1 in enumerate(all_nodes):
            distance_matrix[node1] = {}
            for j, node2 in enumerate(all_nodes):
                if i == j:
                    distance_matrix[node1][node2] = 0
                else:
                    _, dist = self._dijkstra_distance_only(node1, node2)
                    distance_matrix[node1][node2] = dist
        
        def calculate_fitness(path):
            """计算个体适应度（距离越短适应度越高，包括回到起点的距离）"""
            total_dist = 0
            for i in range(len(path) - 1):
                total_dist += distance_matrix[path[i]][path[i + 1]]
            # 添加回到起点的距离
            if len(path) > 1:
                total_dist += distance_matrix[path[-1]][path[0]]
            return 1 / (total_dist + 1)  # 避免除零
        
        def create_individual():
            """创建一个个体（随机排列目标点）"""
            individual = [start] + random.sample(destinations, len(destinations))
            return individual
        
        def crossover(parent1, parent2):
            """交叉操作（部分映射交叉PMX）"""
            if len(parent1) <= 2:
                return parent1.copy()
            
            # 选择交叉点（不包括起点）
            start_idx = random.randint(1, len(parent1) - 2)
            end_idx = random.randint(start_idx + 1, len(parent1) - 1)
            
            # 创建子代
            child = [None] * len(parent1)
            child[0] = start  # 起点固定
            
            # 复制父代1的中间段
            child[start_idx:end_idx+1] = parent1[start_idx:end_idx+1]
            
            # 从父代2填充剩余位置
            remaining = [node for node in parent2[1:] if node not in child]
            j = 0
            for i in range(1, len(child)):
                if child[i] is None:
                    child[i] = remaining[j]
                    j += 1
            
            return child
        
        def mutate(individual):
            """变异操作（交换两个目标点）"""
            if len(individual) <= 2 or random.random() > mutation_rate:
                return individual
            
            mutated = individual.copy()
            # 随机选择两个位置进行交换（不包括起点）
            i, j = random.sample(range(1, len(mutated)), 2)
            mutated[i], mutated[j] = mutated[j], mutated[i]
            return mutated
        
        def selection(population, fitnesses):
            """选择操作（轮盘赌选择）"""
            total_fitness = sum(fitnesses)
            if total_fitness == 0:
                return random.choice(population)
            
            pick = random.uniform(0, total_fitness)
            current = 0
            for i, fitness in enumerate(fitnesses):
                current += fitness
                if current > pick:
                    return population[i]
            return population[-1]
        
        # 初始化种群
        population = [create_individual() for _ in range(population_size)]
        
        best_individual = None
        best_fitness = 0
        
        # 进化循环
        for generation in range(generations):
            # 计算适应度
            fitnesses = [calculate_fitness(individual) for individual in population]
            
            # 更新最优个体
            max_fitness_idx = fitnesses.index(max(fitnesses))
            if fitnesses[max_fitness_idx] > best_fitness:
                best_individual = population[max_fitness_idx].copy()
                best_fitness = fitnesses[max_fitness_idx]
            
            # 精英选择
            elite_indices = sorted(range(len(fitnesses)), key=lambda i: fitnesses[i], reverse=True)[:elite_size]
            new_population = [population[i] for i in elite_indices]
            
            # 生成新个体
            while len(new_population) < population_size:
                parent1 = selection(population, fitnesses)
                parent2 = selection(population, fitnesses)
                child = crossover(parent1, parent2)
                child = mutate(child)
                new_population.append(child)
            
            population = new_population
        
        # 计算最优路径的距离（包括回到起点）
        best_distance = 1 / best_fitness - 1
        # 返回完整路径（包括回到起点）
        final_path = best_individual + [start]
        return final_path, best_distance
    
    def multi_destination_route(self, start: str, destinations: List[str], 
                              algorithm: str = 'nearest_neighbor') -> Dict:
        """
        多目标路径规划（只考虑最短距离）
        
        Args:
            start: 起点
            destinations: 目标点列表
            algorithm: 算法 ('nearest_neighbor', 'dynamic_programming', 'simulated_annealing', 'genetic_algorithm')
            
        Returns:
            路径规划结果
        """
        # 首先过滤掉不可达的目标点
        reachable_destinations = []
        unreachable_destinations = []
        
        for dest in destinations:
            # 使用A*算法检查连通性
            path, distance = self.astar(start, dest, '步行')
            if path and distance != float('inf'):
                reachable_destinations.append(dest)
            else:
                unreachable_destinations.append(dest)
        
        # 如果没有可达的目标点，返回空路径
        if not reachable_destinations:
            return {
                'path': [],
                'detailed_path': [],
                'total_distance': float('inf'),
                'total_time': None,
                'vehicle': '不限',
                'strategy': 'distance',
                'destinations_order': [],
                'target_path': [start],
                'unreachable_destinations': unreachable_destinations,
                'detailed_info': {
                    'path': [],
                    'total_distance': float('inf'),
                    'total_time': None,
                    'strategy': 'distance',
                    'vehicle': '不限',
                    'detailed_path': [],
                    'segments': [],
                    'error': f"所有目标点都不可达: {unreachable_destinations}"
                }
            }
        
        # 根据算法类型选择相应的TSP求解方法
        if algorithm == 'dynamic_programming':
            target_path, total_distance = self.tsp_dynamic_programming_distance_only(start, reachable_destinations)
        elif algorithm == 'simulated_annealing':
            target_path, total_distance = self.tsp_simulated_annealing_distance_only(start, reachable_destinations)
        elif algorithm == 'genetic_algorithm':
            target_path, total_distance = self.tsp_genetic_algorithm_distance_only(start, reachable_destinations)
        else:  # 默认使用最近邻算法
            target_path, total_distance = self.tsp_nearest_neighbor_distance_only(start, reachable_destinations)
        
        # 构建完整的详细路径（包含所有经过的节点）
        complete_path = []
        total_actual_distance = 0
        
        for i in range(len(target_path) - 1):
            segment_path, segment_distance = self._dijkstra_distance_only(target_path[i], target_path[i + 1])
            
            # 检查路径段是否有效
            if not segment_path or segment_distance == float('inf'):
                # 如果某个路径段不可达，返回错误信息
                return {
                    'path': [],
                    'detailed_path': [],
                    'total_distance': float('inf'),
                    'total_time': None,
                    'vehicle': '不限',
                    'strategy': 'distance',
                    'destinations_order': [],
                    'target_path': [start],
                    'unreachable_destinations': unreachable_destinations,
                    'detailed_info': {
                        'path': [],
                        'total_distance': float('inf'),
                        'total_time': None,
                        'strategy': 'distance',
                        'vehicle': '不限',
                        'detailed_path': [],
                        'segments': [],
                        'error': f"路径段 {target_path[i]} -> {target_path[i + 1]} 不可达"
                    }
                }
            
            if i == 0:
                # 第一段：包含所有节点
                complete_path.extend(segment_path)
            else:
                # 后续段：跳过起点（避免重复）
                complete_path.extend(segment_path[1:])
            
            total_actual_distance += segment_distance
        
        # 构建详细的段信息（用于地图显示）
        segments = []
        if len(complete_path) > 1:
            for i in range(len(complete_path) - 1):
                from_node = complete_path[i]
                to_node = complete_path[i + 1]
                
                # 获取道路信息
                if from_node in self.graph and to_node in self.graph[from_node]:
                    road = self.graph[from_node][to_node]
                    distance = road.get('distance', 0)
                    
                    segments.append({
                        'from': from_node,
                        'to': to_node,
                        'distance': distance,
                        'time': 0,  # 距离策略下不计算时间
                        'vehicle': '不限'  # 距离策略下不限制交通工具
                    })
        
        # 算法名称映射
        algorithm_names = {
            'nearest_neighbor': '最近邻算法',
            'dynamic_programming': '动态规划算法',
            'simulated_annealing': '模拟退火算法',
            'genetic_algorithm': '遗传算法'
        }
        
        result = {
            'path': complete_path,  # 包含所有经过的节点（包括路口）
            'detailed_path': complete_path,  # 保持一致
            'total_distance': total_actual_distance,
            'total_time': None,  # 多目标路径不考虑时间
            'vehicle': '不限',  # 多目标路径不限制交通工具
            'strategy': 'distance',  # 多目标路径只考虑距离
            'algorithm': algorithm,  # 使用的算法
            'algorithm_name': algorithm_names.get(algorithm, algorithm),  # 算法中文名称
            'destinations_order': target_path[1:],  # 目标点的访问顺序
            'target_path': target_path,  # 仅包含目标点的路径
            'detailed_info': {
                'path': complete_path,
                'total_distance': total_actual_distance,
                'total_time': None,
                'strategy': 'distance',
                'vehicle': '不限',
                'algorithm': algorithm_names.get(algorithm, algorithm),
                'detailed_path': [f"从 {complete_path[i]} 到 {complete_path[i+1]}" for i in range(len(complete_path)-1)] if len(complete_path) > 1 else [],
                'segments': segments
            }
        }
        
        # 如果有不可达的目标点，添加警告信息
        if unreachable_destinations:
            result['unreachable_destinations'] = unreachable_destinations
            result['detailed_info']['warning'] = f"以下目标点不可达，已从路径规划中排除: {unreachable_destinations}"
        
        return result
    
    def find_nearby_facilities(self, location: str, facility_type: str = None, 
                             max_distance: float = 1000, vehicle: str = '步行') -> List[Dict]:
        """
        查找附近设施
        
        Args:
            location: 当前位置
            facility_type: 设施类型
            max_distance: 最大距离
            vehicle: 交通工具
            
        Returns:
            附近设施列表，按距离排序
        """
        # 这里需要设施数据，暂时返回示例
        # 在实际应用中，需要传入设施数据
        nearby_facilities = []
        
        # 使用Dijkstra算法计算到各个设施的距离
        for node in self.graph:
            if node.startswith('facility_'):  # 假设设施节点以facility_开头
                path, distance = self.dijkstra(location, node, vehicle)
                if distance <= max_distance:
                    nearby_facilities.append({
                        'id': node,
                        'distance': distance,
                        'path': path
                    })
        
        # 按距离排序
        nearby_facilities.sort(key=lambda x: x['distance'])
        return nearby_facilities

    def get_detailed_route_info(self, start: str, end: str, strategy: str = 'time', 
                               place_type: str = '景区') -> Dict:
        """
        获取详细的路径信息
        
        Args:
            start: 起点
            end: 终点
            strategy: 策略
            place_type: 场所类型
            
        Returns:
            详细路径信息
        """
        if strategy == 'distance':
            path, total_cost = self._dijkstra_distance_only(start, end)
            
            # 计算每个路径段的详细信息
            segments = []
            if len(path) > 1:
                for i in range(len(path) - 1):
                    from_node = path[i]
                    to_node = path[i + 1]
                    
                    # 获取道路信息
                    if from_node in self.graph and to_node in self.graph[from_node]:
                        road = self.graph[from_node][to_node]
                        distance = road.get('distance', 0)
                        
                        # 在距离策略下，不计算时间，设为0
                        segments.append({
                            'from': from_node,
                            'to': to_node,
                            'distance': distance,
                            'time': 0,  # 距离策略下不计算时间
                            'vehicle': '不限'  # 距离策略下不限制交通工具
                        })
            
            return {
                'path': path,
                'total_distance': total_cost,
                'total_time': None,
                'strategy': 'distance',
                'vehicle': '不限',
                'detailed_path': [f"从 {path[i]} 到 {path[i+1]}" for i in range(len(path)-1)] if len(path) > 1 else [],
                'segments': segments
            }
        
        elif strategy == 'time':
            path_segments, total_time = self.dijkstra_with_mixed_vehicles(start, end, place_type)
            
            if not path_segments:
                return {
                    'path': [],
                    'total_distance': float('inf'),
                    'total_time': float('inf'),
                    'strategy': 'time',
                    'vehicle': '混合',
                    'detailed_path': [],
                    'segments': []
                }
            
            # 计算总距离
            total_distance = sum(segment['distance'] for segment in path_segments)
            
            # 构建路径
            path = [start]
            for segment in path_segments:
                path.append(segment['to'])
            
            # 构建详细路径描述
            detailed_path = []
            for segment in path_segments:
                detailed_path.append(
                    f"从 {segment['from']} 到 {segment['to']} "
                    f"(使用{segment['vehicle']}, "
                    f"距离{segment['distance']}米, "
                    f"时间{segment['time']:.1f}分钟)"
                )
            
            return {
                'path': path,
                'total_distance': total_distance,
                'total_time': total_time,
                'strategy': 'time',
                'vehicle': '混合',
                'detailed_path': detailed_path,
                'segments': path_segments
            }


def test_shortest_path_algorithms():
    """测试最短路径算法"""
    # 测试道路数据
    test_roads = [
        {
            "id": "road_001",
            "from": "A",
            "to": "B",
            "distance": 100,
            "idealSpeed": 5,
            "congestionRate": 0.8,
            "allowedVehicles": ["步行", "自行车"],
            "roadType": "主路"
        },
        {
            "id": "road_002",
            "from": "B",
            "to": "C",
            "distance": 150,
            "idealSpeed": 4,
            "congestionRate": 0.9,
            "allowedVehicles": ["步行", "自行车"],
            "roadType": "主路"
        },
        {
            "id": "road_003",
            "from": "A",
            "to": "C",
            "distance": 200,
            "idealSpeed": 6,
            "congestionRate": 0.7,
            "allowedVehicles": ["步行", "自行车"],
            "roadType": "主路"
        },
        {
            "id": "road_004",
            "from": "C",
            "to": "D",
            "distance": 120,
            "idealSpeed": 5,
            "congestionRate": 0.8,
            "allowedVehicles": ["步行", "自行车"],
            "roadType": "主路"
        }
    ]
    
    # 创建算法实例
    path_algo = ShortestPathAlgorithm(test_roads)
    
    # 测试单点到单点最短路径
    path, time = path_algo.dijkstra("A", "D", "步行")
    print(f"从A到D的最短路径: {' -> '.join(path)}")
    print(f"总时间: {time:.2f}")
    
    # 测试TSP
    tsp_path, tsp_time = path_algo.tsp_nearest_neighbor("A", ["B", "C", "D"], "步行")
    print(f"\nTSP路径: {' -> '.join(tsp_path)}")
    print(f"总时间: {tsp_time:.2f}")


if __name__ == "__main__":
    test_shortest_path_algorithms() 