"""
Huffman无损压缩算法模块
用于旅游日记内容的压缩存储
"""

import heapq
import pickle
import base64
from typing import Dict, Optional, Tuple
from collections import defaultdict, Counter


class HuffmanNode:
    """Huffman树节点"""
    
    def __init__(self, char: str = None, freq: int = 0, left=None, right=None):
        self.char = char
        self.freq = freq
        self.left = left
        self.right = right
    
    def __lt__(self, other):
        return self.freq < other.freq
    
    def __eq__(self, other):
        return self.freq == other.freq
    
    def is_leaf(self):
        return self.left is None and self.right is None


class HuffmanCompression:
    """Huffman压缩算法类"""
    
    def __init__(self):
        self.root = None
        self.codes = {}
        self.reverse_codes = {}
    
    def _build_frequency_table(self, text: str) -> Dict[str, int]:
        """
        构建字符频率表
        
        Args:
            text: 输入文本
            
        Returns:
            字符频率字典
        """
        return Counter(text)
    
    def _build_huffman_tree(self, freq_table: Dict[str, int]) -> HuffmanNode:
        """
        构建Huffman树
        
        Args:
            freq_table: 字符频率表
            
        Returns:
            Huffman树的根节点
        """
        if not freq_table:
            return None
        
        # 特殊情况：只有一个字符
        if len(freq_table) == 1:
            char = list(freq_table.keys())[0]
            root = HuffmanNode(freq=freq_table[char])
            root.left = HuffmanNode(char=char, freq=freq_table[char])
            return root
        
        # 创建优先队列（最小堆）
        heap = []
        for char, freq in freq_table.items():
            node = HuffmanNode(char=char, freq=freq)
            heapq.heappush(heap, node)
        
        # 构建Huffman树
        while len(heap) > 1:
            # 取出频率最小的两个节点
            left = heapq.heappop(heap)
            right = heapq.heappop(heap)
            
            # 创建新的内部节点
            merged = HuffmanNode(freq=left.freq + right.freq, left=left, right=right)
            heapq.heappush(heap, merged)
        
        return heap[0]
    
    def _generate_codes(self, root: HuffmanNode, code: str = "", codes: Dict[str, str] = None) -> Dict[str, str]:
        """
        生成Huffman编码
        
        Args:
            root: Huffman树根节点
            code: 当前编码
            codes: 编码字典
            
        Returns:
            字符到编码的映射字典
        """
        if codes is None:
            codes = {}
        
        if root is None:
            return codes
        
        # 叶子节点
        if root.is_leaf():
            # 特殊情况：只有一个字符时，使用"0"作为编码
            codes[root.char] = code if code else "0"
            return codes
        
        # 递归处理左右子树
        self._generate_codes(root.left, code + "0", codes)
        self._generate_codes(root.right, code + "1", codes)
        
        return codes
    
    def compress(self, text: str) -> Tuple[str, Dict]:
        """
        压缩文本
        
        Args:
            text: 待压缩的文本
            
        Returns:
            (压缩后的二进制字符串, 解压缩所需的信息)
        """
        if not text:
            return "", {}
        
        # 1. 构建频率表
        freq_table = self._build_frequency_table(text)
        
        # 2. 构建Huffman树
        self.root = self._build_huffman_tree(freq_table)
        
        # 3. 生成编码
        self.codes = self._generate_codes(self.root)
        self.reverse_codes = {code: char for char, code in self.codes.items()}
        
        # 4. 编码文本
        compressed_bits = ""
        for char in text:
            compressed_bits += self.codes[char]
        
        # 5. 准备解压缩信息
        compression_info = {
            'freq_table': freq_table,
            'original_length': len(text),
            'compressed_bits_length': len(compressed_bits)
        }
        
        return compressed_bits, compression_info
    
    def decompress(self, compressed_bits: str, compression_info: Dict) -> str:
        """
        解压缩文本
        
        Args:
            compressed_bits: 压缩后的二进制字符串
            compression_info: 压缩信息
            
        Returns:
            解压缩后的原始文本
        """
        if not compressed_bits or not compression_info:
            return ""
        
        # 重建Huffman树
        freq_table = compression_info['freq_table']
        self.root = self._build_huffman_tree(freq_table)
        
        # 特殊情况：只有一个字符
        if len(freq_table) == 1:
            char = list(freq_table.keys())[0]
            return char * compression_info['original_length']
        
        # 解码
        decoded_text = ""
        current_node = self.root
        
        for bit in compressed_bits:
            if bit == '0':
                current_node = current_node.left
            else:
                current_node = current_node.right
            
            # 到达叶子节点
            if current_node.is_leaf():
                decoded_text += current_node.char
                current_node = self.root
        
        return decoded_text
    
    def compress_to_bytes(self, text: str) -> Tuple[bytes, Dict]:
        """
        压缩文本并转换为字节
        
        Args:
            text: 待压缩的文本
            
        Returns:
            (压缩后的字节数据, 压缩信息)
        """
        compressed_bits, compression_info = self.compress(text)
        
        if not compressed_bits:
            return b"", compression_info
        
        # 将二进制字符串转换为字节
        # 先补齐到8的倍数
        padding = 8 - len(compressed_bits) % 8
        if padding != 8:
            compressed_bits += '0' * padding
        
        compression_info['padding'] = padding
        
        # 转换为字节
        compressed_bytes = bytearray()
        for i in range(0, len(compressed_bits), 8):
            byte_str = compressed_bits[i:i+8]
            compressed_bytes.append(int(byte_str, 2))
        
        return bytes(compressed_bytes), compression_info
    
    def decompress_from_bytes(self, compressed_bytes: bytes, compression_info: Dict) -> str:
        """
        从字节数据解压缩文本
        
        Args:
            compressed_bytes: 压缩后的字节数据
            compression_info: 压缩信息
            
        Returns:
            解压缩后的原始文本
        """
        if not compressed_bytes:
            return ""
        
        # 将字节转换为二进制字符串
        compressed_bits = ""
        for byte in compressed_bytes:
            compressed_bits += format(byte, '08b')
        
        # 移除填充
        padding = compression_info.get('padding', 0)
        if padding > 0:
            compressed_bits = compressed_bits[:-padding]
        
        return self.decompress(compressed_bits, compression_info)
    
    def get_compression_ratio(self, original_text: str, compressed_data: bytes) -> float:
        """
        计算压缩比
        
        Args:
            original_text: 原始文本
            compressed_data: 压缩后的数据
            
        Returns:
            压缩比（原始大小/压缩后大小）
        """
        original_size = len(original_text.encode('utf-8'))
        compressed_size = len(compressed_data)
        
        if compressed_size == 0:
            return 0.0
        
        return original_size / compressed_size
    
    def compress_diary_content(self, content: str) -> str:
        """
        压缩日记内容并返回Base64编码的字符串
        
        Args:
            content: 日记内容
            
        Returns:
            Base64编码的压缩数据
        """
        try:
            compressed_bytes, compression_info = self.compress_to_bytes(content)
            
            # 将压缩数据和信息打包
            package = {
                'data': compressed_bytes,
                'info': compression_info
            }
            
            # 序列化并Base64编码
            serialized = pickle.dumps(package)
            encoded = base64.b64encode(serialized).decode('utf-8')
            
            return encoded
        except Exception as e:
            print(f"压缩失败: {e}")
            return content  # 压缩失败时返回原文
    
    def decompress_diary_content(self, compressed_content: str) -> str:
        """
        解压缩日记内容
        
        Args:
            compressed_content: Base64编码的压缩数据
            
        Returns:
            解压缩后的原始内容
        """
        try:
            # Base64解码并反序列化
            serialized = base64.b64decode(compressed_content.encode('utf-8'))
            package = pickle.loads(serialized)
            
            compressed_bytes = package['data']
            compression_info = package['info']
            
            # 解压缩
            return self.decompress_from_bytes(compressed_bytes, compression_info)
        except Exception as e:
            print(f"解压缩失败: {e}")
            return compressed_content  # 解压缩失败时返回原数据


