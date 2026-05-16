package com.tourism.algorithm;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class FibonacciHeapTest {

    @Test
    void emptyHeap() {
        FibonacciHeap<String> heap = new FibonacciHeap<>();
        assertTrue(heap.isEmpty());
        assertEquals(0, heap.size());
        assertNull(heap.findMin());
    }

    @Test
    void insert_and_findMin() {
        FibonacciHeap<String> heap = new FibonacciHeap<>();
        heap.insert(5.0, "five");
        heap.insert(3.0, "three");
        heap.insert(7.0, "seven");
        assertEquals(3.0, heap.findMin().getKey(), 0.001);
        assertEquals("three", heap.findMin().getData());
        assertEquals(3, heap.size());
    }

    @Test
    void extractMin_returnsInOrder() {
        FibonacciHeap<String> heap = new FibonacciHeap<>();
        heap.insert(5.0, "five");
        heap.insert(3.0, "three");
        heap.insert(7.0, "seven");

        assertEquals("three", heap.extractMin().getData());
        assertEquals("five", heap.extractMin().getData());
        assertEquals("seven", heap.extractMin().getData());
        assertTrue(heap.isEmpty());
    }

    @Test
    void decreaseKey_updatesMin() {
        FibonacciHeap<String> heap = new FibonacciHeap<>();
        heap.insert(5.0, "five");
        FibonacciHeap.Node<String> node = heap.insert(10.0, "ten");
        heap.insert(7.0, "seven");

        heap.decreaseKey(node, 2.0);
        assertEquals(2.0, heap.findMin().getKey(), 0.001);
        assertEquals("ten", heap.findMin().getData());
    }

    @Test
    void delete_removesNode() {
        FibonacciHeap<String> heap = new FibonacciHeap<>();
        heap.insert(3.0, "three");
        FibonacciHeap.Node<String> node = heap.insert(5.0, "five");
        heap.insert(7.0, "seven");

        heap.delete(node);
        assertEquals(2, heap.size());
        assertEquals("three", heap.extractMin().getData());
        assertEquals("seven", heap.extractMin().getData());
    }

    @Test
    void merge_twoHeaps() {
        FibonacciHeap<String> h1 = new FibonacciHeap<>();
        h1.insert(1.0, "a");
        h1.insert(5.0, "b");

        FibonacciHeap<String> h2 = new FibonacciHeap<>();
        h2.insert(2.0, "c");
        h2.insert(3.0, "d");

        FibonacciHeap<String> merged = h1.merge(h2);
        assertEquals(4, merged.size());
        assertEquals("a", merged.extractMin().getData());
        assertEquals("c", merged.extractMin().getData());
    }

    @Test
    void largeInsert_extractAll() {
        FibonacciHeap<Integer> heap = new FibonacciHeap<>();
        for (int i = 100; i >= 1; i--) {
            heap.insert(i, i);
        }
        assertEquals(100, heap.size());
        for (int i = 1; i <= 100; i++) {
            assertEquals(i, heap.extractMin().getData());
        }
        assertTrue(heap.isEmpty());
    }

    @Test
    void insert_duplicateKeys() {
        FibonacciHeap<String> heap = new FibonacciHeap<>();
        heap.insert(5.0, "a");
        heap.insert(5.0, "b");
        assertEquals(2, heap.size());
        assertNotNull(heap.extractMin());
        assertNotNull(heap.extractMin());
    }
}
