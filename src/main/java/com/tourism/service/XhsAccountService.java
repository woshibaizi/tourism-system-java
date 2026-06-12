package com.tourism.service;

import com.tourism.model.entity.UserXhsAccount;

import java.util.Map;

public interface XhsAccountService {

    /** 绑定小红书账号: 验证 Cookie → 加密 → 存储 */
    Map<String, Object> bind(Long userId, String cookiesStr);

    /** 解除绑定 */
    void unbind(Long userId);

    /** 查询绑定状态 (不返回 cookie) */
    Map<String, Object> getStatus(Long userId);

    /** 解密并返回用户的 Cookie 字符串 (仅供内部调用) */
    String decryptCookies(Long userId);
}
