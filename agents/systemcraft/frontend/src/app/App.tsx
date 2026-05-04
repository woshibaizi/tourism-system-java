import { Suspense, lazy, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { AuthPage } from '../pages/AuthPage';
import { ShellStatusProvider } from './shell-status';
import { UserSessionProvider, useUserSession } from './user-session';

const THEME_STORAGE_KEY = 'systemcraft-theme';
const HomePage = lazy(async () => ({
  default: (await import('../pages/HomePage')).HomePage,
}));
const GuidePage = lazy(async () => ({
  default: (await import('../pages/GuidePage')).GuidePage,
}));
const WorkbenchPage = lazy(async () => ({
  default: (await import('../pages/WorkbenchPage')).WorkbenchPage,
}));
const LearnPage = lazy(async () => ({
  default: (await import('../pages/LearnPage')).LearnPage,
}));
const ExportPage = lazy(async () => ({
  default: (await import('../pages/ExportPage')).ExportPage,
}));
const ProjectsPage = lazy(async () => ({
  default: (await import('../pages/ProjectsPage')).ProjectsPage,
}));
const SettingsPage = lazy(async () => ({
  default: (await import('../pages/SettingsPage')).SettingsPage,
}));
const ShowcasePage = lazy(async () => ({
  default: (await import('../pages/ShowcasePage')).ShowcasePage,
}));

function AppContent({
  theme,
  onToggleTheme,
}: {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}) {
  const { isAuthenticated, isLoading } = useUserSession();

  if (isLoading) {
    return (
      <div className="glass-panel flex min-h-screen items-center justify-center rounded-none p-8 text-sm text-slate-500 dark:text-slate-400">
        正在初始化系统...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <AppShell theme={theme} onToggleTheme={onToggleTheme}>
      <Suspense
        fallback={
          <div className="glass-panel flex min-h-[320px] items-center justify-center rounded-[32px] p-8 text-sm text-slate-500 dark:text-slate-400">
            页面资源加载中...
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/workbench/:projectId" element={<WorkbenchPage />} />
          <Route path="/showcase/:projectId" element={<ShowcasePage />} />
          <Route path="/learn" element={<LearnPage />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return storedTheme === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <ShellStatusProvider>
      <UserSessionProvider>
        <AppContent
          theme={theme}
          onToggleTheme={() =>
            setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
          }
        />
      </UserSessionProvider>
    </ShellStatusProvider>
  );
}
