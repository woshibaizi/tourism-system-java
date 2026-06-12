import React from 'react';
import { clsx } from 'clsx';
import { User, Bot, Heart, Bookmark, MessageCircle, ExternalLink } from 'lucide-react';
import DiaryCard from './DiaryCard';

/**
 * 获取图片 URL 的统一入口
 * 支持：服务器路径、base64 预览、完整 URL
 */
const getImageUrl = (img) => {
  if (typeof img === 'string') return img;
  if (img?.preview) return img.preview;
  if (img?.url) return img.url;
  if (img?.path) return img.path;
  return '';
};

/**
 * 拼接后端上传目录路径
 * 相对路径如 "uploads/images/xxx.jpg" 需要加上后端地址
 */
const resolveImageSrc = (img) => {
  const url = getImageUrl(img);
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('http')) return url;
  const backendBase = import.meta.env.VITE_API_BASE_URL || '/api';
  return backendBase + '/' + url.replace(/^\/+/, '');
};

export default function ChatBubble({ message, className, onPublishDiary, onRestyleDiary, onEditDiary, publishingDiary }) {
  const isUser = message.role === 'user';
  const isDiaryCard = message.diaryCard || message.diary_card || message.isDiary;
  // 优先 serverImages（日记卡片/助手消息），回退到 images（用户消息）
  const messageImages = message.serverImages || message.images || [];
  const hasImages = messageImages.length > 0;

  // 日记卡片渲染
  if (isDiaryCard && !isUser) {
    return (
      <DiaryCard
        content={message.content}
        style={message.diaryStyle || message.diary_style || '小红书'}
        images={messageImages}
        published={message.diaryPublished || false}
        publishedId={message.diaryId || message.diary_id || ''}
        publishing={message.diaryPublishing || publishingDiary || false}
        error={message.diaryPublishError || ''}
        onPublish={() => onPublishDiary && onPublishDiary(message)}
        onRestyle={(selectedStyle) => onRestyleDiary && onRestyleDiary(message, selectedStyle)}
        onEdit={(newContent) => onEditDiary && onEditDiary(message, newContent)}
      />
    );
  }

  return (
    <div className={clsx('flex gap-3 mb-6', isUser ? 'justify-end' : 'justify-start', className)}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-accent-soft flex items-center justify-center flex-shrink-0">
          <Bot size={16} className="text-muted" />
        </div>
      )}
      <div
        className={clsx(
          'max-w-[75%] px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-heading text-white rounded-bl-lg rounded-br-sm rounded-tl-lg rounded-tr-lg'
            : 'bg-accent-soft text-body border border-border rounded-bl-sm rounded-br-lg rounded-tl-sm rounded-tr-lg'
        )}
      >
        {/* 图片网格 */}
        {hasImages && (
          <div className={clsx(
            'grid gap-1.5 mb-2',
            messageImages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
          )}>
            {messageImages.map((img, i) => {
              const src = resolveImageSrc(img);
              if (!src) return null;
              return (
                <img
                  key={i}
                  src={src}
                  alt=""
                  className={clsx(
                    'object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity',
                    messageImages.length === 1 ? 'max-h-48 w-auto' : 'h-24 w-full'
                  )}
                  onClick={() => window.open(src, '_blank')}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              );
            })}
          </div>
        )}

        {/* 文字内容 */}
        {message.content && <p className="whitespace-pre-wrap">{message.content}</p>}

        {/* 小红书笔记卡片 — 当 Agent 返回 xhsNotes 数据时渲染 */}
        {!isUser && message.xhsNotes && message.xhsNotes.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="text-xs text-muted flex items-center gap-1">
              <span>📕</span> 小红书搜索结果
            </div>
            {message.xhsNotes.map((note, i) => (
              <a
                key={note.note_id || i}
                href={note.url || `https://www.xiaohongshu.com/explore/${note.note_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-2.5 p-2 rounded-lg bg-white/60 border border-border/60 hover:border-rose-200 hover:bg-rose-50/50 transition-all group"
              >
                {/* 封面 */}
                {note.cover ? (
                  <img
                    src={note.cover}
                    alt={note.title}
                    className="w-14 h-14 object-cover rounded-md flex-shrink-0 bg-accent-soft"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-14 h-14 flex items-center justify-center rounded-md bg-accent-soft flex-shrink-0">
                    <ExternalLink size={14} className="text-muted" />
                  </div>
                )}
                {/* 信息 */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-heading line-clamp-2 group-hover:text-accent transition-colors">
                    {note.title}
                  </p>
                  <div className="flex items-center gap-2.5 mt-1.5">
                    <span className="flex items-center gap-0.5 text-[10px] text-muted">
                      <Heart size={9} className="text-rose-400" /> {fmtCount(note.likes)}
                    </span>
                    <span className="flex items-center gap-0.5 text-[10px] text-muted">
                      <Bookmark size={9} className="text-amber-400" /> {fmtCount(note.collects)}
                    </span>
                    <span className="flex items-center gap-0.5 text-[10px] text-muted">
                      <MessageCircle size={9} /> {fmtCount(note.comments)}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        {message.createdAt && (
          <span className={clsx('text-[10px] mt-1 block', isUser ? 'text-white/60' : 'text-muted')}>
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-heading flex items-center justify-center flex-shrink-0">
          <User size={14} className="text-white" />
        </div>
      )}
    </div>
  );
}

function fmtCount(n) {
  if (n == null) return '0';
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}
