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

    private final AgentService agentService;

    public AgentController(AgentService agentService) {
        this.agentService = agentService;
    }

    // ==================== 健康 & 会话 ====================

    @Operation(summary = "检查个性化旅游助手服务健康状态")
    @GetMapping("/health")
    public Result<Map<String, Object>> health() {
        return Result.success(agentService.health());
    }

    @Operation(summary = "查询当前用户的聊天会话列表")
    @GetMapping("/sessions")
    public Result<List<Map<String, Object>>> listSessions(@AuthenticationPrincipal User principal) {
        return Result.success(agentService.listSessions(Long.parseLong(principal.getUsername())));
    }

    @Operation(summary = "查询当前用户的聊天会话详情")
    @GetMapping("/sessions/{sessionId}")
    public Result<Map<String, Object>> getSession(@AuthenticationPrincipal User principal,
                                                  @PathVariable String sessionId) {
        return Result.success(agentService.getSession(Long.parseLong(principal.getUsername()), sessionId));
    }

    @Operation(summary = "删除当前用户的一个聊天会话")
    @DeleteMapping("/sessions/{sessionId}")
    public Result<Map<String, Object>> deleteSession(@AuthenticationPrincipal User principal,
                                                     @PathVariable String sessionId) {
        return Result.success(agentService.deleteSession(Long.parseLong(principal.getUsername()), sessionId));
    }

    // ==================== 聊天 ====================

    @Operation(summary = "发送一条消息给个性化旅游助手")
    @PostMapping("/chat")
    public Result<Map<String, Object>> chat(@AuthenticationPrincipal User principal,
                                            @Valid @RequestBody AgentChatRequest request) {
        return Result.success(agentService.chat(Long.parseLong(principal.getUsername()), request));
    }

    // ==================== 出游搭子 ====================

    @Operation(summary = "获取当前用户的出游搭子列表")
    @GetMapping("/user/buddy")
    public Result<List<Map<String, Object>>> listBuddies(@AuthenticationPrincipal User principal) {
        return Result.success(agentService.listBuddies(Long.parseLong(principal.getUsername())));
    }

    @Operation(summary = "创建或更新出游搭子")
    @PutMapping("/user/buddy")
    public Result<Map<String, Object>> upsertBuddy(@AuthenticationPrincipal User principal,
                                                   @RequestBody Map<String, Object> payload) {
        return Result.success(agentService.upsertBuddy(Long.parseLong(principal.getUsername()), payload));
    }

    @Operation(summary = "删除出游搭子")
    @DeleteMapping("/user/buddy/{buddyId}")
    public Result<Map<String, Object>> deleteBuddy(@AuthenticationPrincipal User principal,
                                                   @PathVariable String buddyId) {
        return Result.success(agentService.deleteBuddy(Long.parseLong(principal.getUsername()), buddyId));
    }

    @Operation(summary = "记录出游搭子使用")
    @PostMapping("/user/buddy/{buddyId}/use")
    public Result<Map<String, Object>> useBuddy(@AuthenticationPrincipal User principal,
                                                @PathVariable String buddyId) {
        return Result.success(agentService.useBuddy(Long.parseLong(principal.getUsername()), buddyId));
    }

    // ==================== 日记生成 ====================

    @Operation(summary = "启动AI旅行日记生成任务")
    @PostMapping("/diary/generate")
    public Result<Map<String, Object>> generateDiary(@AuthenticationPrincipal User principal,
                                                     @RequestBody Map<String, Object> payload) {
        return Result.success(agentService.generateDiary(Long.parseLong(principal.getUsername()), payload));
    }

    @Operation(summary = "查询日记生成任务进度")
    @GetMapping("/diary/status/{taskId}")
    public Result<Map<String, Object>> getDiaryTaskStatus(@PathVariable String taskId) {
        return Result.success(agentService.getDiaryTaskStatus(taskId));
    }

    // ==================== 路线规划 ====================

    @Operation(summary = "自然语言路线规划")
    @PostMapping("/route/plan")
    public Result<Map<String, Object>> planRoute(@AuthenticationPrincipal User principal,
                                                 @RequestBody Map<String, Object> payload) {
        return Result.success(agentService.planRoute(Long.parseLong(principal.getUsername()), payload));
    }
}
