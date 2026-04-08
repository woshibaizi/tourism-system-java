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
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class DiaryServiceImpl extends ServiceImpl<DiaryMapper, TravelDiary> implements DiaryService {

    private static final String HUFFMAN_STORAGE_TYPE = "huffman_v1";
    private static final Pattern DIARY_ID_PATTERN = Pattern.compile("^diary_(\\d+)$");
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

    public DiaryServiceImpl(HuffmanCompression huffmanCompression,
                            ACAutomaton acAutomaton,
                            SearchAlgorithm searchAlgorithm,
                            RecommendationAlgorithm recommendationAlgorithm,
                            UserService userService,
                            UserBehaviorService userBehaviorService,
                            PlaceService placeService) {
        this.huffmanCompression = huffmanCompression;
        this.acAutomaton = acAutomaton;
        this.searchAlgorithm = searchAlgorithm;
        this.recommendationAlgorithm = recommendationAlgorithm;
        this.userService = userService;
        this.userBehaviorService = userBehaviorService;
        this.placeService = placeService;
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
            case "content" -> matchedItems = searchAlgorithm.fullTextSearch(diaryItems, query, "content");
            default -> matchedItems = searchAlgorithm.unifiedSearch(
                    diaryItems,
                    query,
                    List.of("title", "content", "destinationName", "tagsText"),
                    "content"
            );
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
        target.setRating(source.getRating());
        target.setRatingCount(source.getRatingCount());
        target.setImages(source.getImages());
        target.setVideos(source.getVideos());
        target.setTags(source.getTags());
        target.setDeleted(source.getDeleted());
        target.setCreatedAt(source.getCreatedAt());
        target.setUpdatedAt(source.getUpdatedAt());
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
        return String.format("diary_%03d", maxId + 1);
    }

    private Map<String, String> getPlaceNameMap() {
        return placeService.list().stream()
                .collect(Collectors.toMap(SpotPlace::getId, SpotPlace::getName, (a, b) -> a, LinkedHashMap::new));
    }

    private Map<String, Object> toDiaryItem(TravelDiary diary, Map<String, String> placeNameMap) {
        Map<String, Object> item = JsonUtils.toMap(diary);
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
