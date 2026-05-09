package com.tourism.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.tourism.mapper.FacilityMapper;
import com.tourism.model.entity.SpotFacility;
import com.tourism.service.FacilityService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class FacilityServiceImpl extends ServiceImpl<FacilityMapper, SpotFacility> implements FacilityService {

    @Override
    public List<SpotFacility> listByPlaceId(String placeId) {
        LambdaQueryWrapper<SpotFacility> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SpotFacility::getPlaceId, placeId)
                .orderByAsc(SpotFacility::getType);
        return list(wrapper);
    }

    @Override
    public List<SpotFacility> listByPlaceIdAndType(String placeId, String type) {
        LambdaQueryWrapper<SpotFacility> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SpotFacility::getPlaceId, placeId)
                .eq(SpotFacility::getType, type);
        return list(wrapper);
    }

    @Override
    public List<SpotFacility> listByType(String type) {
        LambdaQueryWrapper<SpotFacility> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SpotFacility::getType, type)
                .orderByDesc(SpotFacility::getRating);
        return list(wrapper);
    }
}
