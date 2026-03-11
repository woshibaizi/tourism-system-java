package com.tourism.model.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("travel_diary")
public class TravelDiary {

    @TableId(type = IdType.INPUT)
    private String id;

    private String title;

    @TableField(value = "`content`")
    private String content;

    private String placeId;

    private Long authorId;

    private Integer clickCount;

    private BigDecimal rating;

    private Integer ratingCount;

    /** 图片URL列表，JSON数组 */
    private String images;

    /** 视频URL列表，JSON数组 */
    private String videos;

    /** 标签，JSON数组 */
    private String tags;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
