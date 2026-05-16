import React, { useState, useEffect } from 'react';
import { MapPin, Building, Search, Star, Coffee, ShoppingCart, Library, Store } from 'lucide-react';
import { getPlaces, getBuildingsByPlace, getNearestFacilities } from '../services/api';
import { useToast } from '../components/ui/Toast';
import CTAButton from '../components/ui/CTAButton';
import SectionLabel from '../components/ui/SectionLabel';
import StarRating from '../components/ui/StarRating';
import EmptyState from '../components/ui/EmptyState';

const FACILITY_TYPES = [
  { value: '', label: '全部类型', icon: Store },
  { value: '商店', label: '商店', icon: ShoppingCart },
  { value: '饭店', label: '饭店', icon: Coffee },
  { value: '洗手间', label: '洗手间', icon: null },
  { value: '图书馆', label: '图书馆', icon: Library },
];

function FacilityQueryPage() {
  const { showToast } = useToast();
  const [places, setPlaces] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 6;

  useEffect(() => {
    const load = async () => {
      try {
        const p = await getPlaces();
        setPlaces(p.data || []);
      } catch (e) { console.error(e); }
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedPlace) { setBuildings([]); return; }
    const load = async () => {
      try {
        const b = await getBuildingsByPlace(selectedPlace);
        setBuildings(b.data || []);
        setSelectedBuilding('');
      } catch { setBuildings([]); }
    };
    load();
  }, [selectedPlace]);

  const handleSearch = async () => {
    if (!selectedPlace || !selectedBuilding) {
      showToast('error', '请选择景区和建筑');
      return;
    }
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await getNearestFacilities(selectedBuilding, selectedPlace, selectedType || undefined);
      setResults(res.data || []);
      setPage(1);
    } catch { showToast('error', '查询失败'); }
    finally { setLoading(false); }
  };

  const paginated = results.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(results.length / pageSize);

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-12">
      <SectionLabel>Find Nearby</SectionLabel>
      <h1 className="font-serif text-3xl text-heading mb-8">设施查询</h1>

      <div className="flex flex-col md:flex-row gap-4 mb-8 pb-6 border-b border-border">
        <select value={selectedPlace} onChange={(e) => setSelectedPlace(e.target.value)}
          className="border border-border px-3 py-2 text-sm font-sans bg-surface">
          <option value="">选择景区</option>
          {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={selectedBuilding} onChange={(e) => setSelectedBuilding(e.target.value)}
          className="border border-border px-3 py-2 text-sm font-sans bg-surface" disabled={!selectedPlace}>
          <option value="">选择建筑</option>
          {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}
          className="border border-border px-3 py-2 text-sm font-sans bg-surface">
          {FACILITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <CTAButton onClick={handleSearch} disabled={loading}>
          <Search size={16} className="inline mr-1" /> 搜索
        </CTAButton>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin" /></div>
      ) : paginated.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginated.map((f) => (
              <div key={f.id} className="border border-border p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-accent-soft flex items-center justify-center">
                    <Store size={20} className="text-muted" />
                  </div>
                  <div>
                    <h3 className="font-serif text-base text-heading">{f.name}</h3>
                    <p className="font-sans text-xs text-muted">{f.type || '设施'}</p>
                  </div>
                </div>
                {f.distance != null && (
                  <span className="inline-block px-2 py-0.5 text-xs font-sans bg-accent-soft border border-border text-muted">
                    {f.distance}m
                  </span>
                )}
                {f.rating && <StarRating value={f.rating} size={12} className="mt-2" />}
                {f.description && <p className="font-sans text-xs text-muted mt-2">{f.description}</p>}
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} onClick={() => setPage(i + 1)}
                  className={`w-10 h-10 text-sm border ${page === i + 1 ? 'bg-heading text-white border-heading' : 'border-border hover:border-black text-muted'}`}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      ) : hasSearched ? (
        <EmptyState icon={Store} title="未找到设施" description="试试调整搜索条件" />
      ) : null}
    </div>
  );
}

export default FacilityQueryPage;
