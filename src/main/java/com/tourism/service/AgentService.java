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

    // ==================== 健康 & 会话 ====================

    public Map<String, Object> health() {
        return agentClient.getHealth();
    }

    public List<Map<String, Object>> listSessions(Long userId) {
        return agentClient.listSessions(String.valueOf(userId));
    }

    public Map<String, Object> getSession(Long userId, String sessionId) {
        return agentClient.getSession(sessionId, String.valueOf(userId));
    }

    public Map<String, Object> deleteSession(Long userId, String sessionId) {
        return agentClient.deleteSession(sessionId, String.valueOf(userId));
    }

    // ==================== 聊天 ====================

    public Map<String, Object> chat(Long userId, AgentChatRequest request) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("user_id", String.valueOf(userId));
        payload.put("session_id", request.getSessionId());
        payload.put("message", request.getMessage());
        payload.put("mode", request.getMode());
        payload.put("metadata", request.getMetadata());
        return agentClient.chat(payload);
    }

    // ==================== 出游搭子 ====================

    public List<Map<String, Object>> listBuddies(Long userId) {
        return agentClient.listBuddies(String.valueOf(userId));
    }

    public Map<String, Object> upsertBuddy(Long userId, Map<String, Object> payload) {
        Map<String, Object> full = new LinkedHashMap<>(payload);
        full.putIfAbsent("user_id", String.valueOf(userId));
        return agentClient.upsertBuddy(full);
    }

    public Map<String, Object> deleteBuddy(Long userId, String buddyId) {
        return agentClient.deleteBuddy(buddyId, String.valueOf(userId));
    }

    public Map<String, Object> useBuddy(Long userId, String buddyId) {
        return agentClient.useBuddy(buddyId, String.valueOf(userId));
    }

    // ==================== 日记生成 ====================

    public Map<String, Object> generateDiary(Long userId, Map<String, Object> payload) {
        Map<String, Object> full = new LinkedHashMap<>(payload);
        full.putIfAbsent("user_id", String.valueOf(userId));
        return agentClient.generateDiary(full);
    }

    public Map<String, Object> getDiaryTaskStatus(String taskId) {
        return agentClient.getDiaryTaskStatus(taskId);
    }

    // ==================== 路线规划 ====================

    public Map<String, Object> planRoute(Long userId, Map<String, Object> payload) {
        Map<String, Object> full = new LinkedHashMap<>(payload);
        full.putIfAbsent("user_id", String.valueOf(userId));
        return agentClient.planRoute(full);
    }
}
