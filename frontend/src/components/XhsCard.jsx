import React, { useState } from 'react';
import { ExternalLink, Heart, Bookmark, MessageCircle, Play, TrendingUp, Hash, Loader2, RefreshCw } from 'lucide-react';
import SectionLabel from './ui/SectionLabel';
import { refreshPlaceXhs } from '../services/api/xhs';

/**
 * 小红书热度卡片 — 展示场所的小红书实时热度数据。
 *
 * 数据来源: spot_xhs_info 表 → GET /api/places/{id} → PlaceDetailVO.xhsInfo
 *
 * 三种状态:
 * 1. loading   — 正在抓取小红书数据（显示骨架屏）
 * 2. hasData   — 有数据，展示热度值 / 标签云 / Top 10 笔记卡片
 * 3. empty     — 暂无数据，提供一键刷新入口
 */
function XhsCard({ xhsInfo, placeId }) {
  const [refreshing, setRefreshing] = useState(false);
  const [localXhsInfo, setLocalXhsInfo] = useState(null);

  // 合并：优先用本地刷新后的数据，其次用传入的 props
  const effective = localXhsInfo || xhsInfo;

  const topNotes = parseOrEmpty(effective?.topNotes);
  const topTags = parseOrEmpty(effective?.topTags);
  const hasData = effective && (effective.trendingScore > 0 || topNotes.length > 0);

  const handleRefresh = async () => {
    if (!placeId || refreshing) return;
    setRefreshing(true);
    try {
      const res = await refreshPlaceXhs(placeId);
      if (res.success && res.data) {
        setLocalXhsInfo(res.data);
      }
    } catch {
      // 静默失败，稍后重试
    } finally {
      setRefreshing(false);
    }
  };

  // ── loading 态 ──
  if (refreshing) {
    return (
      <div className="border border-accent-soft bg-gradient-to-br from-white to-accent-soft/10">
        <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📕</span>
            <SectionLabel className="!mb-0 !text-rose-600">小红书热度</SectionLabel>
          </div>
        </div>
        <div className="px-5 py-8 flex flex-col items-center justify-center gap-3">
          <Loader2 size={24} className="text-rose-400 animate-spin" />
          <p className="text-xs text-muted">正在抓取小红书数据...</p>
          <p className="text-xs text-muted/60">预计需要 10–30 秒</p>
        </div>
      </div>
    );
  }

  // ── 空数据态 ──
  if (!hasData) {
    return (
      <div className="border border-accent-soft bg-gradient-to-br from-white to-accent-soft/10">
        <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📕</span>
            <SectionLabel className="!mb-0 !text-rose-600">小红书热度</SectionLabel>
          </div>
          <div className="flex items-center gap-1 text-rose-300 font-serif text-xl font-semibold">
            <TrendingUp size={16} />
            --
          </div>
        </div>
        <div className="px-5 py-6 flex flex-col items-center gap-3">
          <p className="text-xs text-muted">暂无该景点的小红书热度数据</p>
          <button
            onClick={handleRefresh}
            disabled={!placeId}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-sans bg-rose-500 text-white rounded-full hover:bg-rose-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={12} />
            获取小红书数据
          </button>
          <p className="text-xs text-muted/50">
            数据来源：小红书 · 缓存有效期 7 天
          </p>
        </div>
      </div>
    );
  }

  // ── 数据态 ──
  return (
    <div className="border border-accent-soft bg-gradient-to-br from-white to-accent-soft/10">
      {/* 头部 */}
      <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📕</span>
          <SectionLabel className="!mb-0 !text-rose-600">小红书热度</SectionLabel>
        </div>
        <div className="flex items-center gap-1 text-rose-600 font-serif text-xl font-semibold">
          <TrendingUp size={16} />
          {formatScore(effective.trendingScore)}
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* 数据概览 */}
        <div className="flex items-center gap-4 text-xs text-muted">
          <span>📝 {effective.noteCount || 0} 篇相关笔记</span>
          <span>🏷️ 标签来自小红书</span>
          <button
            onClick={handleRefresh}
            disabled={!placeId || refreshing}
            className="ml-auto flex items-center gap-1 text-rose-500 hover:text-rose-600 disabled:opacity-50"
            title="刷新数据"
          >
            <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
            刷新
          </button>
        </div>

        {/* 标签云 */}
        {topTags.length > 0 && (
          <div>
            <div className="flex items-center gap-1 mb-2 text-xs text-muted">
              <Hash size={12} /> 热门标签
            </div>
            <div className="flex flex-wrap gap-1.5">
              {topTags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-0.5 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-full"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Top 笔记 */}
        {topNotes.length > 0 && (
          <div>
            <div className="flex items-center gap-1 mb-3 text-xs text-muted">
              <ExternalLink size={12} /> 热门笔记 Top {topNotes.length}
            </div>
            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {topNotes.map((note) => (
                <a
                  key={note.note_id}
                  href={note.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block border border-border hover:border-accent hover:shadow-sm transition-all p-3 group"
                >
                  <div className="flex gap-3">
                    {/* 封面 */}
                    <div className="relative w-20 h-20 flex-shrink-0 bg-accent-soft overflow-hidden">
                      {note.cover ? (
                        <img
                          src={note.cover}
                          alt={note.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted">
                          <ExternalLink size={20} />
                        </div>
                      )}
                      {/* 视频标记 */}
                      {note.note_type === 'video' && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <Play size={20} className="text-white fill-white" />
                        </div>
                      )}
                    </div>

                    {/* 信息 */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-sans text-sm font-medium text-heading line-clamp-2 group-hover:text-accent transition-colors">
                        {note.title}
                      </h4>
                      {note.desc && (
                        <p className="text-xs text-muted mt-1 line-clamp-1">{note.desc}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted">
                        <span className="flex items-center gap-0.5">
                          <Heart size={10} className="text-rose-400" /> {formatCount(note.likes)}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Bookmark size={10} className="text-amber-400" /> {formatCount(note.collects)}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <MessageCircle size={10} /> {formatCount(note.comments)}
                        </span>
                        <span className="truncate text-muted/60">
                          @{note.author?.name || '未知'}
                        </span>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* 底部提示 */}
        <div className="text-xs text-muted/60 text-center pt-1">
          数据来源：小红书 · 缓存有效期 7 天 · 点击卡片查看原文
        </div>
      </div>
    </div>
  );
}

// ── helpers ──

function parseOrEmpty(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

function formatScore(n) {
  if (n == null) return '--';
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function formatCount(n) {
  if (n == null) return '0';
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

export default XhsCard;
