package com.tourism.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.tourism.mapper.BuildingMapper;
import com.tourism.model.entity.SpotBuilding;
import com.tourism.service.BuildingService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class BuildingServiceImpl extends ServiceImpl<BuildingMapper, SpotBuilding> implements BuildingService {

    @Override
    public List<SpotBuilding> listByPlaceId(String placeId) {
        LambdaQueryWrapper<SpotBuilding> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SpotBuilding::getPlaceId, placeId)
                .orderByDesc(SpotBuilding::getRating);
        return list(wrapper);
    }

    @Override
    public SpotBuilding getBuildingDetail(String id) {
        return getById(id);
    }
}
