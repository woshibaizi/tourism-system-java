package com.tourism.controller;

import com.tourism.service.XhsAccountService;
import com.tourism.utils.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Tag(name = "小红书模块", description = "小红书账号绑定与发布")
@RestController
@RequestMapping("/api/xhs")
public class XhsController {

    private final XhsAccountService xhsAccountService;

    public XhsController(XhsAccountService xhsAccountService) {
        this.xhsAccountService = xhsAccountService;
    }

    @Operation(summary = "绑定小红书账号")
    @PostMapping("/bind")
    public Result<Map<String, Object>> bind(@RequestBody Map<String, Object> body) {
        Long userId = extractUserId(body);
        String cookiesStr = (String) body.get("cookies_str");
        if (cookiesStr == null || cookiesStr.isBlank()) {
            return Result.fail(400, "cookies_str 不能为空");
        }
        try {
            Map<String, Object> result = xhsAccountService.bind(userId, cookiesStr);
            return Result.success(result);
        } catch (Exception e) {
            return Result.fail(500, e.getMessage());
        }
    }

    @Operation(summary = "解除小红书绑定")
    @DeleteMapping("/unbind")
    public Result<String> unbind(@RequestParam Long userId) {
        xhsAccountService.unbind(userId);
        return Result.success("OK");
    }

    @Operation(summary = "查询绑定状态")
    @GetMapping("/status")
    public Result<Map<String, Object>> status(@RequestParam Long userId) {
        return Result.success(xhsAccountService.getStatus(userId));
    }

    private Long extractUserId(Map<String, Object> body) {
        Object uid = body.get("user_id");
        if (uid instanceof Number n) return n.longValue();
        if (uid instanceof String s) return Long.parseLong(s);
        throw new IllegalArgumentException("user_id required");
    }
}
