package com.tourism.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

@Configuration
@EnableConfigurationProperties(AgentProperties.class)
public class AgentClientConfig {

    @Bean
    public RestTemplate agentRestTemplate(RestTemplateBuilder builder, AgentProperties properties) {
        // 单独给 Python agent 建一个 RestTemplate，避免和其他外部 HTTP 调用混用配置。
        return builder
                .rootUri(properties.getBaseUrl())
                .setConnectTimeout(Duration.ofMillis(properties.getConnectTimeoutMs()))
                .setReadTimeout(Duration.ofMillis(properties.getReadTimeoutMs()))
                .build();
    }
}
