package com.tourism;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
class DiaryAlgorithmIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void diarySearchByTitleUsesBusinessEndpoint() throws Exception {
        mockMvc.perform(get("/api/diaries/search")
                        .param("query", "星海校园晨跑路线")
                        .param("type", "title"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].id").value("diary_001"));
    }

    @Test
    @WithMockUser(username = "tester")
    void diaryRatingEndpointUpdatesRatingHistory() throws Exception {
        mockMvc.perform(post("/api/diaries/diary_001/rate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "userId": 1,
                                  "rating": 5
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.userRating").value(5.0));
    }

    @Test
    @WithMockUser(username = "tester")
    void compressionEndpointsRoundTripDiaryContent() throws Exception {
        String content = "compression round trip check";
        String compressedResponse = mockMvc.perform(post("/api/algorithm/compress")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "content": "%s"
                                }
                                """.formatted(content)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.compressed").exists())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode compressedData = objectMapper.readTree(compressedResponse).path("data");

        mockMvc.perform(post("/api/algorithm/decompress")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                objectMapper.createObjectNode().set("compressedInfo", compressedData)
                        )))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").value(content));
    }

    @Test
    @WithMockUser(username = "tester")
    void sensitiveWordFilterEndpointFlagsBlockedTerms() throws Exception {
        mockMvc.perform(post("/api/algorithm/filter-text")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "text": "这里包含诈骗信息"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.isClean").value(false))
                .andExpect(jsonPath("$.data.totalMatches").value(1));
    }
}
