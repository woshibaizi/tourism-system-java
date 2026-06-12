package com.tourism.model.entity;

import com.baomidou.mybatisplus.annotation.*;
import java.time.LocalDateTime;

@TableName("spot_xhs_info")
public class SpotXhsInfo {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String placeId;

    private String placeName;

    private Integer trendingScore;

    private Integer noteCount;

    /** JSON: Top 10 笔记摘要 */
    private String topNotes;

    /** JSON: 高频标签 */
    private String topTags;

    /** JSON: 高频关键词 */
    private String topKeywords;

    /** JSON: 使用的搜索词 */
    private String searchQueries;

    private LocalDateTime cacheExpires;

    private LocalDateTime lastUpdated;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    // ── getters/setters ──

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getPlaceId() { return placeId; }
    public void setPlaceId(String placeId) { this.placeId = placeId; }

    public String getPlaceName() { return placeName; }
    public void setPlaceName(String placeName) { this.placeName = placeName; }

    public Integer getTrendingScore() { return trendingScore; }
    public void setTrendingScore(Integer trendingScore) { this.trendingScore = trendingScore; }

    public Integer getNoteCount() { return noteCount; }
    public void setNoteCount(Integer noteCount) { this.noteCount = noteCount; }

    public String getTopNotes() { return topNotes; }
    public void setTopNotes(String topNotes) { this.topNotes = topNotes; }

    public String getTopTags() { return topTags; }
    public void setTopTags(String topTags) { this.topTags = topTags; }

    public String getTopKeywords() { return topKeywords; }
    public void setTopKeywords(String topKeywords) { this.topKeywords = topKeywords; }

    public String getSearchQueries() { return searchQueries; }
    public void setSearchQueries(String searchQueries) { this.searchQueries = searchQueries; }

    public LocalDateTime getCacheExpires() { return cacheExpires; }
    public void setCacheExpires(LocalDateTime cacheExpires) { this.cacheExpires = cacheExpires; }

    public LocalDateTime getLastUpdated() { return lastUpdated; }
    public void setLastUpdated(LocalDateTime lastUpdated) { this.lastUpdated = lastUpdated; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
