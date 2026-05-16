package com.tourism;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
class DiaryCrudIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @WithMockUser(username = "tester")
    void createDiaryReturnsCreatedDiary() throws Exception {
        mockMvc.perform(post("/api/diaries")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "测试日记",
                                  "content": "这是一篇测试日记内容",
                                  "placeId": "place_campus",
                                  "authorId": 1
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.title").value("测试日记"))
                .andExpect(jsonPath("$.data.placeId").value("place_campus"))
                .andExpect(jsonPath("$.data.id").exists());
    }

    @Test
    @WithMockUser(username = "tester")
    void updateDiaryModifiesExistingDiary() throws Exception {
        mockMvc.perform(put("/api/diaries/diary_001")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "更新后的日记标题"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.title").value("更新后的日记标题"));
    }

    @Test
    @WithMockUser(username = "tester")
    void deleteDiaryRemovesAndReturnsDeletedId() throws Exception {
        mockMvc.perform(delete("/api/diaries/diary_005"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.deletedId").value("diary_005"));
    }
}
