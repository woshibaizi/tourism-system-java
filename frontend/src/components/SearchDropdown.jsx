import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, BookOpen, Store, ArrowRight, Loader2 } from 'lucide-react';
import { searchAPI, getFileUrl, surroundingAPI } from '../services/api';
import StarRating from './ui/StarRating';

const MAX_RESULTS = 5;
const MAX_PLACES = 2;
const MAX_DIARIES = 2;
const MAX_SURROUNDING = 2;

function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function ResultRow({ item, onClick }) {
  const isPlace = item.__type === 'place';
  const isSurrounding = item.__type === 'surrounding';
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg hover:bg-accent-soft/40 cursor-pointer transition-colors group"
    >
      <div className="w-10 h-10 rounded-lg bg-accent-soft flex-shrink-0 overflow-hidden">
        {isSurrounding ? (
          <div className="w-full h-full flex items-center justify-center text-lg">
            {surroundingAPI.getTypeIcon(item.type)}
          </div>
        ) : isPlace ? (
          item.image ? (
            <img src={getFileUrl(item.image)} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <MapPin size={18} className="w-full h-full p-2 text-muted/40" />
          )
        ) : (
          item.images && item.images.length > 0 ? (
            <img src={getFileUrl(item.images[0])} alt={item.title} className="w-full h-full object-cover" />
          ) : (
            <BookOpen size={18} className="w-full h-full p-2 text-muted/40" />
          )
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-sans text-sm text-heading group-hover:text-accent transition-colors truncate">
            {isSurrounding ? item.name : isPlace ? item.name : item.title}
          </span>
          <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded font-sans ${
            isSurrounding ? 'bg-accent/10 text-accent' : isPlace ? 'bg-accent/10 text-accent' : 'bg-muted/10 text-muted'
          }`}>
            {isSurrounding ? '周边' : isPlace ? '地点' : '游记'}
          </span>
        </div>
        <div className="font-sans text-xs text-muted truncate mt-0.5">
          {isSurrounding ? (
            <span className="flex items-center gap-1">
              {surroundingAPI.getTypeLabel(item.type)}
              {item.distanceMeters != null && ` · ${item.distanceMeters < 1000 ? `${item.distanceMeters}m` : `${(item.distanceMeters / 1000).toFixed(1)}km`}`}
            </span>
          ) : isPlace ? (
            <StarRating value={item.rating || 0} size={10} />
          ) : (
            item.content || item.description || ''
          )}
        </div>
      </div>
    </div>
  );
}

export default function SearchDropdown() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setIsOpen(true);

    searchAPI.globalSearch(debouncedQuery.trim()).then((data) => {
      if (cancelled) return;

      const places = (data.places || []).map((p) => ({ ...p, __type: 'place' }));
      const diaries = (data.diaries || []).map((d) => ({ ...d, __type: 'diary' }));
      const surroundings = (data.surroundings || []).map((s) => ({ ...s, __type: 'surrounding' }));

      // Build unified list: places first, then surroundings, then diaries
      const merged = [];
      const placeSlice = places.slice(0, MAX_PLACES);
      merged.push(...placeSlice);

      let remaining = MAX_RESULTS - merged.length;
      const srSlice = surroundings.slice(0, Math.min(MAX_SURROUNDING, remaining));
      merged.push(...srSlice);

      remaining = MAX_RESULTS - merged.length;
      const diarySlice = diaries.slice(0, Math.min(MAX_DIARIES, remaining));
      merged.push(...diarySlice);

      setResults(merged);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setResults([]);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [debouncedQuery]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFocus = useCallback(() => {
    if (query.trim() && results.length > 0) {
      setIsOpen(true);
    }
  }, [query, results]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const q = query.trim();
      if (q) {
        setIsOpen(false);
        navigate(`/search?q=${encodeURIComponent(q)}`);
      }
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleResultClick = (item) => {
    setIsOpen(false);
    setQuery('');
    if (item.__type === 'surrounding') {
      navigate(`/surrounding/${item.placeId}/${item.id}`);
    } else if (item.__type === 'place') {
      navigate(`/places/${item.id}`);
    } else {
      navigate(`/diaries/${item.id}`);
    }
  };

  const handleViewAll = () => {
    const q = query.trim();
    if (q) {
      setIsOpen(false);
      navigate(`/search?q=${encodeURIComponent(q)}`);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted/50 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder="搜索地点、周边商户、游记..."
          className="w-full h-14 pl-12 pr-4 bg-surface border border-border rounded-xl text-body placeholder:text-muted/50 font-sans text-base focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/20 transition-all"
        />
        {loading && (
          <Loader2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted/40 animate-spin" />
        )}
      </div>

      {isOpen && query.trim() && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-surface border border-border rounded-xl shadow-lg overflow-hidden z-50">
          {loading && results.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted/60">
              <Loader2 size={20} className="animate-spin mr-2" />
              搜索中...
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center text-muted/60 text-sm">未找到相关结果</div>
          ) : (
            <>
              <div className="px-4 pt-3 pb-1">
                {results.map((item) => (
                  <ResultRow
                    key={item.__type + item.id}
                    item={item}
                    onClick={() => handleResultClick(item)}
                  />
                ))}
              </div>
              <div
                onClick={handleViewAll}
                className="flex items-center justify-center gap-1.5 py-3 border-t border-border hover:bg-accent-soft/30 cursor-pointer transition-colors text-sm text-accent font-sans"
              >
                查看全部结果
                <ArrowRight size={14} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
