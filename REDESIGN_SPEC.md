# 邮迹 — 前端品牌升级改动说明书

> 版本 v1.0 | 2026-05-05
> 基于 DESIGN.md 原有设计规格，在此基础上进行品牌化升级与视觉优化

---

## 0. 改动总览

### 改什么

| 类别 | 改动项 | 影响范围 |
|------|--------|----------|
| 品牌 | "VOYAGE" → "邮迹" 品牌标识、Logo、文案 | 全局 |
| 色彩 | 冷白/纯黑 → 暖白/暖灰/赤陶色系 | `index.css` CSS 变量 |
| 新增页面 | Loading 启动页（含右上角登录入口） | 新增 `LoadingPage.jsx` |
| 登录流程 | Loading → 登录 → 系统（三段式） | `App.jsx` 认证流程 |
| 布局优化 | LeftSidebar 宽度/间距微调、RightPanel 改为可选 | `App.jsx`, Shell 组件 |
| 动效增强 | 首页 Hero 粒子/光晕、卡片 hover 微交互、滚动视差 | `HomePage.jsx`, `index.css` |
| 组件微调 | CTAButton 增加暖色变体、ImageCard 增加毛玻璃标签 | UI 组件 |

### 不改什么

- **组件文件结构**：`Shell/`, `ui/`, `pages/` 目录结构不变
- **API 层**：`services/api.js` 零改动
- **路由表**：所有路由 path 不变
- **后端**：零改动
- **Tailwind v4 + framer-motion 技术栈**：保持不变
- **响应式断点规则**：md(768px) / xl(1280px) 规则不变
- **现有页面核心逻辑**：数据拉取、表单提交逻辑基本不动

---

## 1. 品牌体系：邮迹 (Youji)

### 1.1 品牌释义

"邮迹"取意：
- **邮** — 北京邮电大学的地标基因，也暗含"传递、连接"之意
- **迹** — 足迹、轨迹、痕迹，呼应旅游导航+日记记录的核心功能

Slogan: **"留下你的轨迹"** / *"Leave Your Trace"*

### 1.2 Logo 方案

使用纯文字标（Wordmark），中英文组合：

```
邮迹
YOUJI
```

- 中文 "邮迹" 使用 `Noto Serif SC`（font-serif），字重 700
- 英文 "YOUJI" 使用系统 sans-serif，`letter-spacing: 0.25em`，`font-size: 10px`
- 整体高度约 40px，适合 Sidebar / TopBar 位置
- 不需要图片 logo，纯 CSS 实现，零依赖

#### 实现 — 新增 `LogoText` 组件

**文件**: `src/components/ui/LogoText.jsx`（新增 ~20 行）

```jsx
function LogoText({ variant = 'default' }) {
  return (
    <div className="flex flex-col items-center leading-none select-none">
      <span className="font-serif text-xl font-bold tracking-[0.05em] text-heading">
        邮迹
      </span>
      <span className="text-[9px] tracking-[0.3em] text-muted uppercase mt-0.5">
        Youji
      </span>
    </div>
  );
}
```

variant 扩展：`'compact'`（仅 "邮" 字，平板折叠侧栏用），`'horizontal'`（中文+英文横排，TopBar 用）

#### 改动点清单

| 文件 | 改动 |
|------|------|
| `components/Shell/LeftSidebar.jsx` | Logo 占位区 → `<LogoText variant="default" />`（xl 展开）/ `<LogoText variant="compact" />`（md 折叠） |
| `components/Shell/TopBar.jsx` | Logo 占位区 → `<LogoText variant="horizontal" />` |
| `components/Shell/MobileMenuOverlay.jsx` | Logo 占位区 → `<LogoText variant="default" />` |
| `pages/LoginPage.jsx` | "VOYAGE" → `<LogoText />` + slogan |
| `pages/HomePage.jsx` | Hero 标题 "发现属于你的旅程" → "留下你的轨迹" |

---

## 2. 色彩体系：从冷白到暖色

### 2.1 设计理念

当前方案是 Aman.com 式的极致黑白留白——白底、黑字、灰边框。邮迹面向的是大学生用户群体，需要保持**清新简约**的基调，但注入**温暖、活力**的感觉。

