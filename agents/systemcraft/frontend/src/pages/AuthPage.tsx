import { LockKeyhole, LogIn, Sparkles, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useUserSession } from '../app/user-session';

type AuthMode = 'login' | 'register';

export function AuthPage() {
  const { loginUser, registerUser, isLoading, error } = useUserSession();
  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  async function handleSubmit() {
    setLocalError('');

    try {
      if (mode === 'register') {
        await registerUser({
          display_name: displayName.trim(),
          username: username.trim(),
          password,
        });
        return;
      }

      await loginUser({
        username: username.trim(),
        password,
      });
    } catch (submitError) {
      if (submitError instanceof Error) {
        setLocalError(submitError.message);
      }
    }
  }

  return (
    <div className="min-h-screen bg-aurora px-4 py-8 text-slate-950 transition-colors dark:bg-aurora-dark dark:text-white sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1080px] items-center justify-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <section className="glass-panel-strong rounded-[36px] p-8 sm:p-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white dark:bg-white dark:text-slate-950">
              <Sparkles className="h-3.5 w-3.5" />
              SystemCraft
            </div>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">
              登录你的工程工作区
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              新用户可以直接创建账号，老用户输入账号密码即可继续之前的项目、学习记录和导出内容。
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                {
                  title: '独立账号',
                  body: '每个账号拥有单独的项目、工作流记录和学习问答。',
                },
                {
                  title: '会话保持',
                  body: '登录后会自动保持会话，刷新页面也不会轻易丢失状态。',
                },
                {
                  title: '项目管理',
                  body: '进入系统后可以在独立的项目管理页查看、筛选和删除项目。',
                },
              ].map((item) => (
                <article
                  key={item.title}
                  className="rounded-[24px] border border-white/10 bg-white/70 px-4 py-4 dark:bg-white/5"
                >
                  <div className="text-sm font-semibold text-slate-950 dark:text-white">
                    {item.title}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {item.body}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="glass-panel rounded-[36px] p-8 sm:p-10">
            <div className="flex gap-2 rounded-full border border-slate-200/80 bg-white/80 p-1 dark:border-white/10 dark:bg-white/5">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                  mode === 'login'
                    ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                    : 'text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                老用户登录
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                  mode === 'register'
                    ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                    : 'text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                新用户注册
              </button>
            </div>

            <div className="mt-8 space-y-5">
              {mode === 'register' ? (
                <label className="block">
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    显示名称
                  </div>
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="例如：张三 / Team Alpha"
                    className="mt-2 w-full rounded-[22px] border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:border-white/20"
                  />
                </label>
              ) : null}

              <label className="block">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200">账号</div>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="请输入用户名"
                  className="mt-2 w-full rounded-[22px] border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:border-white/20"
                />
              </label>

              <label className="block">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200">密码</div>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="至少 6 位"
                  className="mt-2 w-full rounded-[22px] border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:border-white/20"
                />
              </label>
            </div>

            {localError || error ? (
              <div className="mt-5 rounded-[22px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
                {localError || error}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={
                isLoading ||
                !username.trim() ||
                !password ||
                (mode === 'register' && !displayName.trim())
              }
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950"
            >
              {mode === 'register' ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
              {isLoading ? '处理中...' : mode === 'register' ? '创建账号并进入系统' : '登录并进入系统'}
            </button>

            <div className="mt-6 rounded-[24px] border border-dashed border-slate-300/80 px-4 py-4 text-sm leading-6 text-slate-500 dark:border-white/10 dark:text-slate-400">
              <div className="inline-flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                <LockKeyhole className="h-4 w-4" />
                安全说明
              </div>
              <p className="mt-2">
                当前版本使用本地 SQLite 存储账号与密码哈希，适合单机开发和课程演示场景。
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
