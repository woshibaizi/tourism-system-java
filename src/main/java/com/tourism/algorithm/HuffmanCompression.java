package com.tourism.algorithm;

import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Huffman编码压缩/解压
 * 用于日记内容的无损压缩存储
 */
@Component
public class HuffmanCompression {

    // ==================== 结果类 ====================

    public static class CompressResult {
        private final String compressedBits;
        private final Map<Character, String> codeTable;
        private final int originalLength;
        private final int compressedLength;
        private final double compressionRatio;

        public CompressResult(String compressedBits, Map<Character, String> codeTable,
                              int originalLength, int compressedLength, double compressionRatio) {
            this.compressedBits = compressedBits;
            this.codeTable = codeTable;
            this.originalLength = originalLength;
            this.compressedLength = compressedLength;
            this.compressionRatio = compressionRatio;
        }

        public String getCompressedBits() { return compressedBits; }
        public Map<Character, String> getCodeTable() { return codeTable; }
        public int getOriginalLength() { return originalLength; }
        public int getCompressedLength() { return compressedLength; }
        public double getCompressionRatio() { return compressionRatio; }
    }

    public static class ByteCompressResult {
        private final byte[] compressedData;
        private final Map<Character, String> codeTable;
        private final int originalLength;
        private final int paddingBits;
        private final double compressionRatio;

        public ByteCompressResult(byte[] compressedData, Map<Character, String> codeTable,
                                  int originalLength, int paddingBits, double compressionRatio) {
            this.compressedData = compressedData;
            this.codeTable = codeTable;
            this.originalLength = originalLength;
            this.paddingBits = paddingBits;
            this.compressionRatio = compressionRatio;
        }

        public byte[] getCompressedData() { return compressedData; }
        public Map<Character, String> getCodeTable() { return codeTable; }
        public int getOriginalLength() { return originalLength; }
        public int getPaddingBits() { return paddingBits; }
        public double getCompressionRatio() { return compressionRatio; }
    }

    // ==================== Huffman节点 ====================

    private static class HuffmanNode implements Comparable<HuffmanNode> {
        char ch;
        int freq;
        HuffmanNode left;
        HuffmanNode right;

        HuffmanNode(char ch, int freq) {
            this.ch = ch;
            this.freq = freq;
            this.left = null;
            this.right = null;
        }

        HuffmanNode(int freq, HuffmanNode left, HuffmanNode right) {
            this.ch = '\0';
            this.freq = freq;
            this.left = left;
            this.right = right;
        }

        boolean isLeaf() {
            return left == null && right == null;
        }

        @Override
        public int compareTo(HuffmanNode other) {
            return Integer.compare(this.freq, other.freq);
        }
    }

    // ==================== 核心方法 ====================

    /**
     * 构建频率表
     */
    private Map<Character, Integer> buildFrequencyTable(String text) {
        Map<Character, Integer> freq = new LinkedHashMap<>();
        for (char ch : text.toCharArray()) {
            freq.merge(ch, 1, Integer::sum);
        }
        return freq;
    }

    /**
     * 构建Huffman树
     */
    private HuffmanNode buildTree(Map<Character, Integer> freqTable) {
        PriorityQueue<HuffmanNode> pq = new PriorityQueue<>();
        for (Map.Entry<Character, Integer> entry : freqTable.entrySet()) {
            pq.offer(new HuffmanNode(entry.getKey(), entry.getValue()));
        }

        // 特殊情况：只有一种字符
        if (pq.size() == 1) {
            HuffmanNode node = pq.poll();
            return new HuffmanNode(node.freq, node, null);
        }

        while (pq.size() > 1) {
            HuffmanNode left = pq.poll();
            HuffmanNode right = pq.poll();
            pq.offer(new HuffmanNode(left.freq + right.freq, left, right));
        }
        return pq.poll();
    }

    /**
     * 从Huffman树生成编码表
     */
    private void generateCodes(HuffmanNode node, String code, Map<Character, String> codeTable) {
        if (node == null) return;
        if (node.isLeaf()) {
            codeTable.put(node.ch, code.isEmpty() ? "0" : code);
            return;
        }
        generateCodes(node.left, code + "0", codeTable);
        generateCodes(node.right, code + "1", codeTable);
    }

    /**
     * 压缩文本为比特串
     */
    public CompressResult compress(String text) {
        if (text == null || text.isEmpty()) {
            return new CompressResult("", Collections.emptyMap(), 0, 0, 0);
        }

        // 构建频率表和Huffman树
        Map<Character, Integer> freqTable = buildFrequencyTable(text);
        HuffmanNode root = buildTree(freqTable);

        // 生成编码表
        Map<Character, String> codeTable = new LinkedHashMap<>();
        generateCodes(root, "", codeTable);

        // 编码
        StringBuilder bits = new StringBuilder();
        for (char ch : text.toCharArray()) {
            bits.append(codeTable.get(ch));
        }

        int originalBits = text.getBytes(StandardCharsets.UTF_8).length * 8;
        int compressedBits = bits.length();
        double ratio = originalBits > 0 ? (1.0 - (double) compressedBits / originalBits) * 100 : 0;

        return new CompressResult(bits.toString(), codeTable, originalBits, compressedBits, ratio);
    }

