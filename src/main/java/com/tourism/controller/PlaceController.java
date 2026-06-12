package com.tourism.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.tourism.algorithm.RecommendationAlgorithm;
import com.tourism.algorithm.SortingAlgorithm;
import com.tourism.model.entity.SpotPlace;
import com.tourism.model.entity.SysUser;
import com.tourism.model.entity.UserBehavior;
import com.tourism.model.vo.PlaceDetailVO;
import com.tourism.service.BuildingService;
import com.tourism.service.FacilityService;
import com.tourism.service.PlaceService;
import com.tourism.service.UserBehaviorService;
import com.tourism.utils.CoordinateTransformUtils;
import com.tourism.service.UserService;
import com.tourism.utils.JsonUtils;
import com.tourism.utils.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Tag(name = "场所模块", description = "景区/校园 查询接口")
@RestController
@RequestMapping("/api/places")
public class PlaceController {

    private static final Logger log = LoggerFactory.getLogger(PlaceController.class);

    private final PlaceService placeService;
    private final BuildingService buildingService;
    private final FacilityService facilityService;
    private final UserService userService;
    private final UserBehaviorService userBehaviorService;
    private final RecommendationAlgorithm recommendationAlgorithm;
    private final SortingAlgorithm sortingAlgorithm;
    private final com.tourism.service.SpotXhsInfoService spotXhsInfoService;

    public PlaceController(PlaceService placeService,
                           BuildingService buildingService,
                           FacilityService facilityService,
                           UserService userService,
                           UserBehaviorService userBehaviorService,
                           RecommendationAlgorithm recommendationAlgorithm,
                           SortingAlgorithm sortingAlgorithm,
                           com.tourism.service.SpotXhsInfoService spotXhsInfoService) {
        this.placeService = placeService;
        this.buildingService = buildingService;
        this.facilityService = facilityService;
        this.userService = userService;
        this.userBehaviorService = userBehaviorService;
        this.recommendationAlgorithm = recommendationAlgorithm;
        this.sortingAlgorithm = sortingAlgorithm;
        this.spotXhsInfoService = spotXhsInfoService;
    }

    @Operation(summary = "分页查询场所列表")
    @GetMapping
    public Result<IPage<SpotPlace>> list(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") Integer page,
            @Parameter(description = "每页条数") @RequestParam(defaultValue = "10") Integer size,
            @Parameter(description = "类型筛选") @RequestParam(required = false) String type,
            @Parameter(description = "关键字搜索") @RequestParam(required = false) String keyword) {

        IPage<SpotPlace> result = placeService.listPlaces(page, size, type, keyword);
        // 批量填充小红书热度数据（非核心功能，静默失败不影响主流程）
        try {
            List<String> placeIds = result.getRecords().stream()
                    .map(SpotPlace::getId)
                    .collect(Collectors.toList());
            if (!placeIds.isEmpty()) {
                com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<
                        com.tourism.model.entity.SpotXhsInfo> q =
                        new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<>();
                q.in(com.tourism.model.entity.SpotXhsInfo::getPlaceId, placeIds);
                Map<String, com.tourism.model.entity.SpotXhsInfo> xhsMap =
                        spotXhsInfoService.list(q).stream()
                                .collect(Collectors.toMap(
                                        com.tourism.model.entity.SpotXhsInfo::getPlaceId,
                                        info -> info,
                                        (a, b) -> a));
                result.getRecords().forEach(p -> p.setXhsInfo(xhsMap.get(p.getId())));
            }
        } catch (Exception e) {
            log.warn("批量加载小红书热度数据失败: {}", e.getMessage());
        }
        return Result.success(CoordinateTransformUtils.annotatePlacePage(result));
    }

    @Operation(summary = "获取场所详情（含小红书热度数据）")
    @GetMapping("/{id}")
    public Result<PlaceDetailVO> detail(@PathVariable String id) {
        SpotPlace place = placeService.getPlaceDetail(id);
        if (place == null) {
            return Result.fail(404, "场所不存在");
        }
        CoordinateTransformUtils.annotateForMap(place);

        // 小红书热度数据：非核心功能，查询失败不影响详情主流程
        com.tourism.model.entity.SpotXhsInfo xhsInfo = null;
        try {
            xhsInfo = spotXhsInfoService.getByPlaceId(id);
        } catch (Exception e) {
            log.warn("加载小红书热度数据失败 placeId={}: {}", id, e.getMessage());
        }

        return Result.success(PlaceDetailVO.of(
                place,
                CoordinateTransformUtils.annotateBuildings(buildingService.listByPlaceId(id)),
                CoordinateTransformUtils.annotateFacilities(facilityService.listByPlaceId(id)),
                xhsInfo
        ));
    }

    @Operation(summary = "刷新场所的小红书热度数据")
    @PostMapping("/{id}/refresh-xhs")
    public Result<com.tourism.model.entity.SpotXhsInfo> refreshXhs(@PathVariable String id) {
        SpotPlace place = placeService.getPlaceDetail(id);
        if (place == null) {
            return Result.fail(404, "场所不存在");
        }
        // 调用 Python Agent 实时抓取 → 保存到 MySQL + Redis
        com.tourism.model.entity.SpotXhsInfo xhsInfo = spotXhsInfoService.refreshXhsData(
                id, place.getName(), place.getType());
        return Result.success(xhsInfo);
    }

