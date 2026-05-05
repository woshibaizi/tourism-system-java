package com.tourism.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.tourism.model.entity.TravelDiary;

import java.util.Map;
import java.util.List;

public interface DiaryService extends IService<TravelDiary> {

    /**
     * 分页查询日记列表
     */
    IPage<TravelDiary> listDiaries(int page, int size, String placeId);

    /**
     * 分页查询日记列表（支持作者筛选）
     */
    IPage<TravelDiary> listDiaries(int page, int size, String placeId, Long authorId);

    /**
     * 获取日记详情
     */
    TravelDiary getDiaryDetail(String id);

    /**
     * 根据作者查询日记
     */
    List<TravelDiary> listByAuthorId(Long authorId);

    /**
     * 获取热门日记
     */
    List<TravelDiary> getHotDiaries(int limit);

    /**
     * 创建日记
     */
    TravelDiary createDiary(Map<String, Object> payload);

    /**
     * 更新日记
     */
    TravelDiary updateDiary(String id, Map<String, Object> payload);

    /**
     * 删除日记
     */
    boolean deleteDiary(String id);

    /**
     * 搜索日记
     */
    List<TravelDiary> searchDiaries(String query, String type);

    /**
     * 推荐日记
     */
    List<TravelDiary> recommendDiaries(Long userId, String algorithm, int topK);

    /**
     * 评分
     */
    TravelDiary rateDiary(String diaryId, Long userId, Double rating);
}
