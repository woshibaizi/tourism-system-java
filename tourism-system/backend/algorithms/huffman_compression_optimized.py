#!/usr/bin/env python3
"""
优化版Huffman无损压缩算法
针对旅游日记内容的高性能压缩存储

主要优化:
1. 性能优化 - 使用位操作和缓存
2. 内存优化 - 减少对象创建和内存占用
3. 自适应压缩 - 动态选择最佳策略
4. 并行处理 - 支持大文件分块处理
5. 编码优化 - 改进编码表生成和存储
"""

import heapq
import pickle
import base64
import zlib
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Optional, Tuple, List, Union
from collections import Counter
from dataclasses import dataclass
from functools import lru_cache
import array
import struct


@dataclass
class CompressionStats:
    """压缩统计信息"""
    original_size: int = 0
    compressed_size: int = 0
    compression_time: float = 0.0
    decompression_time: float = 0.0
    compression_ratio: float = 1.0
    algorithm_used: str = "huffman"


class OptimizedHuffmanNode:
    """优化的Huffman树节点 - 使用__slots__减少内存占用"""
    __slots__ = ['char', 'freq', 'left', 'right', '_id']
    
    _node_counter = 0
    
    def __init__(self, char: str = None, freq: int = 0, left=None, right=None):
        self.char = char
        self.freq = freq
        self.left = left
        self.right = right
        # 为节点分配唯一ID，确保堆排序的稳定性
        OptimizedHuffmanNode._node_counter += 1
        self._id = OptimizedHuffmanNode._node_counter
    
    def __lt__(self, other):
        if self.freq != other.freq:
            return self.freq < other.freq
        return self._id < other._id
    
    def __eq__(self, other):
        return self.freq == other.freq and self._id == other._id
    
    def is_leaf(self) -> bool:
        return self.left is None and self.right is None


class BitWriter:
    """高效的位写入器"""
    
    def __init__(self):
        self.buffer = bytearray()
        self.bit_buffer = 0
        self.bit_count = 0
    
    def write_bits(self, bits: str):
        """写入位字符串"""
        for bit in bits:
            self.write_bit(int(bit))
    
    def write_bit(self, bit: int):
        """写入单个位"""
        self.bit_buffer = (self.bit_buffer << 1) | bit
        self.bit_count += 1
        
        if self.bit_count == 8:
            self.buffer.append(self.bit_buffer)
            self.bit_buffer = 0
            self.bit_count = 0
    
    def flush(self) -> bytes:
        """刷新缓冲区并返回字节数据"""
        if self.bit_count > 0:
            # 左移剩余位数，补齐到8位
            self.bit_buffer <<= (8 - self.bit_count)
            self.buffer.append(self.bit_buffer)
        
        result = bytes(self.buffer)
        self.buffer.clear()
        self.bit_buffer = 0
        self.bit_count = 0
        return result


class BitReader:
    """高效的位读取器"""
    
    def __init__(self, data: bytes):
        self.data = data
        self.byte_index = 0
        self.bit_index = 0
    
    def read_bit(self) -> int:
        """读取单个位"""
        if self.byte_index >= len(self.data):
            return -1  # EOF
        
        byte_val = self.data[self.byte_index]
        bit = (byte_val >> (7 - self.bit_index)) & 1
        
        self.bit_index += 1
        if self.bit_index == 8:
            self.bit_index = 0
            self.byte_index += 1
        
        return bit
    
    def has_more_bits(self) -> bool:
        """检查是否还有更多位可读"""
        return self.byte_index < len(self.data)


