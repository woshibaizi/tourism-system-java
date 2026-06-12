package com.tourism.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.tourism.model.entity.UserBehavior;

import java.util.List;

public interface UserBehaviorService extends IService<UserBehavior> {

    /**
     * 记录用户行为
     */
    boolean recordBehavior(Long userId, String targetId, String behaviorType, Double score);

    /**
     * 查询用户的浏览历史
     */
    List<UserBehavior> getViewHistory(Long userId);

    /**
     * 查询用户的评分历史
     */
    List<UserBehavior> getRatingHistory(Long userId);

    /**
     * 查询对某目标的所有评分
     */
    List<UserBehavior> getRatingsForTarget(String targetId);
}
