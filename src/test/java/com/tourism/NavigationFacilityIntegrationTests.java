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
class NavigationFacilityIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @WithMockUser(username = "tester")
    void amapProviderConfigReturnsUnavailableWithoutFrontendKeyInTestProfile() throws Exception {
        mockMvc.perform(get("/api/navigation/providers/amap/config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.available").value(false))
                .andExpect(jsonPath("$.data.enabled").value(false));
    }

    @Test
    @WithMockUser(username = "tester")
    void shortestPathEndpointFallsBackToLocalWhenAmapKeyMissing() throws Exception {
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
                .andExpect(jsonPath("$.data.segments.length()").value(4))
                .andExpect(jsonPath("$.data.provider").value("local"))
                .andExpect(jsonPath("$.data.source").value("shortest_path_algorithm_fallback"))
                .andExpect(jsonPath("$.data.fallback").value(true));
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
                .andExpect(jsonPath("$.data.totalDistance").value(22.0))
                .andExpect(jsonPath("$.data.provider").value("local"))
                .andExpect(jsonPath("$.data.source").value("mixed_vehicle_dijkstra"))
                .andExpect(jsonPath("$.data.fallback").value(false));
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
                .andExpect(jsonPath("$.data.targetPath[3]").value("building_campus_gate"))
                .andExpect(jsonPath("$.data.provider").value("local"))
                .andExpect(jsonPath("$.data.source").value("multi_destination_tsp"));
    }

    @Test
    @WithMockUser(username = "tester")
    void nearestNodeEndpointMapsCoordinateToGraphNode() throws Exception {
        mockMvc.perform(post("/api/navigation/nearest-node")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "lat": 39.957701,
                                  "lng": 116.357699
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.nodeId").value("building_campus_gate"))
                .andExpect(jsonPath("$.data.provider").value("local"))
                .andExpect(jsonPath("$.data.source").value("nearest_graph_node"));
    }

    @Test
    @WithMockUser(username = "tester")
    void legacySingleRouteCanResolveCurrentLocationToNearestNode() throws Exception {
        mockMvc.perform(post("/api/routes/single")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "start": "我的位置",
                                  "startLat": 39.957701,
                                  "startLng": 116.357699,
                                  "end": "facility_campus_toilet",
                                  "strategy": "distance",
                                  "placeType": "校园"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.provider").value("local"))
                .andExpect(jsonPath("$.data.fallback").value(true))
                .andExpect(jsonPath("$.data.start_resolution").value("nearest_graph_node"))
                .andExpect(jsonPath("$.data.resolved_start_node").value("building_campus_gate"));
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
