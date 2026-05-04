import { KeyRound, Save, ShieldCheck, UserRoundPen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useUserSession } from '../app/user-session';
import { changeAccountPassword, updateAccountProfile } from '../lib/api';

export function SettingsPage() {
  const { user, refreshSession } = useUserSession();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [error, setError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    setDisplayName(user?.display_name ?? '');
    setUsername(user?.username ?? '');
  }, [user?.display_name, user?.username]);

  async function handleSaveProfile() {
    setError('');
    setProfileMessage('');
    setIsSavingProfile(true);

    try {
      await updateAccountProfile({
        display_name: displayName.trim(),
        username: username.trim(),
      });
      await refreshSession();
      setProfileMessage('账号资料已更新');
    } catch (saveError) {
      if (saveError instanceof Error) {
        setError(saveError.message);
      }
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    setError('');
    setPasswordMessage('');
    setIsSavingPassword(true);

    try {
      await changeAccountPassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setPasswordMessage('密码已更新');
    } catch (changeError) {
      if (changeError instanceof Error) {
        setError(changeError.message);
      }
    } finally {
      setIsSavingPassword(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel-strong rounded-[32px] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white dark:bg-white dark:text-slate-950">
              <ShieldCheck className="h-3.5 w-3.5" />
              Account Settings
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
              账号设置
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              在这里维护你的账号资料、登录名称和密码。所有项目、学习记录和导出内容都会继续绑定到当前账号。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: '账号名', value: user?.username ?? '--' },
              { label: '项目数量', value: `${user?.project_count ?? 0}` },
              {
                label: '最近登录',
                value: user?.last_login_at ? new Date(user.last_login_at).toLocaleString() : '--',
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[24px] border border-white/10 bg-white/70 px-5 py-4 dark:bg-white/5"
              >
                <div className="text-sm text-slate-500 dark:text-slate-400">{item.label}</div>
                <div className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="glass-panel rounded-[32px] p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <UserRoundPen className="h-5 w-5 text-cyan-500" />
            <div>
              <div className="text-lg font-semibold text-slate-950 dark:text-white">资料维护</div>
              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                修改你的显示名称和登录账号名。
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <label className="block">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200">显示名称</div>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="mt-2 w-full rounded-[22px] border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:border-white/20"
              />
            </label>

            <label className="block">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200">账号名</div>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-2 w-full rounded-[22px] border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:border-white/20"
              />
            </label>
          </div>

          {profileMessage ? (
            <div className="mt-5 rounded-[22px] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">
              {profileMessage}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void handleSaveProfile()}
            disabled={isSavingProfile || !displayName.trim() || !username.trim()}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950"
          >
            <Save className="h-4 w-4" />
            {isSavingProfile ? '保存中...' : '保存资料'}
          </button>
        </section>

        <section className="glass-panel rounded-[32px] p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <KeyRound className="h-5 w-5 text-amber-500" />
            <div>
              <div className="text-lg font-semibold text-slate-950 dark:text-white">修改密码</div>
              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                为了账号安全，修改密码时需要输入当前密码。
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <label className="block">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200">当前密码</div>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="mt-2 w-full rounded-[22px] border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:border-white/20"
              />
            </label>

            <label className="block">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200">新密码</div>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="mt-2 w-full rounded-[22px] border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:border-white/20"
              />
            </label>
          </div>

          {passwordMessage ? (
            <div className="mt-5 rounded-[22px] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">
              {passwordMessage}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void handleChangePassword()}
            disabled={isSavingPassword || !currentPassword || !newPassword}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20 dark:hover:text-white"
          >
            <KeyRound className="h-4 w-4" />
            {isSavingPassword ? '更新中...' : '更新密码'}
          </button>
        </section>
      </section>

      {error ? (
        <div className="rounded-[28px] border border-rose-500/20 bg-rose-500/10 px-6 py-5 text-sm text-rose-700 dark:text-rose-200">
          {error}
        </div>
      ) : null}
    </div>
  );
}
