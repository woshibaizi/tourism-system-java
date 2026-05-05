package com.tourism.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.tourism.model.entity.TravelDiary;
import com.tourism.service.DiaryService;
import com.tourism.utils.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Tag(name = "旅游日记模块")
@RestController
@RequestMapping("/api/diaries")
public class DiaryController {

    private final DiaryService diaryService;

    public DiaryController(DiaryService diaryService) {
        this.diaryService = diaryService;
    }

    @Operation(summary = "分页查询日记列表")
    @GetMapping
    public Result<IPage<TravelDiary>> list(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") Integer page,
            @Parameter(description = "每页条数") @RequestParam(defaultValue = "10") Integer size,
            @Parameter(description = "场所ID") @RequestParam(required = false) String placeId,
            @Parameter(description = "作者ID") @RequestParam(required = false) Long authorId) {

        return Result.success(diaryService.listDiaries(page, size, placeId, authorId));
    }

    @Operation(summary = "获取日记详情")
    @GetMapping("/{id}")
    public Result<TravelDiary> detail(@PathVariable String id) {
        TravelDiary diary = diaryService.getDiaryDetail(id);
        if (diary == null) {
            return Result.fail(404, "日记不存在");
        }
        return Result.success(diary);
    }

    @Operation(summary = "根据作者ID查询日记")
    @GetMapping("/author/{authorId}")
    public Result<List<TravelDiary>> listByAuthor(@PathVariable Long authorId) {
        return Result.success(diaryService.listByAuthorId(authorId));
    }

    @Operation(summary = "获取热门日记")
    @GetMapping("/hot")
    public Result<List<TravelDiary>> hotDiaries(
            @Parameter(description = "返回条数") @RequestParam(defaultValue = "10") Integer limit) {
        return Result.success(diaryService.getHotDiaries(limit));
    }

    @Operation(summary = "创建日记")
    @PostMapping
    public Result<TravelDiary> create(@RequestBody Map<String, Object> payload) {
        return Result.success(diaryService.createDiary(payload));
    }

    @Operation(summary = "更新日记")
    @PutMapping("/{id}")
    public Result<TravelDiary> update(@PathVariable String id, @RequestBody Map<String, Object> payload) {
        return Result.success(diaryService.updateDiary(id, payload));
    }

    @Operation(summary = "删除日记")
    @DeleteMapping("/{id}")
    public Result<Map<String, Object>> delete(@PathVariable String id) {
        boolean deleted = diaryService.deleteDiary(id);
        if (!deleted) {
            return Result.fail(404, "日记不存在");
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("deletedId", id);
        return Result.success(data);
    }

    @Operation(summary = "搜索日记")
    @GetMapping("/search")
    public Result<List<TravelDiary>> search(@RequestParam String query,
                                            @RequestParam(defaultValue = "fulltext") String type) {
        return Result.success(diaryService.searchDiaries(query, type));
    }

    @Operation(summary = "推荐日记")
    @PostMapping("/recommend")
    public Result<List<TravelDiary>> recommend(@RequestBody Map<String, Object> payload) {
        Long userId = payload.get("userId") instanceof Number number ? number.longValue() : null;
        String algorithm = payload.get("algorithm") == null ? "content" : String.valueOf(payload.get("algorithm"));
        int topK = payload.get("topK") instanceof Number number ? number.intValue() : 12;
        return Result.success(diaryService.recommendDiaries(userId, algorithm, topK));
    }

    @Operation(summary = "日记评分")
    @PostMapping("/{id}/rate")
    public Result<Map<String, Object>> rate(@PathVariable String id, @RequestBody Map<String, Object> payload) {
        Long userId = payload.get("userId") instanceof Number number ? number.longValue() : null;
        Double rating = payload.get("rating") instanceof Number number ? number.doubleValue() : null;
        if (userId == null) {
            return Result.fail(400, "用户ID不能为空");
        }
        if (rating == null || rating < 1 || rating > 5) {
            return Result.fail(400, "评分必须在1到5之间");
        }
        TravelDiary diary = diaryService.rateDiary(id, userId, rating);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("rating", diary.getRating());
        data.put("ratingCount", diary.getRatingCount());
        data.put("userRating", rating);
        return Result.success(data);
    }
}