class OptimizedHuffmanCompression:
    """优化版Huffman压缩算法"""
    
    def __init__(self, enable_parallel: bool = True, chunk_size: int = 64 * 1024):
        self.enable_parallel = enable_parallel
        self.chunk_size = chunk_size
        self.encoding_cache = {}  # 编码缓存
        self.tree_cache = {}      # 树缓存
        
    @lru_cache(maxsize=128)
    def _get_frequency_table(self, text_hash: int, text: str) -> Dict[str, int]:
        """缓存的频率表构建"""
        return Counter(text)
    
    def _build_optimized_huffman_tree(self, freq_table: Dict[str, int]) -> OptimizedHuffmanNode:
        """构建优化的Huffman树"""
        if not freq_table:
            return None
        
        # 特殊情况：只有一个字符
        if len(freq_table) == 1:
            char = next(iter(freq_table))
            root = OptimizedHuffmanNode(freq=freq_table[char])
            root.left = OptimizedHuffmanNode(char=char, freq=freq_table[char])
            return root
        
        # 使用列表而不是heapq来提高性能
        nodes = [OptimizedHuffmanNode(char=char, freq=freq) 
                for char, freq in freq_table.items()]
        heapq.heapify(nodes)
        
        # 构建Huffman树
        while len(nodes) > 1:
            left = heapq.heappop(nodes)
            right = heapq.heappop(nodes)
            
            merged = OptimizedHuffmanNode(
                freq=left.freq + right.freq,
                left=left,
                right=right
            )
            heapq.heappush(nodes, merged)
        
        return nodes[0]
    
    def _generate_optimized_codes(self, root: OptimizedHuffmanNode) -> Dict[str, str]:
        """生成优化的编码表"""
        if root is None:
            return {}
        
        codes = {}
        
        # 使用栈而不是递归，避免栈溢出
        stack = [(root, "")]
        
        while stack:
            node, code = stack.pop()
            
            if node.is_leaf():
                codes[node.char] = code if code else "0"
            else:
                if node.right:
                    stack.append((node.right, code + "1"))
                if node.left:
                    stack.append((node.left, code + "0"))
        
        return codes
    
    def _compress_chunk(self, text_chunk: str, codes: Dict[str, str]) -> bytes:
        """压缩文本块"""
        writer = BitWriter()
        
        for char in text_chunk:
            if char in codes:
                writer.write_bits(codes[char])
        
        return writer.flush()
    
    def _adaptive_compress(self, text: str) -> Tuple[bytes, Dict, CompressionStats]:
        """自适应压缩 - 根据内容特点选择最佳策略"""
        import time
        start_time = time.time()
        
        stats = CompressionStats()
        stats.original_size = len(text.encode('utf-8'))
        
        # 分析文本特征
        text_length = len(text)
        unique_chars = len(set(text))
        
        # 策略1: 短文本或字符种类太多，直接使用zlib
        if text_length < 1000 or unique_chars > text_length * 0.8:
            compressed_data = zlib.compress(text.encode('utf-8'), level=6)
            compression_info = {
                'algorithm': 'zlib',
                'original_length': text_length
            }
            stats.algorithm_used = "zlib"
            stats.compressed_size = len(compressed_data)
            stats.compression_time = time.time() - start_time
            stats.compression_ratio = stats.original_size / stats.compressed_size
            return compressed_data, compression_info, stats
        
        # 策略2: 使用优化的Huffman编码
        freq_table = Counter(text)
        root = self._build_optimized_huffman_tree(freq_table)
        codes = self._generate_optimized_codes(root)
        
        # 并行压缩大文件
        if self.enable_parallel and text_length > self.chunk_size:
            compressed_data = self._parallel_compress(text, codes)
        else:
            compressed_data = self._compress_chunk(text, codes)
        
        # 压缩频率表以减少开销
        compressed_freq_table = zlib.compress(pickle.dumps(freq_table))
        
        compression_info = {
            'algorithm': 'huffman_optimized',
            'freq_table_compressed': compressed_freq_table,
            'original_length': text_length,
            'codes_count': len(codes)
        }
        
        stats.algorithm_used = "huffman_optimized"
        stats.compressed_size = len(compressed_data) + len(compressed_freq_table)
        stats.compression_time = time.time() - start_time
        stats.compression_ratio = stats.original_size / stats.compressed_size if stats.compressed_size > 0 else 1.0
        
        return compressed_data, compression_info, stats
    
    def _parallel_compress(self, text: str, codes: Dict[str, str]) -> bytes:
        """并行压缩大文件"""
        chunks = [text[i:i + self.chunk_size] 
                 for i in range(0, len(text), self.chunk_size)]
        
        with ThreadPoolExecutor(max_workers=4) as executor:
            compressed_chunks = list(executor.map(
                lambda chunk: self._compress_chunk(chunk, codes), 
                chunks
            ))
        
        # 合并压缩块
        result = bytearray()
        for chunk in compressed_chunks:
            # 添加块长度信息
            result.extend(struct.pack('<I', len(chunk)))
            result.extend(chunk)
        
        return bytes(result)
    
    def compress(self, text: str) -> Tuple[bytes, Dict, CompressionStats]:
        """
        压缩文本
        
        Args:
            text: 待压缩的文本
            
        Returns:
            (压缩数据, 压缩信息, 统计信息)
        """
        if not text:
            return b"", {}, CompressionStats()
        
        return self._adaptive_compress(text)
    
    def _decompress_huffman(self, compressed_data: bytes, compression_info: Dict) -> str:
        """解压缩Huffman编码的数据"""
        # 解压缩频率表
        freq_table = pickle.loads(zlib.decompress(compression_info['freq_table_compressed']))
        original_length = compression_info['original_length']
        
        # 重建Huffman树
        root = self._build_optimized_huffman_tree(freq_table)
        
        # 特殊情况：只有一个字符
        if len(freq_table) == 1:
            char = next(iter(freq_table))
            return char * original_length
        
        # 解码
        reader = BitReader(compressed_data)
        decoded_chars = []
        current_node = root
        chars_decoded = 0
        
        while chars_decoded < original_length and reader.has_more_bits():
            bit = reader.read_bit()
            if bit == -1:
                break
            
            if bit == 0:
                current_node = current_node.left
            else:
                current_node = current_node.right
            
            if current_node.is_leaf():
                decoded_chars.append(current_node.char)
                chars_decoded += 1
                current_node = root
        
        return ''.join(decoded_chars)
    
    def decompress(self, compressed_data: bytes, compression_info: Dict) -> Tuple[str, CompressionStats]:
        """
        解压缩数据
        
        Args:
            compressed_data: 压缩数据
            compression_info: 压缩信息
            
        Returns:
            (解压缩文本, 统计信息)
        """
        import time
        start_time = time.time()
        
        stats = CompressionStats()
        stats.compressed_size = len(compressed_data)
        
        if not compressed_data:
            return "", stats
        
        algorithm = compression_info.get('algorithm', 'huffman')
        
        if algorithm == 'zlib':
            text = zlib.decompress(compressed_data).decode('utf-8')
            stats.algorithm_used = "zlib"
        else:
            text = self._decompress_huffman(compressed_data, compression_info)
            stats.algorithm_used = "huffman_optimized"
        
        stats.original_size = len(text.encode('utf-8'))
        stats.decompression_time = time.time() - start_time
        stats.compression_ratio = stats.original_size / stats.compressed_size if stats.compressed_size > 0 else 1.0
        
        return text, stats


