# 个性化旅游系统 — 前端重设计实现规格书

> 参考: [Aman.com](https://www.aman.com) 极致留白美学
> 本文档 = 可直接照写的实现规格，不需要再做设计决策

---

## 0. 文件结构总览

重构后的 `frontend/src/` 目录:

```
src/
├── main.jsx                    # 入口: BrowserRouter + App
├── App.jsx                     # 认证守卫 + 布局壳
├── index.css                   # Tailwind 指令 + 全局样式变量 + 字体引入
├── tailwind.config.js          # (Tailwind v3 写法) 或 app.css (v4 @theme)
│
├── components/
│   ├── Shell/
│   │   ├── LeftSidebar.jsx     # 左侧导航菜单 (桌面固定 / 移动滑入)
│   │   ├── TopBar.jsx          # 移动端顶部栏 (含汉堡 + logo占位)
│   │   ├── RightPanel.jsx      # 右侧个人面板 (仅桌面)
│   │   └── MobileMenuOverlay.jsx # 移动端全屏菜单覆盖层
│   │
│   ├── ui/
│   │   ├── LineInput.jsx       # 底部线样式的输入框
│   │   ├── CTAButton.jsx       # 黑底白字直角按钮 / 白底黑字变体
│   │   ├── SectionLabel.jsx    # 分组标签 (12px uppercase)
│   │   ├── ImageCard.jsx       # 通用图片卡片 (图片 + 标题 + 副标题)
│   │   ├── ScrollRow.jsx       # 横向滚动容器 (隐藏滚动条)
│   │   ├── LazyImage.jsx       # 懒加载图片 (blur placeholder)
│   │   ├── Lightbox.jsx        # 全屏灯箱 (图片画廊)
│   │   ├── StarRating.jsx      # 星级评分 (展示 + 可交互)
│   │   ├── EmptyState.jsx      # 空状态占位
│   │   ├── Skeleton.jsx        # 骨架屏加载态
│   │   └── Toast.jsx           # 轻量 toast 通知 (替代 antd message)
│   │
│   ├── Map/
│   │   └── AMapView.jsx        # 高德地图封装 (从 RouteMap.jsx 重构)
│   │
│   └── Chat/
│       ├── ChatBubble.jsx      # 单条消息气泡
│       ├── ChatInput.jsx       # 底部输入区
│       └── TypingIndicator.jsx # 打字动画指示器
│
├── pages/
│   ├── HomePage.jsx
│   ├── LoginPage.jsx
│   ├── LocationSearchPage.jsx
│   ├── PlaceDetailPage.jsx
│   ├── DiariesPage.jsx
│   ├── DiaryDetailPage.jsx
│   ├── DiaryManagementPage.jsx
│   ├── RoutePage.jsx
│   ├── CampusNavigationPage.jsx
│   ├── PersonalTravelAssistantPage.jsx
│   ├── StatsPage.jsx
│   └── ConcurrencyTestPage.jsx
│
├── hooks/
│   ├── useAuth.js              # 认证状态 hook
│   ├── useScrollReveal.js      # 滚动触发动画 hook (useInView 封装)
│   └── useMediaQuery.js        # 响应式断点检测
│
├── services/
│   └── api.js                  # 保留现有 Axios 层，不变
│
└── utils/
    ├── amapLoader.js           # 保留
    ├── location.js             # 保留
    └── constants.js            # 图片占位符 base64、默认配置
```

---

## 1. 技术栈与初始化

### 1.1 安装命令

```bash
cd frontend
npm uninstall antd @ant-design/icons
npm install framer-motion lucide-react clsx
npm install -D tailwindcss @tailwindcss/vite
```

### 1.2 Vite 配置 (`vite.config.js`)

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/agent': { target: 'http://localhost:9000', changeOrigin: true },
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
});
```

### 1.3 全局样式 (`src/index.css`)

```css
@import "tailwindcss";

/* Tailwind v4 自定义主题 */
@theme {
  --font-serif: "Noto Serif SC", Georgia, "Times New Roman", serif;
  --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
  --font-mono: "SF Mono", "Fira Code", "Cascadia Code", monospace;

  --color-accent: #b8945a;
  --color-surface: #fafafa;
  --color-border: #e5e5e5;
  --color-muted: #a3a3a3;
  --color-body: #404040;
  --color-heading: #0a0a0a;
}

/* 全局重置 */
* { box-sizing: border-box; -webkit-font-smoothing: antialiased; }
body { margin: 0; font-family: var(--font-sans); background: #fff; color: var(--color-body); }
h1,h2,h3,h4 { font-family: var(--font-serif); color: var(--color-heading); }

/* 隐藏滚动条但可滚动 */
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
```

---

## 2. 全局布局壳 — `App.jsx`

### 2.1 组件树

```
<BrowserRouter>                          ← main.jsx
  <App>
    ├── 未登录 → <LoginPage />
    └── 已登录 →
        ├── <TopBar />                  ← 仅 md:hidden (移动端/平板)
        ├── <LeftSidebar />             ← 固定左侧, 桌面始终可见
        ├── <main>                      ← 中间内容区, flex-1
        │   └── <AnimatePresence>
        │       └── <motion.div>        ← 路由切换动画
        │           └── <Routes>
        │               ├── / → <HomePage />
        │               ├── /location-search → <LocationSearchPage />
        │               ├── /places/:placeId → <PlaceDetailPage />
        │               ├── /diaries → <DiariesPage />
        │               ├── /diaries/:diaryId → <DiaryDetailPage />
        │               ├── /diary-management → <DiaryManagementPage />
        │               ├── /route-planning → <RoutePage />
        │               ├── /campus-navigation → <CampusNavigationPage />
        │               ├── /travel-assistant → <PersonalTravelAssistantPage />
        │               ├── /stats → <StatsPage />
        │               ├── /profile → <RightPanel /> (内联)
        │               └── /concurrency-test → <ConcurrencyTestPage />
        └── <RightPanel />              ← 仅 xl:block (≥1280px), sticky 右侧
```

### 2.2 App.jsx 实现细节

```jsx
// 状态:
const [user, setUser] = useState(null);        // 从 localStorage 恢复
const [isLoggedIn, setIsLoggedIn] = useState(false);
const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

// 认证逻辑:
// - useEffect 从 localStorage 读取 user/token/isLoggedIn
// - handleLoginSuccess(user) → setUser + setLoggedIn + localStorage
// - handleLogout() → clear state + clear localStorage + message

// 布局结构 (已登录时):
<div className="flex min-h-screen bg-white">
  {/* 桌面端左侧栏 — 始终可见 */}
  <LeftSidebar
    currentUser={user}
    onLogout={handleLogout}
    className="hidden md:flex"
  />

  {/* 移动端菜单覆盖层 */}
  <AnimatePresence>
    {mobileMenuOpen && (
      <MobileMenuOverlay
        currentUser={user}
        onLogout={handleLogout}
        onClose={() => setMobileMenuOpen(false)}
      />
    )}
  </AnimatePresence>

  {/* 右侧主区域 */}
  <div className="flex-1 flex flex-col min-h-screen">
    {/* 移动端顶部栏 */}
    <TopBar
      onMenuClick={() => setMobileMenuOpen(true)}
      className="md:hidden"
    />

    {/* 主内容 — 路由切换带动画 */}
    <main className="flex-1">
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <Routes>
            {/* 所有路由 */}
          </Routes>
        </motion.div>
      </AnimatePresence>
    </main>
  </div>

  {/* 桌面端右侧面板 */}
  <RightPanel
    currentUser={user}
    onLogout={handleLogout}
    className="hidden xl:block"
  />
</div>
```

### 2.3 响应式规则

| 宽度 | Sidebar | TopBar | RightPanel | 内容最大宽 |
|------|---------|--------|-----------|-----------|
| < 768px | 隐藏, 通过 TopBar 汉堡菜单滑入 | 显示 | 隐藏 | 100% |
| 768-1279px | 显示, 折叠为图标模式 (64px) | 隐藏 | 隐藏 | 100% |
| ≥ 1280px | 显示, 完整模式 (240px) | 隐藏 | 显示 (280px) | max-w-5xl mx-auto |

---

## 3. 壳组件详细规格

### 3.1 LeftSidebar.jsx

**文件**: `src/components/Shell/LeftSidebar.jsx`
**Props**: `{ currentUser, onLogout, className }`

**内部状态**:
- 无内部状态。高亮由 `useLocation().pathname` 驱动。

**菜单数据结构** (常量, 写在组件文件内):

```js
const MENU_GROUPS = [
  {
    label: '探索',
    items: [
      { label: '地点搜索', path: '/location-search',    icon: Search },
      { label: '高德导航', path: '/route-planning',      icon: MapPin },
      { label: '校内导航', path: '/campus-navigation',   icon: Building },
    ],
  },
  {
    label: '记录',
    items: [
      { label: '旅游日记', path: '/diaries',             icon: BookOpen },
      { label: '日记管理', path: '/diary-management',     icon: FileText },
    ],
  },
  {
    label: '智能',
    items: [
      { label: 'AI 旅游助手', path: '/travel-assistant', icon: MessageCircle },
    ],
  },
  {
    label: '更多',
    items: [
      { label: '统计分析', path: '/stats',               icon: BarChart3 },
    ],
  },
];
```

**JSX 结构**:

```jsx
<aside className={clsx(
  'w-[240px] h-screen flex flex-col bg-white border-r border-[#f0f0f0]',
  'md:w-[64px] md:items-center xl:w-[240px] xl:items-stretch', // 响应式折叠
  className
)}>
  {/* ========== LOGO 占位区 ========== */}
  <div className="h-20 flex items-center px-6 md:px-0 md:justify-center xl:px-6 xl:justify-start">
    {/* 用户自行替换为 <img> */}
    <div className="h-10 w-full md:w-8 xl:w-full bg-[#f5f5f5] flex items-center justify-center">
      <span className="text-xs text-gray-400 md:hidden xl:inline">LOGO</span>
      <span className="text-xs text-gray-400 hidden md:inline xl:hidden">L</span>
    </div>
  </div>

  {/* ========== 菜单分组 ========== */}
  <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-8">
    {MENU_GROUPS.map(group => (
      <div key={group.label}>
        {/* 分组标签 — 平板折叠时隐藏 */}
        <p className="px-3 mb-2 text-[11px] uppercase tracking-[0.2em] text-gray-400 md:hidden xl:block">
          {group.label}
        </p>
        <ul className="space-y-1">
          {group.items.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 text-sm transition-colors duration-150',
                    'md:justify-center md:px-0 xl:justify-start xl:px-3',
                    'relative group',
                    isActive
                      ? 'text-black font-medium'
                      : 'text-gray-400 hover:text-black'
                  )}
                >
                  {/* 左侧激活指示线 */}
                  {isActive && (
                    <motion.div
                      layoutId="active-indicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-black"
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    />
                  )}
                  <item.icon size={20} />
                  <span className="md:hidden xl:inline">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>
    ))}
  </nav>

  {/* ========== 底部用户信息 ========== */}
  <div className="border-t border-[#f0f0f0] p-4">
    <div className="flex items-center gap-3 md:justify-center xl:justify-start">
      <div className="w-8 h-8 rounded-full bg-[#e5e5e5] flex items-center justify-center text-xs text-gray-500 overflow-hidden">
        {currentUser?.avatar
          ? <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
          : <User size={16} />
        }
      </div>
      <div className="md:hidden xl:block">
        <p className="text-sm font-medium text-black truncate max-w-[140px]">
          {currentUser?.username || '用户'}
        </p>
        <button onClick={onLogout} className="text-xs text-gray-400 hover:text-black transition-colors">
          退出登录
        </button>
      </div>
    </div>
  </div>
