"""
查找算法模块
实现多种查找策略，包括精确查找、模糊查找和全文检索
"""

import re
from typing import List, Dict, Any, Optional, Set
from collections import defaultdict
import time


class SearchAlgorithm:
    """查找算法类，支持多种查找策略"""
    
    # 添加类级别的哈希表缓存
    _diary_title_hash_cache = {}
    _diary_title_cache_timestamp = 0
    
    @staticmethod
    def binary_search(sorted_data: List[Dict], target_value: Any, key_func) -> Optional[Dict]:
        """
        二分查找算法（适用于已排序数据）
        
        Args:
            sorted_data: 已排序的数据列表
            target_value: 目标值
            key_func: 获取比较键的函数
            
        Returns:
            找到的数据项，如果未找到返回None
        """
        left, right = 0, len(sorted_data) - 1
        
        while left <= right:
            mid = (left + right) // 2
            mid_value = key_func(sorted_data[mid])
            
            if mid_value == target_value:
                return sorted_data[mid]
            elif mid_value < target_value:
                left = mid + 1
            else:
                right = mid - 1
        
        return None
    
    @staticmethod
    def linear_search(data: List[Dict], target_value: Any, key_func) -> List[Dict]:
        """
        线性查找算法
        
        Args:
            data: 数据列表
            target_value: 目标值
            key_func: 获取比较键的函数
            
        Returns:
            匹配的数据项列表
        """
        results = []
        for item in data:
            if key_func(item) == target_value:
                results.append(item)
        return results
    
    @staticmethod
    def fuzzy_search(data: List[Dict], query: str, search_fields: List[str], 
                    threshold: float = 0.3) -> List[Dict]:
        """
        模糊查找算法
        
        Args:
            data: 数据列表
            query: 查询字符串
            search_fields: 要搜索的字段列表
            threshold: 相似度阈值
            
        Returns:
            匹配的数据项列表，按相似度排序
        """
        def calculate_similarity(text1: str, text2: str) -> float:
            """计算两个字符串的相似度（简化版Jaccard相似度）"""
            if not text1 or not text2:
                return 0.0
            
            text1 = text1.lower()
            text2 = text2.lower()
            
            # 字符级别的Jaccard相似度
            set1 = set(text1)
            set2 = set(text2)
            intersection = len(set1.intersection(set2))
            union = len(set1.union(set2))
            
            if union == 0:
                return 0.0
            
            return intersection / union
        
        results = []
        query_lower = query.lower()
        
        for item in data:
            max_similarity = 0.0
            
            for field in search_fields:
                field_value = str(item.get(field, ''))
                
                # 直接包含匹配
                if query_lower in field_value.lower():
                    max_similarity = max(max_similarity, 0.9)
                
                # 相似度匹配
                similarity = calculate_similarity(query_lower, field_value)
                max_similarity = max(max_similarity, similarity)
                
                # 关键词匹配（如果字段是列表）
                if isinstance(item.get(field), list):
                    for keyword in item.get(field, []):
                        if query_lower in str(keyword).lower():
                            max_similarity = max(max_similarity, 0.8)
            
            if max_similarity >= threshold:
                results.append((item, max_similarity))
        
        # 按相似度排序
        results.sort(key=lambda x: x[1], reverse=True)
        return [item for item, _ in results]
    
    @staticmethod
    def keyword_search(data: List[Dict], keywords: List[str], search_fields: List[str]) -> List[Dict]:
        """
        关键词查找算法
        
        Args:
            data: 数据列表
            keywords: 关键词列表
            search_fields: 要搜索的字段列表
            
        Returns:
            匹配的数据项列表
        """
        results = []
        keywords_lower = [kw.lower() for kw in keywords]
        
        for item in data:
            match_count = 0
            
            for field in search_fields:
                field_value = str(item.get(field, '')).lower()
                
                # 检查字段值中是否包含关键词
                for keyword in keywords_lower:
                    if keyword in field_value:
                        match_count += 1
                
                # 如果字段是列表，检查列表中的每个元素
                if isinstance(item.get(field), list):
                    for list_item in item.get(field, []):
                        list_item_lower = str(list_item).lower()
                        for keyword in keywords_lower:
                            if keyword in list_item_lower:
                                match_count += 1
            
            if match_count > 0:
                results.append((item, match_count))
        
        # 按匹配数量排序
        results.sort(key=lambda x: x[1], reverse=True)
        return [item for item, _ in results]
    
    @staticmethod
    def full_text_search(data: List[Dict], query: str, content_field: str = 'content') -> List[Dict]:
        """
        全文检索算法
        
        Args:
            data: 数据列表
            query: 查询字符串
            content_field: 内容字段名
            
        Returns:
            匹配的数据项列表，按相关性排序
        """
        def tokenize(text: str) -> List[str]:
            """文本分词（简化版）"""
            # 移除标点符号，分割成词
            text = re.sub(r'[^\w\s]', ' ', text.lower())
            return [word for word in text.split() if len(word) > 1]
        
        def calculate_tf_idf(query_tokens: List[str], doc_tokens: List[str], 
                           all_docs_tokens: List[List[str]]) -> float:
            """计算TF-IDF相关性分数"""
            if not query_tokens or not doc_tokens:
                return 0.0
            
            # 计算词频(TF)
            doc_token_count = len(doc_tokens)
            tf_scores = {}
            for token in query_tokens:
                tf = doc_tokens.count(token) / doc_token_count if doc_token_count > 0 else 0
                tf_scores[token] = tf
            
            # 计算逆文档频率(IDF)
            total_docs = len(all_docs_tokens)
            idf_scores = {}
            for token in query_tokens:
                docs_containing_token = sum(1 for doc in all_docs_tokens if token in doc)
                idf = total_docs / (docs_containing_token + 1)  # +1 避免除零
                idf_scores[token] = idf
            
            # 计算TF-IDF分数
            tfidf_score = sum(tf_scores[token] * idf_scores[token] for token in query_tokens)
            return tfidf_score
        
        query_tokens = tokenize(query)
        if not query_tokens:
            return []
        
        # 预处理所有文档
        all_docs_tokens = []
        doc_items = []
        
        for item in data:
            content = str(item.get(content_field, ''))
            doc_tokens = tokenize(content)
            all_docs_tokens.append(doc_tokens)
            doc_items.append(item)
        
        # 计算每个文档的相关性分数
        results = []
        for i, doc_tokens in enumerate(all_docs_tokens):
            score = calculate_tf_idf(query_tokens, doc_tokens, all_docs_tokens)
            if score > 0:
                results.append((doc_items[i], score))
        
        # 按相关性分数排序
        results.sort(key=lambda x: x[1], reverse=True)
        return [item for item, _ in results]
    
    @staticmethod
    def binary_search_exact(data: List[Dict], target_value: Any, key_func) -> List[Dict]:
        """
        二分查找算法用于精准搜索（返回所有匹配项）
        
        Args:
            data: 数据列表（会自动排序）
            target_value: 目标值
            key_func: 获取比较键的函数
            
        Returns:
            所有匹配的数据项列表
        """
        # 首先对数据进行排序
        sorted_data = sorted(data, key=key_func)
        
        # 使用二分查找找到第一个匹配项
        left, right = 0, len(sorted_data) - 1
        first_match = -1
        
        while left <= right:
            mid = (left + right) // 2
            mid_value = key_func(sorted_data[mid])
            
            if mid_value == target_value:
                first_match = mid
                right = mid - 1  # 继续向左查找第一个匹配项
            elif mid_value < target_value:
                left = mid + 1
            else:
                right = mid - 1
        
        if first_match == -1:
            return []  # 没有找到匹配项
        
        # 收集所有匹配项
        results = []
        i = first_match
        while i < len(sorted_data) and key_func(sorted_data[i]) == target_value:
            results.append(sorted_data[i])
            i += 1
        
        return results
    
    @staticmethod
    def search_places(places: List[Dict], query: str, search_type: str = 'fuzzy') -> List[Dict]:
        """
        场所搜索
        
        Args:
            places: 场所列表
            query: 查询字符串
            search_type: 搜索类型 ('exact', 'fuzzy', 'keyword')
            
        Returns:
            匹配的场所列表
        """
        search_fields = ['name', 'keywords', 'type', 'description']
        
        if search_type == 'exact':
            # 使用二分搜索进行精准搜索
            return SearchAlgorithm.binary_search_exact(places, query, lambda x: x.get('name', ''))
        elif search_type == 'fuzzy':
            return SearchAlgorithm.fuzzy_search(places, query, search_fields)
        elif search_type == 'keyword':
            keywords = query.split()
            return SearchAlgorithm.keyword_search(places, keywords, search_fields)
        else:
            return []
    
    @staticmethod
    def search_buildings(buildings: List[Dict], query: str, place_id: str = None) -> List[Dict]:
        """
        建筑物搜索
        
        Args:
            buildings: 建筑物列表
            query: 查询字符串
            place_id: 场所ID，用于筛选
            
        Returns:
            匹配的建筑物列表
        """
        # 如果指定了场所ID，先筛选
        if place_id:
            buildings = [b for b in buildings if b.get('placeId') == place_id]
        
        search_fields = ['name', 'type', 'description']
        return SearchAlgorithm.fuzzy_search(buildings, query, search_fields)
    
    @staticmethod
    def search_facilities(facilities: List[Dict], query: str, place_id: str = None, 
                         facility_type: str = None) -> List[Dict]:
        """
        设施搜索
        
        Args:
            facilities: 设施列表
            query: 查询字符串
            place_id: 场所ID，用于筛选
            facility_type: 设施类型，用于筛选
            
        Returns:
            匹配的设施列表
        """
        # 筛选条件
        filtered_facilities = facilities
        
        if place_id:
            filtered_facilities = [f for f in filtered_facilities if f.get('placeId') == place_id]
        
        if facility_type:
            filtered_facilities = [f for f in filtered_facilities if f.get('type') == facility_type]
        
        if not query:
            return filtered_facilities
        
        search_fields = ['name', 'type', 'description']
        return SearchAlgorithm.fuzzy_search(filtered_facilities, query, search_fields)
    
    @staticmethod
    def search_diaries(diaries: List[Dict], query: str, search_type: str = 'fulltext') -> List[Dict]:
        """
        搜索日记
        
        Args:
            diaries: 日记列表
            query: 查询字符串
            search_type: 搜索类型
            
        Returns:
            匹配的日记列表
        """
        if search_type == 'fulltext':
            return SearchAlgorithm.full_text_search(diaries, query, 'content')
        else:
            return SearchAlgorithm.fuzzy_search(diaries, query, ['title', 'content', 'tags'])

    @staticmethod
    def hash_search_facility_categories(input_text: str, categories: List[str]) -> Dict[str, Any]:
        """
        使用哈希查找算法搜索设施类型
        
        Args:
            input_text: 用户输入的文本
            categories: 设施类别列表
            
        Returns:
            搜索结果字典
        """
        if not input_text or not input_text.strip():
            return {
                'success': True,
                'input': input_text,
                'matches': [],
                'matched_categories': [],
                'suggestion': '请输入设施类型关键词',
                'available_categories': categories,
                'total_matches': 0
            }
        
        input_text = input_text.strip()
        
        # 构建哈希表用于快速查找（不转换大小写，保持中文原样）
        # 1. 完全匹配哈希表
        exact_match_hash = {}
        for category in categories:
            exact_match_hash[category] = category
        
        # 2. 前缀匹配哈希表
        prefix_match_hash = defaultdict(list)
        for category in categories:
            for i in range(1, len(category) + 1):
                prefix = category[:i]
                prefix_match_hash[prefix].append(category)
        
        # 3. 子串匹配哈希表（用于部分匹配）
        substring_match_hash = defaultdict(list)
        for category in categories:
            for i in range(len(category)):
                for j in range(i + 1, len(category) + 1):
                    substring = category[i:j]
                    if len(substring) >= 1:  # 至少1个字符
                        substring_match_hash[substring].append(category)
        
        matches = []
        matched_categories = []
        
        # 1. 检查完全匹配（最高优先级）
        if input_text in exact_match_hash:
            category = exact_match_hash[input_text]
            matches.append({
                'category': category,
                'match_type': 'exact',
                'is_exact_match': True,
                'is_prefix_match': True,
                'match_ratio': 1.0,
                'priority': 1
            })
            matched_categories.append(category)
        
        # 2. 检查前缀匹配（次高优先级）
        elif input_text in prefix_match_hash:
            for category in prefix_match_hash[input_text]:
                if category not in matched_categories:  # 避免重复
                    matches.append({
                        'category': category,
                        'match_type': 'prefix',
                        'is_exact_match': False,
                        'is_prefix_match': True,
                        'match_ratio': len(input_text) / len(category),
                        'priority': 2
                    })
                    matched_categories.append(category)
        
        # 3. 检查部分匹配（最低优先级）
        else:
            if input_text in substring_match_hash:
                for category in substring_match_hash[input_text]:
                    if category not in matched_categories:  # 避免重复
                        matches.append({
                            'category': category,
                            'match_type': 'substring',
                            'is_exact_match': False,
                            'is_prefix_match': False,
                            'match_ratio': len(input_text) / len(category),
                            'priority': 3
                        })
                        matched_categories.append(category)
        
        # 按优先级和匹配比例排序
        matches.sort(key=lambda x: (x['priority'], -x['match_ratio']))
        
        # 生成建议信息
        suggestion = SearchAlgorithm._generate_facility_search_suggestion(input_text, matches, categories)
        
        return {
            'success': True,
            'input': input_text,
            'matches': matches,
            'matched_categories': matched_categories,
            'suggestion': suggestion,
            'available_categories': categories,
            'total_matches': len(matches)
        }
    
    @staticmethod
    def _generate_facility_search_suggestion(input_text: str, matches: List[Dict], categories: List[str]) -> str:
        """生成设施搜索建议"""
        if not matches:
            return f"未找到包含'{input_text}'的设施类型，可用类型：{', '.join(categories)}"
        
        if len(matches) == 1:
            match = matches[0]
            if match['is_exact_match']:
                return f"找到完全匹配：{match['category']}"
            elif match['is_prefix_match']:
                return f"找到前缀匹配：{match['category']}"
            else:
                return f"找到部分匹配：{match['category']}"
        
        exact_matches = [m['category'] for m in matches if m['is_exact_match']]
        if exact_matches:
            return f"找到完全匹配：{', '.join(exact_matches)}"
        
        prefix_matches = [m['category'] for m in matches if m['is_prefix_match']]
        if prefix_matches:
            return f"找到前缀匹配：{', '.join(prefix_matches[:3])}{'等' if len(prefix_matches) > 3 else ''}"
        
        return f"找到部分匹配：{', '.join([m['category'] for m in matches[:3]])}{'等' if len(matches) > 3 else ''}"

    @staticmethod
    def build_diary_title_hash_index(diaries: List[Dict]) -> Dict[str, List[Dict]]:
        """
        构建日记标题的哈希索引表，实现O(1)查找
        
        Args:
            diaries: 日记列表
            
        Returns:
            哈希索引表，键为标题，值为匹配的日记列表
        """
        hash_index = {}
        
        for diary in diaries:
            title = diary.get('title', '').strip()
            if title:
                # 使用标题作为键，支持一个标题对应多个日记的情况
                if title not in hash_index:
                    hash_index[title] = []
                hash_index[title].append(diary)
        
        return hash_index
    
    @staticmethod
    def search_diary_by_title_hash(diaries: List[Dict], target_title: str, 
                                  use_cache: bool = True) -> List[Dict]:
        """
        使用哈希表进行日记标题精准查找，时间复杂度O(1)
        
        Args:
            diaries: 日记列表
            target_title: 目标标题
            use_cache: 是否使用缓存
            
        Returns:
            匹配的日记列表
        """
        import time
        
        target_title = target_title.strip()
        if not target_title:
            return []
        
        current_time = time.time()
        
        # 检查是否需要重建缓存（缓存有效期5分钟）
        if (use_cache and 
            SearchAlgorithm._diary_title_hash_cache and 
            current_time - SearchAlgorithm._diary_title_cache_timestamp < 300):
            
            # 使用缓存进行O(1)查找
            hash_index = SearchAlgorithm._diary_title_hash_cache
        else:
            # 重建哈希索引
            hash_index = SearchAlgorithm.build_diary_title_hash_index(diaries)
            
            # 更新缓存
            if use_cache:
                SearchAlgorithm._diary_title_hash_cache = hash_index
                SearchAlgorithm._diary_title_cache_timestamp = current_time
        
        # O(1)时间复杂度查找
        return hash_index.get(target_title, [])
    
    @staticmethod
    def search_diary_by_title_hash_fuzzy(diaries: List[Dict], target_title: str, 
                                        use_cache: bool = True) -> List[Dict]:
        """
        使用哈希表进行日记标题模糊查找，支持部分匹配
        
        Args:
            diaries: 日记列表
            target_title: 目标标题
            use_cache: 是否使用缓存
            
        Returns:
            匹配的日记列表，按匹配度排序
        """
        import time
        
        target_title = target_title.strip()
        if not target_title:
            return []
        
        current_time = time.time()
        
        # 检查是否需要重建缓存
        if (use_cache and 
            SearchAlgorithm._diary_title_hash_cache and 
            current_time - SearchAlgorithm._diary_title_cache_timestamp < 300):
            
            hash_index = SearchAlgorithm._diary_title_hash_cache
        else:
            hash_index = SearchAlgorithm.build_diary_title_hash_index(diaries)
            
            if use_cache:
                SearchAlgorithm._diary_title_hash_cache = hash_index
                SearchAlgorithm._diary_title_cache_timestamp = current_time
        
        results = []
        target_lower = target_title.lower()
        
        # 遍历哈希表进行模糊匹配
        for title, diary_list in hash_index.items():
            title_lower = title.lower()
            
            # 计算匹配度
            match_score = 0
            
            # 完全匹配
            if title_lower == target_lower:
                match_score = 1.0
            # 包含匹配
            elif target_lower in title_lower:
                match_score = 0.8
            elif title_lower in target_lower:
                match_score = 0.6
            # 部分字符匹配
            else:
                common_chars = set(title_lower) & set(target_lower)
                if common_chars:
                    match_score = len(common_chars) / max(len(title_lower), len(target_lower))
            
            # 如果匹配度足够高，添加到结果中
            if match_score > 0.3:
                for diary in diary_list:
                    results.append((diary, match_score))
        
        # 按匹配度排序
        results.sort(key=lambda x: x[1], reverse=True)
        return [diary for diary, _ in results]
    
    @staticmethod
    def clear_diary_title_cache():
        """清除日记标题哈希缓存"""
        SearchAlgorithm._diary_title_hash_cache = {}
        SearchAlgorithm._diary_title_cache_timestamp = 0


