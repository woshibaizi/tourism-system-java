package com.tourism.controller;

import com.tourism.model.dto.LoginDTO;
import com.tourism.model.dto.RegisterDTO;
import com.tourism.model.vo.LoginVO;
import com.tourism.model.vo.UserProfileVO;
import com.tourism.model.entity.SysUser;
import com.tourism.mapper.UserMapper;
import com.tourism.service.AuthService;
import com.tourism.utils.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.User;
import org.springframework.web.bind.annotation.*;

@Tag(name = "认证模块", description = "登录、注册接口")
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final UserMapper userMapper;

    public AuthController(AuthService authService, UserMapper userMapper) {
        this.authService = authService;
        this.userMapper = userMapper;
    }

    @Operation(summary = "用户登录")
    @PostMapping("/login")
    public Result<LoginVO> login(@Valid @RequestBody LoginDTO dto) {
        return Result.success(authService.login(dto));
    }

    @Operation(summary = "用户注册")
    @PostMapping("/register")
    public Result<Void> register(@Valid @RequestBody RegisterDTO dto) {
        authService.register(dto);
        return Result.success();
    }

    @Operation(summary = "获取当前登录用户信息")
    @GetMapping("/me")
    public Result<UserProfileVO> me(@AuthenticationPrincipal User principal) {
        SysUser user = userMapper.selectById(Long.parseLong(principal.getUsername()));
        return Result.success(UserProfileVO.from(user));
    }
}
