import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Crosshair, MapPin, AlertCircle, Loader } from 'lucide-react';
import { loadAMap } from '../../utils/amapLoader';
import { getCurrentLocation } from '../../utils/location';

// 北京邮电大学中心坐标 (GCJ-02)，与后端 ShortestPathAlgorithm 默认值一致
const DEFAULT_CENTER = [116.3633, 39.9595];
const DEFAULT_ZOOM = 16;

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toLngLat = (value) => {
  if (Array.isArray(value) && value.length >= 2) {
    const lng = toNumber(value[0]);
    const lat = toNumber(value[1]);
    return lng != null && lat != null ? [lng, lat] : null;
  }
  if (value && typeof value === 'object') {
    const lng = toNumber(
      typeof value.getLng === 'function' ? value.getLng() : value.lng ?? value.longitude ?? value.lon ?? value.x
    );
    const lat = toNumber(
      typeof value.getLat === 'function' ? value.getLat() : value.lat ?? value.latitude ?? value.y
    );
    return lng != null && lat != null ? [lng, lat] : null;
  }
  return null;
};

const LEG_COLORS = ['#0a0a0a', '#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#c026d3'];

export default function AMapView({
  routeResult,
  buildings = [],
  facilities = [],
  currentLocation,
  onLocationChange,
  showControls = true,
  showRouteMarkers = false,
  mapHeight = 500,
  selectedLeg = null,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [locating, setLocating] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  const [animationEnabled] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(1000);
  const [, setVisibleNodes] = useState(0);
  const [animTimer, setAnimTimer] = useState(null);

  const markersRef = useRef([]);
  const polylineRef = useRef(null);
  const legPolylineRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || useFallback) return;
    let cancelled = false;

    const init = async () => {
      try {
        const AMap = await loadAMap();
        if (cancelled || !containerRef.current) return;

        const map = new AMap.Map(containerRef.current, {
          center: currentLocation ? [currentLocation.lng, currentLocation.lat] : DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          resizeEnable: true,
        });
        mapRef.current = { map, AMap };
        setMapReady(true);
      } catch (e) {
        console.error('AMap init failed:', e);
        setMapError('地图加载失败');
        setUseFallback(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createMarkerHTML = (type) => {
    let bg = '#6b7280';
    let label = '';

    if (type === '起点') { bg = '#16a34a'; label = '起'; }
    else if (type === '终点') { bg = '#dc2626'; label = '终'; }
    else if (type && type.startsWith('途经')) { bg = '#2563eb'; label = type.replace('途经', ''); }
    else if (type === '建筑') { bg = '#6b7280'; label = '建'; }

    return `<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35));">
      <div style="background:${bg};color:#fff;padding:3px 9px;border-radius:5px;font-size:12px;font-weight:700;white-space:nowrap;line-height:1.3;font-family:system-ui,-apple-system,sans-serif;">${label}</div>
      <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid ${bg};"></div>
    </div>`;
  };

  useEffect(() => {
    if (!mapReady) return;
    const { map, AMap } = mapRef.current;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }
    if (legPolylineRef.current) { legPolylineRef.current.setMap(null); legPolylineRef.current = null; }

    const mapPath = routeResult?.mapPath;
    const coords = routeResult?.coordinates;
    const path = (Array.isArray(mapPath) && mapPath.length > 0) ? mapPath
               : (Array.isArray(coords) && coords.length > 0) ? coords
               : [];
    const steps = routeResult?.steps || [];
    const legPolylines = routeResult?.legPolylines || [];

    if (currentLocation) {
      const current = toLngLat(currentLocation);
      if (current) {
        const marker = new AMap.Marker({
          position: current,
          content: '<div style="width:16px;height:16px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(59,130,246,0.35),0 2px 6px rgba(0,0,0,0.25);"></div>',
          offset: new AMap.Pixel(-8, -8),
          title: '当前位置',
        });
        marker.setMap(map);
        markersRef.current.push(marker);
        map.setCenter(current);
      }
    }

    // 选中的单段路径
    if (selectedLeg != null && legPolylines[selectedLeg]) {
      const leg = legPolylines[selectedLeg];
      const coords = Array.isArray(leg.polyline) ? leg.polyline.map(toLngLat).filter(Boolean) : [];
      if (coords.length >= 2) {
        legPolylineRef.current = new AMap.Polyline({
          path: coords,
          strokeColor: LEG_COLORS[selectedLeg % LEG_COLORS.length],
          strokeWeight: 5,
          strokeOpacity: 0.8,
        });
        legPolylineRef.current.setMap(map);
        map.setFitView([legPolylineRef.current]);
      }
    } else if (path.length > 0) {
      // 默认显示完整路径
      const lnglatPath = path.map(toLngLat).filter(Boolean);
      if (lnglatPath.length >= 2) {
        polylineRef.current = new AMap.Polyline({
          path: lnglatPath,
          strokeColor: '#0a0a0a',
          strokeWeight: 4,
          strokeOpacity: 0.7,
        });
        polylineRef.current.setMap(map);
        map.setFitView([polylineRef.current]);
      }
    }

    if (showRouteMarkers) {
      steps.forEach((step, i) => {
        const coordinate = toLngLat(step.coordinates);
        if (coordinate) {
          const marker = new AMap.Marker({
            position: coordinate,
            title: step.name || `Step ${i + 1}`,
          });
          marker.setMap(map);
          markersRef.current.push(marker);
        }
      });
    }

    buildings.forEach((b) => {
      const lng = b.mapLng || b.lng || b.longitude;
      const lat = b.mapLat || b.lat || b.latitude;
      if (lng != null && lat != null) {
        const m = new AMap.Marker({
          position: [Number(lng), Number(lat)],
          content: createMarkerHTML(b.type),
          offset: new AMap.Pixel(-20, -32),
          title: b.name,
        });
        m.setMap(map);
        markersRef.current.push(m);
      }
    });

    facilities.forEach((f) => {
      const lng = f.mapLng || f.lng || f.longitude;
      const lat = f.mapLat || f.lat || f.latitude;
      if (lng != null && lat != null) {
        const m = new AMap.Marker({
          position: [Number(lng), Number(lat)],
          content: createMarkerHTML(f.type),
          offset: new AMap.Pixel(-20, -32),
          title: f.name,
        });
        m.setMap(map);
        markersRef.current.push(m);
      }
    });

    if (!polylineRef.current && !legPolylineRef.current && markersRef.current.length > 0) {
      map.setFitView(markersRef.current);
    }
  }, [mapReady, routeResult, buildings, facilities, currentLocation, showRouteMarkers, selectedLeg]);

  const handleLocate = async () => {
    setLocating(true);
    try {
      const pos = await getCurrentLocation();
      if (pos && mapRef.current) {
        mapRef.current.map.setCenter([pos.lng, pos.lat]);
        onLocationChange?.(pos);
      }
    } catch { /* ignore */ }
    finally { setLocating(false); }
  };

  const handlePlayPause = () => {
    if (isAnimating) {
      clearInterval(animTimer);
      setIsAnimating(false);
    } else {
      setVisibleNodes(0);
      setIsAnimating(true);
      const steps = (routeResult?.steps || []).length || 0;
      const timer = setInterval(() => {
        setVisibleNodes((prev) => {
          if (prev >= steps) { clearInterval(timer); setIsAnimating(false); return prev; }
          return prev + 1;
        });
      }, animationSpeed);
      setAnimTimer(timer);
    }
  };

  const handleReset = () => {
    clearInterval(animTimer);
    setIsAnimating(false);
    setVisibleNodes(0);
  };

  if (useFallback) {
    return (
      <div style={{ height: mapHeight }} className="bg-accent-soft border border-border flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={32} className="mx-auto mb-3 text-muted" />
          <p className="font-sans text-sm text-muted">{mapError || '地图暂不可用'}</p>
          <p className="font-sans text-xs text-muted mt-1">请检查网络连接后重试</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {loading && (
        <div style={{ height: mapHeight }} className="flex items-center justify-center bg-accent-soft border border-border">
          <Loader size={24} className="animate-spin text-muted" />
        </div>
      )}

      <div ref={containerRef} style={{ height: mapHeight, display: loading ? 'none' : 'block' }} />

      {showControls && mapReady && (
        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
          <button onClick={handleLocate} disabled={locating}
            className="w-9 h-9 bg-surface border border-border flex items-center justify-center hover:bg-neutral-50 shadow-sm">
            <Crosshair size={16} className={locating ? 'animate-spin' : ''} />
          </button>
          {animationEnabled && (
            <>
              <button onClick={handlePlayPause}
                className="w-9 h-9 bg-surface border border-border flex items-center justify-center hover:bg-neutral-50 shadow-sm">
                {isAnimating ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button onClick={handleReset}
                className="w-9 h-9 bg-surface border border-border flex items-center justify-center hover:bg-neutral-50 shadow-sm">
                <RotateCcw size={16} />
              </button>
              <div className="bg-surface border border-border px-2 py-1 shadow-sm">
                <input type="range" min={200} max={3000} value={animationSpeed}
                  onChange={(e) => setAnimationSpeed(Number(e.target.value))}
                  className="w-16 h-1 accent-black" />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
