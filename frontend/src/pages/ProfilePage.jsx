import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  User, Unlink, Copy, CheckCircle, XCircle, Clock, AlertCircle,
  ExternalLink, Shield, RefreshCw, Trash2, Sparkles,
} from 'lucide-react';
import { getXhsStatus, bindXhsAccount, unbindXhsAccount } from '../services/api';

function ProfilePage() {
  const [user, setUser] = useState(null);
  const [xhsStatus, setXhsStatus] = useState(null);
  const [xhsLoading, setXhsLoading] = useState(false);
  const [showBindModal, setShowBindModal] = useState(false);
  const [cookieInput, setCookieInput] = useState('');
  const [bindError, setBindError] = useState('');
  const [bindLoading, setBindLoading] = useState(false);
  const [unbindConfirm, setUnbindConfirm] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch { setUser({}); }
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadXhsStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadXhsStatus = async () => {
    setXhsLoading(true);
    try {
      const res = await getXhsStatus(user.id);
      if (res.success && res.data) {
        setXhsStatus(res.data);
      } else {
        setXhsStatus({ bound: false });
      }
    } catch {
      setXhsStatus({ bound: false });
    } finally {
      setXhsLoading(false);
    }
  };

  const handleBind = async () => {
    if (!cookieInput.trim()) {
      setBindError('请粘贴 Cookie 字符串');
      return;
    }
    setBindLoading(true);
    setBindError('');
    try {
      const res = await bindXhsAccount(user.id, cookieInput.trim());
      if (res.success && res.data?.ok) {
        showToast('success', `已绑定 @${res.data.xhs_username || '小红书账号'}`);
        setShowBindModal(false);
        setCookieInput('');
        loadXhsStatus();
      } else {
        setBindError(res.data?.error || res.message || 'Cookie 无效，请重新获取');
      }
    } catch {
      setBindError('绑定失败，请检查网络后重试');
    } finally {
      setBindLoading(false);
    }
  };

  // ── Cookie 自动清洗 ──
  const cleanCookie = () => {
    const raw = cookieInput.trim();
    if (!raw) return;

    const lines = raw.split(/\r?\n/).filter(line => line.trim());
    const pairs = [];

    for (const line of lines) {
      // 已经是 name=value 格式 → 直接提取
      const eqMatch = line.match(/^(\S+?)\s*=\s*(\S+)/);
      if (eqMatch && !line.includes('\t')) {
        pairs.push(`${eqMatch[1]}=${eqMatch[2]}`);
        continue;
      }

      // Chrome DevTools 表格格式 (Tab 分隔)
      if (line.includes('\t')) {
        const cols = line.split('\t').map(c => c.trim()).filter(Boolean);
        if (cols.length >= 2) {
          // 第一列是 name，第二列是 value，跳过其他列
          pairs.push(`${cols[0]}=${cols[1]}`);
        }
        continue;
      }

      // 多空格分隔格式 (回退)
      const parts = line.split(/\s{2,}/);
      if (parts.length >= 2) {
        pairs.push(`${parts[0].trim()}=${parts[1].trim()}`);
      }
    }

    if (pairs.length > 0) {
      setCookieInput(pairs.join('; '));
      setBindError('');
    }
  };

  const handleUnbind = async () => {
    try {
      const res = await unbindXhsAccount(user.id);
      if (res.success) {
        showToast('success', '已解除小红书账号绑定');
        setUnbindConfirm(false);
        loadXhsStatus();
      } else {
        showToast('error', res.message || '解绑失败');
      }
    } catch {
      showToast('error', '解绑失败，请稍后重试');
    }
  };

  // ── Status helpers ──
  const getStatusConfig = () => {
    if (!xhsStatus?.bound) {
      return { icon: <Unlink size={18} />, color: 'text-muted', bg: 'bg-neutral-100',
        label: '未绑定', desc: '绑定后可将日记一键发布到小红书' };
    }
    const lastValidated = xhsStatus.last_validated_at;
    if (lastValidated) {
      const hrs = (Date.now() - new Date(lastValidated).getTime()) / 3600000;
      if (hrs > 1) {
        return { icon: <Clock size={18} />, color: 'text-amber-500', bg: 'bg-amber-50',
          label: '可能已失效', desc: '超过 1 小时未验证，发布前会自动重新验证' };
      }
    }
    return { icon: <CheckCircle size={18} />, color: 'text-green-600', bg: 'bg-green-50',
      label: '已连接', desc: `上次验证: ${lastValidated ? new Date(lastValidated).toLocaleString('zh-CN') : '—'}` };
  };

  const statusCfg = getStatusConfig();

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-sans ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      <h1 className="font-serif text-2xl text-heading mb-8">个人中心</h1>

      {/* ── User Profile ── */}
      <section className="border border-border bg-surface mb-8">
        <div className="px-6 py-5 border-b border-border flex items-center gap-3">
          <User size={18} className="text-muted" />
          <h2 className="font-serif text-base text-heading">个人信息</h2>
        </div>
        <div className="px-6 py-4">
          <dl className="space-y-4">
            <div className="flex gap-4 py-2 border-b border-border/50">
              <dt className="font-sans text-xs uppercase tracking-widest text-muted w-24 flex-shrink-0">用户名</dt>
              <dd className="font-sans text-sm text-body">{user?.username || user?.name || '未命名用户'}</dd>
            </div>
            <div className="flex gap-4 py-2 border-b border-border/50">
              <dt className="font-sans text-xs uppercase tracking-widest text-muted w-24 flex-shrink-0">兴趣标签</dt>
              <dd className="font-sans text-sm text-body">
                {(user?.interests || []).length > 0
                  ? (user.interests || []).map(item => (
                      <span key={item} className="inline-block px-2.5 py-0.5 mr-1.5 mb-1 text-xs bg-accent-soft border border-border rounded-full">
                        {item}
                      </span>
                    ))
                  : <span className="text-muted/60">暂无</span>}
              </dd>
            </div>
            <div className="flex gap-4 py-2">
              <dt className="font-sans text-xs uppercase tracking-widest text-muted w-24 flex-shrink-0">偏好分类</dt>
              <dd className="font-sans text-sm text-body">
                {(user?.favoriteCategories || []).length > 0
                  ? (user.favoriteCategories || []).map(item => (
                      <span key={item} className="inline-block px-2.5 py-0.5 mr-1.5 mb-1 text-xs bg-accent-soft border border-border rounded-full">
                        {item}
                      </span>
                    ))
                  : <span className="text-muted/60">暂无</span>}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ── XHS Account Binding ── */}
      <section className="border border-border bg-surface">
        <div className="px-6 py-5 border-b border-border flex items-center gap-3">
          <span className="text-lg">📕</span>
          <h2 className="font-serif text-base text-heading">小红书账号绑定</h2>
        </div>

        <div className="px-6 py-4">
          {xhsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted py-4">
              <div className="w-4 h-4 border-2 border-border border-t-accent rounded-full animate-spin" />
              加载中...
            </div>
          ) : (
            <>
              {/* Status display */}
              <div className={`flex items-start gap-4 p-4 rounded-xl ${statusCfg.bg} mb-4`}>
                <div className={`mt-0.5 ${statusCfg.color}`}>{statusCfg.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className={`font-sans text-sm font-semibold ${statusCfg.color}`}>
                    {xhsStatus?.bound ? `@${xhsStatus.xhs_username || '小红书用户'}` : statusCfg.label}
                  </p>
                  <p className="text-xs text-muted mt-0.5">{statusCfg.desc}</p>
                  {xhsStatus?.bound && xhsStatus.xhs_avatar && (
                    <img src={xhsStatus.xhs_avatar} alt="" className="w-8 h-8 rounded-full mt-2 border border-border" />
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                {xhsStatus?.bound ? (
                  <>
                    <button
                      onClick={loadXhsStatus}
                      disabled={xhsLoading}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-sans border border-border rounded-lg hover:bg-accent-soft transition-colors"
                    >
                      <RefreshCw size={13} className={xhsLoading ? 'animate-spin' : ''} />
                      刷新状态
                    </button>
                    {!unbindConfirm ? (
                      <button
                        onClick={() => setUnbindConfirm(true)}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-sans border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={13} />
                        解除绑定
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-600">确定解除？</span>
                        <button
                          onClick={handleUnbind}
                          className="px-3 py-1.5 text-xs font-sans bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                          确认
                        </button>
                        <button
                          onClick={() => setUnbindConfirm(false)}
                          className="px-3 py-1.5 text-xs font-sans border border-border rounded-lg hover:bg-accent-soft transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => { setShowBindModal(true); setBindError(''); setCookieInput(''); }}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-sans bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
                  >
                    <ExternalLink size={13} />
                    绑定小红书账号
                  </button>
                )}
              </div>

              {/* Help text */}
              <p className="text-xs text-muted/60 mt-4 flex items-center gap-1">
                <Shield size={11} />
                Cookie 经 AES-256-GCM 加密存储，不会泄露给任何人
              </p>
            </>
          )}
        </div>
      </section>

      {/* ── Bind Modal ── */}
      {showBindModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
             onClick={(e) => { if (e.target === e.currentTarget) setShowBindModal(false); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
               onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">📕</span>
                <h3 className="font-serif text-lg text-heading">绑定小红书账号</h3>
              </div>
              <button onClick={() => setShowBindModal(false)}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors">
                <XCircle size={18} className="text-muted" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Steps */}
              <div>
                <p className="text-sm text-body font-medium mb-3">📋 操作步骤</p>
                <ol className="space-y-2 text-sm text-body">
                  <li className="flex gap-2">
                    <span className="font-bold text-accent flex-shrink-0">1.</span>
                    在浏览器打开 <a href="https://creator.xiaohongshu.com" target="_blank" rel="noopener noreferrer"
                      className="text-accent underline">creator.xiaohongshu.com</a>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-accent flex-shrink-0">2.</span>
                    使用你的小红书账号扫码或密码登录
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-accent flex-shrink-0">3.</span>
                    按 <kbd className="px-1.5 py-0.5 text-xs bg-neutral-100 border border-border rounded">F12</kbd> →
                    点击 <strong>Application</strong> 标签 → 左侧 <strong>Cookies</strong> →
                    点击域名 → 全选所有 Cookie → 右键 <strong>Copy</strong>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-accent flex-shrink-0">4.</span>
                    粘贴到下方输入框，点击<span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-1 text-xs bg-amber-50 border border-amber-200 rounded"><Sparkles size={10} className="text-amber-500" />一键清洗</span>，再点击"验证并绑定"
                  </li>
                </ol>
              </div>

              {/* Cookie Input */}
              <div>
                <label className="block text-xs font-medium text-heading mb-1.5">
                  Cookie 字符串
                </label>
                <textarea
                  value={cookieInput}
                  onChange={(e) => { setCookieInput(e.target.value); setBindError(''); }}
                  placeholder="a1=...; web_session=...; webId=..."
                  rows={4}
                  className="w-full px-3 py-2 text-xs font-mono border border-border rounded-lg resize-none
                             focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent
                             placeholder:text-muted/40"
                />
                {/* Cookie 自动清洗按钮 */}
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={cleanCookie}
                    disabled={!cookieInput.trim()}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-sans border border-amber-200 text-amber-700 bg-amber-50 rounded-lg
                               hover:bg-amber-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Sparkles size={12} />
                    一键清洗
                  </button>
                  <span className="text-xs text-muted/40">
                    支持 Chrome DevTools 复制的表格格式
                  </span>
                </div>
                {bindError && (
                  <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500">
                    <AlertCircle size={12} /> {bindError}
                  </p>
                )}
              </div>

              {/* Security notice */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
                <Shield size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  Cookie 将使用 AES-256-GCM 加密存储，仅用于发布日记到你的小红书账号。
                  我们不会将 Cookie 用于任何其他目的，也不会分享给第三方。
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
              <button
                onClick={() => setShowBindModal(false)}
                className="px-4 py-2 text-sm font-sans border border-border rounded-lg hover:bg-neutral-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleBind}
                disabled={bindLoading || !cookieInput.trim()}
                className="px-5 py-2 text-sm font-sans bg-rose-600 text-white rounded-lg
                           hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {bindLoading ? (
                  <span className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    验证中...
                  </span>
                ) : '验证并绑定'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfilePage;
