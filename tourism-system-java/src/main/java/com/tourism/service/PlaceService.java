package com.tourism.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.tourism.model.entity.SpotPlace;

import java.util.List;

public interface PlaceService extends IService<SpotPlace> {

    /**
     * 分页查询场所列表
     */
    IPage<SpotPlace> listPlaces(int page, int size, String type, String keyword);

    /**
     * 根据ID获取场所详情
     */
    SpotPlace getPlaceDetail(String id);

    /**
     * 获取热门场所（按浏览量排序）
     */
    List<SpotPlace> getHotPlaces(int limit);

    /**
     * 获取高评分场所
     */
    List<SpotPlace> getTopRatedPlaces(int limit);

    /**
     * 按类型统计场所数量
     */
    List<SpotPlace> listByType(String type);
}
