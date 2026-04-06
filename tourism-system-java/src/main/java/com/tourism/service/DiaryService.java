package com.tourism.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.tourism.model.entity.TravelDiary;

import java.util.List;

public interface DiaryService extends IService<TravelDiary> {

    /**
     * 分页查询日记列表
     */
    IPage<TravelDiary> listDiaries(int page, int size, String placeId);

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
}
