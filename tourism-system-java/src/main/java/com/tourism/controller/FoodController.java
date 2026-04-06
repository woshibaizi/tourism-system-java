package com.tourism.controller;

import com.tourism.model.entity.SpotFood;
import com.tourism.service.FoodService;
import com.tourism.utils.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "美食管理")
@RestController
@RequestMapping("/api/foods")
public class FoodController {

    private final FoodService foodService;

    public FoodController(FoodService foodService) {
        this.foodService = foodService;
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

    @Operation(summary = "获取美食详情")
    @GetMapping("/{id}")
    public Result<SpotFood> getDetail(@PathVariable String id) {
        return Result.success(foodService.getById(id));
    }
}
