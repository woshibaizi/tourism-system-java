package com.tourism.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.tourism.model.entity.SpotSurrounding;
import com.tourism.service.SurroundingService;
import com.tourism.utils.GeoUtils;
import com.tourism.utils.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Tag(name = "校园周边")
@RestController
@RequestMapping("/api/surroundings")
public class SurroundingController {

    private final SurroundingService surroundingService;

    public SurroundingController(SurroundingService surroundingService) {
        this.surroundingService = surroundingService;
    }

    @Operation(summary = "分页查询周边商户")
    @GetMapping
    public Result<Page<SpotSurrounding>> list(
            @RequestParam(required = false) String placeId,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {

        LambdaQueryWrapper<SpotSurrounding> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(placeId)) {
            wrapper.eq(SpotSurrounding::getPlaceId, placeId);
        }
        if (StringUtils.hasText(type)) {
            wrapper.eq(SpotSurrounding::getType, type);
        }
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(SpotSurrounding::getName, keyword)
                    .or().like(SpotSurrounding::getDescription, keyword)
                    .or().like(SpotSurrounding::getTags, keyword));
        }
        wrapper.orderByAsc(SpotSurrounding::getType)
                .orderByAsc(SpotSurrounding::getDistanceMeters);
        Page<SpotSurrounding> resultPage = surroundingService.page(new Page<>(page, size), wrapper);
        return Result.success(resultPage);
    }

    @Operation(summary = "获取周边商户详情")
    @GetMapping("/{id}")
    public Result<SpotSurrounding> detail(@PathVariable String id) {
        SpotSurrounding record = surroundingService.getById(id);
        if (record == null) {
            return Result.fail(404, "周边商户不存在");
        }
        return Result.success(record);
    }

    @Operation(summary = "根据校园ID查询周边商户")
    @GetMapping("/place/{placeId}")
    public Result<List<SpotSurrounding>> listByPlaceId(@PathVariable String placeId) {
        return Result.success(surroundingService.listByPlaceId(placeId));
    }

    @Operation(summary = "根据校园ID和类型查询周边商户")
    @GetMapping("/place/{placeId}/type/{type}")
    public Result<List<SpotSurrounding>> listByPlaceIdAndType(
            @PathVariable String placeId,
            @PathVariable String type) {
        return Result.success(surroundingService.listByPlaceIdAndType(placeId, type));
    }

    @Operation(summary = "搜索周边商户")
    @GetMapping("/search")
    public Result<List<SpotSurrounding>> search(
            @RequestParam String query,
            @RequestParam(required = false) String placeId,
            @RequestParam(required = false) String type) {
        LambdaQueryWrapper<SpotSurrounding> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(placeId)) {
            wrapper.eq(SpotSurrounding::getPlaceId, placeId);
        }
        if (StringUtils.hasText(type)) {
            wrapper.eq(SpotSurrounding::getType, type);
        }
        wrapper.and(w -> w.like(SpotSurrounding::getName, query)
                .or().like(SpotSurrounding::getDescription, query)
                .or().like(SpotSurrounding::getTags, query))
                .orderByDesc(SpotSurrounding::getRating)
                .orderByAsc(SpotSurrounding::getDistanceMeters)
                .last("limit 100");
        return Result.success(surroundingService.list(wrapper));
    }

    @Operation(summary = "LBS附近搜索（半径单位：米）")
    @GetMapping("/nearby")
    public Result<List<SpotSurrounding>> nearby(
            @RequestParam Double lat,
            @RequestParam Double lng,
            @RequestParam(defaultValue = "3000") Double radius,
            @RequestParam(required = false) String type) {

        LambdaQueryWrapper<SpotSurrounding> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(type)) {
            wrapper.eq(SpotSurrounding::getType, type);
        }

        List<SpotSurrounding> all = surroundingService.list(wrapper);
        List<SpotSurrounding> nearby = all.stream()
                .filter(s -> s.getLat() != null && s.getLng() != null)
                .filter(s -> GeoUtils.distance(lat, lng,
                        s.getLat().doubleValue(), s.getLng().doubleValue()) <= radius)
                .sorted((a, b) -> {
                    double da = GeoUtils.distance(lat, lng,
                            a.getLat().doubleValue(), a.getLng().doubleValue());
                    double db = GeoUtils.distance(lat, lng,
                            b.getLat().doubleValue(), b.getLng().doubleValue());
                    return Double.compare(da, db);
                })
                .collect(Collectors.toList());

        return Result.success(nearby);
    }

    @Operation(summary = "热门周边推荐")
    @GetMapping("/hot")
    public Result<List<SpotSurrounding>> hot(
            @RequestParam(defaultValue = "20") Integer limit) {
        return Result.success(surroundingService.listHot(limit));
    }

    @Operation(summary = "高分周边排行")
    @GetMapping("/top-rated")
    public Result<List<SpotSurrounding>> topRated(
            @RequestParam(defaultValue = "20") Integer limit) {
        return Result.success(surroundingService.listTopRated(limit));
    }

    @Operation(summary = "获取某校园周边的分类统计")
    @GetMapping("/categories/{placeId}")
    public Result<Map<String, Long>> categories(@PathVariable String placeId) {
        return Result.success(surroundingService.getCategoryCounts(placeId));
    }

    @Operation(summary = "获取所有地点的周边商户总数")
    @GetMapping("/counts-by-place")
    public Result<Map<String, Long>> countsByPlace() {
        return Result.success(surroundingService.getCountsByPlace());
    }

    @Operation(summary = "周边商户评分")
    @PostMapping("/{id}/rate")
    public Result<SpotSurrounding> rate(
            @PathVariable String id,
            @RequestParam BigDecimal score) {
        if (score.compareTo(BigDecimal.ZERO) < 0 || score.compareTo(new BigDecimal("5")) > 0) {
            return Result.fail(400, "评分范围: 0.0 ~ 5.0");
        }
        SpotSurrounding record = surroundingService.getById(id);
        if (record == null) {
            return Result.fail(404, "周边商户不存在");
        }
        BigDecimal oldRating = record.getRating() != null ? record.getRating() : BigDecimal.ZERO;
        int oldCount = record.getRatingCount() != null ? record.getRatingCount() : 0;
        BigDecimal newRating = oldRating.multiply(new BigDecimal(oldCount))
                .add(score)
                .divide(new BigDecimal(oldCount + 1), 1, RoundingMode.HALF_UP);
        record.setRating(newRating);
        record.setRatingCount(oldCount + 1);
        surroundingService.updateById(record);
        return Result.success(record);
    }
}
