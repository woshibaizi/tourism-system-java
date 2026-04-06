package com.tourism.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.tourism.mapper.DiaryMapper;
import com.tourism.model.entity.TravelDiary;
import com.tourism.service.DiaryService;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
public class DiaryServiceImpl extends ServiceImpl<DiaryMapper, TravelDiary> implements DiaryService {

    @Override
    public IPage<TravelDiary> listDiaries(int page, int size, String placeId) {
        LambdaQueryWrapper<TravelDiary> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(placeId)) {
            wrapper.eq(TravelDiary::getPlaceId, placeId);
        }
        wrapper.orderByDesc(TravelDiary::getCreatedAt);
        return page(new Page<>(page, size), wrapper);
    }

    @Override
    public TravelDiary getDiaryDetail(String id) {
        return getById(id);
    }

    @Override
    public List<TravelDiary> listByAuthorId(Long authorId) {
        LambdaQueryWrapper<TravelDiary> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TravelDiary::getAuthorId, authorId)
                .orderByDesc(TravelDiary::getCreatedAt);
        return list(wrapper);
    }

    @Override
    public List<TravelDiary> getHotDiaries(int limit) {
        LambdaQueryWrapper<TravelDiary> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByDesc(TravelDiary::getClickCount)
                .last("LIMIT " + limit);
        return list(wrapper);
    }
}
