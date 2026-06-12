package com.tourism.controller;

import com.tourism.service.*;
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

    private final PlaceService placeService;
    private final DiaryService diaryService;
    private final UserService userService;
    private final RoadEdgeService roadEdgeService;
    private final BuildingService buildingService;
    private final FacilityService facilityService;
    private final FoodService foodService;

    public StatsController(PlaceService placeService,
                           DiaryService diaryService,
                           UserService userService,
                           RoadEdgeService roadEdgeService,
                           BuildingService buildingService,
                           FacilityService facilityService,
                           FoodService foodService) {
        this.placeService = placeService;
        this.diaryService = diaryService;
        this.userService = userService;
        this.roadEdgeService = roadEdgeService;
        this.buildingService = buildingService;
        this.facilityService = facilityService;
        this.foodService = foodService;
    }

    @Operation(summary = "获取系统统计概览")
    @GetMapping
    public Result<Map<String, Long>> overview() {
        Map<String, Long> stats = new LinkedHashMap<>();
        stats.put("places", placeService.count());
        stats.put("buildings", buildingService.count());
        stats.put("facilities", facilityService.count());
        stats.put("foods", foodService.count());
        stats.put("diaries", diaryService.count());
        stats.put("users", userService.count());
        stats.put("roads", roadEdgeService.count());
        return Result.success(stats);
    }
}
