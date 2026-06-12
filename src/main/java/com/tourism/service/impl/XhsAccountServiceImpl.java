package com.tourism.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.tourism.mapper.UserXhsAccountMapper;
import com.tourism.model.entity.UserXhsAccount;
import com.tourism.service.AgentClient;
import com.tourism.service.XhsAccountService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class XhsAccountServiceImpl implements XhsAccountService {

    private static final Logger log = LoggerFactory.getLogger(XhsAccountServiceImpl.class);
    private static final int GCM_IV_LEN = 12;
    private static final int GCM_TAG_LEN = 128;

    private final UserXhsAccountMapper mapper;
    private final AgentClient agentClient;
    private final SecretKeySpec encryptionKey;

    public XhsAccountServiceImpl(UserXhsAccountMapper mapper,
                                  AgentClient agentClient,
                                  @Value("${xhs.cookie.encryption-key:}") String keyHex) {
        this.mapper = mapper;
        this.agentClient = agentClient;
        if (keyHex == null || keyHex.isBlank()) {
            log.warn("XHS cookie encryption key not configured, using fallback (not secure for production!)");
            keyHex = "0000000000000000000000000000000000000000000000000000000000000000";
        }
        byte[] keyBytes = hexToBytes(keyHex);
        this.encryptionKey = new SecretKeySpec(keyBytes, "AES");
    }

    @Override
    public Map<String, Object> bind(Long userId, String cookiesStr) {
        if (cookiesStr == null || cookiesStr.isBlank()) {
            throw new IllegalArgumentException("Cookie 不能为空");
        }

        // 1. 调 Python Agent 验证 Cookie 有效性
        Map<String, Object> validation = agentClient.xhsValidateCookie(cookiesStr);
        if (!Boolean.TRUE.equals(validation.get("ok"))) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("ok", false);
            result.put("error", validation.getOrDefault("error", "Cookie 无效"));
            return result;
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) validation.getOrDefault("data", Map.of());
        String xhsUserId = (String) data.getOrDefault("xhs_user_id", "");
        String xhsUsername = (String) data.getOrDefault("xhs_username", "");
        String xhsAvatar = (String) data.getOrDefault("xhs_avatar", "");

        // 2. AES-256-GCM 加密 cookie
        String encrypted = encrypt(cookiesStr);

        // 3. UPSERT
        LambdaQueryWrapper<UserXhsAccount> q = new LambdaQueryWrapper<>();
        q.eq(UserXhsAccount::getUserId, userId);
        UserXhsAccount account = mapper.selectOne(q);

        if (account == null) {
            account = new UserXhsAccount();
            account.setUserId(userId);
        }
        account.setEncryptedCookies(encrypted);
        account.setXhsUserId(xhsUserId);
        account.setXhsUsername(xhsUsername);
        account.setXhsAvatar(xhsAvatar);
        account.setStatus(1);
        account.setLastValidatedAt(LocalDateTime.now());

        if (account.getId() == null) {
            mapper.insert(account);
        } else {
            mapper.updateById(account);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("ok", true);
        result.put("xhs_username", xhsUsername);
        result.put("xhs_avatar", xhsAvatar);
        result.put("bound", true);
        return result;
    }

    @Override
    public void unbind(Long userId) {
        LambdaQueryWrapper<UserXhsAccount> q = new LambdaQueryWrapper<>();
        q.eq(UserXhsAccount::getUserId, userId);
        UserXhsAccount account = mapper.selectOne(q);
        if (account != null) {
            account.setStatus(0);
            account.setEncryptedCookies("");
            mapper.updateById(account);
        }
    }

    @Override
    public Map<String, Object> getStatus(Long userId) {
        LambdaQueryWrapper<UserXhsAccount> q = new LambdaQueryWrapper<>();
        q.eq(UserXhsAccount::getUserId, userId);
        UserXhsAccount account = mapper.selectOne(q);

        Map<String, Object> result = new LinkedHashMap<>();
        if (account == null || account.getStatus() == null || account.getStatus() == 0) {
            result.put("bound", false);
        } else {
            result.put("bound", true);
            result.put("xhs_username", account.getXhsUsername());
            result.put("xhs_avatar", account.getXhsAvatar());
            result.put("last_validated_at", account.getLastValidatedAt() != null
                    ? account.getLastValidatedAt().toString() : null);
        }
        return result;
    }

    @Override
    public String decryptCookies(Long userId) {
        LambdaQueryWrapper<UserXhsAccount> q = new LambdaQueryWrapper<>();
        q.eq(UserXhsAccount::getUserId, userId);
        UserXhsAccount account = mapper.selectOne(q);

        if (account == null || account.getStatus() == null || account.getStatus() == 0) {
            throw new IllegalStateException("小红书账号未绑定或已失效");
        }

        // ── S3: Cookie 过期自动检测 (超过 1 小时重新验证) ──
        LocalDateTime lastValidated = account.getLastValidatedAt();
        boolean needsRevalidate = lastValidated == null
                || Duration.between(lastValidated, LocalDateTime.now()).toHours() >= 1;

        if (needsRevalidate) {
            String decrypted = decrypt(account.getEncryptedCookies());
            Map<String, Object> validation = agentClient.xhsValidateCookie(decrypted);
            if (!Boolean.TRUE.equals(validation.get("ok"))) {
                // Cookie 已失效 → 标记 status=0
                account.setStatus(0);
                account.setLastValidatedAt(LocalDateTime.now());
                mapper.updateById(account);
                log.warn("XHS cookie expired for userId={}, marked as invalid", userId);
                throw new IllegalStateException("小红书登录已过期，请重新绑定账号");
            }
            // Cookie 仍然有效 → 更新时间
            log.info("XHS cookie re-validated OK for userId={}", userId);
        }

        account.setLastValidatedAt(LocalDateTime.now());
        mapper.updateById(account);

        return decrypt(account.getEncryptedCookies());
    }

    // ── AES-256-GCM ──

    private String encrypt(String plaintext) {
        try {
            byte[] iv = new byte[GCM_IV_LEN];
            new SecureRandom().nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, encryptionKey, new GCMParameterSpec(GCM_TAG_LEN, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            byte[] combined = new byte[iv.length + ciphertext.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(ciphertext, 0, combined, iv.length, ciphertext.length);
            return Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            throw new RuntimeException("Cookie 加密失败", e);
        }
    }

    private String decrypt(String encrypted) {
        try {
            byte[] combined = Base64.getDecoder().decode(encrypted);
            byte[] iv = new byte[GCM_IV_LEN];
            byte[] ciphertext = new byte[combined.length - GCM_IV_LEN];
            System.arraycopy(combined, 0, iv, 0, GCM_IV_LEN);
            System.arraycopy(combined, GCM_IV_LEN, ciphertext, 0, ciphertext.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, encryptionKey, new GCMParameterSpec(GCM_TAG_LEN, iv));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("Cookie 解密失败", e);
        }
    }

    private static byte[] hexToBytes(String hex) {
        int len = hex.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                    + Character.digit(hex.charAt(i + 1), 16));
        }
        return data;
    }
}
