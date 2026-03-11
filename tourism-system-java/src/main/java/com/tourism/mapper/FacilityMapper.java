package com.tourism.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.tourism.model.entity.SpotFacility;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface FacilityMapper extends BaseMapper<SpotFacility> {
}
