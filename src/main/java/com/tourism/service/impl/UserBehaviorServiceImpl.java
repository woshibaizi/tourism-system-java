package com.tourism.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.tourism.mapper.DiaryMapper;
import com.tourism.mapper.PlaceMapper;
import com.tourism.mapper.UserBehaviorMapper;
import com.tourism.model.entity.SpotPlace;
import com.tourism.model.entity.TravelDiary;
import com.tourism.model.entity.UserBehavior;
import com.tourism.service.UserBehaviorService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Service
public class UserBehaviorServiceImpl extends ServiceImpl<UserBehaviorMapper, UserBehavior> implements UserBehaviorService {

    private final PlaceMapper placeMapper;
    private final DiaryMapper diaryMapper;

    public UserBehaviorServiceImpl(PlaceMapper placeMapper, DiaryMapper diaryMapper) {
        this.placeMapper = placeMapper;
        this.diaryMapper = diaryMapper;
    }

    @Override
    public boolean recordBehavior(Long userId, String targetId, String behaviorType, Double score) {
        if ("VIEW".equalsIgnoreCase(behaviorType)) {
            incrementTargetClickCount(targetId);
        }

        LambdaQueryWrapper<UserBehavior> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(UserBehavior::getUserId, userId)
                .eq(UserBehavior::getTargetId, targetId)
                .eq(UserBehavior::getBehaviorType, behaviorType);
        UserBehavior existing = getOne(wrapper, false);

        boolean success;
        if (existing != null) {
            existing.setScore(BigDecimal.valueOf(score != null ? score : 1.0));
            success = updateById(existing);
        } else {
            UserBehavior behavior = new UserBehavior();
            behavior.setUserId(userId);
            behavior.setTargetId(targetId);
            behavior.setBehaviorType(behaviorType);
            behavior.setScore(BigDecimal.valueOf(score != null ? score : 1.0));
            success = save(behavior);
        }

        if (success && "RATE".equalsIgnoreCase(behaviorType)) {
            refreshTargetRating(targetId);
        }
        return success;
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

    private void incrementTargetClickCount(String targetId) {
        if (targetId == null) {
            return;
        }
        if (targetId.startsWith("place_")) {
            SpotPlace place = placeMapper.selectById(targetId);
            if (place != null) {
                place.setClickCount((place.getClickCount() == null ? 0 : place.getClickCount()) + 1);
                placeMapper.updateById(place);
            }
            return;
        }

        if (targetId.startsWith("diary_")) {
            TravelDiary diary = diaryMapper.selectById(targetId);
            if (diary != null) {
                diary.setClickCount((diary.getClickCount() == null ? 0 : diary.getClickCount()) + 1);
                diaryMapper.updateById(diary);
            }
        }
    }

    private void refreshTargetRating(String targetId) {
        List<UserBehavior> ratings = getRatingsForTarget(targetId);
        BigDecimal total = ratings.stream()
                .map(UserBehavior::getScore)
                .filter(score -> score != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        int ratingCount = ratings.size();
        BigDecimal average = ratingCount == 0
                ? BigDecimal.ZERO
                : total.divide(BigDecimal.valueOf(ratingCount), 1, RoundingMode.HALF_UP);

        if (targetId.startsWith("place_")) {
            SpotPlace place = placeMapper.selectById(targetId);
            if (place != null) {
                place.setRating(average);
                place.setRatingCount(ratingCount);
                placeMapper.updateById(place);
            }
            return;
        }

        if (targetId.startsWith("diary_")) {
            TravelDiary diary = diaryMapper.selectById(targetId);
            if (diary != null) {
                diary.setRating(average);
                diary.setRatingCount(ratingCount);
                diaryMapper.updateById(diary);
            }
        }
    }
}
