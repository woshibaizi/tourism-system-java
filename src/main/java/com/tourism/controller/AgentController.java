package com.tourism.controller;

import com.tourism.model.dto.AgentChatRequest;
import com.tourism.service.AgentService;
import com.tourism.utils.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.User;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Tag(name = "个性化旅游助手")
@RestController
@RequestMapping("/api/agent")
public class AgentController {

    /** 控制层只负责鉴权用户上下文与 HTTP 契约，不承担 Python agent 业务逻辑。 */
    private final AgentService agentService;

    public AgentController(AgentService agentService) {
        this.agentService = agentService;
    }

    @Operation(summary = "检查个性化旅游助手服务健康状态")
    @GetMapping("/health")
    public Result<Map<String, Object>> health() {
        return Result.success(agentService.health());
    }

    @Operation(summary = "查询当前用户的聊天会话列表")
    @GetMapping("/sessions")
    public Result<List<Map<String, Object>>> listSessions(@AuthenticationPrincipal User principal) {
        // 会话接口强依赖登录态，避免不同用户之间互相读取聊天历史。
        return Result.success(agentService.listSessions(Long.parseLong(principal.getUsername())));
    }

    @Operation(summary = "查询当前用户的聊天会话详情")
    @GetMapping("/sessions/{sessionId}")
    public Result<Map<String, Object>> getSession(@AuthenticationPrincipal User principal,
                                                  @PathVariable String sessionId) {
        return Result.success(agentService.getSession(Long.parseLong(principal.getUsername()), sessionId));
    }

    @Operation(summary = "发送一条消息给个性化旅游助手")
    @PostMapping("/chat")
    public Result<Map<String, Object>> chat(@AuthenticationPrincipal User principal,
                                            @Valid @RequestBody AgentChatRequest request) {
        // 当前用户 ID 只能来自 JWT 解析后的登录态，不能由前端请求体自己指定。
        return Result.success(agentService.chat(Long.parseLong(principal.getUsername()), request));
    }
}