class OptimizedDiaryCompressionManager:
    """优化的日记压缩管理器"""
    
    def __init__(self, enable_parallel: bool = True):
        self.compressor = OptimizedHuffmanCompression(enable_parallel=enable_parallel)
        self.compression_stats = []
        self._lock = threading.Lock()
    
    def compress_diary_content(self, content: str) -> Tuple[str, CompressionStats]:
        """
        压缩日记内容
        
        Args:
            content: 日记内容
            
        Returns:
            (Base64编码的压缩数据, 统计信息)
        """
        try:
            compressed_data, compression_info, stats = self.compressor.compress(content)
            
            # 打包数据
            package = {
                'data': compressed_data,
                'info': compression_info
            }
            
            # 序列化并Base64编码
            serialized = pickle.dumps(package)
            encoded = base64.b64encode(serialized).decode('utf-8')
            
            # 记录统计信息
            with self._lock:
                self.compression_stats.append(stats)
            
            return encoded, stats
            
        except Exception as e:
            print(f"压缩失败: {e}")
            # 返回原文和空统计
            return content, CompressionStats(
                original_size=len(content.encode('utf-8')),
                compressed_size=len(content.encode('utf-8')),
                compression_ratio=1.0,
                algorithm_used="none"
            )
    
    def decompress_diary_content(self, compressed_content: str) -> Tuple[str, CompressionStats]:
        """
        解压缩日记内容
        
        Args:
            compressed_content: Base64编码的压缩数据
            
        Returns:
            (解压缩内容, 统计信息)
        """
        try:
            # Base64解码并反序列化
            serialized = base64.b64decode(compressed_content.encode('utf-8'))
            package = pickle.loads(serialized)
            
            compressed_data = package['data']
            compression_info = package['info']
            
            # 解压缩
            content, stats = self.compressor.decompress(compressed_data, compression_info)
            return content, stats
            
        except Exception as e:
            print(f"解压缩失败: {e}")
            # 返回原数据和空统计
            return compressed_content, CompressionStats(
                original_size=len(compressed_content.encode('utf-8')),
                compressed_size=len(compressed_content.encode('utf-8')),
                compression_ratio=1.0,
                algorithm_used="none"
            )
    
    def smart_compress_diary(self, diary: Dict) -> Dict:
        """
        智能压缩日记 - 改进的压缩策略
        
        Args:
            diary: 日记数据
            
        Returns:
            压缩后的日记数据
        """
        if 'content' not in diary:
            return diary
        
        original_content = diary['content']
        original_size = len(original_content.encode('utf-8'))
        
        # 动态压缩阈值 - 根据内容特征调整
        unique_chars = len(set(original_content))
        char_diversity = unique_chars / len(original_content) if original_content else 1.0
        
        # 高重复性内容降低阈值，低重复性内容提高阈值
        base_threshold = 5000
        if char_diversity < 0.1:  # 高重复性
            threshold = base_threshold // 2
        elif char_diversity > 0.5:  # 低重复性
            threshold = base_threshold * 2
        else:
            threshold = base_threshold
        
        if original_size < threshold:
            print(f"跳过压缩：文件大小 {original_size} 字节 < 动态阈值 {threshold} 字节")
            return diary
        
        # 尝试压缩
        compressed_content, stats = self.compress_diary_content(original_content)
        
        # 检查压缩效果
        if stats.compression_ratio < 1.2:  # 压缩率低于20%
            print(f"跳过压缩：压缩效果不佳，压缩比 {stats.compression_ratio:.2f}")
            return diary
        
        # 验证解压缩正确性
        try:
            decompressed_content, _ = self.decompress_diary_content(compressed_content)
            if decompressed_content != original_content:
                print("跳过压缩：解压缩验证失败")
                return diary
        except Exception as e:
            print(f"跳过压缩：解压缩出错 {e}")
            return diary
        
        # 压缩成功
        compression_percentage = (1 - 1/stats.compression_ratio) * 100
        print(f"压缩成功：{original_size} 字节 -> {stats.compressed_size} 字节 "
              f"(压缩比: {stats.compression_ratio:.2f}x, 节省: {compression_percentage:.1f}%, "
              f"算法: {stats.algorithm_used})")
        
        # 创建压缩后的日记
        compressed_diary = diary.copy()
        compressed_diary['compressedContent'] = compressed_content
        compressed_diary['compressionInfo'] = {
            'original_size': original_size,
            'compressed_size': stats.compressed_size,
            'compression_ratio': stats.compression_ratio,
            'compression_percentage': compression_percentage,
            'algorithm_used': stats.algorithm_used,
            'compression_time': stats.compression_time
        }
        
        return compressed_diary
    
    def get_performance_statistics(self) -> Dict:
        """获取性能统计信息"""
        if not self.compression_stats:
            return {}
        
        total_original = sum(s.original_size for s in self.compression_stats)
        total_compressed = sum(s.compressed_size for s in self.compression_stats)
        total_compression_time = sum(s.compression_time for s in self.compression_stats)
        total_decompression_time = sum(s.decompression_time for s in self.compression_stats)
        
        algorithm_counts = {}
        for stats in self.compression_stats:
            algorithm_counts[stats.algorithm_used] = algorithm_counts.get(stats.algorithm_used, 0) + 1
        
        return {
            'total_files_processed': len(self.compression_stats),
            'total_original_size': total_original,
            'total_compressed_size': total_compressed,
            'overall_compression_ratio': total_original / total_compressed if total_compressed > 0 else 1.0,
            'space_saved_bytes': total_original - total_compressed,
            'space_saved_percentage': (total_original - total_compressed) / total_original * 100 if total_original > 0 else 0,
            'average_compression_time': total_compression_time / len(self.compression_stats),
            'average_decompression_time': total_decompression_time / len(self.compression_stats),
            'algorithm_usage': algorithm_counts,
            'total_processing_time': total_compression_time + total_decompression_time
        }


