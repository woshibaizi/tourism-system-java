package com.tourism.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.tourism.model.entity.SpotSurrounding;

import java.util.List;
import java.util.Map;

public interface SurroundingService extends IService<SpotSurrounding> {

    /**
     * 根据校园ID查询周边商户列表
     */
    List<SpotSurrounding> listByPlaceId(String placeId);

    /**
     * 根据校园ID和类型查询周边商户
     */
    List<SpotSurrounding> listByPlaceIdAndType(String placeId, String type);

    /**
     * 热门周边（按点击量排序）
     */
    List<SpotSurrounding> listHot(int limit);

    /**
     * 高分周边（按评分排序）
     */
    List<SpotSurrounding> listTopRated(int limit);

    /**
     * 获取某校园周边的分类统计
     * @return Map<type, count>
     */
    Map<String, Long> getCategoryCounts(String placeId);

    /**
     * 获取所有地点的周边商户总数
     * @return Map<placeId, totalCount>
     */
    Map<String, Long> getCountsByPlace();
}
