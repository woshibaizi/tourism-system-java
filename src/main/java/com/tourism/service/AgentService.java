package com.tourism.service;

import com.tourism.model.dto.AgentChatRequest;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class AgentService {

    /** 统一封装 Java -> Python agent 的调用编排。 */
    private final AgentClient agentClient;

    public AgentService(AgentClient agentClient) {
        this.agentClient = agentClient;
    }

    public Map<String, Object> health() {
        return agentClient.getHealth();
    }

    public List<Map<String, Object>> listSessions(Long userId) {
        return agentClient.listSessions(String.valueOf(userId));
    }

    public Map<String, Object> getSession(Long userId, String sessionId) {
        return agentClient.getSession(sessionId, String.valueOf(userId));
    }

    public Map<String, Object> chat(Long userId, AgentChatRequest request) {
        // userId 统一从登录态中获取，不信任前端自行传递，避免越权模拟其他用户。
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("user_id", String.valueOf(userId));
        payload.put("session_id", request.getSessionId());
        payload.put("message", request.getMessage());
        payload.put("mode", request.getMode());
        payload.put("metadata", request.getMetadata());
        return agentClient.chat(payload);
    }
}
