import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin } from 'lucide-react';
import { getPlaces, foodAPI, getFileUrl } from '../services/api';
import SectionLabel from '../components/ui/SectionLabel';
import StarRating from '../components/ui/StarRating';
import EmptyState from '../components/ui/EmptyState';

const SORT_OPTIONS = [
  { value: 'default', label: '默认' },
  { value: 'rating', label: '评分最高' },
  { value: 'name', label: '名称' },
];

function LocationSearchPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [places, setPlaces] = useState([]);
  const [foods, setFoods] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [submittedKeyword, setSubmittedKeyword] = useState('');
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [page, setPage] = useState(1);
  const pageSize = 9;

  useEffect(() => {
    const load = async () => {
      try {
        const [p, f] = await Promise.all([
          getPlaces(),
          foodAPI.searchFoods(undefined, { limit: 500, sortBy: 'popularity' }),
        ]);
        setPlaces(p.data || []);
        setFoods(f.data || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const merged = useMemo(() => {
    const all = [
      ...places.map((p) => ({ ...p, __type: 'place' })),
      ...foods.map((f) => ({ ...f, __type: 'food', name: f.name || f.foodName, id: f.id || f.foodId })),
    ];
    let filtered = all;
    if (category === 'places') filtered = filtered.filter((i) => i.__type === 'place');
    else if (category === 'foods') filtered = filtered.filter((i) => i.__type === 'food');
    if (submittedKeyword.trim()) {
      const kw = submittedKeyword.toLowerCase();
      filtered = filtered.filter((i) =>
        (i.name || '').toLowerCase().includes(kw) ||
        (i.description || '').toLowerCase().includes(kw) ||
        ((i.keywords || []).join(' ').toLowerCase().includes(kw))
      );
    }
    if (sortBy === 'rating') filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sortBy === 'name') filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return filtered;
  }, [places, foods, category, submittedKeyword, sortBy]);

  const totalPages = Math.ceil(merged.length / pageSize);
  const paginated = merged.slice((page - 1) * pageSize, page * pageSize);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-12">
      <SectionLabel>Explore</SectionLabel>
      <h1 className="font-serif text-3xl text-heading mb-8">发现目的地</h1>

      <div className="flex flex-col md:flex-row gap-4 mb-8 pb-6 border-b border-neutral-100">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-0 top-1/2 -translate-y-1/2 text-muted" />
          <input
            placeholder="搜索地点、美食..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setSubmittedKeyword(keyword); setPage(1); } }}
            className="w-full pl-8 pr-4 py-2 border-0 border-b border-neutral-200 text-sm font-sans focus:border-b-2 focus:border-black focus:ring-0 focus:outline-none transition-colors"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'places', 'foods'].map((c) => (
            <button
              key={c}
              onClick={() => { setCategory(c); setPage(1); }}
              className={`px-4 py-2 text-xs font-sans uppercase tracking-widest border transition-colors ${category === c ? 'border-black text-black' : 'border-neutral-200 text-muted hover:text-black'}`}
            >
              {c === 'all' ? '全部' : c === 'places' ? '地点' : '美食'}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="border border-neutral-200 px-3 py-2 text-xs font-sans uppercase tracking-widest bg-white"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {paginated.length === 0 ? (
        <EmptyState icon={MapPin} title="没有找到结果" description="试试调整搜索条件" />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {paginated.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (item.__type === 'place') navigate(`/places/${item.id}`);
                }}
                className="group cursor-pointer"
              >
                <div className="aspect-[3/4] overflow-hidden mb-6 bg-neutral-100 relative">
                  {item.image ? (
                    <img src={getFileUrl(item.image)} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center"><MapPin size={32} className="text-muted" /></div>
                  )}
                </div>
                <div className="border-b border-neutral-100 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-sans text-[10px] uppercase tracking-widest text-muted px-2 py-0.5 border border-neutral-200">
                      {item.__type === 'place' ? '景点' : '美食'}
                    </span>
                    {item.cuisine && <span className="font-sans text-[10px] uppercase tracking-widest text-muted">{item.cuisine}</span>}
                  </div>
                  <h3 className="font-serif text-xl text-heading mb-2">{item.name}</h3>
                  <StarRating value={item.rating || 0} size={14} />
                  {item.description && (
                    <p className="font-sans text-xs text-muted mt-2 line-clamp-2">{item.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-12">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={`w-10 h-10 font-sans text-sm border ${page === i + 1 ? 'border-black bg-black text-white' : 'border-neutral-200 hover:border-black text-muted'}`}
                >{i + 1}</button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default LocationSearchPage;
