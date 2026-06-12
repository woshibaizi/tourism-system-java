import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Sparkles, Store } from 'lucide-react';
import { getPlaces, getFileUrl, getSurroundingCountsByPlace } from '../services/api';
import SectionLabel from '../components/ui/SectionLabel';
import StarRating from '../components/ui/StarRating';
import EmptyState from '../components/ui/EmptyState';

const ALL = 'all';
const SORT_OPTIONS = [
  { value: 'default', label: '推荐' },
  { value: 'trending', label: '🔥 小红书热门' },
  { value: 'rating', label: '评分最高' },
  { value: 'name', label: '名称' },
];

const TYPE_LABELS = {
  '校园': '校园',
  '景区': '景区',
  '公园': '公园',
  '博物馆': '博物馆',
};

function LocationSearchPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [places, setPlaces] = useState([]);
  const [surroundingCounts, setSurroundingCounts] = useState({});
  const [keyword, setKeyword] = useState('');
  const [submittedKeyword, setSubmittedKeyword] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [activeType, setActiveType] = useState(ALL);
  const [page, setPage] = useState(1);
  const pageSize = 9;

  useEffect(() => {
    const load = async () => {
      try {
        const [placesRes, countsRes] = await Promise.all([
          getPlaces(),
          getSurroundingCountsByPlace(),
        ]);
        setPlaces(placesRes.data || []);
        if (countsRes.success) setSurroundingCounts(countsRes.data || {});
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  // Extract available types from the data
  const availableTypes = useMemo(() => {
    const typeSet = new Set();
    places.forEach((p) => { if (p.type) typeSet.add(p.type); });
    return [...typeSet].sort();
  }, [places]);

  const merged = useMemo(() => {
    const all = places.map((p) => ({
      ...p,
      __type: 'place',
      __srCount: surroundingCounts[p.id] || 0,
    }));

    let filtered = all;

    // Type filter
    if (activeType !== ALL) {
      filtered = filtered.filter((i) => i.type === activeType);
    }

    // Keyword search
    if (submittedKeyword.trim()) {
      const kw = submittedKeyword.toLowerCase();
      filtered = filtered.filter((i) =>
        (i.name || '').toLowerCase().includes(kw) ||
        (i.description || '').toLowerCase().includes(kw) ||
        ((i.keywords || []).join(' ').toLowerCase().includes(kw))
      );
    }

    // Sort
    if (sortBy === 'trending') {
      // Sort by XHS trending score desc, fallback to rating
      filtered.sort((a, b) => {
        const aScore = a.xhsInfo?.trendingScore || 0;
        const bScore = b.xhsInfo?.trendingScore || 0;
        if (aScore !== bScore) return bScore - aScore;
        return (b.rating || 0) - (a.rating || 0);
      });
    } else if (sortBy === 'rating') {
      filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'name') {
      filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else {
      // Default "推荐" sort: places with surrounding data first, then by rating desc
      filtered.sort((a, b) => {
        // Places with surrounding data get priority boost
        const aBoost = a.__srCount > 0 ? 1 : 0;
        const bBoost = b.__srCount > 0 ? 1 : 0;
        if (aBoost !== bBoost) return bBoost - aBoost;
        // Among same boost tier, sort by rating desc
        return (b.rating || 0) - (a.rating || 0);
      });
    }

    return filtered;
  }, [places, submittedKeyword, sortBy, activeType, surroundingCounts]);

  const totalPages = Math.ceil(merged.length / pageSize);
  const paginated = merged.slice((page - 1) * pageSize, page * pageSize);

  // Reset to page 1 when filter changes
  const handleTypeChange = (type) => {
    setActiveType(type);
    setPage(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-12">
      <SectionLabel>Explore</SectionLabel>
      <h1 className="font-serif text-3xl text-heading mb-8">发现目的地</h1>

      {/* Search + Sort bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 pb-4 border-b border-border">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-0 top-1/2 -translate-y-1/2 text-muted" />
          <input
            placeholder="搜索地点..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setSubmittedKeyword(keyword); setPage(1); } }}
            className="w-full pl-8 pr-4 py-2 border-0 border-b border-border text-sm font-sans focus:border-b-2 focus:border-accent focus:ring-0 focus:outline-none transition-colors bg-transparent"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="border border-border px-3 py-2 text-xs font-sans uppercase tracking-widest bg-surface"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Type filter tabs */}
      {availableTypes.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          <button
            onClick={() => handleTypeChange(ALL)}
            className={`px-4 py-2 rounded-full text-xs font-sans font-medium whitespace-nowrap transition-all
              ${activeType === ALL
                ? 'bg-accent text-white shadow-sm'
                : 'bg-surface border border-border text-muted hover:text-heading hover:border-heading/30'}`}
          >
            全部 ({places.length})
          </button>
          {availableTypes.map((t) => {
            const count = places.filter((p) => p.type === t).length;
            return (
              <button
                key={t}
                onClick={() => handleTypeChange(t)}
                className={`px-4 py-2 rounded-full text-xs font-sans font-medium whitespace-nowrap transition-all
                  ${activeType === t
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-surface border border-border text-muted hover:text-heading hover:border-heading/30'}`}
              >
                {TYPE_LABELS[t] || t} ({count})
              </button>
            );
          })}
        </div>
      )}

      {paginated.length === 0 ? (
        <EmptyState icon={MapPin} title="没有找到结果" description="试试调整搜索条件或筛选类型" />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {paginated.map((item) => {
              const srCount = item.__srCount;
              return (
                <div
                  key={item.id}
                  onClick={() => navigate(`/places/${item.id}`)}
                  className="group cursor-pointer"
                >
                  <div className="overflow-hidden mb-6 bg-accent-soft relative" style={{ aspectRatio: '3/4' }}>
                    {item.image ? (
                      <img src={getFileUrl(item.image)} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center"><MapPin size={32} className="text-muted" /></div>
                    )}
                    {/* Surrounding count badge */}
                    {srCount > 0 && (
                      <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-full text-white text-[10px] font-sans font-medium">
                        <Store size={10} />
                        {srCount} 周边
                      </div>
                    )}
                    {/* Recommended badge for places with rich surroundings */}
                    {srCount >= 50 && (
                      <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 bg-accent/85 backdrop-blur-sm rounded-full text-white text-[10px] font-sans font-medium">
                        <Sparkles size={10} />
                        热门周边
                      </div>
                    )}
                  </div>
                  <div className="border-b border-border pb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-sans text-[10px] uppercase tracking-widest text-muted px-2 py-0.5 border border-border">
                        {item.type || '景点'}
                      </span>
                      {srCount > 0 && (
                        <span className="font-sans text-[10px] text-accent/70">
                          {srCount}家周边商户
                        </span>
                      )}
                    </div>
                    <h3 className="font-serif text-xl text-heading mb-2">{item.name}</h3>
                    <StarRating value={item.rating || 0} size={14} />
                    {item.description && (
                      <p className="font-sans text-xs text-muted mt-2 line-clamp-2">{item.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex flex-wrap justify-center gap-2 mt-12">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={`w-10 h-10 font-sans text-sm border ${page === i + 1 ? 'border-heading bg-heading text-white' : 'border-border hover:border-heading text-muted'}`}
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
