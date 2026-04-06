package com.tourism.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.tourism.model.entity.SpotRoadEdge;

import java.util.List;

public interface RoadEdgeService extends IService<SpotRoadEdge> {

    /**
     * 根据场所ID查询道路拓扑
     */
    List<SpotRoadEdge> listByPlaceId(String placeId);

    /**
     * 获取从某节点出发的所有边
     */
    List<SpotRoadEdge> listByFromNode(String fromNode);
}
