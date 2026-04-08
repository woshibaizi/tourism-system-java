package com.tourism.controller;

import com.tourism.algorithm.SearchAlgorithm;
import com.tourism.algorithm.SortingAlgorithm;
import com.tourism.model.entity.SpotFood;
import com.tourism.service.FoodService;
import com.tourism.utils.JsonUtils;
import com.tourism.utils.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Tag(name = "美食管理")
@RestController
@RequestMapping("/api/foods")
public class FoodController {

    private final FoodService foodService;
    private final SearchAlgorithm searchAlgorithm;
    private final SortingAlgorithm sortingAlgorithm;

    public FoodController(FoodService foodService,
                          SearchAlgorithm searchAlgorithm,
                          SortingAlgorithm sortingAlgorithm) {
        this.foodService = foodService;
        this.searchAlgorithm = searchAlgorithm;
        this.sortingAlgorithm = sortingAlgorithm;
    }

    @Operation(summary = "查询美食列表")
    @GetMapping
    public Result<Map<String, Object>> list(@RequestParam(required = false) String placeId,
                                            @RequestParam(required = false) String cuisine,
                                            @RequestParam(required = false) String search,
                                            @RequestParam(defaultValue = "popularity") String sortBy,
                                            @RequestParam(defaultValue = "12") Integer limit) {
        List<SpotFood> foods = foodService.list().stream()
                .filter(food -> placeId == null || placeId.isBlank() || placeId.equals(food.getPlaceId()))
                .filter(food -> cuisine == null || cuisine.isBlank() || cuisine.equals(food.getCuisine()))
                .collect(Collectors.toList());

        if (search != null && !search.isBlank()) {
            List<Map<String, Object>> fuzzyResults = searchAlgorithm.fuzzySearch(
                    foods.stream().map(JsonUtils::toMap).toList(),
                    search,
                    List.of("name", "description", "cuisine", "location"),
                    0.15
            );
            Map<String, SpotFood> foodMap = foods.stream()
                    .collect(Collectors.toMap(SpotFood::getId, food -> food, (a, b) -> a, LinkedHashMap::new));
            foods = fuzzyResults.stream()
                    .map(item -> foodMap.get(String.valueOf(item.get("id"))))
                    .filter(java.util.Objects::nonNull)
                    .toList();
        }

        List<SpotFood> sortedFoods;
        if ("name".equalsIgnoreCase(sortBy)) {
            sortedFoods = foods.stream()
                    .sorted((a, b) -> String.valueOf(a.getName()).toLowerCase(Locale.ROOT)
                            .compareTo(String.valueOf(b.getName()).toLowerCase(Locale.ROOT)))
                    .limit(limit)
                    .toList();
        } else {
            sortedFoods = sortingAlgorithm.topKSort(
                    foods,
                    food -> food.getPopularity() == null ? 0.0 : food.getPopularity().doubleValue(),
                    limit == null || limit <= 0 ? foods.size() : limit,
                    true
            );
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("items", sortedFoods);
        data.put("total", foods.size());
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
        List<String> cuisines = foodService.list().stream()
                .filter(food -> placeId == null || placeId.isBlank() || placeId.equals(food.getPlaceId()))
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
