package com.tourism.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.tourism.algorithm.ACAutomaton;
import com.tourism.algorithm.HuffmanCompression;
import com.tourism.algorithm.RecommendationAlgorithm;
import com.tourism.algorithm.SearchAlgorithm;
import com.tourism.exception.BusinessException;
import com.tourism.mapper.DiaryMapper;
import com.tourism.model.entity.SpotPlace;
import com.tourism.model.entity.SysUser;
import com.tourism.model.entity.TravelDiary;
import com.tourism.model.entity.UserBehavior;
import com.tourism.service.DiaryService;
import com.tourism.service.PlaceService;
import com.tourism.service.UserBehaviorService;
import com.tourism.service.UserService;
import com.tourism.utils.JsonUtils;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import jakarta.annotation.PostConstruct;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import com.tourism.mapper.XhsPublishLogMapper;
import com.tourism.model.entity.XhsPublishLog;
import com.tourism.service.AgentClient;
import com.tourism.service.XhsAccountService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;

import java.time.Duration;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class DiaryServiceImpl extends ServiceImpl<DiaryMapper, TravelDiary> implements DiaryService {

    private static final Logger log = LoggerFactory.getLogger(DiaryServiceImpl.class);
    private static final String HUFFMAN_STORAGE_TYPE = "huffman_v1";
    private static final Pattern DIARY_ID_PATTERN = Pattern.compile("^diary_(\\d+)");
    private static final List<String> DEFAULT_SENSITIVE_PATTERNS = List.of(
            "暴恐", "毒品", "诈骗", "违禁", "仇恨"
    );

    private final HuffmanCompression huffmanCompression;
    private final ACAutomaton acAutomaton;
    private final SearchAlgorithm searchAlgorithm;
    private final RecommendationAlgorithm recommendationAlgorithm;
    private final UserService userService;
    private final UserBehaviorService userBehaviorService;
    private final PlaceService placeService;
    private final XhsAccountService xhsAccountService;
    private final AgentClient agentClient;
    private final RedisTemplate<String, Object> redisTemplate;
    private final XhsPublishLogMapper xhsPublishLogMapper;
    private final ObjectMapper objectMapper;

    @Value("${app.base-url:http://localhost:8080/api}")
    private String baseUrl;

    private static final String XHS_RATE_LIMIT_KEY = "xhs:publish:rate:";
    private static final Duration XHS_RATE_LIMIT_WINDOW = Duration.ofMinutes(1);

    public DiaryServiceImpl(HuffmanCompression huffmanCompression,
                            ACAutomaton acAutomaton,
                            SearchAlgorithm searchAlgorithm,
                            RecommendationAlgorithm recommendationAlgorithm,
                            UserService userService,
                            UserBehaviorService userBehaviorService,
                            PlaceService placeService,
                            XhsAccountService xhsAccountService,
                            AgentClient agentClient,
                            RedisTemplate<String, Object> redisTemplate,
                            XhsPublishLogMapper xhsPublishLogMapper,
                            ObjectMapper objectMapper) {
        this.huffmanCompression = huffmanCompression;
        this.acAutomaton = acAutomaton;
        this.searchAlgorithm = searchAlgorithm;
        this.recommendationAlgorithm = recommendationAlgorithm;
        this.userService = userService;
        this.userBehaviorService = userBehaviorService;
        this.placeService = placeService;
        this.xhsAccountService = xhsAccountService;
        this.agentClient = agentClient;
        this.redisTemplate = redisTemplate;
        this.xhsPublishLogMapper = xhsPublishLogMapper;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void initSensitivePatterns() {
        acAutomaton.build(DEFAULT_SENSITIVE_PATTERNS);
    }

    @Override
    public IPage<TravelDiary> listDiaries(int page, int size, String placeId) {
        return listDiaries(page, size, placeId, null);
    }

    @Override
    public IPage<TravelDiary> listDiaries(int page, int size, String placeId, Long authorId) {
        LambdaQueryWrapper<TravelDiary> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(placeId)) {
            wrapper.eq(TravelDiary::getPlaceId, placeId);
        }
        if (authorId != null) {
            wrapper.eq(TravelDiary::getAuthorId, authorId);
        }
        wrapper.orderByDesc(TravelDiary::getCreatedAt);

        IPage<TravelDiary> result = page(new Page<>(page, size), wrapper);
        result.setRecords(result.getRecords().stream()
                .map(this::decorateDiary)
                .toList());
        return result;
    }

    @Override
    public TravelDiary getDiaryDetail(String id) {
        TravelDiary rawDiary = getById(id);
        if (rawDiary == null) {
            return null;
        }

        rawDiary.setClickCount((rawDiary.getClickCount() == null ? 0 : rawDiary.getClickCount()) + 1);
        updateById(rawDiary);
        return decorateDiary(rawDiary);
    }

    @Override
    public List<TravelDiary> listByAuthorId(Long authorId) {
        LambdaQueryWrapper<TravelDiary> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TravelDiary::getAuthorId, authorId)
                .orderByDesc(TravelDiary::getCreatedAt);
        return list(wrapper).stream()
                .map(this::decorateDiary)
                .toList();
    }

    @Override
    public List<TravelDiary> getHotDiaries(int limit) {
        LambdaQueryWrapper<TravelDiary> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByDesc(TravelDiary::getClickCount)
                .last("LIMIT " + limit);
        return list(wrapper).stream()
                .map(this::decorateDiary)
                .toList();
    }

    @Override
    public TravelDiary createDiary(Map<String, Object> payload) {
        String title = trimString(payload.get("title"));
        String content = trimString(payload.get("content"));
        String placeId = trimString(payload.get("placeId"));
        Long authorId = JsonUtils.convertValue(payload.get("authorId"), Long.class);

        validateDiaryPayload(title, content, authorId);
        ensureAuthorExists(authorId);

        TravelDiary diary = new TravelDiary();
        diary.setId(generateDiaryId());
        diary.setTitle(title);
        diary.setContent(encodeContentForStorage(content));
        diary.setPlaceId(placeId);
        diary.setAuthorId(authorId);
        diary.setClickCount(0);
        diary.setRating(BigDecimal.ZERO);
        diary.setRatingCount(0);
        diary.setImages(toJsonArrayString(payload.get("images")));
        diary.setVideos(toJsonArrayString(payload.get("videos")));
        diary.setTags(toJsonArrayString(payload.get("tags")));

        save(diary);
        return decorateDiary(diary);
    }

    @Override
    public TravelDiary updateDiary(String id, Map<String, Object> payload) {
        TravelDiary rawDiary = getById(id);
        if (rawDiary == null) {
            throw new BusinessException(404, "日记不存在");
        }

        if (payload.containsKey("title")) {
            String title = trimString(payload.get("title"));
            if (!StringUtils.hasText(title)) {
                throw new BusinessException(400, "标题不能为空");
            }
            rawDiary.setTitle(title);
        }
        if (payload.containsKey("content")) {
            String content = trimString(payload.get("content"));
            if (!StringUtils.hasText(content)) {
                throw new BusinessException(400, "日记内容不能为空");
            }
            rawDiary.setContent(encodeContentForStorage(content));
        }
        if (payload.containsKey("placeId")) {
            rawDiary.setPlaceId(trimString(payload.get("placeId")));
        }
        if (payload.containsKey("images")) {
            rawDiary.setImages(toJsonArrayString(payload.get("images")));
        }
        if (payload.containsKey("videos")) {
            rawDiary.setVideos(toJsonArrayString(payload.get("videos")));
        }
        if (payload.containsKey("tags")) {
            rawDiary.setTags(toJsonArrayString(payload.get("tags")));
        }
        rawDiary.setUpdatedAt(LocalDateTime.now());

        updateById(rawDiary);
        return decorateDiary(rawDiary);
    }

    @Override
    public boolean deleteDiary(String id) {
        return removeById(id);
    }

    @Override
    public List<TravelDiary> searchDiaries(String query, String type) {
        List<TravelDiary> diaries = list(new LambdaQueryWrapper<TravelDiary>()
                .orderByDesc(TravelDiary::getCreatedAt))
                .stream()
                .map(this::decorateDiary)
                .toList();

        if (!StringUtils.hasText(query)) {
            return diaries;
        }

        Map<String, String> placeNameMap = getPlaceNameMap();
        Map<String, TravelDiary> diaryMap = diaries.stream()
                .collect(Collectors.toMap(TravelDiary::getId, diary -> diary, (a, b) -> a, LinkedHashMap::new));
        List<Map<String, Object>> diaryItems = diaries.stream()
                .map(diary -> toDiaryItem(diary, placeNameMap))
                .toList();

        List<Map<String, Object>> matchedItems;
        String normalizedType = StringUtils.hasText(type) ? type.trim().toLowerCase() : "fulltext";
        switch (normalizedType) {
            case "destination" -> matchedItems = diaryItems.stream()
                    .filter(item -> String.valueOf(item.getOrDefault("destinationName", ""))
                            .toLowerCase().contains(query.toLowerCase()))
                    .sorted((a, b) -> compareDiaryScore(b, a))
                    .toList();
            case "title" -> {
                Map<String, List<Map<String, Object>>> titleIndex = searchAlgorithm.buildDiaryTitleIndex(diaryItems);
                matchedItems = searchAlgorithm.searchDiaryByTitleHash(titleIndex, query.trim());
                if (matchedItems.isEmpty()) {
                    matchedItems = searchAlgorithm.searchDiaryByTitleHashFuzzy(titleIndex, query.trim(), 0.25);
                }
            }
            case "content" -> matchedItems = searchAlgorithm.unifiedSearch(
                    diaryItems,
                    query,
                    List.of("content"),
                    "content"
            );
            default -> {
                // 标题优先，其次内容/目的地/标签
                List<Map<String, Object>> titleResults = searchAlgorithm.unifiedSearch(
                        diaryItems, query, List.of("title"), null);
                List<Map<String, Object>> fullResults = searchAlgorithm.unifiedSearch(
                        diaryItems, query, List.of("content", "destinationName", "tagsText"), "content");
                Set<Object> seen = new HashSet<>();
                List<Map<String, Object>> merged = new ArrayList<>();
                for (Map<String, Object> item : titleResults) {
                    Object id = item.get("id");
                    if (id != null && seen.add(id)) merged.add(item);
                }
                for (Map<String, Object> item : fullResults) {
                    Object id = item.get("id");
                    if (id != null && seen.add(id)) merged.add(item);
                }
                matchedItems = merged;
            }
        }

        return matchedItems.stream()
                .map(item -> diaryMap.get(String.valueOf(item.get("id"))))
                .filter(Objects::nonNull)
                .toList();
    }

    @Override
    public List<TravelDiary> recommendDiaries(Long userId, String algorithm, int topK) {
        int normalizedTopK = topK <= 0 ? 12 : topK;
        List<TravelDiary> diaries = list().stream()
                .map(this::decorateDiary)
                .toList();
        if (diaries.isEmpty()) {
            return Collections.emptyList();
        }

        if ("popular".equalsIgnoreCase(algorithm) || "hot".equalsIgnoreCase(algorithm)) {
            return diaries.stream()
                    .sorted((a, b) -> {
                        int clickCompare = Integer.compare(
                                b.getClickCount() == null ? 0 : b.getClickCount(),
                                a.getClickCount() == null ? 0 : a.getClickCount()
                        );
                        if (clickCompare != 0) {
                            return clickCompare;
                        }
                        return Double.compare(
                                b.getRating() == null ? 0 : b.getRating().doubleValue(),
                                a.getRating() == null ? 0 : a.getRating().doubleValue()
                        );
                    })
                    .limit(normalizedTopK)
                    .toList();
        }

        SysUser user = userId == null ? null : userService.getById(userId);
        List<String> userInterests = user == null ? Collections.emptyList() : JsonUtils.parseStringList(user.getInterests());
        Map<String, String> placeNameMap = getPlaceNameMap();
        List<Map<String, Object>> diaryItems = diaries.stream()
                .map(diary -> toDiaryItem(diary, placeNameMap))
                .toList();

        List<RecommendationAlgorithm.ScoredItem> recommendations =
                recommendationAlgorithm.recommendDiaries(userInterests, diaryItems, normalizedTopK);

        Map<String, TravelDiary> diaryMap = diaries.stream()
                .collect(Collectors.toMap(TravelDiary::getId, diary -> diary, (a, b) -> a, LinkedHashMap::new));

        return recommendations.stream()
                .map(item -> diaryMap.get(String.valueOf(item.getItem().get("id"))))
                .filter(Objects::nonNull)
                .toList();
    }

    @Override
    public Map<String, Object> toggleLike(String diaryId, Long userId) {
        if (userId == null) {
            throw new BusinessException(400, "用户ID不能为空");
        }
        TravelDiary diary = getById(diaryId);
        if (diary == null) {
            throw new BusinessException(404, "日记不存在");
        }

        LambdaQueryWrapper<UserBehavior> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(UserBehavior::getUserId, userId)
                .eq(UserBehavior::getTargetId, diaryId)
                .eq(UserBehavior::getBehaviorType, "LIKE");
        UserBehavior existing = userBehaviorService.getOne(wrapper, false);

        boolean liked;
        if (existing != null) {
            userBehaviorService.removeById(existing.getId());
            diary.setLikeCount(Math.max(0, (diary.getLikeCount() == null ? 0 : diary.getLikeCount()) - 1));
            liked = false;
        } else {
            UserBehavior behavior = new UserBehavior();
            behavior.setUserId(userId);
            behavior.setTargetId(diaryId);
            behavior.setBehaviorType("LIKE");
            behavior.setScore(java.math.BigDecimal.valueOf(1.0));
            userBehaviorService.save(behavior);
            diary.setLikeCount((diary.getLikeCount() == null ? 0 : diary.getLikeCount()) + 1);
            liked = true;
        }
        updateById(diary);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("liked", liked);
        result.put("likeCount", diary.getLikeCount());
        return result;
    }

    @Override
    public boolean hasUserLiked(String diaryId, Long userId) {
        if (userId == null) {
            return false;
        }
        LambdaQueryWrapper<UserBehavior> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(UserBehavior::getUserId, userId)
                .eq(UserBehavior::getTargetId, diaryId)
                .eq(UserBehavior::getBehaviorType, "LIKE");
        return userBehaviorService.count(wrapper) > 0;
    }

    @Override
    public List<TravelDiary> getLikedDiaries(Long userId) {
        if (userId == null) {
            return Collections.emptyList();
        }
        LambdaQueryWrapper<UserBehavior> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(UserBehavior::getUserId, userId)
                .eq(UserBehavior::getBehaviorType, "LIKE")
                .orderByDesc(UserBehavior::getCreatedAt);
        List<UserBehavior> likes = userBehaviorService.list(wrapper);

        List<String> diaryIds = likes.stream()
                .map(UserBehavior::getTargetId)
                .filter(id -> id != null && id.startsWith("diary_"))
                .toList();
        if (diaryIds.isEmpty()) {
            return Collections.emptyList();
        }

        List<TravelDiary> diaries = list(new LambdaQueryWrapper<TravelDiary>().in(TravelDiary::getId, diaryIds));
        Map<String, TravelDiary> diaryMap = diaries.stream()
                .collect(Collectors.toMap(TravelDiary::getId, d -> d, (a, b) -> a, LinkedHashMap::new));

        return diaryIds.stream()
                .map(diaryMap::get)
                .filter(Objects::nonNull)
                .map(this::decorateDiary)
                .toList();
    }

    @Override
    public TravelDiary rateDiary(String diaryId, Long userId, Double rating) {
        if (userId == null) {
            throw new BusinessException(400, "用户ID不能为空");
        }
        if (rating == null || rating < 1 || rating > 5) {
            throw new BusinessException(400, "评分必须在1到5之间");
        }
        TravelDiary rawDiary = getById(diaryId);
        if (rawDiary == null) {
            throw new BusinessException(404, "日记不存在");
        }

        userBehaviorService.recordBehavior(userId, diaryId, "RATE", rating);
        return decorateDiary(getById(diaryId));
    }

    @Override
    public Map<String, Object> publishToXhs(String diaryId, Long userId) {
        TravelDiary rawDiary = getById(diaryId);
        if (rawDiary == null) {
            throw new BusinessException(404, "日记不存在");
        }
        if (rawDiary.getXhsPublishStatus() != null && "published".equals(rawDiary.getXhsPublishStatus())) {
            throw new BusinessException(400, "该日记已发布到小红书");
        }

        // ── S1: 频率限制 (同一用户 1 分钟最多 1 次) ──
        String rateKey = XHS_RATE_LIMIT_KEY + userId;
        if (Boolean.TRUE.equals(redisTemplate.hasKey(rateKey))) {
            throw new BusinessException(429, "操作太频繁，请 1 分钟后再试");
        }
        redisTemplate.opsForValue().set(rateKey, "1", XHS_RATE_LIMIT_WINDOW);

        // ── S2: AC 自动机敏感内容检测 ──
        TravelDiary diary = decorateDiary(rawDiary);
        String contentText = trimString(diary.getContent());
        List<String> hits = acAutomaton.filterText(contentText).getDetectedWords();
        if (!hits.isEmpty()) {
            writePublishLog(userId, diaryId, "failed", null, null, "内容包含敏感词: " + String.join(", ", hits), null);
            throw new BusinessException(400, "内容包含敏感信息，请修改后重试");
        }

        // ── 解密 Cookie ──
        String cookiesStr;
        try {
            cookiesStr = xhsAccountService.decryptCookies(userId);
        } catch (Exception e) {
            writePublishLog(userId, diaryId, "failed", null, null, "Cookie 解密失败: 账号未绑定或已失效", null);
            throw new BusinessException(403, "小红书账号未绑定或已失效，请先绑定");
        }

        String placeName = "";
        if (diary.getPlaceId() != null) {
            SpotPlace place = placeService.getById(diary.getPlaceId());
            if (place != null) placeName = place.getName();
        }

        // ── 调 Python Agent 发布 ──
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("diary_id", diaryId);
        payload.put("title", diary.getTitle());
        payload.put("content", contentText);
        payload.put("tags", diary.getTags());
        payload.put("images", resolveUrls(diary.getImages()));
        payload.put("videos", resolveUrls(diary.getVideos()));
        payload.put("place_name", placeName);
        payload.put("cookies_str", cookiesStr);

        Map<String, Object> result;
        try {
            result = agentClient.xhsPublishDiary(payload);
        } catch (Exception e) {
            writePublishLog(userId, diaryId, "failed", null, null, "Agent 调用失败: " + e.getMessage(), null);
            throw new BusinessException(503, "小红书发布服务暂时不可用，请稍后重试");
        }

        // ── 回写状态 ──
        boolean ok = Boolean.TRUE.equals(result.get("ok"));
        if (ok) {
            rawDiary.setXhsPublishStatus("published");
            rawDiary.setXhsNoteId((String) result.get("note_id"));
            rawDiary.setXhsPublishUrl((String) result.get("publish_url"));
            rawDiary.setXhsPublishedAt(LocalDateTime.now());
        } else {
            rawDiary.setXhsPublishStatus("failed");
        }
        updateById(rawDiary);

        // ── BE2: 审计日志 ──
        writePublishLog(userId, diaryId,
                ok ? "publish" : "failed",
                ok ? (String) result.get("note_id") : null,
                ok ? toJson(payload) : null,
                ok ? null : (String) result.getOrDefault("error", "未知错误"),
                null);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("ok", result.get("ok"));
        response.put("note_id", result.get("note_id"));
        response.put("publish_url", result.get("publish_url"));
        response.put("status", rawDiary.getXhsPublishStatus());
        if (result.get("error") != null) {
            response.put("error", result.get("error"));
        }
        return response;
    }

    /**
     * 将相对路径转为完整 URL，供 Python Agent 下载图片/视频。
     * 支持 List 或 JSON 字符串输入。
     */
    private List<String> resolveUrls(Object imagesOrVideos) {
        List<String> paths = JsonUtils.parseStringList(imagesOrVideos);
        if (paths.isEmpty()) return List.of();
        String normalizedBase = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        return paths.stream()
                .map(path -> {
                    if (path == null) return null;
                    if (path.startsWith("http://") || path.startsWith("https://")) return path;
                    return normalizedBase + "/" + path.replaceFirst("^/+", "");
                })
                .filter(Objects::nonNull)
                .toList();
    }

    // ── BE2: 审计日志写入 ──
    private void writePublishLog(Long userId, String diaryId, String action,
                                  String noteId, String requestSummary,
                                  String errorMsg, String ipAddress) {
        try {
            XhsPublishLog logEntry = new XhsPublishLog();
            logEntry.setUserId(userId);
            logEntry.setDiaryId(diaryId);
            logEntry.setAction(action);
            logEntry.setRequestSummary(requestSummary);
            if (noteId != null) {
                logEntry.setResponseData("{\"note_id\":\"" + noteId + "\"}");
            }
            logEntry.setErrorMsg(errorMsg);
            logEntry.setIpAddress(ipAddress);
            xhsPublishLogMapper.insert(logEntry);
        } catch (Exception e) {
            // 审计日志写入失败不应影响主流程
            log.warn("Failed to write XHS publish audit log for diary={}", diaryId, e);
        }
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private void validateDiaryPayload(String title, String content, Long authorId) {
        if (!StringUtils.hasText(title)) {
            throw new BusinessException(400, "日记标题不能为空");
        }
        if (!StringUtils.hasText(content)) {
            throw new BusinessException(400, "日记内容不能为空");
        }
        if (authorId == null) {
            throw new BusinessException(400, "作者不能为空");
        }
    }

    private void ensureAuthorExists(Long authorId) {
        if (userService.getById(authorId) == null) {
            throw new BusinessException(404, "作者不存在");
        }
    }

    private TravelDiary decorateDiary(TravelDiary rawDiary) {
        if (rawDiary == null) {
            return null;
        }
        TravelDiary diary = copyDiary(rawDiary);
        diary.setContent(decodeContent(rawDiary.getContent()));
        diary.setImages(normalizeJsonArrayString(rawDiary.getImages()));
        diary.setVideos(normalizeJsonArrayString(rawDiary.getVideos()));
        diary.setTags(normalizeJsonArrayString(rawDiary.getTags()));
        return diary;
    }

    private TravelDiary copyDiary(TravelDiary source) {
        TravelDiary target = new TravelDiary();
        target.setId(source.getId());
        target.setTitle(source.getTitle());
        target.setContent(source.getContent());
        target.setPlaceId(source.getPlaceId());
        target.setAuthorId(source.getAuthorId());
        target.setClickCount(source.getClickCount());
        target.setLikeCount(source.getLikeCount());
        target.setRating(source.getRating());
        target.setRatingCount(source.getRatingCount());
        target.setImages(source.getImages());
        target.setVideos(source.getVideos());
        target.setTags(source.getTags());
        target.setDeleted(source.getDeleted());
        target.setCreatedAt(source.getCreatedAt());
        target.setUpdatedAt(source.getUpdatedAt());
        target.setXhsPublishStatus(source.getXhsPublishStatus());
        target.setXhsNoteId(source.getXhsNoteId());
        target.setXhsPublishUrl(source.getXhsPublishUrl());
        target.setXhsPublishedAt(source.getXhsPublishedAt());
        return target;
    }

    private String encodeContentForStorage(String content) {
        ACAutomaton.FilterResult filterResult = acAutomaton.filterText(content);
        if (filterResult.getTotalMatches() > 0) {
            throw new BusinessException(400, "日记内容包含敏感词: " + String.join("、", filterResult.getDetectedWords()));
        }

        Map<String, Object> wrapper = new LinkedHashMap<>();
        wrapper.put("storageType", HUFFMAN_STORAGE_TYPE);
        wrapper.put("compressedInfo", huffmanCompression.compressDiaryContent(content));
        return JsonUtils.toJson(wrapper);
    }

    private String decodeContent(String storedContent) {
        if (!StringUtils.hasText(storedContent)) {
            return storedContent;
        }

        Map<String, Object> wrapper = JsonUtils.toMap(storedContent);
        if (!wrapper.isEmpty() && HUFFMAN_STORAGE_TYPE.equals(wrapper.get("storageType"))) {
            @SuppressWarnings("unchecked")
            Map<String, Object> compressedInfo = (Map<String, Object>) wrapper.get("compressedInfo");
            return huffmanCompression.decompressDiaryContent(compressedInfo);
        }
        return storedContent;
    }

    private String toJsonArrayString(Object value) {
        return JsonUtils.toJson(JsonUtils.parseStringList(value));
    }

    private String normalizeJsonArrayString(String value) {
        return JsonUtils.toJson(JsonUtils.parseStringList(value));
    }

    private String trimString(Object value) {
        return value == null ? null : String.valueOf(value).trim();
    }

    private String generateDiaryId() {
        List<TravelDiary> diaries = list(new LambdaQueryWrapper<TravelDiary>().select(TravelDiary::getId));
        int maxId = 0;
        for (TravelDiary diary : diaries) {
            if (!StringUtils.hasText(diary.getId())) {
                continue;
            }
            Matcher matcher = DIARY_ID_PATTERN.matcher(diary.getId());
            if (matcher.matches()) {
                maxId = Math.max(maxId, Integer.parseInt(matcher.group(1)));
            }
        }
        // 加时间戳后缀防止并发碰撞: diary_037_20260606120000
        String ts = java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS"));
        return String.format("diary_%03d_%s", maxId + 1, ts);
    }

    private Map<String, String> getPlaceNameMap() {
        return placeService.list().stream()
                .collect(Collectors.toMap(SpotPlace::getId, SpotPlace::getName, (a, b) -> a, LinkedHashMap::new));
    }

    private Map<String, Object> toDiaryItem(TravelDiary diary, Map<String, String> placeNameMap) {
        Map<String, Object> item = new LinkedHashMap<>(JsonUtils.toMap(diary));
        item.put("id", diary.getId());
        item.put("title", diary.getTitle());
        item.put("placeId", diary.getPlaceId());
        item.put("authorId", diary.getAuthorId());
        item.put("content", diary.getContent());
        item.put("destinationName", placeNameMap.getOrDefault(diary.getPlaceId(), ""));
        item.put("tagsText", String.join(" ", JsonUtils.parseStringList(diary.getTags())));
        item.put("clickCount", diary.getClickCount() == null ? 0 : diary.getClickCount());
        item.put("rating", diary.getRating() == null ? BigDecimal.ZERO : diary.getRating());
        return item;
    }

    private int compareDiaryScore(Map<String, Object> left, Map<String, Object> right) {
        int clickCompare = Double.compare(toDouble(left.get("clickCount")), toDouble(right.get("clickCount")));
        if (clickCompare != 0) {
            return clickCompare;
        }
        return Double.compare(toDouble(left.get("rating")), toDouble(right.get("rating")));
    }

    private double toDouble(Object value) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        return 0;
    }
}
