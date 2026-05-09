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
import LogoText from '../components/ui/LogoText';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';
import { useScrollReveal } from '../hooks/useScrollReveal';

function CountUp({ target, duration = 1200 }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!target || target === 0) return;
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);

  return <span>{count.toLocaleString()}</span>;
}

function HomePage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [recommendedPlaces, setRecommendedPlaces] = useState([]);
  const [recommendedDiaries, setRecommendedDiaries] = useState([]);
  const [popularPlaces, setPopularPlaces] = useState([]);
  const [statsInView, setStatsInView] = useState(false);
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
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin" />
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
      {/* ========== Hero Section ========== */}
      <section
        className="relative w-full h-[70vh] min-h-[500px] flex items-center justify-center overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #f8f0e8 0%, #fcf7f2 30%, #f3e9db 100%)',
        }}
      >
        {/* Ambient glows */}
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-accent/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-[350px] h-[350px] rounded-full bg-warm/10 blur-3xl pointer-events-none" />

        {/* Layered mountain landscape with mist */}
        <svg
          className="absolute bottom-0 left-0 w-full h-[28%] pointer-events-none"
          viewBox="0 0 1440 280"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="hmMtnBack" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4b883" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#c4a265" stopOpacity="0.08" />
            </linearGradient>
            <linearGradient id="hmMtnMid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4b883" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#c4a265" stopOpacity="0.14" />
            </linearGradient>
            <linearGradient id="hmMtnFront" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b8955a" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#a07840" stopOpacity="0.22" />
            </linearGradient>
            <filter id="hmMist">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>
          <path d="M0,280 L0,165 C40,140 80,125 130,150 C180,108 230,95 290,130 C350,100 410,85 470,125 C530,95 590,78 650,118 C710,95 770,85 830,120 C890,92 950,80 1010,118 C1070,98 1130,90 1190,125 C1250,100 1310,88 1370,120 C1410,105 1440,100 1440,135 L1440,280 Z" fill="url(#hmMtnBack)" />
          <ellipse cx="200" cy="165" rx="160" ry="18" fill="#d4b883" opacity="0.08" filter="url(#hmMist)" />
          <ellipse cx="800" cy="145" rx="200" ry="14" fill="#d4b883" opacity="0.06" filter="url(#hmMist)" />
          <path d="M0,280 L0,190 C55,168 110,158 175,180 C240,142 310,128 375,168 C440,138 510,125 575,162 C640,135 710,118 775,155 C840,132 910,118 975,155 C1040,130 1110,120 1175,158 C1240,135 1310,122 1375,155 C1440,145 1440,145 1440,155 L1440,280 Z" fill="url(#hmMtnMid)" />
          <path d="M0,280 L0,190 C55,168 110,158 175,180 C240,142 310,128 375,168 C440,138 510,125 575,162 C640,135 710,118 775,155 C840,132 910,118 975,155 C1040,130 1110,120 1175,158 C1240,135 1310,122 1375,155 C1440,145 1440,145 1440,155 L1440,280 Z" fill="none" stroke="#c4a265" strokeOpacity="0.2" strokeWidth="0.5" />
          <ellipse cx="500" cy="195" rx="180" ry="16" fill="#c4a265" opacity="0.07" filter="url(#hmMist)" />
          <ellipse cx="1100" cy="180" rx="160" ry="14" fill="#c4a265" opacity="0.06" filter="url(#hmMist)" />
          <path d="M0,280 L0,218 C65,200 130,190 200,212 C270,182 345,168 415,208 C485,180 555,165 625,200 C695,178 765,168 835,200 C905,175 975,165 1045,198 C1115,178 1185,170 1255,200 C1325,178 1395,170 1440,195 L1440,280 Z" fill="url(#hmMtnFront)" />
          <path d="M0,280 L0,218 C65,200 130,190 200,212 C270,182 345,168 415,208 C485,180 555,165 625,200 C695,178 765,168 835,200 C905,175 975,165 1045,198 C1115,178 1185,170 1255,200 C1325,178 1395,170 1440,195 L1440,280 Z" fill="none" stroke="#a07840" strokeOpacity="0.25" strokeWidth="0.6" />
          <path d="M0,274 Q20,270 40,274 Q60,278 80,274 Q100,270 120,274 Q140,278 160,274 Q180,270 200,274 Q220,278 240,274 Q260,270 280,274 Q300,278 320,274 Q340,270 360,274 Q380,278 400,274 Q420,270 440,274 Q460,278 480,274 Q500,270 520,274 Q540,278 560,274 Q580,270 600,274 Q620,278 640,274 Q660,270 680,274 Q700,278 720,274 Q740,270 760,274 Q780,278 800,274 Q820,270 840,274 Q860,278 880,274 Q900,270 920,274 Q940,278 960,274 Q980,270 1000,274 Q1020,278 1040,274 Q1060,270 1080,274 Q1100,278 1120,274 Q1140,270 1160,274 Q1180,278 1200,274 Q1220,270 1240,274 Q1260,278 1280,274 Q1300,270 1320,274 Q1340,278 1360,274 Q1380,270 1400,274 Q1420,278 1440,274" fill="none" stroke="#b8955a" strokeOpacity="0.15" strokeWidth="0.8" />
        </svg>

        {/* Warm floating particles */}
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: `${20 + i * 28}%`,
              top: `${30 + i * 18}%`,
              width: 4 + (i % 2) * 3,
              height: 4 + (i % 2) * 3,
              background: 'radial-gradient(circle, rgba(199,125,75,0.4) 0%, transparent 70%)',
            }}
            animate={{
              y: [0, -20, 0],
              x: [0, i % 2 === 0 ? 10 : -10, 0],
              opacity: [0.1, 0.4, 0.1],
              scale: [1, 1.4, 1],
            }}
            transition={{
              duration: 5 + i * 2,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 1.5,
            }}
          />
        ))}

        <div className="relative z-10 text-center px-6">
          <motion.div
            ref={heroRef}
            initial={{ opacity: 0, y: 24 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="flex flex-col items-center"
          >
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <LogoText className="mb-8" />
            </motion.div>

            <motion.h1
              className="font-serif text-4xl md:text-6xl mb-4 tracking-tight text-heading"
              initial={{ opacity: 0, filter: 'blur(4px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              留下你的轨迹
            </motion.h1>

            <motion.p
              className="font-sans text-base md:text-lg text-muted mb-10 font-light"
              initial={{ opacity: 0, filter: 'blur(2px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              以北京邮电大学为起点，发现属于你的旅程
            </motion.p>

            <motion.div
              className="flex gap-4 justify-center"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8 }}
            >
              <CTAButton variant="accent" size="lg" onClick={() => navigate('/location-search')}>
                探索地点
              </CTAButton>
              <CTAButton variant="secondary" size="lg" onClick={() => navigate('/diaries')}>
                旅游日记
              </CTAButton>
            </motion.div>
          </motion.div>
        </div>

        {/* Organic divider at hero bottom */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 divider-soft" />
      </section>

      {/* ========== Statistics ========== */}
      <section className="max-w-screen-xl mx-auto px-6 lg:px-12 py-16 mt-0 relative z-10">
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-6"
          onViewportEnter={() => setStatsInView(true)}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          {statItems.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div key={idx} className="bg-surface border border-border p-6 text-center card-hover-lift">
                <div className="flex justify-center mb-3">
                  <Icon size={24} className="text-muted" />
                </div>
                <p className="font-serif text-3xl text-heading mb-1">
                  {statsInView ? <CountUp target={stat.val || 0} /> : 0}
                </p>
                <p className="font-sans text-xs text-muted uppercase tracking-widest">{stat.title}</p>
              </div>
            );
          })}
        </motion.div>
      </section>

      {/* ========== Recommended Places + Popular Places ========== */}
      <section className="max-w-screen-xl mx-auto px-6 lg:px-12 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Recommended */}
          <div>
            <div className="flex justify-between items-end mb-8 border-b border-border pb-4">
              <div>
                <SectionLabel>为你推荐</SectionLabel>
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
                    className="flex gap-4 p-4 cursor-pointer hover:bg-accent-soft transition-colors border-b border-border last:border-b-0 card-hover-lift"
                  >
                    <div className="w-16 h-16 bg-accent-soft flex-shrink-0 overflow-hidden">
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
                <SectionLabel>热门排行</SectionLabel>
                <h2 className="font-serif text-2xl text-heading">热门地点</h2>
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
                    className="flex gap-4 p-4 cursor-pointer hover:bg-accent-soft transition-colors border-b border-border last:border-b-0 card-hover-lift"
                  >
                    <div className="w-12 h-12 flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                      style={{ background: index < 3 ? '#c77d4b' : '#b8a99a' }}>
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

      {/* ========== Travel Diaries ========== */}
      <section className="max-w-screen-xl mx-auto px-6 lg:px-12 pb-16">
        <div className="border-t border-border pt-16">
          <div className="flex justify-between items-end mb-12">
            <div>
              <SectionLabel>旅行故事</SectionLabel>
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
                  className="group cursor-pointer card-hover-lift"
                >
                  <div className="aspect-[3/2] overflow-hidden mb-6 bg-accent-soft">
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

      {/* ========== Quick Actions ========== */}
      <section className="max-w-screen-xl mx-auto px-6 lg:px-12 pb-24">
        <div className="border-t border-border pt-16">
          <SectionLabel className="text-center">快速操作</SectionLabel>
          <h2 className="font-serif text-3xl text-heading text-center mb-12">快速开始</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {quickActions.map((action, idx) => {
              const Icon = action.icon;
              return (
                <button
                  key={idx}
                  onClick={() => navigate(action.route)}
                  className="border border-border p-8 text-center hover:bg-accent-soft transition-colors group card-hover-lift"
                >
                  <Icon size={32} className="mx-auto mb-4 text-muted group-hover:text-accent transition-colors" />
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




