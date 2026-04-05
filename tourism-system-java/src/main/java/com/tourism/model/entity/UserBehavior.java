package com.tourism.model.entity;

import com.baomidou.mybatisplus.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 用户行为表 —— 记录浏览、点赞、评分，为协同过滤算法提供数据源
 */
@TableName("user_behavior")
public class UserBehavior {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    /**
     * 目标ID（placeId 或 diaryId）
     */
    private String targetId;

    /**
     * 行为类型：VIEW(浏览) / LIKE(点赞) / RATE(评分) / COLLECT(收藏)
     */
    private String behaviorType;

    /**
     * 评分值（仅 RATE 类型有意义，其余默认 1.0）
     */
    private BigDecimal score;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getTargetId() {
        return targetId;
    }

    public void setTargetId(String targetId) {
        this.targetId = targetId;
    }

    public String getBehaviorType() {
        return behaviorType;
    }

    public void setBehaviorType(String behaviorType) {
        this.behaviorType = behaviorType;
    }

    public BigDecimal getScore() {
        return score;
    }

    public void setScore(BigDecimal score) {
        this.score = score;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
