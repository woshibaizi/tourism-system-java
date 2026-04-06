package com.tourism.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.tourism.model.entity.SpotBuilding;
import com.tourism.service.BuildingService;
import com.tourism.utils.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "建筑物模块", description = "建筑物分页、详情、搜索接口")
@RestController
@RequestMapping("/api/buildings")
public class BuildingController {

    private final BuildingService buildingService;

    public BuildingController(BuildingService buildingService) {
        this.buildingService = buildingService;
    }

    @Operation(summary = "分页查询建筑物")
    @GetMapping
    public Result<Page<SpotBuilding>> list(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") Integer page,
            @Parameter(description = "每页条数") @RequestParam(defaultValue = "10") Integer size,
            @Parameter(description = "场所ID") @RequestParam(required = false) String placeId,
            @Parameter(description = "建筑类型") @RequestParam(required = false) String type,
            @Parameter(description = "关键字") @RequestParam(required = false) String keyword) {

        LambdaQueryWrapper<SpotBuilding> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(placeId)) {
            wrapper.eq(SpotBuilding::getPlaceId, placeId);
        }
        if (StringUtils.hasText(type)) {
            wrapper.eq(SpotBuilding::getType, type);
        }
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(SpotBuilding::getName, keyword)
                    .or().like(SpotBuilding::getDescription, keyword));
        }
        wrapper.orderByAsc(SpotBuilding::getName);
        return Result.success(buildingService.page(new Page<>(page, size), wrapper));
    }

    @Operation(summary = "获取建筑物详情")
    @GetMapping("/{id}")
    public Result<SpotBuilding> detail(@PathVariable String id) {
        SpotBuilding building = buildingService.getBuildingDetail(id);
        if (building == null) {
            return Result.fail(404, "建筑物不存在");
        }
        return Result.success(building);
    }

    @Operation(summary = "根据场所ID查询建筑物列表")
    @GetMapping("/place/{placeId}")
    public Result<List<SpotBuilding>> listByPlace(@PathVariable String placeId) {
        return Result.success(buildingService.listByPlaceId(placeId));
    }

    @Operation(summary = "搜索建筑物")
    @GetMapping("/search")
    public Result<List<SpotBuilding>> search(
            @RequestParam String query,
            @RequestParam(required = false) String placeId) {
        LambdaQueryWrapper<SpotBuilding> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(placeId)) {
            wrapper.eq(SpotBuilding::getPlaceId, placeId);
        }
        wrapper.and(w -> w.like(SpotBuilding::getName, query)
                .or().like(SpotBuilding::getDescription, query))
                .orderByAsc(SpotBuilding::getName)
                .last("limit 100");
        return Result.success(buildingService.list(wrapper));
    }
}