    @Operation(summary = "搜索场所")
    @GetMapping("/search")
    public Result<List<SpotPlace>> search(
            @Parameter(description = "关键字") @RequestParam String query,
            @Parameter(description = "类型筛选") @RequestParam(required = false) String type) {
        IPage<SpotPlace> page = placeService.listPlaces(1, 100, type, query);
        return Result.success(CoordinateTransformUtils.annotatePlaces(page.getRecords()));
    }

    @Operation(summary = "获取热门场所")
    @GetMapping("/hot")
    public Result<List<SpotPlace>> hotPlaces(
            @Parameter(description = "返回条数") @RequestParam(defaultValue = "10") Integer limit) {
        return Result.success(CoordinateTransformUtils.annotatePlaces(placeService.getHotPlaces(limit)));
    }

    @Operation(summary = "获取高评分场所")
    @GetMapping("/top-rated")
    public Result<List<SpotPlace>> topRatedPlaces(
            @Parameter(description = "返回条数") @RequestParam(defaultValue = "10") Integer limit) {
        return Result.success(CoordinateTransformUtils.annotatePlaces(placeService.getTopRatedPlaces(limit)));
    }

    @Operation(summary = "按类型查询场所")
    @GetMapping("/type/{type}")
    public Result<List<SpotPlace>> listByType(@PathVariable String type) {
        return Result.success(CoordinateTransformUtils.annotatePlaces(placeService.listByType(type)));
    }

    @Operation(summary = "个性化推荐场所")
    @PostMapping("/recommend")
    public Result<List<SpotPlace>> recommend(@RequestBody Map<String, Object> payload) {
        Long userId = payload.get("userId") instanceof Number number ? number.longValue() : null;
        int topK = payload.get("topK") instanceof Number number ? number.intValue() : 12;

        SysUser user = userId == null ? null : userService.getById(userId);
        List<String> userInterests = user == null ? Collections.emptyList() : JsonUtils.parseStringList(user.getInterests());
        List<String> favoriteCategories = user == null ? Collections.emptyList() : JsonUtils.parseStringList(user.getFavoriteCategories());
        List<String> visitedPlaceIds = userId == null
                ? Collections.emptyList()
                : userBehaviorService.getViewHistory(userId).stream()
                .map(UserBehavior::getTargetId)
                .filter(targetId -> targetId != null && targetId.startsWith("place_"))
                .distinct()
                .toList();

        List<SpotPlace> allPlaces = placeService.list();
        List<Map<String, Object>> placeItems = allPlaces.stream()
                .map(JsonUtils::toMap)
                .toList();

        List<RecommendationAlgorithm.ScoredItem> recommendations = recommendationAlgorithm.recommendPlaces(
                userInterests,
                favoriteCategories,
                visitedPlaceIds,
                placeItems,
                topK <= 0 ? 12 : topK
        );

        Map<String, SpotPlace> placeMap = allPlaces.stream()
                .collect(Collectors.toMap(SpotPlace::getId, place -> place, (a, b) -> a, LinkedHashMap::new));

        List<SpotPlace> result = recommendations.stream()
                .map(item -> placeMap.get(String.valueOf(item.getItem().get("id"))))
                .filter(Objects::nonNull)
                .toList();
        return Result.success(CoordinateTransformUtils.annotatePlaces(result));
    }

    @Operation(summary = "场所排序")
    @PostMapping("/sort")
    public Result<List<SpotPlace>> sort(@RequestBody Map<String, Object> payload) {
        String sortType = payload.get("sortType") == null ? "popularity" : String.valueOf(payload.get("sortType"));
        int topK = payload.get("topK") instanceof Number number ? number.intValue() : 12;
        List<String> placeIds = JsonUtils.parseStringList(payload.get("placeIds"));

        List<SpotPlace> places = placeIds.isEmpty()
                ? placeService.list()
                : placeService.listByIds(placeIds);

        List<SpotPlace> sorted;
        if ("rating".equalsIgnoreCase(sortType)) {
            sorted = sortingAlgorithm.topKSort(
                    places,
                    place -> place.getRating() == null ? 0.0 : place.getRating().doubleValue(),
                    topK <= 0 ? places.size() : topK,
                    true
            );
        } else {
            sorted = sortingAlgorithm.topKSort(
                    places,
                    place -> place.getClickCount() == null ? 0.0 : place.getClickCount().doubleValue(),
                    topK <= 0 ? places.size() : topK,
                    true
            );
        }
        return Result.success(CoordinateTransformUtils.annotatePlaces(sorted));
    }

    @Operation(summary = "场所评分")
    @PostMapping("/{id}/rate")
    public Result<Map<String, Object>> rate(@PathVariable String id, @RequestBody Map<String, Object> payload) {
        Long userId = payload.get("userId") instanceof Number number ? number.longValue() : null;
        Double rating = payload.get("rating") instanceof Number number ? number.doubleValue() : null;
        if (userId == null) {
            return Result.fail(400, "用户ID不能为空");
        }
        if (rating == null || rating < 1 || rating > 5) {
            return Result.fail(400, "评分必须在1到5之间");
        }

        boolean success = userBehaviorService.recordBehavior(userId, id, "RATE", rating);
        if (!success) {
            return Result.fail("评分失败");
        }

        SpotPlace place = placeService.getById(id);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("rating", place.getRating());
        data.put("ratingCount", place.getRatingCount());
        data.put("userRating", rating);
        return Result.success(data);
    }
}
