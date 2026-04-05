package com.tourism.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.tourism.mapper.BuildingMapper;
import com.tourism.mapper.FacilityMapper;
import com.tourism.model.entity.SpotPlace;
import com.tourism.model.vo.PlaceDetailVO;
import com.tourism.mapper.PlaceMapper;
import com.tourism.utils.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

@Tag(name = "场所模块", description = "景区/校园 查询接口")
@RestController
@RequestMapping("/api/places")
public class PlaceController {

    private final PlaceMapper placeMapper;
    private final BuildingMapper buildingMapper;
    private final FacilityMapper facilityMapper;

    public PlaceController(PlaceMapper placeMapper,
                           BuildingMapper buildingMapper,
                           FacilityMapper facilityMapper) {
        this.placeMapper = placeMapper;
        this.buildingMapper = buildingMapper;
        this.facilityMapper = facilityMapper;
    }

    @Operation(summary = "分页查询场所列表")
    @GetMapping
    public Result<Page<SpotPlace>> list(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") Integer page,
            @Parameter(description = "每页条数") @RequestParam(defaultValue = "10") Integer size,
            @Parameter(description = "类型筛选") @RequestParam(required = false) String type,
            @Parameter(description = "关键字搜索") @RequestParam(required = false) String keyword) {

        LambdaQueryWrapper<SpotPlace> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(type)) {
            wrapper.eq(SpotPlace::getType, type);
        }
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(SpotPlace::getName, keyword)
                    .or().like(SpotPlace::getKeywords, keyword)
                    .or().like(SpotPlace::getDescription, keyword));
        }
        wrapper.orderByDesc(SpotPlace::getClickCount);

        return Result.success(placeMapper.selectPage(new Page<>(page, size), wrapper));
    }

    @Operation(summary = "获取场所详情")
    @GetMapping("/{id}")
    public Result<PlaceDetailVO> detail(@PathVariable String id) {
        SpotPlace place = placeMapper.selectById(id);
        if (place == null) {
            return Result.fail(404, "场所不存在");
        }
        return Result.success(PlaceDetailVO.of(
                place,
                buildingMapper.selectList(new LambdaQueryWrapper<com.tourism.model.entity.SpotBuilding>()
                        .eq(com.tourism.model.entity.SpotBuilding::getPlaceId, id)
                        .orderByAsc(com.tourism.model.entity.SpotBuilding::getName)),
                facilityMapper.selectList(new LambdaQueryWrapper<com.tourism.model.entity.SpotFacility>()
                        .eq(com.tourism.model.entity.SpotFacility::getPlaceId, id)
                        .orderByAsc(com.tourism.model.entity.SpotFacility::getType)
                        .orderByAsc(com.tourism.model.entity.SpotFacility::getName))
        ));
    }

    @Operation(summary = "搜索场所")
    @GetMapping("/search")
    public Result<java.util.List<SpotPlace>> search(
            @Parameter(description = "关键字") @RequestParam String query,
            @Parameter(description = "类型筛选") @RequestParam(required = false) String type) {
        LambdaQueryWrapper<SpotPlace> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(type) && !"fuzzy".equalsIgnoreCase(type)) {
            wrapper.eq(SpotPlace::getType, type);
        }
        wrapper.and(w -> w.like(SpotPlace::getName, query)
                .or().like(SpotPlace::getKeywords, query)
                .or().like(SpotPlace::getDescription, query)
                .or().like(SpotPlace::getAddress, query))
                .orderByDesc(SpotPlace::getClickCount)
                .last("limit 100");
        return Result.success(placeMapper.selectList(wrapper));
    }
}
