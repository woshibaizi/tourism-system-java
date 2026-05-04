import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpRight,
  BookOpenText,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  Download,
  FolderKanban,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Moon,
  PauseCircle,
  Settings2,
  Sparkles,
  SunMedium,
  TriangleAlert,
  UserCircle2,
} from 'lucide-react';
import { useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useShellStatus } from '../../app/shell-status';
import { useUserSession } from '../../app/user-session';

interface AppShellProps extends PropsWithChildren {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

interface NavigationItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  match: (pathname: string) => boolean;
}

const SIDEBAR_HIDDEN_STORAGE_KEY = 'systemcraft-sidebar-hidden';
const TOOLBAR_HIDDEN_STORAGE_KEY = 'systemcraft-toolbar-hidden';

const navigation: NavigationItem[] = [
  {
    to: '/',
    label: '工作区首页',
    icon: LayoutDashboard,
    match: (pathname) => pathname === '/',
  },
  {
    to: '/projects',
    label: '项目管理',
    icon: FolderKanban,
    match: (pathname) =>
      pathname.startsWith('/projects') ||
      pathname.startsWith('/workbench/') ||
      pathname.startsWith('/showcase/'),
  },
  {
    to: '/settings',
    label: '账号设置',
    icon: Settings2,
    match: (pathname) => pathname.startsWith('/settings'),
  },
  {
    to: '/guide',
    label: '项目介绍',
    icon: Compass,
    match: (pathname) => pathname.startsWith('/guide'),
  },
  {
    to: '/learn',
    label: '学习中心',
    icon: BookOpenText,
    match: (pathname) => pathname.startsWith('/learn'),
  },
  {
    to: '/export',
    label: '文档导出',
    icon: Download,
    match: (pathname) => pathname.startsWith('/export'),
  },
];

