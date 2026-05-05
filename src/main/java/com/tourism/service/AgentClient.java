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

    public Map<String, Object> getHealth() {
        return getForMap("/health");
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> listSessions(String userId) {
        // Python 侧返回的是数组结构，这里直接按列表接收并转成 Map 列表即可。
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

    public Map<String, Object> chat(Map<String, Object> payload) {
        // Java 后端不在这里解释业务语义，只做鉴权后透传和错误翻译。
        try {
            return agentRestTemplate.postForObject("/agent/chat", new HttpEntity<>(payload), Map.class);
        } catch (HttpStatusCodeException exception) {
            throw new BusinessException(exception.getStatusCode().value(), extractErrorMessage(exception));
        } catch (RestClientException exception) {
            throw new BusinessException(503, "个性化旅游助手服务不可用: " + exception.getMessage());
        }
    }

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
        // 尽量保留 Python agent 的原始报错，便于前端定位是权限问题、会话问题还是服务异常。
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
                // 如果不是 JSON，就继续走原始字符串兜底。
            }
            return "个性化旅游助手请求失败: " + body;
        }
        return "个性化旅游助手请求失败: " + exception.getStatusCode().value();
    }
}