方向：**暖调纸质感** — 像是印在暖白纸上的旅行手账。

### 2.2 色彩变量对照表

在 `index.css` 中修改 `@theme` 块：

| 变量名 | 旧值 | 新值 | 说明 |
|--------|------|------|------|
| `--color-surface` | `#fafafa` | `#faf8f5` | 暖白底色（替代纯白背景区） |
| `--color-border` | `#e5e5e5` | `#e8e0d5` | 暖灰边框 |
| `--color-muted` | `#a3a3a3` | `#b8a99a` | 暖褐色次要文字 |
| `--color-body` | `#404040` | `#4a3f35` | 暖棕正文 |
| `--color-heading` | `#0a0a0a` | `#2c2416` | 深棕标题（非纯黑） |
| `--color-accent` | `#b8945a` | `#c77d4b` | 赤陶橙强调色（更年轻活力） |
| `--color-accent-soft` | *(新增)* | `#f5ebe0` | 暖色浅底（替代 bg-neutral-50） |
| `--color-warm` | *(新增)* | `#e8b96d` | 暖金色点缀 |

### 2.3 背景色替换规则

| 场景 | 旧类名 | 新类名 |
|------|--------|--------|
| 页面主背景 | `bg-white` | `bg-surface` |
| 卡片/侧栏背景 | `bg-white` | `bg-surface` |
| 分区浅色背景 | `bg-neutral-50` / `bg-[#fafafa]` | `bg-accent-soft` |
| 边框 | `border-neutral-100` / `border-[#f0f0f0]` | `border-border` |
| 分割线 | `border-neutral-100` | `border-border` |
| 骨架屏 | `bg-[#f0f0f0]` | `bg-accent-soft` |

### 2.4 `index.css` 最终 `@theme` 块

```css
@theme {
  --font-serif: "Noto Serif SC", Georgia, "Times New Roman", serif;
  --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
  --font-mono: "SF Mono", "Fira Code", "Cascadia Code", monospace;

  --color-accent: #c77d4b;
  --color-accent-soft: #f5ebe0;
  --color-warm: #e8b96d;
  --color-surface: #faf8f5;
  --color-border: #e8e0d5;
  --color-muted: #b8a99a;
  --color-body: #4a3f35;
  --color-heading: #2c2416;

  --spacing-section-gap-lg: 8rem;
  --spacing-module-gap: 4rem;
}
```

### 2.5 CTAButton 新增变体

在 `CTAButton.jsx` 中增加 `variant="accent"`：

```jsx
accent: 'bg-accent text-white hover:opacity-90 active:scale-[0.98]',
```

用于首页 Hero 的主操作按钮，替代现有的 outline 白色按钮。

---

## 3. 新增页面：Loading 启动页

### 3.1 页面定位

- **路由**：无路由路径，作为 App 加载时的过渡页
- **显示时机**：打开网站 → Loading 页（1.5s 动画后自动过渡）
- **功能**：品牌展示 + 右上角登录入口

### 3.2 视觉设计

```
┌──────────────────────────────────────────┐
│                                    [登录] │  ← 右上角登录按钮
│                                          │
│                                          │
│                邮  迹                     │  ← 中文大字，fade-in
│               YOUJI                      │  ← 英文小字，延迟出现
│                                          │
│           留下你的轨迹                     │  ← slogan，延迟出现
│                                          │
│            ─────  ●  ─────               │  ← 底部呼吸动画指示器
│                                          │
└──────────────────────────────────────────┘
```

- 背景色 `bg-surface`（暖白）
- 中心品牌文字有入场动画序列
- 底部中央一个呼吸光点 + 水平细线（加载指示器）
- 右上角 "登录" 文字按钮（`text-sm text-muted hover:text-heading`）

### 3.3 交互逻辑

1. 页面 mount → 文字序列动画播放（总时长 ~1.2s）
2. 动画完成后，停留 0.3s，然后检查 localStorage 是否有有效 token
3. 有 token → 自动验证 → 成功则直接进入系统
4. 无 token / 验证失败 → 保持在 Loading 页（用户可点击右上角"登录"）
5. 点击右上角"登录" → 切换到 LoginPage
6. 登录成功 → 进入系统

