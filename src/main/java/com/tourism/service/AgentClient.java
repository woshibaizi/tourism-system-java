package com.tourism.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tourism.exception.BusinessException;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Service
public class AgentClient {

    /** 专用于 Python agent 服务的 HTTP 客户端。 */
    private final RestTemplate agentRestTemplate;
    private final ObjectMapper objectMapper;

    public AgentClient(RestTemplate agentRestTemplate, ObjectMapper objectMapper) {
        this.agentRestTemplate = agentRestTemplate;
        this.objectMapper = objectMapper;
    }

    // ==================== 健康检查 ====================

    public Map<String, Object> getHealth() {
        return getForMap("/health");
    }

    // ==================== 会话管理 ====================

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> listSessions(String userId) {
        try {
            ResponseEntity<List> response = agentRestTemplate.exchange(
                    "/agent/sessions?user_id={userId}",
                    HttpMethod.GET,
                    null,
                    List.class,
                    userId
            );
            return (List<Map<String, Object>>) response.getBody();
        } catch (HttpStatusCodeException exception) {
            throw new BusinessException(exception.getStatusCode().value(), extractErrorMessage(exception));
        } catch (RestClientException exception) {
            throw new BusinessException(503, "个性化旅游助手服务不可用: " + exception.getMessage());
        }
    }

    public Map<String, Object> getSession(String sessionId, String userId) {
        return getForMap("/agent/sessions/{sessionId}?user_id={userId}", sessionId, userId);
    }

    public Map<String, Object> deleteSession(String sessionId, String userId) {
        try {
            ResponseEntity<Map> response = agentRestTemplate.exchange(
                    "/agent/sessions/{sessionId}?user_id={userId}",
                    HttpMethod.DELETE,
                    null,
                    Map.class,
                    sessionId, userId
            );
            return response.getBody();
        } catch (HttpStatusCodeException exception) {
            throw new BusinessException(exception.getStatusCode().value(), extractErrorMessage(exception));
        } catch (RestClientException exception) {
            throw new BusinessException(503, "个性化旅游助手服务不可用: " + exception.getMessage());
        }
    }

    // ==================== 聊天 ====================

    public Map<String, Object> chat(Map<String, Object> payload) {
        try {
            return agentRestTemplate.postForObject("/agent/chat", new HttpEntity<>(payload), Map.class);
        } catch (HttpStatusCodeException exception) {
            throw new BusinessException(exception.getStatusCode().value(), extractErrorMessage(exception));
        } catch (RestClientException exception) {
            throw new BusinessException(503, "个性化旅游助手服务不可用: " + exception.getMessage());
        }
    }

    // ==================== 出游搭子 ====================

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> listBuddies(String userId) {
        try {
            ResponseEntity<List> response = agentRestTemplate.exchange(
                    "/agent/user/buddy?user_id={userId}",
                    HttpMethod.GET,
                    null,
                    List.class,
                    userId
            );
            return (List<Map<String, Object>>) response.getBody();
        } catch (HttpStatusCodeException exception) {
            throw new BusinessException(exception.getStatusCode().value(), extractErrorMessage(exception));
        } catch (RestClientException exception) {
            throw new BusinessException(503, "个性化旅游助手服务不可用: " + exception.getMessage());
        }
    }

    public Map<String, Object> upsertBuddy(Map<String, Object> payload) {
        try {
            return agentRestTemplate.exchange(
                    "/agent/user/buddy",
                    HttpMethod.PUT,
                    new HttpEntity<>(payload),
                    Map.class
            ).getBody();
        } catch (HttpStatusCodeException exception) {
            throw new BusinessException(exception.getStatusCode().value(), extractErrorMessage(exception));
        } catch (RestClientException exception) {
            throw new BusinessException(503, "个性化旅游助手服务不可用: " + exception.getMessage());
        }
    }

    public Map<String, Object> deleteBuddy(String buddyId, String userId) {
        try {
            ResponseEntity<Map> response = agentRestTemplate.exchange(
                    "/agent/user/buddy/{buddyId}?user_id={userId}",
                    HttpMethod.DELETE,
                    null,
                    Map.class,
                    buddyId, userId
            );
            return response.getBody();
        } catch (HttpStatusCodeException exception) {
            throw new BusinessException(exception.getStatusCode().value(), extractErrorMessage(exception));
        } catch (RestClientException exception) {
            throw new BusinessException(503, "个性化旅游助手服务不可用: " + exception.getMessage());
        }
    }

    public Map<String, Object> useBuddy(String buddyId, String userId) {
        try {
            return agentRestTemplate.postForObject(
                    "/agent/user/buddy/{buddyId}/use?user_id={userId}",
                    null,
                    Map.class,
                    buddyId, userId
            );
        } catch (HttpStatusCodeException exception) {
            throw new BusinessException(exception.getStatusCode().value(), extractErrorMessage(exception));
        } catch (RestClientException exception) {
            throw new BusinessException(503, "个性化旅游助手服务不可用: " + exception.getMessage());
        }
    }

    // ==================== 日记生成 ====================

    public Map<String, Object> generateDiary(Map<String, Object> payload) {
        try {
            return agentRestTemplate.postForObject("/agent/diary/generate", new HttpEntity<>(payload), Map.class);
        } catch (HttpStatusCodeException exception) {
            throw new BusinessException(exception.getStatusCode().value(), extractErrorMessage(exception));
        } catch (RestClientException exception) {
            throw new BusinessException(503, "个性化旅游助手服务不可用: " + exception.getMessage());
        }
    }

    public Map<String, Object> getDiaryTaskStatus(String taskId) {
        return getForMap("/agent/diary/status/{taskId}", taskId);
    }

    // ==================== 路线规划 ====================

    public Map<String, Object> planRoute(Map<String, Object> payload) {
        try {
            return agentRestTemplate.postForObject("/agent/route/plan", new HttpEntity<>(payload), Map.class);
        } catch (HttpStatusCodeException exception) {
            throw new BusinessException(exception.getStatusCode().value(), extractErrorMessage(exception));
        } catch (RestClientException exception) {
            throw new BusinessException(503, "个性化旅游助手服务不可用: " + exception.getMessage());
        }
    }

    // ==================== 内部方法 ====================

    private Map<String, Object> getForMap(String path, Object... uriVariables) {
        try {
            return agentRestTemplate.getForObject(path, Map.class, uriVariables);
        } catch (HttpStatusCodeException exception) {
            throw new BusinessException(exception.getStatusCode().value(), extractErrorMessage(exception));
        } catch (RestClientException exception) {
            throw new BusinessException(503, "个性化旅游助手服务不可用: " + exception.getMessage());
        }
    }

    private String extractErrorMessage(HttpStatusCodeException exception) {
        String body = exception.getResponseBodyAsString();
        if (body != null && !body.isBlank()) {
            try {
                Map<String, Object> errorPayload = objectMapper.readValue(body, new TypeReference<>() {
                });
                Object message = errorPayload.get("message");
                if (message instanceof String text && !text.isBlank()) {
                    return "个性化旅游助手请求失败: " + text;
                }

                Object detail = errorPayload.get("detail");
                if (detail instanceof String text && !text.isBlank()) {
                    return "个性化旅游助手请求失败: " + text;
                }
            } catch (Exception ignored) {
            }
            return "个性化旅游助手请求失败: " + body;
        }
        return "个性化旅游助手请求失败: " + exception.getStatusCode().value();
    }
}
