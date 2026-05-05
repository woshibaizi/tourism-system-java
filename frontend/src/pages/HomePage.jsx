import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MapPin, BookOpen, Users, GitBranch, Star, Eye, ArrowRight, Flame
} from 'lucide-react';
import { getStatistics, getRecommendedPlaces, getRecommendedDiaries, getPlaces, getFileUrl } from '../services/api';
import CTAButton from '../components/ui/CTAButton';
import SectionLabel from '../components/ui/SectionLabel';
import StarRating from '../components/ui/StarRating';
import ScrollRow from '../components/ui/ScrollRow';
import ImageCard from '../components/ui/ImageCard';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';
import { useScrollReveal } from '../hooks/useScrollReveal';

function HomePage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [recommendedPlaces, setRecommendedPlaces] = useState([]);
  const [recommendedDiaries, setRecommendedDiaries] = useState([]);
  const [popularPlaces, setPopularPlaces] = useState([]);
  const navigate = useNavigate();
  const { ref: heroRef, isInView: heroInView } = useScrollReveal();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const savedUser = localStorage.getItem('user');
      const currentUserId = savedUser ? JSON.parse(savedUser).id : 'user_001';
      const [statsResult, placesResult, diariesResult, popularResult] = await Promise.allSettled([
        getStatistics(),
        getRecommendedPlaces(currentUserId, 'hybrid'),
        getRecommendedDiaries(currentUserId, 'content'),
        getPlaces(),
      ]);
      if (statsResult.status === 'fulfilled') setStats(statsResult.value.data);
      if (placesResult.status === 'fulfilled') setRecommendedPlaces(placesResult.value.data.slice(0, 4));
      if (diariesResult.status === 'fulfilled') setRecommendedDiaries(diariesResult.value.data.slice(0, 6));
      if (popularResult.status === 'fulfilled') {
        const sorted = popularResult.value.data.sort((a, b) => b.rating - a.rating);
        setPopularPlaces(sorted.slice(0, 5));
      }
    } catch (error) { console.error('加载数据失败:', error); }
    finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
      </div>
    );
  }

  const statItems = [
    { title: '旅游场所', val: stats.places, icon: MapPin },
    { title: '旅游日记', val: stats.diaries, icon: BookOpen },
    { title: '注册用户', val: stats.users, icon: Users },
    { title: '路径网络', val: stats.roads, icon: GitBranch },
  ];

  const quickActions = [
    { title: '地点搜索', desc: '统一搜索景区学校美食', icon: MapPin, route: '/location-search' },
    { title: '写游记', desc: '记录美好时光', icon: BookOpen, route: '/diaries?create=true' },
    { title: '校内导航', desc: '北邮校园步行导航', icon: MapPin, route: '/campus-navigation' },
    { title: '统计分析', desc: '数据洞察分析', icon: Flame, route: '/stats' },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="relative w-full h-[70vh] min-h-[500px] flex items-center justify-center overflow-hidden bg-neutral-100">
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/10" />
        <div className="relative z-10 text-center text-white px-6">
          <motion.div
            ref={heroRef}
            initial={{ opacity: 0, y: 24 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
          >
            <h1 className="font-serif text-5xl md:text-7xl mb-6 tracking-tight drop-shadow-sm">
              发现属于你的旅程
            </h1>
            <p className="font-sans text-lg md:text-xl text-white/80 mb-10 font-light">
              为你量身定制的地点与路线，一触即发。
            </p>
            <div className="flex gap-4 justify-center">
              <CTAButton variant="outline" size="lg" onClick={() => navigate('/location-search')}>
                地点搜索
              </CTAButton>
              <CTAButton variant="outline" size="lg" onClick={() => navigate('/diaries')}>
                旅游日记
              </CTAButton>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Statistics */}
      <section className="max-w-screen-xl mx-auto px-6 lg:px-12 py-16 -mt-16 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {statItems.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div key={idx} className="bg-white border border-neutral-100 p-6 text-center">
                <div className="flex justify-center mb-3">
                  <Icon size={24} className="text-muted" />
                </div>
                <p className="font-serif text-3xl text-heading mb-1">{stat.val || 0}</p>
                <p className="font-sans text-xs text-muted uppercase tracking-widest">{stat.title}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recommended Places + Popular Places */}
      <section className="max-w-screen-xl mx-auto px-6 lg:px-12 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Recommended */}
          <div>
            <div className="flex justify-between items-end mb-8 border-b border-border pb-4">
              <div>
                <SectionLabel>For You</SectionLabel>
                <h2 className="font-serif text-2xl text-heading">推荐地点</h2>
              </div>
              <button onClick={() => navigate('/location-search')}
                className="font-sans text-xs uppercase tracking-widest text-muted hover:text-heading flex items-center gap-1">
                查看更多 <ArrowRight size={14} />
              </button>
            </div>
            {recommendedPlaces.length > 0 ? (
              <div className="space-y-6">
                {recommendedPlaces.map((place, index) => (
                  <div
                    key={place.id || index}
                    onClick={() => navigate(`/places/${place.id}`)}
                    className="flex gap-4 p-4 cursor-pointer hover:bg-neutral-50 transition-colors border-b border-neutral-50 last:border-b-0"
                  >
                    <div className="w-16 h-16 bg-neutral-100 flex-shrink-0 overflow-hidden">
                      {place.image ? (
                        <img src={getFileUrl(place.image)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <MapPin size={24} className="w-full h-full p-4 text-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif text-lg text-heading">{place.name}</h3>
                      <StarRating value={place.rating || 0} size={12} className="mt-1" />
                      <p className="font-sans text-xs text-muted mt-1 line-clamp-2">{place.description || '暂无描述'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={MapPin} title="暂无推荐地点" />
            )}
          </div>

          {/* Popular */}
          <div>
            <div className="flex justify-between items-end mb-8 border-b border-border pb-4">
              <div>
                <SectionLabel>Top Rated</SectionLabel>
                <h2 className="font-serif text-2xl text-heading">热门地点排行</h2>
              </div>
              <button onClick={() => navigate('/location-search')}
                className="font-sans text-xs uppercase tracking-widest text-muted hover:text-heading flex items-center gap-1">
                查看更多 <ArrowRight size={14} />
              </button>
            </div>
            {popularPlaces.length > 0 ? (
              <div className="space-y-6">
                {popularPlaces.map((place, index) => (
                  <div
                    key={place.id || index}
                    onClick={() => navigate(`/places/${place.id}`)}
                    className="flex gap-4 p-4 cursor-pointer hover:bg-neutral-50 transition-colors border-b border-neutral-50 last:border-b-0"
                  >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                      style={{ background: index < 3 ? '#0a0a0a' : '#a3a3a3' }}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif text-lg text-heading">{place.name}</h3>
                      <StarRating value={place.rating || 0} size={12} className="mt-1" />
                      <p className="font-sans text-xs text-muted mt-1">
                        <Flame size={12} className="inline mr-1" />
                        {place.clickCount || 0} 浏览 · {place.type || '景点'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Star} title="暂无热门地点" />
            )}
          </div>
        </div>
      </section>

      {/* Travel Diaries */}
      <section className="max-w-screen-xl mx-auto px-6 lg:px-12 pb-16">
        <div className="border-t border-border pt-16">
          <div className="flex justify-between items-end mb-12">
            <div>
              <SectionLabel>Stories</SectionLabel>
              <h2 className="font-serif text-3xl text-heading">精选旅游日记</h2>
            </div>
            <button onClick={() => navigate('/diaries')}
              className="font-sans text-xs uppercase tracking-widest text-muted hover:text-heading flex items-center gap-1">
              查看更多 <ArrowRight size={14} />
            </button>
          </div>
          {recommendedDiaries.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {recommendedDiaries.map((diary) => (
                <div
                  key={diary.id}
                  onClick={() => navigate(`/diaries/${diary.id}`)}
                  className="group cursor-pointer"
                >
                  <div className="aspect-[4/3] overflow-hidden mb-6 bg-neutral-100">
                    {diary.images && diary.images.length > 0 ? (
                      <img src={getFileUrl(diary.images[0])} alt={diary.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    ) : (
                      <BookOpen size={32} className="w-full h-full p-8 text-muted" />
                    )}
                  </div>
                  <h3 className="font-serif text-lg text-heading mb-2 line-clamp-2">{diary.title}</h3>
                  <div className="flex justify-between items-center text-xs text-muted">
                    <StarRating value={diary.rating || 0} size={11} />
                    <span className="flex items-center gap-1"><Eye size={12} /> {diary.clickCount || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={BookOpen} title="暂无推荐日记" />
          )}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="max-w-screen-xl mx-auto px-6 lg:px-12 pb-24">
        <div className="border-t border-border pt-16">
          <SectionLabel className="text-center">Quick Actions</SectionLabel>
          <h2 className="font-serif text-3xl text-heading text-center mb-12">快速操作</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {quickActions.map((action, idx) => {
              const Icon = action.icon;
              return (
                <button
                  key={idx}
                  onClick={() => navigate(action.route)}
                  className="border border-border p-8 text-center hover:bg-neutral-50 transition-colors group"
                >
                  <Icon size={32} className="mx-auto mb-4 text-muted group-hover:text-heading transition-colors" />
                  <p className="font-serif text-base text-heading mb-1">{action.title}</p>
                  <p className="font-sans text-xs text-muted">{action.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
