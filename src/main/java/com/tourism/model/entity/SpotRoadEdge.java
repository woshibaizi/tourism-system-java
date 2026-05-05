package com.tourism.model.entity;

import com.baomidou.mybatisplus.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

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

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getFromNode() {
        return fromNode;
    }

    public void setFromNode(String fromNode) {
        this.fromNode = fromNode;
    }

    public String getToNode() {
        return toNode;
    }

    public void setToNode(String toNode) {
        this.toNode = toNode;
    }

    public BigDecimal getDistance() {
        return distance;
    }

    public void setDistance(BigDecimal distance) {
        this.distance = distance;
    }

    public BigDecimal getIdealSpeed() {
        return idealSpeed;
    }

    public void setIdealSpeed(BigDecimal idealSpeed) {
        this.idealSpeed = idealSpeed;
    }

    public BigDecimal getCongestionRate() {
        return congestionRate;
    }

    public void setCongestionRate(BigDecimal congestionRate) {
        this.congestionRate = congestionRate;
    }

    public String getAllowedVehicles() {
        return allowedVehicles;
    }

    public void setAllowedVehicles(String allowedVehicles) {
        this.allowedVehicles = allowedVehicles;
    }

    public String getRoadType() {
        return roadType;
    }

    public void setRoadType(String roadType) {
        this.roadType = roadType;
    }

    public String getPlaceId() {
        return placeId;
    }

    public void setPlaceId(String placeId) {
        this.placeId = placeId;
    }

    public Integer getDeleted() {
        return deleted;
    }

    public void setDeleted(Integer deleted) {
        this.deleted = deleted;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