</aside>
```

**Framer Motion**: 仅 `layoutId="active-indicator"` 用于激活指示线的平滑移动。

**边缘情况**:
- 菜单项点击后移动端菜单自动关闭 (通过 MobileMenuOverlay 的 onClose)
- 图标使用 Lucide React，尺寸统一 20px
- 平板折叠模式: 仅显示图标, tooltip 暂不加 (保持简洁)

---

### 3.2 TopBar.jsx

**文件**: `src/components/Shell/TopBar.jsx`
**Props**: `{ onMenuClick, className }`

```jsx
<header className={clsx(
  'h-16 flex items-center justify-between px-4 bg-white border-b border-[#f0f0f0]',
  'sticky top-0 z-30',
  className
)}>
  {/* 左侧汉堡按钮 */}
  <button
    onClick={onMenuClick}
    className="p-2 -ml-2 text-gray-600 hover:text-black transition-colors"
    aria-label="打开菜单"
  >
    <Menu size={22} />
  </button>

  {/* 中间 LOGO 占位 — 用户自行替换 */}
  <div className="h-8 w-24 bg-[#f5f5f5] flex items-center justify-center">
    <span className="text-[10px] text-gray-400">LOGO</span>
  </div>

  {/* 右侧占位 (对称) */}
  <div className="w-10" />
</header>
```

**边缘情况**:
- onClick 触发 App 中 setMobileMenuOpen(true)
- logo 区域大小保持 `h-8 w-24`，用户替换为 img 时直接改内容

---

### 3.3 MobileMenuOverlay.jsx

**文件**: `src/components/Shell/MobileMenuOverlay.jsx`
**Props**: `{ currentUser, onLogout, onClose }`

```jsx
<>
  {/* 背景遮罩 */}
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.25 }}
    className="fixed inset-0 bg-black/30 z-40 md:hidden"
    onClick={onClose}
  />

  {/* 菜单面板 — 从左侧滑入 */}
  <motion.aside
    initial={{ x: '-100%' }}
    animate={{ x: 0 }}
    exit={{ x: '-100%' }}
    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    className="fixed top-0 left-0 bottom-0 w-[280px] bg-white z-50 md:hidden flex flex-col shadow-xl"
  >
    {/* 顶部: 关闭按钮 + logo 占位 */}
    <div className="h-16 flex items-center justify-between px-4 border-b border-[#f0f0f0]">
      <div className="h-8 w-24 bg-[#f5f5f5] flex items-center justify-center">
        <span className="text-[10px] text-gray-400">LOGO</span>
      </div>
      <button onClick={onClose} className="p-2 text-gray-600 hover:text-black">
        <X size={22} />
      </button>
    </div>

    {/* 菜单内容 — 与 LeftSidebar 相同, 但始终全宽显示 */}
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-8">
      {/* 同 LeftSidebar 的 MENU_GROUPS 渲染 */}
      {MENU_GROUPS.map(group => (
        <div key={group.label}>
          <p className="px-3 mb-2 text-[11px] uppercase tracking-[0.2em] text-gray-400">
            {group.label}
          </p>
          <ul className="space-y-1">
            {group.items.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    onClick={onClose}  // 点击后关闭菜单
                    className={clsx(
                      'flex items-center gap-3 px-3 py-3 text-sm transition-colors',
                      isActive ? 'text-black font-medium bg-[#f5f5f5]' : 'text-gray-500 hover:text-black hover:bg-[#fafafa]'
                    )}
                  >
                    <item.icon size={20} />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>

    {/* 底部用户信息 */}
    <div className="border-t border-[#f0f0f0] p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#e5e5e5] flex items-center justify-center">
          <User size={20} className="text-gray-500" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{currentUser?.username || '用户'}</p>
        </div>
        <button onClick={onLogout} className="text-xs text-gray-400 hover:text-red-500">
          退出
        </button>
      </div>
    </div>
  </motion.aside>
</>
```

---

### 3.4 RightPanel.jsx

**文件**: `src/components/Shell/RightPanel.jsx`
**Props**: `{ currentUser, onLogout, className }`

```jsx
<aside className={clsx('w-[280px] h-screen sticky top-0 overflow-y-auto border-l border-[#f0f0f0] p-6', className)}>
  {/* 用户头像 */}
  <div className="flex flex-col items-center mb-6">
    <div className="w-16 h-16 rounded-full bg-[#e5e5e5] mb-3 overflow-hidden">
      {currentUser?.avatar
        ? <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center"><User size={28} className="text-gray-400" /></div>
      }
    </div>
    <p className="text-sm font-medium text-black">{currentUser?.username || '用户'}</p>
    <p className="text-xs text-gray-400 mt-0.5">@{currentUser?.username || 'user'}</p>
  </div>

  {/* 兴趣标签 */}
  <Section label="兴趣标签">
    <div className="flex flex-wrap gap-2">
      {(currentUser?.interests?.length > 0
        ? currentUser.interests
        : ['旅行', '美食', '摄影']
      ).map(tag => (
        <span key={tag} className="text-xs px-3 py-1 rounded-full border border-[#e5e5e5] text-gray-600">
          {tag}
        </span>
      ))}
    </div>
  </Section>

  {/* 最近浏览 — 从 localStorage 读取 */}
  <Section label="最近浏览">
    {recentViews.length === 0 ? (
      <p className="text-xs text-gray-400">暂无浏览记录</p>
    ) : (
      <ul className="space-y-2">
        {recentViews.slice(0, 5).map(item => (
          <li key={item.id}>
            <NavLink to={item.path} className="text-sm text-gray-600 hover:text-black transition-colors truncate block">
              {item.name}
            </NavLink>
          </li>
        ))}
      </ul>
    )}
  </Section>

  {/* 快捷操作 */}
  <Section label="快捷操作">
    <div className="space-y-2">
      <button onClick={() => navigate('/diary-management?action=new')}
        className="w-full text-left text-sm px-4 py-2 border border-[#e5e5e5] hover:border-black hover:text-black transition-colors">
        写日记
      </button>
      <button onClick={() => navigate('/route-planning')}
        className="w-full text-left text-sm px-4 py-2 border border-[#e5e5e5] hover:border-black hover:text-black transition-colors">
        查路线
      </button>
    </div>
  </Section>

  {/* 退出 */}
  <div className="mt-8 pt-6 border-t border-[#f0f0f0]">
    <button onClick={onLogout}
      className="text-xs text-gray-400 hover:text-red-500 transition-colors">
      退出登录
    </button>
  </div>
</aside>
```

**Section 子组件** (内联):

```jsx
function Section({ label, children }) {
  return (
    <div className="mb-8">
      <p className="text-[11px] uppercase tracking-[0.15em] text-gray-400 mb-3">{label}</p>
      {children}
    </div>
  );
}
```

**最近浏览数据**:
```jsx
// 从 localStorage key "recentViews" 读取
// 格式: [{ id, name, path, timestamp }]
// 各详情页在 useEffect 中写入
const recentViews = JSON.parse(localStorage.getItem('recentViews') || '[]');
```

---

## 4. 通用 UI 组件详细规格

### 4.1 LineInput.jsx — 底部线输入框

```jsx
// Props:
//   value: string
//   onChange: (e) => void
//   placeholder?: string
//   icon?: LucideIcon        // 前置图标, 可选
//   className?: string
//   onFocus?: () => void
//   onBlur?: () => void
//   autoFocus?: boolean

<div className={clsx('relative', className)}>
  {icon && <icon size={18} className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400" />}
  <input
    type="text"
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    autoFocus={autoFocus}
    onFocus={onFocus}
    onBlur={onBlur}
    className={clsx(
      'w-full py-3 text-base text-black bg-transparent',
      'border-0 border-b-2 border-[#e5e5e5]',
      'focus:outline-none focus:border-black',
      'placeholder:text-gray-400 placeholder:text-base',
      'transition-colors duration-200',
      icon && 'pl-8'
    )}
  />
</div>
```

### 4.2 CTAButton.jsx — 按钮

```jsx
// Props:
//   children: ReactNode
//   variant: 'primary' | 'secondary' | 'ghost'
//     primary = 黑底白字
//     secondary = 白底黑字 + 黑边框
//     ghost = 纯文字, 无边框
//   size: 'sm' | 'md' | 'lg'
//   onClick?: () => void
//   className?: string
//   disabled?: boolean
//   type?: 'button' | 'submit'

const base = 'inline-flex items-center justify-center font-sans font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed';

const sizeMap = {
  sm: 'px-4 py-1.5 text-xs',
  md: 'px-8 py-2.5 text-sm',
  lg: 'px-12 py-3.5 text-base',
};

const variantMap = {
  primary: 'bg-black text-white hover:bg-gray-800 active:scale-[0.98]',
  secondary: 'bg-white text-black border border-black hover:bg-gray-50 active:scale-[0.98]',
  ghost: 'bg-transparent text-black hover:text-gray-600',
};

<button
  type={type}
  onClick={onClick}
  disabled={disabled}
  className={clsx(base, sizeMap[size], variantMap[variant], className)}
>
  {children}
</button>
```

### 4.3 SectionLabel.jsx — 分组标签

```jsx
// Props: { children, className? }

<p className={clsx(
  'text-[11px] uppercase tracking-[0.2em] text-gray-400 mb-6',
  className
)}>
  {children}
</p>
```

### 4.4 LazyImage.jsx — 懒加载图片

```jsx
// Props:
//   src: string
//   alt: string
//   aspectRatio?: string     // 默认 '3/4', 如 '16/9' '1/1' '4/3'
//   className?: string
//   objectFit?: 'cover' | 'contain'   // 默认 'cover'

const [loaded, setLoaded] = useState(false);
const [error, setError] = useState(false);

<div
  className={clsx('relative overflow-hidden bg-[#f0f0f0]', className)}
  style={{ aspectRatio: aspectRatio || '3/4' }}
>
  {/* 占位符 (加载前) */}
  {!loaded && !error && (
    <div className="absolute inset-0 bg-[#f0f0f0] animate-pulse" />
  )}

  {/* 加载失败占位 */}
  {error && (
    <div className="absolute inset-0 bg-[#f5f5f5] flex items-center justify-center">
      <ImageOff size={24} className="text-gray-300" />
    </div>
  )}

  {!error && (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onLoad={() => setLoaded(true)}
      onError={() => setError(true)}
      className={clsx(
        'w-full h-full transition-opacity duration-500',
        objectFit === 'contain' ? 'object-contain' : 'object-cover',
        loaded ? 'opacity-100' : 'opacity-0'
      )}
    />
  )}
</div>
```

### 4.5 ScrollRow.jsx — 横向滚动容器

```jsx
// Props: { children, className?, gap?: number }  // gap 默认 6 (24px)

<div className={clsx('flex overflow-x-auto no-scrollbar', className)}
     style={{ gap: gap ?? 24, scrollSnapType: 'x mandatory' }}>
  {React.Children.map(children, child => (
    <div style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
      {child}
    </div>
  ))}
</div>
```

### 4.6 ImageCard.jsx — 通用图片卡片

```jsx
// Props:
//   src: string
//   title: string
//   subtitle?: string
//   aspectRatio?: string        // 默认 '3/4'
//   width?: number              // 图片宽度 px, 默认 280
//   onClick?: () => void
//   className?: string

<motion.div
  whileHover={{ '--brightness': 0.92 }}
  onClick={onClick}
  className={clsx('group cursor-pointer', className)}
  style={{ width: width || 280 }}
>
  <LazyImage
    src={src}
    alt={title}
    aspectRatio={aspectRatio || '3/4'}
    className="w-full transition-all duration-300 group-hover:brightness-[0.92]"
  />
  <h4 className="mt-4 text-base font-medium text-black group-hover:text-gray-600 transition-colors">
    {title}
  </h4>
  {subtitle && (
    <p className="mt-1 text-sm text-gray-400">{subtitle}</p>
  )}
  <div className="mt-3 w-full h-[1px] bg-[#f0f0f0]" />
</motion.div>
```

### 4.7 StarRating.jsx

```jsx
// Props:
//   value: number              // 0-5, 支持小数
//   interactive?: boolean      // 是否可点击评分
//   onChange?: (val: number) => void
//   size?: number              // 默认 16

<div className="flex items-center gap-0.5">
  {[1, 2, 3, 4, 5].map(i => {
    const filled = value >= i;
    const half = !filled && value >= i - 0.5;
    return (
      <button
        key={i}
        disabled={!interactive}
        onClick={() => interactive && onChange?.(i)}
        className={clsx(
          interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default',
          'transition-transform'
        )}
      >
        <Star
          size={size || 16}
          className={clsx(
            filled ? 'text-black fill-black' : half ? 'text-black fill-black/50' : 'text-gray-300'
          )}
        />
      </button>
    );
  })}
</div>
```

### 4.8 EmptyState.jsx

```jsx
// Props: { icon?: LucideIcon, title: string, description?: string, action?: ReactNode }

<div className="flex flex-col items-center justify-center py-20 text-center">
  {icon && <icon size={48} className="text-gray-300 mb-4" />}
  <h3 className="text-xl font-serif text-gray-800 mb-2">{title}</h3>
  {description && <p className="text-sm text-gray-400 max-w-sm">{description}</p>}
  {action && <div className="mt-6">{action}</div>}
</div>
```

### 4.9 Skeleton.jsx

```jsx
// Props: { className?, variant: 'text' | 'card' | 'image' }

const base = 'animate-pulse bg-[#f0f0f0]';

const variantClass = {
  text: 'h-4 w-full rounded',
  card: 'w-full rounded aspect-[3/4]',
  image: 'w-full rounded aspect-[16/9]',
};

<div className={clsx(base, variantClass[variant], className)} />
```

### 4.10 Lightbox.jsx

```jsx
// Props:
//   images: string[]           // 图片 URL 列表
//   currentIndex: number
//   onClose: () => void
//   onPrev: () => void
//   onNext: () => void

<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  className="fixed inset-0 bg-black z-50 flex items-center justify-center"
  onClick={onClose}
>
  {/* 关闭按钮 */}
  <button onClick={onClose} className="absolute top-6 right-6 text-white/70 hover:text-white z-10">
    <X size={28} />
  </button>

  {/* 计数器 */}
  <span className="absolute top-6 left-6 text-white/50 text-sm z-10">
    {currentIndex + 1} / {images.length}
  </span>

  {/* 左箭头 */}
  <button onClick={e => { e.stopPropagation(); onPrev(); }}
    className="absolute left-4 text-white/70 hover:text-white z-10 disabled:opacity-30"
    disabled={currentIndex === 0}>
    <ChevronLeft size={36} />
  </button>

  {/* 图片 */}
  <motion.img
    key={currentIndex}
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.3 }}
    src={images[currentIndex]}
    alt=""
    className="max-w-[90vw] max-h-[85vh] object-contain"
    onClick={e => e.stopPropagation()}
  />

  {/* 右箭头 */}
  <button onClick={e => { e.stopPropagation(); onNext(); }}
    className="absolute right-4 text-white/70 hover:text-white z-10 disabled:opacity-30"
    disabled={currentIndex === images.length - 1}>
    <ChevronRight size={36} />
  </button>
</motion.div>
```

### 4.11 Toast.jsx

极简 toast — 页面底部居中黑条, 2 秒自动消失。

```jsx
// 使用 Context + Provider 模式:
// <ToastProvider> 包裹 App, 提供 showToast(message) 函数
// ToastContainer 渲染在 App 底部

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: 10 }}
  className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 bg-black text-white text-sm shadow-lg"
>
  {message}
</motion.div>
```

---

## 5. 页面实现规格

以下每个页面的规格包含:
- 文件路径
- 组件签名和 Props
- 状态变量
- API 调用
- 完整的 JSX 结构 + Tailwind 类名
- Framer Motion 动画
- Loading / Empty / Error 状态
- 边缘情况

---

### 5.1 HomePage.jsx

**路由**: `/`
**文件**: `src/pages/HomePage.jsx`

#### 5.1.1 状态与数据

```jsx
// 状态:
const [heroIndex, setHeroIndex] = useState(0);
const [hotPlaces, setHotPlaces] = useState([]);
const [hotDiaries, setHotDiaries] = useState([]);
const [loading, setLoading] = useState(true);
const navigate = useNavigate();

// 固定数据 — Hero 图片池 (用户替换为自有图片)
const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&h=900&fit=crop',
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1600&h=900&fit=crop',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1600&h=900&fit=crop',
];

