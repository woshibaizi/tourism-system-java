import React, { useState, useEffect } from 'react';
import { Search, MapPin, Star, Flame, Coffee } from 'lucide-react';
import { foodAPI, getPlaces } from '../services/api';
import SectionLabel from '../components/ui/SectionLabel';
import StarRating from '../components/ui/StarRating';
import EmptyState from '../components/ui/EmptyState';

const SORT_OPTIONS = [
  { value: 'popularity', label: '按热度' },
  { value: 'rating', label: '按评分' },
  { value: 'distance', label: '按距离' },
];

function FoodSearchPage() {
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [selectedPlace, setSelectedPlace] = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState('');
  const [cuisines, setCuisines] = useState([]);
  const [places, setPlaces] = useState([]);
  const [sortBy, setSortBy] = useState('popularity');
  const [page, setPage] = useState(1);
  const pageSize = 9;

  useEffect(() => {
    const load = async () => {
      try {
        const [p, f] = await Promise.all([getPlaces(), foodAPI.searchFoods(undefined, { limit: 500, sortBy })]);
        setPlaces(p.data || []);
        setFoods(f.data || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [sortBy]);

  useEffect(() => {
    if (!selectedPlace) { setCuisines([]); return; }
    const load = async () => {
      try {
        const c = await foodAPI.getCuisines(selectedPlace);
        setCuisines(c.data || []);
        setSelectedCuisine('');
      } catch { setCuisines([]); }
    };
    load();
  }, [selectedPlace]);

  const filtered = foods.filter((f) => {
    if (selectedPlace && f.placeId !== selectedPlace) return false;
    if (selectedCuisine && f.cuisine !== selectedCuisine) return false;
    if (searchText.trim()) {
      const kw = searchText.toLowerCase();
      if (!(f.name || f.foodName || '').toLowerCase().includes(kw) &&
          !(f.description || '').toLowerCase().includes(kw)) return false;
    }
    return true;
  });

  if (sortBy === 'rating') filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  else if (sortBy === 'popularity') filtered.sort((a, b) => (b.popularity || b.clickCount || 0) - (a.popularity || a.clickCount || 0));
  else if (sortBy === 'distance') filtered.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-12">
      <SectionLabel>Cuisine</SectionLabel>
      <h1 className="font-serif text-3xl text-heading mb-8">美食搜索</h1>

      <div className="flex flex-col md:flex-row gap-4 mb-8 pb-6 border-b border-border">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            placeholder="搜索美食..."
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 border border-border text-sm font-sans focus:border-accent focus:ring-0 focus:outline-none"
          />
        </div>
        <select value={selectedPlace} onChange={(e) => setSelectedPlace(e.target.value)}
          className="border border-border px-3 py-2 text-sm font-sans bg-surface">
          <option value="">全部景区</option>
          {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={selectedCuisine} onChange={(e) => setSelectedCuisine(e.target.value)}
          className="border border-border px-3 py-2 text-sm font-sans bg-surface" disabled={!selectedPlace}>
          <option value="">全部菜系</option>
          {cuisines.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
          className="border border-border px-3 py-2 text-xs font-sans uppercase tracking-widest bg-surface">
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {paginated.length === 0 ? (
        <EmptyState icon={Coffee} title="未找到美食" description="试试调整搜索条件" />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginated.map((f, i) => (
              <div key={f.id || f.foodId || i} className="border border-border p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-serif text-lg text-heading">{f.name || f.foodName}</h3>
                    <p className="font-sans text-xs text-muted">{f.cuisine || '美食'}</p>
                  </div>
                  {f.rating && <StarRating value={f.rating} size={12} />}
                </div>
                {f.description && <p className="font-sans text-xs text-muted mb-3 line-clamp-2">{f.description}</p>}
                <div className="flex flex-wrap gap-2 text-xs text-muted">
                  {f.price && <span className="px-2 py-0.5 border border-border">{f.price}</span>}
                  {f.popularity > 5 && <span className="flex items-center gap-1"><Flame size={10} /> 热门</span>}
                  {f.distance != null && <span>{f.distance}m</span>}
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} onClick={() => setPage(i + 1)}
                  className={`w-10 h-10 text-sm border ${page === i + 1 ? 'bg-heading text-white border-heading' : 'border-border hover:border-heading text-muted'}`}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default FoodSearchPage;
