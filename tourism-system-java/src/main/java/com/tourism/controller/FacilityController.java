package com.tourism.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.tourism.model.entity.SpotFacility;
import com.tourism.model.entity.SpotBuilding;
import com.tourism.service.BuildingService;
import com.tourism.service.FacilityService;
import com.tourism.utils.GeoUtils;
import com.tourism.utils.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Comparator;
import java.util.stream.Collectors;

@Tag(name = "设施查询模块")
@RestController
@RequestMapping("/api/facilities")
public class FacilityController {

    private final FacilityService facilityService;
    private final BuildingService buildingService;

    public FacilityController(FacilityService facilityService, BuildingService buildingService) {
        this.facilityService = facilityService;
        this.buildingService = buildingService;
    }

    @Operation(summary = "查询场所内所有设施")
    @GetMapping
    public Result<Page<SpotFacility>> listByPlace(
            @RequestParam(required = false) String placeId,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {

        LambdaQueryWrapper<SpotFacility> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(placeId)) {
            wrapper.eq(SpotFacility::getPlaceId, placeId);
        }
        if (StringUtils.hasText(type)) {
            wrapper.eq(SpotFacility::getType, type);
        }
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(SpotFacility::getName, keyword)
                    .or().like(SpotFacility::getDescription, keyword));
        }
        wrapper.orderByAsc(SpotFacility::getType).orderByAsc(SpotFacility::getName);
        return Result.success(facilityService.page(new Page<>(page, size), wrapper));
    }

    @Operation(summary = "获取设施详情")
    @GetMapping("/{id}")
    public Result<SpotFacility> detail(@PathVariable String id) {
        SpotFacility facility = facilityService.getById(id);
        if (facility == null) {
            return Result.fail(404, "设施不存在");
        }
        return Result.success(facility);
    }

    @Operation(summary = "根据场所ID查询设施列表")
    @GetMapping("/place/{placeId}")
    public Result<List<SpotFacility>> listByPlaceId(@PathVariable String placeId) {
        return Result.success(facilityService.listByPlaceId(placeId));
    }

    @Operation(summary = "根据场所和类型查询设施")
    @GetMapping("/place/{placeId}/type/{type}")
    public Result<List<SpotFacility>> listByPlaceAndType(
            @PathVariable String placeId,
            @PathVariable String type) {
        return Result.success(facilityService.listByPlaceIdAndType(placeId, type));
    }

    @Operation(summary = "搜索设施")
    @GetMapping("/search")
    public Result<List<SpotFacility>> search(
            @RequestParam String query,
            @RequestParam(required = false) String placeId,
            @RequestParam(required = false) String type) {
        LambdaQueryWrapper<SpotFacility> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(placeId)) {
            wrapper.eq(SpotFacility::getPlaceId, placeId);
        }
        if (StringUtils.hasText(type)) {
            wrapper.eq(SpotFacility::getType, type);
        }
        wrapper.and(w -> w.like(SpotFacility::getName, query)
                .or().like(SpotFacility::getDescription, query))
                .orderByAsc(SpotFacility::getType)
                .orderByAsc(SpotFacility::getName)
                .last("limit 100");
        return Result.success(facilityService.list(wrapper));
    }

    @Operation(summary = "查询附近设施（LBS，半径单位：米）")
    @GetMapping("/nearby")
    public Result<List<SpotFacility>> nearby(
            @RequestParam Double lat,
            @RequestParam Double lng,
            @RequestParam(defaultValue = "500") Double radius,
            @RequestParam(required = false) String type) {

        LambdaQueryWrapper<SpotFacility> wrapper = new LambdaQueryWrapper<>();
        if (type != null) {
            wrapper.eq(SpotFacility::getType, type);
        }

        List<SpotFacility> facilities = facilityService.list(wrapper);
        List<SpotFacility> nearby = facilities.stream()
                .filter(f -> f.getLat() != null && f.getLng() != null)
                .filter(f -> GeoUtils.distance(lat, lng,
                        f.getLat().doubleValue(), f.getLng().doubleValue()) <= radius)
                .collect(Collectors.toList());

        return Result.success(nearby);
    }

    @Operation(summary = "查询建筑附近的设施（按距离升序）")
    @PostMapping("/nearest")
    public Result<List<SpotFacility>> nearest(@RequestBody NearestFacilityRequest request) {
        if (!StringUtils.hasText(request.buildingId()) || !StringUtils.hasText(request.placeId())) {
            return Result.fail(400, "buildingId 和 placeId 不能为空");
        }

        SpotBuilding building = buildingService.getBuildingDetail(request.buildingId());
        if (building == null) {
            return Result.fail(404, "建筑物不存在");
        }
        if (building.getLat() == null || building.getLng() == null) {
            return Result.fail(400, "当前建筑物缺少坐标信息");
        }

        LambdaQueryWrapper<SpotFacility> wrapper = new LambdaQueryWrapper<SpotFacility>()
                .eq(SpotFacility::getPlaceId, request.placeId());
        if (StringUtils.hasText(request.facilityType()) && !"all".equalsIgnoreCase(request.facilityType())) {
            wrapper.eq(SpotFacility::getType, request.facilityType());
        }

        List<SpotFacility> facilities = facilityService.list(wrapper);
        double originLat = building.getLat().doubleValue();
        double originLng = building.getLng().doubleValue();

        List<SpotFacility> result = facilities.stream()
                .filter(facility -> facility.getLat() != null && facility.getLng() != null)
                .peek(facility -> facility.setDistance(GeoUtils.distance(
                        originLat,
                        originLng,
                        facility.getLat().doubleValue(),
                        facility.getLng().doubleValue()
                )))
                .sorted(Comparator.comparing(facility -> facility.getDistance() == null ? Double.MAX_VALUE : facility.getDistance()))
                .collect(Collectors.toList());

        return Result.success(result);
    }

    public record NearestFacilityRequest(String buildingId, String placeId, String facilityType) {
    }
}
