package com.tourism.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.tourism.algorithm.SearchAlgorithm;
import com.tourism.algorithm.ShortestPathAlgorithm;
import com.tourism.mapper.FoodMapper;
import com.tourism.model.entity.SpotBuilding;
import com.tourism.model.entity.SpotFood;
import com.tourism.service.BuildingService;
import com.tourism.service.FoodService;
import com.tourism.utils.GeoUtils;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Service
public class FoodServiceImpl extends ServiceImpl<FoodMapper, SpotFood> implements FoodService {

    private final SearchAlgorithm searchAlgorithm;
    private final BuildingService buildingService;
    private final ShortestPathAlgorithm shortestPathAlgorithm;

    public FoodServiceImpl(SearchAlgorithm searchAlgorithm,
                           BuildingService buildingService,
                           ShortestPathAlgorithm shortestPathAlgorithm) {
        this.searchAlgorithm = searchAlgorithm;
        this.buildingService = buildingService;
        this.shortestPathAlgorithm = shortestPathAlgorithm;
    }

    @Override
    public List<SpotFood> listByPlaceId(String placeId) {
        return searchFoods(placeId, null, null, "popularity", null);
    }

    @Override
    public List<SpotFood> listByCuisine(String cuisine) {
        return searchFoods(null, cuisine, null, "popularity", null);
    }

    @Override
    public List<SpotFood> getPopularFoods(String placeId, int limit) {
        int normalizedLimit = limit <= 0 ? 10 : limit;
        return searchFoods(placeId, null, null, "popularity", null).stream()
                .limit(normalizedLimit)
                .toList();
    }

    @Override
    public List<SpotFood> searchFoods(String placeId,
                                      String cuisine,
                                      String search,
                                      String sortBy,
                                      String originNodeId) {
        LambdaQueryWrapper<SpotFood> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(placeId)) {
            wrapper.eq(SpotFood::getPlaceId, placeId.trim());
        }

        List<SpotFood> foods = list(wrapper).stream()
                .map(food -> enrichFood(food, originNodeId))
                .filter(food -> matchesCuisine(food, cuisine))
                .toList();

        if (StringUtils.hasText(search)) {
            foods = applyFuzzySearch(foods, search.trim());
        }

