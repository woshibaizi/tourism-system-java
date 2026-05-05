package com.tourism;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tourism.model.dto.AgentChatRequest;
import com.tourism.service.AgentClient;
import com.tourism.service.AgentService;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

class AgentServiceTests {

    @Test
    void chatShouldForwardAuthenticatedUserIdInsteadOfTrustingFrontend() {
        CapturingAgentClient fakeClient = new CapturingAgentClient();
        AgentService agentService = new AgentService(fakeClient);

        AgentChatRequest request = new AgentChatRequest();
        request.setSessionId("session_123");
        request.setMessage("帮我规划路线");
        request.setMode("travel_assistant");
        request.setMetadata(Map.of("entry", "web"));

        Map<String, Object> actual = agentService.chat(42L, request);

        assertEquals("42", fakeClient.lastPayload.get("user_id"));
        assertEquals("session_123", fakeClient.lastPayload.get("session_id"));
        assertEquals("帮我规划路线", fakeClient.lastPayload.get("message"));
        assertEquals("travel_assistant", fakeClient.lastPayload.get("mode"));
        assertEquals(Map.of("entry", "web"), fakeClient.lastPayload.get("metadata"));
        assertSame(fakeClient.response, actual);
    }

    /**
     * 用最轻量的假对象替代 Mockito，避免当前 Java 25 + ByteBuddy 组合下的内联 mock 兼容性问题。
     */
    private static final class CapturingAgentClient extends AgentClient {

        private Map<String, Object> lastPayload;
        private final Map<String, Object> response = Map.of("reply", Map.of("content", "ok"));

        private CapturingAgentClient() {
            super(new RestTemplate(), new ObjectMapper());
        }

        @Override
        public Map<String, Object> chat(Map<String, Object> payload) {
            this.lastPayload = payload;
            return response;
        }
    }
}
