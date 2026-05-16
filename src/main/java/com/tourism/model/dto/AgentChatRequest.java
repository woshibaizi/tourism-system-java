package com.tourism.model.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.Map;

public class AgentChatRequest {

    /** 前端已有会话时回传；为空表示新开一段对话。 */
    @JsonProperty("session_id")
    private String sessionId;

    @NotBlank(message = "消息不能为空")
    @Size(max = 4000, message = "消息长度不能超过4000个字符")
    private String message;

    /** 预留的会话模式字段，后续可扩展 diary / route / general chat 等场景。 */
    @JsonProperty("mode")
    private String mode = "travel_assistant";

    /** 扩展元数据，供前端传埋点、入口来源、用户上下文等附加信息。 */
    @JsonProperty("metadata")
    private Map<String, Object> metadata = new LinkedHashMap<>();

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }

    public void setMetadata(Map<String, Object> metadata) {
        this.metadata = metadata == null ? new LinkedHashMap<>() : metadata;
    }
}
