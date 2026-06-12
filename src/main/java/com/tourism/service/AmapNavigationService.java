package com.tourism.service;

import com.tourism.config.AmapProperties;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class AmapNavigationService {

    private final AmapProperties amapProperties;

    public AmapNavigationService(AmapProperties amapProperties) {
        this.amapProperties = amapProperties;
    }

    public Map<String, Object> getFrontendConfig() {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("available", amapProperties.isJsConfigured());
        config.put("enabled", amapProperties.isEnabled());
        config.put("jsKey", amapProperties.getJsKey());
        config.put("jsSecurityCode", amapProperties.getJsSecurityCode());
        config.put("reason", amapProperties.isJsConfigured() ? null : "高德 JS API 未配置");
        return config;
    }
}
