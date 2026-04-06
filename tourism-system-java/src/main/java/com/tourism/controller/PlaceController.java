package com.tourism.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.tourism.model.entity.SpotPlace;
import com.tourism.model.vo.PlaceDetailVO;
import com.tourism.service.BuildingService;
import com.tourism.service.FacilityService;
import com.tourism.service.PlaceService;
import com.tourism.utils.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "场所模块", description = "景区/校园 查询接口")
@RestController
@RequestMapping("/api/places")
public class PlaceController {

    private final PlaceService placeService;
    private final BuildingService buildingService;
    private final FacilityService facilityService;

    public PlaceController(PlaceService placeService,
                           BuildingService buildingService,
                           FacilityService facilityService) {
        this.placeService = placeService;
        this.buildingService = buildingService;
        this.facilityService = facilityService;
    }

    @Operation(summary = "分页查询场所列表")
    @GetMapping
    public Result<IPage<SpotPlace>> list(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") Integer page,
            @Parameter(description = "每页条数") @RequestParam(defaultValue = "10") Integer size,
            @Parameter(description = "类型筛选") @RequestParam(required = false) String type,
            @Parameter(description = "关键字搜索") @RequestParam(required = false) String keyword) {

        return Result.success(placeService.listPlaces(page, size, type, keyword));
    }

    @Operation(summary = "获取场所详情")
    @GetMapping("/{id}")
    public Result<PlaceDetailVO> detail(@PathVariable String id) {
        SpotPlace place = placeService.getPlaceDetail(id);
        if (place == null) {
            return Result.fail(404, "场所不存在");
        }
        return Result.success(PlaceDetailVO.of(
                place,
                buildingService.listByPlaceId(id),
                facilityService.listByPlaceId(id)
        ));
    }

    @Operation(summary = "搜索场所")
    @GetMapping("/search")
    public Result<List<SpotPlace>> search(
            @Parameter(description = "关键字") @RequestParam String query,
            @Parameter(description = "类型筛选") @RequestParam(required = false) String type) {
        // search delegates to listPlaces with a large page size for simplicity
        IPage<SpotPlace> page = placeService.listPlaces(1, 100, type, query);
        return Result.success(page.getRecords());
    }

    @Operation(summary = "获取热门场所")
    @GetMapping("/hot")
    public Result<List<SpotPlace>> hotPlaces(
            @Parameter(description = "返回条数") @RequestParam(defaultValue = "10") Integer limit) {
        return Result.success(placeService.getHotPlaces(limit));
    }

    @Operation(summary = "获取高评分场所")
    @GetMapping("/top-rated")
    public Result<List<SpotPlace>> topRatedPlaces(
            @Parameter(description = "返回条数") @RequestParam(defaultValue = "10") Integer limit) {
        return Result.success(placeService.getTopRatedPlaces(limit));
    }

    @Operation(summary = "按类型查询场所")
    @GetMapping("/type/{type}")
    public Result<List<SpotPlace>> listByType(@PathVariable String type) {
        return Result.success(placeService.listByType(type));
    }
}
