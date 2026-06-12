package com.tourism.service;

import com.tourism.model.dto.LoginDTO;
import com.tourism.model.dto.RegisterDTO;
import com.tourism.model.vo.LoginVO;

public interface AuthService {

    LoginVO login(LoginDTO dto);

    void register(RegisterDTO dto);
}