// API 调用 (useEffect):
useEffect(() => {
  Promise.all([
    placeAPI.getHot(),      // GET /places/hot
    diaryAPI.getHot(),      // GET /diaries/hot
  ]).then(([places, diaries]) => {
    setHotPlaces(places.slice(0, 8));
    setHotDiaries(diaries.slice(0, 4));
  }).catch(console.error)
  .finally(() => setLoading(false));
}, []);

// Hero 自动轮播:
useEffect(() => {
  const timer = setInterval(() => {
    setHeroIndex(prev => (prev + 1) % HERO_IMAGES.length);
  }, 8000);
  return () => clearInterval(timer);
}, []);
```

#### 5.1.2 JSX 结构

```jsx
<div className="min-h-screen">
  {/* ================================================================ */}
  {/* SECTION 1: Hero 全幅大图                                          */}
  {/* ================================================================ */}
  <section className="relative w-full h-[70vh] overflow-hidden">
    {/* 图片轮播 */}
    <AnimatePresence mode="wait">
      <motion.div
        key={heroIndex}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.5, ease: 'easeInOut' }}
        className="absolute inset-0"
      >
        <img
          src={HERO_IMAGES[heroIndex]}
          alt=""
          className="w-full h-full object-cover"
        />
      </motion.div>
    </AnimatePresence>

    {/* 底部渐变遮罩 */}
    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

    {/* 文字叠加层 */}
    <div className="absolute bottom-0 left-0 right-0 px-8 md:px-16 pb-16 md:pb-24">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif text-white leading-tight">
          探索你的旅程
        </h1>
        <p className="text-lg md:text-xl text-white/70 mt-3 font-serif italic">
          Discover Your Journey
        </p>
        <div className="flex gap-4 mt-8">
          <CTAButton variant="secondary" size="lg" onClick={() => navigate('/location-search')}>
            探索地点
          </CTAButton>
          <CTAButton variant="ghost" size="lg"
            className="!text-white !border !border-white/40 hover:!bg-white/10"
            onClick={() => navigate('/diaries')}>
            浏览日记
          </CTAButton>
        </div>
      </motion.div>
    </div>

    {/* 轮播指示器 */}
    <div className="absolute bottom-6 right-8 md:right-16 flex gap-2">
      {HERO_IMAGES.map((_, i) => (
        <button key={i} onClick={() => setHeroIndex(i)}
          className={clsx(
            'w-2 h-2 rounded-full transition-all duration-300',
            i === heroIndex ? 'bg-white scale-100' : 'bg-white/40 scale-75'
          )}
        />
      ))}
    </div>
  </section>

  {/* ================================================================ */}
  {/* SECTION 2: 推荐地点 横向滚动                                        */}
  {/* ================================================================ */}
  <section className="py-24 md:py-32 px-4 md:px-8 max-w-[1400px] mx-auto">
    <SectionLabel>推荐地点</SectionLabel>
    <h2 className="text-2xl md:text-3xl font-serif text-black mb-8">
      热门目的地
    </h2>

    {loading ? (
      <div className="flex gap-6">
        {[1,2,3,4].map(i => <Skeleton key={i} variant="card" className="w-[300px]" />)}
      </div>
    ) : hotPlaces.length === 0 ? (
      <EmptyState icon={MapPin} title="暂无推荐地点" description="稍后再来看看" />
    ) : (
      <ScrollRow gap={24}>
        {hotPlaces.map((place, i) => (
          <motion.div
            key={place.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
          >
            <ImageCard
              src={place.image || place.images?.[0]}
              title={place.name}
              subtitle={`${place.city || ''} · ★ ${place.rating || '-'}`}
              onClick={() => {
                addRecentView({ id: place.id, name: place.name, path: `/places/${place.id}` });
                navigate(`/places/${place.id}`);
              }}
              width={300}
              aspectRatio="3/4"
            />
          </motion.div>
        ))}
      </ScrollRow>
    )}
  </section>

  {/* ================================================================ */}
  {/* SECTION 3: 热门日记 两列大卡片                                      */}
  {/* ================================================================ */}
  <section className="py-24 md:py-32 bg-[#fafafa] px-4 md:px-8">
    <div className="max-w-[1400px] mx-auto">
      <SectionLabel>旅行记录</SectionLabel>
      <h2 className="text-2xl md:text-3xl font-serif text-black mb-8">
        热门日记
      </h2>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Skeleton variant="image" className="w-full" />
          <Skeleton variant="image" className="w-full" />
        </div>
      ) : hotDiaries.length === 0 ? (
        <EmptyState icon={BookOpen} title="暂无热门日记" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {hotDiaries.slice(0, 4).map((diary, i) => (
            <motion.div
              key={diary.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              onClick={() => navigate(`/diaries/${diary.id}`)}
              className="group cursor-pointer"
            >
              <LazyImage
                src={diary.coverImage || diary.images?.[0]}
                alt={diary.title}
                aspectRatio="4/3"
                className="w-full transition-all duration-300 group-hover:brightness-[0.92]"
              />
              <h3 className="mt-5 text-xl font-serif text-black group-hover:text-gray-600 transition-colors">
                {diary.title}
              </h3>
              <p className="mt-2 text-sm text-gray-500 line-clamp-2 leading-relaxed">
                {diary.content?.replace(/<[^>]*>/g, '') || diary.summary}
              </p>
              <p className="mt-3 text-xs text-gray-400">
                {diary.authorName || diary.author} · {formatDate(diary.createdAt)}
              </p>
            </motion.div>
          ))}
        </div>
      )}

      {/* 查看更多 */}
      <div className="mt-12 text-center">
        <CTAButton variant="secondary" size="md" onClick={() => navigate('/diaries')}>
          查看所有日记
        </CTAButton>
      </div>
    </div>
  </section>

  {/* ================================================================ */}
  {/* SECTION 4: 快速入口 3 卡片                                          */}
  {/* ================================================================ */}
  <section className="py-24 md:py-32 px-4 md:px-8 max-w-[1400px] mx-auto">
    <SectionLabel>快速入口</SectionLabel>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {[
        { icon: MapPin, title: '智能导航', desc: '最短路径规划', path: '/route-planning' },
        { icon: BookOpen, title: '记录旅程', desc: '写下你的旅行日记', path: '/diary-management?action=new' },
        { icon: MessageCircle, title: 'AI 助手', desc: '个性化行程推荐', path: '/travel-assistant' },
      ].map((item, i) => (
        <motion.div
          key={item.path}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: i * 0.1 }}
          onClick={() => navigate(item.path)}
          className="group cursor-pointer border border-[#e5e5e5] p-10 hover:border-black transition-colors duration-300"
        >
          <item.icon size={28} className="text-gray-400 group-hover:text-black transition-colors mb-6" />
          <h3 className="text-lg font-serif mb-2">{item.title}</h3>
          <p className="text-sm text-gray-400">{item.desc}</p>
        </motion.div>
      ))}
    </div>
  </section>
