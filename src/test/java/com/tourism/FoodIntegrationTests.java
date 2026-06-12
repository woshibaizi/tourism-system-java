package com.tourism;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
class FoodIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void listFoodsReturnsItemsAndTotal() throws Exception {
        mockMvc.perform(get("/api/foods"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.items.length()").isNotEmpty())
                .andExpect(jsonPath("$.data.total").isNumber())
                .andExpect(jsonPath("$.data.sortBy").value("popularity"));
    }

    @Test
    void searchFoodsReturnsFilteredResultsForQuery() throws Exception {
        mockMvc.perform(get("/api/foods").param("search", "拿铁"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.items").isArray())
                .andExpect(jsonPath("$.data.total").isNumber());
    }

    @Test
    void getCuisinesReturnsAllDistinctTypes() throws Exception {
        mockMvc.perform(get("/api/foods/cuisines"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(9));
    }

    @Test
    void listFoodsByPlaceReturnsCampusFoods() throws Exception {
        mockMvc.perform(get("/api/foods/place/place_campus"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.length()").value(5))
                .andExpect(jsonPath("$.data[0].placeId").value("place_campus"));
    }

    @Test
    void sortFoodsByRating() throws Exception {
        mockMvc.perform(get("/api/foods").param("sortBy", "rating"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.sortBy").value("rating"))
                .andExpect(jsonPath("$.data.items").isArray())
                .andExpect(jsonPath("$.data.items.length()").isNotEmpty());
    }

    @Test
    void sortFoodsByDistance() throws Exception {
        mockMvc.perform(get("/api/foods").param("sortBy", "distance").param("originNodeId", "node_001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.sortBy").value("distance"))
                .andExpect(jsonPath("$.data.items").isArray());
    }

    @Test
    void sortFoodsByPopularity() throws Exception {
        mockMvc.perform(get("/api/foods").param("sortBy", "popularity"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.sortBy").value("popularity"))
                .andExpect(jsonPath("$.data.items").isArray());
    }

    @Test
    void filterFoodsByCuisine() throws Exception {
        mockMvc.perform(get("/api/foods").param("cuisine", "咖啡"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.items").isArray());
    }

    @Test
    void searchFoodsFuzzy() throws Exception {
        mockMvc.perform(get("/api/foods").param("search", "鸡"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.items").isArray());
    }

    @Test
    void getFoodDetail() throws Exception {
        mockMvc.perform(get("/api/foods/food_campus_noodle"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.name").isNotEmpty());
    }
}
