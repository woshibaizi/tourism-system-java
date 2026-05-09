package com.tourism.utils;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * JSON 字段读写工具
 */
public final class JsonUtils {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private JsonUtils() {
    }

    public static String toJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return OBJECT_MAPPER.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalArgumentException("JSON序列化失败: " + e.getMessage(), e);
        }
    }

    public static Map<String, Object> toMap(Object value) {
        if (value == null) {
            return Collections.emptyMap();
        }
        if (value instanceof String text) {
            String trimmed = text.trim();
            if (trimmed.isEmpty()) {
                return Collections.emptyMap();
            }
            try {
                return OBJECT_MAPPER.readValue(trimmed, new TypeReference<>() {});
            } catch (Exception ignored) {
                return Collections.emptyMap();
            }
        }
        if (value instanceof Map<?, ?> mapValue) {
            Map<String, Object> result = new LinkedHashMap<>();
            mapValue.forEach((k, v) -> result.put(String.valueOf(k), v));
            return result;
        }
        try {
            return OBJECT_MAPPER.convertValue(value, new TypeReference<>() {});
        } catch (Exception e) {
            return Collections.emptyMap();
        }
    }

    public static <T> T convertValue(Object value, Class<T> targetType) {
        if (value == null) {
            return null;
        }
        try {
            return OBJECT_MAPPER.convertValue(value, targetType);
        } catch (Exception e) {
            return null;
        }
    }

    public static List<String> parseStringList(Object value) {
        if (value == null) {
            return Collections.emptyList();
        }
        if (value instanceof Collection<?> collection) {
            List<String> result = new ArrayList<>();
            for (Object item : collection) {
                String text = stringListItemValue(item);
                if (!text.isEmpty()) {
                    result.add(text);
                }
            }
            return result;
        }

        String text = String.valueOf(value).trim();
        if (text.isEmpty()) {
            return Collections.emptyList();
        }

        try {
            List<String> parsed = OBJECT_MAPPER.readValue(text, new TypeReference<>() {});
            return parsed == null ? Collections.emptyList() : parsed;
        } catch (Exception ignored) {
            String[] parts = text.split("[,，]");
            List<String> result = new ArrayList<>();
            for (String part : parts) {
                String item = part.trim();
                if (!item.isEmpty()) {
                    result.add(item);
                }
            }
            return result;
        }
    }

    private static String stringListItemValue(Object item) {
        if (item == null) {
            return "";
        }
        if (item instanceof Map<?, ?> mapItem) {
            Object path = mapItem.get("path");
            if (path == null) path = mapItem.get("url");
            if (path == null) path = mapItem.get("videoPath");
            if (path == null) path = mapItem.get("imagePath");
            if (path != null) {
                return String.valueOf(path).trim();
            }
        }
        return String.valueOf(item).trim();
    }
}
