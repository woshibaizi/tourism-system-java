package com.tourism.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.tourism.model.entity.TravelDiary;
import com.tourism.mapper.DiaryMapper;
import com.tourism.utils.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

@Tag(name = "旅游日记模块")
@RestController
@RequestMapping("/api/diaries")
public class DiaryController {

    private final DiaryMapper diaryMapper;

    public DiaryController(DiaryMapper diaryMapper) {
        this.diaryMapper = diaryMapper;
    }

    @Operation(summary = "分页查询日记列表")
    @GetMapping
    public Result<Page<TravelDiary>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String placeId) {

        LambdaQueryWrapper<TravelDiary> wrapper = new LambdaQueryWrapper<>();
        if (placeId != null) {
            wrapper.eq(TravelDiary::getPlaceId, placeId);
        }
        wrapper.orderByDesc(TravelDiary::getCreatedAt);
        return Result.success(diaryMapper.selectPage(new Page<>(page, size), wrapper));
    }

    @Operation(summary = "获取日记详情")
    @GetMapping("/{id}")
    public Result<TravelDiary> detail(@PathVariable String id) {
        TravelDiary diary = diaryMapper.selectById(id);
        if (diary == null) {
            return Result.fail(404, "日记不存在");
        }
        return Result.success(diary);
    }
}
