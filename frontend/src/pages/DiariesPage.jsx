import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Heart, X, Upload, ImagePlus, Loader, Sparkles, PenLine, Wand2, ArrowUpRight } from 'lucide-react';
import {
  getDiaries, searchDiaries,
  createDiary, getRecommendedDiaries, uploadImage, getUsers,
  getPlaces, getFileUrl
} from '../services/api';
import { polishDiary, suggestDiaryTitle, extractDiaryTags, describeDiaryImages } from '../services/api/agent';
import DiaryModal from '../components/Chat/DiaryModal';
import { useToast } from '../components/ui/Toast';
import EmptyState from '../components/ui/EmptyState';

const SORT_OPTIONS = [
  { value: 'recommendation', label: '推荐' },
  { value: 'popularity', label: '热门' },
  { value: 'rating', label: '高评分' },
];

function DiariesPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [diaries, setDiaries] = useState([]);
  const [originalDiaries, setOriginalDiaries] = useState([]);
  const [users, setUsers] = useState([]);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDiary, setSelectedDiary] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [imageList, setImageList] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]); // 缩略图预览 URL
  const [sortType, setSortType] = useState('recommendation');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [likedDiaries, setLikedDiaries] = useState({});

  // 写游记模式 & 精简表单（记住上次偏好）
  const [writeMode, setWriteMode] = useState(() => {
    try { return localStorage.getItem('diaryWriteMode') || 'quick'; } catch { return 'quick'; }
  }); // 'quick' | 'ai'
  const [searchPlace, setSearchPlace] = useState('');
  const [showPlaceDropdown, setShowPlaceDropdown] = useState(false);
  const [tags, setTags] = useState([]);

  // AI 按钮 loading 状态
  const [aiLoading, setAiLoading] = useState({ polish: false, title: false, tags: false, images: false });

  // 模式互通：快速记录 → AI 辅助 的草稿传递
  const [aiDraft, setAiDraft] = useState({ prompt: '', images: [] });

  // Infinite scroll
  const [displayCount, setDisplayCount] = useState(12);
  const loadMoreRef = useRef(null);
  const PAGE_SIZE = 12;

  // Form state — 精简：砍掉 destination、video
  const [formData, setFormData] = useState({ title: '', content: '', placeId: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const userId = JSON.parse(localStorage.getItem('user') || '{}').id || 'user_001';
      const diaryResult = await getDiaries({ pageSize: 200 });
      let list = (diaryResult.data || []).map((d, i) => ({
        ...d,
        matchScore: 0,
        recommendRank: i + 1,
        recommendBadge: 'normal',
      }));

      if (sortType === 'popularity') {
        list.sort((a, b) => ((b.clickCount || 0) - (a.clickCount || 0)));
      } else if (sortType === 'rating') {
        list.sort((a, b) => (Number(b.rating || 0) - Number(a.rating || 0)));
      } else {
        try {
          const recResult = await getRecommendedDiaries(userId);
          const recList = recResult.data || [];
          const recMap = new Map(recList.map((d, idx) => [d.id, { rank: idx, badge: d.recommendLevel || (idx < 5 ? 'high' : 'normal') }]));
          list.forEach((d) => {
            const info = recMap.get(d.id);
            if (info != null) {
              d.matchScore = 1 - info.rank / Math.max(recList.length, 1);
              d.recommendBadge = info.badge;
            }
          });
          list.sort((a, b) => b.matchScore - a.matchScore);
        } catch {
          list.sort((a, b) => ((b.clickCount || 0) * (Number(b.rating || 1))) - ((a.clickCount || 0) * (Number(a.rating || 1))));
        }
      }

      const [usersR, placesR] = await Promise.allSettled([getUsers(), getPlaces()]);
      setOriginalDiaries(list);
      setDiaries(list);
      setDisplayCount(PAGE_SIZE);
      if (usersR.status === 'fulfilled') setUsers(usersR.value.data || []);
      if (placesR.status === 'fulfilled') setPlaces(placesR.value.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [sortType]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && displayCount < diaries.length) {
          setDisplayCount((prev) => Math.min(prev + PAGE_SIZE, diaries.length));
        }
      },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [loading, displayCount, diaries.length]);

  const handleSearch = async () => {
    if (!searchKeyword.trim()) { setIsSearchMode(false); setDiaries(originalDiaries); setDisplayCount(PAGE_SIZE); return; }
    setLoading(true);
    try {
      const res = await searchDiaries(searchKeyword);
      setDiaries(res.data || []);
      setDisplayCount(PAGE_SIZE);
      setIsSearchMode(true);
    } catch { showToast('error', '搜索失败'); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!formData.content.trim()) { showToast('error', '请输入内容'); return; }
    try {
      let imgs = [];
      for (const f of imageList) {
        const r = await uploadImage(f);
        if (r.success && r.data?.path) imgs.push(r.data.path);
      }
      const payload = {
        ...formData,
        title: formData.title.trim() || '旅行日记',
        images: imgs,
        tags,
        authorId: currentUserId,
      };
      const res = await createDiary(payload);
      showToast('success', '创建成功');
      resetForm();

      if (res.success && res.data) {
        const newDiary = { ...res.data, clickCount: 0, rating: 0, ratingCount: 0 };
        setDiaries((prev) => [newDiary, ...prev]);
        setOriginalDiaries((prev) => [newDiary, ...prev]);
      }
      loadData();
    } catch { showToast('error', '创建失败'); }
  };

  const resetForm = () => {
    setCreateOpen(false);
    setSelectedDiary(null);
    setFormData({ title: '', content: '', placeId: '' });
    setImageList([]);
    // 释放预览 URL
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setImagePreviews([]);
    setTags([]);
    setWriteMode('quick');
    setSearchPlace('');
    setShowPlaceDropdown(false);
    setAiLoading({ polish: false, title: false, tags: false, images: false });
  };

  const toggleLike = (diaryId) => {
    setLikedDiaries((prev) => ({ ...prev, [diaryId]: !prev[diaryId] }));
  };

  const getUserName = (id) => users.find((u) => u.id === id)?.username || '匿名';
  const displayedDiaries = diaries.slice(0, displayCount);
  const hasMore = displayCount < diaries.length;

  const coverImage = (diary) => {
    if (diary.images && diary.images.length > 0) return getFileUrl(diary.images[0]);
    return null;
  };

  // ---- 图片上传 + 预览 ----
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    setImageList((prev) => [...prev, ...files]);
    const previews = files.map((f) => URL.createObjectURL(f));
    setImagePreviews((prev) => [...prev, ...previews]);
    e.target.value = '';
  };
  const removeImage = (index) => {
    setImageList((prev) => prev.filter((_, i) => i !== index));
    URL.revokeObjectURL(imagePreviews[index]);
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // ---- AI 辅助功能 ----
  const currentUserId = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}').id || 'anonymous'; } catch { return 'anonymous'; }
  })();

  const handleAIPolish = async () => {
    if (!formData.content.trim()) { showToast('error', '请先输入内容'); return; }
    setAiLoading((s) => ({ ...s, polish: true }));
    try {
      const res = await polishDiary({ userId: currentUserId, content: formData.content });
      if (res.success && res.data?.polished) {
        setFormData((f) => ({ ...f, content: res.data.polished }));
        showToast('success', '润色完成');
      } else {
        showToast('error', res.message || '润色失败');
      }
    } catch { showToast('error', 'AI 服务异常'); }
    finally { setAiLoading((s) => ({ ...s, polish: false })); }
  };

  const handleAITitle = async () => {
    if (!formData.content.trim()) { showToast('error', '请先输入内容'); return; }
    setAiLoading((s) => ({ ...s, title: true }));
    try {
      const res = await suggestDiaryTitle({ userId: currentUserId, content: formData.content, count: 3 });
      if (res.success && res.data?.titles?.length > 0) {
        const picked = res.data.titles[0]; // 默认选第一个，后续可扩展为弹窗选择
        setFormData((f) => ({ ...f, title: picked }));
        showToast('success', '标题已生成');
      } else {
        showToast('error', res.message || '标题生成失败');
      }
    } catch { showToast('error', 'AI 服务异常'); }
    finally { setAiLoading((s) => ({ ...s, title: false })); }
  };

  const handleAITags = async () => {
    if (!formData.content.trim()) { showToast('error', '请先输入内容'); return; }
    setAiLoading((s) => ({ ...s, tags: true }));
    try {
      const res = await extractDiaryTags({ userId: currentUserId, content: formData.content, count: 5 });
      if (res.success && res.data?.tags?.length > 0) {
        setTags(res.data.tags);
        showToast('success', '标签已生成');
      } else {
        showToast('error', res.message || '标签提取失败');
      }
    } catch { showToast('error', 'AI 服务异常'); }
    finally { setAiLoading((s) => ({ ...s, tags: false })); }
  };

  const handleAIImageDescribe = async () => {
    if (imagePreviews.length === 0) { showToast('error', '请先上传图片'); return; }
    setAiLoading((s) => ({ ...s, images: true }));
    try {
      // 先上传图片获取服务器路径
      let imgPaths = [];
      for (const f of imageList) {
        const r = await uploadImage(f);
        if (r.success && r.data?.path) imgPaths.push(r.data.path);
      }
      if (imgPaths.length === 0) { showToast('error', '图片上传失败'); setAiLoading((s) => ({ ...s, images: false })); return; }

      const res = await describeDiaryImages({ userId: currentUserId, images: imgPaths });
      if (res.success && res.data?.descriptions?.length > 0) {
        const descText = res.data.descriptions
          .map((d, i) => `📷 图${i + 1}：${d}`)
          .join('\n\n');
        setFormData((f) => ({
          ...f,
          content: f.content.trim()
            ? `${f.content}\n\n---\n📸 AI 图片描述：\n\n${descText}`
            : descText,
        }));
        showToast('success', '图片分析完成，描述已追加到正文');
      } else {
        showToast('error', res.message || '图片分析失败');
      }
    } catch { showToast('error', 'AI 服务异常'); }
    finally { setAiLoading((s) => ({ ...s, images: false })); }
  };

  // ---- 模式互通 ----
  const handleUpgradeToAI = () => {
    // 将快速记录内容作为草稿传入 AI 流程
    const draftImages = imagePreviews.map((url, i) => ({
      file: imageList[i],
      preview: url,
    }));
    setAiDraft({ prompt: formData.content, images: draftImages });
    setWriteMode('ai');
  };

  const handleSwitchToManual = (aiResult) => {
    // 将 AI 生成结果放入快速记录编辑器
    setFormData({
      ...formData,
      title: aiResult?.title || formData.title,
      content: aiResult?.content || formData.content,
    });
    if (aiResult?.tags?.length > 0) {
      setTags(aiResult.tags);
    }
    setWriteMode('quick');
    showToast('success', '已转为手动编辑，可以自由修改');
  };

  // ---- 搜索景区过滤 ----
  const filteredPlaces = searchPlace.trim()
    ? places.filter((p) => p.name.toLowerCase().includes(searchPlace.toLowerCase()))
    : places.slice(0, 8); // 默认显示前8个

  return (
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-heading">{isSearchMode ? '搜索结果' : '发现'}</h1>
        <button
          onClick={() => { resetForm(); setCreateOpen(true); }}
          className="flex items-center gap-1.5 bg-accent hover:bg-red-600 text-white text-sm font-medium px-5 py-2.5 rounded-full transition-all active:scale-95"
        >
          <Plus size={16} /> 写游记
        </button>
      </div>

      {/* Search bar */}
      <div className="mb-5">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              placeholder="搜索游记、目的地..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full bg-neutral-100 border-none rounded-3xl py-2.5 pl-12 pr-5 text-sm outline-none transition-all focus:bg-accent-soft focus:shadow-[0_0_0_2px_rgba(155,142,126,0.2)]"
            />
          </div>
          {isSearchMode && (
            <button
              onClick={() => { setIsSearchMode(false); setSearchKeyword(''); setDiaries(originalDiaries); setDisplayCount(PAGE_SIZE); }}
              className="px-4 text-sm text-muted hover:text-heading transition-colors"
            >
              取消
            </button>
          )}
        </div>
      </div>

      {/* Sort tabs */}
      <div className="flex gap-3 mb-6">
        {SORT_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => { setSortType(o.value); setIsSearchMode(false); setSearchKeyword(''); }}
            className={`text-sm font-medium px-4 py-1.5 rounded-full transition-all ${sortType === o.value ? 'bg-heading text-white' : 'bg-neutral-100 text-muted hover:bg-neutral-200'}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="note-grid">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="note-card">
              <div className="skeleton-shimmer aspect-[3/4]" />
              <div className="p-3 space-y-2">
                <div className="skeleton-shimmer h-4 w-3/4" />
                <div className="flex items-center gap-2">
                  <div className="skeleton-shimmer w-6 h-6 rounded-full" />
                  <div className="skeleton-shimmer h-3 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : displayedDiaries.length === 0 ? (
        <EmptyState icon={Search} title="暂无游记" description="还没有人发布游记，来写第一篇吧" />
      ) : (
        <>
          <div className="note-grid">
            {displayedDiaries.map((diary) => {
              const img = coverImage(diary);
              const isLiked = likedDiaries[diary.id];
              return (
                <div key={diary.id} className="note-card" onClick={() => navigate(`/diaries/${diary.id}`)}>
                  {/* Image — fixed 3:4 container */}
                  <div className="aspect-[3/4] overflow-hidden bg-neutral-100">
                    {img ? (
                      <img src={img} alt={diary.title} className="w-full h-full object-cover block" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImagePlus size={40} className="text-neutral-300" />
                      </div>
                    )}
                  </div>

                  {/* Title — below image */}
                  <div className="px-3 pt-2.5">
                    <h3 className="text-sm font-semibold text-heading line-clamp-2 leading-snug">
                      {diary.title}
                    </h3>
                  </div>

                  {/* Footer */}
                  <div className="px-3 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded-full bg-accent-soft flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-semibold text-accent">
                          {(getUserName(diary.authorId) || '匿')[0]}
                        </span>
                      </div>
                      <span className="text-xs text-muted truncate">{getUserName(diary.authorId)}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleLike(diary.id); }}
                      className={`flex items-center gap-1 text-xs transition-colors ${isLiked ? 'text-accent' : 'text-muted hover:text-accent'}`}
                    >
                      <Heart size={13} className={isLiked ? 'fill-accent text-accent' : ''} style={isLiked ? { animation: 'heartBeat 0.4s ease' } : {}} />
                      <span>{diary.likeCount || 0}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <div ref={loadMoreRef} className="flex justify-center py-8">
              <Loader size={20} className="animate-spin text-muted" />
            </div>
          )}
          {!hasMore && diaries.length > 0 && (
            <div className="text-center py-8 text-xs text-muted">— 已经到底了 —</div>
          )}
        </>
      )}

      {/* 写游记弹窗 — 统一入口，双模式 */}
      {createOpen && (
        <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-4" onClick={resetForm}>
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex justify-between items-center p-5 border-b border-border">
              <h2 className="text-lg font-bold text-heading">{selectedDiary ? '编辑游记' : '写游记'}</h2>
              <button onClick={resetForm} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* === 模式切换 Tabs === */}
            <div className="px-5 pt-4">
              <div className="flex bg-neutral-100 rounded-xl p-1">
                <button
                  onClick={() => { setWriteMode('quick'); try { localStorage.setItem('diaryWriteMode', 'quick'); } catch { /* ignore */ } }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg transition-all ${
                    writeMode === 'quick' ? 'bg-white text-heading shadow-sm' : 'text-muted hover:text-heading'
                  }`}
                >
                  <PenLine size={15} /> 快速记录
                </button>
                <button
                  onClick={() => { setWriteMode('ai'); try { localStorage.setItem('diaryWriteMode', 'ai'); } catch { /* ignore */ } }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg transition-all ${
                    writeMode === 'ai' ? 'bg-white text-heading shadow-sm' : 'text-muted hover:text-heading'
                  }`}
                >
                  <Sparkles size={15} /> AI 辅助写作
                </button>
              </div>
            </div>

            {/* === 快速记录模式 === */}
            {writeMode === 'quick' && (
              <div className="p-5 space-y-4">
                {/* 标题 — 可选 + AI生成 */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-muted">标题 <span className="text-muted/60 font-normal">（可选）</span></label>
                    <button
                      onClick={handleAITitle}
                      disabled={aiLoading.title || !formData.content.trim()}
                      className="inline-flex items-center gap-1 text-xs text-accent hover:text-red-600 disabled:text-muted/40 disabled:cursor-not-allowed transition-colors"
                    >
                      {aiLoading.title ? (
                        <><Loader size={11} className="animate-spin" /> 生成中</>
                      ) : (
                        <><Sparkles size={11} /> AI 生成</>
                      )}
                    </button>
                  </div>
                  <input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="给游记起个名字..."
                    className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent/20 focus:outline-none transition-all"
                  />
                </div>

                {/* 内容 — 核心字段 + AI润色 */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-muted">内容 <span className="text-accent">*</span></label>
                    <button
                      onClick={handleAIPolish}
                      disabled={aiLoading.polish || !formData.content.trim()}
                      className="inline-flex items-center gap-1 text-xs text-accent hover:text-red-600 disabled:text-muted/40 disabled:cursor-not-allowed transition-colors"
                    >
                      {aiLoading.polish ? (
                        <><Loader size={11} className="animate-spin" /> 润色中</>
                      ) : (
                        <><Wand2 size={11} /> AI 润色</>
                      )}
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="写下你的旅行故事..."
                    className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent/20 focus:outline-none resize-none transition-all"
                  />
                </div>

                {/* 关联景区 — 搜索选择器 */}
                <div className="relative">
                  <label className="block text-xs font-medium text-muted mb-1.5">关联景区</label>
                  <input
                    value={formData.placeId
                      ? (places.find((p) => p.id === formData.placeId)?.name || searchPlace)
                      : searchPlace}
                    onChange={(e) => { setSearchPlace(e.target.value); setShowPlaceDropdown(true); if (!e.target.value) setFormData({ ...formData, placeId: '' }); }}
                    onFocus={() => setShowPlaceDropdown(true)}
                    onBlur={() => setTimeout(() => setShowPlaceDropdown(false), 200)}
                    placeholder="🔍 搜索景区..."
                    className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent/20 focus:outline-none transition-all"
                  />
                  {showPlaceDropdown && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {filteredPlaces.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-muted">没有匹配的景区</div>
                      ) : (
                        filteredPlaces.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={() => {
                              setFormData({ ...formData, placeId: p.id });
                              setSearchPlace(p.name);
                              setShowPlaceDropdown(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-accent-soft transition-colors ${
                              formData.placeId === p.id ? 'bg-accent-soft text-accent font-medium' : 'text-heading'
                            }`}
                          >
                            {p.name}
                            {p.category && <span className="ml-2 text-xs text-muted">({p.category})</span>}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* 图片上传 — 带缩略图预览 */}
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">图片</label>
                  {imagePreviews.length > 0 && (
                    <div className="flex gap-2 mb-3 flex-wrap">
                      {imagePreviews.map((url, i) => (
                        <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden bg-neutral-100 flex-shrink-0">
                          <img src={url} alt={`预览 ${i + 1}`} className="w-full h-full object-cover" />
                          <button
                            onClick={() => removeImage(i)}
                            className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
                          >
                            <X size={11} className="text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-border hover:border-accent bg-neutral-50 hover:bg-accent-soft cursor-pointer transition-all text-sm text-muted hover:text-accent">
                      <ImagePlus size={16} />
                      {imagePreviews.length > 0 ? `已选 ${imagePreviews.length} 张，点击添加` : '上传图片'}
                      <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
                    </label>
                    {imagePreviews.length > 0 && (
                      <button
                        onClick={handleAIImageDescribe}
                        disabled={aiLoading.images}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-accent-soft text-accent text-xs font-medium hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {aiLoading.images ? (
                          <><Loader size={11} className="animate-spin" /> 分析中</>
                        ) : (
                          <><Sparkles size={11} /> AI 识图</>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* 标签（AI 自动生成） */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-muted">标签</label>
                    <button
                      onClick={handleAITags}
                      disabled={aiLoading.tags || !formData.content.trim()}
                      className="inline-flex items-center gap-1 text-xs text-accent hover:text-red-600 disabled:text-muted/40 disabled:cursor-not-allowed transition-colors"
                    >
                      {aiLoading.tags ? (
                        <><Loader size={11} className="animate-spin" /> 生成中</>
                      ) : (
                        <><Sparkles size={11} /> AI 生成</>
                      )}
                    </button>
                  </div>
                  {tags.length > 0 ? (
                    <div className="flex gap-1.5 flex-wrap">
                      {tags.map((t, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent-soft text-accent text-xs rounded-full">
                          #{t}
                          <button onClick={() => setTags((prev) => prev.filter((_, j) => j !== i))} className="hover:text-red-500">
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted/60">点击"AI 生成"自动提取标签</span>
                  )}
                </div>

                {/* 升级为AI辅助 */}
                {formData.content.trim() && (
                  <button
                    onClick={handleUpgradeToAI}
                    className="w-full py-2.5 border-2 border-accent/30 bg-accent-soft text-accent text-sm font-medium rounded-full transition-all hover:bg-red-100 active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Sparkles size={14} /> 升级为 AI 辅助写作
                    <ArrowUpRight size={12} />
                  </button>
                )}

                {/* 发布按钮 */}
                <button
                  className="w-full py-2.5 bg-accent hover:bg-red-600 text-white text-sm font-medium rounded-full transition-all active:scale-95"
                  onClick={handleCreate}
                >
                  <Upload size={16} className="inline mr-1" /> 发布游记
                </button>
              </div>
            )}

            {/* === AI 辅助写作模式 === */}
            {writeMode === 'ai' && (
              <div className="p-5">
                <DiaryModal
                  embedded
                  userId={currentUserId}
                  onClose={() => setWriteMode('quick')}
                  initialPrompt={aiDraft.prompt}
                  initialImages={aiDraft.images}
                  onSwitchToManual={handleSwitchToManual}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DiariesPage;
