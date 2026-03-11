package com.tourism.model.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("spot_place")
public class SpotPlace {

    /** 原始字符串ID，如 "place_001" */
    @TableId(type = IdType.INPUT)
    private String id;

    private String name;

    /** 类型：校园 / 景区 / 公园 等 */
    private String type;

    /** 关键词，JSON数组 */
    private String keywords;

    /** 特色标签，JSON数组 */
    private String features;

    private BigDecimal rating;

    private Integer ratingCount;

    private Integer clickCount;

    /** 纬度 */
    private BigDecimal lat;

    /** 经度 */
    private BigDecimal lng;

    private String address;

    private String openTime;

    private String image;

    @TableField(value = "`description`")
    private String description;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
