import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, MapPin, BookOpen, Loader2 } from 'lucide-react';
import { searchPlaces, searchDiaries, getFileUrl } from '../services/api';
import StarRating from '../components/ui/StarRating';
import EmptyState from '../components/ui/EmptyState';

const TABS = [
  { key: 'all', label: '全部' },
  { key: 'places', label: '目的地' },
  { key: 'diaries', label: '游记' },
];

function MixedSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [places, setPlaces] = useState([]);
  const [diaries, setDiaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const [placesR, diariesR] = await Promise.allSettled([
        searchPlaces(q.trim()),
        searchDiaries(q.trim()),
      ]);
      setPlaces(placesR.status === 'fulfilled' ? (placesR.value.data || []) : []);
      setDiaries(diariesR.status === 'fulfilled' ? (diariesR.value.data || []) : []);
    } catch {
      setPlaces([]);
      setDiaries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQuery.trim()) {
      doSearch(initialQuery);
    }
  }, [initialQuery, doSearch]);

  const handleSearch = () => {
    setSearchParams({ q: query });
    doSearch(query);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const visiblePlaces = activeTab === 'all' || activeTab === 'places' ? places : [];
  const visibleDiaries = activeTab === 'all' || activeTab === 'diaries' ? diaries : [];
  const hasResults = places.length > 0 || diaries.length > 0;

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-12">
      <h1 className="font-serif text-3xl text-heading mb-8">搜索</h1>

      {/* Search bar */}
      <div className="max-w-2xl mb-8">
        <div className="relative">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted/50 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索地点、游记..."
            className="w-full h-14 pl-12 pr-4 bg-surface border border-border rounded-xl text-body placeholder:text-muted/50 font-sans text-base focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/20 transition-all"
          />
          <button
            onClick={handleSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 px-5 py-1.5 bg-accent hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            搜索
          </button>
        </div>
      </div>

      {/* Tabs */}
      {searched && (
        <div className="flex gap-3 mb-6 pb-4 border-b border-border">
          {TABS.map((tab) => {
            const count = tab.key === 'all'
              ? places.length + diaries.length
              : tab.key === 'places' ? places.length : diaries.length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`text-sm font-medium px-4 py-1.5 rounded-full transition-all ${
                  activeTab === tab.key
                    ? 'bg-heading text-white'
                    : 'bg-neutral-100 text-muted hover:bg-neutral-200'
                }`}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-muted/40" />
          <span className="ml-3 text-muted/60">搜索中...</span>
        </div>
      ) : !searched ? (
        <EmptyState icon={Search} title="输入关键词开始搜索" description="可以搜索目的地名称或游记标题、内容" />
      ) : !hasResults ? (
        <EmptyState icon={Search} title="没有找到结果" description={`未找到与"${initialQuery}"相关的内容，试试其他关键词`} />
      ) : (
        <div className="space-y-10">
          {/* Places section */}
          {visiblePlaces.length > 0 && (
            <section>
              {activeTab === 'all' && (
                <h2 className="font-serif text-xl text-heading mb-5 flex items-center gap-2">
                  <MapPin size={18} className="text-accent" />
                  目的地 ({places.length})
                </h2>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visiblePlaces.map((place) => (
                  <div
                    key={place.id}
                    onClick={() => navigate(`/places/${place.id}`)}
                    className="group cursor-pointer card-hover-lift"
                  >
                    <div className="aspect-[3/2] bg-accent-soft rounded-xl overflow-hidden mb-4">
                      {place.image ? (
                        <img
                          src={getFileUrl(place.image)}
                          alt={place.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <MapPin size={28} className="w-full h-full p-8 text-muted/40" />
                      )}
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-accent px-2 py-0.5 bg-accent/10 rounded font-sans">
                      目的地
                    </span>
                    <h3 className="font-serif text-base text-heading mt-2 mb-1 group-hover:text-accent transition-colors">
                      {place.name}
                    </h3>
                    <StarRating value={place.rating || 0} size={12} />
                    {place.description && (
                      <p className="font-sans text-xs text-muted mt-1.5 line-clamp-2">{place.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Diaries section */}
          {visibleDiaries.length > 0 && (
            <section>
              {activeTab === 'all' && (
                <h2 className="font-serif text-xl text-heading mb-5 flex items-center gap-2">
                  <BookOpen size={18} className="text-accent" />
                  游记 ({diaries.length})
                </h2>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleDiaries.map((diary) => (
                  <div
                    key={diary.id}
                    onClick={() => navigate(`/diaries/${diary.id}`)}
                    className="group cursor-pointer card-hover-lift"
                  >
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
                    <span className="text-[10px] uppercase tracking-widest text-muted px-2 py-0.5 bg-muted/10 rounded font-sans">
                      游记
                    </span>
                    <h3 className="font-serif text-base text-heading mt-2 mb-1 group-hover:text-accent transition-colors line-clamp-2">
                      {diary.title}
                    </h3>
                    <p className="font-sans text-xs text-muted line-clamp-2">
                      {diary.content || diary.description || '暂无内容'}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export default MixedSearchPage;