        return sortFoods(foods, sortBy);
    }

    private List<SpotFood> applyFuzzySearch(List<SpotFood> foods, String search) {
        List<Map<String, Object>> searchableItems = foods.stream()
                .map(this::toSearchItem)
                .toList();

        List<Map<String, Object>> fuzzyResults = searchAlgorithm.fuzzySearch(
                searchableItems,
                search,
                List.of("name", "description", "cuisine", "location", "restaurant", "shop", "window"),
                0.15
        );

        Map<String, SpotFood> foodMap = foods.stream()
                .collect(java.util.stream.Collectors.toMap(
                        SpotFood::getId,
                        food -> food,
                        (a, b) -> a,
                        LinkedHashMap::new
                ));

        return fuzzyResults.stream()
                .map(item -> foodMap.get(String.valueOf(item.get("id"))))
                .filter(Objects::nonNull)
                .toList();
    }

    private Map<String, Object> toSearchItem(SpotFood food) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", food.getId());
        item.put("name", food.getName());
        item.put("description", food.getDescription());
        item.put("cuisine", food.getCuisine());
        item.put("location", food.getLocation());
        item.put("restaurant", food.getRestaurantName());
        item.put("shop", food.getShopName());
        item.put("window", food.getWindowName());
        return item;
    }

    private List<SpotFood> sortFoods(List<SpotFood> foods, String sortBy) {
        String normalizedSort = StringUtils.hasText(sortBy)
                ? sortBy.trim().toLowerCase(Locale.ROOT)
                : "popularity";

        Comparator<SpotFood> comparator = switch (normalizedSort) {
            case "distance" -> Comparator
                    .comparing((SpotFood food) -> food.getDistanceMeters() == null
                            ? Double.MAX_VALUE
                            : food.getDistanceMeters())
                    .thenComparing(SpotFood::getName, Comparator.nullsLast(String::compareTo));
            case "rating" -> Comparator
                    .comparing((SpotFood food) -> food.getRating() == null
                            ? BigDecimal.ZERO
                            : food.getRating())
                    .reversed()
                    .thenComparing(Comparator.comparingInt(this::popularityValue).reversed())
                    .thenComparing(SpotFood::getName, Comparator.nullsLast(String::compareTo));
            case "name" -> Comparator.comparing(SpotFood::getName, Comparator.nullsLast(String::compareTo));
            default -> Comparator
                    .comparingInt(this::popularityValue)
                    .reversed()
                    .thenComparing((SpotFood food) -> food.getRating() == null
                            ? BigDecimal.ZERO
                            : food.getRating(), Comparator.reverseOrder())
                    .thenComparing(SpotFood::getName, Comparator.nullsLast(String::compareTo));
        };

        return foods.stream()
                .sorted(comparator)
                .toList();
    }

    private SpotFood enrichFood(SpotFood source, String originNodeId) {
        SpotFood target = copyFood(source);
        String restaurantName = inferRestaurantName(target.getLocation());
        String windowName = inferWindowName(target.getLocation());
        target.setShopName(restaurantName);
        target.setRestaurantName(restaurantName);
        target.setWindowName(windowName);

        SpotBuilding building = inferBuilding(target);
        if (building != null) {
            target.setBuildingId(building.getId());
            Double distance = resolveDistance(originNodeId, building);
            if (distance != null) {
                target.setDistanceMeters(round(distance));
            }
        }

        int popularity = popularityValue(target);
        target.setRating(deriveRating(popularity));
        target.setRatingCount(Math.max(popularity / 2, 0));
        return target;
    }

    private SpotFood copyFood(SpotFood source) {
        SpotFood target = new SpotFood();
        target.setId(source.getId());
        target.setName(source.getName());
        target.setPlaceId(source.getPlaceId());
        target.setCuisine(source.getCuisine());
        target.setPopularity(source.getPopularity());
        target.setDescription(source.getDescription());
        target.setPrice(source.getPrice());
        target.setLocation(source.getLocation());
        target.setBuildingId(source.getBuildingId());
        target.setShopName(source.getShopName());
        target.setRestaurantName(source.getRestaurantName());
        target.setWindowName(source.getWindowName());
        target.setRating(source.getRating());
        target.setRatingCount(source.getRatingCount());
        target.setDistanceMeters(source.getDistanceMeters());
        target.setDeleted(source.getDeleted());
        target.setCreatedAt(source.getCreatedAt());
        target.setUpdatedAt(source.getUpdatedAt());
        return target;
    }

    private boolean matchesCuisine(SpotFood food, String cuisine) {
        if (!StringUtils.hasText(cuisine) || "all".equalsIgnoreCase(cuisine.trim())) {
            return true;
        }
        String foodCuisine = food.getCuisine();
        if (!StringUtils.hasText(foodCuisine)) {
            return false;
        }
        String normalizedCuisine = cuisine.trim().toLowerCase(Locale.ROOT);
        return foodCuisine.toLowerCase(Locale.ROOT).equals(normalizedCuisine)
                || foodCuisine.toLowerCase(Locale.ROOT).contains(normalizedCuisine);
    }

    private SpotBuilding inferBuilding(SpotFood food) {
        if (!StringUtils.hasText(food.getPlaceId()) || !StringUtils.hasText(food.getLocation())) {
            return null;
        }

        List<SpotBuilding> candidates = buildingService.listByPlaceId(food.getPlaceId());
        SpotBuilding best = null;
        int bestScore = 0;
        for (SpotBuilding building : candidates) {
            int score = buildingMatchScore(food.getLocation(), building);
            if (score > bestScore) {
                best = building;
                bestScore = score;
            }
        }
        return bestScore > 0 ? best : null;
    }

    private int buildingMatchScore(String location, SpotBuilding building) {
        String normalizedLocation = normalizeText(location);
        int score = 0;
        for (String alias : buildingAliases(building)) {
            String normalizedAlias = normalizeText(alias);
            if (normalizedAlias.isEmpty()) {
                continue;
            }
            if (normalizedLocation.contains(normalizedAlias)) {
                score = Math.max(score, 100 + normalizedAlias.length());
            } else if (normalizedAlias.contains(normalizedLocation)) {
                score = Math.max(score, 50 + normalizedLocation.length());
            }
        }
        return score;
    }

    private List<String> buildingAliases(SpotBuilding building) {
        List<String> aliases = new ArrayList<>();
        if (StringUtils.hasText(building.getName())) {
            String name = building.getName();
            aliases.add(name);
            aliases.add(name.replace("星海", "").replace("云山", "").replace("镜湖", ""));
            aliases.add(name.replace("第一食堂", "一食堂"));
            aliases.add(name.replace("第二食堂", "二食堂"));
        }
        if (StringUtils.hasText(building.getType())) {
            aliases.add(building.getType());
        }
        return aliases;
    }

    private String inferRestaurantName(String location) {
        if (!StringUtils.hasText(location)) {
            return "";
        }
        String text = location.trim();
        List<String> separators = List.of("窗口", "咖啡吧", "甜品站", "补给站", "小吃亭", "美食广场", "甜品车", "餐吧", "咖啡馆");
        for (String separator : separators) {
            int index = text.indexOf(separator);
            if (index > 0) {
                return text.substring(0, index + separator.length()).trim();
            }
        }
        return text;
    }

    private String inferWindowName(String location) {
        if (!StringUtils.hasText(location)) {
            return "";
        }
        String text = location.trim();
        int windowIndex = text.lastIndexOf("窗口");
        if (windowIndex >= 0) {
            int start = Math.max(0, text.lastIndexOf(' ', windowIndex) + 1);
            return text.substring(start, windowIndex + "窗口".length()).trim();
        }
        int numberWindowIndex = text.lastIndexOf("号窗口");
        if (numberWindowIndex >= 0) {
            int start = Math.max(0, text.lastIndexOf(' ', numberWindowIndex) + 1);
            return text.substring(start, numberWindowIndex + "号窗口".length()).trim();
        }
        return text;
    }

    private Double resolveDistance(String originNodeId, SpotBuilding targetBuilding) {
        if (!StringUtils.hasText(originNodeId) || targetBuilding == null || !StringUtils.hasText(targetBuilding.getId())) {
            return null;
        }

        String origin = originNodeId.trim();
        if (shortestPathAlgorithm.isGraphLoaded()
                && shortestPathAlgorithm.containsNode(origin)
                && shortestPathAlgorithm.containsNode(targetBuilding.getId())) {
            ShortestPathAlgorithm.PathResult pathResult =
                    shortestPathAlgorithm.dijkstraDistanceOnly(origin, targetBuilding.getId());
            if (pathResult.isReachable()) {
                return pathResult.getCost();
            }
        }

        SpotBuilding originBuilding = buildingService.getById(origin);
        if (originBuilding == null
                || originBuilding.getLat() == null
                || originBuilding.getLng() == null
                || targetBuilding.getLat() == null
                || targetBuilding.getLng() == null) {
            return null;
        }

        return GeoUtils.distance(
                originBuilding.getLat().doubleValue(),
                originBuilding.getLng().doubleValue(),
                targetBuilding.getLat().doubleValue(),
                targetBuilding.getLng().doubleValue()
        );
    }

    private BigDecimal deriveRating(int popularity) {
        double boundedPopularity = Math.max(0, Math.min(popularity, 100));
        double rating = 3.5 + boundedPopularity / 100.0 * 1.5;
        return BigDecimal.valueOf(rating).setScale(1, RoundingMode.HALF_UP);
    }

    private int popularityValue(SpotFood food) {
        return food.getPopularity() == null ? 0 : food.getPopularity();
    }

    private double round(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private String normalizeText(String value) {
        if (value == null) {
            return "";
        }
        return value.toLowerCase(Locale.ROOT)
                .replace("第", "")
                .replace("一", "1")
                .replace("二", "2")
                .replace("三", "3")
                .replace("四", "4")
                .replace("五", "5")
                .replace("六", "6")
                .replace("七", "7")
                .replace("八", "8")
                .replace("九", "9")
                .replaceAll("[\s、，,。.-]", "");
    }
}
