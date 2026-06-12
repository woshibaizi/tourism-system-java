package com.tourism.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.tourism.model.entity.SpotXhsInfo;

import java.util.Map;

public interface SpotXhsInfoService extends IService<SpotXhsInfo> {

    /**
     * 根据场所 ID 获取小红书热度信息
     */
    SpotXhsInfo getByPlaceId(String placeId);

    /**
     * 刷新指定场所的小红书数据（调用 Python Agent）
     */
    SpotXhsInfo refreshXhsData(String placeId, String placeName, String placeType);

    /**
     * 将 Python Agent 返回的抓取结果保存到数据库
     */
    SpotXhsInfo saveFromAgentResult(String placeId, Map<String, Object> agentResult);
}
