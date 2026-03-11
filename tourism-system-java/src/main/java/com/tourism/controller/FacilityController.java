package com.tourism.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.tourism.model.entity.SpotFacility;
import com.tourism.mapper.FacilityMapper;
import com.tourism.utils.GeoUtils;
import com.tourism.utils.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@Tag(name = "设施查询模块")
@RestController
@RequestMapping("/api/facilities")
public class FacilityController {

    private final FacilityMapper facilityMapper;

    public FacilityController(FacilityMapper facilityMapper) {
        this.facilityMapper = facilityMapper;
    }

    @Operation(summary = "查询场所内所有设施")
    @GetMapping
    public Result<List<SpotFacility>> listByPlace(
            @RequestParam String placeId,
            @RequestParam(required = false) String type) {

        LambdaQueryWrapper<SpotFacility> wrapper = new LambdaQueryWrapper<SpotFacility>()
                .eq(SpotFacility::getPlaceId, placeId);
        if (type != null) {
            wrapper.eq(SpotFacility::getType, type);
        }
        return Result.success(facilityMapper.selectList(wrapper));
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

        List<SpotFacility> facilities = facilityMapper.selectList(wrapper);
        List<SpotFacility> nearby = facilities.stream()
                .filter(f -> f.getLat() != null && f.getLng() != null)
                .filter(f -> GeoUtils.distance(lat, lng,
                        f.getLat().doubleValue(), f.getLng().doubleValue()) <= radius)
                .collect(Collectors.toList());

        return Result.success(nearby);
    }
}
