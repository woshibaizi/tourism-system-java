package com.tourism.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.tourism.mapper.RoadEdgeMapper;
import com.tourism.model.entity.SpotRoadEdge;
import com.tourism.service.RoadEdgeService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class RoadEdgeServiceImpl extends ServiceImpl<RoadEdgeMapper, SpotRoadEdge> implements RoadEdgeService {

    @Override
    public List<SpotRoadEdge> listByPlaceId(String placeId) {
        LambdaQueryWrapper<SpotRoadEdge> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SpotRoadEdge::getPlaceId, placeId);
        return list(wrapper);
    }

    @Override
    public List<SpotRoadEdge> listByFromNode(String fromNode) {
        LambdaQueryWrapper<SpotRoadEdge> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SpotRoadEdge::getFromNode, fromNode);
        return list(wrapper);
    }
}