def benchmark_compression():
    """压缩算法性能基准测试"""
    import time
    
    # 测试数据
    test_texts = [
        # 短文本
        "今天天气很好，适合出游。",
        
        # 中等文本
        """今天来到了美丽的西湖，春天的西湖真是美不胜收。雷峰塔在夕阳下显得格外壮观，
        断桥上游人如织，大家都在欣赏着这千年古迹。苏堤春晓名不虚传，柳絮飞舞，
        桃花盛开，仿佛置身于诗画之中。三潭印月的景色更是令人陶醉，湖水清澈见底，
        倒影如画。花港观鱼让我感受到了大自然的和谐之美，鱼儿在水中自由游弋，
        与游客和谐共处。""",
        
        # 长文本（重复内容多）
        """今天的旅行真是太棒了！""" * 1000,
        
        # 长文本（多样化内容）
        """今天我们来到了北京，这座历史悠久的城市。首先参观了故宫博物院，感受了明清两代皇家宫殿的宏伟壮观。
        紫禁城的建筑群落布局严谨，每一座宫殿都体现了中国古代建筑艺术的精髓。午后我们登上了天安门城楼，
        俯瞰整个天安门广场，感受着这里的历史厚重感。傍晚时分，我们漫步在什刹海边，看着夕阳西下，
        湖水波光粼粼，古老的胡同里传来阵阵京腔，让人仿佛穿越到了老北京的时光里。""" * 100
    ]
    
    # 创建压缩器 - 只测试优化版
    optimized_manager = OptimizedDiaryCompressionManager()
    
    print("🔧 Huffman压缩算法性能基准测试")
    print("=" * 80)
    
    for i, text in enumerate(test_texts, 1):
        print(f"\n测试 {i}: 文本长度 {len(text)} 字符")
        print("-" * 40)
        
        # 测试优化版
        start_time = time.time()
        compressed_opt, stats_opt = optimized_manager.compress_diary_content(text)
        opt_compress_time = time.time() - start_time
        
        start_time = time.time()
        decompressed_opt, decomp_stats = optimized_manager.decompress_diary_content(compressed_opt)
        opt_decompress_time = time.time() - start_time
        
        # 验证正确性
        is_correct = decompressed_opt == text
        
        print(f"优化版Huffman:")
        print(f"  压缩时间:   {opt_compress_time:.6f}s")
        print(f"  解压时间:   {opt_decompress_time:.6f}s")
        print(f"  总时间:     {opt_compress_time + opt_decompress_time:.6f}s")
        print(f"  压缩比:     {stats_opt.compression_ratio:.2f}x")
        print(f"  算法:       {stats_opt.algorithm_used}")
        print(f"  正确性:     {'✅' if is_correct else '❌'}")
        print(f"  原始大小:   {stats_opt.original_size} 字节")
        print(f"  压缩大小:   {stats_opt.compressed_size} 字节")
        print(f"  节省空间:   {stats_opt.original_size - stats_opt.compressed_size} 字节")
        
        # 计算压缩效率
        compression_efficiency = (stats_opt.original_size - stats_opt.compressed_size) / opt_compress_time if opt_compress_time > 0 else 0
        print(f"  压缩效率:   {compression_efficiency:.0f} 字节/秒")


