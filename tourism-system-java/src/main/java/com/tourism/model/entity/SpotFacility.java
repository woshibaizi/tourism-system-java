package com.tourism.model.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("spot_facility")
public class SpotFacility {

    @TableId(type = IdType.INPUT)
    private String id;

    private String name;

    /**
     * 设施类型：商店 / 饭店 / 洗手间 / 图书馆 / 食堂 / 超市 / 咖啡馆
     *          公交站 / 停车场 / 邮局 / 医院 / 银行 / 其他 等
     */
    private String type;

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
