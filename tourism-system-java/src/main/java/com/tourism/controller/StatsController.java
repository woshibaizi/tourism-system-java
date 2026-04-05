package com.tourism.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.tourism.mapper.DiaryMapper;
import com.tourism.mapper.PlaceMapper;
import com.tourism.mapper.RoadEdgeMapper;
import com.tourism.mapper.UserMapper;
import com.tourism.model.entity.SpotPlace;
import com.tourism.model.entity.SpotRoadEdge;
import com.tourism.model.entity.SysUser;
import com.tourism.model.entity.TravelDiary;
import com.tourism.utils.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@Tag(name = "统计模块")
@RestController
@RequestMapping("/api/stats")
public class StatsController {

    private final PlaceMapper placeMapper;
    private final DiaryMapper diaryMapper;
    private final UserMapper userMapper;
    private final RoadEdgeMapper roadEdgeMapper;

    public StatsController(PlaceMapper placeMapper,
                           DiaryMapper diaryMapper,
                           UserMapper userMapper,
                           RoadEdgeMapper roadEdgeMapper) {
        this.placeMapper = placeMapper;
        this.diaryMapper = diaryMapper;
        this.userMapper = userMapper;
        this.roadEdgeMapper = roadEdgeMapper;
    }

    @Operation(summary = "获取系统统计概览")
    @GetMapping
    public Result<Map<String, Long>> overview() {
        Map<String, Long> stats = new LinkedHashMap<>();
        stats.put("places", placeMapper.selectCount(new LambdaQueryWrapper<SpotPlace>()));
        stats.put("diaries", diaryMapper.selectCount(new LambdaQueryWrapper<TravelDiary>()));
        stats.put("users", userMapper.selectCount(new LambdaQueryWrapper<SysUser>()));
        stats.put("roads", roadEdgeMapper.selectCount(new LambdaQueryWrapper<SpotRoadEdge>()));
        return Result.success(stats);
    }
}
