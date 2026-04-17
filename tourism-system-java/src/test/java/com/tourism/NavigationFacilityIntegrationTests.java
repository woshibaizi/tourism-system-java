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
class NavigationFacilityIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @WithMockUser(username = "tester")
    void shortestPathEndpointReturnsRouteMetricsAndCoordinates() throws Exception {
        mockMvc.perform(post("/api/navigation/shortest-path")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "start": "building_campus_gate",
                                  "end": "facility_campus_toilet",
                                  "vehicle": "步行",
                                  "strategy": "distance",
                                  "placeType": "校园"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.path[0]").value("building_campus_gate"))
                .andExpect(jsonPath("$.data.path[4]").value("facility_campus_toilet"))
                .andExpect(jsonPath("$.data.totalDistance").value(19.0))
                .andExpect(jsonPath("$.data.nodeCoordinates.building_campus_gate[0]").exists())
                .andExpect(jsonPath("$.data.segments.length()").value(4));
    }

    @Test
    @WithMockUser(username = "tester")
    void mixedVehicleEndpointReturnsSegmentsAndExpandedPath() throws Exception {
        mockMvc.perform(post("/api/navigation/mixed-vehicle-path")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "start": "building_campus_gate",
                                  "end": "building_campus_lab",
                                  "placeType": "校园"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.path[0]").value("building_campus_gate"))
                .andExpect(jsonPath("$.data.path[4]").value("building_campus_lab"))
                .andExpect(jsonPath("$.data.segments.length()").value(4))
                .andExpect(jsonPath("$.data.totalDistance").value(22.0));
    }

    @Test
    @WithMockUser(username = "tester")
    void multiDestinationEndpointReturnsRoundTripPath() throws Exception {
        mockMvc.perform(post("/api/navigation/multi-destination")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "start": "building_campus_gate",
                                  "destinations": ["facility_campus_store", "facility_campus_toilet"],
                                  "algorithm": "nearest_neighbor"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.targetPath[0]").value("building_campus_gate"))
                .andExpect(jsonPath("$.data.targetPath[2]").value("facility_campus_toilet"))
                .andExpect(jsonPath("$.data.targetPath[3]").value("building_campus_gate"));
    }

    @Test
    @WithMockUser(username = "tester")
    void nearestFacilitiesUsesPathDistanceOrdering() throws Exception {
        mockMvc.perform(post("/api/facilities/nearest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "buildingId": "building_campus_gate",
                                  "placeId": "place_campus",
                                  "facilityType": "all"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].id").value("facility_campus_store"))
                .andExpect(jsonPath("$.data[0].distance").value(10.0))
                .andExpect(jsonPath("$.data[0].travelTime").exists())
                .andExpect(jsonPath("$.data[1].id").value("facility_campus_cafe"))
                .andExpect(jsonPath("$.data[1].distance").value(13.0));
    }
}
