package com.tourism.model.entity;

import com.baomidou.mybatisplus.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

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

    private Integer likeCount;

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

    /** 小红书发布状态: NULL=未发布, 'publishing'=发布中, 'published'=已发布, 'failed'=失败 */
    private String xhsPublishStatus;

    /** 小红书笔记 ID (发布成功后回写) */
    private String xhsNoteId;

    /** 小红书笔记链接 */
    private String xhsPublishUrl;

    /** 小红书发布时间 */
    private LocalDateTime xhsPublishedAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getPlaceId() {
        return placeId;
    }

    public void setPlaceId(String placeId) {
        this.placeId = placeId;
    }

    public Long getAuthorId() {
        return authorId;
    }

    public void setAuthorId(Long authorId) {
        this.authorId = authorId;
    }

    public Integer getClickCount() {
        return clickCount;
    }

    public void setClickCount(Integer clickCount) {
        this.clickCount = clickCount;
    }

    public Integer getLikeCount() {
        return likeCount;
    }

    public void setLikeCount(Integer likeCount) {
        this.likeCount = likeCount;
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

    public String getImages() {
        return images;
    }

    public void setImages(String images) {
        this.images = images;
    }

    public String getVideos() {
        return videos;
    }

    public void setVideos(String videos) {
        this.videos = videos;
    }

    public String getTags() {
        return tags;
    }

    public void setTags(String tags) {
        this.tags = tags;
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

    public String getXhsPublishStatus() { return xhsPublishStatus; }
    public void setXhsPublishStatus(String xhsPublishStatus) { this.xhsPublishStatus = xhsPublishStatus; }

    public String getXhsNoteId() { return xhsNoteId; }
    public void setXhsNoteId(String xhsNoteId) { this.xhsNoteId = xhsNoteId; }

    public String getXhsPublishUrl() { return xhsPublishUrl; }
    public void setXhsPublishUrl(String xhsPublishUrl) { this.xhsPublishUrl = xhsPublishUrl; }

    public LocalDateTime getXhsPublishedAt() { return xhsPublishedAt; }
    public void setXhsPublishedAt(LocalDateTime xhsPublishedAt) { this.xhsPublishedAt = xhsPublishedAt; }
}
