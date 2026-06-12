import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Heart, MessageCircle, Share2, Calendar, MapPin, Eye, Send, X, Image } from 'lucide-react';
import { getDiary, getUsers, rateDiary, getDiaries, getFileUrl, toggleLikeDiary, getLikeStatus, getXhsStatus, publishDiaryToXhs } from '../services/api';
import { useToast } from '../components/ui/Toast';
import StarRating from '../components/ui/StarRating';
import EmptyState from '../components/ui/EmptyState';

function DiaryDetailPage() {
  const { diaryId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [diary, setDiary] = useState(null);
  const [users, setUsers] = useState([]);
  const [relatedDiaries, setRelatedDiaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentImage, setCurrentImage] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [xhsPublishing, setXhsPublishing] = useState(false);
  const [xhsResult, setXhsResult] = useState(null);
  const [showXhsPreview, setShowXhsPreview] = useState(false);
  const [xhsPreviewTitle, setXhsPreviewTitle] = useState('');
  const [xhsPreviewContent, setXhsPreviewContent] = useState('');
  const [xhsPreviewTags, setXhsPreviewTags] = useState([]);
  const [xhsPreviewTagInput, setXhsPreviewTagInput] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [d, u] = await Promise.all([getDiary(diaryId), getUsers()]);
        if (d.success && d.data) {
          setDiary(d.data);
          setLikeCount(d.data.likeCount || 0);
          // Query like status for current user
          const userId = JSON.parse(localStorage.getItem('user') || '{}').id;
          if (userId) {
            getLikeStatus(diaryId, userId).then((res) => {
              if (res.success && res.data) setLiked(res.data.liked);
            }).catch(() => {});
          }
        }
        if (u.success) setUsers(u.data || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [diaryId]);

  useEffect(() => {
    if (!diary) return;
    getDiaries({ pageSize: 20 }).then((res) => {
      if (res.success) {
        const related = (res.data || []).filter((d) => d.id !== diaryId).slice(0, 6);
        setRelatedDiaries(related);
      }
    }).catch(() => {});
  }, [diary, diaryId]);

  const scrollToImage = (index) => {
    setCurrentImage(index);
    const container = scrollRef.current;
    if (container && container.children[index]) {
      const child = container.children[index];
      container.scrollTo({ left: child.offsetLeft - container.offsetLeft, behavior: 'smooth' });
    }
  };

  const goPrev = () => {
    const images = diary?.images || [];
    if (images.length <= 1) return;
    const next = currentImage === 0 ? images.length - 1 : currentImage - 1;
    scrollToImage(next);
  };

  const goNext = () => {
    const images = diary?.images || [];
    if (images.length <= 1) return;
    const next = currentImage === images.length - 1 ? 0 : currentImage + 1;
    scrollToImage(next);
  };

  const handleRate = async (rating) => {
    try {
      const userId = JSON.parse(localStorage.getItem('user') || '{}').id || 'user_001';
      await rateDiary(diaryId, rating, userId);
      showToast('success', '评分成功');
    } catch { showToast('error', '评分失败'); }
  };

  const toggleLike = async () => {
    const userId = JSON.parse(localStorage.getItem('user') || '{}').id || 'user_001';
    try {
      const res = await toggleLikeDiary(diaryId, userId);
      if (res.success && res.data) {
        setLiked(res.data.liked);
        setLikeCount(res.data.likeCount);
      }
    } catch { showToast('error', '操作失败'); }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('success', '链接已复制');
    } catch {
      showToast('error', '复制失败');
    }
  };

  // Step 1: Check bind status and open preview
  const handlePublishToXhs = async () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.id) { showToast('error', '请先登录'); return; }

    // Check bind status
    try {
      const statusRes = await getXhsStatus(user.id);
      if (!statusRes.success || !statusRes.data?.bound) {
        showToast('error', '请先在个人中心绑定小红书账号');
        return;
      }
    } catch { showToast('error', '网络错误'); return; }

    // Open preview with diary content
    setXhsPreviewTitle(diary.title || '');
    setXhsPreviewContent(diary.content || '');
    setXhsPreviewTags(diary.tags || []);
    setXhsPreviewTagInput('');
    setXhsResult(null);
    setShowXhsPreview(true);
  };

  // Step 2: Confirm and publish
  const handleConfirmPublish = async () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.id) { showToast('error', '请先登录'); return; }

    setXhsPublishing(true);
    setXhsResult(null);
    try {
      const res = await publishDiaryToXhs(diaryId, user.id);
      if (res.success && res.data?.ok) {
        setXhsResult({ ok: true, url: res.data.publish_url });
        showToast('success', '发布成功！📕');
        setDiary((prev) => prev ? { ...prev, xhsPublishStatus: 'published', xhsPublishUrl: res.data.publish_url } : null);
        setShowXhsPreview(false);
      } else {
        const errMsg = res.data?.error || res.message || '发布失败';
        setXhsResult({ ok: false, error: errMsg });
        showToast('error', errMsg);
      }
    } catch (e) {
      setXhsResult({ ok: false, error: '网络错误' });
      showToast('error', '发布失败');
    } finally { setXhsPublishing(false); }
  };

  // Add/remove tags in preview
  const handleAddPreviewTag = () => {
    const tag = xhsPreviewTagInput.trim().replace(/^#/, '');
    if (tag && !xhsPreviewTags.includes(tag)) {
      setXhsPreviewTags([...xhsPreviewTags, tag]);
    }
    setXhsPreviewTagInput('');
  };

  const handleRemovePreviewTag = (tag) => {
    setXhsPreviewTags(xhsPreviewTags.filter((t) => t !== tag));
  };

  const renderContent = (text) => {
    if (!text) return null;
    // 按行分割，处理 markdown 语法
    const lines = text.split('\n');
    return lines.map((line, i) => {
      // 分隔线
      if (/^[-*_]{3,}\s*$/.test(line.trim())) {
        return <hr key={i} className="my-3 border-border/50" />;
      }
      // 标题
      const h3Match = line.match(/^###\s+(.+)/);
      if (h3Match) {
        return <h3 key={i} className="text-base font-semibold text-heading mt-4 mb-2">{renderInline(h3Match[1])}</h3>;
      }
      const h2Match = line.match(/^##\s+(.+)/);
      if (h2Match) {
        return <h2 key={i} className="text-lg font-bold text-heading mt-5 mb-2">{renderInline(h2Match[1])}</h2>;
      }
      const h1Match = line.match(/^#\s+(.+)/);
      if (h1Match) {
        return <h1 key={i} className="text-xl font-bold text-heading mt-5 mb-3">{renderInline(h1Match[1])}</h1>;
      }
      // 无序列表
      const ulMatch = line.match(/^[\s]*[-*]\s+(.+)/);
      if (ulMatch) {
        return <li key={i} className="ml-4 text-body list-disc">{renderInline(ulMatch[1])}</li>;
      }
      // 有序列表
      const olMatch = line.match(/^[\s]*\d+[.)]\s+(.+)/);
      if (olMatch) {
        return <li key={i} className="ml-4 text-body list-decimal">{renderInline(olMatch[1])}</li>;
      }
      // 空行
      if (line.trim() === '') {
        return <div key={i} className="h-2" />;
      }
      // 普通段落
      return <p key={i} className="mb-1">{renderInline(line)}</p>;
    });
  };

  const renderInline = (text) => {
    if (!text) return null;
    // 处理 **粗体**、#标签、链接
    const parts = text.split(/(\*\*[^*]+\*\*|#[^\s#]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('#') && part.length > 1) {
        return <span key={i} className="hashtag">{part}</span>;
      }
      return part;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="skeleton-shimmer md:w-[45%] aspect-[3/4] rounded-2xl" />
            <div className="flex-1 space-y-3">
              <div className="skeleton-shimmer h-6 w-48" />
              <div className="skeleton-shimmer h-4 w-full" />
              <div className="skeleton-shimmer h-4 w-3/4" />
              <div className="skeleton-shimmer h-4 w-5/6" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!diary) {
    return <EmptyState icon={ChevronLeft} title="游记不存在" actionLabel="返回列表" onAction={() => navigate('/diaries')} />;
  }

  const currentUserId = JSON.parse(localStorage.getItem('user') || '{}').id;
  const isOwnDiary = currentUserId && diary.authorId === currentUserId;
  const author = users.find((u) => u.id === diary.authorId);
  const authorName = author?.username || '匿名用户';
  const images = diary.images || [];
  const tags = diary.tags || [];

  return (
    <div className="min-h-screen bg-white">
      {/* Top nav bar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 pointer-events-none">
        <button
          onClick={() => navigate(-1)}
          className="pointer-events-auto w-8 h-8 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm shadow-sm hover:bg-white transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        {/* 一键发布小红书 — 仅自己的游记可见 */}
        {isOwnDiary && (
          diary.xhsPublishStatus === 'published' ? (
            <a href={diary.xhsPublishUrl} target="_blank" rel="noopener noreferrer"
               className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-colors shadow-sm no-underline">
              <Send size={12} />
              📕 已发布
            </a>
          ) : (
            <button onClick={handlePublishToXhs} disabled={xhsPublishing}
                    className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
              <Send size={12} className={xhsPublishing ? 'animate-pulse' : ''} />
              {xhsPublishing ? '发布中...' : '📕 发布到小红书'}
            </button>
          )
        )}
      </div>

      {/* Main content: left-right on desktop, stacked on mobile */}
      <div className="max-w-5xl mx-auto px-4 pt-14">
        <div className="flex flex-col md:flex-row gap-0 md:gap-8">

          {/* === LEFT: Image carousel === */}
          <div className="md:w-[45%] md:flex-shrink-0">
            {images.length > 0 ? (
              <div className="relative md:sticky md:top-20">
                <div
                  ref={scrollRef}
                  className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar rounded-xl aspect-[3/4] bg-black"
                  style={{ scrollSnapType: 'x mandatory' }}
                >
                  {images.map((img, i) => (
                    <div key={i} className="min-w-full snap-center flex items-center justify-center">
                      <img
                        src={getFileUrl(img)}
                        alt={`${diary.title} ${i + 1}`}
                        className="w-full h-full object-contain block"
                      />
                    </div>
                  ))}
                </div>

                {images.length > 1 && (
                  <>
                    {/* Left arrow */}
                    <button
                      onClick={goPrev}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white/60 backdrop-blur-sm hover:bg-white/90 transition-all shadow-sm"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    {/* Right arrow */}
                    <button
                      onClick={goNext}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white/60 backdrop-blur-sm hover:bg-white/90 transition-all shadow-sm"
                    >
                      <ChevronRight size={18} />
                    </button>
                    {/* Counter */}
                    <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                      {currentImage + 1}/{images.length}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-xl bg-neutral-100 aspect-[4/3] flex items-center justify-center">
                <Eye size={40} className="text-neutral-300" />
              </div>
            )}
          </div>

          {/* === RIGHT: Text content === */}
          <div className="flex-1 min-w-0 pt-4 md:pt-0">
            {/* User info */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent-soft flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-accent">{authorName[0]}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-heading">{authorName}</p>
                  <p className="text-xs text-muted flex items-center gap-1">
                    <Calendar size={11} />
                    {diary.createdAt ? new Date(diary.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
                    {diary.destination && (
                      <>
                        <span className="mx-1">·</span>
                        <MapPin size={11} /> {diary.destination}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <button className="px-4 py-1.5 text-xs font-medium rounded-full bg-accent-soft text-accent hover:bg-accent hover:text-white transition-all">
                + 关注
              </button>
            </div>

            {/* Title */}
            <h1 className="text-lg font-bold text-heading mb-3 leading-snug">{diary.title}</h1>

            {/* Content */}
            <div className="text-[15px] text-body leading-relaxed whitespace-pre-wrap mb-5">
              {renderContent(diary.content)}
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {tags.map((tag) => (
                  <span key={tag} className="tag-pill">#{tag}</span>
                ))}
              </div>
            )}

            {/* Rating */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted">评分</span>
                <StarRating value={diary.rating || 0} size={16} interactive onChange={handleRate} />
                <span className="text-sm font-semibold text-heading">{diary.rating || '-'}</span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted">
                <span className="flex items-center gap-1"><Eye size={13} /> {diary.clickCount || 0} 浏览</span>
                <span>{diary.ratingCount || 0} 人评分</span>
              </div>
            </div>

            {/* Inline action buttons — 点赞 / 评论 / 分享 */}
            <div className="border-t border-border pt-4 mt-4">
              <div className="flex items-center gap-3">
                <button onClick={toggleLike} className={`note-action-btn ${liked ? 'liked' : ''}`}>
                  <Heart size={18} className={`heart-icon ${liked ? 'fill-accent' : ''}`} />
                  <span className="font-medium">{likeCount > 0 ? likeCount : '点赞'}</span>
                </button>
                <button className="note-action-btn">
                  <MessageCircle size={18} />
                  <span className="font-medium">评论</span>
                </button>
                <button onClick={handleShare} className="note-action-btn">
                  <Share2 size={18} />
                  <span className="font-medium">分享</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Related diaries */}
      {relatedDiaries.length > 0 && (
        <div className="max-w-5xl mx-auto px-4 pb-8 mt-8">
          <h3 className="text-base font-bold text-heading mb-3">相关游记</h3>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {relatedDiaries.map((rd) => (
              <div
                key={rd.id}
                className="flex-shrink-0 w-36 cursor-pointer"
                onClick={() => { setDiary(null); setLoading(true); setCurrentImage(0); window.scrollTo(0, 0); navigate(`/diaries/${rd.id}`); }}
              >
                <div className="rounded-xl overflow-hidden mb-2">
                  {rd.images && rd.images.length > 0 ? (
                    <img src={getFileUrl(rd.images[0])} alt={rd.title} className="w-full h-28 object-cover" />
                  ) : (
                    <div className="w-full h-28 bg-neutral-100 rounded-xl flex items-center justify-center">
                      <MapPin size={20} className="text-neutral-300" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-body line-clamp-2 font-medium">{rd.title}</p>
                <p className="text-[11px] text-muted mt-1">
                  <Eye size={10} className="inline mr-0.5" /> {rd.clickCount || 0}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── XHS Publish Preview Modal ─── */}
      {showXhsPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
             onClick={(e) => { if (e.target === e.currentTarget) setShowXhsPreview(false); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col"
               onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">📕</span>
                <h3 className="font-serif text-lg text-heading">发布到小红书</h3>
              </div>
              <button onClick={() => setShowXhsPreview(false)}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors">
                <X size={18} className="text-muted" />
              </button>
            </div>

            {/* Body — scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-heading mb-1">标题</label>
                <input
                  type="text"
                  value={xhsPreviewTitle}
                  onChange={(e) => setXhsPreviewTitle(e.target.value)}
                  maxLength={40}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  placeholder="输入标题..."
                />
                <p className="text-xs text-muted mt-0.5">{xhsPreviewTitle.length}/40</p>
              </div>

              {/* Content */}
              <div>
                <label className="block text-xs font-medium text-heading mb-1">正文</label>
                <textarea
                  value={xhsPreviewContent}
                  onChange={(e) => setXhsPreviewContent(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  placeholder="输入正文..."
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-medium text-heading mb-1">🏷️ 话题标签</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {xhsPreviewTags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs bg-accent-soft text-accent border border-accent/20 rounded-full">
                      #{tag}
                      <button onClick={() => handleRemovePreviewTag(tag)} className="hover:text-red-500">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={xhsPreviewTagInput}
                    onChange={(e) => setXhsPreviewTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddPreviewTag(); } }}
                    placeholder="添加话题标签..."
                    className="flex-1 px-3 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  />
                  <button onClick={handleAddPreviewTag}
                          className="px-3 py-1.5 text-xs bg-accent-soft text-accent border border-accent/20 rounded-lg hover:bg-accent/10 transition-colors">
                    添加
                  </button>
                </div>
              </div>

              {/* Images preview */}
              {images.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-heading mb-1 flex items-center gap-1">
                    <Image size={13} /> 图片 ({images.length} 张)
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {images.map((img, i) => (
                      <img key={i} src={getFileUrl(img)} alt={`预览 ${i + 1}`}
                           className="w-20 h-20 object-cover rounded-lg border border-border flex-shrink-0" />
                    ))}
                  </div>
                </div>
              )}

              {/* Error */}
              {xhsResult?.ok === false && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-xs text-red-600">
                  ⚠️ {xhsResult.error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border flex-shrink-0">
              <button
                onClick={() => setShowXhsPreview(false)}
                className="px-4 py-2 text-sm font-sans border border-border rounded-lg hover:bg-neutral-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmPublish}
                disabled={xhsPublishing || !xhsPreviewTitle.trim()}
                className="px-5 py-2 text-sm font-sans bg-rose-600 text-white rounded-lg
                           hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all
                           flex items-center gap-2"
              >
                {xhsPublishing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    发布中...
                  </>
                ) : (
                  <>📕 确认发布</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DiaryDetailPage;
