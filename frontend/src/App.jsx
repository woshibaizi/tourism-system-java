import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';
import { useAuth } from './hooks/useAuth';
import { useToast } from './components/ui/Toast';
import LeftSidebar from './components/Shell/LeftSidebar';
import TopBar from './components/Shell/TopBar';
import MobileMenuOverlay from './components/Shell/MobileMenuOverlay';

import HomePage from './pages/HomePage';
import LoadingPage from './pages/LoadingPage';
import LocationSearchPage from './pages/LocationSearchPage';
import PlaceDetailPage from './pages/PlaceDetailPage';
import DiariesPage from './pages/DiariesPage';
import DiaryDetailPage from './pages/DiaryDetailPage';
import RoutePage from './pages/RoutePage';
import StatsPage from './pages/StatsPage';
import LoginPage from './pages/LoginPage';
import DiaryManagementPage from './pages/DiaryManagementPage';
import CampusNavigationPage from './pages/CampusNavigationPage';
import ConcurrencyTestPage from './pages/ConcurrencyTestPage';
import PersonalTravelAssistantPage from './pages/PersonalTravelAssistantPage';

const PAGE_TRANSITION = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

function App() {
  const { user, isLoggedIn, loading, login, logout, tryAutoLogin } = useAuth();
  const { showToast } = useToast();
  const [appPhase, setAppPhase] = useState('loading'); // 'loading' | 'login' | 'app'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && isLoggedIn) {
      setAppPhase('app');
    }
  }, [loading, isLoggedIn]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (appPhase === 'loading') {
    return (
      <LoadingPage
        onAutoEnter={() => {
          if (tryAutoLogin()) {
            setTimeout(() => setAppPhase('app'), 300);
          }
        }}
        onGoLogin={() => setAppPhase('login')}
      />
    );
  }

  if (!isLoggedIn || appPhase === 'login') {
    return (
      <LoginPage
        onLoginSuccess={(userData) => {
          login(userData);
          setAppPhase('app');
          navigate('/');
          showToast('success', '登录成功');
        }}
        onBack={() => setAppPhase('loading')}
      />
    );
  }

  const handleLogout = () => {
    logout();
    showToast('success', '已退出登录');
  };

  return (
    <div className="flex min-h-screen bg-surface">
      <LeftSidebar
          currentUser={user}
          onLogout={handleLogout}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
          className="hidden md:flex"
        />

      <AnimatePresence>
        {mobileMenuOpen && (
          <MobileMenuOverlay
            currentUser={user}
            onLogout={() => { handleLogout(); setMobileMenuOpen(false); }}
            onClose={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-h-screen">
        <TopBar onMenuClick={() => setMobileMenuOpen(true)} className="md:hidden" />

        <main className={clsx(
            'flex-1 pt-[60px] md:pt-0 transition-[margin] duration-300 ease-out',
            sidebarCollapsed ? 'md:ml-16' : 'md:ml-56'
          )}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={PAGE_TRANSITION.initial}
              animate={PAGE_TRANSITION.animate}
              exit={PAGE_TRANSITION.exit}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <Routes location={location}>
                <Route path="/" element={<HomePage />} />
                <Route path="/location-search" element={<LocationSearchPage />} />
                <Route path="/places" element={<Navigate to="/location-search" replace />} />
                <Route path="/places/:placeId" element={<PlaceDetailPage />} />
                <Route path="/diaries" element={<DiariesPage />} />
                <Route path="/diaries/:diaryId" element={<DiaryDetailPage />} />
                <Route path="/route-planning" element={<RoutePage />} />
                <Route path="/travel-assistant" element={<PersonalTravelAssistantPage />} />
                <Route path="/facility-query" element={<Navigate to="/location-search" replace />} />
                <Route path="/stats" element={<StatsPage />} />
                <Route path="/diary-management" element={<DiaryManagementPage />} />
                <Route path="/food-search" element={<Navigate to="/location-search" replace />} />
                <Route path="/campus-navigation" element={<CampusNavigationPage />} />
                <Route path="/indoor-navigation" element={<Navigate to="/campus-navigation" replace />} />
                <Route path="/profile" element={
                  <div className="max-w-2xl mx-auto px-6 py-16">
                    <div className="border border-border p-8 bg-surface">
                      <h2 className="font-serif text-2xl text-heading mb-6">个人中心</h2>
                      <dl className="space-y-4">
                        <div className="flex gap-4 py-3 border-b border-border">
                          <dt className="font-sans text-xs uppercase tracking-widest text-muted w-24">用户名</dt>
                          <dd className="font-sans text-sm text-body">{user?.username || user?.name || '未命名用户'}</dd>
                        </div>
                        <div className="flex gap-4 py-3 border-b border-border">
                          <dt className="font-sans text-xs uppercase tracking-widest text-muted w-24">兴趣标签</dt>
                          <dd className="font-sans text-sm text-body">
                            {(user?.interests || []).length > 0
                              ? (user.interests || []).map((item) => (
                                  <span key={item} className="inline-block px-3 py-1 mr-2 text-xs bg-accent-soft border border-border">{item}</span>
                                ))
                              : '暂无'}
                          </dd>
                        </div>
                        <div className="flex gap-4 py-3 border-b border-border">
                          <dt className="font-sans text-xs uppercase tracking-widest text-muted w-24">偏好分类</dt>
                          <dd className="font-sans text-sm text-body">
                            {(user?.favoriteCategories || []).length > 0
                              ? (user.favoriteCategories || []).map((item) => (
                                  <span key={item} className="inline-block px-3 py-1 mr-2 text-xs bg-accent-soft border border-border">{item}</span>
                                ))
                              : '暂无'}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                } />
                <Route path="/concurrency-test" element={<ConcurrencyTestPage />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

    </div>
  );
}

export default App;
