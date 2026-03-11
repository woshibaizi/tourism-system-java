package com.tourism.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tourism.exception.BusinessException;
import com.tourism.mapper.UserMapper;
import com.tourism.model.dto.LoginDTO;
import com.tourism.model.dto.RegisterDTO;
import com.tourism.model.entity.SysUser;
import com.tourism.model.vo.LoginVO;
import com.tourism.service.AuthService;
import com.tourism.utils.JwtUtils;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthServiceImpl implements AuthService {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;
    private final ObjectMapper objectMapper;

    public AuthServiceImpl(UserMapper userMapper, PasswordEncoder passwordEncoder,
                           JwtUtils jwtUtils, ObjectMapper objectMapper) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtils = jwtUtils;
        this.objectMapper = objectMapper;
    }

    @Override
    public LoginVO login(LoginDTO dto) {
        SysUser user = userMapper.selectOne(
                new LambdaQueryWrapper<SysUser>().eq(SysUser::getUsername, dto.getUsername()));
        if (user == null || !passwordEncoder.matches(dto.getPassword(), user.getPassword())) {
            throw new BusinessException(401, "用户名或密码错误");
        }
        LoginVO vo = new LoginVO();
        vo.setUserId(user.getId());
        vo.setUsername(user.getUsername());
        vo.setToken(jwtUtils.generateToken(user.getId(), user.getUsername()));
        return vo;
    }

    @Override
    public void register(RegisterDTO dto) {
        long count = userMapper.selectCount(
                new LambdaQueryWrapper<SysUser>().eq(SysUser::getUsername, dto.getUsername()));
        if (count > 0) {
            throw new BusinessException(400, "用户名已存在");
        }
        SysUser user = new SysUser();
        user.setUsername(dto.getUsername());
        user.setPassword(passwordEncoder.encode(dto.getPassword()));
        try {
            if (dto.getInterests() != null) {
                user.setInterests(objectMapper.writeValueAsString(dto.getInterests()));
            }
            if (dto.getFavoriteCategories() != null) {
                user.setFavoriteCategories(objectMapper.writeValueAsString(dto.getFavoriteCategories()));
            }
        } catch (Exception e) {
            throw new BusinessException("用户数据序列化失败");
        }
        userMapper.insert(user);
    }
}
