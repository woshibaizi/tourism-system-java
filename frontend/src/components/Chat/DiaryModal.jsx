import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  X, ImagePlus, Loader, CheckCircle, AlertCircle, Sparkles,
  RotateCcw, Edit3, Copy, Check, PenLine,
} from 'lucide-react';
import {
  generateDiary, getDiaryTaskStatus, createDiary,
  regenerateDiary, getStylePrefs,
  uploadImage,
} from '../../services/api';
import StyleTuner from './StyleTuner';
import CustomPromptInput from './CustomPromptInput';

/* ================================================================
   三个互斥的风格模式，每次只能选中一个：
   ① 预设  — 选一个预设模板，用它的默认参数
   ② 调参  — 在预设基础上微调各项参数
   ③ 自述  — 自由输入风格描述，直接作为 AI 指令

   发送到后端的 styleProfile：
   - 预设：{ preset: "小红书" }
   - 调参：{ preset: "小红书", tone: "幽默", ... }
   - 自述：{ customPrompt: "用王家卫风格写..." }
   ================================================================ */

const STYLE_MODES = [
  { key: 'preset', label: '预设', icon: '📋', desc: '选模板' },
  { key: 'tuner',  label: '调参', icon: '🎛️', desc: '精细调' },
  { key: 'custom', label: '自述', icon: '✍️', desc: '自由写' },
];

const PRESETS = [
  { key: '小红书', label: '小红书', icon: '📕', desc: '活泼种草 · emoji多 · #标签' },
  { key: '朋友圈', label: '朋友圈', icon: '💬', desc: '轻松随意 · 短小精炼' },
  { key: '游记', label: '游记长文', icon: '📝', desc: '深度记录 · 叙事细腻' },
  { key: '攻略', label: '实用攻略', icon: '📋', desc: '条理清晰 · tips列表' },
  { key: '随笔', label: '文艺随笔', icon: '🎨', desc: '诗意细腻 · 像散文' },
  { key: '幽默吐槽', label: '幽默吐槽', icon: '😂', desc: '风趣幽默 · 接地气' },
];

