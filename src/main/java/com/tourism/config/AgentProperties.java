package com.tourism.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.agent")
public class AgentProperties {

    /** Python agent 服务基础地址，例如 http://127.0.0.1:9000 */
    private String baseUrl = "http://127.0.0.1:9000";

    /** 建立 HTTP 连接的超时时间，避免 Java 线程长时间阻塞。 */
    private int connectTimeoutMs = 3000;

    /** 读取响应体的超时时间，给后续模型调用预留更长时间。 */
    private int readTimeoutMs = 60000;

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public int getConnectTimeoutMs() {
        return connectTimeoutMs;
    }

    public void setConnectTimeoutMs(int connectTimeoutMs) {
        this.connectTimeoutMs = connectTimeoutMs;
    }

    public int getReadTimeoutMs() {
        return readTimeoutMs;
    }

    public void setReadTimeoutMs(int readTimeoutMs) {
        this.readTimeoutMs = readTimeoutMs;
    }
}