</div>
```

#### 5.1.3 边缘情况

- **首次加载**: Hero 图片使用第一张，无需等待 API。推荐地点/日记区域显示骨架屏。
- **API 失败**: catch 中 `console.error`，列表为空显示 EmptyState。
- **图片加载失败**: LazyImage 内部处理，显示 ImageOff 占位图标。
- **Hero 图片不足 3 张**: 指示器仍然渲染，几张就几个点。

---

### 5.2 LoginPage.jsx

**路由**: 无 (认证守卫)
**文件**: `src/pages/LoginPage.jsx`
**Props**: `{ onLoginSuccess: (user) => void }`

#### 5.2.1 状态

```jsx
const [username, setUsername] = useState('');
const [password, setPassword] = useState('');
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
```

#### 5.2.2 JSX 结构

```jsx
<motion.div
  initial={{ opacity: 0, y: 30 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
  className="min-h-screen bg-white flex items-center justify-center px-4"
>
  <div className="w-full max-w-[360px]">
    {/* LOGO 占位 */}
    <div className="flex flex-col items-center mb-12">
      <div className="h-16 w-40 bg-[#f5f5f5] flex items-center justify-center mb-8">
        <span className="text-xs text-gray-400">LOGO</span>
      </div>
      <h1 className="text-2xl font-serif text-black text-center">
        个性化旅游系统
      </h1>
      <p className="text-sm text-gray-400 mt-2 font-serif italic">
        Personal Travel System
      </p>
    </div>

    {/* 登录表单 */}
    <form onSubmit={handleSubmit} className="space-y-6">
      <LineInput
        value={username}
        onChange={e => { setUsername(e.target.value); setError(''); }}
        placeholder="用户名"
        icon={User}
      />

      <LineInput
        value={password}
        onChange={e => { setPassword(e.target.value); setError(''); }}
        placeholder="密码"
        icon={Lock}
        type="password"   // 注意: LineInput 需要支持 type prop
      />

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-red-500 text-center"
        >
          {error}
        </motion.p>
      )}

      <CTAButton
        type="submit"
        variant="primary"
        size="lg"
        disabled={loading || !username || !password}
        className="w-full"
      >
        {loading ? '登录中...' : '登录'}
      </CTAButton>
    </form>

    {/* 测试账号提示 */}
    <div className="mt-12 pt-8 border-t border-[#f0f0f0]">
      <p className="text-[11px] uppercase tracking-[0.15em] text-gray-400 text-center mb-3">
        测试账号
      </p>
      <div className="grid grid-cols-2 gap-4 text-center">
        <div className="text-xs text-gray-500">
          <p className="font-medium text-black mb-1">管理员</p>
          <p>admin</p>
          <p>admin123</p>
        </div>
        <div className="text-xs text-gray-500">
          <p className="font-medium text-black mb-1">普通用户</p>
          <p>user</p>
          <p>user123</p>
        </div>
      </div>
    </div>
  </div>
</motion.div>
```

#### 5.2.3 handleSubmit

```jsx
const handleSubmit = async (e) => {
  e.preventDefault();
  if (!username || !password) return;  // 按钮已 disabled, 但二次确认

  setLoading(true);
  setError('');

  try {
    const res = await userAPI.login({ username, password });
    // res 格式: { code: 200, data: { token, user: {...} } }
    if (res.code === 200 && res.data) {
      const user = { ...res.data.user, token: res.data.token };
      onLoginSuccess(user);
    } else {
      setError(res.message || '登录失败，请检查用户名和密码');
    }
  } catch (err) {
    setError(err.response?.data?.message || '网络错误，请稍后重试');
  } finally {
    setLoading(false);
  }
};
```

**边缘情况**:
- 输入框为空时登录按钮 disabled。
- 输入内容后自动清除错误提示。
- 网络错误 vs 业务错误分别显示不同提示。

---

### 5.3 LocationSearchPage.jsx

**路由**: `/location-search`
**文件**: `src/pages/LocationSearchPage.jsx`

#### 5.3.1 状态

```jsx
const [keyword, setKeyword] = useState('');
const [results, setResults] = useState([]);
const [loading, setLoading] = useState(false);
const [hasMore, setHasMore] = useState(true);
const [page, setPage] = useState(1);
const [activeCategory, setActiveCategory] = useState('全部');
const [showFilter, setShowFilter] = useState(false);
const navigate = useNavigate();

const categories = ['全部', '自然风光', '历史遗迹', '城市观光', '美食探店', '主题乐园', '购物'];
```

#### 5.3.2 数据拉取

```jsx
// 搜索 (关键词 / 分类变化时重置)
useEffect(() => {
  setPage(1);
  setResults([]);
  setHasMore(true);
  fetchResults(1, true);
}, [keyword, activeCategory]);

const fetchResults = async (pageNum, reset = false) => {
  setLoading(true);
  try {
    const params = { page: pageNum, size: 12 };
    if (keyword) params.keyword = keyword;
    if (activeCategory !== '全部') params.category = activeCategory;

    const res = await placeAPI.search(params);
    const data = res.data?.records || res.data || [];
    if (reset) {
      setResults(data);
    } else {
      setResults(prev => [...prev, ...data]);
    }
    setHasMore(data.length >= 12);
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
  }
};

// 加载更多
const loadMore = () => {
  const nextPage = page + 1;
  setPage(nextPage);
  fetchResults(nextPage);
};
```

#### 5.3.3 JSX 结构

```jsx
<div className="min-h-screen px-4 md:px-8 py-8 max-w-6xl mx-auto">
  {/* ========== 搜索栏 ========== */}
  <div className="mb-10">
    <div className="flex items-end gap-4">
      <div className="flex-1">
        <LineInput
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          placeholder="搜索地点、美食、景点..."
          icon={Search}
          autoFocus
        />
      </div>
      <button
        onClick={() => setShowFilter(!showFilter)}
        className="text-sm text-gray-500 hover:text-black transition-colors pb-3"
      >
        {showFilter ? '收起' : '筛选'}
      </button>
    </div>

    {/* 分类筛选标签行 */}
    <AnimatePresence>
      {showFilter && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden"
        >
          <div className="flex flex-wrap gap-3 pt-4">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setShowFilter(false); }}
                className={clsx(
                  'text-sm px-4 py-1.5 transition-colors',
                  activeCategory === cat
                    ? 'text-black border-b-2 border-black font-medium'
                    : 'text-gray-400 hover:text-black'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>

  {/* ========== SectionLabel ========== */}
  <SectionLabel>
    {keyword ? `搜索 "${keyword}" 的结果` : activeCategory !== '全部' ? activeCategory : '全部地点'}
  </SectionLabel>

  {/* ========== 结果网格 ========== */}
  {loading && results.length === 0 ? (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1,2,3,4,5,6].map(i => <Skeleton key={i} variant="card" />)}
    </div>
  ) : results.length === 0 ? (
    <EmptyState
      icon={Search}
      title="未找到相关地点"
      description="换个关键词试试，或者清除筛选条件"
      action={
        <CTAButton variant="ghost" size="sm" onClick={() => { setKeyword(''); setActiveCategory('全部'); }}>
          清除筛选
        </CTAButton>
      }
    />
  ) : (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {results.map((place, i) => (
          <motion.div
            key={place.id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: (i % 12) * 0.05 }}
          >
            <ImageCard
              src={place.image || place.images?.[0]}
              title={place.name}
              subtitle={`${place.category || ''} · ★ ${place.rating || '-'}`}
              aspectRatio="3/4"
              width="100%"
              onClick={() => {
                addRecentView({ id: place.id, name: place.name, path: `/places/${place.id}` });
                navigate(`/places/${place.id}`);
              }}
            />
          </motion.div>
        ))}
      </div>

      {/* 加载更多 */}
      {hasMore && (
        <div className="mt-16 text-center">
          <CTAButton
            variant="secondary"
            size="md"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? '加载中...' : '加载更多'}
          </CTAButton>
        </div>
      )}
    </>
  )}
