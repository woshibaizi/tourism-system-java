import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Plus, Eye, Pencil, Upload, BookOpen, Star, Flame, Trash2, X } from 'lucide-react';
import {
  getDiaries, searchDiariesByTitle, searchDiariesByContent, searchDiariesByDestination,
  createDiary, getRecommendedDiaries, uploadImage, uploadVideo, getUsers, rateDiary,
  getPlaces, getFileUrl, deleteDiary
} from '../services/api';
import { useToast } from '../components/ui/Toast';
import CTAButton from '../components/ui/CTAButton';
import StarRating from '../components/ui/StarRating';
import SectionLabel from '../components/ui/SectionLabel';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonCard } from '../components/ui/Skeleton';

const SORT_OPTIONS = [
  { value: 'recommendation', label: '个性化推荐' },
  { value: 'popularity', label: '按热度' },
  { value: 'rating', label: '按评分' },
];

function DiariesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const [diaries, setDiaries] = useState([]);
  const [originalDiaries, setOriginalDiaries] = useState([]);
  const [users, setUsers] = useState([]);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDiary, setSelectedDiary] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [imageList, setImageList] = useState([]);
  const [videoList, setVideoList] = useState([]);
  const [sortType, setSortType] = useState('recommendation');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchType, setSearchType] = useState('title');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 9;

  // Form state
  const [formData, setFormData] = useState({ title: '', content: '', destination: '', placeId: '' });

  useEffect(() => { loadData(); }, [sortType]);

  const loadData = async () => {
    setLoading(true);
    try {
      const userId = JSON.parse(localStorage.getItem('user') || '{}').id || 'user_001';
      let diaryResult;
      if (sortType === 'recommendation') {
        diaryResult = await getRecommendedDiaries(userId);
      } else {
        diaryResult = await getDiaries({ pageSize: 100 });
      }
      const [usersR, placesR] = await Promise.allSettled([getUsers(), getPlaces()]);
      const list = (diaryResult.data || []).map((d, i) => ({
        ...d,
        matchScore: d.matchScore || d.score || 0,
        recommendRank: i + 1,
        recommendBadge: d.recommendLevel || (i < 3 ? 'high' : 'normal'),
      }));
      setOriginalDiaries(list);
      setDiaries(list);
      if (usersR.status === 'fulfilled') setUsers(usersR.value.data || []);
      if (placesR.status === 'fulfilled') setPlaces(placesR.value.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSearch = async () => {
    if (!searchKeyword.trim()) { setIsSearchMode(false); setDiaries(originalDiaries); return; }
    setLoading(true);
    try {
      let res;
      if (searchType === 'title') res = await searchDiariesByTitle(searchKeyword);
      else if (searchType === 'content') res = await searchDiariesByContent(searchKeyword);
      else res = await searchDiariesByDestination(searchKeyword);
      setDiaries(res.data || []);
      setIsSearchMode(true);
    } catch { showToast('error', '搜索失败'); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!formData.title.trim()) { showToast('error', '请输入标题'); return; }
    try {
      let imgs = [];
      let vids = [];
      for (const f of imageList) { const r = await uploadImage(f); if (r.success) imgs.push(r.data); }
      for (const f of videoList) { const r = await uploadImage(f); if (r.success) vids.push(r.data); }
      await createDiary({ ...formData, images: imgs, videos: vids, authorId: JSON.parse(localStorage.getItem('user') || '{}').id });
      showToast('success', '创建成功');
      setCreateOpen(false);
      setFormData({ title: '', content: '', destination: '', placeId: '' });
      setImageList([]);
      setVideoList([]);
      loadData();
    } catch { showToast('error', '创建失败'); }
  };

  const handleRate = async (diaryId, rating) => {
    const userId = JSON.parse(localStorage.getItem('user') || '{}').id || 'user_001';
    try {
      await rateDiary(diaryId, rating, userId);
      showToast('success', '评分成功');
      setDiaries((p) => p.map((d) => d.id === diaryId ? { ...d, rating: (d.rating + rating) / 2 } : d));
    } catch { showToast('error', '评分失败'); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDiary(id);
      showToast('success', '已删除');
      loadData();
    } catch { showToast('error', '删除失败'); }
  };

  const getUserName = (id) => users.find((u) => u.id === id)?.username || '匿名';
  const totalPages = Math.ceil(diaries.length / pageSize);
  const paginatedDiaries = diaries.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
        <div>
          <SectionLabel>{isSearchMode ? 'Search Results' : 'Travel Stories'}</SectionLabel>
          <h1 className="font-serif text-3xl text-heading">旅游日记</h1>
        </div>
        <CTAButton onClick={() => { setCreateOpen(true); setFormData({ title: '', content: '', destination: '', placeId: '' }); }}>
          <Plus size={16} className="inline mr-1" /> 写日记
        </CTAButton>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 mb-8 pb-6 border-b border-neutral-100">
        <div className="flex-1 flex gap-2">
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value)}
            className="border border-neutral-200 px-3 py-2 text-xs font-sans uppercase tracking-widest bg-white"
          >
            <option value="title">标题</option>
            <option value="content">内容</option>
            <option value="destination">目的地</option>
          </select>
          <div className="flex-1 flex">
            <input
              placeholder="搜索..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 border border-neutral-200 px-3 py-2 text-sm font-sans focus:border-neutral-900 focus:ring-0 focus:outline-none"
            />
            <button onClick={handleSearch} className="px-4 bg-black text-white hover:bg-neutral-800 transition-colors">
              <Search size={16} />
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => { setSortType(o.value); setIsSearchMode(false); setSearchKeyword(''); }}
              className={`px-4 py-2 text-xs font-sans uppercase tracking-widest border transition-colors ${sortType === o.value ? 'border-black text-black' : 'border-neutral-200 text-muted hover:text-black'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : paginatedDiaries.length === 0 ? (
        <EmptyState icon={BookOpen} title="暂无日记" description="还没有人发布游记，来写第一篇吧" />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {paginatedDiaries.map((diary) => (
              <div
                key={diary.id}
                className="group cursor-pointer border border-transparent hover:border-neutral-100 transition-colors"
              >
                <div className="aspect-[4/3] overflow-hidden bg-neutral-100 relative">
                  {diary.images && diary.images.length > 0 ? (
                    <img src={getFileUrl(diary.images[0])} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  ) : (
                    <BookOpen size={32} className="absolute inset-0 m-auto text-muted" />
                  )}
                  {diary.recommendBadge === 'high' && (
                    <span className="absolute top-3 left-3 bg-black text-white text-[10px] uppercase tracking-widest px-2 py-1 font-sans">
                      Recommended
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h3 onClick={() => navigate(`/diaries/${diary.id}`)}
                    className="font-serif text-lg text-heading mb-2 line-clamp-2 hover:text-muted transition-colors">
                    {diary.title}
                  </h3>
                  <p className="font-sans text-xs text-muted mb-3">
                    {getUserName(diary.authorId)} · {diary.destination || '未知'}
                  </p>
                  <div className="flex items-center justify-between">
                    <StarRating value={diary.rating || 0} size={12} interactive onChange={(v) => handleRate(diary.id, v)} />
                    <div className="flex items-center gap-3 text-xs text-muted">
                      <span className="flex items-center gap-1"><Eye size={12} /> {diary.clickCount || 0}</span>
                      <button onClick={() => { setFormData({ title: diary.title || '', content: diary.content || '', destination: diary.destination || '', placeId: diary.placeId || '' }); setSelectedDiary(diary); setCreateOpen(true); }}>
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => handleDelete(diary.id)}>
                        <Trash2 size={12} className="text-red-400 hover:text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-12">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-10 h-10 font-sans text-sm border ${currentPage === i + 1 ? 'border-black bg-black text-white' : 'border-neutral-200 hover:border-black text-muted'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create/Edit Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center" onClick={() => setCreateOpen(false)}>
          <div className="bg-white w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-serif text-xl text-heading">{selectedDiary ? '编辑日记' : '写日记'}</h2>
              <button onClick={() => setCreateOpen(false)}><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block font-sans text-xs uppercase tracking-widest text-muted mb-1">标题</label>
                <input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border border-neutral-200 px-3 py-2 text-sm font-sans focus:border-black focus:ring-0 focus:outline-none" />
              </div>
              <div>
                <label className="block font-sans text-xs uppercase tracking-widest text-muted mb-1">内容</label>
                <textarea rows={5} value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full border border-neutral-200 px-3 py-2 text-sm font-sans focus:border-black focus:ring-0 focus:outline-none resize-none" />
              </div>
              <div>
                <label className="block font-sans text-xs uppercase tracking-widest text-muted mb-1">目的地</label>
                <input value={formData.destination} onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  className="w-full border border-neutral-200 px-3 py-2 text-sm font-sans focus:border-black focus:ring-0 focus:outline-none" />
              </div>
              <div>
                <label className="block font-sans text-xs uppercase tracking-widest text-muted mb-1">所属景区</label>
                <select value={formData.placeId} onChange={(e) => setFormData({ ...formData, placeId: e.target.value })}
                  className="w-full border border-neutral-200 px-3 py-2 text-sm font-sans bg-white">
                  <option value="">请选择</option>
                  {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-sans text-xs uppercase tracking-widest text-muted mb-1">图片</label>
                <input type="file" accept="image/*" multiple onChange={(e) => setImageList(Array.from(e.target.files))}
                  className="w-full text-sm font-sans" />
              </div>
              <div>
                <label className="block font-sans text-xs uppercase tracking-widest text-muted mb-1">视频</label>
                <input type="file" accept="video/*" multiple onChange={(e) => setVideoList(Array.from(e.target.files))}
                  className="w-full text-sm font-sans" />
              </div>
              <CTAButton className="w-full justify-center" onClick={handleCreate}>
                <Upload size={16} className="inline mr-1" /> {selectedDiary ? '保存修改' : '发布日记'}
              </CTAButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DiariesPage;