class DiaryCompressionManager:
    """日记压缩管理器"""
    
    def __init__(self):
        self.compressor = HuffmanCompression()
        self.compression_stats = {
            'total_original_size': 0,
            'total_compressed_size': 0,
            'compression_count': 0
        }
    
    def compress_diary(self, diary: Dict) -> Dict:
        """
        智能压缩日记 - 只对大文件进行压缩，确保压缩有效
        
        Args:
            diary: 日记数据
            
        Returns:
            压缩后的日记数据（如果压缩有效）或原始数据（如果压缩无效）
        """
        if 'content' not in diary:
            return diary
        
        original_content = diary['content']
        original_size = len(original_content.encode('utf-8'))
        
        # 压缩阈值：根据实际测试，Huffman压缩有很大开销，需要很大的文件才有效
        COMPRESSION_THRESHOLD = 10000  # 字节，只对超大文件进行压缩
        
        if original_size < COMPRESSION_THRESHOLD:
            # 小文件不压缩，直接返回原始日记
            print(f"跳过压缩：文件大小 {original_size} 字节 < 阈值 {COMPRESSION_THRESHOLD} 字节")
            return diary
        
        # 尝试压缩
        compressed_content = self.compressor.compress_diary_content(original_content)
        compressed_size = len(compressed_content.encode('utf-8'))
        
        # 检查压缩效果：如果压缩后文件不小于原文件的50%，则不使用压缩
        compression_efficiency_threshold = 0.5  # 至少要压缩50%才有意义
        
        if compressed_size >= original_size * compression_efficiency_threshold:
            print(f"跳过压缩：压缩效果不佳 {compressed_size} 字节 >= {original_size * compression_efficiency_threshold:.0f} 字节")
            return diary
        
        # 验证解压缩正确性
        try:
            decompressed_content = self.compressor.decompress_diary_content(compressed_content)
            if decompressed_content != original_content:
                print(f"跳过压缩：解压缩验证失败")
                return diary
        except Exception as e:
            print(f"跳过压缩：解压缩出错 {e}")
            return diary
        
        # 压缩有效，使用压缩版本
        compression_ratio = (original_size - compressed_size) / original_size * 100
        print(f"压缩成功：{original_size} 字节 -> {compressed_size} 字节 (压缩比: {compression_ratio:.1f}%)")
        
        # 更新统计信息
        self.compression_stats['total_original_size'] += original_size
        self.compression_stats['total_compressed_size'] += compressed_size
        self.compression_stats['compression_count'] += 1
        
        # 创建压缩后的日记副本
        compressed_diary = diary.copy()
        compressed_diary['compressedContent'] = compressed_content
        compressed_diary['compressionInfo'] = {
            'original_size': original_size,
            'compressed_size': compressed_size,
            'compression_ratio': original_size / compressed_size if compressed_size > 0 else 1.0,
            'compression_percentage': compression_ratio
        }
        
        return compressed_diary
    
    def decompress_diary(self, diary: Dict) -> Dict:
        """
        解压缩日记
        
        Args:
            diary: 压缩的日记数据
            
        Returns:
            解压缩后的日记数据
        """
        if 'compressedContent' not in diary:
            return diary
        
        compressed_content = diary['compressedContent']
        
        # 检查是否是旧格式的占位符
        if compressed_content.startswith('compressed_content_'):
            # 旧格式：使用原始的content字段
            decompressed_diary = diary.copy()
            if 'content' in diary and diary['content'] != compressed_content:
                # 如果有原始content且不是占位符，使用原始content
                decompressed_diary['content'] = diary['content']
            else:
                # 否则保持原样
                decompressed_diary['content'] = compressed_content
        else:
            # 新格式：解压缩
            original_content = self.compressor.decompress_diary_content(compressed_content)
            decompressed_diary = diary.copy()
            decompressed_diary['content'] = original_content
        
        return decompressed_diary
    
    def calculate_real_compression_statistics(self, diaries: list) -> Dict:
        """
        基于智能压缩策略计算真实的压缩统计信息
        
        Args:
            diaries: 日记列表
            
        Returns:
            压缩统计信息
        """
        stats = {
            'total_files': len(diaries),
            'real_compressed_files': 0,
            'placeholder_files': 0,
            'uncompressed_files': 0,
            'would_compress_files': 0,  # 根据智能策略会压缩的文件
            'would_skip_files': 0,      # 根据智能策略会跳过的文件
            'total_original_size': 0,
            'total_compressed_size': 0,
            'total_would_compress_size': 0,  # 会压缩的文件总大小
            'compression_ratio': 0.0,
            'space_saved': 0,
            'compression_threshold': 10000,  # 智能压缩阈值
            'efficiency_threshold': 0.5      # 压缩效率阈值
        }
        
        for diary in diaries:
            content_size = len(diary['content'].encode('utf-8'))
            stats['total_original_size'] += content_size
            
            # 分析现有压缩状态
            if 'compressedContent' in diary:
                if diary['compressedContent'].startswith('compressed_content_'):
                    # 占位符压缩
                    stats['placeholder_files'] += 1
                    stats['total_compressed_size'] += content_size  # 占位符不压缩
                else:
                    # 真实压缩
                    stats['real_compressed_files'] += 1
                    compressed_size = len(diary['compressedContent'].encode('utf-8'))
                    stats['total_compressed_size'] += compressed_size
            else:
                # 未压缩
                stats['uncompressed_files'] += 1
                stats['total_compressed_size'] += content_size
            
            # 分析智能压缩策略
            if content_size >= stats['compression_threshold']:
                stats['would_compress_files'] += 1
                stats['total_would_compress_size'] += content_size
            else:
                stats['would_skip_files'] += 1
        
        # 计算压缩比
        if stats['total_original_size'] > 0:
            stats['compression_ratio'] = (
                (stats['total_original_size'] - stats['total_compressed_size']) / 
                stats['total_original_size'] * 100
            )
            stats['space_saved'] = stats['total_original_size'] - stats['total_compressed_size']
        
        return stats
    
    def get_compression_statistics(self, diaries: list = None) -> Dict:
        """
        获取压缩统计信息
        
        Args:
            diaries: 日记列表，如果提供则计算真实统计，否则返回运行时统计
            
        Returns:
            压缩统计信息
        """
        if diaries is not None:
            # 返回基于实际数据的真实统计
            return self.calculate_real_compression_statistics(diaries)
        else:
            # 返回运行时统计（向后兼容）
            stats = self.compression_stats.copy()
            
            if stats['total_compressed_size'] > 0:
                stats['overall_compression_ratio'] = (
                    stats['total_original_size'] / stats['total_compressed_size']
                )
            else:
                stats['overall_compression_ratio'] = 1.0
            
            if stats['compression_count'] > 0:
                stats['average_original_size'] = stats['total_original_size'] / stats['compression_count']
                stats['average_compressed_size'] = stats['total_compressed_size'] / stats['compression_count']
            else:
                stats['average_original_size'] = 0
                stats['average_compressed_size'] = 0
            
            return stats


