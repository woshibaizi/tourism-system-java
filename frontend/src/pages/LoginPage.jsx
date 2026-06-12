import React, { useState } from 'react';
import { User, Lock, LogIn, ArrowLeft } from 'lucide-react';
import { login, register } from '../services/api';
import { useToast } from '../components/ui/Toast';
import CTAButton from '../components/ui/CTAButton';
import LogoText from '../components/ui/LogoText';

function LoginPage({ onLoginSuccess, onBack }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const { showToast } = useToast();

  const clearErrors = () => {
    setSubmitError('');
    setErrors({});
  };

  const showLoginError = (messageText = '登录失败，请稍后重试') => {
    if (messageText.includes('用户名或密码错误') || messageText.includes('密码错误')) {
      setErrors({ password: '用户名或密码错误，请重新输入' });
      setSubmitError('用户名或密码错误，请检查后重新登录');
      return;
    }
    setSubmitError(messageText);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!username.trim()) newErrors.username = '请输入用户名';
    if (!password.trim()) newErrors.password = '请输入密码';
    if (!confirmPassword.trim()) newErrors.confirmPassword = '请确认密码';
    if (password && confirmPassword && password !== confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致';
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSubmitError('请检查输入');
      return;
    }

    setLoading(true);
    clearErrors();

    try {
      const response = await register({ username: username.trim(), password });
      if (response.data?.code === 200 || response.status === 200) {
        showToast('success', '注册成功！请登录');
        setMode('login');
        setPassword('');
        setConfirmPassword('');
      } else {
        const msg = response.data?.message || response.message || '注册失败';
        setSubmitError(msg);
      }
    } catch (error) {
      const msg = error.response?.data?.message || '注册失败，请稍后重试';
      setSubmitError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!username.trim()) newErrors.username = '请输入用户名';
    if (!password.trim()) newErrors.password = '请输入密码';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSubmitError('请填写完整的用户名和密码');
      return;
    }

    setLoading(true);
    clearErrors();

    try {
      const response = await login({ username: username.trim(), password });
      if (response.success) {
        showToast('success', '登录成功！');
        onLoginSuccess(response.data);
      } else {
        showLoginError(response.message || '登录失败');
      }
    } catch (error) {
      showLoginError(error.response?.data?.message || '网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-6 relative">
      {onBack && (
        <button
          onClick={onBack}
          className="absolute top-6 left-6 flex items-center gap-1.5 text-sm text-muted hover:text-heading transition-colors"
        >
          <ArrowLeft size={16} />
          返回
        </button>
      )}

      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <LogoText className="mb-3" />
          <p className="font-sans text-sm text-muted">留下你的轨迹，记录美好时光</p>
        </div>

        <div className="bg-surface border border-border shadow-sm p-8">
          {/* 登录/注册切换 */}
          <div className="flex border border-border mb-8">
            <button
              type="button"
              onClick={() => { setMode('login'); clearErrors(); }}
              className={`flex-1 py-2.5 text-sm font-sans font-medium transition-colors ${
                mode === 'login'
                  ? 'bg-accent text-white'
                  : 'bg-surface text-muted hover:text-heading'
              }`}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); clearErrors(); }}
              className={`flex-1 py-2.5 text-sm font-sans font-medium transition-colors ${
                mode === 'register'
                  ? 'bg-accent text-white'
                  : 'bg-surface text-muted hover:text-heading'
              }`}
            >
              注册
            </button>
          </div>

          <form onSubmit={mode === 'login' ? handleSubmit : handleRegister} className="space-y-6">
            <div>
              <label className="block font-sans text-xs uppercase tracking-widest text-heading mb-2">
                用户名
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); clearErrors(); }}
                  placeholder="请输入用户名"
                  className="w-full pl-10 pr-4 py-3 border border-border bg-surface text-sm font-sans focus:border-accent focus:ring-0 focus:outline-none transition-colors placeholder:text-muted/60"
                />
              </div>
              {errors.username && (
                <p className="text-red-500 text-xs mt-1">{errors.username}</p>
              )}
            </div>

            <div>
              <label className="block font-sans text-xs uppercase tracking-widest text-heading mb-2">
                密码
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearErrors(); }}
                  placeholder="请输入密码"
                  className="w-full pl-10 pr-4 py-3 border border-border bg-surface text-sm font-sans focus:border-accent focus:ring-0 focus:outline-none transition-colors placeholder:text-muted/60"
                />
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password}</p>
              )}
            </div>

            {mode === 'register' && (
              <div>
                <label className="block font-sans text-xs uppercase tracking-widest text-heading mb-2">
                  确认密码
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); clearErrors(); }}
                    placeholder="请再次输入密码"
                    className="w-full pl-10 pr-4 py-3 border border-border bg-surface text-sm font-sans focus:border-accent focus:ring-0 focus:outline-none transition-colors placeholder:text-muted/60"
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
                )}
              </div>
            )}

            {submitError && (
              <p className="text-red-500 text-sm text-center">{submitError}</p>
            )}

            <CTAButton
              type="submit"
              variant="accent"
              size="lg"
              className="w-full justify-center"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {mode === 'login' ? '登录中...' : '注册中...'}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <LogIn size={18} />
                  {mode === 'login' ? '立即登录' : '立即注册'}
                </span>
              )}
            </CTAButton>
          </form>

          {mode === 'login' && (
          <div className="mt-8 p-4 bg-accent-soft border border-border text-center">
            <p className="font-sans text-xs uppercase tracking-widest text-muted mb-2">
              测试账号
            </p>
            <p className="font-sans text-xs text-muted">
              用户名：张三 | 密码：123456
            </p>
            <p className="font-sans text-xs text-muted">
              用户名：李四 | 密码：123456
            </p>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
