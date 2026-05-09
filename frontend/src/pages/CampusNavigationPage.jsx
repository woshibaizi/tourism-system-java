import React, { useEffect, useMemo, useState } from 'react';
import { Navigation, MapPin, Building, AlertCircle } from 'lucide-react';
import { getPlaces, getBuildings, getFacilities, routeAPI } from '../services/api';
import AMapView from '../components/Map/AMapView';
import CTAButton from '../components/ui/CTAButton';
import SectionLabel from '../components/ui/SectionLabel';
import IndoorNavigationPage from './IndoorNavigationPage';

function CampusNavigationPage() {
  const [loading, setLoading] = useState(true);
  const [navigating, setNavigating] = useState(false);
  const [locating, setLocating] = useState(false);
  const [campusPlace, setCampusPlace] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [selectedStart, setSelectedStart] = useState('');
  const [selectedEnd, setSelectedEnd] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [routeResult, setRouteResult] = useState(null);
  const [activeTab, setActiveTab] = useState('campus');

  useEffect(() => {
    const load = async () => {
      try {
        const places = (await getPlaces()).data || [];
        const campus = places.find((p) => p.id === 'place_001' || (p.name || '').includes('北邮'));
        if (campus) {
          setCampusPlace(campus);
          const [b, f] = await Promise.all([getBuildings(campus.id), getFacilities(campus.id)]);
          setBuildings(b.data || []);
          setFacilities(f.data || []);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const allNodes = useMemo(() => {
    const nodes = [];
    buildings.forEach((b) => nodes.push({ ...b, id: b.id, name: b.name, type: '建筑', group: 'buildings' }));
    facilities.forEach((f) => nodes.push({ ...f, id: f.id, name: f.name, type: f.type || '设施', group: 'facilities' }));
    return nodes;
  }, [buildings, facilities]);

  const selectedMapMarkers = useMemo(
    () => [selectedStart, selectedEnd]
      .map((id) => allNodes.find((node) => node.id === id))
      .filter(Boolean),
    [allNodes, selectedStart, selectedEnd]
  );

  const groupedNodes = useMemo(() => {
    const groups = { 门: [], 教学楼: [], 宿舍: [], 服务: [], 其他: [] };
    allNodes.forEach((n) => {
      if (n.name.includes('门')) groups['门'].push(n);
      else if (n.name.includes('教') || n.name.includes('学') || n.name.includes('楼')) groups['教学楼'].push(n);
      else if (n.name.includes('宿') || n.name.includes('舍')) groups['宿舍'].push(n);
      else if (n.name.includes('食') || n.name.includes('餐') || n.name.includes('超') || n.name.includes('店')) groups['服务'].push(n);
      else groups['其他'].push(n);
    });
    return Object.entries(groups).filter(([, items]) => items.length > 0);
  }, [allNodes]);

  const handleNavigate = async () => {
    if (!selectedStart || !selectedEnd || !campusPlace) return;
    setNavigating(true);
    try {
      const res = await routeAPI.planSingleRoute({
        placeId: campusPlace.id,
        start: selectedStart,
        end: selectedEnd,
        vehicle: '步行',
        strategy: 'time',
        placeType: '校园',
        provider: 'local',
      });
      if (res.success) setRouteResult(res.data);
    } catch (e) { console.error(e); }
    finally { setNavigating(false); }
  };

  const handleLocate = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCurrentLocation({ lng: pos.coords.longitude, lat: pos.coords.latitude }); setLocating(false); },
      () => { setLocating(false); }
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" /></div>;
  }

  const NodeSelect = ({ value, onChange, label }) => (
    <div className="flex-1">
      <label className="block font-sans text-[10px] uppercase tracking-widest text-muted mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-neutral-200 px-3 py-2 text-sm font-sans bg-white">
        <option value="">请选择{label}</option>
        {groupedNodes.map(([group, items]) => (
          <optgroup key={group} label={group}>
            {items.map((n) => <option key={n.id} value={n.id}>{n.name} ({n.type})</option>)}
          </optgroup>
        ))}
      </select>
    </div>
  );

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-12">
      <SectionLabel>Campus Navigation</SectionLabel>
      <h1 className="font-serif text-3xl text-heading mb-8">校内导航</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 border-b border-neutral-100">
        {[
          { key: 'campus', label: '学校内导航' },
          { key: 'indoor', label: '室内导航' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-6 py-3 font-sans text-xs uppercase tracking-widest border-b-2 transition-colors ${activeTab === t.key ? 'border-accent text-heading' : 'border-transparent text-muted hover:text-heading'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'indoor' ? (
        <IndoorNavigationPage embedded />
      ) : (
        <>
          {/* Controls */}
          <div className="flex flex-col md:flex-row gap-4 mb-6 pb-6 border-b border-neutral-100">
            <NodeSelect value={selectedStart} onChange={setSelectedStart} label="起点" />
            <NodeSelect value={selectedEnd} onChange={setSelectedEnd} label="终点" />
          </div>

          <div className="flex gap-3 mb-8">
            <CTAButton onClick={handleNavigate} disabled={!selectedStart || !selectedEnd || navigating}>
              <Navigation size={16} className="inline mr-1" /> {navigating ? '规划中...' : '开始导航'}
            </CTAButton>
            <CTAButton variant="secondary" onClick={handleLocate} disabled={locating}>
              {locating ? '定位中...' : '定位'}
            </CTAButton>
          </div>

          {campusPlace && (
            <div className="mb-8 border border-amber-100 bg-amber-50 p-4 flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-600" />
              <p className="font-sans text-sm text-amber-800">当前使用校内本地路径算法，不支持外部道路导航。</p>
            </div>
          )}

          <AMapView
            routeResult={routeResult}
            buildings={selectedMapMarkers}
            facilities={[]}
            currentLocation={currentLocation}
            onLocationChange={setCurrentLocation}
            showRouteMarkers={false}
            mapHeight={500}
          />

          {routeResult && (
            <div className="mt-8 border border-neutral-100 p-6">
              <div className="flex items-center gap-6 mb-4">
                <div>
                  <span className="font-sans text-xs uppercase tracking-widest text-muted">距离</span>
                  <p className="font-serif text-xl text-heading">{routeResult.distance || '-'}</p>
                </div>
                <div>
                  <span className="font-sans text-xs uppercase tracking-widest text-muted">预计时间</span>
                  <p className="font-serif text-xl text-heading">{routeResult.duration || '-'}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default CampusNavigationPage;
