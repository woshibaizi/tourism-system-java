package com.tourism.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.tourism.model.entity.TravelDiary;
import com.tourism.service.DiaryService;
import com.tourism.utils.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
            @Parameter(description = "场所ID") @RequestParam(required = false) String placeId) {

        return Result.success(diaryService.listDiaries(page, size, placeId));
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
}
