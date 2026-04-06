package com.tourism.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.tourism.model.entity.SpotBuilding;

import java.util.List;

public interface BuildingService extends IService<SpotBuilding> {

    /**
     * 根据场所ID查询建筑物列表
     */
    List<SpotBuilding> listByPlaceId(String placeId);

    /**
     * 根据ID获取建筑物详情
     */
    SpotBuilding getBuildingDetail(String id);
}
