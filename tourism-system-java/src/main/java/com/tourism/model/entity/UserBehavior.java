package com.tourism.model.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 用户行为表 —— 记录浏览、点赞、评分，为协同过滤算法提供数据源
 */
@Data
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
}
