package com.tourism;

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
class IndoorNavigationIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @WithMockUser(username = "tester")
    void indoorNavigationEndpointReturnsCanonicalContractForExistingRoom() throws Exception {
        mockMvc.perform(post("/api/navigation/indoor")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "roomId": "room_301",
                                  "avoidCongestion": true,
                                  "useTimeWeight": true
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.destination.id").value("room_301"))
                .andExpect(jsonPath("$.data.path[0]").value("entrance"))
                .andExpect(jsonPath("$.data.navigationSteps.length()").isNotEmpty())
                .andExpect(jsonPath("$.data.totalDistance").isNumber())
                .andExpect(jsonPath("$.data.estimatedTimeMinutes").isNumber())
                .andExpect(jsonPath("$.data.floorAnalysis.floorsVisited").isArray())
                .andExpect(jsonPath("$.data.optimizationTarget").isString());
    }

    @Test
    @WithMockUser(username = "tester")
    void legacyIndoorNavigationEndpointKeepsCompatibilityEnvelopeForExistingRoom() throws Exception {
        mockMvc.perform(post("/api/indoor/navigate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "roomId": "room_301",
                                  "avoidCongestion": true,
                                  "useTimeWeight": true
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.destination.id").value("room_301"))
                .andExpect(jsonPath("$.data.navigation_steps.length()").isNotEmpty())
                .andExpect(jsonPath("$.data.total_distance").isNumber())
                .andExpect(jsonPath("$.data.estimated_time").isNumber())
                .andExpect(jsonPath("$.data.floor_analysis.floorsVisited").isArray())
                .andExpect(jsonPath("$.data.path_description").isString());
    }

    @Test
    @WithMockUser(username = "tester")
    void indoorRoomsEndpointReturnsRoomList() throws Exception {
        mockMvc.perform(get("/api/navigation/indoor/rooms"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.length()").isNotEmpty())
                .andExpect(jsonPath("$.data[0].id").exists())
                .andExpect(jsonPath("$.data[0].floor").exists());
    }
}
