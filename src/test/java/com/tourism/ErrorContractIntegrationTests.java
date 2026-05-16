package com.tourism;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
class ErrorContractIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void unauthorizedRequestReturns401() throws Exception {
        mockMvc.perform(post("/api/diaries")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "test"
                                }
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
    }

    @Test
    @WithMockUser(username = "tester")
    void missingRequiredParamReturns400() throws Exception {
        mockMvc.perform(post("/api/places/place_campus/rate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "rating": 5
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("用户ID不能为空"));
    }

    @Test
    void validationErrorOnEmptyLoginBodyReturns400() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "username": "",
                                  "password": ""
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }
}
