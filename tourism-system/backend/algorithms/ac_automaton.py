#!/usr/bin/env python3
"""
AC自动机 (Aho-Corasick Automaton) 实现
用于多模式字符串匹配，在文本中同时搜索多个模式串

时间复杂度:
- 构建: O(∑|pattern|) 其中∑|pattern|是所有模式串长度之和
- 搜索: O(n + m) 其中n是文本长度，m是匹配结果数量

应用场景:
- 敏感词过滤
- 病毒特征码检测
- 文本搜索引擎
- 生物信息学中的序列匹配
"""

from collections import deque, defaultdict
from typing import List, Dict, Set, Tuple, Optional


class ACNode:
    """AC自动机节点"""
    
    def __init__(self):
        self.children: Dict[str, 'ACNode'] = {}  # 子节点
        self.fail: Optional['ACNode'] = None     # 失败指针
        self.output: Set[str] = set()            # 输出集合（匹配的模式串）
        self.is_end = False                      # 是否为模式串结尾
    
    def __repr__(self):
        return f"ACNode(children={list(self.children.keys())}, output={self.output})"


class ACAutomaton:
    """AC自动机实现"""
    
    def __init__(self):
        self.root = ACNode()
        self.patterns: Set[str] = set()
    
    def add_pattern(self, pattern: str):
        """
        添加模式串到Trie树
        
        Args:
            pattern: 要添加的模式串
        """
        if not pattern:
            return
        
        self.patterns.add(pattern)
        node = self.root
        
        # 构建Trie树
        for char in pattern:
            if char not in node.children:
                node.children[char] = ACNode()
            node = node.children[char]
        
        node.is_end = True
        node.output.add(pattern)
    
    def build_failure_links(self):
        """
        构建失败指针（KMP算法的扩展）
        使用BFS遍历构建fail指针
        """
        queue = deque()
        
        # 第一层节点的fail指针指向root
        for child in self.root.children.values():
            child.fail = self.root
            queue.append(child)
        
        # BFS构建fail指针
        while queue:
            current = queue.popleft()
            
            for char, child in current.children.items():
                queue.append(child)
                
                # 寻找最长的真后缀，使其也是某个模式串的前缀
                fail_node = current.fail
                while fail_node is not None and char not in fail_node.children:
                    fail_node = fail_node.fail
                
                if fail_node is not None:
                    child.fail = fail_node.children[char]
                else:
                    child.fail = self.root
                
                # 合并输出集合
                child.output.update(child.fail.output)
    
    def build(self, patterns: List[str]):
        """
        构建AC自动机
        
        Args:
            patterns: 模式串列表
        """
        # 清空之前的数据
        self.root = ACNode()
        self.patterns.clear()
        
        # 添加所有模式串
        for pattern in patterns:
            self.add_pattern(pattern)
        
        # 构建失败指针
        self.build_failure_links()
    
    def search(self, text: str) -> List[Tuple[int, str]]:
        """
        在文本中搜索所有模式串
        
        Args:
            text: 要搜索的文本
            
        Returns:
            匹配结果列表，每个元素为(位置, 模式串)
        """
        results = []
        node = self.root
        
        for i, char in enumerate(text):
            # 沿着fail指针寻找匹配
            while node is not None and char not in node.children:
                node = node.fail
            
            if node is None:
                node = self.root
                continue
            
            node = node.children[char]
            
            # 检查是否有匹配的模式串
            for pattern in node.output:
                start_pos = i - len(pattern) + 1
                results.append((start_pos, pattern))
        
        return results
    
    def search_with_details(self, text: str) -> Dict:
        """
        详细搜索，返回更多信息
        
        Args:
            text: 要搜索的文本
            
        Returns:
            包含匹配详情的字典
        """
        matches = self.search(text)
        
        # 按模式串分组
        pattern_matches = defaultdict(list)
        for pos, pattern in matches:
            pattern_matches[pattern].append(pos)
        
        # 统计信息
        total_matches = len(matches)
        unique_patterns = len(pattern_matches)
        
        return {
            'matches': matches,
            'pattern_matches': dict(pattern_matches),
            'total_matches': total_matches,
            'unique_patterns': unique_patterns,
            'text_length': len(text)
        }
    
    def replace_patterns(self, text: str, replacement: str = "*") -> str:
        """
        替换文本中的所有模式串
        
        Args:
            text: 原始文本
            replacement: 替换字符
            
        Returns:
            替换后的文本
        """
        matches = self.search(text)
        
        # 按位置排序，从后往前替换避免位置偏移
        matches.sort(key=lambda x: x[0], reverse=True)
        
        result = list(text)
        for pos, pattern in matches:
            # 替换匹配的模式串
            for i in range(len(pattern)):
                if pos + i < len(result):
                    result[pos + i] = replacement
        
        return ''.join(result)
    
    def filter_text(self, text: str) -> Tuple[str, List[str]]:
        """
        过滤文本中的敏感词
        
        Args:
            text: 原始文本
            
        Returns:
            (过滤后的文本, 检测到的敏感词列表)
        """
        matches = self.search(text)
        detected_words = list(set(pattern for _, pattern in matches))
        filtered_text = self.replace_patterns(text, "*")
        
        return filtered_text, detected_words
    
    def get_statistics(self) -> Dict:
        """获取AC自动机的统计信息"""
        def count_nodes(node):
            count = 1
            for child in node.children.values():
                count += count_nodes(child)
            return count
        
        total_nodes = count_nodes(self.root)
        
        return {
            'total_patterns': len(self.patterns),
            'total_nodes': total_nodes,
            'max_pattern_length': max(len(p) for p in self.patterns) if self.patterns else 0,
            'min_pattern_length': min(len(p) for p in self.patterns) if self.patterns else 0,
            'avg_pattern_length': sum(len(p) for p in self.patterns) / len(self.patterns) if self.patterns else 0
        }
    
    def visualize_trie(self, max_depth: int = 3):
        """
        可视化Trie树结构（用于调试）
        
        Args:
            max_depth: 最大显示深度
        """
        def dfs(node, prefix, depth):
            if depth > max_depth:
                return
            
            if node.output:
                print(f"{'  ' * depth}{prefix} -> {node.output}")
            elif prefix:
                print(f"{'  ' * depth}{prefix}")
            
            for char, child in sorted(node.children.items()):
                dfs(child, prefix + char, depth + 1)
        
        print("Trie树结构:")
        dfs(self.root, "", 0)


