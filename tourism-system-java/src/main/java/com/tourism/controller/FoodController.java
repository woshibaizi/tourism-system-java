package com.tourism.controller;

import com.tourism.model.entity.SpotFood;
import com.tourism.service.FoodService;
import com.tourism.utils.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Tag(name = "美食管理")
@RestController
@RequestMapping("/api/foods")
public class FoodController {

    private final FoodService foodService;

    public FoodController(FoodService foodService) {
        this.foodService = foodService;
    }

    @Operation(summary = "查询美食列表")
    @GetMapping
    public Result<Map<String, Object>> list(@RequestParam(required = false) String placeId,
                                            @RequestParam(required = false) String cuisine,
                                            @RequestParam(required = false) String search,
                                            @RequestParam(defaultValue = "popularity") String sortBy,
                                            @RequestParam(required = false) String originNodeId,
                                            @RequestParam(required = false) String buildingId,
                                            @RequestParam(defaultValue = "12") Integer limit) {
        String origin = StringUtils.hasText(originNodeId) ? originNodeId : buildingId;
        List<SpotFood> foods = foodService.searchFoods(placeId, cuisine, search, sortBy, origin);
        int normalizedLimit = limit == null || limit <= 0 ? foods.size() : limit;

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("items", foods.stream().limit(normalizedLimit).toList());
        data.put("total", foods.size());
        data.put("sortBy", sortBy);
        return Result.success(data);
    }

    @Operation(summary = "根据场所ID获取美食列表")
    @GetMapping("/place/{placeId}")
    public Result<List<SpotFood>> listByPlace(@PathVariable String placeId) {
        return Result.success(foodService.listByPlaceId(placeId));
    }

    @Operation(summary = "根据菜系筛选美食")
    @GetMapping("/cuisine/{cuisine}")
    public Result<List<SpotFood>> listByCuisine(@PathVariable String cuisine) {
        return Result.success(foodService.listByCuisine(cuisine));
    }

    @Operation(summary = "获取热门美食")
    @GetMapping("/popular")
    public Result<List<SpotFood>> getPopular(
            @RequestParam(required = false) String placeId,
            @RequestParam(defaultValue = "10") int limit) {
        return Result.success(foodService.getPopularFoods(placeId, limit));
    }

    @Operation(summary = "获取全部菜系")
    @GetMapping("/cuisines")
    public Result<List<String>> getCuisines(@RequestParam(required = false) String placeId) {
        List<String> cuisines = foodService.searchFoods(placeId, null, null, "popularity", null).stream()
                .map(SpotFood::getCuisine)
                .filter(cuisine -> cuisine != null && !cuisine.isBlank())
                .distinct()
                .sorted()
                .toList();
        return Result.success(cuisines);
    }

    @Operation(summary = "获取美食详情")
    @GetMapping("/{id}")
    public Result<SpotFood> getDetail(@PathVariable String id) {
        return Result.success(foodService.getById(id));
    }
}