# 建立索引类，用于优化查找性能
class SearchIndex:
    """搜索索引类，用于优化查找性能"""
    
    def __init__(self):
        self.indexes = defaultdict(dict)
    
    def build_index(self, data: List[Dict], index_name: str, key_func):
        """
        构建索引
        
        Args:
            data: 数据列表
            index_name: 索引名称
            key_func: 获取索引键的函数
        """
        index = defaultdict(list)
        for item in data:
            key = key_func(item)
            if isinstance(key, list):
                for k in key:
                    index[str(k).lower()].append(item)
            else:
                index[str(key).lower()].append(item)
        
        self.indexes[index_name] = index
    
    def search_by_index(self, index_name: str, query: str) -> List[Dict]:
        """
        使用索引进行查找
        
        Args:
            index_name: 索引名称
            query: 查询字符串
            
        Returns:
            匹配的数据项列表
        """
        if index_name not in self.indexes:
            return []
        
        index = self.indexes[index_name]
        query_lower = query.lower()
        
        # 精确匹配
        if query_lower in index:
            return index[query_lower]
        
        # 模糊匹配
        results = []
        for key, items in index.items():
            if query_lower in key:
                results.extend(items)
        
        return results


# 测试函数
def test_search_algorithms():
    """测试搜索算法"""
    # 测试数据
    test_places = [
        {"id": "1", "name": "西湖风景区", "type": "景区", "keywords": ["自然", "风景", "湖泊"], 
         "description": "美丽的西湖风景"},
        {"id": "2", "name": "故宫博物院", "type": "景区", "keywords": ["历史", "文化", "古建筑"], 
         "description": "中国古代皇宫"},
        {"id": "3", "name": "清华大学", "type": "校园", "keywords": ["教育", "科技", "学术"], 
         "description": "著名高等学府"},
        {"id": "4", "name": "西湖公园", "type": "公园", "keywords": ["休闲", "娱乐"], 
         "description": "城市公园"},
        {"id": "5", "name": "西湖博物馆", "type": "博物馆", "keywords": ["文化", "展览"], 
         "description": "西湖历史文化博物馆"},
    ]
    
    # 测试精准搜索 - 线性搜索 vs 二分搜索
    print("=== 精准搜索测试 ===")
    
    # 线性搜索
    start_time = time.time()
    linear_results = SearchAlgorithm.linear_search(test_places, "西湖风景区", lambda x: x.get('name', ''))
    linear_time = time.time() - start_time
    
    # 二分搜索
    start_time = time.time()
    binary_results = SearchAlgorithm.binary_search_exact(test_places, "西湖风景区", lambda x: x.get('name', ''))
    binary_time = time.time() - start_time
    
    print(f"线性搜索结果: {len(linear_results)} 个匹配项，耗时: {linear_time:.6f}秒")
    for place in linear_results:
        print(f"  - {place['name']}")
    
    print(f"二分搜索结果: {len(binary_results)} 个匹配项，耗时: {binary_time:.6f}秒")
    for place in binary_results:
        print(f"  - {place['name']}")
    
    # 测试模糊搜索
    print("\n=== 模糊搜索测试 ===")
    results = SearchAlgorithm.search_places(test_places, "西湖", "fuzzy")
    print("模糊搜索'西湖'结果:")
    for place in results:
        print(f"- {place['name']}: {place['type']}")
    
    # 测试关键词搜索
    print("\n=== 关键词搜索测试 ===")
    results = SearchAlgorithm.search_places(test_places, "历史 文化", "keyword")
    print("关键词搜索'历史 文化'结果:")
    for place in results:
        print(f"- {place['name']}: {place['keywords']}")
    
    # 测试精准搜索（使用新的二分搜索）
    print("\n=== 精准搜索测试（二分搜索） ===")
    results = SearchAlgorithm.search_places(test_places, "西湖风景区", "exact")
    print("精准搜索'西湖风景区'结果:")
    for place in results:
        print(f"- {place['name']}: {place['type']}")


