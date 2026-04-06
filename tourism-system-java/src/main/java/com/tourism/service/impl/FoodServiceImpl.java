package com.tourism.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.tourism.mapper.FoodMapper;
import com.tourism.model.entity.SpotFood;
import com.tourism.service.FoodService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class FoodServiceImpl extends ServiceImpl<FoodMapper, SpotFood> implements FoodService {

    @Override
    public List<SpotFood> listByPlaceId(String placeId) {
        LambdaQueryWrapper<SpotFood> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SpotFood::getPlaceId, placeId)
                .orderByDesc(SpotFood::getPopularity);
        return list(wrapper);
    }

    @Override
    public List<SpotFood> listByCuisine(String cuisine) {
        LambdaQueryWrapper<SpotFood> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SpotFood::getCuisine, cuisine)
                .orderByDesc(SpotFood::getPopularity);
        return list(wrapper);
    }

    @Override
    public List<SpotFood> getPopularFoods(String placeId, int limit) {
        LambdaQueryWrapper<SpotFood> wrapper = new LambdaQueryWrapper<>();
        if (placeId != null && !placeId.isEmpty()) {
            wrapper.eq(SpotFood::getPlaceId, placeId);
        }
        wrapper.orderByDesc(SpotFood::getPopularity)
                .last("LIMIT " + limit);
        return list(wrapper);
    }
}