### 3.4 实现文件

**新增文件**: `src/pages/LoadingPage.jsx`（~60 行）

```jsx
// 核心状态: animationPhase ('enter' | 'hold' | 'exit')
// 动画序列用 setTimeout 控制（避免复杂状态机）
// Props: onEnterSystem, onGoLogin
```

#### 动画序列时间线

| 时间 | 事件 |
|------|------|
| 0ms | "邮迹" 中文 fade-in-up (0.6s) |
| 400ms | "YOUJI" 英文 fade-in-up (0.5s) |
| 700ms | "留下你的轨迹" slogan fade-in (0.4s) |
| 1200ms | 底部指示器开始呼吸动画 |
| 1500ms | 尝试自动登录（若 token 存在） |
| 自动登录成功 | 触发 onEnterSystem |
| 自动登录失败 | 保持当前页，用户手动点登录 |

#### 右上角登录按钮

```jsx
<button
  onClick={onGoLogin}
  className="fixed top-6 right-6 z-50 text-sm text-muted hover:text-heading transition-colors duration-300"
>
  登录
</button>
```

### 3.5 App.jsx 改动

App 的认证流程从两段式改为三段式：

```
旧: 未登录 → LoginPage
    已登录 → 系统

新: loading=true → LoadingPage (带右上角登录入口)
    未登录     → LoginPage
    已登录     → 系统
```

**`App.jsx` 改动** (~15 行改动):

```jsx
// 新增 loading 阶段判断
const [appPhase, setAppPhase] = useState('loading'); // 'loading' | 'login' | 'app'

if (appPhase === 'loading') {
  return (
    <LoadingPage
      onAutoEnter={() => setAppPhase('app')}
      onGoLogin={() => setAppPhase('login')}
    />
  );
}

if (!isLoggedIn || appPhase === 'login') {
  return <LoginPage onLoginSuccess={(userData) => { login(userData); setAppPhase('app'); navigate('/'); }} />;
}
```

**`useAuth` hook 微调**：暴露 `tryAutoLogin()` 方法供 LoadingPage 调用。

---

## 4. 登录页面优化

### 4.1 改动点

基于现有 `LoginPage.jsx`，做以下调整：

1. **"VOYAGE" → `<LogoText />`** 组件
2. **背景色**：`bg-neutral-50` → `bg-surface`
3. **卡片**：`bg-white` → `bg-surface`，增加微妙的 `shadow-sm`（仅登录卡片需要轻微浮起）
4. **输入框**：边框色 `border-neutral-200` → `border-border`，focus 态 `border-accent`（用暖色替代黑色）
5. **提交按钮**：CTAButton variant 改为 `accent`
6. **测试账号区**：背景 `bg-neutral-50` → `bg-accent-soft`
7. **增加返回按钮**：左上角 "← 返回" 可回到 Loading 页

### 4.2 改动量评估

- 约 15 行修改（类名替换 + Logo 替换）
- 不改动表单逻辑、验证逻辑、API 调用

---

## 5. 首页动态效果增强

### 5.1 设计思路

参考 Apple 官网的产品展示页，核心手法：
- **大图/大文字** + 极简背景
- **滚动视差**（简单 CSS translateY）
- **渐现动画**（已有 `whileInView`，保持）
- **微妙的背景光晕/渐变**（纯 CSS，无 JS）

不做：复杂 3D 滚动、WebGL、大量粒子。

### 5.2 Hero 区域改造

#### 5.2.1 背景

当前是纯 `bg-neutral-100` 灰色背景。改为：

```jsx
// 暖色渐变背景 + 可选几何图形装饰
<section className="relative w-full h-[70vh] min-h-[500px] flex items-center justify-center overflow-hidden"
  style={{
    background: 'linear-gradient(160deg, #f5ebe0 0%, #faf8f5 30%, #ede4d3 100%)',
  }}
>
  {/* 右上角大圆光晕 */}
  <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-accent/5 blur-3xl pointer-events-none" />
  {/* 左下角光晕 */}
  <div className="absolute -bottom-20 -left-20 w-[300px] h-[300px] rounded-full bg-warm/10 blur-3xl pointer-events-none" />
```