def performance_test():
    """性能测试：比较线性搜索和二分搜索的性能"""
    import time
    import random
    
    # 生成大量测试数据
    test_data = []
    for i in range(10000):
        test_data.append({
            "id": str(i),
            "name": f"景点{i:04d}",
            "type": "景区",
            "keywords": ["旅游", "风景"],
            "description": f"这是第{i}个景点"
        })
    
    # 随机选择一个目标进行搜索
    target_name = "景点5000"
    
    print("=== 性能测试（10000条数据） ===")
    print(f"搜索目标: {target_name}")
    
    # 线性搜索性能测试
    start_time = time.time()
    for _ in range(100):  # 重复100次测试
        linear_results = SearchAlgorithm.linear_search(test_data, target_name, lambda x: x.get('name', ''))
    linear_time = time.time() - start_time
    
    # 二分搜索性能测试
    start_time = time.time()
    for _ in range(100):  # 重复100次测试
        binary_results = SearchAlgorithm.binary_search_exact(test_data, target_name, lambda x: x.get('name', ''))
    binary_time = time.time() - start_time
    
    print(f"线性搜索: 100次搜索总耗时 {linear_time:.6f}秒，平均每次 {linear_time/100:.6f}秒")
    print(f"二分搜索: 100次搜索总耗时 {binary_time:.6f}秒，平均每次 {binary_time/100:.6f}秒")
    print(f"性能提升: {linear_time/binary_time:.2f}倍")
    
    # 验证结果一致性
    linear_result = SearchAlgorithm.linear_search(test_data, target_name, lambda x: x.get('name', ''))
    binary_result = SearchAlgorithm.binary_search_exact(test_data, target_name, lambda x: x.get('name', ''))
    
    print(f"线性搜索找到: {len(linear_result)} 个结果")
    print(f"二分搜索找到: {len(binary_result)} 个结果")
    print(f"结果一致性: {'✓' if len(linear_result) == len(binary_result) else '✗'}")


class FacilityCategoryMatcher:
    """设施类别匹配器（使用哈希查找算法）"""
    
    # 预定义的设施类别
    FACILITY_CATEGORIES = [
        '商店', '饭店', '洗手间', '图书馆', '食堂', 
        '超市', '咖啡馆', '公交站', '服务中心', '其他'
    ]
    
    def __init__(self):
        self.search_algo = SearchAlgorithm()
    
    def search_categories(self, input_text: str) -> Dict[str, Any]:
        """
        搜索匹配的设施类别
        
        Args:
            input_text: 用户输入的文本
            
        Returns:
            搜索结果字典
        """
        return self.search_algo.hash_search_facility_categories(input_text, self.FACILITY_CATEGORIES)


if __name__ == "__main__":
    test_search_algorithms()
    print("\n" + "="*50)
    performance_test() 