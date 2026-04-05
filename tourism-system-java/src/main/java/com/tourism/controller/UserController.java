package com.tourism.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.tourism.mapper.UserMapper;
import com.tourism.model.entity.SysUser;
import com.tourism.model.vo.UserProfileVO;
import com.tourism.utils.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "用户模块", description = "基础用户查询接口")
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserMapper userMapper;

    public UserController(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    @Operation(summary = "获取用户列表")
    @GetMapping
    public Result<List<UserProfileVO>> list() {
        List<UserProfileVO> users = userMapper.selectList(
                new LambdaQueryWrapper<SysUser>().orderByAsc(SysUser::getId)
        ).stream().map(UserProfileVO::from).toList();
        return Result.success(users);
    }

    @Operation(summary = "获取用户详情")
    @GetMapping("/{id}")
    public Result<UserProfileVO> detail(@PathVariable Long id) {
        SysUser user = userMapper.selectById(id);
        if (user == null) {
            return Result.fail(404, "用户不存在");
        }
        return Result.success(UserProfileVO.from(user));
    }
}
