#!/usr/bin/env python3
"""
Huffman压缩算法性能对比测试
比较原版实现和优化版实现的性能差异
"""

import time
import sys
import os
import random
import string
from typing import List, Dict, Tuple
import matplotlib.pyplot as plt
import pandas as pd

# 添加路径以导入模块
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from huffman_compression import DiaryCompressionManager as OriginalManager
from huffman_compression_optimized import OptimizedDiaryCompressionManager as OptimizedManager


class PerformanceTestSuite:
    """性能测试套件"""
    
    def __init__(self):
        self.original_manager = OriginalManager()
        self.optimized_manager = OptimizedManager(enable_parallel=True)
        self.test_results = []
    
    def generate_test_data(self) -> List[Tuple[str, str]]:
        """生成测试数据"""
        test_cases = []
        
        # 1. 短文本 - 高重复性
        short_repetitive = "今天天气很好！" * 50
        test_cases.append(("短文本-高重复", short_repetitive))
        
        # 2. 短文本 - 低重复性
        short_diverse = "".join(random.choices(string.ascii_letters + string.digits + "，。！？", k=500))
        test_cases.append(("短文本-低重复", short_diverse))
        
        # 3. 中等文本 - 旅游日记风格
        medium_diary = """今天来到了美丽的西湖，春天的西湖真是美不胜收。雷峰塔在夕阳下显得格外壮观，
        断桥上游人如织，大家都在欣赏着这千年古迹。苏堤春晓名不虚传，柳絮飞舞，桃花盛开，
        仿佛置身于诗画之中。三潭印月的景色更是令人陶醉，湖水清澈见底，倒影如画。
        花港观鱼让我感受到了大自然的和谐之美，鱼儿在水中自由游弋，与游客和谐共处。
        西湖的美景让我流连忘返，这次旅行真是太美好了！""" * 20
        test_cases.append(("中等文本-日记", medium_diary))
        
        # 4. 大文本 - 高重复性
        large_repetitive = "北京是中国的首都，有着悠久的历史和丰富的文化遗产。" * 1000
        test_cases.append(("大文本-高重复", large_repetitive))
        
        # 5. 大文本 - 中等重复性
        large_mixed = self._generate_mixed_content(50000)
        test_cases.append(("大文本-混合", large_mixed))
        
        # 6. 超大文本 - 测试并行处理
        xlarge_text = self._generate_travel_diary(100000)
        test_cases.append(("超大文本-日记", xlarge_text))
        
        return test_cases
    
    def _generate_mixed_content(self, length: int) -> str:
        """生成混合重复度的内容"""
        base_phrases = [
            "今天的旅行很精彩",
            "风景如画的地方",
            "历史悠久的古迹",
            "美味的当地特色菜",
            "友善的当地人民",
            "难忘的旅行体验"
        ]
        
        content = []
        for _ in range(length // 50):
            # 70%概率选择重复短语，30%概率生成随机内容
            if random.random() < 0.7:
                content.append(random.choice(base_phrases))
            else:
                random_text = "".join(random.choices(
                    string.ascii_letters + string.digits + "，。！？", 
                    k=random.randint(10, 30)
                ))
                content.append(random_text)
        
        return "".join(content)
    
    def _generate_travel_diary(self, target_length: int) -> str:
        """生成旅游日记风格的长文本"""
        diary_templates = [
            "今天我们来到了{place}，这里的{feature}让人印象深刻。",
            "在{place}，我们品尝了当地的{food}，味道{taste}。",
            "{place}的{attraction}真是{adjective}，让人流连忘返。",
            "漫步在{place}的{location}，感受着{feeling}。",
            "这次在{place}的经历让我{emotion}，真是{conclusion}。"
        ]
        
        places = ["北京", "上海", "西湖", "故宫", "长城", "天安门", "颐和园", "天坛"]
        features = ["建筑", "风景", "文化", "历史", "美食", "人文"]
        foods = ["烤鸭", "小笼包", "糖醋里脊", "宫保鸡丁", "麻婆豆腐"]
        tastes = ["很棒", "不错", "一般", "很好", "美味"]
        attractions = ["景色", "建筑", "文物", "园林", "古迹"]
        adjectives = ["壮观", "美丽", "震撼", "精美", "宏伟"]
        locations = ["街道", "公园", "广场", "胡同", "庭院"]
        feelings = ["历史的厚重", "文化的魅力", "自然的美好", "人文的温暖"]
        emotions = ["很感动", "很震撼", "很开心", "很满足", "很难忘"]
        conclusions = ["太棒了", "很值得", "不虚此行", "收获满满", "意犹未尽"]
        
        content = []
        current_length = 0
        
        while current_length < target_length:
            template = random.choice(diary_templates)
            text = template.format(
                place=random.choice(places),
                feature=random.choice(features),
                food=random.choice(foods),
                taste=random.choice(tastes),
                attraction=random.choice(attractions),
                adjective=random.choice(adjectives),
                location=random.choice(locations),
                feeling=random.choice(feelings),
                emotion=random.choice(emotions),
                conclusion=random.choice(conclusions)
            )
            content.append(text)
            current_length += len(text)
        
        return "".join(content)[:target_length]
    
    def test_compression_performance(self, text: str, test_name: str) -> Dict:
        """测试压缩性能"""
        results = {
            'test_name': test_name,
            'text_length': len(text),
            'text_size_bytes': len(text.encode('utf-8'))
        }
        
        # 测试原版实现
        try:
            start_time = time.time()
            original_compressed = self.original_manager.compress_diary_content(text)
            original_compress_time = time.time() - start_time
            
            start_time = time.time()
            original_decompressed = self.original_manager.decompress_diary_content(original_compressed)
            original_decompress_time = time.time() - start_time
            
            original_compressed_size = len(original_compressed.encode('utf-8'))
            original_ratio = results['text_size_bytes'] / original_compressed_size if original_compressed_size > 0 else 1.0
            
            results.update({
                'original_compress_time': original_compress_time,
                'original_decompress_time': original_decompress_time,
                'original_total_time': original_compress_time + original_decompress_time,
                'original_compressed_size': original_compressed_size,
                'original_compression_ratio': original_ratio,
                'original_correct': original_decompressed == text
            })
        except Exception as e:
            print(f"原版测试失败: {e}")
            results.update({
                'original_compress_time': float('inf'),
                'original_decompress_time': float('inf'),
                'original_total_time': float('inf'),
                'original_compressed_size': results['text_size_bytes'],
                'original_compression_ratio': 1.0,
                'original_correct': False
            })
        
        # 测试优化版实现
        try:
            start_time = time.time()
            optimized_compressed, opt_stats = self.optimized_manager.compress_diary_content(text)
            optimized_compress_time = time.time() - start_time
            
            start_time = time.time()
            optimized_decompressed, decomp_stats = self.optimized_manager.decompress_diary_content(optimized_compressed)
            optimized_decompress_time = time.time() - start_time
            
            optimized_compressed_size = len(optimized_compressed.encode('utf-8'))
            optimized_ratio = results['text_size_bytes'] / optimized_compressed_size if optimized_compressed_size > 0 else 1.0
            
            results.update({
                'optimized_compress_time': optimized_compress_time,
                'optimized_decompress_time': optimized_decompress_time,
                'optimized_total_time': optimized_compress_time + optimized_decompress_time,
                'optimized_compressed_size': optimized_compressed_size,
                'optimized_compression_ratio': optimized_ratio,
                'optimized_correct': optimized_decompressed == text,
                'optimized_algorithm': opt_stats.algorithm_used
            })
        except Exception as e:
            print(f"优化版测试失败: {e}")
            results.update({
                'optimized_compress_time': float('inf'),
                'optimized_decompress_time': float('inf'),
                'optimized_total_time': float('inf'),
                'optimized_compressed_size': results['text_size_bytes'],
                'optimized_compression_ratio': 1.0,
                'optimized_correct': False,
                'optimized_algorithm': 'failed'
            })
        
        # 计算性能提升
        if results['original_total_time'] != float('inf') and results['optimized_total_time'] != float('inf'):
            results['speed_improvement'] = results['original_total_time'] / results['optimized_total_time']
        else:
            results['speed_improvement'] = 1.0
        
        if results['original_compressed_size'] > 0 and results['optimized_compressed_size'] > 0:
            results['compression_improvement'] = results['optimized_compression_ratio'] / results['original_compression_ratio']
        else:
            results['compression_improvement'] = 1.0
        
        return results
    
    def run_all_tests(self) -> List[Dict]:
        """运行所有测试"""
        print("🚀 开始Huffman压缩算法性能对比测试")
        print("=" * 80)
        
        test_cases = self.generate_test_data()
        
        for i, (test_name, text) in enumerate(test_cases, 1):
            print(f"\n测试 {i}/{len(test_cases)}: {test_name}")
            print(f"文本长度: {len(text):,} 字符, 大小: {len(text.encode('utf-8')):,} 字节")
            print("-" * 60)
            
            result = self.test_compression_performance(text, test_name)
            self.test_results.append(result)
            
            # 显示结果
            print(f"原版实现:")
            print(f"  压缩时间:   {result['original_compress_time']:.6f}s")
            print(f"  解压时间:   {result['original_decompress_time']:.6f}s")
            print(f"  总时间:     {result['original_total_time']:.6f}s")
            print(f"  压缩比:     {result['original_compression_ratio']:.2f}x")
            print(f"  正确性:     {'✅' if result['original_correct'] else '❌'}")
            
            print(f"优化版实现:")
            print(f"  压缩时间:   {result['optimized_compress_time']:.6f}s")
            print(f"  解压时间:   {result['optimized_decompress_time']:.6f}s")
            print(f"  总时间:     {result['optimized_total_time']:.6f}s")
            print(f"  压缩比:     {result['optimized_compression_ratio']:.2f}x")
            print(f"  算法:       {result['optimized_algorithm']}")
            print(f"  正确性:     {'✅' if result['optimized_correct'] else '❌'}")
            
            print(f"性能提升:")
            print(f"  速度提升:   {result['speed_improvement']:.2f}x")
            print(f"  压缩提升:   {result['compression_improvement']:.2f}x")
        
        return self.test_results
    
    def generate_report(self) -> str:
        """生成性能报告"""
        if not self.test_results:
            return "没有测试结果"
        
        report = []
        report.append("📊 Huffman压缩算法性能对比报告")
        report.append("=" * 80)
        
        # 总体统计
        total_tests = len(self.test_results)
        successful_tests = sum(1 for r in self.test_results if r['original_correct'] and r['optimized_correct'])
        
        avg_speed_improvement = sum(r['speed_improvement'] for r in self.test_results) / total_tests
        avg_compression_improvement = sum(r['compression_improvement'] for r in self.test_results) / total_tests
        
        report.append(f"\n📈 总体统计:")
        report.append(f"  测试用例数量:     {total_tests}")
        report.append(f"  成功测试数量:     {successful_tests}")
        report.append(f"  平均速度提升:     {avg_speed_improvement:.2f}x")
        report.append(f"  平均压缩提升:     {avg_compression_improvement:.2f}x")
        
        # 详细结果表格
        report.append(f"\n📋 详细测试结果:")
        report.append("-" * 80)
        report.append(f"{'测试名称':<15} {'文本大小':<10} {'原版时间':<10} {'优化时间':<10} {'速度提升':<10} {'压缩提升':<10}")
        report.append("-" * 80)
        
        for result in self.test_results:
            report.append(f"{result['test_name']:<15} "
                         f"{result['text_size_bytes']:<10,} "
                         f"{result['original_total_time']:<10.4f} "
                         f"{result['optimized_total_time']:<10.4f} "
                         f"{result['speed_improvement']:<10.2f} "
                         f"{result['compression_improvement']:<10.2f}")
        
        # 算法使用统计
        algorithm_usage = {}
        for result in self.test_results:
            algo = result.get('optimized_algorithm', 'unknown')
            algorithm_usage[algo] = algorithm_usage.get(algo, 0) + 1
        
        report.append(f"\n🔧 优化版算法使用统计:")
        for algo, count in algorithm_usage.items():
            percentage = count / total_tests * 100
            report.append(f"  {algo}: {count} 次 ({percentage:.1f}%)")
        
        # 性能分析
        report.append(f"\n🎯 性能分析:")
        
        # 找出最大提升
        max_speed_result = max(self.test_results, key=lambda x: x['speed_improvement'])
        max_compression_result = max(self.test_results, key=lambda x: x['compression_improvement'])
        
        report.append(f"  最大速度提升: {max_speed_result['speed_improvement']:.2f}x ({max_speed_result['test_name']})")
        report.append(f"  最大压缩提升: {max_compression_result['compression_improvement']:.2f}x ({max_compression_result['test_name']})")
        
        # 优化建议
        report.append(f"\n💡 优化效果总结:")
        if avg_speed_improvement > 1.5:
            report.append(f"  ✅ 速度优化显著，平均提升 {avg_speed_improvement:.1f} 倍")
        elif avg_speed_improvement > 1.1:
            report.append(f"  ✅ 速度有所提升，平均提升 {avg_speed_improvement:.1f} 倍")
        else:
            report.append(f"  ⚠️ 速度提升有限，平均提升 {avg_speed_improvement:.1f} 倍")
        
        if avg_compression_improvement > 1.2:
            report.append(f"  ✅ 压缩效果显著改善，平均提升 {avg_compression_improvement:.1f} 倍")
        elif avg_compression_improvement > 1.05:
            report.append(f"  ✅ 压缩效果有所改善，平均提升 {avg_compression_improvement:.1f} 倍")
        else:
            report.append(f"  ➡️ 压缩效果基本持平，平均提升 {avg_compression_improvement:.1f} 倍")
        
        return "\n".join(report)
    
    def save_results_to_csv(self, filename: str = "huffman_performance_results.csv"):
        """保存结果到CSV文件"""
        if not self.test_results:
            return
        
        df = pd.DataFrame(self.test_results)
        df.to_csv(filename, index=False, encoding='utf-8')
        print(f"📁 结果已保存到: {filename}")


def main():
    """主函数"""
    # 创建测试套件
    test_suite = PerformanceTestSuite()
    
    # 运行测试
    results = test_suite.run_all_tests()
    
    # 生成报告
    report = test_suite.generate_report()
    print("\n" + report)
    
    # 保存结果
    test_suite.save_results_to_csv()
    
    # 显示优化建议
    print("\n🔧 优化建议:")
    print("1. 对于小文件，优化版会自动选择zlib算法，提供更好的压缩比")
    print("2. 对于大文件，优化版使用并行处理，显著提升处理速度")
    print("3. 自适应压缩策略根据文本特征选择最佳算法")
    print("4. 位操作优化减少了内存占用和处理时间")
    print("5. 缓存机制避免了重复计算，提升了整体性能")


if __name__ == "__main__":
    main() 