def test_ac_automaton():
    """测试AC自动机基本功能"""
    print("🤖 AC自动机基本功能测试")
    print("=" * 50)
    
    # 创建AC自动机
    ac = ACAutomaton()
    
    # 测试模式串
    patterns = ["he", "she", "his", "hers", "her"]
    print(f"模式串: {patterns}")
    
    # 构建AC自动机
    ac.build(patterns)
    
    # 测试文本
    text = "ushers"
    print(f"测试文本: '{text}'")
    
    # 搜索匹配
    matches = ac.search(text)
    print(f"匹配结果: {matches}")
    
    # 详细搜索
    details = ac.search_with_details(text)
    print(f"详细结果:")
    print(f"  总匹配数: {details['total_matches']}")
    print(f"  匹配模式数: {details['unique_patterns']}")
    print(f"  按模式分组: {details['pattern_matches']}")
    
    # 统计信息
    stats = ac.get_statistics()
    print(f"AC自动机统计:")
    for key, value in stats.items():
        print(f"  {key}: {value}")


def test_sensitive_word_filter():
    """测试敏感词过滤功能"""
    print("\n🚫 敏感词过滤测试")
    print("=" * 50)
    
    # 敏感词列表
    sensitive_words = [
        "垃圾", "废物", "笨蛋", "傻瓜", 
        "damn", "shit", "fuck", "stupid"
    ]
    
    # 创建AC自动机
    filter_ac = ACAutomaton()
    filter_ac.build(sensitive_words)
    
    # 测试文本
    test_texts = [
        "这个产品真是垃圾，完全是废物！",
        "Don't be so stupid, damn it!",
        "你这个笨蛋，真是个傻瓜！",
        "This is a normal sentence without bad words.",
        "混合语言测试：This shit is 垃圾!"
    ]
    
    print(f"敏感词库: {sensitive_words}")
    print()
    
    for i, text in enumerate(test_texts, 1):
        print(f"测试 {i}: {text}")
        
        # 检测敏感词
        matches = filter_ac.search(text)
        filtered_text, detected = filter_ac.filter_text(text)
        
        print(f"  检测到: {detected}")
        print(f"  过滤后: {filtered_text}")
        print(f"  匹配详情: {matches}")
        print()


def test_dna_sequence_matching():
    """测试DNA序列匹配"""
    print("🧬 DNA序列匹配测试")
    print("=" * 50)
    
    # DNA模式序列
    dna_patterns = [
        "ATCG",    # 基本序列
        "GCTA",    # 反向序列
        "AAAA",    # 重复序列
        "TTTT",    # 另一个重复序列
        "CGCG",    # 交替序列
    ]
    
    # 创建AC自动机
    dna_ac = ACAutomaton()
    dna_ac.build(dna_patterns)
    
    # 测试DNA序列
    dna_sequence = "ATCGATCGAAAAAATTTTCGCGCGCGTACGATCG"
    
    print(f"DNA模式: {dna_patterns}")
    print(f"DNA序列: {dna_sequence}")
    print(f"序列长度: {len(dna_sequence)}")
    
    # 搜索匹配
    matches = dna_ac.search(dna_sequence)
    details = dna_ac.search_with_details(dna_sequence)
    
    print(f"\n匹配结果:")
    for pos, pattern in matches:
        print(f"  位置 {pos:2d}: {pattern}")
    
    print(f"\n统计信息:")
    print(f"  总匹配数: {details['total_matches']}")
    print(f"  匹配的模式数: {details['unique_patterns']}")
    
    # 显示匹配位置
    print(f"\n序列标注:")
    print(f"序列: {dna_sequence}")
    
    # 创建标注字符串
    annotation = [' '] * len(dna_sequence)
    for i, (pos, pattern) in enumerate(matches):
        marker = str(i % 10)
        for j in range(len(pattern)):
            if pos + j < len(annotation):
                annotation[pos + j] = marker
    
    print(f"标注: {''.join(annotation)}")


