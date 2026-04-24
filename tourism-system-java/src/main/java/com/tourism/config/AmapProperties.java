package com.tourism.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
@ConfigurationProperties(prefix = "app.amap")
public class AmapProperties {

    private boolean enabled = true;
    private String baseUrl = "https://restapi.amap.com";
    private String webKey;
    private String jsKey;
    private String jsSecurityCode;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getWebKey() {
        return webKey;
    }

    public void setWebKey(String webKey) {
        this.webKey = webKey;
    }

    public String getJsKey() {
        return jsKey;
    }

    public void setJsKey(String jsKey) {
        this.jsKey = jsKey;
    }

    public String getJsSecurityCode() {
        return jsSecurityCode;
    }

    public void setJsSecurityCode(String jsSecurityCode) {
        this.jsSecurityCode = jsSecurityCode;
    }

    public boolean isRoutingConfigured() {
        return enabled && StringUtils.hasText(getEffectiveWebKey());
    }

    public boolean isJsConfigured() {
        return enabled && StringUtils.hasText(jsKey);
    }

    public String getEffectiveWebKey() {
        if (StringUtils.hasText(webKey)) {
            return webKey;
        }
        return jsKey;
    }
}
