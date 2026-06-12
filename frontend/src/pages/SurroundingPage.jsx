import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Search, Star, ChevronRight, Sparkles } from 'lucide-react';
import { surroundingAPI, getFileUrl } from '../services/api';
import CTAButton from '../components/ui/CTAButton';
import SectionLabel from '../components/ui/SectionLabel';
import EmptyState from '../components/ui/EmptyState';
import LazyImage from '../components/ui/LazyImage';

const ALL = 'all';

// 模块级缓存：从详情页返回时恢复完整状态，不重新请求
let _cache = { placeId: null, items: null, counts: null, activeType: ALL, searchText: '', sortBy: 'distance' };

function SurroundingPage() {
  const { placeId } = useParams();
  const navigate = useNavigate();
  const samePlace = _cache.placeId === placeId && _cache.items !== null;
  const [loading, setLoading] = useState(!samePlace);
  const [allItems, setAllItems] = useState(samePlace ? _cache.items : []);
  const [filtered, setFiltered] = useState(samePlace ? _cache.items : []);
  const [activeType, setActiveType] = useState(samePlace ? _cache.activeType : ALL);
  const [categoryCounts, setCategoryCounts] = useState(samePlace ? _cache.counts : {});
  const [searchText, setSearchText] = useState(samePlace ? _cache.searchText : '');
  const [sortBy, setSortBy] = useState(samePlace ? _cache.sortBy : 'distance');

  const types = ['restaurant', 'shopping', 'entertainment', 'hotel', 'transport', 'service'];

  // 路由守卫：周边详细页面仅北邮可用，其他地点重定向到详情页
  useEffect(() => {
    if (placeId && placeId !== 'place_001') {
      navigate(`/places/${placeId}`, { replace: true });
    }
  }, [placeId, navigate]);

  // 状态变化时同步回缓存
  useEffect(() => {
    if (!loading) {
      _cache = { ..._cache, activeType, searchText, sortBy };
    }
  }, [activeType, searchText, sortBy, loading]);

  useEffect(() => {
    if (samePlace) return;
    const load = async () => {
      setLoading(true);
      try {
        const [res, countsRes] = await Promise.all([
          surroundingAPI.listByPlace(placeId),
          surroundingAPI.getCategoryCounts(placeId),
        ]);
        if (res.success) {
          const items = res.data || [];
          _cache = { placeId, items, counts: countsRes.success ? countsRes.data || {} : {}, activeType: ALL, searchText: '', sortBy: 'distance' };
          setAllItems(items);
          setFiltered(items);
          if (countsRes.success) setCategoryCounts(countsRes.data || {});
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [placeId, samePlace]);

  const applyFilter = useCallback(() => {
    let result = [...allItems];
    if (activeType !== ALL) result = result.filter(r => r.type === activeType);
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      result = result.filter(r =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q) ||
        (r.tags || '').toLowerCase().includes(q)
      );
    }
    if (sortBy === 'distance') result.sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0));
    else if (sortBy === 'rating') result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sortBy === 'price') result.sort((a, b) => (a.avgCost || 999) - (b.avgCost || 999));
    setFiltered(result);
  }, [allItems, activeType, searchText, sortBy]);

  useEffect(() => { applyFilter(); }, [applyFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles size={24} className="text-accent" />
            校园周边
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            共 {allItems.length} 家周边商户和服务设施
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="搜索周边商户、标签..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm
                     placeholder-gray-500 focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        <button
          onClick={() => setActiveType(ALL)}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all
            ${activeType === ALL
              ? 'bg-accent text-white shadow-lg shadow-accent/25'
              : 'bg-surface border border-border text-gray-300 hover:text-white hover:border-gray-600'}`}
        >
          全部 ({allItems.length})
        </button>
        {types.map(t => {
          const count = categoryCounts[t] || 0;
          if (count === 0) return null;
          return (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all
                ${activeType === t
                  ? 'bg-accent text-white shadow-lg shadow-accent/25'
                  : 'bg-surface border border-border text-gray-300 hover:text-white hover:border-gray-600'}`}
            >
              {surroundingAPI.getTypeIcon(t)} {surroundingAPI.getTypeLabel(t)} ({count})
            </button>
          );
        })}
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-gray-500">排序:</span>
        {[
          { key: 'distance', label: '距离最近' },
          { key: 'rating', label: '评分最高' },
          { key: 'price', label: '价格最低' },
        ].map(opt => (
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key)}
            className={`px-3 py-1 rounded-lg text-xs transition-all
              ${sortBy === opt.key
                ? 'bg-accent/20 text-accent border border-accent/30'
                : 'bg-surface border border-border text-gray-400 hover:text-white'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <EmptyState icon="search" title="没找到匹配的商户" description="试试换个关键词或分类" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(item => (
            <SurroundingCard
              key={item.id}
              item={item}
              onClick={() => navigate(`/surrounding/${placeId}/${item.id}`)}
            />
          ))}
        </div>
      )}

      <div className="h-16" />
    </div>
  );
}

function SurroundingCard({ item, onClick }) {
  const imageUrl = item.image ? getFileUrl(item.image) : null;

  return (
    <div
      onClick={onClick}
      className="bg-surface border border-border rounded-2xl p-4 cursor-pointer
                 hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5
                 transition-all duration-200 group"
    >
      <div className="flex gap-3">
        {/* Thumbnail */}
        <div className="w-20 h-20 rounded-xl bg-black/20 overflow-hidden flex-shrink-0">
          {imageUrl ? (
            <LazyImage src={imageUrl} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl">
              {surroundingAPI.getTypeIcon(item.type)}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-white text-sm truncate group-hover:text-accent transition-colors">
              {item.name}
            </h3>
            {item.avgCost != null ? (
              <span className="text-xs text-accent font-medium whitespace-nowrap">¥{item.avgCost}/人</span>
            ) : item.priceRange && (
              <span className="text-xs text-accent font-medium whitespace-nowrap">{item.priceRange}</span>
            )}
          </div>

          {/* Rating & distance */}
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            {item.rating > 0 && (
              <span className="flex items-center gap-0.5">
                <Star size={12} className="text-yellow-500 fill-yellow-500" />
                {item.rating}
              </span>
            )}
            {item.distanceMeters != null && (
              <span className="flex items-center gap-0.5">
                <MapPin size={12} />
                {item.distanceMeters < 1000
                  ? `${item.distanceMeters}m`
                  : `${(item.distanceMeters / 1000).toFixed(1)}km`}
              </span>
            )}
            {item.studentDiscount === 1 && (
              <span className="px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 text-[10px] font-medium">
                学生优惠
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">
            {item.description || item.name}
          </p>

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {(typeof item.tags === 'string' ? JSON.parse(item.tags || '[]') : item.tags)
                .slice(0, 3)
                .map((tag, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded-md bg-accent/10 text-accent text-[10px]">
                    {tag}
                  </span>
                ))}
            </div>
          )}
        </div>

        <ChevronRight size={16} className="text-gray-600 flex-shrink-0 mt-2 group-hover:text-accent transition-colors" />
      </div>
    </div>
  );
}

export default SurroundingPage;
