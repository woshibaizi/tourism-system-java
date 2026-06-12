package com.tourism.model.entity;

import com.baomidou.mybatisplus.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 校园周边商户/场所表
 */
@TableName("spot_surrounding")
public class SpotSurrounding {

    /** 主键，如 sr_001_01 */
    @TableId(type = IdType.INPUT)
    private String id;

    /** 商户/场所名称 */
    private String name;

    /** 类型：restaurant / shopping / entertainment / hotel / transport / service */
    private String type;

    /** 子类型：hotpot / milk_tea / cinema / ktv / metro 等 */
    private String subType;

    /** 所属校园ID */
    private String placeId;

    private BigDecimal lat;

    private BigDecimal lng;

    private String address;

    /** 距校园中心距离（米） */
    private Integer distanceMeters;

    /** 价格区间：¥ / ¥¥ / ¥¥¥ */
    private String priceRange;

    /** 人均消费（元） */
    private BigDecimal avgCost;

    private String openTime;

    private String phone;

    /** 封面图片路径 */
    private String image;

    /** 多图 JSON 数组 */
    private String images;

    /** 标签 JSON 数组 */
    private String tags;

    private BigDecimal rating;

    private Integer ratingCount;

    private Integer clickCount;

    @TableField(value = "`description`")
    private String description;

    private String detailDescription;

    /** 是否有学生优惠 */
    private Integer studentDiscount;

    /** 必点/必玩推荐 */
    private String mustTry;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    // ==================== Getters & Setters ====================

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

    public String getSubType() {
        return subType;
    }

    public void setSubType(String subType) {
        this.subType = subType;
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

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public Integer getDistanceMeters() {
        return distanceMeters;
    }

    public void setDistanceMeters(Integer distanceMeters) {
        this.distanceMeters = distanceMeters;
    }

    public String getPriceRange() {
        return priceRange;
    }

    public void setPriceRange(String priceRange) {
        this.priceRange = priceRange;
    }

    public BigDecimal getAvgCost() {
        return avgCost;
    }

    public void setAvgCost(BigDecimal avgCost) {
        this.avgCost = avgCost;
    }

    public String getOpenTime() {
        return openTime;
    }

    public void setOpenTime(String openTime) {
        this.openTime = openTime;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getImage() {
        return image;
    }

    public void setImage(String image) {
        this.image = image;
    }

    public String getImages() {
        return images;
    }

    public void setImages(String images) {
        this.images = images;
    }

    public String getTags() {
        return tags;
    }

    public void setTags(String tags) {
        this.tags = tags;
    }

    public BigDecimal getRating() {
        return rating;
    }

    public void setRating(BigDecimal rating) {
        this.rating = rating;
    }

    public Integer getRatingCount() {
        return ratingCount;
    }

    public void setRatingCount(Integer ratingCount) {
        this.ratingCount = ratingCount;
    }

    public Integer getClickCount() {
        return clickCount;
    }

    public void setClickCount(Integer clickCount) {
        this.clickCount = clickCount;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getDetailDescription() {
        return detailDescription;
    }

    public void setDetailDescription(String detailDescription) {
        this.detailDescription = detailDescription;
    }

    public Integer getStudentDiscount() {
        return studentDiscount;
    }

    public void setStudentDiscount(Integer studentDiscount) {
        this.studentDiscount = studentDiscount;
    }

    public String getMustTry() {
        return mustTry;
    }

    public void setMustTry(String mustTry) {
        this.mustTry = mustTry;
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
