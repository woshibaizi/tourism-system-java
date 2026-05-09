import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, MapPin, Navigation, Car, Footprints, Bike } from 'lucide-react';
import { loadAMap } from '../utils/amapLoader';
import AMapView from '../components/Map/AMapView';
import CTAButton from '../components/ui/CTAButton';
import SectionLabel from '../components/ui/SectionLabel';

const TRAVEL_MODES = [
  { key: 'driving', label: '驾车', icon: Car },
  { key: 'walking', label: '步行', icon: Footprints },
  { key: 'cycling', label: '骑行', icon: Bike },
];

function RoutePage() {
  const location = useLocation();
  const [amapReady, setAmapReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [startKeyword, setStartKeyword] = useState('');
  const [endKeyword, setEndKeyword] = useState('');
  const [selectedStart, setSelectedStart] = useState(null);
  const [selectedEnd, setSelectedEnd] = useState(null);
  const [startOptions, setStartOptions] = useState([]);
  const [endOptions, setEndOptions] = useState([]);
  const [travelMode, setTravelMode] = useState('driving');
  const [routeResult, setRouteResult] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [searchingStart, setSearchingStart] = useState(false);
  const [searchingEnd, setSearchingEnd] = useState(false);
  const autoCompleteRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      try {
        const AMap = await loadAMap();
        autoCompleteRef.current = new AMap.AutoComplete({ city: '全国' });
        setAmapReady(true);
      } catch (e) { console.error(e); }
    };
    init();
    if (location.state?.presetDestinationKeyword) {
      setEndKeyword(location.state.presetDestinationKeyword);
    }
  }, []);

  const searchPois = async (keyword, setOptions, setSearching) => {
    if (!keyword.trim() || !autoCompleteRef.current) return;
    setSearching(true);
    try {
      autoCompleteRef.current.search(keyword, (status, result) => {
        if (status === 'complete') {
          setOptions((result.tips || []).slice(0, 10));
        }
        setSearching(false);
      });
    } catch { setSearching(false); }
  };

  const handlePlanRoute = async () => {
    if (!selectedStart || !selectedEnd) return;
    setLoading(true);
    try {
      const AMap = (await loadAMap());
      const modeMap = { driving: 'Driving', walking: 'Walking', cycling: 'Riding' };
      const service = new AMap[modeMap[travelMode]]({ policy: 0 });
      service.search(
        { origin: selectedStart.location, destination: selectedEnd.location },
        (status, result) => {
          if (status === 'complete') {
            const route = result.routes?.[0];
            if (route) {
              setRouteResult({
                distance: route.distance,
                duration: route.duration,
                coordinates: route.path || [],
                steps: (route.steps || []).map((s) => ({
                  instruction: s.instruction || s.road || '',
                  distance: s.distance || 0,
                  coordinates: s.path?.[0] || s.start_location,
                })),
              });
            }
          }
        }
      );
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleLocate = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lng: pos.coords.longitude, lat: pos.coords.latitude };
        setCurrentLocation(loc);
        setSelectedStart({ name: '我的位置', location: loc });
        setStartKeyword('我的位置');
        setLocating(false);
      },
      () => { setLocating(false); }
    );
  };

  const formatDist = (m) => m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
  const formatTime = (s) => s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}min` : `${Math.floor(s / 60)} min`;

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-12">
      <SectionLabel>Plan Your Route</SectionLabel>
      <h1 className="font-serif text-3xl text-heading mb-8">路线规划</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="space-y-4">
          <div>
            <label className="block font-sans text-xs uppercase tracking-widest text-muted mb-1">起点</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={startKeyword}
                onChange={(e) => { setStartKeyword(e.target.value); searchPois(e.target.value, setStartOptions, setSearchingStart); }}
                placeholder="输入起点"
                className="w-full pl-9 pr-4 py-2 border border-neutral-200 text-sm font-sans focus:border-black focus:ring-0 focus:outline-none"
              />
            </div>
            {startOptions.length > 0 && (
              <div className="border border-neutral-200 mt-1 max-h-40 overflow-y-auto">
                {startOptions.map((tip, i) => (
                  <div key={i} onClick={() => { setSelectedStart({ name: tip.name, location: tip.location }); setStartKeyword(tip.name); setStartOptions([]); }}
                    className="px-3 py-2 text-sm font-sans hover:bg-neutral-50 cursor-pointer">{tip.name}</div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block font-sans text-xs uppercase tracking-widest text-muted mb-1">终点</label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={endKeyword}
                onChange={(e) => { setEndKeyword(e.target.value); searchPois(e.target.value, setEndOptions, setSearchingEnd); }}
                placeholder="输入终点"
                className="w-full pl-9 pr-4 py-2 border border-neutral-200 text-sm font-sans focus:border-black focus:ring-0 focus:outline-none"
              />
            </div>
            {endOptions.length > 0 && (
              <div className="border border-neutral-200 mt-1 max-h-40 overflow-y-auto">
                {endOptions.map((tip, i) => (
                  <div key={i} onClick={() => { setSelectedEnd({ name: tip.name, location: tip.location }); setEndKeyword(tip.name); setEndOptions([]); }}
                    className="px-3 py-2 text-sm font-sans hover:bg-neutral-50 cursor-pointer">{tip.name}</div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {TRAVEL_MODES.map((m) => {
              const Icon = m.icon;
              return (
                <button key={m.key} onClick={() => setTravelMode(m.key)}
                  className={`flex items-center gap-1 px-3 py-2 text-xs font-sans uppercase tracking-widest border transition-colors ${travelMode === m.key ? 'border-accent text-heading' : 'border-border text-muted hover:text-heading'}`}>
                  <Icon size={14} /> {m.label}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <CTAButton onClick={handlePlanRoute} disabled={!selectedStart || !selectedEnd || loading}>
              <Navigation size={16} className="inline mr-1" /> {loading ? '规划中...' : '开始规划'}
            </CTAButton>
            <CTAButton variant="secondary" onClick={handleLocate} disabled={locating}>
              {locating ? '定位中...' : '使用我的位置'}
            </CTAButton>
          </div>
        </div>

        <div className="lg:col-span-2">
          <AMapView
            routeResult={routeResult}
            currentLocation={currentLocation}
            onLocationChange={setCurrentLocation}
            mapHeight={450}
          />
        </div>
      </div>

      {routeResult && (
        <div className="border border-neutral-100 p-6">
          <div className="flex items-center gap-6 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-sans text-xs uppercase tracking-widest text-muted">距离</span>
              <span className="font-serif text-xl text-heading">{formatDist(routeResult.distance)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-sans text-xs uppercase tracking-widest text-muted">预计时间</span>
              <span className="font-serif text-xl text-heading">{formatTime(routeResult.duration)}</span>
            </div>
          </div>
          {routeResult.steps && routeResult.steps.length > 0 && (
            <div className="space-y-2 mt-4 pt-4 border-t border-neutral-100">
              {routeResult.steps.slice(0, 10).map((step, i) => (
                <div key={i} className="flex items-center gap-3 text-sm font-sans text-body">
                  <span className="w-6 h-6 flex items-center justify-center border border-neutral-200 text-xs font-mono">{i + 1}</span>
                  <span>{step.instruction || `前进 ${formatDist(step.distance)}`}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default RoutePage;
