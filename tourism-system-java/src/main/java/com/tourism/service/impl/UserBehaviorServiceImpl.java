package com.tourism.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.tourism.mapper.UserBehaviorMapper;
import com.tourism.model.entity.UserBehavior;
import com.tourism.service.UserBehaviorService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

@Service
public class UserBehaviorServiceImpl extends ServiceImpl<UserBehaviorMapper, UserBehavior> implements UserBehaviorService {

    @Override
    public boolean recordBehavior(Long userId, String targetId, String behaviorType, Double score) {
        // Check if the behavior already exists (upsert logic)
        LambdaQueryWrapper<UserBehavior> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(UserBehavior::getUserId, userId)
                .eq(UserBehavior::getTargetId, targetId)
                .eq(UserBehavior::getBehaviorType, behaviorType);
        UserBehavior existing = getOne(wrapper, false);

        if (existing != null) {
            // Update the existing behavior (e.g., update the rating score)
            existing.setScore(BigDecimal.valueOf(score != null ? score : 1.0));
            return updateById(existing);
        } else {
            UserBehavior behavior = new UserBehavior();
            behavior.setUserId(userId);
            behavior.setTargetId(targetId);
            behavior.setBehaviorType(behaviorType);
            behavior.setScore(BigDecimal.valueOf(score != null ? score : 1.0));
            return save(behavior);
        }
    }

    @Override
    public List<UserBehavior> getViewHistory(Long userId) {
        LambdaQueryWrapper<UserBehavior> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(UserBehavior::getUserId, userId)
                .eq(UserBehavior::getBehaviorType, "VIEW")
                .orderByDesc(UserBehavior::getCreatedAt);
        return list(wrapper);
    }

    @Override
    public List<UserBehavior> getRatingHistory(Long userId) {
        LambdaQueryWrapper<UserBehavior> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(UserBehavior::getUserId, userId)
                .eq(UserBehavior::getBehaviorType, "RATE")
                .orderByDesc(UserBehavior::getCreatedAt);
        return list(wrapper);
    }

    @Override
    public List<UserBehavior> getRatingsForTarget(String targetId) {
        LambdaQueryWrapper<UserBehavior> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(UserBehavior::getTargetId, targetId)
                .eq(UserBehavior::getBehaviorType, "RATE");
        return list(wrapper);
    }
}
