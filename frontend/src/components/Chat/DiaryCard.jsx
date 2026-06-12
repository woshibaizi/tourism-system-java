import React, { useState } from 'react';
import { clsx } from 'clsx';
import { CheckCircle, Edit3, RefreshCw, Send, Copy, ExternalLink } from 'lucide-react';

/**
 * 将相对路径（如 "uploads/images/xxx.jpg"）解析为完整图片 URL。
 * 与 ChatBubble 中的 resolveImageSrc 逻辑保持一致。
 */
const resolveDiaryImage = (img) => {
  if (!img) return '';
  const url = typeof img === 'string' ? img : (img?.url || img?.path || '');
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('http')) return url;
  const backendBase = import.meta.env.VITE_API_BASE_URL || '/api';
  return backendBase + '/' + url.replace(/^\/+/, '');
};

/**
 * 对话式游记卡片 — 在聊天流中渲染生成的游记草稿。
 *
 * 状态流转：
 *   draft → 用户可编辑/换风格/一键发布
 *   published → 显示已发布状态 + 查看日记链接
 */
export default function DiaryCard({
  content,
  style = '小红书',
  images = [],
  diaryId,
  published = false,
  publishedId,
  onPublish,
  onRestyle,
  onEdit,
  publishing = false,
  error = '',
}) {
  const [editing, setEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [showStylePicker, setShowStylePicker] = useState(false);

  const STYLE_OPTIONS = ['小红书', '朋友圈', '游记', '随笔', '攻略', '幽默吐槽'];

  const [customStyle, setCustomStyle] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleStartEdit = () => {
    setEditedContent(content);
    setEditing(true);
  };

  const handleSaveEdit = () => {
    setEditing(false);
    if (onEdit && editedContent !== content) {
      onEdit(editedContent);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content).catch(() => {});
  };

  const statusBadge = published ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-green-50 text-green-700 rounded-full">
      <CheckCircle size={10} />
      已发布
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 rounded-full">
      草稿
    </span>
  );

  return (
    <div className="my-2 border border-border rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 bg-neutral-50/50">
        <div className="flex items-center gap-2">
          <span className="text-sm">📝</span>
          <span className="text-xs font-medium text-heading">游记{style ? ` · ${style}风` : ''}</span>
          {statusBadge}
        </div>
        {published && publishedId && (
          <a
            href={`/diaries/${publishedId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-accent hover:underline flex items-center gap-1"
          >
            查看日记 <ExternalLink size={10} />
          </a>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        {/* 图片网格 */}
        {images.length > 0 && (
          <div className={clsx(
            'grid gap-1.5 mb-3',
            images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
          )}>
            {images.map((img, i) => {
              const src = resolveDiaryImage(img);
              if (!src) return null;
              return (
                <img
                  key={i}
                  src={src}
                  alt=""
                  className={clsx(
                    'object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity',
                    images.length === 1 ? 'max-h-48 w-auto' : 'h-24 w-full'
                  )}
                  onClick={() => window.open(src, '_blank')}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              );
            })}
          </div>
        )}
        {editing ? (
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="w-full min-h-[120px] p-3 text-sm font-sans border border-border rounded-lg resize-y focus:ring-1 focus:ring-accent focus:outline-none"
            autoFocus
          />
        ) : (
          <p className="text-sm text-body whitespace-pre-wrap leading-relaxed">{content}</p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 px-3 py-2.5 border-t border-border/50 bg-neutral-50/30">
        {editing ? (
          <>
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 text-xs text-muted hover:text-heading transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-3 py-1.5 text-xs bg-heading text-white rounded-md hover:opacity-90 transition-colors"
            >
              保存修改
            </button>
          </>
        ) : published ? (
          <>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-muted hover:text-heading hover:bg-neutral-100 rounded-md transition-colors"
            >
              <Copy size={12} /> 复制
            </button>
            <span className="flex-1" />
            <span className="text-[10px] text-muted">已发布至日记系统</span>
          </>
        ) : (
          <>
            <button
              onClick={() => setShowStylePicker((v) => !v)}
              disabled={publishing}
              className={clsx(
                'inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-colors',
                publishing
                  ? 'text-neutral-300 cursor-not-allowed'
                  : showStylePicker
                    ? 'bg-accent/10 text-accent'
                    : 'text-muted hover:text-heading hover:bg-neutral-100'
              )}
            >
              <RefreshCw size={12} /> 换风格
            </button>
            <button
              onClick={handleStartEdit}
              disabled={publishing}
              className={clsx(
                'inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-colors',
                publishing
                  ? 'text-neutral-300 cursor-not-allowed'
                  : 'text-muted hover:text-heading hover:bg-neutral-100'
              )}
            >
              <Edit3 size={12} /> 编辑
            </button>
            <span className="flex-1" />
            <button
              onClick={onPublish}
              disabled={publishing}
              className={clsx(
                'inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md transition-all',
                publishing
                  ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                  : 'bg-accent text-white hover:opacity-90 shadow-sm'
              )}
            >
              {publishing ? (
                <>
                  <span className="w-3 h-3 border-2 border-neutral-300 border-t-white rounded-full animate-spin" />
                  发布中...
                </>
              ) : (
                <>
                  <Send size={12} /> 一键发布
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* 换风格选择器 */}
      {showStylePicker && !published && (
        <div className="px-3 py-2.5 border-t border-border/40 bg-accent-soft/50">
          <p className="text-[10px] text-muted mb-2">选择新风格：</p>
          <div className="flex flex-wrap gap-1.5">
            {STYLE_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setShowStylePicker(false);
                  setShowCustomInput(false);
                  onRestyle && onRestyle(s);
                }}
                className={clsx(
                  'px-2.5 py-1 text-xs rounded-full border transition-colors',
                  s === style
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-muted hover:border-accent/40 hover:text-heading'
                )}
              >
                {s}
              </button>
            ))}
            <button
              onClick={() => setShowCustomInput((v) => !v)}
              className={clsx(
                'px-2.5 py-1 text-xs rounded-full border transition-colors',
                showCustomInput
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-muted hover:border-accent/40 hover:text-heading'
              )}
            >
              自定义...
            </button>
          </div>
          {showCustomInput && (
            <div className="flex gap-1.5 mt-2">
              <input
                type="text"
                value={customStyle}
                onChange={(e) => setCustomStyle(e.target.value)}
                placeholder="描述你想要的风格..."
                className="flex-1 px-2.5 py-1 text-xs border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-accent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customStyle.trim()) {
                    setShowStylePicker(false);
                    setShowCustomInput(false);
                    onRestyle && onRestyle(customStyle.trim());
                    setCustomStyle('');
                  }
                }}
              />
              <button
                onClick={() => {
                  if (customStyle.trim()) {
                    setShowStylePicker(false);
                    setShowCustomInput(false);
                    onRestyle && onRestyle(customStyle.trim());
                    setCustomStyle('');
                  }
                }}
                disabled={!customStyle.trim()}
                className={clsx(
                  'px-2.5 py-1 text-xs rounded-md transition-colors',
                  customStyle.trim()
                    ? 'bg-accent text-white hover:opacity-90'
                    : 'bg-neutral-100 text-neutral-300 cursor-not-allowed'
                )}
              >
                确定
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