    /**
     * 从比特串和编码表解压
     */
    public String decompress(String compressedBits, Map<Character, String> codeTable) {
        if (compressedBits == null || compressedBits.isEmpty() || codeTable.isEmpty()) {
            return "";
        }

        // 构建反向编码表
        Map<String, Character> reverseTable = new HashMap<>();
        for (Map.Entry<Character, String> entry : codeTable.entrySet()) {
            reverseTable.put(entry.getValue(), entry.getKey());
        }

        // 解码
        StringBuilder result = new StringBuilder();
        StringBuilder currentCode = new StringBuilder();
        for (char bit : compressedBits.toCharArray()) {
            currentCode.append(bit);
            String code = currentCode.toString();
            if (reverseTable.containsKey(code)) {
                result.append(reverseTable.get(code));
                currentCode.setLength(0);
            }
        }
        return result.toString();
    }

    /**
     * 压缩为字节数组
     */
    public ByteCompressResult compressToBytes(String text) {
        CompressResult bitResult = compress(text);
        if (bitResult.getCompressedBits().isEmpty()) {
            return new ByteCompressResult(new byte[0], bitResult.getCodeTable(), 0, 0, 0);
        }

        String bits = bitResult.getCompressedBits();
        // 补齐到8的倍数
        int paddingBits = (8 - bits.length() % 8) % 8;
        StringBuilder paddedBits = new StringBuilder(bits);
        for (int i = 0; i < paddingBits; i++) {
            paddedBits.append('0');
        }

        // 转为字节数组
        byte[] data = new byte[paddedBits.length() / 8];
        for (int i = 0; i < data.length; i++) {
            String byteStr = paddedBits.substring(i * 8, i * 8 + 8);
            data[i] = (byte) Integer.parseInt(byteStr, 2);
        }

        int originalBytes = text.getBytes(StandardCharsets.UTF_8).length;
        double ratio = originalBytes > 0 ? (1.0 - (double) data.length / originalBytes) * 100 : 0;

        return new ByteCompressResult(data, bitResult.getCodeTable(),
                text.length(), paddingBits, ratio);
    }

    /**
     * 从字节数组解压
     */
    public String decompressFromBytes(byte[] compressedData, Map<Character, String> codeTable,
                                      int originalLength, int paddingBits) {
        if (compressedData == null || compressedData.length == 0) return "";

        // 字节转比特串
        StringBuilder bits = new StringBuilder();
        for (byte b : compressedData) {
            String byteStr = String.format("%8s", Integer.toBinaryString(b & 0xFF)).replace(' ', '0');
            bits.append(byteStr);
        }

        // 移除补齐位
        if (paddingBits > 0) {
            bits.setLength(bits.length() - paddingBits);
        }

        return decompress(bits.toString(), codeTable);
    }

    /**
     * 压缩日记内容（返回Base64编码字符串，便于存储）
     */
    public Map<String, Object> compressDiaryContent(String content) {
        if (content == null || content.isEmpty()) {
            return Map.of("compressed", "", "ratio", 0.0, "originalLength", 0);
        }

        ByteCompressResult result = compressToBytes(content);
        String base64 = Base64.getEncoder().encodeToString(result.getCompressedData());

        // 序列化编码表
        Map<String, String> serializableCodeTable = new LinkedHashMap<>();
        for (Map.Entry<Character, String> entry : result.getCodeTable().entrySet()) {
            serializableCodeTable.put(String.valueOf(entry.getKey()), entry.getValue());
        }

        Map<String, Object> resultMap = new LinkedHashMap<>();
        resultMap.put("compressed", base64);
        resultMap.put("codeTable", serializableCodeTable);
        resultMap.put("originalLength", result.getOriginalLength());
        resultMap.put("paddingBits", result.getPaddingBits());
        resultMap.put("compressionRatio", result.getCompressionRatio());
        resultMap.put("originalSize", content.getBytes(StandardCharsets.UTF_8).length);
        resultMap.put("compressedSize", result.getCompressedData().length);
        return resultMap;
    }

    /**
     * 解压日记内容
     */
    @SuppressWarnings("unchecked")
    public String decompressDiaryContent(Map<String, Object> compressedInfo) {
        if (compressedInfo == null) return "";

        String base64 = (String) compressedInfo.get("compressed");
        if (base64 == null || base64.isEmpty()) return "";

        byte[] data = Base64.getDecoder().decode(base64);
        int originalLength = ((Number) compressedInfo.get("originalLength")).intValue();
        int paddingBits = ((Number) compressedInfo.get("paddingBits")).intValue();

        // 还原编码表
        Map<String, String> serializableCodeTable = (Map<String, String>) compressedInfo.get("codeTable");
        Map<Character, String> codeTable = new LinkedHashMap<>();
        for (Map.Entry<String, String> entry : serializableCodeTable.entrySet()) {
            codeTable.put(entry.getKey().charAt(0), entry.getValue());
        }

        return decompressFromBytes(data, codeTable, originalLength, paddingBits);
    }

    /**
     * 获取压缩统计信息
     */
    public Map<String, Object> getCompressionStats(String text) {
        CompressResult result = compress(text);
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("originalBits", result.getOriginalLength());
        stats.put("compressedBits", result.getCompressedLength());
        stats.put("compressionRatio", String.format("%.2f%%", result.getCompressionRatio()));
        stats.put("uniqueChars", result.getCodeTable().size());
        stats.put("textLength", text != null ? text.length() : 0);
        return stats;
    }
}
