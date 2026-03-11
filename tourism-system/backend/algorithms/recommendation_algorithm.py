"""
个性化推荐算法模块
基于用户兴趣和相似度计算进行内容推荐
"""

import math
import random
from typing import List, Dict, Tuple, Set
from collections import defaultdict

# 导入Treap优化器
try:
    from .treap_top_k import TreapRecommendationOptimizer
    TREAP_AVAILABLE = True
except ImportError:
    TREAP_AVAILABLE = False
    print("Warning: Treap优化器未找到，将使用快速选择算法")


class RecommendationAlgorithm:
    """个性化推荐算法类"""
    
    def __init__(self, use_treap: bool = True):
        self.user_profiles = {}
        self.item_profiles = {}
        self.similarity_cache = {}
        self.use_treap = use_treap and TREAP_AVAILABLE  # 是否使用Treap优化
    
    def calculate_cosine_similarity(self, vector1: Dict[str, float], vector2: Dict[str, float]) -> float:
        """
        计算余弦相似度
        
        Args:
            vector1: 向量1
            vector2: 向量2
            
        Returns:
            余弦相似度值
        """
        # 获取共同特征
        common_features = set(vector1.keys()) & set(vector2.keys())
        
        if not common_features:
            return 0.0
        for feature in common_features:
            print(F"vector1[{feature}]: {vector1[feature]}")
            print(F"vector2[{feature}]: {vector2[feature]}")
        print(F"common_features: {common_features}")
        # 计算点积
        dot_product = sum(vector1[feature] * vector2[feature] for feature in common_features)
        
        # 计算向量长度
        norm1 = math.sqrt(sum(value ** 2 for value in vector1.values()))
        norm2 = math.sqrt(sum(value ** 2 for value in vector2.values()))
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return dot_product / (norm1 * norm2)
    
    def calculate_jaccard_similarity(self, set1: Set, set2: Set) -> float:
        """
        计算Jaccard相似度
        
        Args:
            set1: 集合1
            set2: 集合2
            
        Returns:
            Jaccard相似度值
        """
        if not set1 and not set2:
            return 1.0
        
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        
        return intersection / union if union > 0 else 0.0
    
    def build_user_profile(self, user: Dict, user_history: List[Dict]) -> Dict[str, float]:
        """
        构建用户兴趣档案
        
        Args:
            user: 用户信息
            user_history: 用户历史行为数据
            
        Returns:
            用户兴趣向量
        """
        profile = defaultdict(float)
        
        # 基于用户声明的兴趣
        user_interests = user.get('interests', [])
        for interest in user_interests:
            profile[interest.lower()] += 2.0  # 声明兴趣权重较高
        
        # 基于用户偏好类别
        favorite_categories = user.get('favoriteCategories', [])
        for category in favorite_categories:
            profile[category.lower()] += 1.5
        
        # 基于历史行为
        for item in user_history:
            # 访问历史
            if 'keywords' in item:
                for keyword in item.get('keywords', []):
                    profile[keyword.lower()] += 1.0
            
            if 'type' in item:
                profile[item['type'].lower()] += 0.8
            
            # 评分历史（高评分的项目权重更高）
            rating = item.get('rating', 3.0)
            weight = (rating - 2.5) / 2.5  # 将评分转换为权重
            
            if 'tags' in item:
                for tag in item.get('tags', []):
                    profile[tag.lower()] += weight
        
        # 归一化
        total_weight = sum(profile.values())
        if total_weight > 0:
            for key in profile:
                profile[key] /= total_weight
        
        return dict(profile)
    
    def build_item_profile(self, item: Dict) -> Dict[str, float]:
        """
        构建项目特征档案
        
        Args:
            item: 项目信息
            
        Returns:
            项目特征向量
        """
        profile = defaultdict(float)
        
        # 关键词特征
        if 'keywords' in item:
            for keyword in item.get('keywords', []):
                profile[keyword.lower()] += 1.0
        
        # 类型特征
        if 'type' in item:
            profile[item['type'].lower()] += 1.0
        
        # 标签特征
        if 'tags' in item:
            for tag in item.get('tags', []):
                profile[tag.lower()] += 1.0
        
        # 热度特征
        popularity = item.get('clickCount', 0)  # 修复字段名称
        
        if popularity > 0:
            profile['high_popularity'] = min(popularity / 5000, 1.0)  # 归一化到[0,1]
        
        # 评分特征（归一化）
        rating = item.get('rating', 0)
        if rating > 0:
            profile['high_rating'] = min(rating / 5.0, 1.0)  # 归一化到[0,1]
        
        return dict(profile)
    
    def content_based_recommendation(self, user: Dict, items: List[Dict], 
                                   user_history: List[Dict], top_k: int = 12) -> List[Tuple[Dict, float]]:
        """
        基于内容的推荐算法，支持Treap和快速选择优化
        
        Args:
            user: 用户信息
            items: 候选项目列表
            user_history: 用户历史数据
            top_k: 返回前K个推荐
            
        Returns:
            推荐项目列表，包含相似度分数
        """
        # 构建用户档案
        user_profile = self.build_user_profile(user, user_history)
        if not user_profile:
            # 如果用户档案为空，返回热门项目
            return self.popularity_based_recommendation(items, top_k)
        
        # 计算每个项目的相似度
        recommendations = []
        
        for item in items:
            item_profile = self.build_item_profile(item)
            similarity = self.calculate_cosine_similarity(user_profile, item_profile)
            
            # 添加热度和评分加成
            popularity_boost = min(item.get('clickCount', 0) / 10000, 0.2)  # 最多增加0.2，修复字段名称
            rating_boost = min(item.get('rating', 0) / 5.0, 0.2)  # 最多增加0.2
            
            final_score = similarity + popularity_boost + rating_boost
            recommendations.append((item, final_score))
        
        # 根据配置选择优化算法
        if self.use_treap:
            return self.treap_top_k_recommendations(recommendations, top_k)
        else:
            return self.quickselect_top_k_recommendations(recommendations, top_k)
    
    def collaborative_filtering_recommendation(self, target_user: Dict, all_users: List[Dict], 
                                             items: List[Dict], top_k: int = 12) -> List[Tuple[Dict, float]]:
        """
        协同过滤推荐算法（基于用户的协同过滤），使用快速选择优化
        
        Args:
            target_user: 目标用户
            all_users: 所有用户列表
            items: 项目列表
            top_k: 返回前K个推荐
            
        Returns:
            推荐项目列表
        """
        target_user_id = target_user.get('id')
        target_interests = set(target_user.get('interests', []))
        target_categories = set(target_user.get('favoriteCategories', []))
        target_visit_history = set(target_user.get('visitHistory', []))
        
        # 找到相似用户
        similar_users = []
        
        for user in all_users:
            if user.get('id') == target_user_id:
                continue
            
            user_interests = set(user.get('interests', []))
            user_categories = set(user.get('favoriteCategories', []))
            user_visit_history = set(user.get('visitHistory', []))
            
            # 计算用户相似度
            interest_similarity = self.calculate_jaccard_similarity(target_interests, user_interests)
            category_similarity = self.calculate_jaccard_similarity(target_categories, user_categories)
            history_similarity = self.calculate_jaccard_similarity(target_visit_history, user_visit_history)
            
            # 综合相似度
            overall_similarity = (interest_similarity * 0.4 + 
                                category_similarity * 0.3 + 
                                history_similarity * 0.3)
            
            if overall_similarity > 0.1:  # 相似度阈值
                similar_users.append((user, overall_similarity))
        
        # 按相似度排序
        similar_users.sort(key=lambda x: x[1], reverse=True)
        
        # 基于相似用户的偏好推荐项目
        item_scores = defaultdict(float)
        
        for similar_user, similarity in similar_users[:5]:  # 取前5个相似用户
            user_visit_history = similar_user.get('visitHistory', [])
            user_ratings = {r['placeId']: r['rating'] for r in similar_user.get('ratingHistory', [])}
            
            for place_id in user_visit_history:
                if place_id not in target_visit_history:  # 推荐用户未访问过的地方
                    rating = user_ratings.get(place_id, 3.0)
                    item_scores[place_id] += similarity * rating
        
        # 转换为项目对象
        recommendations = []
        items_dict = {item['id']: item for item in items}
        
        for item_id, score in item_scores.items():
            if item_id in items_dict:
                recommendations.append((items_dict[item_id], score))
        
        # 使用快速选择算法获取前K个
        return self.quickselect_top_k_recommendations(recommendations, top_k)
    
    def hybrid_recommendation(self, user: Dict, items: List[Dict], all_users: List[Dict],
                            user_history: List[Dict], top_k: int = 12) -> List[Tuple[Dict, float]]:
        """
        混合推荐算法（结合内容推荐和协同过滤），使用快速选择优化
        
        Args:
            user: 用户信息
            items: 项目列表
            all_users: 所有用户列表
            user_history: 用户历史数据
            top_k: 返回前K个推荐
            
        Returns:
            推荐项目列表
        """
        # 获取基于内容的推荐
        content_recommendations = self.content_based_recommendation(user, items, user_history, top_k * 2)
        
        # 获取协同过滤推荐
        cf_recommendations = self.collaborative_filtering_recommendation(user, all_users, items, top_k * 2)
        
        # 合并推荐结果
        item_scores = defaultdict(float)
        
        # 内容推荐权重0.6
        for item, score in content_recommendations:
            item_scores[item['id']] += score * 0.6
        
        # 协同过滤权重0.4
        for item, score in cf_recommendations:
            item_scores[item['id']] += score * 0.4
        
        # 转换为最终推荐列表
        items_dict = {item['id']: item for item in items}
        final_recommendations = []
        
        for item_id, score in item_scores.items():
            if item_id in items_dict:
                final_recommendations.append((items_dict[item_id], score))
        
        # 使用快速选择算法获取前K个
        return self.quickselect_top_k_recommendations(final_recommendations, top_k)
    
    def popularity_based_recommendation(self, items: List[Dict], top_k: int = 12) -> List[Tuple[Dict, float]]:
        """
        基于热度的推荐算法（冷启动时使用），支持Treap和快速选择优化
        
        Args:
            items: 项目列表
            top_k: 返回前K个推荐
            
        Returns:
            推荐项目列表
        """
        # 计算综合热度分数
        scored_items = []
        
        for item in items:
            # 修复字段名称：使用clickCount而不是popularity
            popularity = item.get('clickCount', 0)
            rating = item.get('rating', 0)
            
            # 综合分数：热度权重0.6，评分权重0.4
            score = (popularity / 1000) * 0.6 + rating * 0.4
            scored_items.append((item, score))
        
        # 根据配置选择优化算法
        if self.use_treap:
            return self.treap_top_k_recommendations(scored_items, top_k)
        else:
            return self.quickselect_top_k_recommendations(scored_items, top_k)
    
    def recommend_places(self, user: Dict, places: List[Dict], all_users: List[Dict],
                        algorithm: str = 'hybrid', top_k: int = 12) -> List[Dict]:
        """
        场所推荐，支持指定返回数量
        
        Args:
            user: 用户信息
            places: 场所列表
            all_users: 所有用户列表
            algorithm: 推荐算法类型
            top_k: 返回前K个推荐
            
        Returns:
            推荐的场所列表
        """
        # 获取用户历史数据
        user_history = []
        user_visit_history = user.get('visitHistory', [])
        
        # 构建历史访问的场所信息
        places_dict = {place['id']: place for place in places}
        for place_id in user_visit_history:
            if place_id in places_dict:
                user_history.append(places_dict[place_id])
        
        # 过滤掉用户已访问的场所
        unvisited_places = [place for place in places if place['id'] not in user_visit_history]
        
        if algorithm == 'content':
            recommendations = self.content_based_recommendation(user, unvisited_places, user_history, top_k)
        elif algorithm == 'collaborative':
            recommendations = self.collaborative_filtering_recommendation(user, all_users, unvisited_places, top_k)
        elif algorithm == 'popularity':
            recommendations = self.popularity_based_recommendation(unvisited_places, top_k)
        else:  # hybrid
            recommendations = self.hybrid_recommendation(user, unvisited_places, all_users, user_history, top_k)
        
        return [item for item, score in recommendations]
    
    def recommend_diaries(self, user: Dict, diaries: List[Dict], all_users: List[Dict],
                         algorithm: str = 'content', top_k: int = 12) -> List[Dict]:
        """
        日记推荐，支持指定返回数量
        
        Args:
            user: 用户信息
            diaries: 日记列表
            all_users: 所有用户列表
            algorithm: 推荐算法类型
            top_k: 返回前K个推荐
            
        Returns:
            推荐的日记列表
        """
        # 获取用户历史数据（基于用户兴趣构建虚拟历史）
        user_history = []
        user_interests = user.get('interests', [])
        
        # 为每个兴趣创建虚拟历史项目
        for interest in user_interests:
            user_history.append({
                'keywords': [interest],
                'type': 'interest',
                'rating': 4.0
            })
        
        if algorithm == 'content':
            recommendations = self.content_based_recommendation(user, diaries, user_history, top_k)
        elif algorithm == 'collaborative':
            recommendations = self.collaborative_filtering_recommendation(user, all_users, diaries, top_k)
        elif algorithm == 'popularity':
            recommendations = self.popularity_based_recommendation(diaries, top_k)
        else:  # hybrid
            recommendations = self.hybrid_recommendation(user, diaries, all_users, user_history, top_k)
        
        return [item for item, score in recommendations]

    def treap_top_k_recommendations(self, recommendations: List[Tuple], k: int = 12) -> List[Tuple]:
        """
        使用Treap数据结构获取Top-K推荐
        时间复杂度：O(n log k)，空间复杂度：O(k)
        
        Args:
            recommendations: 推荐列表，格式为[(item, score), ...]
            k: 返回前K个推荐
            
        Returns:
            前K个推荐的列表（已按分数降序排序）
        """
        if not TREAP_AVAILABLE:
            # 如果Treap不可用，回退到快速选择
            return self.quickselect_top_k_recommendations(recommendations, k)
        
        return TreapRecommendationOptimizer.treap_top_k_recommendations(recommendations, k)

    @staticmethod
    def quickselect_top_k_recommendations(recommendations: List[Tuple], k: int = 12) -> List[Tuple]:
        """
        使用快速选择算法获取Top-K推荐，避免完全排序
        平均时间复杂度：O(n)，最坏情况：O(n²)
        
        Args:
            recommendations: 推荐列表，格式为[(item, score), ...]
            k: 返回前K个推荐
            
        Returns:
            前K个推荐的列表（已排序）
        """
        if not recommendations or k <= 0:
            return []
        
        k = min(k, len(recommendations))
        
        # 如果数据量很小，直接排序
        if len(recommendations) <= k + 5:
            sorted_recs = sorted(recommendations, key=lambda x: x[1], reverse=True)
            return sorted_recs[:k]
        
        # 创建副本避免修改原数据
        recs_copy = recommendations.copy()
        
        def partition(arr, low, high):
            """分区函数，按分数降序排列"""
            pivot_score = arr[high][1]
            i = low - 1
            
            for j in range(low, high):
                current_score = arr[j][1]
                # 降序排列：如果当前分数大于等于基准分数，则交换
                if current_score >= pivot_score:
                    i += 1
                    arr[i], arr[j] = arr[j], arr[i]
            
            arr[i + 1], arr[high] = arr[high], arr[i + 1]
            return i + 1
        
        def quickselect(arr, low, high, k_target):
            """快速选择递归函数"""
            if low < high:
                # 随机化基准选择，避免最坏情况
                random_idx = random.randint(low, high)
                arr[random_idx], arr[high] = arr[high], arr[random_idx]
                
                pi = partition(arr, low, high)
                
                if pi == k_target - 1:
                    # 找到了第k个位置，前k个就是我们要的
                    return
                elif pi > k_target - 1:
                    # 第k个在左半部分
                    quickselect(arr, low, pi - 1, k_target)
                else:
                    # 第k个在右半部分
                    quickselect(arr, pi + 1, high, k_target)
        
        # 执行快速选择
        quickselect(recs_copy, 0, len(recs_copy) - 1, k)
        
        # 返回前k个元素，并对这k个元素进行排序
        top_k = recs_copy[:k]
        return sorted(top_k, key=lambda x: x[1], reverse=True)
    
    def compare_algorithms(self, recommendations: List[Tuple], k: int = 12) -> Dict:
        """
        比较不同Top-K算法的性能
        
        Args:
            recommendations: 推荐列表
            k: 返回前K个推荐
            
        Returns:
            性能比较结果
        """
        import time
        
        results = {}
        
        # 测试Treap方法
        if TREAP_AVAILABLE:
            start_time = time.time()
            treap_result = self.treap_top_k_recommendations(recommendations, k)
            treap_time = time.time() - start_time
            results['treap'] = {
                'time': treap_time,
                'result_count': len(treap_result),
                'top_score': treap_result[0][1] if treap_result else 0
            }
        
        # 测试快速选择方法
        start_time = time.time()
        quickselect_result = self.quickselect_top_k_recommendations(recommendations, k)
        quickselect_time = time.time() - start_time
        results['quickselect'] = {
            'time': quickselect_time,
            'result_count': len(quickselect_result),
            'top_score': quickselect_result[0][1] if quickselect_result else 0
        }
        
        # 测试传统排序方法
        start_time = time.time()
        sorted_result = sorted(recommendations, key=lambda x: x[1], reverse=True)[:k]
        sort_time = time.time() - start_time
        results['sort'] = {
            'time': sort_time,
            'result_count': len(sorted_result),
            'top_score': sorted_result[0][1] if sorted_result else 0
        }
        
        return results


def test_recommendation_algorithm():
    """测试推荐算法"""
    # 测试数据
    test_user = {
        "id": "user_001",
        "interests": ["历史文化", "自然风光"],
        "favoriteCategories": ["景区", "博物馆"],
        "visitHistory": ["place_001"],
        "ratingHistory": [{"placeId": "place_001", "rating": 4.5}]
    }
    
    test_places = [
        {"id": "place_001", "name": "西湖", "keywords": ["自然", "风景"], "type": "景区", "popularity": 4850, "rating": 4.6},
        {"id": "place_002", "name": "故宫", "keywords": ["历史", "文化"], "type": "景区", "popularity": 5200, "rating": 4.8},
        {"id": "place_003", "name": "清华", "keywords": ["教育", "科技"], "type": "校园", "popularity": 3800, "rating": 4.7},
    ]
    
    test_users = [test_user]
    
    # 创建推荐算法实例
    recommender = RecommendationAlgorithm()
    
    # 测试场所推荐
    recommendations = recommender.recommend_places(test_user, test_places, test_users, 'content')
    print("推荐场所:")
    for place in recommendations:
        print(f"- {place['name']}: {place['keywords']}")


if __name__ == "__main__":
    test_recommendation_algorithm() 