</div>
```

#### 5.3.4 边缘情况

- **搜索防抖**: 不对 keyword 做防抖（底部线输入框的交互模式，按回车或失焦才触发），但 useEffect 每次 keyword 变化都会触发。如果后端压力大，可以用 `useRef` + `setTimeout` 做 500ms 防抖。
- **空 keyword**: 首次进入页面时不搜索，显示热门地点 (可在 useEffect 中判断: 如果 keyword 为空且分类为"全部"，则调 `placeAPI.getHot()`)。
- **分类切换**: 重置结果列表和分页。
- **加载更多**: 使用 `page` 递增，后端返回不足 12 条时 `hasMore = false`。

---

### 5.4 PlaceDetailPage.jsx

**路由**: `/places/:placeId`
**文件**: `src/pages/PlaceDetailPage.jsx`

#### 5.4.1 状态

```jsx
const { placeId } = useParams();
const navigate = useNavigate();
const [place, setPlace] = useState(null);
const [buildings, setBuildings] = useState([]);
const [facilities, setFacilities] = useState([]);
const [foods, setFoods] = useState([]);
const [similar, setSimilar] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
```

#### 5.4.2 数据拉取

```jsx
useEffect(() => {
  setLoading(true);
  setError(null);

  Promise.all([
    placeAPI.getDetail(placeId),
    buildingAPI.getByPlace(placeId).catch(() => []),    // 失败不阻塞
    facilityAPI.getByPlace(placeId).catch(() => []),
    foodAPI.getByPlace(placeId).catch(() => []),
    placeAPI.recommend({ placeId }).catch(() => []),
  ]).then(([placeRes, buildingsRes, facilitiesRes, foodsRes, similarRes]) => {
    setPlace(placeRes.data);
    setBuildings(buildingsRes.data || []);
    setFacilities(facilitiesRes.data || []);
    setFoods(foodsRes.data || []);
    setSimilar(similarRes.data || []);
  }).catch(err => {
    setError('加载失败，请稍后重试');
    console.error(err);
  }).finally(() => setLoading(false));

  // 写入最近浏览
  addRecentView({ id: placeId, name: placeRes?.data?.name || '', path: `/places/${placeId}` });
}, [placeId]);
```

#### 5.4.3 JSX 结构

```jsx
<div className="min-h-screen">
  {loading ? (
    // 整页骨架屏
    <div className="px-4 md:px-8 max-w-6xl mx-auto py-8 space-y-8">
      <Skeleton variant="image" className="h-[50vh]" />
      <Skeleton variant="text" className="w-2/3" />
      <Skeleton variant="text" className="w-full" />
      <Skeleton variant="text" className="w-1/2" />
    </div>
  ) : error ? (
    <EmptyState icon={AlertCircle} title={error} action={
      <CTAButton variant="secondary" size="sm" onClick={() => window.location.reload()}>重新加载</CTAButton>
    } />
  ) : !place ? (
    <EmptyState icon={MapPin} title="地点不存在" />
  ) : (
    <>
      {/* =========================================================== */}
      {/* SECTION 1: 顶部大图 + 标题                                    */}
      {/* =========================================================== */}
      <section className="relative w-full h-[40vh] md:h-[50vh] overflow-hidden">
        <img
          src={place.image || place.images?.[0]}
          alt={place.name}
          className="w-full h-full object-cover"
        />
        {/* 底部渐变遮罩 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        {/* 返回按钮 */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-6 left-6 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        {/* 标题 */}
        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-16">
          <h1 className="text-3xl md:text-5xl font-serif text-white">{place.name}</h1>
          <p className="text-white/70 mt-2 text-base md:text-lg">
            {place.city}{place.district ? ` · ${place.district}` : ''}
            {' · '}{place.category}
            {' · '}<StarRating value={place.rating || 0} />
          </p>
        </div>
      </section>

      {/* =========================================================== */}
      {/* SECTION 2: 简介 + 信息                                        */}
      {/* =========================================================== */}
      <section className="px-4 md:px-8 max-w-6xl mx-auto py-16">
        <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-12">
          {/* 简介正文 */}
          <div>
            <SectionLabel>关于此地</SectionLabel>
            <p className="text-lg leading-relaxed text-gray-700">
              {place.description || '暂无简介'}
            </p>
          </div>

          {/* 信息卡片 */}
          <div className="space-y-4">
            <SectionLabel>详细信息</SectionLabel>
            {[
              { label: '地址', value: place.address || '-' },
              { label: '开放时间', value: place.openTime || '-' },
              { label: '门票', value: place.ticket || '-' },
              { label: '评分', value: place.rating ? `★ ${place.rating}` : '-' },
            ].map(item => (
              <div key={item.label} className="flex justify-between py-2 border-b border-[#f0f0f0]">
                <span className="text-xs text-gray-400 uppercase">{item.label}</span>
                <span className="text-sm text-gray-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================== */}
      {/* SECTION 3: 建筑一览                                           */}
      {/* =========================================================== */}
      {buildings.length > 0 && (
        <section className="px-4 md:px-8 max-w-6xl mx-auto py-16 border-t border-[#f0f0f0]">
          <SectionLabel>建筑与场馆</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {buildings.map(b => (
              <div key={b.id} className="group cursor-pointer">
                <LazyImage
                  src={b.image}
                  alt={b.name}
                  aspectRatio="4/3"
                  className="w-full transition-all duration-300 group-hover:brightness-[0.92]"
                />
                <h4 className="mt-3 text-base font-medium">{b.name}</h4>
                {b.floors && <p className="text-xs text-gray-400">{b.floors} 层</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* =========================================================== */}
      {/* SECTION 4: 设施标签                                           */}
      {/* =========================================================== */}
      {facilities.length > 0 && (
        <section className="px-4 md:px-8 max-w-6xl mx-auto py-16 border-t border-[#f0f0f0]">
          <SectionLabel>设施与服务</SectionLabel>
          <div className="flex flex-wrap gap-3">
            {facilities.map(f => (
              <span key={f.id} className="text-sm px-4 py-2 border border-[#e5e5e5] text-gray-600">
                {f.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* =========================================================== */}
      {/* SECTION 5: 美食                                               */}
      {/* =========================================================== */}
      {foods.length > 0 && (
        <section className="px-4 md:px-8 max-w-6xl mx-auto py-16 border-t border-[#f0f0f0]">
          <SectionLabel>周边美食</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {foods.map(f => (
              <div key={f.id} className="group cursor-pointer">
                <LazyImage src={f.image} alt={f.name} aspectRatio="1/1" className="w-full transition-all duration-300 group-hover:brightness-[0.92]" />
                <h4 className="mt-2 text-sm font-medium">{f.name}</h4>
                <p className="text-xs text-gray-400">{f.cuisine} {f.price ? `· ¥${f.price}` : ''}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* =========================================================== */}
      {/* SECTION 6: 相关推荐                                           */}
      {/* =========================================================== */}
      {similar.length > 0 && (
        <section className="px-4 md:px-8 max-w-6xl mx-auto py-16 border-t border-[#f0f0f0]">
          <SectionLabel>相关推荐</SectionLabel>
          <ScrollRow gap={24}>
            {similar.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.08 }}
              >
                <ImageCard
                  src={s.image || s.images?.[0]}
                  title={s.name}
                  subtitle={`★ ${s.rating || '-'}`}
                  width={260}
                  onClick={() => navigate(`/places/${s.id}`)}
                />
              </motion.div>
            ))}
          </ScrollRow>
        </section>
      )}
    </>
  )}
</div>
```

#### 5.4.4 边缘情况

- **placeId 不存在**: API 返回 404 时，catch 中 setError，显示 EmptyState。
- **子数据 (建筑/设施/美食) 失败**: 使用 `.catch(() => [])` 不阻塞整体加载。
- **description 为空**: 显示 "暂无简介"。
- **image 和 images[0] 兼容**: 优先取 `place.image`，回退 `place.images?.[0]`。

---

### 5.5 DiariesPage.jsx

**路由**: `/diaries`
**文件**: `src/pages/DiariesPage.jsx`

#### 5.5.1 状态

```jsx
const [diaries, setDiaries] = useState([]);
const [featuredDiary, setFeaturedDiary] = useState(null);
const [recommended, setRecommended] = useState([]);
const [keyword, setKeyword] = useState('');
const [loading, setLoading] = useState(true);
const [page, setPage] = useState(1);
const [hasMore, setHasMore] = useState(true);
const navigate = useNavigate();
```

#### 5.5.2 数据拉取

```jsx
useEffect(() => {
  setLoading(true);
  Promise.all([
    diaryAPI.getList({ page: 1, size: 1, sort: 'hot' }),  // 主推
    diaryAPI.recommend().catch(() => ({ data: [] })),        // 推荐
    fetchDiaries(1, true),
  ]).then(([featuredRes, recRes]) => {
    setFeaturedDiary(featuredRes.data?.records?.[0] || null);
    setRecommended(recRes.data || []);
  }).catch(console.error)
  .finally(() => setLoading(false));
}, []);

const fetchDiaries = async (pageNum, reset) => {
  // 调 diaryAPI.search 或 getList
  const res = await diaryAPI.getList({ page: pageNum, size: 9, keyword: keyword || undefined });
  const data = res.data?.records || res.data || [];
  if (reset) setDiaries(data);
  else setDiaries(prev => [...prev, ...data]);
  setHasMore(data.length >= 9);
};

// keyword 变化时重新搜索
useEffect(() => {
  setPage(1);
  setDiaries([]);
  setHasMore(true);
  fetchDiaries(1, true);
}, [keyword]);
```

#### 5.5.3 JSX 结构

```jsx
<div className="min-h-screen px-4 md:px-8 max-w-6xl mx-auto py-8">
  {/* ========== 页头 ========== */}
  <div className="flex items-end justify-between mb-10">
    <div>
      <h1 className="text-3xl md:text-4xl font-serif text-black">旅游日记</h1>
      <p className="text-sm text-gray-400 mt-1 font-serif italic">Travel Diaries</p>
    </div>
    <CTAButton variant="primary" size="md" onClick={() => navigate('/diary-management?action=new')}>
      写日记
    </CTAButton>
  </div>

  {/* ========== 搜索 ========== */}
  <div className="mb-12 max-w-md">
    <LineInput
      value={keyword}
      onChange={e => setKeyword(e.target.value)}
      placeholder="搜索日记..."
      icon={Search}
    />
  </div>

  {loading ? (
    <div className="space-y-12">
      <div className="flex gap-6">
        <Skeleton variant="image" className="flex-[2]" />
        <div className="flex-1 space-y-4"><Skeleton variant="text" /><Skeleton variant="text" /><Skeleton variant="text" /></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1,2,3,4,5,6].map(i => <Skeleton key={i} variant="card" />)}
      </div>
    </div>
  ) : (
    <>
      {/* ========== 主推区域 ========== */}
      {!keyword && featuredDiary && (
        <div className="mb-20">
          <SectionLabel>推荐阅读</SectionLabel>
          <div className="flex flex-col md:flex-row gap-8">
            {/* 主推大图 */}
            <div
              className="flex-[2] group cursor-pointer"
              onClick={() => navigate(`/diaries/${featuredDiary.id}`)}
            >
              <LazyImage
                src={featuredDiary.coverImage || featuredDiary.images?.[0]}
                alt={featuredDiary.title}
                aspectRatio="3/2"
                className="w-full transition-all duration-300 group-hover:brightness-[0.92]"
              />
              <h2 className="mt-4 text-2xl font-serif group-hover:text-gray-600 transition-colors">
                {featuredDiary.title}
              </h2>
              <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                {stripHtml(featuredDiary.content) || featuredDiary.summary}
              </p>
            </div>

            {/* 推荐列表 */}
            {recommended.length > 0 && (
              <div className="flex-1 space-y-6">
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">为你推荐</h3>
                {recommended.slice(0, 3).map(d => (
                  <div
                    key={d.id}
                    className="flex gap-3 cursor-pointer group"
                    onClick={() => navigate(`/diaries/${d.id}`)}
                  >
                    <LazyImage src={d.coverImage || d.images?.[0]} alt={d.title}
                      aspectRatio="1/1" className="w-16 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-gray-600 transition-colors">
                        {d.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{d.authorName || d.author}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== 日记列表 ========== */}
      <div>
        <SectionLabel>{keyword ? `搜索 "${keyword}"` : '最新日记'}</SectionLabel>

        {diaries.length === 0 ? (
          <EmptyState icon={BookOpen} title="暂无日记"
            description={keyword ? '换个关键词试试' : '还没有人写过日记，来写第一篇吧'}
            action={keyword ? null : <CTAButton variant="secondary" size="sm" onClick={() => navigate('/diary-management?action=new')}>写日记</CTAButton>}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {diaries.map((d, i) => (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: (i % 9) * 0.05 }}
                  onClick={() => navigate(`/diaries/${d.id}`)}
                  className="group cursor-pointer"
                >
                  <LazyImage
                    src={d.coverImage || d.images?.[0]}
                    alt={d.title}
                    aspectRatio="3/2"
                    className="w-full transition-all duration-300 group-hover:brightness-[0.92]"
                  />
                  <h3 className="mt-4 text-base font-medium group-hover:text-gray-600 transition-colors">
                    {d.title}
                  </h3>
                  <p className="mt-1 text-xs text-gray-400">
                    {d.authorName || d.author} · {formatDate(d.createdAt)}
                  </p>
                  <div className="mt-2">
                    <StarRating value={d.rating || 0} size={12} />
                  </div>
                  <div className="mt-3 w-full h-[1px] bg-[#f0f0f0]" />
                </motion.div>
              ))}
            </div>

            {hasMore && (
              <div className="mt-16 text-center">
                <CTAButton
                  variant="secondary"
                  size="md"
                  onClick={loadMore}
                  disabled={loading}
                >
                  {loading ? '加载中...' : '加载更多'}
                </CTAButton>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )}
</div>
```

#### 5.5.4 工具函数

```jsx
function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
}
```

---

### 5.6 DiaryDetailPage.jsx

**路由**: `/diaries/:diaryId`
**文件**: `src/pages/DiaryDetailPage.jsx`

#### 5.6.1 状态

```jsx
const { diaryId } = useParams();
const navigate = useNavigate();
const [diary, setDiary] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
const [lightboxOpen, setLightboxOpen] = useState(false);
const [lightboxIndex, setLightboxIndex] = useState(0);

// 从 content 字段中提取所有图片 URL (简单正则)
const contentImages = diary?.content
  ? [...diary.content.matchAll(/<img[^>]+src=["']([^"']+)["']/g)].map(m => m[1])
  : [];
const allImages = diary?.images?.length ? diary.images : contentImages;
```

#### 5.6.2 数据拉取

```jsx
useEffect(() => {
  setLoading(true);
  diaryAPI.getDetail(diaryId)
    .then(res => setDiary(res.data))
    .catch(err => { setError('日记加载失败'); console.error(err); })
    .finally(() => setLoading(false));
}, [diaryId]);
```

#### 5.6.3 JSX 结构

```jsx
<div className="min-h-screen">
  {loading ? (
    <div className="px-4 md:px-8 max-w-4xl mx-auto py-8 space-y-6">
      <Skeleton variant="text" className="w-1/3" />
      <Skeleton variant="text" className="w-2/3" />
      <Skeleton variant="image" className="aspect-[16/9]" />
      <Skeleton variant="text" className="w-full" />
      <Skeleton variant="text" className="w-full" />
      <Skeleton variant="text" className="w-3/4" />
    </div>
  ) : error ? (
    <EmptyState icon={AlertCircle} title={error} action={
      <CTAButton variant="secondary" size="sm" onClick={() => navigate(-1)}>返回</CTAButton>
    } />
  ) : !diary ? (
    <EmptyState icon={BookOpen} title="日记不存在" />
  ) : (
    <>
      <div className="px-4 md:px-8 max-w-3xl mx-auto py-8">
        {/* 返回 */}
        <button onClick={() => navigate(-1)}
          className="text-sm text-gray-400 hover:text-black transition-colors mb-8 inline-flex items-center gap-1">
          <ArrowLeft size={16} /> 返回
        </button>

        {/* 标题区 */}
        <h1 className="text-3xl md:text-4xl font-serif text-black leading-tight">
          {diary.title}
        </h1>
        <div className="flex items-center gap-3 mt-4 text-sm text-gray-400">
          <span>{diary.authorName || diary.author}</span>
          <span>·</span>
          <span>{formatDate(diary.createdAt)}</span>
          <span>·</span>
          <StarRating value={diary.rating || 0} />
        </div>

        {/* 封面大图 */}
        {(diary.coverImage || diary.images?.[0]) && (
          <div className="mt-10 mb-12">
            <LazyImage
              src={diary.coverImage || diary.images[0]}
              alt={diary.title}
              aspectRatio="16/9"
              className="w-full"
            />
          </div>
        )}

        {/* 正文 — HTML 渲染 */}
        <div
          className="prose prose-lg max-w-none
            prose-headings:font-serif prose-headings:text-black
            prose-p:text-gray-700 prose-p:leading-relaxed
            prose-img:w-full prose-img:my-8
            prose-a:text-black prose-a:underline
            prose-strong:text-black"
          dangerouslySetInnerHTML={{ __html: diary.content || '<p>暂无内容</p>' }}
        />

        {/* 图片画廊 */}
        {allImages.length > 0 && (
          <div className="mt-16 pt-12 border-t border-[#f0f0f0]">
            <SectionLabel>图片画廊</SectionLabel>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {allImages.map((img, i) => (
                <div
                  key={i}
                  className="cursor-pointer overflow-hidden"
                  onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}
                >
                  <LazyImage
                    src={img}
                    alt={`图片 ${i + 1}`}
                    aspectRatio="1/1"
                    className="w-full transition-transform duration-300 hover:scale-105"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 评分交互 */}
        <div className="mt-16 pt-12 border-t border-[#f0f0f0]">
          <SectionLabel>给这篇日记评分</SectionLabel>
          <StarRating
            value={diary.userRating || 0}
            interactive
            onChange={handleRate}
            size={24}
          />
        </div>
      </div>

      {/* 灯箱 */}
      <AnimatePresence>
        {lightboxOpen && (
          <Lightbox
            images={allImages}
            currentIndex={lightboxIndex}
            onClose={() => setLightboxOpen(false)}
            onPrev={() => setLightboxIndex(i => Math.max(0, i - 1))}
            onNext={() => setLightboxIndex(i => Math.min(allImages.length - 1, i + 1))}
          />
        )}
      </AnimatePresence>
    </>
  )}
</div>
```

#### 5.6.4 评分处理

```jsx
const handleRate = async (val) => {
  try {
    await diaryAPI.rate(diaryId, val);
    setDiary(prev => ({ ...prev, userRating: val }));
  } catch (err) {
    console.error(err);
  }
};
```

---

### 5.7 DiaryManagementPage.jsx

**路由**: `/diary-management`
**文件**: `src/pages/DiaryManagementPage.jsx`

#### 5.7.1 状态

```jsx
const [diaries, setDiaries] = useState([]);
const [loading, setLoading] = useState(true);
const [page, setPage] = useState(1);
const [total, setTotal] = useState(0);
const [statusFilter, setStatusFilter] = useState('all');  // 'all' | 'published' | 'draft'
const [showCreateModal, setShowCreateModal] = useState(false);
const [editingDiary, setEditingDiary] = useState(null);   // 编辑中的日记对象
const navigate = useNavigate();
const [searchParams] = useSearchParams();

const pageSize = 10;
```

#### 5.7.2 数据拉取

```jsx
const fetchDiaries = async () => {
  setLoading(true);
  try {
    const params = { page, size: pageSize };
    if (statusFilter !== 'all') params.status = statusFilter;
    const res = await diaryAPI.getList(params);
    setDiaries(res.data?.records || []);
    setTotal(res.data?.total || 0);
  } catch (err) { console.error(err); }
  finally { setLoading(false); }
};

useEffect(() => { fetchDiaries(); }, [page, statusFilter]);

// 检查 URL 参数 ?action=new，自动打开创建
useEffect(() => {
  if (searchParams.get('action') === 'new') setShowCreateModal(true);
}, []);
```

#### 5.7.3 JSX 结构

```jsx
<div className="min-h-screen px-4 md:px-8 max-w-6xl mx-auto py-8">
  {/* 页头 */}
  <div className="flex items-end justify-between mb-8">
    <div>
      <h1 className="text-3xl font-serif text-black">日记管理</h1>
      <p className="text-xs text-gray-400 mt-1">共 {total} 篇日记</p>
    </div>
    <CTAButton variant="primary" size="md" onClick={() => { setEditingDiary(null); setShowCreateModal(true); }}>
      新建日记
    </CTAButton>
  </div>

  {/* 筛选 + 排序 */}
  <div className="flex gap-6 mb-8">
    <div className="flex gap-2">
      {['all', 'published', 'draft'].map(s => (
        <button key={s}
          onClick={() => { setStatusFilter(s); setPage(1); }}
          className={clsx(
            'text-sm px-3 py-1 transition-colors',
            statusFilter === s
              ? 'text-black border-b-2 border-black font-medium'
              : 'text-gray-400 hover:text-black'
          )}>
          {{all: '全部', published: '已发布', draft: '草稿'}[s]}
        </button>
      ))}
    </div>
  </div>

  {/* 表格 */}
  {loading ? (
    <div className="space-y-3">
      {[1,2,3,4,5].map(i => <Skeleton key={i} variant="text" className="h-12" />)}
    </div>
  ) : diaries.length === 0 ? (
    <EmptyState icon={FileText} title="暂无日记" description="点击右上角「新建日记」开始记录" />
  ) : (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b border-[#e5e5e5]">
              <th className="font-medium py-3 pr-4">标题</th>
              <th className="font-medium py-3 pr-4 hidden md:table-cell">作者</th>
              <th className="font-medium py-3 pr-4 hidden md:table-cell">日期</th>
              <th className="font-medium py-3 pr-4">状态</th>
              <th className="font-medium py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {diaries.map(d => (
              <tr key={d.id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa] transition-colors">
                <td className="py-3 pr-4 font-medium text-black truncate max-w-[200px]">
                  {d.title}
                </td>
                <td className="py-3 pr-4 text-gray-500 hidden md:table-cell">{d.authorName || d.author}</td>
                <td className="py-3 pr-4 text-gray-500 hidden md:table-cell">{formatDate(d.createdAt)}</td>
                <td className="py-3 pr-4">
                  <span className={clsx(
                    'text-xs px-2 py-0.5 rounded-full',
                    d.status === 'published' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                  )}>
                    {d.status === 'published' ? '已发布' : '草稿'}
                  </span>
                </td>
                <td className="py-3">
                  <div className="flex gap-4">
                    <button onClick={() => { setEditingDiary(d); setShowCreateModal(true); }}
                      className="text-xs text-black hover:text-gray-600">编辑</button>
                    <button onClick={() => handleDelete(d.id)}
                      className="text-xs text-red-400 hover:text-red-600">删除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {total > pageSize && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="text-sm text-gray-400 hover:text-black disabled:opacity-30">
            上一页
          </button>
          <span className="text-sm text-gray-500">{page} / {Math.ceil(total / pageSize)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / pageSize)}
            className="text-sm text-gray-400 hover:text-black disabled:opacity-30">
            下一页
          </button>
        </div>
      )}
    </>
  )}

  {/* 创建/编辑模态框 */}
  <AnimatePresence>
    {showCreateModal && (
      <DiaryFormModal
        diary={editingDiary}
        onClose={() => { setShowCreateModal(false); setEditingDiary(null); }}
        onSaved={() => { setShowCreateModal(false); setEditingDiary(null); fetchDiaries(); }}
      />
    )}
  </AnimatePresence>
</div>
```

#### 5.7.4 DiaryFormModal (新建/编辑表单)

模态框内部组件，不单独文件，写在 DiaryManagementPage 同文件内。

```jsx
// 状态:
const [form, setForm] = useState({
  title: diary?.title || '',
  content: diary?.content || '',
  coverImage: diary?.coverImage || '',
});
const [saving, setSaving] = useState(false);

// JSX:
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
  onClick={onClose}
>
  <motion.div
    initial={{ opacity: 0, scale: 0.96 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.96 }}
    transition={{ duration: 0.25 }}
    className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8"
    onClick={e => e.stopPropagation()}
  >
    <h2 className="text-2xl font-serif mb-8">{diary ? '编辑日记' : '新建日记'}</h2>

    <div className="space-y-6">
      <div>
        <label className="text-xs uppercase tracking-wider text-gray-400 block mb-2">标题</label>
        <LineInput value={form.title} onChange={e => setForm({...form, title: e.target.value})}
          placeholder="日记标题" />
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-gray-400 block mb-2">内容</label>
        <textarea
          value={form.content}
          onChange={e => setForm({...form, content: e.target.value})}
          placeholder="写下你的旅行故事..."
          rows={12}
          className="w-full p-4 border border-[#e5e5e5] text-sm focus:outline-none focus:border-black resize-none transition-colors"
        />
      </div>

      <div className="flex gap-4 justify-end pt-4 border-t border-[#f0f0f0]">
        <CTAButton variant="ghost" size="md" onClick={onClose}>取消</CTAButton>
        <CTAButton variant="primary" size="md" onClick={handleSave} disabled={saving || !form.title}>
          {saving ? '保存中...' : diary ? '保存修改' : '发布日记'}
        </CTAButton>
      </div>
    </div>
  </motion.div>
</motion.div>
```

---

### 5.8 RoutePage.jsx

**路由**: `/route-planning`
**文件**: `src/pages/RoutePage.jsx`

#### 5.8.1 设计原则

地图占据全屏，搜索面板浮动左上。保留现有高德地图集成逻辑，仅换 UI 壳。

#### 5.8.2 状态

```jsx
const [startPoint, setStartPoint] = useState('');
const [endPoint, setEndPoint] = useState('');
const [routeInfo, setRouteInfo] = useState(null);    // { distance, time, steps }
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
const [mapLoaded, setMapLoaded] = useState(false);
const [panelCollapsed, setPanelCollapsed] = useState(false);

// 地图引用 (AMap 实例)
const mapRef = useRef(null);
const mapContainerRef = useRef(null);
```

#### 5.8.3 JSX 结构

```jsx
<div className="relative w-full h-[calc(100vh-0px)]">
  {/* 全屏地图 */}
  <div ref={mapContainerRef} className="absolute inset-0" />

  {/* 浮动搜索面板 — 左上角 */}
  <motion.div
    animate={{ width: panelCollapsed ? 48 : 360 }}
    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    className="absolute top-4 left-4 z-10 bg-white shadow-sm overflow-hidden"
  >
    {/* 面板头部 — 折叠/展开按钮 */}
    <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
      {!panelCollapsed && <h2 className="text-base font-medium">路线规划</h2>}
      <button onClick={() => setPanelCollapsed(!panelCollapsed)}
        className="text-gray-400 hover:text-black transition-colors">
        {panelCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>
    </div>

    {!panelCollapsed && (
      <div className="p-5 space-y-4">
        {/* 起点输入 */}
        <LineInput
          value={startPoint}
          onChange={e => setStartPoint(e.target.value)}
          placeholder="输入起点"
          icon={MapPin}
        />

        {/* 终点输入 */}
        <LineInput
          value={endPoint}
          onChange={e => setEndPoint(e.target.value)}
          placeholder="输入终点"
          icon={MapPin}
        />

        {/* 错误提示 */}
        {error && <p className="text-xs text-red-500">{error}</p>}

        {/* 规划按钮 */}
        <CTAButton variant="primary" size="md" onClick={handleSearchRoute}
          disabled={loading || !startPoint || !endPoint} className="w-full">
          {loading ? '规划中...' : '开始导航'}
        </CTAButton>

        {/* 路线信息 */}
        {routeInfo && (
          <div className="pt-4 border-t border-[#f0f0f0] space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">距离</span>
              <span className="font-medium">{routeInfo.distance}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">时间</span>
              <span className="font-medium">{routeInfo.time}</span>
            </div>

            <div className="pt-3 border-t border-[#f0f0f0]">
              <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider">路线步骤</p>
              <ol className="space-y-2 max-h-[300px] overflow-y-auto">
                {routeInfo.steps?.map((step, i) => (
                  <li key={i} className="text-sm text-gray-700 pl-4 relative
                    before:content-[''] before:absolute before:left-0 before:top-2
                    before:w-1.5 before:h-1.5 before:bg-black before:rounded-full">
                    {step.instruction}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    )}
  </motion.div>

  {/* 地图加载状态 */}
  {!mapLoaded && (
    <div className="absolute inset-0 flex items-center justify-center bg-[#fafafa] z-0">
      <p className="text-sm text-gray-400">地图加载中...</p>
    </div>
  )}
</div>
```

#### 5.8.4 地图初始化逻辑

```jsx
useEffect(() => {
  // 加载高德地图 JS API
  amapLoader.load().then(() => {
    const map = new window.AMap.Map(mapContainerRef.current, {
      zoom: 12,
      center: [116.397428, 39.90923],   // 默认北京中心
      mapStyle: 'amap://styles/light',   // 浅色主题
    });
    mapRef.current = map;
    setMapLoaded(true);
  }).catch(err => {
    setError('地图加载失败');
    console.error(err);
  });

  return () => {
    if (mapRef.current) mapRef.current.destroy();
  };
}, []);
```

#### 5.8.5 路径绘制

```jsx
const handleSearchRoute = async () => {
  // ... 调用高德 DrivingRoute / WalkingRoute API
  // ... 在地图上绘制路线 (Polyline)
  // ... 标记起终点 (Marker)
  // ... 设置 map fitView
  // 具体逻辑保留现有 RouteMap.jsx 中的实现
};
```

**边缘情况**:
- 起点/终点为空时按钮 disabled。
- 地图 JS API 加载失败时显示错误占位。
- 面板折叠状态: 仅显示一个小图标按钮，点击展开。

---

### 5.9 CampusNavigationPage.jsx

**路由**: `/campus-navigation`
**文件**: `src/pages/CampusNavigationPage.jsx`

与 RoutePage 布局结构相同 (全屏地图 + 左上浮动面板)，差异在于面板内容。

#### 5.9.1 面板内容扩展

```jsx
{/* 建筑选择 */}
<div>
  <label className="text-xs uppercase tracking-wider text-gray-400 block mb-2">选择建筑</label>
  <select
    value={selectedBuilding}
    onChange={e => setSelectedBuilding(e.target.value)}
    className="w-full py-2.5 text-sm border-b-2 border-[#e5e5e5] bg-transparent focus:outline-none focus:border-black"
  >
    <option value="">请选择建筑</option>
    {buildings.map(b => (
      <option key={b.id} value={b.id}>{b.name}</option>
    ))}
  </select>
</div>

{/* 楼层选择器 */}
{selectedBuilding && (
  <div className="pt-4 border-t border-[#f0f0f0]">
    <label className="text-xs uppercase tracking-wider text-gray-400 block mb-3">楼层</label>
    <div className="flex gap-2">
      {floors.map(f => (
        <button key={f} onClick={() => setCurrentFloor(f)}
          className={clsx(
            'w-10 h-10 text-sm transition-colors',
            currentFloor === f
              ? 'bg-black text-white'
              : 'border border-[#e5e5e5] text-gray-500 hover:border-black hover:text-black'
          )}>
          {f}
        </button>
      ))}
    </div>
  </div>
)}

{/* 起终点输入 — 与 RoutePage 相同 */}
<LineInput ... placeholder="起点房间" />
<LineInput ... placeholder="终点房间" />
<CTAButton ...>开始导航</CTAButton>

{/* 室内路线步骤 */}
{routeInfo && (
  <div>...</div>   // 同 RoutePage
)}
```

---

### 5.10 PersonalTravelAssistantPage.jsx

**路由**: `/travel-assistant`
**文件**: `src/pages/PersonalTravelAssistantPage.jsx`

#### 5.10.1 设计

页面分为左右两区:
- 左侧 (280px): 会话列表 (可折叠)
- 右侧: 聊天主区域

#### 5.10.2 状态

```jsx
const [sessions, setSessions] = useState([]);
const [activeSessionId, setActiveSessionId] = useState(null);
const [messages, setMessages] = useState([]);
const [inputValue, setInputValue] = useState('');
const [sending, setSending] = useState(false);
const [showHistory, setShowHistory] = useState(true);
const messagesEndRef = useRef(null);
```

#### 5.10.3 数据拉取

```jsx
useEffect(() => {
  agentAPI.getSessions().then(res => {
    const list = res.data || [];
    setSessions(list);
    if (list.length > 0 && !activeSessionId) {
      setActiveSessionId(list[0].id);
      loadMessages(list[0].id);
    }
  }).catch(console.error);
}, []);

const loadMessages = async (sessionId) => {
  const res = await agentAPI.getMessages(sessionId);
  setMessages(res.data || []);
};

useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages]);
```

#### 5.10.4 JSX 结构

```jsx
<div className="flex h-[calc(100vh-0px)]">
  {/* ========== 左侧会话列表 ========== */}
  <AnimatePresence>
    {showHistory && (
      <motion.aside
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 280, opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        className="border-r border-[#f0f0f0] overflow-hidden flex-shrink-0"
      >
        <div className="w-[280px] h-full flex flex-col">
          <div className="p-4 border-b border-[#f0f0f0] flex items-center justify-between">
            <h3 className="text-sm font-medium">历史会话</h3>
            <button onClick={() => { /* 新建会话 */ }}
              className="text-gray-400 hover:text-black transition-colors">
              <Plus size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sessions.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">暂无会话</p>
            ) : (
              <ul>
                {sessions.map(s => (
                  <li key={s.id}>
                    <button
                      onClick={() => { setActiveSessionId(s.id); loadMessages(s.id); }}
                      className={clsx(
                        'w-full text-left px-4 py-3 text-sm hover:bg-[#fafafa] transition-colors border-l-2',
                        activeSessionId === s.id
                          ? 'border-black text-black bg-[#fafafa]'
                          : 'border-transparent text-gray-500'
                      )}>
                      <p className="truncate">{s.title || '新会话'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(s.updatedAt)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </motion.aside>
    )}
  </AnimatePresence>

  {/* ========== 右侧聊天区 ========== */}
  <div className="flex-1 flex flex-col min-w-0">
    {/* 顶部栏 */}
    <div className="h-16 border-b border-[#f0f0f0] flex items-center px-6 gap-3">
      <button onClick={() => setShowHistory(!showHistory)}
        className="text-gray-400 hover:text-black transition-colors">
        <PanelLeft size={20} />
      </button>
      <h2 className="text-base font-medium">AI 旅游助手</h2>
    </div>

    {/* 消息列表 */}
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <MessageCircle size={40} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-400">开始和 AI 助手对话吧</p>
            <p className="text-xs text-gray-300 mt-2">可以问我旅游推荐、路线规划、美食攻略...</p>
          </div>
        </div>
      ) : (
        messages.map((msg, i) => (
          <motion.div
            key={msg.id || i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={clsx(
              'flex',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {msg.role === 'assistant' ? (
              /* 助手消息 — 左边线 + 无气泡 */
              <div className="max-w-[80%] border-l-2 border-black pl-4">
                <div className="prose prose-sm max-w-none text-gray-700"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
              </div>
            ) : (
              /* 用户消息 — 灰背景气泡 */
              <div className="max-w-[75%] bg-[#f5f5f5] rounded-2xl px-5 py-3">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{msg.content}</p>
              </div>
            )}
          </motion.div>
        ))
      )}

      {/* 打字指示器 */}
      {sending && (
        <div className="flex justify-start">
          <div className="border-l-2 border-black pl-4 py-2">
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <motion.span key={i}
                  className="w-2 h-2 bg-gray-400 rounded-full"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>

    {/* 输入区 */}
    <div className="border-t border-[#f0f0f0] px-6 py-4">
      <div className="flex items-end gap-3">
        <textarea
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息..."
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm py-2 focus:outline-none placeholder:text-gray-400"
        />
        <button
          onClick={handleSend}
          disabled={sending || !inputValue.trim()}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-black text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  </div>
</div>
```

#### 5.10.5 发送逻辑

```jsx
const handleSend = async () => {
  if (!inputValue.trim() || sending) return;
  const content = inputValue.trim();
  setInputValue('');
  setSending(true);

  // 添加用户消息
  const userMsg = { id: Date.now().toString(), role: 'user', content };
  setMessages(prev => [...prev, userMsg]);

  try {
    const res = await agentAPI.chat({
      sessionId: activeSessionId,
      message: content,
    });
    // 添加助手回复
    const assistantMsg = { id: (Date.now()+1).toString(), role: 'assistant', content: res.data?.reply || res.data };
    setMessages(prev => [...prev, assistantMsg]);

    // 如果是新会话, 更新会话列表
    if (!activeSessionId && res.data?.sessionId) {
      setActiveSessionId(res.data.sessionId);
      // 刷新会话列表
      agentAPI.getSessions().then(r => setSessions(r.data || [])).catch(() => {});
    }
  } catch (err) {
    setMessages(prev => [...prev, {
      id: (Date.now()+2).toString(),
      role: 'assistant',
      content: '抱歉，服务暂时不可用，请稍后重试。',
    }]);
  } finally {
    setSending(false);
  }
};

const handleKeyDown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
};
```

#### 5.10.6 Markdown 渲染

```jsx
// 简单 Markdown → HTML (不引入额外库)
// 仅处理: **加粗**、*斜体*、`代码`、```代码块```、- 列表、1. 有序列表
// 或者引入 marked / markdown-it
function renderMarkdown(text) {
  if (!text) return '';
  // 使用简单的替换或引入轻量库
  // 推荐: import { marked } from 'marked';
  // return marked(text);
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`{3}(\w*)\n([\s\S]*?)`{3}/g, '<pre class="bg-gray-100 p-3 text-xs overflow-x-auto my-2"><code>$2</code></pre>')
    .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1 text-xs">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n/g, '<br/>');
}
```

---

### 5.11 StatsPage.jsx

**路由**: `/stats`
**文件**: `src/pages/StatsPage.jsx`

#### 5.11.1 状态

```jsx
const [stats, setStats] = useState(null);  // { placeCount, diaryCount, userCount, ... }
const [loading, setLoading] = useState(true);
```

#### 5.11.2 JSX 结构

```jsx
<div className="min-h-screen px-4 md:px-8 max-w-6xl mx-auto py-8">
  <h1 className="text-3xl font-serif text-black mb-12">系统统计</h1>

  {loading ? (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
      {[1,2,3].map(i => <Skeleton key={i} variant="card" className="aspect-[3/2]" />)}
    </div>
  ) : (
    <>
      {/* ========== 统计卡片 ========== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
        {[
          { label: '地点总数', value: stats?.placeCount || 0 },
          { label: '日记总数', value: stats?.diaryCount || 0 },
          { label: '用户总数', value: stats?.userCount || 0 },
        ].map(item => (
          <div key={item.label}>
            <p className="text-5xl font-light text-black">{item.value.toLocaleString()}</p>
            <p className="text-xs uppercase tracking-wider text-gray-400 mt-3">{item.label}</p>
          </div>
        ))}
      </div>

      {/* ========== 图表区 ========== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* 评分分布 — 柱状图 */}
        <div>
          <SectionLabel>评分分布</SectionLabel>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.ratingDistribution || []}>
                <Bar dataKey="count" fill="#e5e5e5" radius={[0,0,0,0]}
                  onMouseEnter={(_, i) => { /* hover 变黑 */ }} />
                <XAxis dataKey="rating" tick={{ fontSize: 12, fill: '#a3a3a3' }} axisLine={false} tickLine={false} />
                <YAxis hide />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 热门地点 Top 10 — 横向条形图 */}
        <div>
          <SectionLabel>热门地点 Top 10</SectionLabel>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.topPlaces || []} layout="vertical">
                <Bar dataKey="count" fill="#0a0a0a" barSize={6} radius={[0,0,0,0]} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: '#404040' }}
                  axisLine={false} tickLine={false} width={120} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 用户活跃趋势 — 折线图 */}
      <div className="mt-16">
        <SectionLabel>用户活跃趋势</SectionLabel>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats?.activeTrend || []}>
              <Line type="monotone" dataKey="count" stroke="#0a0a0a" strokeWidth={1.5} dot={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#a3a3a3' }} axisLine={false} tickLine={false} />
              <YAxis hide />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  )}
</div>
```

**边缘情况**:
- stats 数据为空对象时不崩溃，使用 `|| 0` 和 `|| []` 默认值。
- Recharts 的 ResponsiveContainer 需要父容器有明确高度。

---

### 5.12 ConcurrencyTestPage.jsx

**路由**: `/concurrency-test`
**文件**: `src/pages/ConcurrencyTestPage.jsx`

保持现有逻辑，仅替换 UI:

```jsx
<div className="min-h-screen px-4 md:px-8 max-w-4xl mx-auto py-8">
  <h1 className="text-3xl font-serif text-black mb-8">并发测试</h1>

  <div className="space-y-6 max-w-md">
    <LineInput value={url} onChange={e => setUrl(e.target.value)} placeholder="API URL" />
    <LineInput value={count} onChange={e => setCount(e.target.value)} placeholder="并发数" />
    <CTAButton variant="primary" size="md" onClick={startTest} disabled={running}>
      {running ? '测试中...' : '开始测试'}
    </CTAButton>
  </div>

  {/* 进度条 — 细线 */}
  {running && (
    <div className="mt-8">
      <div className="h-[2px] bg-[#f0f0f0]">
        <motion.div
          className="h-full bg-black"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-2">{completed}/{total}</p>
    </div>
  )}

  {/* 结果表格 — 极简 */}
  {results.length > 0 && (
    <div className="mt-12">
      <SectionLabel>测试结果</SectionLabel>
      <table className="w-full text-sm mt-4">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b border-[#e5e5e5]">
            <th className="font-medium py-3">#</th>
            <th className="font-medium py-3">状态</th>
            <th className="font-medium py-3">耗时</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr key={i} className="border-b border-[#f5f5f5]">
              <td className="py-3 text-gray-500">{i + 1}</td>
              <td className={clsx('py-3', r.success ? 'text-gray-800' : 'text-red-500')}>
                {r.success ? '成功' : '失败'}
              </td>
              <td className="py-3 text-gray-500">{r.time}ms</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>
```

---

## 6. Hooks 规格

### 6.1 useAuth.js

```js
// 返回 { user, isLoggedIn, login, logout }
// login(user) → setUser + setItem('user'), setItem('token'), setItem('isLoggedIn', 'true')
// logout() → removeItem + setUser(null) + navigate('/')
// 初始化从 localStorage 恢复
```

### 6.2 useScrollReveal.js

```js
// 封装 framer-motion 的 useInView
// 返回 { ref, inView } 用于任意元素的滚动触发动画
```

### 6.3 useMediaQuery.js

```js
// 返回 { isMobile, isTablet, isDesktop }
// isMobile: < 768px
// isTablet: 768px - 1279px
// isDesktop: >= 1280px
```

---

## 7. 全局工具函数

**文件**: `src/utils/constants.js`

```js
// 最近浏览管理
export function addRecentView({ id, name, path }) {
  const existing = JSON.parse(localStorage.getItem('recentViews') || '[]');
  const filtered = existing.filter(v => v.id !== id);
  const updated = [{ id, name, path, timestamp: Date.now() }, ...filtered].slice(0, 10);
  localStorage.setItem('recentViews', JSON.stringify(updated));
}

// 日期格式化
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
}

// 去除 HTML 标签
export function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '');
}
```

---

## 8. 实现顺序建议

不按优先级分阶段，而是按照**文件依赖关系**顺序实现:

1. **环境准备**: 安装依赖 → 配置 Tailwind → 重写 `index.css` → 更新 `vite.config.js`
2. **通用 UI 组件**: LineInput → CTAButton → SectionLabel → LazyImage → ScrollRow → ImageCard → StarRating → EmptyState → Skeleton → Lightbox → Toast
3. **壳组件**: LeftSidebar → TopBar → MobileMenuOverlay → RightPanel
4. **App.jsx**: 布局壳 + 路由 + 认证守卫
5. **页面逐个实现**: LoginPage → HomePage → LocationSearchPage → PlaceDetailPage → DiariesPage → DiaryDetailPage → DiaryManagementPage → RoutePage → CampusNavigationPage → PersonalTravelAssistantPage → StatsPage → ConcurrencyTestPage
6. **收尾**: 删除 Ant Design 依赖 → 删除旧 CSS → 验证所有路由

---

## 9. 关键提醒

- **所有圆角 = 0** (`rounded-none`)。唯一的例外: 用户消息气泡 `rounded-2xl`、头像 `rounded-full`。
- **所有阴影克制使用**。默认卡片无阴影。只有浮动面板 (地图搜索面板) 和模态框用 `shadow-sm` / `shadow-xl`。
- **颜色**: 正文 `text-gray-800 (#404040)`，次要 `text-gray-400 (#a3a3a3)`，标题 `text-black (#0a0a0a)`。
- **字体**: 标题用 `font-serif` (`Noto Serif SC`)，正文用系统 sans-serif。
- **间距**: Section 之间 `py-24 md:py-32`，模块之间 `mb-16`。
- **图片**: 始终用 `LazyImage`，不要直接写 `<img>`。
- **动画**: 页面切换用 `fadeInUp`，滚动触发用 `whileInView`，列表项延迟 `i * 0.08s`。
- **API 层不变**: `services/api.js` 保持原样，只需确保导出函数名与上面各页面的调用一致。
