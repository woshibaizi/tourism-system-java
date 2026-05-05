package com.tourism.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.tourism.model.entity.SpotFacility;

import java.util.List;

public interface FacilityService extends IService<SpotFacility> {

    /**
     * 根据场所ID查询设施列表
     */
    List<SpotFacility> listByPlaceId(String placeId);

    /**
     * 根据场所ID和类型查询设施列表
     */
    List<SpotFacility> listByPlaceIdAndType(String placeId, String type);

    /**
     * 根据类型查询设施列表
     */
    List<SpotFacility> listByType(String type);
}
