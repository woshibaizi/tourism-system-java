package com.tourism.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.tourism.model.entity.SysUser;
import com.tourism.model.entity.UserBehavior;
import com.tourism.model.vo.UserProfileVO;
import com.tourism.service.UserBehaviorService;
import com.tourism.service.UserService;
import com.tourism.utils.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "用户模块", description = "用户查询与行为接口")
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final UserBehaviorService userBehaviorService;

    public UserController(UserService userService, UserBehaviorService userBehaviorService) {
        this.userService = userService;
        this.userBehaviorService = userBehaviorService;
    }

    @Operation(summary = "获取用户列表")
    @GetMapping
    public Result<List<UserProfileVO>> list() {
        List<UserProfileVO> users = userService.list(
                new LambdaQueryWrapper<SysUser>().orderByAsc(SysUser::getId)
        ).stream().map(UserProfileVO::from).toList();
        return Result.success(users);
    }

    @Operation(summary = "获取用户详情")
    @GetMapping("/{id}")
    public Result<UserProfileVO> detail(@PathVariable Long id) {
        SysUser user = userService.getById(id);
        if (user == null) {
            return Result.fail(404, "用户不存在");
        }
        return Result.success(UserProfileVO.from(user));
    }

    @Operation(summary = "更新用户信息")
    @PutMapping("/{id}")
    public Result<Void> updateProfile(@PathVariable Long id, @RequestBody SysUser user) {
        user.setId(id);
        boolean success = userService.updateUserProfile(user);
        return success ? Result.success() : Result.fail("更新失败");
    }

    @Operation(summary = "记录用户行为（浏览/评分）")
    @PostMapping("/{userId}/behavior")
    public Result<Void> recordBehavior(
            @PathVariable Long userId,
            @Parameter(description = "目标ID") @RequestParam String targetId,
            @Parameter(description = "行为类型(VIEW/RATE)") @RequestParam String behaviorType,
            @Parameter(description = "评分(评分行为时使用)") @RequestParam(required = false) Double score) {
        boolean success = userBehaviorService.recordBehavior(userId, targetId, behaviorType, score);
        return success ? Result.success() : Result.fail("记录失败");
    }

    @Operation(summary = "查询用户浏览历史")
    @GetMapping("/{userId}/views")
    public Result<List<UserBehavior>> viewHistory(@PathVariable Long userId) {
        return Result.success(userBehaviorService.getViewHistory(userId));
    }

    @Operation(summary = "查询用户评分历史")
    @GetMapping("/{userId}/ratings")
    public Result<List<UserBehavior>> ratingHistory(@PathVariable Long userId) {
        return Result.success(userBehaviorService.getRatingHistory(userId));
    }
}
