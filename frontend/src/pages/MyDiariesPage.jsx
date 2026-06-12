import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Trash2, Pencil, Loader2, X, Upload } from 'lucide-react';
import { diaryAPI, deleteDiary, updateDiary, getFileUrl } from '../services/api';
import { useToast } from '../components/ui/Toast';
import EmptyState from '../components/ui/EmptyState';

function MyDiariesPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [diaries, setDiaries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', content: '' });

  const currentUserId = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}').id; } catch { return null; }
  })();

  const loadDiaries = useCallback(async () => {
    if (!currentUserId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await diaryAPI.getDiariesByAuthor(currentUserId);
      setDiaries(res.data || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => { loadDiaries(); }, [loadDiaries]);

  const handleDelete = async (e, diaryId) => {
    e.stopPropagation();
    if (!window.confirm('确定要删除这篇游记吗？此操作不可撤销。')) return;
    try {
      await deleteDiary(diaryId);
      showToast('success', '已删除');
      setDiaries((prev) => prev.filter((d) => d.id !== diaryId));
    } catch {
      showToast('error', '删除失败');
    }
  };

  const handleEditOpen = (e, diary) => {
    e.stopPropagation();
    setEditing(diary);
    setForm({ title: diary.title || '', content: diary.content || '' });
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editing) return;
    if (!form.title.trim()) { showToast('error', '请输入标题'); return; }
    try {
      await updateDiary(editing.id, form);
      showToast('success', '已保存');
      setDiaries((prev) => prev.map((d) => d.id === editing.id ? { ...d, ...form } : d));
      setEditOpen(false);
    } catch {
      showToast('error', '保存失败');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={24} className="animate-spin text-muted/40" />
      </div>
    );
  }

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-heading mb-1">我的游记</h1>
          <p className="font-sans text-sm text-muted">共 {diaries.length} 篇游记</p>
        </div>
        <button
          onClick={() => navigate('/diaries?create=true')}
          className="px-5 py-2.5 bg-accent hover:bg-red-600 text-white text-sm font-medium rounded-full transition-all active:scale-95"
        >
          写游记
        </button>
      </div>

      {diaries.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="还没有写过游记"
          description="记录你的旅行故事，与大家分享美好瞬间"
          actionLabel="写第一篇游记"
          onAction={() => navigate('/diaries?create=true')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {diaries.map((diary) => (
            <div
              key={diary.id}
              onClick={() => navigate(`/diaries/${diary.id}`)}
              className="group cursor-pointer card-hover-lift relative"
            >
              {/* Cover image */}
              <div className="aspect-[3/2] bg-accent-soft rounded-xl overflow-hidden mb-4">
                {diary.images && diary.images.length > 0 ? (
                  <img
                    src={getFileUrl(diary.images[0])}
                    alt={diary.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <BookOpen size={28} className="w-full h-full p-8 text-muted/40" />
                )}
              </div>

              {/* Action buttons - visible on hover */}
              <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => handleEditOpen(e, diary)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/90 hover:bg-blue-50 text-muted/60 hover:text-blue-600 shadow-sm transition-colors"
                  title="编辑游记"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={(e) => handleDelete(e, diary.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/90 hover:bg-red-50 text-muted/60 hover:text-red-500 shadow-sm transition-colors"
                  title="删除游记"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <h3 className="font-serif text-base text-heading mb-1 group-hover:text-accent transition-colors line-clamp-2">
                {diary.title}
              </h3>
              <p className="font-sans text-xs text-muted line-clamp-2">
                {diary.content || diary.description || '暂无内容'}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-4" onClick={() => setEditOpen(false)}>
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-border">
              <h2 className="text-lg font-bold text-heading">编辑游记</h2>
              <button onClick={() => setEditOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">标题</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent/20 focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">内容</label>
                <textarea
                  rows={5}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent/20 focus:outline-none resize-none transition-all"
                />
              </div>
              <button
                className="w-full py-2.5 bg-accent hover:bg-red-600 text-white text-sm font-medium rounded-full transition-all active:scale-95 flex items-center justify-center gap-2"
                onClick={handleEditSave}
              >
                <Upload size={16} /> 保存修改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyDiariesPage;
