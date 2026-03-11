package com.tourism.model.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("spot_road_edge")
public class SpotRoadEdge {

    @TableId(type = IdType.INPUT)
    private String id;

    /** 起始节点ID（intersection_xxx 或 building/facility ID） */
    private String fromNode;

    /** 终止节点ID */
    private String toNode;

    /** 距离，单位：米 */
    private BigDecimal distance;

    /** 理想速度，单位：km/h */
    private BigDecimal idealSpeed;

    /** 拥堵系数 0~1 */
    private BigDecimal congestionRate;

    /** 允许通行方式，JSON数组，如 ["步行","自行车"] */
    private String allowedVehicles;

    /** 道路类型：校园道路 / 步行道 / 主干道 等 */
    private String roadType;

    /** 所属场所（可为空，表示跨场所道路） */
    private String placeId;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
