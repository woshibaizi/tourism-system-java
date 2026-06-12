package com.tourism.algorithm;

import org.junit.jupiter.api.Test;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class HuffmanCompressionTest {

    private final HuffmanCompression huffman = new HuffmanCompression();

    @Test
    void compressDecompressRoundTrip_plainText() {
        String original = "hello world";
        HuffmanCompression.CompressResult result = huffman.compress(original);
        String restored = huffman.decompress(result.getCompressedBits(), result.getCodeTable());
        assertEquals(original, restored);
    }

    @Test
    void compressDecompressRoundTrip_chineseText() {
        String original = "你好世界，欢迎来到旅游系统";
        HuffmanCompression.CompressResult result = huffman.compress(original);
        String restored = huffman.decompress(result.getCompressedBits(), result.getCodeTable());
        assertEquals(original, restored);
    }

    @Test
    void compressDecompressRoundTrip_singleCharRepeated() {
        String original = "aaaaa";
        HuffmanCompression.CompressResult result = huffman.compress(original);
        String restored = huffman.decompress(result.getCompressedBits(), result.getCodeTable());
        assertEquals(original, restored);
    }

    @Test
    void compress_emptyString() {
        HuffmanCompression.CompressResult result = huffman.compress("");
        assertEquals("", result.getCompressedBits());
        assertEquals(0, result.getOriginalLength());
    }

    @Test
    void compress_nullString() {
        HuffmanCompression.CompressResult result = huffman.compress(null);
        assertEquals("", result.getCompressedBits());
        assertEquals(0, result.getCompressionRatio());
    }

    @Test
    void byteCompressDecompressRoundTrip() {
        String original = "This is a test for byte-level Huffman compression.";
        HuffmanCompression.ByteCompressResult result = huffman.compressToBytes(original);
        String restored = huffman.decompressFromBytes(
                result.getCompressedData(), result.getCodeTable(),
                result.getOriginalLength(), result.getPaddingBits());
        assertEquals(original, restored);
    }

    @Test
    void diaryContentCompressDecompressRoundTrip() {
        String original = "今天游览了美丽的西湖，风景如画，令人流连忘返。";
        Map<String, Object> compressed = huffman.compressDiaryContent(original);
        String restored = huffman.decompressDiaryContent(compressed);
        assertEquals(original, restored);
    }

    @Test
    void getCompressionStats() {
        String text = "hello hello hello world";
        Map<String, Object> stats = huffman.getCompressionStats(text);
        assertTrue(stats.containsKey("compressionRatio"));
        assertTrue(stats.containsKey("uniqueChars"));
        assertEquals(text.length(), ((Number) stats.get("textLength")).intValue());
    }
}