def test_huffman_compression():
    """测试Huffman压缩算法"""
    # 测试文本
    test_text = """
    今天来到了美丽的西湖，春天的西湖真是美不胜收。雷峰塔在夕阳下显得格外壮观，
    断桥上游人如织，大家都在欣赏着这千年古迹。苏堤春晓名不虚传，柳絮飞舞，
    桃花盛开，仿佛置身于诗画之中。三潭印月的景色更是令人陶醉，湖水清澈见底，
    倒影如画。花港观鱼让我感受到了大自然的和谐之美，鱼儿在水中自由游弋，
    与游客和谐共处。
    """
    
    # 创建压缩器
    compressor = HuffmanCompression()
    
    # 压缩
    compressed_content = compressor.compress_diary_content(test_text)
    print(f"原始文本长度: {len(test_text)} 字符")
    print(f"压缩后长度: {len(compressed_content)} 字符")
    
    # 解压缩
    decompressed_text = compressor.decompress_diary_content(compressed_content)
    print(f"解压缩后长度: {len(decompressed_text)} 字符")
    print(f"解压缩正确性: {test_text == decompressed_text}")
    
    # 计算压缩比
    original_bytes = len(test_text.encode('utf-8'))
    compressed_bytes = len(compressed_content.encode('utf-8'))
    compression_ratio = original_bytes / compressed_bytes if compressed_bytes > 0 else 1.0
    print(f"压缩比: {compression_ratio:.2f}")


if __name__ == "__main__":
    test_huffman_compression() 