#### 5.2.2 Hero 文字

标题从 "发现属于你的旅程" → **"留下你的轨迹"**

增加一个微妙的 CSS 动画：标题有一个非常慢的浮动感（纯 CSS `@keyframes`）

```css
@keyframes gentleFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
.hero-float {
  animation: gentleFloat 6s ease-in-out infinite;
}
```

### 5.3 滚动视差（纯 CSS）

对 Hero 区域使用简单的视差效果（不需要 JS 库）：

```css
.parallax-subtle {
  /* 在 scroll 时，通过 transform 产生微小的视差感 */
  /* 使用 css animation-timeline: scroll() 或 JS 简单实现 */
}
```

**推荐方案**：在 `HomePage` 的 Hero section 中，使用 framer-motion 的 `useScroll` + `useTransform` 做一个简单的 Y 轴偏移（Hero 文字随滚动略微上移）。

### 5.4 统计卡片微交互

当前统计卡片是静态的 `bg-white border`。增加：

```jsx
// 数字滚动效果（count-up）
// 使用简单的 useEffect + setInterval 从 0 递增到目标值
<motion.span
  initial={{ opacity: 0 }}
  whileInView={{ opacity: 1 }}
>
  {animatedCount}
</motion.span>
```

### 5.5 卡片 hover 效果增强

`ImageCard` 和日记卡片已有 `group-hover:brightness-[0.92]` 和 `group-hover:scale-105`。

增加一个微妙的上浮阴影（仅 hover 时）：

```css
.card-hover-lift {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  box-shadow: 0 0 0 0 rgba(0,0,0,0);
}
.card-hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.06);
}
```

### 5.6 首页改动量评估

- Hero 背景 + 文字 + 光晕：~20 行改动
- 统计数字动画：~15 行新增
- 卡片 hover：加一个 CSS 类，~5 行
- 无结构性改动

---

## 6. 全局布局微调

### 6.1 问题

- 当前 `bg-white` 大面积使用，视觉单调
- 内容区右边距和 RightPanel 之前缺乏呼吸感
- 页面 section 间距可以更灵活

### 6.2 改动

| 改动项 | 旧 | 新 |
|--------|-----|-----|
| 全局背景 | `bg-white` | `bg-surface` |
| LeftSidebar 背景 | `bg-white` | `bg-surface` + 右侧边框 `border-border` |
| RightPanel 背景 | `bg-white` | `bg-surface` + 左侧边框 `border-border` |
| 主内容区 | 无背景色 | `bg-surface` |
| 页面 section 间距 | `py-24 md:py-32` | `py-16 md:py-24`（略减小，适应用户浏览节奏） |

### 6.3 侧栏宽度

保持现有规则：

| 宽度 | Sidebar | RightPanel |
|------|---------|------------|
| < 768px | 隐藏（通过汉堡菜单） | 隐藏 |
| 768-1279px | 64px (仅图标) | 隐藏 |
| ≥ 1280px | 240px | 隐藏（改为可选） |

RightPanel 默认隐藏（减少视觉噪音），用户中心内容合并到 `/profile` 路由页面。

### 6.4 `App.jsx` 中 RightPanel 的改动

```jsx
// 旧:
<RightPanel ... className="hidden xl:block" />

// 新: 去掉 RightPanel，内容区直接撑满
// 用户信息通过 LeftSidebar 底部 + /profile 页面访问
```

如果保留 RightPanel，至少去掉 `sticky` → 改为 `fixed`，避免影响内容区滚动。

---

## 7. 动态交互设计清单

### 7.1 全局交互（CSS 级，零 JS 成本）

| 效果 | 位置 | 实现 |
|------|------|------|
| 页面切换过渡 | `App.jsx` → `<AnimatePresence>` | 已有，保持 |
| 链接/按钮 hover 变色 | 全局 | `transition-colors duration-200` |
| 卡片 hover 上浮 | `ImageCard`、日记卡片 | `.card-hover-lift` CSS 类 |
| 图片 hover 缩放 | 日记封面、地点图片 | `group-hover:scale-105` (已有) |

### 7.2 页面级动效（framer-motion）

