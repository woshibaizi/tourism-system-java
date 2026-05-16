import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { X, ImagePlus, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import { generateDiary, getDiaryTaskStatus, createDiary } from '../../services/api';

const STYLES = [
  { key: '小红书', label: '小红书', desc: '活泼种草风' },
  { key: '朋友圈', label: '朋友圈', desc: '轻松分享风' },
  { key: '游记', label: '游记', desc: '深度记录风' },
];

export default function DiaryModal({ onClose, userId, onDiaryCreated }) {
  const [images, setImages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('小红书');
  const [phase, setPhase] = useState('input'); // input | generating | done | error | publishing
  const [progress, setProgress] = useState(0);
  const [taskId, setTaskId] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const pollRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleImageAdd = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => setImages((p) => [...p, { file, preview: reader.result }]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleRemoveImage = (index) => {
    setImages((p) => p.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && images.length === 0) {
      setError('请至少输入一段描述或上传一张图片');
      return;
    }
    setError('');
    setPhase('generating');
    setProgress(5);

    try {
      const imageNames = images.map((img) => img.file.name || 'image.jpg');
      const res = await generateDiary({
        userId,
        prompt: prompt.trim() || '根据图片生成旅行日记',
        images: imageNames,
        style,
      });
      if (!res.success || !res.data?.taskId) {
        setError(res.message || '生成任务启动失败');
        setPhase('error');
        return;
      }
      setTaskId(res.data.taskId);
      setProgress(15);

      // Poll for progress
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await getDiaryTaskStatus(res.data.taskId);
          if (!statusRes.success) return;
          const s = statusRes.data;
          if (s.progress != null) setProgress(Math.max(10, Math.min(95, s.progress)));
          if (s.status === 'done' || s.status === 'completed') {
            clearInterval(pollRef.current);
            setProgress(100);
            setResult(s.result || { title: prompt.slice(0, 20), content: s.message || '' });
            setPhase('done');
          } else if (s.status === 'error' || s.status === 'failed') {
            clearInterval(pollRef.current);
            setError(s.error || '日记生成失败');
            setPhase('error');
          }
        } catch { /* keep polling */ }
      }, 1500);
    } catch {
      setError('请求失败，请确认服务已启动');
      setPhase('error');
    }
  };

  const handlePublish = async () => {
    const diaryId = result?.diary_id || result?.diaryId;
    if (diaryId) {
      onClose();
      navigate(`/diaries/${diaryId}`);
      return;
    }

    setPhase('publishing');
    try {
      const res = await createDiary({
        title: result?.title || '旅行日记',
        content: result?.content || '',
        authorId: String(userId),
        images: result?.images || [],
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-lg mx-4 shadow-2xl border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-serif text-lg text-heading">一键生成旅行日记</h2>
          <button onClick={onClose} className="text-muted hover:text-heading"><X size={18} /></button>
        </div>

        {phase === 'input' && (
          <div className="p-5 space-y-5">
            {/* Image upload */}
            <div>
              <p className="font-sans text-xs text-muted mb-2 uppercase tracking-widest">上传图片</p>
              <div className="flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <div key={i} className="relative w-20 h-20 border border-border">
                    <img src={img.preview} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleRemoveImage(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white border border-border rounded-full flex items-center justify-center hover:bg-red-50"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-20 h-20 border border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted hover:text-heading hover:border-accent transition-colors"
                >
                  <ImagePlus size={18} />
                  <span className="text-[10px]">添加</span>
                </button>
                <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleImageAdd} className="hidden" />
              </div>
            </div>

            {/* Style selector */}
            <div>
              <p className="font-sans text-xs text-muted mb-2 uppercase tracking-widest">文案风格</p>
              <div className="flex gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setStyle(s.key)}
                    className={clsx(
                      'flex-1 py-2 px-3 text-xs border transition-colors',
                      style === s.key
                        ? 'border-accent bg-accent-soft text-heading font-medium'
                        : 'border-border text-muted hover:border-accent'
                    )}
                  >
                    <span className="block">{s.label}</span>
                    <span className="text-[10px] text-muted">{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt input */}
            <div>
              <p className="font-sans text-xs text-muted mb-2 uppercase tracking-widest">描述（可选）</p>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="比如：今天去了西湖，天气很好，拍了好多照片..."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-border focus:outline-none focus:border-accent resize-none placeholder:text-muted"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2">
                <AlertCircle size={12} /> {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() && images.length === 0}
              className="w-full py-2.5 bg-heading text-white text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              开始生成
            </button>
          </div>
        )}

        {phase === 'generating' && (
          <div className="p-8 flex flex-col items-center gap-5">
            <Loader size={32} className="animate-spin text-accent" />
            <div className="w-full bg-neutral-100 h-1.5">
              <div className="h-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <p className="font-sans text-sm text-muted">
              {progress < 50 ? 'AI 正在理解你的图片...' : progress < 80 ? '正在生成日记正文...' : '即将完成...'}
            </p>
          </div>
        )}

        {phase === 'done' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-3">
              <CheckCircle size={16} /> <span className="text-sm">日记生成完成！</span>
            </div>
            {result?.content && (
              <div className="max-h-48 overflow-y-auto text-sm text-body whitespace-pre-wrap bg-accent-soft p-4 border border-border">
                {result.content}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={handlePublish}
                className="flex-1 py-2.5 bg-heading text-white text-sm hover:opacity-90 transition-opacity"
              >
                一键发布
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2.5 border border-border text-sm text-muted hover:text-heading transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        )}
        {phase === 'publishing' && (
          <div className="p-8 flex flex-col items-center gap-5">
            <Loader size={32} className="animate-spin text-accent" />
            <p className="font-sans text-sm text-muted">正在发布日记...</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-red-700 bg-red-50 px-4 py-3">
              <AlertCircle size={16} /> <span className="text-sm">{error}</span>
            </div>
            <button
              onClick={() => { setPhase('input'); setError(''); }}
              className="w-full py-2.5 border border-border text-sm text-muted hover:text-heading"
            >
              返回重试
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
