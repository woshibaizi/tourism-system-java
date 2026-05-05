import React, { useState, useEffect } from 'react';
import { Pencil, Trash2, Eye, Search, X } from 'lucide-react';
import { getDiaries, getPlaces, getUsers, updateDiary, deleteDiary } from '../services/api';
import { useToast } from '../components/ui/Toast';
import CTAButton from '../components/ui/CTAButton';
import SectionLabel from '../components/ui/SectionLabel';

function DiaryManagementPage() {
  const { showToast } = useToast();
  const [diaries, setDiaries] = useState([]);
  const [places, setPlaces] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [selectedPlace, setSelectedPlace] = useState('');
  const [selectedAuthor, setSelectedAuthor] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', content: '', destination: '', placeId: '' });

  useEffect(() => {
    const load = async () => {
      try {
        const [d, p, u] = await Promise.all([getDiaries({ pageSize: 1000 }), getPlaces(), getUsers()]);
        setDiaries(d.data || []);
        setPlaces(p.data || []);
        setUsers(u.data || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const filtered = diaries.filter((d) => {
    if (searchText && !(d.title || '').includes(searchText) && !(d.content || '').includes(searchText)) return false;
    if (selectedPlace && d.placeId !== selectedPlace) return false;
    if (selectedAuthor && d.authorId !== selectedAuthor) return false;
    return true;
  });

  const handleEdit = (d) => {
    setEditing(d);
    setForm({ title: d.title || '', content: d.content || '', destination: d.destination || '', placeId: d.placeId || '' });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      await updateDiary(editing.id, form);
      showToast('success', '已保存');
      setDiaries((p) => p.map((d) => d.id === editing.id ? { ...d, ...form } : d));
      setEditOpen(false);
    } catch { showToast('error', '保存失败'); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDiary(id);
      showToast('success', '已删除');
      setDiaries((p) => p.filter((d) => d.id !== id));
    } catch { showToast('error', '删除失败'); }
  };

  const getUserName = (id) => users.find((u) => u.id === id)?.username || '匿名';
  const getPlaceName = (id) => places.find((p) => p.id === id)?.name || '';

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-12">
      <SectionLabel>Admin</SectionLabel>
      <h1 className="font-serif text-3xl text-heading mb-8">日记管理</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        {[
          { label: '总日记', value: diaries.length },
          { label: '筛选结果', value: filtered.length },
          { label: '总浏览', value: diaries.reduce((s, d) => s + (d.clickCount || 0), 0) },
          { label: '平均评分', value: diaries.length ? (diaries.reduce((s, d) => s + (d.rating || 0), 0) / diaries.length).toFixed(1) : 0 },
        ].map((s, i) => (
          <div key={i} className="border border-neutral-100 p-6 text-center">
            <p className="font-serif text-3xl text-heading">{s.value}</p>
            <p className="font-sans text-xs uppercase tracking-widest text-muted mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-6 pb-6 border-b border-neutral-100">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            placeholder="搜索标题或内容..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-neutral-200 text-sm font-sans focus:border-black focus:ring-0 focus:outline-none"
          />
        </div>
        <select value={selectedPlace} onChange={(e) => setSelectedPlace(e.target.value)} className="border border-neutral-200 px-3 py-2 text-xs font-sans bg-white">
          <option value="">全部景区</option>
          {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={selectedAuthor} onChange={(e) => setSelectedAuthor(e.target.value)} className="border border-neutral-200 px-3 py-2 text-xs font-sans bg-white">
          <option value="">全部作者</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.username || u.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left">
              <th className="py-3 font-sans text-xs uppercase tracking-widest text-muted">标题</th>
              <th className="py-3 font-sans text-xs uppercase tracking-widest text-muted">作者</th>
              <th className="py-3 font-sans text-xs uppercase tracking-widest text-muted">目的地</th>
              <th className="py-3 font-sans text-xs uppercase tracking-widest text-muted">评分</th>
              <th className="py-3 font-sans text-xs uppercase tracking-widest text-muted">浏览</th>
              <th className="py-3 font-sans text-xs uppercase tracking-widest text-muted w-24">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id} className="border-b border-neutral-50 hover:bg-neutral-50">
                <td className="py-3 font-sans text-sm text-body max-w-xs truncate">{d.title}</td>
                <td className="py-3 font-sans text-xs text-muted">{getUserName(d.authorId)}</td>
                <td className="py-3 font-sans text-xs text-muted">{d.destination || getPlaceName(d.placeId)}</td>
                <td className="py-3 font-sans text-xs">{d.rating || '-'}</td>
                <td className="py-3 font-sans text-xs text-muted">{d.clickCount || 0}</td>
                <td className="py-3">
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(d)} className="text-muted hover:text-heading"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(d.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center" onClick={() => setEditOpen(false)}>
          <div className="bg-white w-full max-w-lg mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between mb-6">
              <h2 className="font-serif text-xl">编辑日记</h2>
              <button onClick={() => setEditOpen(false)}><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block font-sans text-xs uppercase tracking-widest text-muted mb-1">标题</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-neutral-200 px-3 py-2 text-sm font-sans focus:border-black focus:ring-0 focus:outline-none" />
              </div>
              <div>
                <label className="block font-sans text-xs uppercase tracking-widest text-muted mb-1">内容</label>
                <textarea rows={5} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="w-full border border-neutral-200 px-3 py-2 text-sm font-sans focus:border-black focus:ring-0 focus:outline-none resize-none" />
              </div>
              <div>
                <label className="block font-sans text-xs uppercase tracking-widest text-muted mb-1">目的地</label>
                <input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })}
                  className="w-full border border-neutral-200 px-3 py-2 text-sm font-sans focus:border-black focus:ring-0 focus:outline-none" />
              </div>
              <CTAButton className="w-full justify-center" onClick={handleSave}>保存修改</CTAButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DiaryManagementPage;
