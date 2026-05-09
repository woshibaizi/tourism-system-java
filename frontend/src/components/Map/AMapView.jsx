import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Crosshair, MapPin, AlertCircle, Loader } from 'lucide-react';
import { loadAMap } from '../../utils/amapLoader';
import { getCurrentLocation } from '../../utils/location';

const DEFAULT_CENTER = [116.3518, 39.9607];
const DEFAULT_ZOOM = 16;

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isLngLat = (value) =>
  Array.isArray(value) && value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]));

export default function AMapView({
  routeResult,
  buildings = [],
  facilities = [],
  currentLocation,
  onLocationChange,
  showControls = true,
  mapHeight = 500,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [locating, setLocating] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  const [animationEnabled, setAnimationEnabled] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(1000);
  const [visibleNodes, setVisibleNodes] = useState(0);
  const [animTimer, setAnimTimer] = useState(null);

  const markersRef = useRef([]);
  const polylineRef = useRef(null);

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
  }, []);

  useEffect(() => {
    if (!mapReady || !routeResult) return;
    const { map, AMap } = mapRef.current;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }

    const path = routeResult.coordinates || routeResult.path || [];
    const steps = routeResult.steps || [];

    if (path.length > 0) {
      const lnglatPath = path.filter(isLngLat).map((c) => [Number(c[0]), Number(c[1])]);
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

    steps.forEach((step, i) => {
      if (step.coordinates && isLngLat(step.coordinates)) {
        const marker = new AMap.Marker({
          position: [Number(step.coordinates[0]), Number(step.coordinates[1])],
          title: step.name || `Step ${i + 1}`,
        });
        marker.setMap(map);
        markersRef.current.push(marker);
      }
    });

    buildings.forEach((b) => {
      if (b.longitude && b.latitude) {
        const m = new AMap.Marker({ position: [Number(b.longitude), Number(b.latitude)], title: b.name });
        m.setMap(map);
        markersRef.current.push(m);
      }
    });

    facilities.forEach((f) => {
      if (f.longitude && f.latitude) {
        const m = new AMap.Marker({ position: [Number(f.longitude), Number(f.latitude)], title: f.name });
        m.setMap(map);
        markersRef.current.push(m);
      }
    });
  }, [mapReady, routeResult]);

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
