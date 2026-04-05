package com.tourism.model.vo;

import com.tourism.model.entity.SpotBuilding;
import com.tourism.model.entity.SpotFacility;
import com.tourism.model.entity.SpotPlace;

import java.util.List;

public class PlaceDetailVO {

    private SpotPlace place;
    private List<SpotBuilding> buildings;
    private List<SpotFacility> facilities;

    public static PlaceDetailVO of(SpotPlace place, List<SpotBuilding> buildings, List<SpotFacility> facilities) {
        PlaceDetailVO vo = new PlaceDetailVO();
        vo.setPlace(place);
        vo.setBuildings(buildings);
        vo.setFacilities(facilities);
        return vo;
    }

    public SpotPlace getPlace() {
        return place;
    }

    public void setPlace(SpotPlace place) {
        this.place = place;
    }

    public List<SpotBuilding> getBuildings() {
        return buildings;
    }

    public void setBuildings(List<SpotBuilding> buildings) {
        this.buildings = buildings;
    }

    public List<SpotFacility> getFacilities() {
        return facilities;
    }

    public void setFacilities(List<SpotFacility> facilities) {
        this.facilities = facilities;
    }
}
