import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, BookOpen, Sparkles, MessageCircle, ArrowRight, Clock, PenLine, Trash2, Heart } from 'lucide-react';
import { diaryAPI, getFileUrl, deleteDiary, getLikedDiaries, getPlaces } from '../services/api';
import EmptyState from '../components/ui/EmptyState';
import StarRating from '../components/ui/StarRating';
import SearchDropdown from '../components/SearchDropdown';
import { getRecentPlaces } from '../utils/recentPlaces';

function HomePage() {
  const [myDiaries, setMyDiaries] = useState([]);
  const [likedDiaries, setLikedDiaries] = useState([]);
  const [recentPlaces, setRecentPlaces] = useState([]);
  const [trendingPlaces, setTrendingPlaces] = useState([]);
  const [loadingDiaries, setLoadingDiaries] = useState(true);
  const navigate = useNavigate();

  const savedUser = localStorage.getItem('user');
  const currentUser = savedUser ? JSON.parse(savedUser) : null;

  const quickTags = ['图书馆', '食堂', '校门', '教学楼', '景点', '小红书热门'];

  useEffect(() => {
    setRecentPlaces(getRecentPlaces());

    // Fetch places for trending section
    getPlaces().then(res => {
      if (res.success && res.data) {
        const sorted = [...res.data]
          .filter(p => p.xhsInfo?.trendingScore > 0)
          .sort((a, b) => (b.xhsInfo?.trendingScore || 0) - (a.xhsInfo?.trendingScore || 0))
          .slice(0, 4);
        setTrendingPlaces(sorted);
      }
    }).catch(() => {});

    if (currentUser?.id) {
      diaryAPI.getDiariesByAuthor(currentUser.id)
        .then(res => setMyDiaries((res.data || []).slice(0, 3)))
        .catch(() => {})
        .finally(() => setLoadingDiaries(false));

      getLikedDiaries(currentUser.id)
        .then(res => setLikedDiaries(res.data || []))
        .catch(() => {});
    } else {
      setLoadingDiaries(false);
    }
  }, []);

  const handleTagClick = (tag) => {
    navigate(`/location-search?q=${encodeURIComponent(tag)}`);
  };

  const handleDeleteDiary = async (e, diaryId) => {
    e.stopPropagation();
    if (!window.confirm('确定要删除这篇游记吗？')) return;
    try {
      await deleteDiary(diaryId);
      setMyDiaries((prev) => prev.filter((d) => d.id !== diaryId));
    } catch {
      // silently fail
    }
  };

  return (
    <div className="max-w-screen-xl mx-auto px-6 lg:px-12 py-12">
      {/* ========== Search ========== */}
      <section className="max-w-2xl mx-auto text-center mb-16">
        <h1 className="font-serif text-3xl text-heading mb-8">
          {currentUser ? `${currentUser.username || '你好'}，想去哪里？` : '想去哪里？'}
        </h1>
        <div className="mb-6">
          <SearchDropdown />
        </div>
        <div className="flex justify-center gap-2 flex-wrap">
          {quickTags.map(tag => (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              className="px-4 py-1.5 text-xs font-sans text-muted bg-accent-soft/60 border border-border rounded-full hover:text-accent hover:border-accent/40 transition-colors"
            >
              {tag}
            </button>
          ))}
        </div>
      </section>

      {/* ========== XHS Trending ========== */}
      {trendingPlaces.length > 0 && (
        <section className="mb-12">
          <div className="border border-rose-200 bg-gradient-to-r from-rose-50 to-white rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-rose-100">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📕</span>
                <div>
                  <h3 className="font-serif text-base text-heading">发现小红书热门打卡地</h3>
                  <p className="text-xs text-muted mt-0.5">基于小红书用户真实笔记的热度排行</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/location-search')}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-sans bg-rose-600 text-white rounded-full hover:bg-rose-700 transition-colors"
              >
                <Sparkles size={14} />
                探索更多
              </button>
            </div>
            {/* Trending place cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-rose-100">
              {trendingPlaces.map((place, i) => (
                <div
                  key={place.id}
                  onClick={() => navigate(`/places/${place.id}`)}
                  className="group cursor-pointer p-4 hover:bg-rose-50/60 transition-colors"
                >
                  <div className="aspect-square bg-accent-soft rounded-xl overflow-hidden mb-3">
                    {place.image ? (
                      <img src={getFileUrl(place.image)} alt={place.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <MapPin size={28} className="w-full h-full p-8 text-muted/40" />
                    )}
                  </div>
                  <p className="font-serif text-sm text-heading group-hover:text-accent transition-colors truncate">{place.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-rose-500 font-semibold">🔥 {place.xhsInfo?.trendingScore >= 10000 ? (place.xhsInfo.trendingScore / 10000).toFixed(1) + 'w' : place.xhsInfo?.trendingScore || '--'}</span>
                    <StarRating value={place.rating || 0} size={10} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Fallback banner when no trending data */}
      {trendingPlaces.length === 0 && (
        <section className="mb-12">
          <div className="border border-rose-200 bg-gradient-to-r from-rose-50 to-white rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📕</span>
              <div>
                <h3 className="font-serif text-base text-heading">发现小红书热门打卡地</h3>
                <p className="text-xs text-muted mt-0.5">基于小红书用户真实笔记的热度排行</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/location-search')}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-sans bg-rose-600 text-white rounded-full hover:bg-rose-700 transition-colors"
            >
              <Sparkles size={14} />
              探索热门地点
            </button>
          </div>
        </section>
      )}

      {/* ========== Recent Places ========== */}
      {recentPlaces.length > 0 && (
        <section className="mb-16">
          <div className="flex justify-between items-end mb-6">
            <h2 className="font-serif text-xl text-heading flex items-center gap-2">
              <Clock size={20} className="text-muted/60" />
              最近访问
            </h2>
            <button
              onClick={() => {
                localStorage.removeItem('tour_recent_places');
                setRecentPlaces([]);
              }}
              className="text-xs text-muted hover:text-heading transition-colors"
            >
              清空记录
            </button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
            {recentPlaces.map(place => (
              <div
                key={place.id}
                onClick={() => navigate(`/places/${place.id}`)}
                className="flex-shrink-0 w-44 cursor-pointer group"
              >
                <div className="aspect-[4/3] bg-accent-soft rounded-xl overflow-hidden mb-3">
                  {place.image ? (
                    <img src={getFileUrl(place.image)} alt={place.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <MapPin size={28} className="w-full h-full p-6 text-muted/40" />
                  )}
                </div>
                <h3 className="font-serif text-sm text-heading group-hover:text-accent transition-colors truncate">{place.name}</h3>
                <StarRating value={place.rating || 0} size={11} className="mt-1" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ========== My Diaries ========== */}
      <section className="mb-16">
        <div className="flex justify-between items-end mb-6">
          <h2 className="font-serif text-xl text-heading flex items-center gap-2">
            <BookOpen size={20} className="text-muted/60" />
            我的游记
          </h2>
          {myDiaries.length > 0 && (
            <button onClick={() => navigate('/my-diaries')} className="text-xs text-muted hover:text-heading flex items-center gap-1 transition-colors">
              查看全部 <ArrowRight size={14} />
            </button>
          )}
        </div>

        {loadingDiaries ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[3/2] bg-accent-soft rounded-xl mb-4" />
                <div className="h-4 bg-accent-soft rounded w-3/4 mb-2" />
                <div className="h-3 bg-accent-soft rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : myDiaries.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {myDiaries.map(diary => (
              <div
                key={diary.id}
                onClick={() => navigate(`/diaries/${diary.id}`)}
                className="group cursor-pointer card-hover-lift relative"
              >
                <div className="aspect-[3/2] bg-accent-soft rounded-xl overflow-hidden mb-4">
                  {diary.images && diary.images.length > 0 ? (
                    <img src={getFileUrl(diary.images[0])} alt={diary.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <BookOpen size={28} className="w-full h-full p-8 text-muted/40" />
                  )}
                </div>
                <button
                  onClick={(e) => handleDeleteDiary(e, diary.id)}
                  className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-white/80 hover:bg-red-50 text-muted/50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                  title="删除游记"
                >
                  <Trash2 size={14} />
                </button>
                <h3 className="font-serif text-base text-heading mb-1 group-hover:text-accent transition-colors line-clamp-2">{diary.title}</h3>
                <p className="font-sans text-xs text-muted line-clamp-2">{diary.content || diary.description || '暂无内容'}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={PenLine}
            title="还没有写过游记"
            description="记录你的旅行故事，与大家分享美好瞬间"
            actionLabel="写第一篇游记"
            onAction={() => navigate('/diaries?create=true')}
          />
        )}
      </section>

      {/* ========== Liked Diaries ========== */}
      {likedDiaries.length > 0 && (
        <section className="mb-16">
          <div className="flex justify-between items-end mb-6">
            <h2 className="font-serif text-xl text-heading flex items-center gap-2">
              <Heart size={20} className="text-accent" />
              我的点赞
            </h2>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
            {likedDiaries.map(diary => (
              <div
                key={diary.id}
                onClick={() => navigate(`/diaries/${diary.id}`)}
                className="flex-shrink-0 w-44 cursor-pointer group"
              >
                <div className="aspect-[3/2] bg-accent-soft rounded-xl overflow-hidden mb-3">
                  {diary.images && diary.images.length > 0 ? (
                    <img src={getFileUrl(diary.images[0])} alt={diary.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <BookOpen size={24} className="w-full h-full p-6 text-muted/40" />
                  )}
                </div>
                <h3 className="font-serif text-sm text-heading group-hover:text-accent transition-colors truncate">{diary.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Heart size={11} className="text-accent fill-accent" />
                  <span className="text-xs text-muted">{diary.likeCount || 0}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ========== Quick Actions ========== */}
      <section>
        <h2 className="font-serif text-xl text-heading mb-6">快捷功能</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            onClick={() => navigate('/navigation')}
            className="group cursor-pointer p-8 border border-border rounded-xl bg-surface hover:border-accent/30 hover:bg-accent-soft/40 transition-all duration-300 card-hover-lift flex items-start gap-6"
          >
            <div className="w-14 h-14 bg-accent/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-accent/15 transition-colors">
              <Sparkles size={26} className="text-accent" />
            </div>
            <div>
              <h3 className="font-serif text-lg text-heading mb-1">路线规划</h3>
              <p className="font-sans text-sm text-muted">一句话描述目的地，自动生成最优行程路线</p>
            </div>
          </div>

          <div
            onClick={() => navigate('/travel-assistant')}
            className="group cursor-pointer p-8 border border-border rounded-xl bg-surface hover:border-accent/30 hover:bg-accent-soft/40 transition-all duration-300 card-hover-lift flex items-start gap-6"
          >
            <div className="w-14 h-14 bg-accent/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-accent/15 transition-colors">
              <MessageCircle size={26} className="text-accent" />
            </div>
            <div>
              <h3 className="font-serif text-lg text-heading mb-1">AI 助手</h3>
              <p className="font-sans text-sm text-muted">智能旅游搭子陪你聊天、推荐地点、规划行程</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
