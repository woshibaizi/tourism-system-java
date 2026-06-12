package com.tourism.model.entity;

import com.baomidou.mybatisplus.annotation.*;
import java.time.LocalDateTime;

@TableName("xhs_publish_log")
public class XhsPublishLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private String diaryId;

    private String action;

    private String requestSummary;

    private String responseData;

    private String errorMsg;

    private String ipAddress;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getDiaryId() { return diaryId; }
    public void setDiaryId(String diaryId) { this.diaryId = diaryId; }

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public String getRequestSummary() { return requestSummary; }
    public void setRequestSummary(String requestSummary) { this.requestSummary = requestSummary; }

    public String getResponseData() { return responseData; }
    public void setResponseData(String responseData) { this.responseData = responseData; }

    public String getErrorMsg() { return errorMsg; }
    public void setErrorMsg(String errorMsg) { this.errorMsg = errorMsg; }

    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
