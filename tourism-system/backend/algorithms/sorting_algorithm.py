"""
排序算法模块
实现多种排序策略，包括Top-K优化排序
"""

import heapq
import random
from typing import List, Dict, Any, Callable, Optional


class SortingAlgorithm:
    """排序算法类，支持多种排序策略和Top-K优化"""
    
    @staticmethod
    def quick_sort(data: List[Dict], key_func: Callable, reverse: bool = False) -> List[Dict]:
        """
        快速排序算法
        
        Args:
            data: 待排序的数据列表
            key_func: 排序键函数
            reverse: 是否降序排列
            
        Returns:
            排序后的数据列表
        """
        if len(data) <= 1:
            return data
        
        pivot = data[len(data) // 2]
        pivot_value = key_func(pivot)
        
        left = []
        middle = []
        right = []
        
        for item in data:
            item_value = key_func(item)
            if item_value < pivot_value:
                left.append(item)
            elif item_value == pivot_value:
                middle.append(item)
            else:
                right.append(item)
        
        if reverse:
            return (SortingAlgorithm.quick_sort(right, key_func, reverse) + 
                   middle + 
                   SortingAlgorithm.quick_sort(left, key_func, reverse))
        else:
            return (SortingAlgorithm.quick_sort(left, key_func, reverse) + 
                   middle + 
                   SortingAlgorithm.quick_sort(right, key_func, reverse))
    
    @staticmethod
    def quickselect_top_k(data: List[Dict], key_func: Callable, k: int = 12, reverse: bool = True) -> List[Dict]:
        """
        快速选择算法获取Top-K元素，避免完全排序
        自适应选择最优算法：小数据集直接排序，大数据集使用快速选择
        
        Args:
            data: 待排序的数据列表
            key_func: 排序键函数
            k: 需要返回的前K个元素数量
            reverse: 是否降序排列（True表示获取最大的K个）
            
        Returns:
            前K个元素的列表（已排序）
        """
        if not data or k <= 0:
            return []
        
        k = min(k, len(data))
        
        # 自适应阈值：当数据量小于阈值或k接近数据总量时，直接排序更高效
        threshold = max(100, k * 8)  # 动态阈值
        
        if len(data) <= threshold or k >= len(data) * 0.5:
            # 小数据集或需要大部分数据时，直接排序
            sorted_data = sorted(data, key=key_func, reverse=reverse)
            return sorted_data[:k]
        
        # 大数据集使用快速选择算法
        data_copy = data.copy()
        
        def partition(arr, low, high, reverse_order):
            """分区函数，以最后一个元素为基准"""
            pivot_value = key_func(arr[high])
            i = low - 1
            
            for j in range(low, high):
                current_value = key_func(arr[j])
                # 根据reverse_order决定比较方向
                should_swap = (current_value >= pivot_value) if reverse_order else (current_value <= pivot_value)
                
                if should_swap:
                    i += 1
                    arr[i], arr[j] = arr[j], arr[i]
            
            arr[i + 1], arr[high] = arr[high], arr[i + 1]
            return i + 1
        
        def quickselect(arr, low, high, k_target, reverse_order):
            """快速选择递归函数"""
            if low < high:
                # 随机化基准选择，避免最坏情况
                random_idx = random.randint(low, high)
                arr[random_idx], arr[high] = arr[high], arr[random_idx]
                
                pi = partition(arr, low, high, reverse_order)
                
                if pi == k_target - 1:
                    # 找到了第k个位置，前k个就是我们要的
                    return
                elif pi > k_target - 1:
                    # 第k个在左半部分
                    quickselect(arr, low, pi - 1, k_target, reverse_order)
                else:
                    # 第k个在右半部分
                    quickselect(arr, pi + 1, high, k_target, reverse_order)
        
        # 执行快速选择
        quickselect(data_copy, 0, len(data_copy) - 1, k, reverse)
        
        # 返回前k个元素，并对这k个元素进行排序
        top_k = data_copy[:k]
        return sorted(top_k, key=key_func, reverse=reverse)
    
    @staticmethod
    def top_k_sort(data: List[Dict], key_func: Callable, k: int = 10, reverse: bool = False) -> List[Dict]:
        """
        Top-K排序算法，优先使用快速选择算法
        
        Args:
            data: 待排序的数据列表
            key_func: 排序键函数
            k: 需要返回的前K个元素数量
            reverse: 是否降序排列
            
        Returns:
            前K个排序后的数据列表
        """
        # 使用快速选择算法
        return SortingAlgorithm.quickselect_top_k(data, key_func, k, reverse)
    
    @staticmethod
    def multi_key_sort(data: List[Dict], key_funcs: List[Callable], 
                      weights: Optional[List[float]] = None, reverse: bool = False) -> List[Dict]:
        """
        多键排序算法，支持多个排序条件的加权组合
        
        Args:
            data: 待排序的数据列表
            key_funcs: 排序键函数列表
            weights: 权重列表，如果为None则使用等权重
            reverse: 是否降序排列
            
        Returns:
            排序后的数据列表
        """
        if not data or not key_funcs:
            return data
        
        if weights is None:
            weights = [1.0] * len(key_funcs)
        
        def combined_key(item):
            total_score = 0
            for key_func, weight in zip(key_funcs, weights):
                try:
                    value = key_func(item)
                    total_score += value * weight
                except (TypeError, KeyError):
                    continue
            return total_score
        
        return SortingAlgorithm.quick_sort(data, combined_key, reverse)
    
    @staticmethod
    def sort_places_by_recommendation(places: List[Dict], user_interests: List[str] = None, k: int = 12) -> List[Dict]:
        """
        基于推荐算法的场所排序，使用快速选择算法优化
        综合考虑热度、评价和用户兴趣匹配度
        
        Args:
            places: 场所列表
            user_interests: 用户兴趣列表
            k: 返回前K个推荐
            
        Returns:
            前K个排序后的场所列表
        """
        def recommendation_score(place):
            # 基础分数：评价和浏览量的加权平均
            rating_score = place.get('rating', 0)
            click_score = place.get('clickCount', 0) / 1000  # 归一化
            base_score = rating_score * 0.7 + click_score * 0.3
            
            # 兴趣匹配分数
            interest_score = 0
            if user_interests:
                place_keywords = place.get('keywords', [])
                place_type = place.get('type', '')
                
                # 计算关键词匹配度
                keyword_matches = sum(1 for interest in user_interests 
                                    for keyword in place_keywords 
                                    if interest in keyword or keyword in interest)
                
                # 计算类型匹配度
                type_matches = sum(1 for interest in user_interests 
                                 if interest in place_type or place_type in interest)
                
                interest_score = (keyword_matches * 0.7 + type_matches * 0.3) * 2
            
            return base_score + interest_score
        
        return SortingAlgorithm.quickselect_top_k(places, recommendation_score, k, reverse=True)
    
    @staticmethod
    def sort_diaries_by_relevance(diaries: List[Dict], place_id: str = None, 
                                 user_interests: List[str] = None, k: int = 12) -> List[Dict]:
        """
        基于相关性的日记排序，使用快速选择算法优化
        
        Args:
            diaries: 日记列表
            place_id: 场所ID，用于筛选相关日记
            user_interests: 用户兴趣列表
            k: 返回前K个推荐
            
        Returns:
            前K个排序后的日记列表
        """
        # 如果指定了场所ID，先筛选相关日记
        if place_id:
            diaries = [diary for diary in diaries if diary.get('placeId') == place_id]
        
        def relevance_score(diary):
            # 基础分数：点击量和评分
            click_score = diary.get('clickCount', 0) / 100  # 归一化
            rating_score = diary.get('rating', 0)
            base_score = click_score * 0.5 + rating_score * 0.5
            
            # 兴趣匹配分数
            interest_score = 0
            if user_interests:
                diary_tags = diary.get('tags', [])
                tag_matches = sum(1 for interest in user_interests 
                                for tag in diary_tags 
                                if interest in tag or tag in interest)
                interest_score = tag_matches * 0.5
            
            return base_score + interest_score
        
        return SortingAlgorithm.quickselect_top_k(diaries, relevance_score, k, reverse=True)
    
    @staticmethod
    def sort_facilities_by_distance(facilities: List[Dict], target_location: Dict[str, float], 
                                   algorithm: str = 'heap') -> List[Dict]:
        """
        按距离排序设施
        
        Args:
            facilities: 设施列表
            target_location: 目标位置 {"lat": latitude, "lng": longitude}
            algorithm: 排序算法选择 ('heap', 'quick', 'auto')
            
        Returns:
            按距离排序的设施列表
        """
        def calculate_distance(facility):
            """计算两点间的欧几里得距离（简化版）"""
            facility_location = facility.get('location', {})
            lat_diff = facility_location.get('lat', 0) - target_location.get('lat', 0)
            lng_diff = facility_location.get('lng', 0) - target_location.get('lng', 0)
            return (lat_diff ** 2 + lng_diff ** 2) ** 0.5
        
        # 根据算法选择进行排序
        if algorithm == 'heap':
            return SortingAlgorithm.heap_sort(facilities, calculate_distance, reverse=False)
        elif algorithm == 'quick':
            return SortingAlgorithm.quick_sort(facilities, calculate_distance, reverse=False)
        elif algorithm == 'auto':
            # 自动选择：小数据集用堆排序，大数据集用快速排序
            if len(facilities) <= 1000:
                return SortingAlgorithm.heap_sort(facilities, calculate_distance, reverse=False)
            else:
                return SortingAlgorithm.quick_sort(facilities, calculate_distance, reverse=False)
        else:
            # 默认使用堆排序
            return SortingAlgorithm.heap_sort(facilities, calculate_distance, reverse=False)
    
    @staticmethod
    def sort_places_by_distance(places: List[Dict], target_location: Dict[str, float], 
                               algorithm: str = 'heap', k: int = None) -> List[Dict]:
        """
        按距离排序场所（专门用于场所查询）
        
        Args:
            places: 场所列表
            target_location: 目标位置 {"lat": latitude, "lng": longitude}
            algorithm: 排序算法选择 ('heap', 'quick', 'heap_topk', 'auto')
            k: 如果指定，只返回前k个最近的场所
            
        Returns:
            按距离排序的场所列表
        """
        def calculate_distance(place):
            """计算两点间的欧几里得距离"""
            place_location = place.get('location', {})
            lat_diff = place_location.get('lat', 0) - target_location.get('lat', 0)
            lng_diff = place_location.get('lng', 0) - target_location.get('lng', 0)
            return (lat_diff ** 2 + lng_diff ** 2) ** 0.5
        
        # 如果指定了k值且使用堆排序，优先使用Top-K堆排序
        if k is not None and algorithm in ['heap', 'heap_topk', 'auto']:
            return SortingAlgorithm.heap_sort_top_k(places, calculate_distance, k, reverse=False)
        
        # 根据算法选择进行排序
        if algorithm == 'heap':
            sorted_places = SortingAlgorithm.heap_sort(places, calculate_distance, reverse=False)
        elif algorithm == 'quick':
            sorted_places = SortingAlgorithm.quick_sort(places, calculate_distance, reverse=False)
        elif algorithm == 'heap_topk' and k is not None:
            return SortingAlgorithm.heap_sort_top_k(places, calculate_distance, k, reverse=False)
        elif algorithm == 'auto':
            # 自动选择最优算法
            if k is not None and k < len(places) * 0.3:
                # 需要少量结果时，使用Top-K堆排序
                return SortingAlgorithm.heap_sort_top_k(places, calculate_distance, k, reverse=False)
            elif len(places) <= 500:
                # 小数据集使用堆排序
                sorted_places = SortingAlgorithm.heap_sort(places, calculate_distance, reverse=False)
            else:
                # 大数据集使用快速排序
                sorted_places = SortingAlgorithm.quick_sort(places, calculate_distance, reverse=False)
        else:
            # 默认使用堆排序
            sorted_places = SortingAlgorithm.heap_sort(places, calculate_distance, reverse=False)
        
        # 如果指定了k值，返回前k个
        if k is not None:
            return sorted_places[:k]
        
        return sorted_places
    
    @staticmethod
    def partial_sort_with_all_data(data: List[Dict], key_func: Callable, k: int = 12, reverse: bool = True) -> List[Dict]:
        """
        部分排序算法：返回所有数据，但前K个是精确排序的，其余保持原顺序
        这样既能利用Top-K算法的性能优势，又能显示所有数据
        
        Args:
            data: 待排序的数据列表
            key_func: 排序键函数
            k: 需要精确排序的前K个元素数量
            reverse: 是否降序排列（True表示获取最大的K个）
            
        Returns:
            所有数据的列表，前K个是精确排序的
        """
        if not data or k <= 0:
            return data.copy()
        
        k = min(k, len(data))
        
        # 获取前K个精确排序的元素
        top_k_elements = SortingAlgorithm.quickselect_top_k(data, key_func, k, reverse)
        
        # 获取前K个元素的ID集合，用于过滤
        top_k_ids = {item.get('id') for item in top_k_elements}
        
        # 获取剩余的元素（保持原顺序）
        remaining_elements = [item for item in data if item.get('id') not in top_k_ids]
        
        # 合并结果：前K个精确排序 + 剩余元素保持原顺序
        return top_k_elements + remaining_elements
    
    @staticmethod
    def heap_sort(data: List[Dict], key_func: Callable, reverse: bool = False) -> List[Dict]:
        """
        堆排序算法
        
        Args:
            data: 待排序的数据列表
            key_func: 排序键函数
            reverse: 是否降序排列
            
        Returns:
            排序后的数据列表
        """
        if len(data) <= 1:
            return data.copy()
        
        # 创建数据副本，避免修改原数据
        data_copy = data.copy()
        n = len(data_copy)
        
        def heapify(arr, n, i, reverse_order):
            """维护堆性质的函数"""
            largest = i  # 初始化最大值为根节点
            left = 2 * i + 1  # 左子节点
            right = 2 * i + 2  # 右子节点
            
            # 如果左子节点存在且大于根节点
            if left < n:
                left_value = key_func(arr[left])
                largest_value = key_func(arr[largest])
                
                if reverse_order:
                    # 降序：构建最小堆
                    if left_value < largest_value:
                        largest = left
                else:
                    # 升序：构建最大堆
                    if left_value > largest_value:
                        largest = left
            
            # 如果右子节点存在且大于当前最大值
            if right < n:
                right_value = key_func(arr[right])
                largest_value = key_func(arr[largest])
                
                if reverse_order:
                    # 降序：构建最小堆
                    if right_value < largest_value:
                        largest = right
                else:
                    # 升序：构建最大堆
                    if right_value > largest_value:
                        largest = right
            
            # 如果最大值不是根节点，交换并继续堆化
            if largest != i:
                arr[i], arr[largest] = arr[largest], arr[i]
                heapify(arr, n, largest, reverse_order)
        
        # 构建最大堆（升序）或最小堆（降序）
        for i in range(n // 2 - 1, -1, -1):
            heapify(data_copy, n, i, reverse)
        
        # 逐个提取元素
        for i in range(n - 1, 0, -1):
            # 将当前最大值移到末尾
            data_copy[0], data_copy[i] = data_copy[i], data_copy[0]
            # 重新堆化剩余元素
            heapify(data_copy, i, 0, reverse)
        
        return data_copy
    
    @staticmethod
    def heap_sort_top_k(data: List[Dict], key_func: Callable, k: int = 12, reverse: bool = False) -> List[Dict]:
        """
        使用堆排序获取Top-K元素，适合距离排序等场景
        
        Args:
            data: 待排序的数据列表
            key_func: 排序键函数
            k: 需要返回的前K个元素数量
            reverse: 是否降序排列
            
        Returns:
            前K个元素的列表（已排序）
        """
        if not data or k <= 0:
            return []
        
        k = min(k, len(data))
        
        # 对于小数据集或需要大部分数据时，直接使用完整堆排序
        if len(data) <= 100 or k >= len(data) * 0.8:
            sorted_data = SortingAlgorithm.heap_sort(data, key_func, reverse)
            return sorted_data[:k]
        
        # 对于大数据集，使用堆来维护Top-K
        if reverse:
            # 降序：使用最小堆维护最大的K个元素
            heap = []
            for item in data:
                value = key_func(item)
                if len(heap) < k:
                    heapq.heappush(heap, (value, item))
                elif value > heap[0][0]:
                    heapq.heapreplace(heap, (value, item))
            
            # 提取结果并按降序排列
            result = [item for _, item in sorted(heap, key=lambda x: x[0], reverse=True)]
        else:
            # 升序：使用最大堆维护最小的K个元素
            heap = []
            for item in data:
                value = key_func(item)
                neg_value = -value  # 使用负值模拟最大堆
                if len(heap) < k:
                    heapq.heappush(heap, (neg_value, item))
                elif neg_value > heap[0][0]:
                    heapq.heapreplace(heap, (neg_value, item))
            
            # 提取结果并按升序排列
            result = [item for _, item in sorted(heap, key=lambda x: -x[0])]
        
        return result
    
    @staticmethod
    def merge_sort(data: List[Dict], key_func: Callable, reverse: bool = False) -> List[Dict]:
        """
        归并排序算法 - 稳定排序，适合按浏览量和评分排序
        
        时间复杂度: O(n log n)
        空间复杂度: O(n)
        稳定性: 稳定排序
        
        Args:
            data: 待排序的数据列表
            key_func: 排序键函数
            reverse: 是否降序排列
            
        Returns:
            排序后的数据列表
        """
        if len(data) <= 1:
            return data.copy()
        
        def merge(left: List[Dict], right: List[Dict]) -> List[Dict]:
            """合并两个已排序的数组"""
            result = []
            i = j = 0
            
            while i < len(left) and j < len(right):
                left_value = key_func(left[i])
                right_value = key_func(right[j])
                
                # 根据reverse参数决定比较方向
                if reverse:
                    # 降序：左边值大于右边值时选择左边
                    if left_value >= right_value:
                        result.append(left[i])
                        i += 1
                    else:
                        result.append(right[j])
                        j += 1
                else:
                    # 升序：左边值小于右边值时选择左边
                    if left_value <= right_value:
                        result.append(left[i])
                        i += 1
                    else:
                        result.append(right[j])
                        j += 1
            
            # 添加剩余元素
            result.extend(left[i:])
            result.extend(right[j:])
            return result
        
        def merge_sort_recursive(arr: List[Dict]) -> List[Dict]:
            """递归实现归并排序"""
            if len(arr) <= 1:
                return arr
            
            # 分割数组
            mid = len(arr) // 2
            left = merge_sort_recursive(arr[:mid])
            right = merge_sort_recursive(arr[mid:])
            
            # 合并排序后的数组
            return merge(left, right)
        
        return merge_sort_recursive(data.copy())
    
    @staticmethod
    def merge_sort_by_views(diaries: List[Dict], reverse: bool = True) -> List[Dict]:
        """
        使用归并排序按浏览量排序日记
        
        Args:
            diaries: 日记列表
            reverse: 是否降序排列（默认True，浏览量高的在前）
            
        Returns:
            按浏览量排序的日记列表
        """
        def get_click_count(diary):
            """获取点击量，处理None值"""
            return diary.get('clickCount', 0) or 0
        
        return SortingAlgorithm.merge_sort(diaries, get_click_count, reverse)
    
    @staticmethod
    def merge_sort_by_rating(diaries: List[Dict], reverse: bool = True) -> List[Dict]:
        """
        使用归并排序按评分排序日记
        
        Args:
            diaries: 日记列表
            reverse: 是否降序排列（默认True，评分高的在前）
            
        Returns:
            按评分排序的日记列表
        """
        def get_rating(diary):
            """获取评分，处理None值"""
            return diary.get('rating', 0.0) or 0.0
        
        return SortingAlgorithm.merge_sort(diaries, get_rating, reverse)
    
    @staticmethod
    def merge_sort_multi_key(diaries: List[Dict], primary_key: str = 'rating', 
                           secondary_key: str = 'clickCount', reverse: bool = True) -> List[Dict]:
        """
        使用归并排序进行多键排序（评分+浏览量）
        
        Args:
            diaries: 日记列表
            primary_key: 主排序键（'rating' 或 'clickCount'）
            secondary_key: 次排序键（'rating' 或 'clickCount'）
            reverse: 是否降序排列
            
        Returns:
            多键排序后的日记列表
        """
        def multi_key_func(diary):
            """多键排序函数"""
            primary_value = diary.get(primary_key, 0) or 0
            secondary_value = diary.get(secondary_key, 0) or 0
            
            # 返回元组，Python会自动按元组元素顺序比较
            return (primary_value, secondary_value)
        
        return SortingAlgorithm.merge_sort(diaries, multi_key_func, reverse)
    
    @staticmethod
    def merge_sort_places_by_popularity(places: List[Dict], reverse: bool = True) -> List[Dict]:
        """
        使用归并排序按热度排序场所
        
        Args:
            places: 场所列表
            reverse: 是否降序排列（默认True，热度高的在前）
            
        Returns:
            按热度排序的场所列表
        """
        def get_popularity(place):
            """获取热度值"""
            return place.get('popularity', 0) or 0
        
        return SortingAlgorithm.merge_sort(places, get_popularity, reverse)
    
    @staticmethod
    def merge_sort_places_by_rating(places: List[Dict], reverse: bool = True) -> List[Dict]:
        """
        使用归并排序按评分排序场所
        
        Args:
            places: 场所列表
            reverse: 是否降序排列（默认True，评分高的在前）
            
        Returns:
            按评分排序的场所列表
        """
        def get_rating(place):
            """获取评分值"""
            return place.get('rating', 0.0) or 0.0
        
        return SortingAlgorithm.merge_sort(places, get_rating, reverse)


# 使用示例和测试函数
def test_sorting_algorithms():
    """测试排序算法"""
    # 测试数据
    test_places = [
        {"id": "1", "name": "西湖", "popularity": 4850, "rating": 4.6, "keywords": ["自然", "风景"]},
        {"id": "2", "name": "故宫", "popularity": 5200, "rating": 4.8, "keywords": ["历史", "文化"]},
        {"id": "3", "name": "清华", "popularity": 3800, "rating": 4.7, "keywords": ["教育", "科技"]},
    ]
    
    # 测试Top-K排序
    top_places = SortingAlgorithm.sort_places_by_recommendation(
        test_places, user_interests=["历史", "文化"]
    )
    print("推荐场所排序结果:")
    for place in top_places:
        print(f"- {place['name']}: 热度{place['popularity']}, 评分{place['rating']}")


def test_merge_sort_algorithms():
    """测试归并排序算法"""
    print("\n🔄 归并排序算法测试")
    print("=" * 50)
    
    # 测试日记数据
    test_diaries = [
        {"id": "1", "title": "西湖游记", "clickCount": 1250, "rating": 4.5},
        {"id": "2", "title": "故宫之旅", "clickCount": 2100, "rating": 4.8},
        {"id": "3", "title": "清华校园", "clickCount": 890, "rating": 4.7},
        {"id": "4", "title": "北京胡同", "clickCount": 1680, "rating": 4.3},
        {"id": "5", "title": "上海外滩", "clickCount": 2350, "rating": 4.6},
    ]
    
    # 测试按浏览量排序
    print("\n📊 按浏览量排序（降序）:")
    sorted_by_views = SortingAlgorithm.merge_sort_by_views(test_diaries)
    for diary in sorted_by_views:
        print(f"- {diary['title']}: {diary['clickCount']} 次浏览")
    
    # 测试按评分排序
    print("\n⭐ 按评分排序（降序）:")
    sorted_by_rating = SortingAlgorithm.merge_sort_by_rating(test_diaries)
    for diary in sorted_by_rating:
        print(f"- {diary['title']}: {diary['rating']} 分")
    
    # 测试多键排序
    print("\n🎯 多键排序（评分+浏览量）:")
    sorted_multi_key = SortingAlgorithm.merge_sort_multi_key(test_diaries)
    for diary in sorted_multi_key:
        print(f"- {diary['title']}: {diary['rating']} 分, {diary['clickCount']} 次浏览")
    
    # 测试场所数据
    test_places = [
        {"id": "1", "name": "西湖", "popularity": 4850, "rating": 4.6},
        {"id": "2", "name": "故宫", "popularity": 5200, "rating": 4.8},
        {"id": "3", "name": "清华", "popularity": 3800, "rating": 4.7},
    ]
    
    print("\n🏛️ 场所按热度排序:")
    sorted_places_popularity = SortingAlgorithm.merge_sort_places_by_popularity(test_places)
    for place in sorted_places_popularity:
        print(f"- {place['name']}: 热度 {place['popularity']}")
    
    print("\n⭐ 场所按评分排序:")
    sorted_places_rating = SortingAlgorithm.merge_sort_places_by_rating(test_places)
    for place in sorted_places_rating:
        print(f"- {place['name']}: 评分 {place['rating']}")


if __name__ == "__main__":
    test_sorting_algorithms()
    test_merge_sort_algorithms() 