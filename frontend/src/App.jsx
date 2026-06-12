import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';
import { useAuth } from './hooks/useAuth';
import { useToast } from './components/ui/Toast';
import LeftSidebar from './components/Shell/LeftSidebar';
import TopBar from './components/Shell/TopBar';
import MobileMenuOverlay from './components/Shell/MobileMenuOverlay';

const HomePage = lazy(() => import('./pages/HomePage'));
const LoadingPage = lazy(() => import('./pages/LoadingPage'));
const LocationSearchPage = lazy(() => import('./pages/LocationSearchPage'));
const PlaceDetailPage = lazy(() => import('./pages/PlaceDetailPage'));
const DiariesPage = lazy(() => import('./pages/DiariesPage'));
const DiaryDetailPage = lazy(() => import('./pages/DiaryDetailPage'));
const StatsPage = lazy(() => import('./pages/StatsPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DiaryManagementPage = lazy(() => import('./pages/DiaryManagementPage'));
const NavigationPage = lazy(() => import('./pages/NavigationPage'));
const ConcurrencyTestPage = lazy(() => import('./pages/ConcurrencyTestPage'));
const PersonalTravelAssistantPage = lazy(() => import('./pages/PersonalTravelAssistantPage'));
const MixedSearchPage = lazy(() => import('./pages/MixedSearchPage'));
const MyDiariesPage = lazy(() => import('./pages/MyDiariesPage'));
const SurroundingPage = lazy(() => import('./pages/SurroundingPage'));
const SurroundingDetailPage = lazy(() => import('./pages/SurroundingDetailPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

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
              <Suspense fallback={<div className="flex items-center justify-center py-24"><div className="w-6 h-6 border-2 border-border border-t-accent rounded-full animate-spin" /></div>}>
                <Routes location={location}>
                  <Route path="/" element={<HomePage />} />
                <Route path="/location-search" element={<LocationSearchPage />} />
                <Route path="/places" element={<Navigate to="/location-search" replace />} />
                <Route path="/places/:placeId" element={<PlaceDetailPage />} />
                <Route path="/diaries" element={<DiariesPage />} />
                <Route path="/diaries/:diaryId" element={<DiaryDetailPage />} />
                <Route path="/navigation" element={<NavigationPage />} />
                <Route path="/route-planning" element={<Navigate to="/navigation?tab=external" replace />} />
                <Route path="/travel-assistant" element={<PersonalTravelAssistantPage />} />
                <Route path="/facility-query" element={<Navigate to="/location-search" replace />} />
                <Route path="/stats" element={<StatsPage />} />
                <Route path="/diary-management" element={<DiaryManagementPage />} />

                <Route path="/campus-navigation" element={<Navigate to="/navigation?tab=campus" replace />} />
                <Route path="/multi-point-navigation" element={<Navigate to="/navigation?tab=campus&mode=multi" replace />} />
                <Route path="/indoor-navigation" element={<Navigate to="/navigation?tab=campus&sub=indoor" replace />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/search" element={<MixedSearchPage />} />
                <Route path="/my-diaries" element={<MyDiariesPage />} />
                <Route path="/surrounding/:placeId" element={<SurroundingPage />} />
                <Route path="/surrounding/:placeId/:id" element={<SurroundingDetailPage />} />
                <Route path="/concurrency-test" element={<ConcurrencyTestPage />} />
              </Routes>
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

    </div>
  );
}

export default App;
