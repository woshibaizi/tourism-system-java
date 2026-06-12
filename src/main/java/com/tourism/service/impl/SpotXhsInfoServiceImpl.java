package com.tourism.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tourism.mapper.SpotXhsInfoMapper;
import com.tourism.model.entity.SpotXhsInfo;
import com.tourism.service.AgentClient;
import com.tourism.service.SpotXhsInfoService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;

@Service
public class SpotXhsInfoServiceImpl
        extends ServiceImpl<SpotXhsInfoMapper, SpotXhsInfo>
        implements SpotXhsInfoService {

    private static final Logger log = LoggerFactory.getLogger(SpotXhsInfoServiceImpl.class);
    private static final String REDIS_PREFIX = "spot:xhs:";
    private static final Duration CACHE_TTL = Duration.ofDays(7);

    private final AgentClient agentClient;
    private final ObjectMapper objectMapper;
    private final RedisTemplate<String, Object> redisTemplate;

    public SpotXhsInfoServiceImpl(AgentClient agentClient,
                                   ObjectMapper objectMapper,
                                   RedisTemplate<String, Object> redisTemplate) {
        this.agentClient = agentClient;
        this.objectMapper = objectMapper;
        this.redisTemplate = redisTemplate;
    }

    @Override
    public SpotXhsInfo getByPlaceId(String placeId) {
        // 先查 Redis 缓存
        String cacheKey = REDIS_PREFIX + placeId;
        Object cached = redisTemplate.opsForValue().get(cacheKey);
        if (cached instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> cachedMap = (Map<String, Object>) cached;
            return mapToEntity(placeId, cachedMap);
        }

        // Redis miss → 查 MySQL
        LambdaQueryWrapper<SpotXhsInfo> q = new LambdaQueryWrapper<>();
        q.eq(SpotXhsInfo::getPlaceId, placeId);
        SpotXhsInfo info = getOne(q);

        // 回写 Redis
        if (info != null) {
            try {
                Map<String, Object> map = objectMapper.readValue(
                        objectMapper.writeValueAsString(info), Map.class);
                redisTemplate.opsForValue().set(cacheKey, map, CACHE_TTL);
            } catch (JsonProcessingException e) {
                log.warn("Failed to cache SpotXhsInfo for placeId={}", placeId, e);
            }
        }

        return info;
    }

    @Override
    public SpotXhsInfo refreshXhsData(String placeId, String placeName, String placeType) {
        // 调用 Python Agent 抓取
        Map<String, Object> agentResult = agentClient.xhsRefreshPlace(placeName, placeId, placeType);

        if (agentResult == null || !Boolean.TRUE.equals(agentResult.get("ok"))) {
            log.warn("XHS refresh returned error for place={}: {}", placeId,
                    agentResult != null ? agentResult.get("error") : "null response");
            // 返回当前已有数据（可能为 null）
            return getByPlaceId(placeId);
        }

        // 保存到数据库 + Redis
        return saveFromAgentResult(placeId, agentResult);
    }

    @Override
    @SuppressWarnings("unchecked")
    public SpotXhsInfo saveFromAgentResult(String placeId, Map<String, Object> agentResult) {
        SpotXhsInfo info = mapToEntity(placeId, agentResult);

        // UPSERT: 存在则更新，不存在则插入
        LambdaQueryWrapper<SpotXhsInfo> q = new LambdaQueryWrapper<>();
        q.eq(SpotXhsInfo::getPlaceId, placeId);
        SpotXhsInfo existing = getOne(q);
        if (existing != null) {
            info.setId(existing.getId());
            info.setCreatedAt(existing.getCreatedAt());
            updateById(info);
        } else {
            save(info);
        }

        // 写 Redis 缓存
        try {
            String cacheKey = REDIS_PREFIX + placeId;
            Map<String, Object> cacheMap = objectMapper.readValue(
                    objectMapper.writeValueAsString(info), Map.class);
            redisTemplate.opsForValue().set(cacheKey, cacheMap, CACHE_TTL);
        } catch (JsonProcessingException e) {
            log.warn("Failed to write Redis cache for placeId={}", placeId, e);
        }

        return info;
    }

    // ── 内部方法 ──

    @SuppressWarnings("unchecked")
    private SpotXhsInfo mapToEntity(String placeId, Map<String, Object> map) {
        SpotXhsInfo info = new SpotXhsInfo();
        info.setPlaceId(placeId);
        info.setPlaceName(stringOrNull(map.get("place_name")));
        info.setTrendingScore(intOrNull(map.get("trending_score")));
        info.setNoteCount(intOrNull(map.get("note_count")));
        info.setTopNotes(toJson(map.get("top_notes")));
        info.setTopTags(toJson(map.get("top_tags")));
        info.setTopKeywords(toJson(map.get("top_keywords")));
        info.setSearchQueries(toJson(map.get("search_queries")));

        Object expires = map.get("cache_expires");
        if (expires instanceof String s && !s.isBlank()) {
            try { info.setCacheExpires(LocalDateTime.parse(s.substring(0, 19))); }
            catch (Exception e) { info.setCacheExpires(LocalDateTime.now().plusDays(7)); }
        } else {
            info.setCacheExpires(LocalDateTime.now().plusDays(7));
        }

        info.setLastUpdated(LocalDateTime.now());
        return info;
    }

    private String toJson(Object obj) {
        if (obj == null) return null;
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private String stringOrNull(Object obj) {
        return obj instanceof String s ? s : null;
    }

    private Integer intOrNull(Object obj) {
        if (obj instanceof Integer i) return i;
        if (obj instanceof Number n) return n.intValue();
        return 0;
    }
}