def test_performance():
    """性能测试"""
    print("\n⚡ AC自动机性能测试")
    print("=" * 50)
    
    import time
    import random
    import string
    
    # 生成随机模式串
    def generate_patterns(count: int, min_len: int = 3, max_len: int = 8) -> List[str]:
        patterns = set()
        while len(patterns) < count:
            length = random.randint(min_len, max_len)
            pattern = ''.join(random.choices(string.ascii_lowercase, k=length))
            patterns.add(pattern)
        return list(patterns)
    
    # 生成随机文本
    def generate_text(length: int) -> str:
        return ''.join(random.choices(string.ascii_lowercase, k=length))
    
    # 测试不同规模
    test_configs = [
        {"patterns": 100, "text_len": 10000, "desc": "小规模"},
        {"patterns": 500, "text_len": 50000, "desc": "中等规模"},
        {"patterns": 1000, "text_len": 100000, "desc": "大规模"},
    ]
    
    for config in test_configs:
        pattern_count = config["patterns"]
        text_length = config["text_len"]
        desc = config["desc"]
        
        print(f"{desc}测试 ({pattern_count}个模式, {text_length}字符文本):")
        
        # 生成测试数据
        patterns = generate_patterns(pattern_count)
        text = generate_text(text_length)
        
        # 构建AC自动机
        ac = ACAutomaton()
        
        start_time = time.time()
        ac.build(patterns)
        build_time = time.time() - start_time
        
        # 搜索测试
        start_time = time.time()
        matches = ac.search(text)
        search_time = time.time() - start_time
        
        print(f"  构建时间: {build_time:.6f}s")
        print(f"  搜索时间: {search_time:.6f}s")
        print(f"  匹配数量: {len(matches)}")
        print(f"  搜索速度: {text_length/search_time:.0f} 字符/秒")
        
        # 与朴素算法对比
        start_time = time.time()
        naive_matches = 0
        for pattern in patterns:
            pos = 0
            while pos < len(text):
                pos = text.find(pattern, pos)
                if pos == -1:
                    break
                naive_matches += 1
                pos += 1
        naive_time = time.time() - start_time
        
        speedup = naive_time / search_time if search_time > 0 else float('inf')
        print(f"  朴素算法时间: {naive_time:.6f}s")
        print(f"  性能提升: {speedup:.2f}x")
        print()


def test_overlapping_patterns():
    """测试重叠模式匹配"""
    print("🔄 重叠模式匹配测试")
    print("=" * 50)
    
    # 重叠模式
    patterns = ["aa", "aaa", "aaaa"]
    text = "aaaaa"
    
    ac = ACAutomaton()
    ac.build(patterns)
    
    print(f"模式串: {patterns}")
    print(f"文本: {text}")
    
    matches = ac.search(text)
    print(f"匹配结果: {matches}")
    
    # 可视化匹配
    print("\n匹配可视化:")
    print(f"文本: {text}")
    for pos, pattern in matches:
        spaces = ' ' * pos
        print(f"      {spaces}{pattern} (位置 {pos})")


def main():
    """主测试函数"""
    print("🤖 AC自动机 (Aho-Corasick Automaton) 测试")
    print("=" * 60)
    
    # 1. 基本功能测试
    test_ac_automaton()
    
    # 2. 敏感词过滤测试
    test_sensitive_word_filter()
    
    # 3. DNA序列匹配测试
    test_dna_sequence_matching()
    
    # 4. 重叠模式测试
    test_overlapping_patterns()
    
    # 5. 性能测试
    test_performance()
    
    print("\n✅ AC自动机测试完成！")
    print("\n🎯 AC自动机特点:")
    print("  ✅ 多模式串同时匹配")
    print("  ✅ 线性时间复杂度 O(n+m)")
    print("  ✅ 支持重叠匹配")
    print("  ✅ 适用于敏感词过滤")
    print("  ✅ 适用于生物信息学")
    print("  ✅ 适用于网络入侵检测")


if __name__ == "__main__":
    main() 