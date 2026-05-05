package com.tourism.model.entity;

import com.baomidou.mybatisplus.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

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

    @TableField(exist = false)
    private BigDecimal mapLat;

    @TableField(exist = false)
    private BigDecimal mapLng;

    @TableField(exist = false)
    private String coordSystem;

    @TableField(exist = false)
    private String mapCoordSystem;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getPlaceId() {
        return placeId;
    }

    public void setPlaceId(String placeId) {
        this.placeId = placeId;
    }

    public BigDecimal getLat() {
        return lat;
    }

    public void setLat(BigDecimal lat) {
        this.lat = lat;
    }

    public BigDecimal getLng() {
        return lng;
    }

    public void setLng(BigDecimal lng) {
        this.lng = lng;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public BigDecimal getRating() {
        return rating;
    }

    public void setRating(BigDecimal rating) {
        this.rating = rating;
    }

    public BigDecimal getMapLat() {
        return mapLat;
    }

    public void setMapLat(BigDecimal mapLat) {
        this.mapLat = mapLat;
    }

    public BigDecimal getMapLng() {
        return mapLng;
    }

    public void setMapLng(BigDecimal mapLng) {
        this.mapLng = mapLng;
    }

    public String getCoordSystem() {
        return coordSystem;
    }

    public void setCoordSystem(String coordSystem) {
        this.coordSystem = coordSystem;
    }

    public String getMapCoordSystem() {
        return mapCoordSystem;
    }

    public void setMapCoordSystem(String mapCoordSystem) {
        this.mapCoordSystem = mapCoordSystem;
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

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