export function AppShell({ children, theme, onToggleTheme }: AppShellProps) {
  const location = useLocation();
  const { status } = useShellStatus();
  const { user, logoutUser } = useUserSession();
  const [isSidebarHidden, setIsSidebarHidden] = useState(
    () => window.localStorage.getItem(SIDEBAR_HIDDEN_STORAGE_KEY) === '1',
  );
  const [isToolbarHidden, setIsToolbarHidden] = useState(
    () => window.localStorage.getItem(TOOLBAR_HIDDEN_STORAGE_KEY) === '1',
  );

  const currentPage = useMemo(
    () =>
      location.pathname.startsWith('/showcase/')
        ? {
            to: '/projects',
            label: '成果展示',
            icon: Sparkles,
            match: () => true,
          }
        : navigation.find((item) => item.match(location.pathname)) ?? navigation[0],
    [location.pathname],
  );
  const CurrentPageIcon = currentPage.icon;

  const statusToneClasses =
    status?.tone === 'active'
      ? 'border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
      : status?.tone === 'paused'
        ? 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : status?.tone === 'success'
          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : status?.tone === 'error'
            ? 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300'
            : 'border-slate-200/80 bg-white/80 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300';

  const StatusIcon =
    status?.tone === 'active'
      ? LoaderCircle
      : status?.tone === 'paused'
        ? PauseCircle
        : status?.tone === 'success'
          ? CheckCircle2
          : status?.tone === 'error'
            ? TriangleAlert
            : Sparkles;

  const utilityButtonClassName =
    'inline-flex h-10 items-center gap-2 rounded-[16px] border border-white/40 bg-white/85 px-3 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-slate-950/75 dark:text-slate-100 dark:hover:border-white/20';
  const edgeToggleButtonClassName =
    'inline-flex h-10 w-10 items-center justify-center border border-white/40 bg-white/92 text-slate-600 shadow-[0_12px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl transition hover:text-slate-950 dark:border-white/10 dark:bg-slate-950/88 dark:text-slate-300 dark:hover:text-white';

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_HIDDEN_STORAGE_KEY, isSidebarHidden ? '1' : '0');
  }, [isSidebarHidden]);

  useEffect(() => {
    window.localStorage.setItem(TOOLBAR_HIDDEN_STORAGE_KEY, isToolbarHidden ? '1' : '0');
  }, [isToolbarHidden]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [location.pathname]);

  const statusBlock = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            当前项目
          </div>
          <div className="mt-1 flex items-center gap-2">
            <StatusIcon
              className={`h-4 w-4 shrink-0 ${status?.tone === 'active' ? 'animate-spin' : ''}`}
            />
            <span className="truncate text-sm font-semibold text-slate-950 dark:text-white">
              {status?.label ?? '系统已就绪'}
            </span>
          </div>
        </div>

        {typeof status?.progress === 'number' ? (
          <span className="shrink-0 rounded-full bg-slate-950/5 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200">
            {status.progress}%
          </span>
        ) : null}
      </div>

      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
        {status?.detail ?? '输入一句需求，系统会自动组织多 Agent 协作流程。'}
      </p>

      {status?.href && status.href !== location.pathname ? (
        <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-950 dark:text-white">
          查看工作台
          <ArrowUpRight className="h-3.5 w-3.5" />
        </div>
      ) : null}
    </>
  );

  return (
    <div className="min-h-screen bg-aurora text-slate-950 transition-colors dark:bg-aurora-dark dark:text-white">
      {!isToolbarHidden ? (
        <header className="top-toolbar">
          <div className="mx-auto max-w-[1500px] px-4 pt-3 sm:px-6 lg:px-8">
            <div className="glass-panel-strong relative overflow-visible rounded-[28px] border-white/50 px-4 py-3 shadow-[0_16px_40px_rgba(15,23,42,0.08)] sm:px-5 dark:border-white/10">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-20 rounded-t-[28px] bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_48%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.12),transparent_38%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_48%),radial-gradient(circle_at_top_right,rgba(45,212,191,0.12),transparent_38%)]" />

              <div className="relative flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-slate-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.14)] dark:bg-white dark:text-slate-950">
                    <Sparkles className="h-4.5 w-4.5" />
                  </div>

                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                      SystemCraft Studio
                    </div>
                    <h1 className="mt-1 truncate text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
                      软件工程 AI 导师平台
                    </h1>
                  </div>
                </div>

                <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
                  <div className="hidden items-center gap-3 rounded-[20px] bg-slate-950 px-4 py-3 text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)] md:flex dark:bg-white dark:text-slate-950">
                    <CurrentPageIcon className="h-4 w-4" />
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/65 dark:text-slate-500">
                        当前页面
                      </div>
                      <div className="mt-0.5 text-sm font-semibold">{currentPage.label}</div>
                    </div>
                  </div>

                  {status?.href && status.href !== location.pathname ? (
                    <Link
                      to={status.href}
                      className={`hidden w-[300px] rounded-[22px] border px-4 py-3 transition hover:-translate-y-0.5 xl:block ${statusToneClasses}`}
                    >
                      {statusBlock}
                    </Link>
                  ) : (
                    <div
                      className={`hidden w-[300px] rounded-[22px] border px-4 py-3 xl:block ${statusToneClasses}`}
                    >
                      {statusBlock}
                    </div>
                  )}

                  <div className="hidden items-center gap-3 rounded-[20px] border border-white/40 bg-white/85 px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)] lg:flex dark:border-white/10 dark:bg-slate-950/75">
                    <UserCircle2 className="h-8 w-8 text-slate-500 dark:text-slate-300" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {user?.display_name ?? 'Workspace'}
                      </div>
                      <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                        @{user?.username} · {user?.project_count ?? 0} projects
                      </div>
                    </div>
                    <Link to="/settings" className={utilityButtonClassName}>
                      <Settings2 className="h-4 w-4" />
                      <span>设置</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => void logoutUser()}
                      className={utilityButtonClassName}
                    >
                      <LogOut className="h-4 w-4" />
                      <span>退出</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={onToggleTheme}
                    className={utilityButtonClassName}
                    aria-label="切换主题"
                  >
                    {theme === 'dark' ? (
                      <SunMedium className="h-4.5 w-4.5" />
                    ) : (
                      <Moon className="h-4.5 w-4.5" />
                    )}
                    <span className="hidden sm:block">{theme === 'dark' ? '浅色' : '深色'}</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsToolbarHidden(true)}
                className={`${edgeToggleButtonClassName} absolute right-6 top-full -mt-2 rounded-b-[18px] border-t-0`}
                aria-label="隐藏横栏"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>
      ) : null}

      <div className="mx-auto flex min-h-[calc(100vh-1rem)] max-w-[1500px] gap-5 px-4 pb-6 pt-3 sm:px-6 lg:px-8">
        {!isSidebarHidden ? (
          <aside className="glass-panel relative hidden w-[244px] shrink-0 rounded-[26px] p-4 lg:flex lg:flex-col">
            <div className="rounded-[22px] border border-white/10 bg-white/60 p-4 pr-6 shadow-sm dark:bg-white/5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-white dark:text-slate-950">
                  <Sparkles className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Navigation
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    在首页、项目管理、学习与导出之间切换。
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsSidebarHidden(true)}
              className={`${edgeToggleButtonClassName} absolute left-full top-8 -ml-2 rounded-r-[18px] border-l-0`}
              aria-label="隐藏侧栏"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <nav className="mt-6 space-y-1.5">
              {navigation.map(({ to, label, icon: Icon, match }) => {
                const isActive = match(location.pathname);

                return (
                  <NavLink
                    key={to}
                    to={to}
                    className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-slate-950 text-white shadow-lg dark:bg-white dark:text-slate-950'
                        : 'text-slate-600 hover:bg-white/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/8 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </NavLink>
                );
              })}
            </nav>

            <div className="mt-auto rounded-[22px] border border-white/10 bg-slate-950/95 p-4 text-white dark:bg-white dark:text-slate-950">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60 dark:text-slate-500">
                Account
              </div>
              <p className="mt-3 text-sm leading-6 text-white/84 dark:text-slate-600">
                当前登录账号为 {user?.display_name ?? 'Workspace'}。项目、学习记录和导出内容都会按账号隔离保存。
              </p>
              <Link
                to="/settings"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white transition hover:opacity-80 dark:text-slate-950"
              >
                打开账号设置
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </aside>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <AnimatePresence mode="wait">
            <motion.main
              key={location.pathname}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="flex-1 pb-6"
            >
              {children}
            </motion.main>
          </AnimatePresence>
        </div>
      </div>

      {isToolbarHidden ? (
        <div className="fixed left-1/2 top-0 z-30 -translate-x-1/2">
          <button
            type="button"
            onClick={() => setIsToolbarHidden(false)}
            className={`${edgeToggleButtonClassName} rounded-b-[18px] border-t-0`}
            aria-label="显示横栏"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {isSidebarHidden ? (
        <div className="fixed left-0 top-1/2 z-30 hidden -translate-y-1/2 lg:block">
          <button
            type="button"
            onClick={() => setIsSidebarHidden(false)}
            className={`${edgeToggleButtonClassName} rounded-r-[18px] border-l-0`}
            aria-label="显示侧栏"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
