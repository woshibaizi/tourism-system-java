package com.tourism;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class SurroundingIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    // ==================== 基础查询 ====================

    @Test
    @Order(1)
    @WithMockUser(username = "tester")
    void shouldListByPlaceId() throws Exception {
        mockMvc.perform(get("/api/surroundings/place/place_campus"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.length()").value(greaterThanOrEqualTo(7)));
    }

    @Test
    @Order(2)
    @WithMockUser(username = "tester")
    void shouldListByPlaceIdAndType() throws Exception {
        mockMvc.perform(get("/api/surroundings/place/place_campus/type/restaurant"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].type").value("restaurant"));
    }

    @Test
    @Order(3)
    @WithMockUser(username = "tester")
    void shouldGetDetail() throws Exception {
        mockMvc.perform(get("/api/surroundings/sr_test_01"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.name").value("Lanzhou Noodles Campus"))
                .andExpect(jsonPath("$.data.placeId").value("place_campus"))
                .andExpect(jsonPath("$.data.rating").value(4.5))
                .andExpect(jsonPath("$.data.studentDiscount").value(1))
                .andExpect(jsonPath("$.data.tags").isString());
    }

    @Test
    @Order(4)
    @WithMockUser(username = "tester")
    void shouldReturn404ForMissingSurrounding() throws Exception {
        mockMvc.perform(get("/api/surroundings/sr_nonexistent"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(404));
    }

    // ==================== 分页 ====================

    @Test
    @Order(5)
    @WithMockUser(username = "tester")
    void shouldPaginateResults() throws Exception {
        mockMvc.perform(get("/api/surroundings")
                        .param("placeId", "place_campus")
                        .param("page", "1")
                        .param("size", "3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.records.length()").value(lessThanOrEqualTo(3)))
                .andExpect(jsonPath("$.data.total").value(greaterThanOrEqualTo(7)));
    }

    @Test
    @Order(6)
    @WithMockUser(username = "tester")
    void shouldFilterByType() throws Exception {
        mockMvc.perform(get("/api/surroundings")
                        .param("type", "hotel"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.records[0].type").value("hotel"));
    }

    // ==================== 搜索 ====================

    @Test
    @Order(7)
    @WithMockUser(username = "tester")
    void shouldSearchByName() throws Exception {
        mockMvc.perform(get("/api/surroundings/search")
                        .param("query", "Lanzhou"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.length()").value(greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.data[0].name").value(containsString("Lanzhou")));
    }

    @Test
    @Order(8)
    @WithMockUser(username = "tester")
    void shouldSearchByDescription() throws Exception {
        mockMvc.perform(get("/api/surroundings/search")
                        .param("query", "bubble tea"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.length()").value(greaterThanOrEqualTo(1)));
    }

    @Test
    @Order(9)
    @WithMockUser(username = "tester")
    void shouldSearchWithPlaceFilter() throws Exception {
        mockMvc.perform(get("/api/surroundings/search")
                        .param("query", "Roast Lamb")
                        .param("placeId", "place_campus"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    // ==================== 热门 & 高分 ====================

    @Test
    @Order(10)
    @WithMockUser(username = "tester")
    void shouldListHot() throws Exception {
        mockMvc.perform(get("/api/surroundings/hot")
                        .param("limit", "3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.length()").value(lessThanOrEqualTo(3)));
    }

    @Test
    @Order(11)
    @WithMockUser(username = "tester")
    void shouldListTopRated() throws Exception {
        mockMvc.perform(get("/api/surroundings/top-rated")
                        .param("limit", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.length()").value(lessThanOrEqualTo(5)));
    }

    // ==================== 分类统计 ====================

    @Test
    @Order(12)
    @WithMockUser(username = "tester")
    void shouldGetCategoryCounts() throws Exception {
        mockMvc.perform(get("/api/surroundings/categories/place_campus"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.restaurant").value(2))
                .andExpect(jsonPath("$.data.shopping").value(1))
                .andExpect(jsonPath("$.data.transport").value(1));
    }

    // ==================== LBS 附近搜索 ====================

    @Test
    @Order(13)
    @WithMockUser(username = "tester")
    void shouldFindNearbyWithinRadius() throws Exception {
        mockMvc.perform(get("/api/surroundings/nearby")
                        .param("lat", "39.9577")
                        .param("lng", "116.3577")
                        .param("radius", "200"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.length()").value(greaterThanOrEqualTo(4)));
    }

    @Test
    @Order(14)
    @WithMockUser(username = "tester")
    void shouldFindNearbyWithTypeFilter() throws Exception {
        mockMvc.perform(get("/api/surroundings/nearby")
                        .param("lat", "39.9577")
                        .param("lng", "116.3577")
                        .param("radius", "2000")
                        .param("type", "hotel"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].type").value("hotel"));
    }

    @Test
    @Order(15)
    @WithMockUser(username = "tester")
    void shouldReturnEmptyForFarLocation() throws Exception {
        mockMvc.perform(get("/api/surroundings/nearby")
                        .param("lat", "31.2304")
                        .param("lng", "121.4737")
                        .param("radius", "100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    // ==================== 评分 ====================

    @Test
    @Order(16)
    @WithMockUser(username = "tester")
    void shouldRateSurrounding() throws Exception {
        mockMvc.perform(post("/api/surroundings/sr_test_01/rate")
                        .param("score", "4.0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.ratingCount").value(121));

        mockMvc.perform(get("/api/surroundings/sr_test_01"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.ratingCount").value(121));
    }

    @Test
    @Order(17)
    @WithMockUser(username = "tester")
    void shouldRejectInvalidScore() throws Exception {
        mockMvc.perform(post("/api/surroundings/sr_test_01/rate")
                        .param("score", "6.0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    @Order(18)
    @WithMockUser(username = "tester")
    void shouldReturn404ForRatingNonexistentSurrounding() throws Exception {
        mockMvc.perform(post("/api/surroundings/sr_nonexistent/rate")
                        .param("score", "4.0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(404));
    }
}