| 效果 | 位置 | 实现 |
|------|------|------|
| Loading 页文字序列动画 | `LoadingPage.jsx` | `motion.div` + `animate` + `transition.delay` |
| Hero 光晕呼吸 | `HomePage.jsx` Hero | CSS `@keyframes pulse`，6s 周期 |
| Hero 文字浮动 | `HomePage.jsx` | CSS `gentleFloat` 动画 |
| 统计数字递增 | `HomePage.jsx` 统计区 | `useEffect` + `setInterval` + `useState` |
| Sidebar 激活指示器滑动 | `LeftSidebar.jsx` | `motion.div layoutId` (已有) |
| 移动端菜单滑入 | `MobileMenuOverlay.jsx` | `motion.aside` (已有) |

### 7.3 不做

- ❌ 不引入粒子效果库（如 tsParticles）
- ❌ 不做鼠标跟随效果（增加性能负担）
- ❌ 不做页面级的滚动劫持（影响无障碍和性能）
- ❌ 不引入 Three.js / WebGL

---

## 8. 实现顺序（按优先级）

### 第一阶段：品牌 + 色彩（基础改动，~1h）

```
1. index.css — 修改 @theme 色彩变量
2. LogoText.jsx — 新增品牌文字组件
3. LeftSidebar.jsx — 替换 Logo 占位
4. TopBar.jsx — 替换 Logo 占位
5. MobileMenuOverlay.jsx — 替换 Logo 占位
6. LoginPage.jsx — 替换 VOYAGE + 色彩调整
7. App.jsx — bg-white → bg-surface、RightPanel 调整
```

**验证**：启动前端，所有页面背景色统一为暖色调，Logo 显示 "邮迹"

### 第二阶段：Loading 页 + 登录流程（~1h）

```
8. LoadingPage.jsx — 新增
9. App.jsx — 三段式认证流程改造
10. useAuth.js — 暴露 tryAutoLogin
11. LoginPage.jsx — 增加返回按钮
```

**验证**：刷新页面 → Loading 动画 → 自动登录/手动登录 → 进入系统

### 第三阶段：首页动效（~1.5h）

```
12. HomePage.jsx — Hero 背景渐变/光晕 + 文字替换 + 统计动画
13. index.css — 新增 @keyframes gentleFloat + card-hover-lift
14. ImageCard.jsx — 增加 card-hover-lift 类
```

**验证**：首页 Hero 有暖色渐变 + 光晕，卡片 hover 有上浮感

### 第四阶段：收尾验证（~0.5h）

```
15. 全局检查 — 搜索 bg-white 残留，逐页确认颜色一致
16. 删除未使用的 RightPanel 引用（如果决定去掉）
17. 验证所有路由页面正常显示
```

---

## 9. 改动量统计

| 类型 | 数量 | 说明 |
|------|------|------|
| 新增文件 | 2 | `LoadingPage.jsx`, `LogoText.jsx` |
| 修改文件 | ~10 | `index.css`, `App.jsx`, Shell×4, LoginPage, HomePage, CTAButton, ImageCard, useAuth |
| 不改动文件 | ~20+ | 其余所有页面组件、API 层、Map 组件、Chat 组件、UI 组件（除上述） |
| 总代码量 | +150 行 / -30 行 | 净增约 120 行 |

---

## 10. 设计决策记录

| 决策 | 理由 |
|------|------|
| 保留 Noto Serif SC 作为标题字体 | 中文字体选择少，Noto Serif SC 是 Google Fonts 中最好的中文衬线体，且已有 CDN 引入 |
| 保留 Inter 作为正文字体 | 已在项目中配置，与暖色调搭配效果好 |
| 暖色替代纯白而非改为暗色模式 | 用户群体（大学生）偏好明亮清新的风格，暗色模式改动量大 |
| Loading 页 1.5s 动画 | 足够展示品牌但不至于让用户等待 |
| logo 纯文字不用图片 | 减少依赖，方便维护，文字标在极简风格中效果好 |
| 不做粒子效果 | 保持性能，避免过度设计，"简单动态交互"即可 |
| RightPanel 移除 | 减少视觉噪音，用户信息在 Sidebar 底部 + /profile 页面即可 |
