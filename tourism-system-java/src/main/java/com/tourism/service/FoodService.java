package com.tourism.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.tourism.model.entity.SpotFood;

import java.util.List;

public interface FoodService extends IService<SpotFood> {

    /**
     * 根据场所ID查询美食列表
     */
    List<SpotFood> listByPlaceId(String placeId);

    /**
     * 根据菜系筛选
     */
    List<SpotFood> listByCuisine(String cuisine);

    /**
     * 获取热门美食（按人气排序）
     */
    List<SpotFood> getPopularFoods(String placeId, int limit);
}
