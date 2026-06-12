package com.tourism.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.tourism.mapper.SurroundingMapper;
import com.tourism.model.entity.SpotSurrounding;
import com.tourism.service.SurroundingService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class SurroundingServiceImpl extends ServiceImpl<SurroundingMapper, SpotSurrounding> implements SurroundingService {

    @Override
    public List<SpotSurrounding> listByPlaceId(String placeId) {
        LambdaQueryWrapper<SpotSurrounding> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SpotSurrounding::getPlaceId, placeId)
                .orderByAsc(SpotSurrounding::getType)
                .orderByAsc(SpotSurrounding::getDistanceMeters);
        return list(wrapper);
    }

    @Override
    public List<SpotSurrounding> listByPlaceIdAndType(String placeId, String type) {
        LambdaQueryWrapper<SpotSurrounding> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SpotSurrounding::getPlaceId, placeId)
                .eq(SpotSurrounding::getType, type)
                .orderByAsc(SpotSurrounding::getDistanceMeters);
        return list(wrapper);
    }

    @Override
    public List<SpotSurrounding> listHot(int limit) {
        LambdaQueryWrapper<SpotSurrounding> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByDesc(SpotSurrounding::getClickCount)
                .last("limit " + limit);
        return list(wrapper);
    }

    @Override
    public List<SpotSurrounding> listTopRated(int limit) {
        LambdaQueryWrapper<SpotSurrounding> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByDesc(SpotSurrounding::getRating)
                .orderByDesc(SpotSurrounding::getRatingCount)
                .last("limit " + limit);
        return list(wrapper);
    }

    @Override
    public Map<String, Long> getCategoryCounts(String placeId) {
        LambdaQueryWrapper<SpotSurrounding> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SpotSurrounding::getPlaceId, placeId);
        List<SpotSurrounding> list = list(wrapper);
        return list.stream()
                .collect(Collectors.groupingBy(SpotSurrounding::getType, Collectors.counting()));
    }

    @Override
    public Map<String, Long> getCountsByPlace() {
        List<SpotSurrounding> all = list();
        return all.stream()
                .collect(Collectors.groupingBy(SpotSurrounding::getPlaceId, Collectors.counting()));
    }
}
