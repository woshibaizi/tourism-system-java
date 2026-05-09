import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import LogoText from '../components/ui/LogoText';

function StaggerText({ text, className, charDelay = 0.04, baseDelay = 0.3, animate = true, useBloom = false }) {
  return (
    <span className={className}>
      {text.split('').map((char, i) => (
        <motion.span
          key={i}
          initial={animate ? (useBloom ? { opacity: 0, filter: 'blur(4px)' } : { opacity: 0, y: 12 }) : false}
          animate={animate ? (useBloom ? { opacity: 1, filter: 'blur(0px)' } : { opacity: 1, y: 0 }) : false}
          transition={{ delay: baseDelay + i * charDelay, duration: useBloom ? 0.5 : 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: char === ' ' ? 'inline' : 'inline-block' }}
        >
          {char === ' ' ? ' ' : char}
        </motion.span>
      ))}
    </span>
  );
}

const FADE_UP = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
};

const PAGE2_PHOTOS = [
  { src: '/loading/page_2/%E5%8C%97%E4%BA%AC_%E6%95%85%E5%AE%AB.jpg', line1: '北京', line2: '故宫' },
  { src: '/loading/page_2/%E4%BA%91%E5%8D%97_%E5%A4%A7%E7%90%86.jpg', line1: '云南', line2: '大理' },
  { src: '/loading/page_2/%E6%B2%B3%E5%8D%97_%E9%BE%99%E9%97%A8%E7%9F%B3%E7%AA%9F.jpg', line1: '河南', line2: '龙门石窟' },
  { src: '/loading/page_2/%E6%96%B0%E5%BB%BA_%E4%BC%8A%E7%8A%81.png', line1: '新疆', line2: '伊犁' },
  { src: '/loading/page_2/%E5%9B%9B%E5%B7%9D_%E8%B4%A1%E5%98%8E%E9%9B%AA%E5%B1%B1.jpg', line1: '四川', line2: '贡嘎雪山' },
  { src: '/loading/page_2/%E4%B8%8A%E6%B5%B7_%E9%99%86%E5%AE%B6%E5%98%B4.jpg', line1: '上海', line2: '陆家嘴' },
  { src: '/loading/page_2/%E8%A5%BF%E8%97%8F_%E7%BA%B3%E6%9C%A8%E6%8E%AA%E6%B9%96.jpg', line1: '西藏', line2: '纳木措湖' },
];

const PAGE3_PHOTOS = [
  '/loading/page_3/1.jpg', '/loading/page_3/2.jpg', '/loading/page_3/3.jpg',
  '/loading/page_3/4.png', '/loading/page_3/5.jpg', '/loading/page_3/6.jpg',
  '/loading/page_3/7.jpg', '/loading/page_3/8.jpg', '/loading/page_3/9.jpg',
];

