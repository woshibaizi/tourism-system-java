package com.tourism.model.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("spot_building")
public class SpotBuilding {

    @TableId(type = IdType.INPUT)
    private String id;

    private String name;

    /** 类型：教学楼 / 宿舍楼 / 行政楼 等 */
    private String type;

    /** 所属场所 */
    private String placeId;

    private BigDecimal lat;

    private BigDecimal lng;

    @TableField(value = "`description`")
    private String description;

    private BigDecimal rating;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
