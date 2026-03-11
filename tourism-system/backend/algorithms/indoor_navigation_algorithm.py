"""
室内导航算法
实现教学楼内部的路径规划，支持避开拥挤区域的最短路径计算
"""

import heapq
import json
import os
from typing import List, Tuple, Dict, Optional


class IndoorNavigationAlgorithm:
    """室内导航算法类"""
    
    def __init__(self, data_file: str = None):
        """
        初始化室内导航算法
        
        Args:
            data_file: 室内导航数据文件路径
        """
        self.nodes = {}  # 节点信息
        self.graph = {}  # 邻接表
        self.building_info = {}
        
        if data_file:
            self.load_data(data_file)
    
    def load_data(self, data_file: str):
        """加载室内导航数据"""
        try:
            with open(data_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            self.building_info = data.get('building', {})
            
            # 加载节点信息
            for node in data.get('nodes', []):
                self.nodes[node['id']] = node
            
            # 构建邻接表
            self.graph = {node_id: {} for node_id in self.nodes.keys()}
            
            for connection in data.get('connections', []):
                from_node = connection['from']
                to_node = connection['to']
                distance = connection['distance']
                congestion_factor = connection.get('congestion_factor', 1.0)
                
                # 计算基础步行时间（秒）
                walking_time = distance / 60.0 * 60  # 60米/分钟 = 1米/秒
                
                # 计算时间权重（考虑楼层切换）
                from_node_info = None
                to_node_info = None
                for node in data.get('nodes', []):
                    if node['id'] == from_node:
                        from_node_info = node
                    elif node['id'] == to_node:
                        to_node_info = node
                
                time_weight = walking_time
                
                # 如果涉及楼层切换，添加额外时间成本
                if from_node_info and to_node_info and from_node_info['floor'] != to_node_info['floor']:
                    floor_diff = abs(to_node_info['floor'] - from_node_info['floor'])
                    
                    # 判断交通方式并计算时间成本
                    if (from_node_info['type'] == 'elevator' and to_node_info['type'] == 'elevator'):
                        # 电梯：等候时间 + 运行时间
                        floor_change_time = 60 + 15 * floor_diff
                    elif (from_node_info['type'] == 'stair' and to_node_info['type'] == 'stair'):
                        # 楼梯：爬楼时间
                        if floor_diff == 1:
                            floor_change_time = 30
                        else:
                            floor_change_time = 45 + 15 * floor_diff
                    else:
                        # 混合情况，使用楼梯时间
                        if floor_diff == 1:
                            floor_change_time = 30
                        else:
                            floor_change_time = 45 + 15 * floor_diff
                    
                    time_weight += floor_change_time
                    # 楼层切换时，对整个时间权重应用拥挤度因子
                    time_weight *= congestion_factor
                else:
                    # 同楼层移动，应用拥挤度因子
                    time_weight *= congestion_factor
                
                # 计算传统的距离权重（保持兼容性）
                distance_weight = distance * congestion_factor
                
                # 双向连接
                self.graph[from_node][to_node] = {
                    'distance': distance,
                    'weight': distance_weight,  # 传统距离权重
                    'time_weight': time_weight,  # 新的时间权重
                    'congestion_factor': congestion_factor,
                    'description': connection.get('description', '')
                }
                self.graph[to_node][from_node] = {
                    'distance': distance,
                    'weight': distance_weight,
                    'time_weight': time_weight,
                    'congestion_factor': congestion_factor,
                    'description': connection.get('description', '')
                }
                
            print(f"成功加载室内导航数据: {len(self.nodes)} 个节点, {len(data.get('connections', []))} 个连接")
            
        except Exception as e:
            print(f"加载室内导航数据失败: {e}")
    
    def dijkstra(self, start: str, end: str, avoid_congestion: bool = True, use_time_weight: bool = True) -> Tuple[List[str], float]:
        """
        使用Dijkstra算法计算最短路径
        
        Args:
            start: 起始节点ID
            end: 目标节点ID
            avoid_congestion: 是否避开拥挤区域
            use_time_weight: 是否使用时间权重（True=时间优化，False=距离优化）
            
        Returns:
            (路径节点列表, 总权重)
        """
        if start not in self.nodes or end not in self.nodes:
            return [], float('inf')
        
        # 初始化距离和前驱节点
        distances = {node: float('inf') for node in self.nodes}
        previous = {node: None for node in self.nodes}
        distances[start] = 0
        
        # 优先队列：(距离, 节点ID)
        pq = [(0, start)]
        visited = set()
        
        while pq:
            current_dist, current = heapq.heappop(pq)
            
            if current in visited:
                continue
                
            visited.add(current)
            
            if current == end:
                break
            
            # 检查所有邻居
            for neighbor, edge_info in self.graph[current].items():
                if neighbor in visited:
                    continue
                
                # 选择权重类型
                if use_time_weight:
                    # 使用时间权重系统
                    if avoid_congestion:
                        weight = edge_info['time_weight']  # 时间权重已包含拥挤度
                    else:
                        # 不避开拥挤时，使用基础时间权重（去除拥挤度影响）
                        base_time = edge_info['time_weight'] / edge_info['congestion_factor']
                        weight = base_time
                else:
                    # 使用传统距离权重系统
                    if avoid_congestion:
                        weight = edge_info['weight']  # 考虑拥挤度
                    else:
                        weight = edge_info['distance']  # 仅考虑距离
                
                new_dist = current_dist + weight
                
                if new_dist < distances[neighbor]:
                    distances[neighbor] = new_dist
                    previous[neighbor] = current
                    heapq.heappush(pq, (new_dist, neighbor))
        
        # 重构路径
        path = []
        current = end
        while current is not None:
            path.append(current)
            current = previous[current]
        
        if path[-1] != start:
            return [], float('inf')  # 无法到达
        
        path.reverse()
        return path, distances[end]
    
    def navigate_to_room(self, room_id: str, avoid_congestion: bool = True, use_time_weight: bool = True) -> Dict:
        """
        从大门导航到指定房间
        
        Args:
            room_id: 目标房间ID
            avoid_congestion: 是否避开拥挤区域
            use_time_weight: 是否使用时间权重优化
            
        Returns:
            导航结果字典
        """
        if room_id not in self.nodes:
            return {
                'success': False,
                'message': f'房间 {room_id} 不存在'
            }
        
        room_info = self.nodes[room_id]
        if room_info['type'] != 'room':
            return {
                'success': False,
                'message': f'{room_id} 不是一个房间'
            }
        
        # 计算路径
        path, total_weight = self.dijkstra('entrance', room_id, avoid_congestion, use_time_weight)
        
        if not path:
            return {
                'success': False,
                'message': f'无法找到到达 {room_info["name"]} 的路径'
            }
        
        # 生成详细导航指令
        navigation_steps = self._generate_navigation_steps(path)
        
        # 计算实际距离（不考虑拥挤度）
        actual_distance = self._calculate_actual_distance(path)
        
        # 使用新的楼层切换时间计算
        accurate_time = self._estimate_time_with_floor_changes(path)
        
        # 分析楼层变化情况
        floor_analysis = self._analyze_floor_changes(path)
        
        # 计算不同权重系统的结果对比
        comparison_data = self._calculate_weight_comparison(path, avoid_congestion)
        
        return {
            'success': True,
            'data': {
                'destination': room_info,
                'path': path,
                'navigation_steps': navigation_steps,
                'total_distance': actual_distance,
                'estimated_time': accurate_time,
                'total_weight': total_weight,  # 使用的权重总和
                'weight_system': 'time_based' if use_time_weight else 'distance_based',
                'weight_comparison': comparison_data,  # 不同权重系统的对比
                'floor_analysis': floor_analysis,
                'avoid_congestion': avoid_congestion,
                'use_time_weight': use_time_weight,
                'path_description': self._generate_path_description(path),
                'optimization_target': '时间最优' if use_time_weight else '距离最优'
            }
        }
    
    def _generate_navigation_steps(self, path: List[str]) -> List[Dict]:
        """生成详细的导航步骤"""
        steps = []
        
        for i in range(len(path) - 1):
            current_node = self.nodes[path[i]]
            next_node = self.nodes[path[i + 1]]
            
            # 获取连接信息
            edge_info = self.graph[path[i]][path[i + 1]]
            
            step = {
                'step': i + 1,
                'from': current_node['name'],
                'to': next_node['name'],
                'distance': edge_info['distance'],
                'description': edge_info['description'],
                'floor_change': current_node['floor'] != next_node['floor']
            }
            
            # 特殊处理电梯
            if current_node['type'] == 'elevator' and next_node['type'] == 'elevator':
                step['action'] = f"乘坐电梯从{current_node['floor']}楼到{next_node['floor']}楼"
            elif next_node['type'] == 'elevator':
                step['action'] = f"前往{next_node['name']}"
            elif current_node['type'] == 'elevator':
                step['action'] = f"从电梯出来，前往{next_node['name']}"
            else:
                step['action'] = f"从{current_node['name']}前往{next_node['name']}"
            
            steps.append(step)
        
        return steps
    
    def _calculate_actual_distance(self, path: List[str]) -> float:
        """计算实际距离（不考虑拥挤度）"""
        total_distance = 0
        for i in range(len(path) - 1):
            edge_info = self.graph[path[i]][path[i + 1]]
            total_distance += edge_info['distance']
        return total_distance
    
    def _estimate_time(self, distance: float) -> float:
        """估算行走时间（分钟）"""
        # 假设平均步行速度为 60米/分钟
        walking_speed = 60  # 米/分钟
        return round(distance / walking_speed, 1)
    
    def _estimate_time_with_floor_changes(self, path: List[str]) -> float:
        """
        估算包含楼层切换的总时间（分钟）
        
        实现楼层切换策略：
        - 相邻楼层楼梯: 30s
        - 多层楼梯: 45s + 15s × |floors|  
        - 电梯（含等待）: 60s + 15s × |floors|
        
        Args:
            path: 导航路径节点列表
            
        Returns:
            总估算时间（分钟）
        """
        if len(path) < 2:
            return 0.0
        
        total_time = 0.0  # 总时间（秒）
        
        for i in range(len(path) - 1):
            current_node = self.nodes[path[i]]
            next_node = self.nodes[path[i + 1]]
            edge_info = self.graph[path[i]][path[i + 1]]
            
            # 基础移动时间（按距离计算）
            walking_time = edge_info['distance'] / 60.0 * 60  # 转换为秒
            
            # 检查是否有楼层变化
            if current_node['floor'] != next_node['floor']:
                floor_diff = abs(next_node['floor'] - current_node['floor'])
                
                # 判断使用的交通方式
                if (current_node['type'] == 'elevator' and next_node['type'] == 'elevator'):
                    # 电梯（含等待时间）
                    floor_change_time = 60 + 15 * floor_diff
                elif (current_node['type'] == 'stair' and next_node['type'] == 'stair'):
                    # 楼梯
                    if floor_diff == 1:
                        # 相邻楼层楼梯
                        floor_change_time = 30
                    else:
                        # 多层楼梯
                        floor_change_time = 45 + 15 * floor_diff
                else:
                    # 其他情况（混合或未知），使用楼梯时间
                    if floor_diff == 1:
                        floor_change_time = 30
                    else:
                        floor_change_time = 45 + 15 * floor_diff
                
                total_time += floor_change_time
                print(f"[时间计算] 楼层切换 {current_node['floor']}→{next_node['floor']}: +{floor_change_time}s")
            else:
                # 同楼层移动，只计算步行时间
                total_time += walking_time
                print(f"[时间计算] 同楼层移动 {edge_info['distance']}m: +{walking_time:.1f}s")
        
        # 转换为分钟并四舍五入
        total_minutes = round(total_time / 60.0, 1)
        print(f"[时间计算] 总时间: {total_time:.1f}s = {total_minutes}分钟")
        
        return total_minutes
    
    def _analyze_floor_changes(self, path: List[str]) -> Dict:
        """
        分析路径中的楼层变化情况
        
        Returns:
            楼层变化分析结果
        """
        if len(path) < 2:
            return {
                'total_floor_changes': 0,
                'elevator_changes': 0,
                'stair_changes': 0,
                'floors_visited': [],
                'change_details': []
            }
        
        floor_changes = 0
        elevator_changes = 0
        stair_changes = 0
        floors_visited = set()
        change_details = []
        
        for i in range(len(path)):
            floors_visited.add(self.nodes[path[i]]['floor'])
            
            if i < len(path) - 1:
                current_node = self.nodes[path[i]]
                next_node = self.nodes[path[i + 1]]
                
                if current_node['floor'] != next_node['floor']:
                    floor_changes += 1
                    floor_diff = abs(next_node['floor'] - current_node['floor'])
                    
                    if (current_node['type'] == 'elevator' and next_node['type'] == 'elevator'):
                        elevator_changes += 1
                        method = '电梯'
                    else:
                        stair_changes += 1
                        method = '楼梯'
                    
                    change_details.append({
                        'from_floor': current_node['floor'],
                        'to_floor': next_node['floor'],
                        'floor_diff': floor_diff,
                        'method': method,
                        'from_node': current_node['name'],
                        'to_node': next_node['name']
                    })
        
        return {
            'total_floor_changes': floor_changes,
            'elevator_changes': elevator_changes,
            'stair_changes': stair_changes,
            'floors_visited': sorted(list(floors_visited)),
            'change_details': change_details
        }
    
    def _generate_path_description(self, path: List[str]) -> str:
        """生成路径的文字描述"""
        if len(path) < 2:
            return "无需移动"
        
        start_node = self.nodes[path[0]]
        end_node = self.nodes[path[-1]]
        
        description_parts = []
        
        # 分析路径特点
        floors_visited = set(self.nodes[node_id]['floor'] for node_id in path)
        has_elevator = any(self.nodes[node_id]['type'] == 'elevator' for node_id in path)
        
        if len(floors_visited) == 1:
            # 同楼层导航
            floor = list(floors_visited)[0]
            description_parts.append(f"在{floor}楼内导航")
        else:
            # 跨楼层导航
            if has_elevator:
                description_parts.append("需要使用电梯")
            description_parts.append(f"涉及{len(floors_visited)}个楼层")
        
        # 路径总结
        total_distance = self._calculate_actual_distance(path)
        estimated_time = self._estimate_time(total_distance)
        
        description = f"从{start_node['name']}到{end_node['name']}，" + \
                     "，".join(description_parts) + \
                     f"，总距离约{total_distance:.0f}米，预计用时{estimated_time}分钟"
        
        return description
    
    def get_all_rooms(self) -> List[Dict]:
        """获取所有房间信息"""
        rooms = []
        for node_id, node_info in self.nodes.items():
            if node_info['type'] == 'room':
                rooms.append({
                    'id': node_id,
                    'name': node_info['name'],
                    'floor': node_info['floor'],
                    'description': node_info['description']
                })
        
        # 按楼层和房间号排序
        rooms.sort(key=lambda x: (x['floor'], x['name']))
        return rooms
    
    def get_building_info(self) -> Dict:
        """获取建筑物信息"""
        return self.building_info
    
    def get_floor_rooms(self, floor: int) -> List[Dict]:
        """获取指定楼层的所有房间"""
        rooms = []
        for node_id, node_info in self.nodes.items():
            if node_info['type'] == 'room' and node_info['floor'] == floor:
                rooms.append({
                    'id': node_id,
                    'name': node_info['name'],
                    'floor': node_info['floor'],
                    'description': node_info['description']
                })
        
        # 按房间号排序
        rooms.sort(key=lambda x: x['name'])
        return rooms
    
    def _calculate_weight_comparison(self, path: List[str], avoid_congestion: bool) -> Dict:
        """
        计算不同权重系统的对比数据
        
        Args:
            path: 路径节点列表
            avoid_congestion: 是否避开拥挤
            
        Returns:
            权重对比数据
        """
        if len(path) < 2:
            return {
                'distance_weight': 0,
                'time_weight': 0,
                'time_advantage': 0,
                'segments': []
            }
        
        total_distance_weight = 0
        total_time_weight = 0
        segments = []
        
        for i in range(len(path) - 1):
            edge_info = self.graph[path[i]][path[i + 1]]
            
            # 距离权重
            if avoid_congestion:
                distance_weight = edge_info['weight']
            else:
                distance_weight = edge_info['distance']
            
            # 时间权重
            if avoid_congestion:
                time_weight = edge_info['time_weight']
            else:
                time_weight = edge_info['time_weight'] / edge_info['congestion_factor']
            
            total_distance_weight += distance_weight
            total_time_weight += time_weight
            
            segments.append({
                'from': path[i],
                'to': path[i + 1],
                'distance': edge_info['distance'],
                'distance_weight': distance_weight,
                'time_weight': time_weight,
                'congestion_factor': edge_info['congestion_factor'],
                'time_advantage': time_weight - distance_weight
            })
        
        time_advantage = total_time_weight - total_distance_weight
        
        return {
            'distance_weight_total': total_distance_weight,
            'time_weight_total': total_time_weight,
            'time_advantage': time_advantage,
            'advantage_percentage': (time_advantage / total_distance_weight * 100) if total_distance_weight > 0 else 0,
            'segments': segments,
            'summary': {
                'better_system': 'time_weight' if time_advantage < 0 else 'distance_weight',
                'advantage_description': f'时间权重系统{"更优" if time_advantage < 0 else "较差"}{abs(time_advantage):.1f}秒'
            }
        } 