def test_optimized_huffman():
    """测试优化版Huffman压缩"""
    print("🚀 优化版Huffman压缩测试")
    print("=" * 50)
    
    # 创建管理器
    manager = OptimizedDiaryCompressionManager(enable_parallel=True)
    
    # 测试文本
    test_diary = {
        'id': 'test_001',
        'title': '西湖游记',
        'content': """今天来到了美丽的西湖，春天的西湖真是美不胜收。雷峰塔在夕阳下显得格外壮观，
        断桥上游人如织，大家都在欣赏着这千年古迹。苏堤春晓名不虚传，柳絮飞舞，
        桃花盛开，仿佛置身于诗画之中。三潭印月的景色更是令人陶醉，湖水清澈见底，
        倒影如画。花港观鱼让我感受到了大自然的和谐之美，鱼儿在水中自由游弋，
        与游客和谐共处。西湖的美景让我流连忘返，这次旅行真是太美好了！""" * 50
    }
    
    print(f"原始日记大小: {len(test_diary['content'])} 字符")
    
    # 智能压缩
    compressed_diary = manager.smart_compress_diary(test_diary)
    
    # 检查是否压缩
    if 'compressedContent' in compressed_diary:
        print("✅ 日记已压缩")
        print(f"压缩信息: {compressed_diary['compressionInfo']}")
        
        # 测试解压缩
        decompressed_content, stats = manager.decompress_diary_content(
            compressed_diary['compressedContent']
        )
        
        print(f"解压缩正确性: {'✅' if decompressed_content == test_diary['content'] else '❌'}")
        print(f"解压缩统计: 时间={stats.decompression_time:.6f}s, 算法={stats.algorithm_used}")
    else:
        print("⏭️ 日记未压缩（不满足压缩条件）")
    
    # 显示性能统计
    perf_stats = manager.get_performance_statistics()
    if perf_stats:
        print(f"\n📊 性能统计:")
        for key, value in perf_stats.items():
            print(f"  {key}: {value}")


if __name__ == "__main__":
    test_optimized_huffman()
    print("\n" + "="*80)
    benchmark_compression() 