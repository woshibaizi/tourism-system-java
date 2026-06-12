package com.tourism.model.entity;

import com.baomidou.mybatisplus.annotation.*;
import java.time.LocalDateTime;

@TableName("user_xhs_account")
public class UserXhsAccount {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private String encryptedCookies;

    private String xhsUserId;

    private String xhsUsername;

    private String xhsAvatar;

    /** 1=有效, 0=已失效 */
    private Integer status;

    private LocalDateTime lastValidatedAt;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getEncryptedCookies() { return encryptedCookies; }
    public void setEncryptedCookies(String encryptedCookies) { this.encryptedCookies = encryptedCookies; }

    public String getXhsUserId() { return xhsUserId; }
    public void setXhsUserId(String xhsUserId) { this.xhsUserId = xhsUserId; }

    public String getXhsUsername() { return xhsUsername; }
    public void setXhsUsername(String xhsUsername) { this.xhsUsername = xhsUsername; }

    public String getXhsAvatar() { return xhsAvatar; }
    public void setXhsAvatar(String xhsAvatar) { this.xhsAvatar = xhsAvatar; }

    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }

    public LocalDateTime getLastValidatedAt() { return lastValidatedAt; }
    public void setLastValidatedAt(LocalDateTime lastValidatedAt) { this.lastValidatedAt = lastValidatedAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
