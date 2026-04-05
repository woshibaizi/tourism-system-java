package com.tourism.model.vo;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tourism.model.entity.SysUser;

import java.util.Collections;
import java.util.List;

public class UserProfileVO {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private Long id;
    private String username;
    private String avatar;
    private List<String> interests;
    private List<String> favoriteCategories;

    public static UserProfileVO from(SysUser user) {
        UserProfileVO vo = new UserProfileVO();
        vo.setId(user.getId());
        vo.setUsername(user.getUsername());
        vo.setAvatar(user.getAvatar());
        vo.setInterests(parseJsonArray(user.getInterests()));
        vo.setFavoriteCategories(parseJsonArray(user.getFavoriteCategories()));
        return vo;
    }

    private static List<String> parseJsonArray(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return OBJECT_MAPPER.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getAvatar() {
        return avatar;
    }

    public void setAvatar(String avatar) {
        this.avatar = avatar;
    }

    public List<String> getInterests() {
        return interests;
    }

    public void setInterests(List<String> interests) {
        this.interests = interests;
    }

    public List<String> getFavoriteCategories() {
        return favoriteCategories;
    }

    public void setFavoriteCategories(List<String> favoriteCategories) {
        this.favoriteCategories = favoriteCategories;
    }
}