/* ── Layered mountain silhouettes (山水画风格) ── */
const MOUNTAIN_BACK = 'M0,280 L0,170 C45,162 90,155 135,160 C185,138 245,125 295,148 C345,118 395,105 445,135 C505,105 565,90 625,118 C675,98 695,92 720,95 C745,92 765,98 815,118 C875,90 935,105 995,135 C1045,105 1095,118 1145,148 C1195,125 1255,138 1305,160 C1350,155 1395,162 1440,170 L1440,280 Z';
const MOUNTAIN_MID  = 'M0,280 L0,200 C55,192 105,184 155,188 C215,165 275,152 345,175 C415,145 495,128 565,155 C625,130 685,112 720,108 C755,112 815,130 875,155 C945,128 1025,145 1095,175 C1165,152 1225,165 1285,188 C1335,184 1385,192 1440,200 L1440,280 Z';
const MOUNTAIN_FRONT = 'M0,280 L0,218 C60,208 120,198 180,210 C250,178 330,160 410,195 C500,155 610,140 720,142 C830,140 940,155 1030,195 C1110,160 1190,178 1260,210 C1320,198 1380,208 1440,218 L1440,280 Z';
/* ── Page 2: Discover (旅游探索) ── */
function DiscoverSlide({ isActive }) {
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    if (!isActive) return;
    const timer = setInterval(() => setPhotoIndex((p) => (p + 1) % PAGE2_PHOTOS.length), 3500);
    return () => clearInterval(timer);
  }, [isActive]);

  const photo = PAGE2_PHOTOS[photoIndex];

  return (
    <div className="flex h-full" style={{ background: '#fbf5ed' }}>
      <div className="w-1/2 flex flex-col justify-center px-10">
        <motion.p
          {...FADE_UP}
          transition={{ ...FADE_UP.transition, delay: 0.2 }}
          className="font-sans text-[10px] uppercase tracking-[0.3em] text-accent mb-4"
        >
          Discover
        </motion.p>
        <motion.h2
          {...FADE_UP}
          transition={{ ...FADE_UP.transition, delay: 0.4 }}
          className="font-serif text-3xl text-heading leading-snug mb-4"
        >
          探索世界
        </motion.h2>
        <motion.p
          {...FADE_UP}
          transition={{ ...FADE_UP.transition, delay: 0.6 }}
          className="font-sans text-sm text-muted leading-relaxed"
        >
          从千年古迹到壮美山河，
          <br />
          从城市烟火到秘境桃源，开启属于你的旅程。
        </motion.p>
        <motion.div {...FADE_UP} transition={{ ...FADE_UP.transition, delay: 0.8 }}>
          <div className="divider-soft mt-8 mb-6" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={isActive ? { opacity: 1 } : {}}
          transition={{ delay: 1.0, duration: 0.8 }}
          className="flex flex-wrap gap-2"
        >
          {['古迹寻踪', '自然探索', '美食之旅', '文化体验'].map((tag) => (
            <span key={tag} className="px-3 py-1 text-[11px] font-sans text-muted border border-border">
              {tag}
            </span>
          ))}
        </motion.div>
      </div>

      <div className="w-1/2 flex items-center justify-center px-6">
        <div className="w-full" style={{ height: '33.33vh' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={photoIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="w-full h-full flex flex-col"
            >
              <div
                className="flex-1 overflow-hidden rounded-sm relative"
                style={{
                  maskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
                }}
              >
                <img src={photo.src} alt={photo.line2} className="w-full h-full object-cover" />
                <div className="absolute inset-0 pointer-events-none bg-accent/5" style={{ mixBlendMode: 'soft-light' }} />
              </div>
              <div className="mt-3 text-center">
                <p className="font-serif text-sm text-heading tracking-wider">{photo.line1}</p>
                <p className="font-serif text-xs text-muted tracking-widest mt-0.5">{photo.line2}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ── Page 3: Record & Share (记录与分享) ── */
function RecordSlide({ isActive }) {
  return (
    <div
      className="flex h-full relative"
      style={{ background: 'linear-gradient(160deg, #22201e 0%, #302a24 50%, #161518 100%)' }}
    >
      <div className="w-1/2 flex items-center justify-center px-6">
        <div className="grid grid-cols-3 gap-2 w-full max-w-2xl">
          {PAGE3_PHOTOS.map((src, i) => (
            <motion.div
              key={i}
              className="aspect-square overflow-hidden rounded-sm cursor-pointer border border-accent/10"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={isActive ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.3 + i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{
                scale: 1.08,
                boxShadow: '0 8px 30px rgba(0,0,0,0.45), 0 0 0 1px rgba(199,125,75,0.2)',
                borderColor: 'rgba(199,125,75,0.35)',
                zIndex: 10,
                transition: { duration: 0.25, ease: 'easeOut' },
              }}
            >
              <img src={src} alt="" className="w-full h-full object-cover transition-transform duration-600 hover:scale-110" />
            </motion.div>
          ))}
        </div>
      </div>

      <div className="w-1/2 flex flex-col justify-center px-10">
        <motion.p {...FADE_UP} transition={{ ...FADE_UP.transition, delay: 0.3 }}
          className="font-sans text-[10px] uppercase tracking-[0.3em] text-accent/80 mb-4">Record &amp; Share</motion.p>
        <motion.h2 {...FADE_UP} transition={{ ...FADE_UP.transition, delay: 0.5 }}
          className="font-serif text-4xl text-white/90 leading-tight mb-3">记录与分享</motion.h2>
        <motion.p {...FADE_UP} transition={{ ...FADE_UP.transition, delay: 0.7 }}
          className="font-sans text-sm text-white/70 leading-relaxed max-w-xl">
          用图文定格旅途中的美好瞬间，<br />一键生成旅行日记，与好友分享你的精彩故事。
        </motion.p>
        <motion.div {...FADE_UP} transition={{ ...FADE_UP.transition, delay: 0.9 }}>
          <div className="flex gap-3 mt-8">
            {['写日记', '晒照片', '分享故事'].map((tag) => (
              <span key={tag} className="px-3 py-1 text-[11px] font-sans text-white/60 border border-white/15">
                {tag}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ── Page 4: AI Agent (智能助手) ── */
function PlanSlide({ isActive }) {
  const features = [
    { icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="11" stroke="currentColor" strokeWidth="1.2" opacity="0.4"/><circle cx="14" cy="14" r="2.5" fill="currentColor" opacity="0.9"/><path d="M14 3 L14 8.5 M14 19.5 L14 25 M3 14 L8.5 14 M19.5 14 L25 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.55"/></svg>, title: '个性化导航', desc: '智能路径规划，室内室外无缝衔接，最优路线一键到达' },
    { icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M17 5 L23 11 L10 24 L4 24 L4 18 Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" opacity="0.8"/><line x1="15" y1="7" x2="20" y2="12" stroke="currentColor" strokeWidth="1.2" opacity="0.45"/></svg>, title: '一键生成日志', desc: 'AI自动整理行程，智能生成精美旅行日记' },
    { icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M14 4C14 4 10 9 10 13.5C10 16.2 11.8 18 14 18C16.2 18 18 16.2 18 13.5C18 9 14 4 14 4Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" opacity="0.85"/><path d="M12 15C12 17.2 12.8 19.5 14 22C15.2 19.5 16 17.2 16 15" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" opacity="0.45"/><circle cx="14" cy="11" r="1.2" fill="currentColor" opacity="0.55"/></svg>, title: '小红书爆款文案', desc: '一键打造小红书风格文案，让你的旅行分享获得更多关注' },
  ];

  return (
    <div className="h-full w-full relative overflow-hidden">
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.1 }}
        animate={isActive ? { scale: 1 } : { scale: 1.1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <img src="/loading/page_4/1.png" alt="" className="w-full h-full object-cover" />
      </motion.div>

      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(160deg, rgba(199,125,75,0.10) 0%, rgba(232,185,109,0.05) 50%, rgba(199,125,75,0.08) 100%)',
          mixBlendMode: 'soft-light',
        }} />

      <div className="absolute inset-y-0 left-0 w-[48%] backdrop-blur-xl bg-black/25 flex items-center">
        <div className="px-10 w-full">
          <motion.p {...FADE_UP} transition={{ ...FADE_UP.transition, delay: 0.2 }}
            className="font-sans text-[10px] uppercase tracking-[0.3em] text-accent/80 mb-4">AI Agent</motion.p>
          <motion.h2 {...FADE_UP} transition={{ ...FADE_UP.transition, delay: 0.4 }}
            className="font-serif text-4xl text-white leading-tight mb-6">智能旅行助手</motion.h2>

          {features.map((f, i) => (
            <motion.div
              key={f.title}
              {...FADE_UP}
              transition={{ ...FADE_UP.transition, delay: 0.6 + i * 0.15 }}
              className="flex items-start gap-3 mb-5"
            >
              <span className="flex-shrink-0 mt-0.5 text-accent">{f.icon}</span>
              <div>
                <h3 className="font-serif text-base text-white/90 mb-1">{f.title}</h3>
                <p className="font-sans text-xs text-white/55 leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}

          <motion.div {...FADE_UP} transition={{ ...FADE_UP.transition, delay: 1.1 }}
            className="mt-8"
            style={{ width: '3rem', height: 0, borderTop: '2px dotted rgba(199,125,75,0.35)' }} />
        </div>
      </div>
    </div>
  );
}

/* ── Slide definitions ── */
const SLIDES = [
  {
    id: 'brand',
    render: (viewportH, slideY, isActive) => (
      <div className="flex flex-col items-center justify-center h-full px-8 relative">
        {/* Layered mountain landscape with mist */}
        <svg
          className="absolute bottom-0 left-0 w-full h-[30%] pointer-events-none"
          viewBox="0 0 1440 280"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="mtnBack" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4b883" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#c4a265" stopOpacity="0.08" />
            </linearGradient>
            <linearGradient id="mtnMid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4b883" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#c4a265" stopOpacity="0.14" />
            </linearGradient>
            <linearGradient id="mtnFront" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b8955a" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#a07840" stopOpacity="0.22" />
            </linearGradient>
            <filter id="mist">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>
          <path d={MOUNTAIN_BACK} fill="url(#mtnBack)" />
          <ellipse cx="300" cy="160" rx="160" ry="18" fill="#d4b883" opacity="0.08" filter="url(#mist)" />
          <ellipse cx="1140" cy="160" rx="160" ry="18" fill="#d4b883" opacity="0.08" filter="url(#mist)" />
          <path d={MOUNTAIN_MID} fill="url(#mtnMid)" />
          <path d={MOUNTAIN_MID} fill="none" stroke="#c4a265" strokeOpacity="0.2" strokeWidth="0.5" />
          <ellipse cx="420" cy="190" rx="180" ry="16" fill="#c4a265" opacity="0.07" filter="url(#mist)" />
          <ellipse cx="1020" cy="190" rx="180" ry="16" fill="#c4a265" opacity="0.07" filter="url(#mist)" />
          <path d={MOUNTAIN_FRONT} fill="url(#mtnFront)" />
          <path d={MOUNTAIN_FRONT} fill="none" stroke="#a07840" strokeOpacity="0.25" strokeWidth="0.6" />
          <path d="M0,274 Q20,270 40,274 Q60,270 80,274 Q100,270 120,274 Q140,270 160,274 Q180,270 200,274 Q220,270 240,274 Q260,270 280,274 Q300,270 320,274 Q340,270 360,274 Q380,270 400,274 Q420,270 440,274 Q460,270 480,274 Q500,270 520,274 Q540,270 560,274 Q580,270 600,274 Q620,270 640,274 Q660,270 680,274 Q700,270 720,274 Q740,270 760,274 Q780,270 800,274 Q820,270 840,274 Q860,270 880,274 Q900,270 920,274 Q940,270 960,274 Q980,270 1000,274 Q1020,270 1040,274 Q1060,270 1080,274 Q1100,270 1120,274 Q1140,270 1160,274 Q1180,270 1200,274 Q1220,270 1240,274 Q1260,270 1280,274 Q1300,270 1320,274 Q1340,270 1360,274 Q1380,270 1400,274 Q1420,270 1440,274" fill="none" stroke="#b8955a" strokeOpacity="0.15" strokeWidth="0.8" />
        </svg>

        <WarmParticles isActive={isActive} />

        <motion.div
          className="absolute w-64 h-64 rounded-full bg-accent/8 blur-3xl"
          animate={isActive ? { scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] } : {}}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />

        <motion.div style={slideY ? { y: useTransform(slideY, [0, viewportH], [0, -30]) } : {}}>
          <LogoText />
        </motion.div>

        <StaggerText
          text="留下你的轨迹"
          className="font-sans text-sm text-muted mt-8 tracking-[0.08em]"
          baseDelay={0.6} animate={isActive} useBloom
        />

        <motion.p
          initial={{ opacity: 0, filter: 'blur(3px)' }}
          animate={isActive ? { opacity: 1, filter: 'blur(0px)' } : {}}
          transition={{ delay: 1.8, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="font-serif text-xs text-muted/50 italic mt-3"
        >
          Leave Your Trace
        </motion.p>

        <motion.div
          className="mt-10"
          animate={isActive ? { y: [0, -6, 0] } : {}}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 2.2 }}
        >
          <div className="w-px h-12 bg-border/60 mx-auto" />
        </motion.div>
      </div>
    ),
  },
  {
    id: 'discover',
    render: (_vph, _sy, isActive) => React.createElement(DiscoverSlide, { isActive }),
  },
  {
    id: 'record',
    render: (_vph, _sy, isActive) => React.createElement(RecordSlide, { isActive }),
  },
  {
    id: 'plan',
    render: (_vph, _sy, isActive) => React.createElement(PlanSlide, { isActive }),
  },
];

/* ── Warm floating particles ── */
function WarmParticles({ isActive }) {
  const pts = [
    { left: '18%', top: '35%', size: 6, delay: 0, dur: 5 },
    { left: '72%', top: '28%', size: 4, delay: 1.2, dur: 6 },
    { left: '45%', top: '55%', size: 5, delay: 2.4, dur: 5.5 },
    { left: '85%', top: '60%', size: 3, delay: 0.6, dur: 7 },
  ];
  return (
    <>
      {pts.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: p.left, top: p.top, width: p.size, height: p.size,
            background: 'radial-gradient(circle, rgba(199,125,75,0.5) 0%, transparent 70%)',
          }}
          animate={isActive ? {
            y: [0, -24, 0], x: [0, i % 2 === 0 ? 12 : -12, 0],
            opacity: [0.15, 0.45, 0.15], scale: [1, 1.5, 1],
          } : {}}
          transition={{ duration: p.dur, repeat: Infinity, ease: 'easeInOut', delay: p.delay }}
        />
      ))}
    </>
  );
}

export default function LoadingPage({ onAutoEnter, onGoLogin }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [dimensions, setDimensions] = useState({ h: typeof window !== 'undefined' ? window.innerHeight : 800 });
  const containerRef = useRef(null);
  const wheelAccRef = useRef(0);
  const wheelCooldownRef = useRef(false);
  const hasCalledEnter = useRef(false);

  const viewportH = dimensions.h;
  const dragY = useMotionValue(0);
  const totalSlides = SLIDES.length;

  useEffect(() => {
    const t = setTimeout(() => {
      if (!hasCalledEnter.current && onAutoEnter) { hasCalledEnter.current = true; onAutoEnter(); }
    }, 1800);
    return () => clearTimeout(t);
  }, [onAutoEnter]);

  useEffect(() => {
    const handleResize = () => setDimensions({ h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const snapTo = useCallback((index) => setActiveIndex(index), []);

  const handleDragEnd = useCallback((_, info) => {
    const threshold = 80;
    const { offset, velocity } = info;
    const dir = offset.y > threshold || velocity.y > 500 ? 1 : offset.y < -threshold || velocity.y < -500 ? -1 : 0;
    snapTo(Math.max(0, Math.min(totalSlides - 1, activeIndex + dir)));
  }, [activeIndex, totalSlides, snapTo]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (wheelCooldownRef.current) return;
      wheelAccRef.current += e.deltaY;
      if (Math.abs(wheelAccRef.current) > 50) {
        const dir = wheelAccRef.current > 0 ? 1 : -1;
        wheelAccRef.current = 0;
        wheelCooldownRef.current = true;
        setTimeout(() => { wheelCooldownRef.current = false; }, 600);
        snapTo(Math.max(0, Math.min(totalSlides - 1, activeIndex + dir)));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: true });
    return () => el.removeEventListener('wheel', onWheel);
  }, [activeIndex, totalSlides, snapTo]);

  return (
    <div ref={containerRef} className="min-h-screen bg-surface relative overflow-hidden select-none">
      <button onClick={onGoLogin}
        className="fixed top-6 right-6 z-50 text-sm text-muted hover:text-heading transition-colors duration-300 font-sans">
        登录
      </button>

      <motion.div
        className="absolute inset-0"
        drag="y"
        dragConstraints={{ top: -((totalSlides - 1) * viewportH), bottom: 0 }}
        dragElastic={{ top: 0.15, bottom: 0.05 }}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        animate={{ y: -activeIndex * viewportH }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        style={{ y: dragY }}
      >
        {SLIDES.map((slide, i) => (
          <div key={slide.id} className="relative" style={{ height: viewportH }}>
            {slide.render(viewportH, dragY, i === activeIndex)}
          </div>
        ))}
      </motion.div>

      <motion.div
        className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
      >
        <div className="flex items-center gap-2.5">
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => snapTo(i)}
              className="relative w-1.5 h-1.5 rounded-full transition-colors duration-300"
              style={{ background: i === activeIndex ? 'var(--color-accent, #c77d4b)' : 'var(--color-border, #e8e0d5)' }}
              aria-label={'Slide ' + (i + 1)}>
              {i === activeIndex && (
                <motion.div layoutId="slide-dot" className="absolute inset-0 rounded-full bg-accent"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
              )}
            </button>
          ))}
        </div>
        <div className="w-px h-8 bg-border" />
        <motion.div className="w-1.5 h-1.5 rounded-full bg-accent"
          animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.3, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} />
      </motion.div>
    </div>
  );
}
