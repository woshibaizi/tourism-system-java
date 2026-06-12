package com.tourism.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.tourism.mapper.PlaceMapper;
import com.tourism.model.entity.SpotPlace;
import com.tourism.service.PlaceService;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
public class PlaceServiceImpl extends ServiceImpl<PlaceMapper, SpotPlace> implements PlaceService {

    @Override
    public IPage<SpotPlace> listPlaces(int page, int size, String type, String keyword) {
        LambdaQueryWrapper<SpotPlace> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(type)) {
            wrapper.eq(SpotPlace::getType, type);
        }
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w
                    .like(SpotPlace::getName, keyword)
                    .or()
                    .like(SpotPlace::getDescription, keyword)
                    .or()
                    .like(SpotPlace::getKeywords, keyword)
            );
        }
        wrapper.orderByDesc(SpotPlace::getClickCount);
        return page(new Page<>(page, size), wrapper);
    }

    @Override
    public SpotPlace getPlaceDetail(String id) {
        return getById(id);
    }

    @Override
    public List<SpotPlace> getHotPlaces(int limit) {
        LambdaQueryWrapper<SpotPlace> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByDesc(SpotPlace::getClickCount)
                .last("LIMIT " + limit);
        return list(wrapper);
    }

    @Override
    public List<SpotPlace> getTopRatedPlaces(int limit) {
        LambdaQueryWrapper<SpotPlace> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByDesc(SpotPlace::getRating)
                .last("LIMIT " + limit);
        return list(wrapper);
    }

    @Override
    public List<SpotPlace> listByType(String type) {
        LambdaQueryWrapper<SpotPlace> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SpotPlace::getType, type)
                .orderByDesc(SpotPlace::getRating);
        return list(wrapper);
    }
}