export default function DiaryModal({ onClose, userId, onDiaryCreated, embedded = false, initialPrompt = '', initialImages = [], onSwitchToManual }) {
  // ---- core state ----
  const [images, setImages] = useState(initialImages);
  const [uploadedPaths, setUploadedPaths] = useState([]); // server-side image paths after upload
  const [prompt, setPrompt] = useState(initialPrompt);

  // ---- unified style state ----
  const [styleMode, setStyleMode] = useState('preset');       // 'preset' | 'tuner' | 'custom'
  const [selectedPreset, setSelectedPreset] = useState('小红书'); // which preset card is selected
  const [tunerProfile, setTunerProfile] = useState({});        // tuner overrides (in tuner mode)
  const [customPrompt, setCustomPrompt] = useState('');        // free text (in custom mode)

  // ---- generation state ----
  const [phase, setPhase] = useState('input');
  const [progress, setProgress] = useState(0);
  const [taskId, setTaskId] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [editingContent, setEditingContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const fileRef = useRef(null);
  const pollRef = useRef(null);
  const navigate = useNavigate();

  // 加载用户上次的风格偏好
  useEffect(() => {
    if (userId) {
      getStylePrefs(userId).then((res) => {
        if (res.success && res.data?.styleProfile) {
          const pref = res.data.styleProfile;
          if (pref.customPrompt) {
            setStyleMode('custom');
            setCustomPrompt(pref.customPrompt);
          } else if (pref.tone || pref.length || pref.emojiDensity) {
            setStyleMode('tuner');
            setSelectedPreset(pref.preset || '小红书');
            setTunerProfile(pref);
          } else if (pref.preset) {
            setStyleMode('preset');
            setSelectedPreset(pref.preset);
          }
        }
      });
    }
  }, [userId]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // ---- build styleProfile for API call ----
  const buildStylePayload = useCallback(() => {
    switch (styleMode) {
      case 'preset':
        return { preset: selectedPreset };
      case 'tuner': {
        const p = { preset: selectedPreset, ...tunerProfile };
        // clean nulls/empties
        Object.keys(p).forEach((k) => {
          if (p[k] == null || p[k] === false) delete p[k];
          if (Array.isArray(p[k]) && p[k].length === 0) delete p[k];
        });
        return p;
      }
      case 'custom':
        return { customPrompt };
      default:
        return null;
    }
  }, [styleMode, selectedPreset, tunerProfile, customPrompt]);

  // ---- image handling ----
  const handleImageAdd = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => setImages((p) => [...p, { file, preview: reader.result }]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };
  const handleRemoveImage = (index) => setImages((p) => p.filter((_, i) => i !== index));

  // ---- polling ----
  const startPolling = useCallback((tid) => {
    pollRef.current = setInterval(async () => {
      try {
        const statusRes = await getDiaryTaskStatus(tid);
        if (!statusRes.success) return;
        const s = statusRes.data;
        if (s.progress != null) setProgress(Math.max(10, Math.min(95, s.progress)));
        if (s.status === 'done' || s.status === 'completed') {
          clearInterval(pollRef.current);
          setProgress(100);
          setResult(s.result || { content: '' });
          setPhase('done');
        } else if (s.status === 'error' || s.status === 'failed') {
          clearInterval(pollRef.current);
          setError(s.error || '日记生成失败');
          setPhase('error');
        }
      } catch { /* keep polling */ }
    }, 1500);
  }, []);

  const runGenerate = async (stylePayloadOverride) => {
    if (!prompt.trim() && images.length === 0) {
      setError('请至少输入一段描述或上传一张图片');
      return;
    }
    setError('');
    setPhase('generating');
    setProgress(5);

    // === 上传图片到服务器 ===
    let imagePaths = uploadedPaths;
    if (images.length > 0 && uploadedPaths.length === 0) {
      try {
        const uploadResults = await Promise.all(
          images.map((img) => uploadImage(img.file))
        );
        imagePaths = uploadResults
          .filter((r) => r.success && r.data?.path)
          .map((r) => r.data.path);
        if (imagePaths.length === 0 && images.length > 0) {
          setError('图片上传失败，请重试');
          setPhase('error');
          return;
        }
        setUploadedPaths(imagePaths);
      } catch {
        setError('图片上传失败，请确认服务已启动');
        setPhase('error');
        return;
      }
    }

    try {
      const sp = stylePayloadOverride || buildStylePayload();
      // style 字段必须和当前模式一致，不能泄漏其他模式的残留值
      let apiStyle;
      if (stylePayloadOverride?.preset) {
        apiStyle = stylePayloadOverride.preset;
      } else if (styleMode === 'custom') {
        apiStyle = '自定义';
      } else {
        apiStyle = selectedPreset || '小红书';
      }
      const res = await generateDiary({
        userId,
        prompt: prompt.trim() || '根据图片生成旅行日记',
        images: imagePaths,
        style: apiStyle,
        styleProfile: sp,
      });
      if (!res.success || !res.data?.taskId) {
        setError(res.message || '生成任务启动失败');
        setPhase('error');
        return;
      }
      setTaskId(res.data.taskId);
      setProgress(15);
      startPolling(res.data.taskId);
    } catch {
      setError('请求失败，请确认服务已启动');
      setPhase('error');
    }
  };

  const handleGenerate = () => runGenerate();

  const handleRegenerate = async (newPreset) => {
    if (!taskId) return;
    setError('');
    setPhase('generating');
    setProgress(5);
    try {
      const sp = { preset: newPreset };
      const res = await regenerateDiary({
        userId,
        originalTaskId: taskId,
        style: newPreset,
        styleProfile: sp,
      });
      if (!res.success || !res.data?.taskId) {
        setError(res.message || '重新生成失败');
        setPhase('error');
        return;
      }
      setSelectedPreset(newPreset);
      setStyleMode('preset');
      setTaskId(res.data.taskId);
      setProgress(15);
      startPolling(res.data.taskId);
    } catch {
      setError('请求失败，请确认服务已启动');
      setPhase('error');
    }
  };

  const handlePublish = async () => {
    const diaryId = result?.diary_id || result?.diaryId;
    // 优先使用已上传的服务器路径，确保图片能正常加载
    const resultImages = result?.images || [];
    const publishImages = uploadedPaths.length > 0 ? uploadedPaths : resultImages;
    if (diaryId) {
      onClose();
      navigate(`/diaries/${diaryId}`);
      return;
    }
    setPhase('publishing');
    try {
      const res = await createDiary({
        title: result?.title || '旅行日记',
        content: editingContent || result?.content || '',
        authorId: String(userId),
        images: publishImages,
        tags: result?.tags || [],
      });
      if (res.success && res.data?.id) {
        onClose();
        navigate(`/diaries/${res.data.id}`);
      } else {
        setError(res.message || '发布失败');
        setPhase('error');
      }
    } catch {
      setError('发布失败，请重试');
      setPhase('error');
    }
  };

  const handleCopy = async () => {
    const text = result?.content || '';
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayContent = editingContent || result?.content || '';

  // ---- style summary for UI ----
  const styleSummary = (() => {
    switch (styleMode) {
      case 'preset': return `${selectedPreset}`;
      case 'tuner': {
        const parts = [selectedPreset];
        if (tunerProfile.tone) parts.push(tunerProfile.tone);
        const lenMap = { short: '短', medium: '中', long: '长' };
        if (tunerProfile.length) parts.push(lenMap[tunerProfile.length] || '');
        return parts.filter(Boolean).join(' · ') || '调参模式';
      }
      case 'custom': return customPrompt ? `"${customPrompt.slice(0, 20)}..."` : '自述模式';
      default: return '';
    }
  })();

  // ---- 嵌入模式：不渲染遮罩和外框，内容直接嵌入父级 tab ----
  if (embedded) {
    return (
      <div>
        {/* 嵌入模式：无遮罩，无 header，内容区直接展示 */}
        {phase === 'input' && (
          <div className="space-y-4">
            {/* ---- 图片上传 ---- */}
            <div>
              <p className="text-sm font-medium text-heading mb-2">上传图片</p>
              <div className="flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden">
                    <img src={img.preview} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => handleRemoveImage(i)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full shadow flex items-center justify-center hover:bg-red-50">
                      <X size={10} />
                    </button>
                  </div>
                ))}
                <button onClick={() => fileRef.current?.click()}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center gap-1 text-muted hover:border-accent hover:text-accent transition-colors">
                  <ImagePlus size={20} /><span className="text-[10px]">添加</span>
                </button>
                <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleImageAdd} className="hidden" />
              </div>
            </div>

            {/* ======== 三模式互斥选择器 ======== */}
            <div className="border border-border rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-heading">文案风格</p>

              {/* 模式切换按钮组 — 三选一 */}
              <div className="flex bg-neutral-100 rounded-xl p-1 gap-1">
                {STYLE_MODES.map((m) => {
                  const active = styleMode === m.key;
                  return (
                    <button
                      key={m.key}
                      onClick={() => setStyleMode(m.key)}
                      className={clsx(
                        'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5',
                        active
                          ? 'bg-white text-heading shadow-sm ring-1 ring-accent/30'
                          : 'text-muted hover:text-heading'
                      )}
                    >
                      <span>{m.icon}</span>
                      <span>{m.label}</span>
                      <span className="text-[10px] opacity-50 hidden sm:inline">{m.desc}</span>
                    </button>
                  );
                })}
              </div>

              {/* ===== 模式 ①：预设风格 ===== */}
              {styleMode === 'preset' && (
                <div className="space-y-2">
                  <p className="text-xs text-muted">选择一个预设模板，使用其默认风格参数</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {PRESETS.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => setSelectedPreset(s.key)}
                        className={clsx(
                          'py-2.5 px-2 text-xs rounded-lg border transition-all text-left',
                          selectedPreset === s.key
                            ? 'border-accent bg-accent-soft text-heading font-semibold shadow-sm ring-1 ring-accent/30'
                            : 'border-border text-muted hover:border-accent/50'
                        )}
                      >
                        <span className="text-sm mr-0.5">{s.icon}</span>
                        <span className="text-xs font-medium">{s.label}</span>
                        <span className="block text-[9px] opacity-50 mt-0.5 leading-tight">{s.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ===== 模式 ②：高级调参 ===== */}
              {styleMode === 'tuner' && (
                <div className="space-y-2">
                  <p className="text-xs text-muted">先选预设作为基础，再微调具体参数</p>
                  <div className="flex flex-wrap gap-1">
                    {PRESETS.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => setSelectedPreset(s.key)}
                        className={clsx(
                          'px-2.5 py-1 rounded-lg text-xs border transition-all',
                          selectedPreset === s.key
                            ? 'border-accent bg-accent-soft text-heading font-semibold'
                            : 'border-border text-muted hover:border-accent'
                        )}
                      >
                        {s.icon} {s.label}
                      </button>
                    ))}
                  </div>
                  <StyleTuner profile={tunerProfile} onChange={setTunerProfile} defaultExpanded />
                  <button
                    onClick={() => setTunerProfile({})}
                    className="text-[10px] text-muted hover:text-heading underline self-start"
                  >
                    重置调参
                  </button>
                </div>
              )}

              {/* ===== 模式 ③：自由描述 ===== */}
              {styleMode === 'custom' && (
                <div className="space-y-2">
                  <p className="text-xs text-muted">用自然语言描述你想要的风格，AI 会直接遵循</p>
                  <CustomPromptInput value={customPrompt} onChange={setCustomPrompt} />
                </div>
              )}

              {/* ---- 当前生效摘要 ---- */}
              <div className="px-3 py-2 rounded-lg text-xs font-medium bg-accent-soft/50 text-heading">
                🎯 当前风格：{styleSummary}
              </div>
            </div>

            {/* ---- 描述输入 ---- */}
            <div>
              <p className="text-sm font-medium text-heading mb-2">描述（可选）</p>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="比如：今天去了西湖，天气很好，拍了好多照片..."
                rows={3}
                className="w-full px-4 py-3 text-sm rounded-xl border border-border focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 resize-none placeholder:text-neutral-300 transition-all"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-4 py-3 rounded-xl">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() && images.length === 0}
              className="w-full py-3 bg-accent hover:bg-red-600 text-white text-sm font-semibold rounded-full transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              开始生成
            </button>
          </div>
        )}

        {/* ======== 生成中 ======== */}
        {phase === 'generating' && (
          <div className="py-8 flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center">
              <Loader size={28} className="animate-spin text-accent" />
            </div>
            <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm text-muted">{progress}% — AI 正在创作中...</p>
          </div>
        )}

        {/* ======== 生成完成 ======== */}
        {phase === 'done' && (
          <div className="space-y-4">
            {/* 结果展示 */}
            <div>
              <p className="text-xs font-medium text-muted mb-1.5">生成结果</p>
              {isEditing ? (
                <textarea
                  value={editingContent || result?.content || ''}
                  onChange={(e) => setEditingContent(e.target.value)}
                  rows={10}
                  className="w-full px-4 py-3 text-sm rounded-xl border border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 resize-none text-body leading-relaxed"
                />
              ) : (
                <div className="max-h-56 overflow-y-auto text-sm text-body whitespace-pre-wrap bg-neutral-50 p-4 rounded-xl border border-border leading-relaxed">
                  {displayContent}
                </div>
              )}
            </div>

            {/* 换种风格 */}
            {result && (
              <div>
                <p className="text-xs font-medium text-heading mb-2 flex items-center gap-1.5">
                  <RotateCcw size={12} /> 换种风格试试
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((s) => (
                    <button key={s.key} onClick={() => handleRegenerate(s.key)}
                      className="px-3 py-1.5 rounded-lg text-xs border border-border text-muted hover:border-accent hover:text-heading transition-all">
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex gap-2">
                <button onClick={() => setIsEditing(!isEditing)}
                  className={clsx(
                    'flex-1 py-2.5 text-xs font-medium rounded-full border transition-all flex items-center justify-center gap-1.5',
                    isEditing ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted hover:text-heading'
                  )}>
                  <Edit3 size={14} />{isEditing ? '完成编辑' : '编辑调整'}
                </button>
                <button onClick={handleCopy}
                  className="flex-1 py-2.5 text-xs font-medium rounded-full border border-border text-muted hover:text-heading transition-all flex items-center justify-center gap-1.5">
                  {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  {copied ? '已复制' : '复制文案'}
                </button>
              </div>
              {/* 嵌入模式特有：转为手动编辑 */}
              {onSwitchToManual && (
                <button onClick={() => onSwitchToManual(result)}
                  className="w-full py-2.5 text-xs font-medium rounded-full border border-border text-muted hover:text-heading transition-all flex items-center justify-center gap-1.5">
                  <PenLine size={14} /> 转为手动编辑
                </button>
              )}
              <button onClick={handlePublish}
                className="w-full py-3 bg-accent hover:bg-red-600 text-white text-sm font-semibold rounded-full transition-all active:scale-95">
                一键发布
              </button>
            </div>
          </div>
        )}

        {/* ======== 发布中 ======== */}
        {phase === 'publishing' && (
          <div className="py-8 flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center">
              <Loader size={28} className="animate-spin text-accent" />
            </div>
            <p className="text-sm text-muted">正在发布游记...</p>
          </div>
        )}

        {/* ======== 错误 ======== */}
        {phase === 'error' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-red-700 bg-red-50 px-4 py-3 rounded-xl">
              <AlertCircle size={16} /> <span className="text-sm font-medium">{error}</span>
            </div>
            <button onClick={() => { setPhase('input'); setError(''); }}
              className="w-full py-3 border border-border text-sm text-muted hover:text-heading rounded-full transition-colors">
              返回重试
            </button>
          </div>
        )}
      </div>
    );
  }

  // ==================== 独立弹窗模式（原始行为） ====================
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-bold text-heading flex items-center gap-1.5">
            <Sparkles size={16} className="text-accent" /> AI 生成游记
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
        {phase === 'input' && (
          <div className="p-5 space-y-4">
            {/* ---- 图片上传 ---- */}
            <div>
              <p className="text-sm font-medium text-heading mb-2">上传图片</p>
              <div className="flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden">
                    <img src={img.preview} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => handleRemoveImage(i)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full shadow flex items-center justify-center hover:bg-red-50">
                      <X size={10} />
                    </button>
                  </div>
                ))}
                <button onClick={() => fileRef.current?.click()}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center gap-1 text-muted hover:border-accent hover:text-accent transition-colors">
                  <ImagePlus size={20} /><span className="text-[10px]">添加</span>
                </button>
                <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleImageAdd} className="hidden" />
              </div>
            </div>

            {/* ======== 三模式互斥选择器 ======== */}
            <div className="border border-border rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-heading">文案风格</p>

              {/* 模式切换按钮组 — 三选一 */}
              <div className="flex bg-neutral-100 rounded-xl p-1 gap-1">
                {STYLE_MODES.map((m) => {
                  const active = styleMode === m.key;
                  return (
                    <button
                      key={m.key}
                      onClick={() => setStyleMode(m.key)}
                      className={clsx(
                        'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5',
                        active
                          ? 'bg-white text-heading shadow-sm ring-1 ring-accent/30'
                          : 'text-muted hover:text-heading'
                      )}
                    >
                      <span>{m.icon}</span>
                      <span>{m.label}</span>
                      <span className="text-[10px] opacity-50 hidden sm:inline">{m.desc}</span>
                    </button>
                  );
                })}
              </div>

              {/* ===== 模式 ①：预设风格 ===== */}
              {styleMode === 'preset' && (
                <div className="space-y-2">
                  <p className="text-xs text-muted">选择一个预设模板，使用其默认风格参数</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {PRESETS.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => setSelectedPreset(s.key)}
                        className={clsx(
                          'py-2.5 px-2 text-xs rounded-lg border transition-all text-left',
                          selectedPreset === s.key
                            ? 'border-accent bg-accent-soft text-heading font-semibold shadow-sm ring-1 ring-accent/30'
                            : 'border-border text-muted hover:border-accent/50'
                        )}
                      >
                        <span className="text-sm mr-0.5">{s.icon}</span>
                        <span className="text-xs font-medium">{s.label}</span>
                        <span className="block text-[9px] opacity-50 mt-0.5 leading-tight">{s.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ===== 模式 ②：高级调参 ===== */}
              {styleMode === 'tuner' && (
                <div className="space-y-2">
                  <p className="text-xs text-muted">先选预设作为基础，再微调具体参数</p>
                  {/* 嵌套预设选择（简化版） */}
                  <div className="flex flex-wrap gap-1">
                    {PRESETS.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => setSelectedPreset(s.key)}
                        className={clsx(
                          'px-2.5 py-1 rounded-lg text-xs border transition-all',
                          selectedPreset === s.key
                            ? 'border-accent bg-accent-soft text-heading font-semibold'
                            : 'border-border text-muted hover:border-accent'
                        )}
                      >
                        {s.icon} {s.label}
                      </button>
                    ))}
                  </div>
                  <StyleTuner profile={tunerProfile} onChange={setTunerProfile} defaultExpanded />
                  <button
                    onClick={() => setTunerProfile({})}
                    className="text-[10px] text-muted hover:text-heading underline self-start"
                  >
                    重置调参
                  </button>
                </div>
              )}

              {/* ===== 模式 ③：自由描述 ===== */}
              {styleMode === 'custom' && (
                <div className="space-y-2">
                  <p className="text-xs text-muted">用自然语言描述你想要的风格，AI 会直接遵循</p>
                  <CustomPromptInput value={customPrompt} onChange={setCustomPrompt} />
                </div>
              )}

              {/* ---- 当前生效摘要 ---- */}
              <div className="px-3 py-2 rounded-lg text-xs font-medium bg-accent-soft/50 text-heading">
                🎯 当前风格：{styleSummary}
              </div>
            </div>

            {/* ---- 描述输入 ---- */}
            <div>
              <p className="text-sm font-medium text-heading mb-2">描述（可选）</p>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="比如：今天去了西湖，天气很好，拍了好多照片..."
                rows={3}
                className="w-full px-4 py-3 text-sm rounded-xl border border-border focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 resize-none placeholder:text-neutral-300 transition-all"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-4 py-3 rounded-xl">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() && images.length === 0}
              className="w-full py-3 bg-accent hover:bg-red-600 text-white text-sm font-semibold rounded-full transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              开始生成
            </button>
          </div>
        )}

        {/* ======== 生成中 ======== */}
        {phase === 'generating' && (
          <div className="p-8 flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center">
              <Loader size={28} className="animate-spin text-accent" />
            </div>
            <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm text-muted">
              {progress < 50 ? 'AI 正在理解你的图片...' : progress < 80 ? '正在生成日记正文...' : '即将完成...'}
            </p>
            <p className="text-xs text-neutral-300">{progress}%</p>
          </div>
        )}

        {/* ======== 生成完成 ======== */}
        {phase === 'done' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-3 rounded-xl">
              <CheckCircle size={16} />
              <span className="text-sm font-medium">日记生成完成！</span>
              <span className="ml-auto text-[10px] text-green-500 bg-green-100 px-2 py-0.5 rounded-full">{styleSummary}</span>
            </div>

            {isEditing ? (
              <textarea value={displayContent} onChange={(e) => setEditingContent(e.target.value)} rows={8}
                className="w-full px-4 py-3 text-sm rounded-xl border border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 resize-none text-body leading-relaxed" />
            ) : (
              <div className="max-h-56 overflow-y-auto text-sm text-body whitespace-pre-wrap bg-neutral-50 p-4 rounded-xl border border-border leading-relaxed">
                {displayContent}
              </div>
            )}

            {/* 换种风格 */}
            {result && (
              <div>
                <p className="text-xs font-medium text-heading mb-2 flex items-center gap-1.5">
                  <RotateCcw size={12} /> 换种风格试试
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((s) => (
                    <button key={s.key} onClick={() => handleRegenerate(s.key)}
                      className="px-3 py-1.5 rounded-lg text-xs border border-border text-muted hover:border-accent hover:text-heading transition-all">
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex gap-2">
                <button onClick={() => setIsEditing(!isEditing)}
                  className={clsx(
                    'flex-1 py-2.5 text-xs font-medium rounded-full border transition-all flex items-center justify-center gap-1.5',
                    isEditing ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted hover:text-heading'
                  )}>
                  <Edit3 size={14} />{isEditing ? '完成编辑' : '编辑调整'}
                </button>
                <button onClick={handleCopy}
                  className="flex-1 py-2.5 text-xs font-medium rounded-full border border-border text-muted hover:text-heading transition-all flex items-center justify-center gap-1.5">
                  {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  {copied ? '已复制' : '复制文案'}
                </button>
              </div>
              <button onClick={handlePublish}
                className="w-full py-3 bg-accent hover:bg-red-600 text-white text-sm font-semibold rounded-full transition-all active:scale-95">
                一键发布
              </button>
            </div>
          </div>
        )}

        {/* ======== 发布中 ======== */}
        {phase === 'publishing' && (
          <div className="p-8 flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center">
              <Loader size={28} className="animate-spin text-accent" />
            </div>
            <p className="text-sm text-muted">正在发布游记...</p>
          </div>
        )}

        {/* ======== 错误 ======== */}
        {phase === 'error' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-red-700 bg-red-50 px-4 py-3 rounded-xl">
              <AlertCircle size={16} /> <span className="text-sm font-medium">{error}</span>
            </div>
            <button onClick={() => { setPhase('input'); setError(''); }}
              className="w-full py-3 border border-border text-sm text-muted hover:text-heading rounded-full transition-colors">
              返回重试
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
