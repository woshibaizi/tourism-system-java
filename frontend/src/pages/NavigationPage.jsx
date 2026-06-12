import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import {
  Search, MapPin, Navigation, Footprints, Bike, Car,
  Building, AlertCircle, Plus, Trash2, Route, X,
} from 'lucide-react';
import { loadAMap } from '../utils/amapLoader';
import { getPlaces, getBuildings, getFacilities, routeAPI, indoorNavigationAPI, multiPointAPI } from '../services/api';
import AMapView from '../components/Map/AMapView';
import CTAButton from '../components/ui/CTAButton';
import PointModeToggle from '../components/ui/PointModeToggle';
import WaypointList from '../components/ui/WaypointList';
import RouteSummary from '../components/ui/RouteSummary';

// ==================== 常量 ====================

const TRAVEL_MODES = [
  { key: 'walking', label: '步行', icon: Footprints },
  { key: 'cycling', label: '骑行', icon: Bike },
  { key: 'driving', label: '驾车', icon: Car },
];

const MULTI_MODES = [
  { value: 'ordered', label: '有序途经' },
  { value: 'optimized', label: '智能优化' },
  { value: 'mixed', label: '混合模式' },
];

const ALGORITHMS = [
  { value: 'nearest_neighbor', label: '最近邻' },
  { value: 'dynamic_programming', label: '动态规划' },
  { value: 'simulated_annealing', label: '模拟退火' },
  { value: 'genetic_algorithm', label: '遗传算法' },
];

const toAmapLngLat = (AMap, location) => {
  if (!location) return null;
  if (typeof location.getLng === 'function') return location;
  if (Array.isArray(location) && location.length >= 2)
    return new AMap.LngLat(Number(location[0]), Number(location[1]));
  const lng = Number(location.lng ?? location.longitude);
  const lat = Number(location.lat ?? location.latitude);
  return Number.isFinite(lng) && Number.isFinite(lat) ? new AMap.LngLat(lng, lat) : null;
};

const fmtDist = (m) => m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
const fmtTime = (s) => s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}min` : `${Math.floor(s / 60)} min`;

// ==================== 页面组件 ====================

export default function NavigationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // 一级 Tab
  const [tab, setTabRaw] = useState(searchParams.get('tab') === 'external' ? 'external' : 'campus');
  const setTab = (v) => { setTabRaw(v); setSearchParams({ tab: v }); };

  // 二级 Tab (campus)
  const [campusSub, setCampusSub] = useState(searchParams.get('sub') === 'indoor' ? 'indoor' : 'outdoor');

  // 三级: 单点/多点
  const [pointMode, setPointMode] = useState('single');

  // --- 校园室外状态 ---
  const [loading, setLoading] = useState(true);
  const [campusPlace, setCampusPlace] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [coStart, setCoStart] = useState('');
  const [coEnd, setCoEnd] = useState('');
  const [coWaypoints, setCoWaypoints] = useState([{ id: Date.now(), nodeId: '', fixed: false }]);
  const [multiMode, setMultiMode] = useState('ordered');
  const [algorithm, setAlgorithm] = useState('nearest_neighbor');

  // --- 校园室内状态 ---
  const [buildingInfo, setBuildingInfo] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [ciStartRoom, setCiStartRoom] = useState('entrance');
  const [ciTargetRooms, setCiTargetRooms] = useState([{ id: Date.now(), roomId: '' }]);
  const [avoidCongestion, setAvoidCongestion] = useState(false);

  // --- 校外状态 ---
  const [extStartKeyword, setExtStartKeyword] = useState('');
  const [extEndKeyword, setExtEndKeyword] = useState('');
  const [extSelectedStart, setExtSelectedStart] = useState(null);
  const [extSelectedEnd, setExtSelectedEnd] = useState(null);
  const [extStartOptions, setExtStartOptions] = useState([]);
  const [extEndOptions, setExtEndOptions] = useState([]);
  const [extWaypoints, setExtWaypoints] = useState([{ id: Date.now(), keyword: '', selected: null, options: [] }]);
  const [travelMode, setTravelMode] = useState('walking');
  const [currentLocation, setCurrentLocation] = useState(null);
  const autoCompleteRef = useRef(null);

  // --- 共享结果 ---
  const [routeResult, setRouteResult] = useState(null);
  const [navigating, setNavigating] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null);
  const [selectedLeg, setSelectedLeg] = useState(null); // null=全部, 数字=第N段

  // ==================== 初始化 ====================

  useEffect(() => {
    const init = async () => {
      try {
        // 加载校园数据
        const places = (await getPlaces()).data || [];
        const campus = places.find((p) => p.id === 'place_001' || (p.name || '').includes('北邮'));
        if (campus) {
          setCampusPlace(campus);
          const [b, f] = await Promise.all([getBuildings(campus.id), getFacilities(campus.id)]);
          setBuildings(b.data || []);
          setFacilities(f.data || []);
        }

        // 加载室内数据
        try {
          const [info, r] = await Promise.all([
            indoorNavigationAPI.getBuildingInfo(),
            indoorNavigationAPI.getRooms(),
          ]);
          setBuildingInfo(info.data || info);
          setRooms(r.data || []);
        } catch { /* indoor data optional */ }

        // 加载高德
        try {
          const AMap = await loadAMap({ plugins: ['AMap.AutoComplete', 'AMap.Driving', 'AMap.Walking', 'AMap.Riding'] });
          autoCompleteRef.current = new AMap.AutoComplete({ city: '全国' });
        } catch { /* AMap optional */ }

        // 处理从景区详情页传入的预设目的地
        // 优先走高德 API 获取精确坐标，不再依赖本地数据库坐标
        const preset = location.state?.presetDestination;
        if (preset && preset.name) {
          setTab('external');
          setExtEndKeyword(preset.name);

          if (preset.lat != null && preset.lng != null) {
            // 兼容旧流程：预设直接带了坐标
            setExtSelectedEnd({
              name: preset.name,
              location: { lat: preset.lat, lng: preset.lng },
            });
          } else if (autoCompleteRef.current) {
            // 高德已加载，直接用名称搜索匹配 POI
            autoCompleteRef.current.search(preset.name, (status, result) => {
              if (status === 'complete') {
                const tips = (result.tips || []).filter((t) => t.location);
                if (tips.length > 0) {
                  const best = tips[0];
                  setExtSelectedEnd({ name: best.name || preset.name, location: best.location });
                  setExtEndKeyword(best.name || preset.name);
                }
              }
            });
          }
          // 如果高德还没加载，搜索会在 AMap 就绪后触发
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    init();
  }, []);

  // ==================== 推导数据 ====================

  const allNodes = useMemo(() => {
    const nodes = [];
    buildings.forEach((b) => nodes.push({
      id: b.id, name: b.name, type: '建筑',
      lat: b.lat, lng: b.lng,
      mapLat: b.mapLat, mapLng: b.mapLng,
    }));
    facilities.forEach((f) => nodes.push({
      id: f.id, name: f.name, type: f.type || '设施',
      lat: f.lat, lng: f.lng,
      mapLat: f.mapLat, mapLng: f.mapLng,
    }));
    return nodes;
  }, [buildings, facilities]);

  const groupedNodes = useMemo(() => {
    const groups = { 门: [], 教学楼: [], 宿舍: [], 服务: [], 其他: [] };
    allNodes.forEach((n) => {
      if (n.name.includes('门')) groups['门'].push(n);
      else if (n.name.includes('教') || n.name.includes('学') || n.name.includes('楼')) groups['教学楼'].push(n);
      else if (n.name.includes('宿') || n.name.includes('舍')) groups['宿舍'].push(n);
      else if (n.name.includes('食') || n.name.includes('餐') || n.name.includes('超') || n.name.includes('店')) groups['服务'].push(n);
      else groups['其他'].push(n);
    });
    // 每组内按名称自然排序（支持中文和数字）
    Object.values(groups).forEach(items => {
      items.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }));
    });
    return Object.entries(groups).filter(([, items]) => items.length > 0);
  }, [allNodes]);

  const roomsByFloor = useMemo(() => {
    const acc = {};
    rooms.forEach((r) => {
      const floor = r.floor || '未知';
      if (!acc[floor]) acc[floor] = [];
      acc[floor].push(r);
    });
    return acc;
  }, [rooms]);

  const nodeName = useCallback((id) => {
    const n = allNodes.find((x) => x.id === id);
    if (n) return n.name;
    const r = rooms.find((x) => (x.id || x.roomId) === id);
    if (r) return r.name || r.roomName;
    return id;
  }, [allNodes, rooms]);

  // ==================== 地图标记 ====================

  const mapMarkers = useMemo(() => {
    const markers = [];

    if (tab === 'campus' && campusSub === 'outdoor') {
      if (coStart) {
        const n = allNodes.find((x) => x.id === coStart);
        if (n) markers.push({ ...n, type: '起点' });
      }
      if (pointMode === 'multi') {
        coWaypoints.forEach((wp, i) => {
          if (wp.nodeId) {
            const n = allNodes.find((x) => x.id === wp.nodeId);
            if (n) markers.push({ ...n, type: `途经${i + 1}` });
          }
        });
      }
      if (coEnd) {
        const n = allNodes.find((x) => x.id === coEnd);
        if (n) markers.push({ ...n, type: '终点' });
      }
    }

    if (tab === 'campus' && campusSub === 'indoor') {
      // 室内导航：坐标由后端 building-info 提供 (已转为 GCJ-02)
      if (buildingInfo && buildingInfo.name) {
        const bl = buildingInfo.mapLat || buildingInfo.lat;
        const blng = buildingInfo.mapLng || buildingInfo.lng;
        if (bl != null && blng != null) {
          markers.push({ name: buildingInfo.name, lat: bl, lng: blng, mapLat: bl, mapLng: blng, type: '建筑' });
        }
      }
    }

    if (tab === 'external') {
      if (extSelectedStart) {
        const loc = extSelectedStart.location;
        markers.push({ name: extSelectedStart.name, lat: loc?.lat, lng: loc?.lng, mapLat: loc?.lat, mapLng: loc?.lng, type: '起点' });
      }
      if (extSelectedEnd) {
        const loc = extSelectedEnd.location;
        markers.push({ name: extSelectedEnd.name, lat: loc?.lat, lng: loc?.lng, mapLat: loc?.lat, mapLng: loc?.lng, type: '终点' });
      }
    }

    return markers;
  }, [tab, campusSub, coStart, coEnd, coWaypoints, pointMode, buildingInfo, extSelectedStart, extSelectedEnd, allNodes]);

  // ==================== 校内室外导航 ====================

  const handleCampusOutdoorNavigate = async () => {
    if (pointMode === 'single') {
      if (!coStart || !coEnd || !campusPlace) { setError('请选择起点和终点'); return; }
    } else {
      const valid = coWaypoints.filter((wp) => wp.nodeId);
      if (!coStart || valid.length === 0) { setError('请至少选择起点和一个途经点'); return; }
    }

    setNavigating(true);
    setError(null);
    try {
      if (pointMode === 'single') {
        const res = await routeAPI.planSingleRoute({
          placeId: campusPlace.id, start: coStart, end: coEnd,
          vehicle: '步行', strategy: 'time', placeType: '校园', provider: 'local',
        });
        if (res.success) setRouteResult(res.data);
        else setError(res.message || '导航失败');
      } else {
        const wps = coWaypoints.filter((wp) => wp.nodeId).map((wp) => ({
          nodeId: wp.nodeId, name: nodeName(wp.nodeId), fixed: wp.fixed,
        }));
        const res = await multiPointAPI.planMultiPointRoute({
          start: coStart, waypoints: wps, end: coEnd || undefined,
          mode: multiMode, algorithm, vehicle: '步行', strategy: 'time', placeType: '校园', provider: 'local',
        });
        if (res.success) setRouteResult(res.data);
        else setError(res.message || '导航失败');
      }
    } catch (e) { setError('导航请求失败'); }
    finally { setNavigating(false); }
  };

  // ==================== 校内室内导航 ====================

  const handleCampusIndoorNavigate = async () => {
    const validTargets = ciTargetRooms.filter((tr) => tr.roomId && rooms.some((r) => (r.id || r.roomId) === tr.roomId)).map((tr) => tr.roomId);
    if (validTargets.length === 0) { setError('请至少选择一个目标房间'); return; }

    setNavigating(true);
    setError(null);
    try {
      if (validTargets.length === 1 && ciStartRoom === 'entrance') {
        const res = await indoorNavigationAPI.navigate({
          roomId: validTargets[0], avoidCongestion, useTimeWeight: true,
        });
        if (res.success) setRouteResult({ ...res.data, multiRoom: false });
        else setError(res.message || '导航失败');
      } else if (validTargets.length === 1 && ciStartRoom !== 'entrance') {
        const res = await multiPointAPI.planIndoorRoomToRoom({
          from: ciStartRoom, to: validTargets[0], avoidCongestion, useTimeWeight: true,
        });
        if (res.success) setRouteResult({ ...res.data, multiRoom: false });
        else setError(res.message || '导航失败');
      } else {
        const allRoomIds = ciStartRoom !== 'entrance' ? [ciStartRoom, ...validTargets] : validTargets;
        const res = await multiPointAPI.planIndoorMultiRoom({
          roomIds: allRoomIds, avoidCongestion, useTimeWeight: true,
        });
        if (res.success) setRouteResult({ ...res.data, multiRoom: true });
        else setError(res.message || '导航失败');
      }
    } catch (e) { setError('导航请求失败'); }
    finally { setNavigating(false); }
  };

  // ==================== 校外导航 ====================

  const searchPois = async (keyword, setOptions) => {
    if (!keyword.trim() || !autoCompleteRef.current) return;
    try {
      autoCompleteRef.current.search(keyword, (status, result) => {
        if (status === 'complete') {
          setOptions((result.tips || []).filter((tip) => tip.location).slice(0, 10));
        }
      });
    } catch { /* ignore */ }
  };

  const handleExternalNavigate = async () => {
    if (!extSelectedStart || !extSelectedEnd) { setError('请选择起点和终点'); return; }
    setNavigating(true);
    setError(null);
    try {
      const AMap = await loadAMap();
      const modeMap = { driving: 'Driving', walking: 'Walking', cycling: 'Riding' };
      const service = new AMap[modeMap[travelMode]]({ policy: 0 });
      const origin = toAmapLngLat(AMap, extSelectedStart.location);
      const destination = toAmapLngLat(AMap, extSelectedEnd.location);
      if (!origin || !destination) { setError('无法解析起终点坐标'); setNavigating(false); return; }

      service.search(origin, destination, (status, result) => {
        if (status === 'complete') {
          const route = result.routes?.[0];
          if (route) {
            // 高德 API 的完整路径坐标分散在各个 step.path 中，route.path 不存在
            // 拼接所有 step.path 作为完整路线，否则 selectedLeg=null 时路线不显示
            const fullPath = [];
            (route.steps || []).forEach((s) => {
              if (Array.isArray(s.path)) fullPath.push(...s.path);
            });
            // 高德 API 时间字段是 route.time（秒），不是 route.duration
            const totalSeconds = route.time || route.duration || 0;
            setRouteResult({
              totalDistance: route.distance || 0,
              totalTime: totalSeconds / 60,
              coordinates: fullPath,
              mapPath: fullPath,
              path: ['起点', '终点'],
              segments: (route.steps || []).map((s, i) => ({
                from: `步骤${i + 1}`,
                to: s.instruction || s.road || '',
                distance: s.distance || 0,
                time: (s.time || s.duration || 0) / 60,
                coordinates: Array.isArray(s.path) ? s.path : [],
              })),
            });
            setError(null);
          } else {
            setError('未找到有效路线');
          }
        } else {
          setError('路线规划失败: ' + (result?.info || status));
        }
        setNavigating(false);
      });
    } catch (e) { setError('导航请求失败'); setNavigating(false); }
  };

  const handleLocate = () => {
    setLocating(true);
    import('../utils/location').then(({ getCurrentLocation }) => {
      getCurrentLocation()
        .then((loc) => {
          setCurrentLocation(loc);
          setExtSelectedStart({ name: '我的位置', location: loc });
          setExtStartKeyword('我的位置');
        })
        .catch(() => { /* ignore */ })
        .finally(() => setLocating(false));
    });
  };

  // 校外途经点处理 (external multi-waypoint — 按有序途经点调用后端)
  const handleExternalMultiNavigate = async () => {
    const validWps = extWaypoints.filter((wp) => wp.selected).map((wp) => wp.selected);
    if (!extSelectedStart || validWps.length === 0) { setError('请选择起点和至少一个途经点'); return; }

    setNavigating(true);
    setError(null);
    try {
      const wpsForApi = validWps.map((wp) => ({
        name: wp.name,
        lat: wp.location?.lat,
        lng: wp.location?.lng,
      }));
      // 传坐标给后端做 nearest-node 解析
      const res = await multiPointAPI.planWaypoints({
        startLat: extSelectedStart.location?.lat,
        startLng: extSelectedStart.location?.lng,
        waypoints: wpsForApi,
        endLat: extSelectedEnd?.location?.lat,
        endLng: extSelectedEnd?.location?.lng,
        vehicle: travelMode === 'driving' ? '电瓶车' : travelMode === 'cycling' ? '自行车' : '步行',
        strategy: 'time',
      });
      if (res.success) setRouteResult(res.data);
      else setError(res.message || '导航失败');
    } catch (e) { setError('导航请求失败'); }
    finally { setNavigating(false); }
  };

  const addExtWaypoint = () => {
    setExtWaypoints([...extWaypoints, { id: Date.now(), keyword: '', selected: null, options: [] }]);
  };

  const removeExtWaypoint = (id) => {
    if (extWaypoints.length <= 1) return;
    setExtWaypoints(extWaypoints.filter((wp) => wp.id !== id));
  };

  const updateExtWaypoint = (id, field, value) => {
    setExtWaypoints(extWaypoints.map((wp) => wp.id === id ? { ...wp, [field]: value } : wp));
  };

  // ==================== 辅助 ====================

  const addCoWaypoint = () => {
    setCoWaypoints([...coWaypoints, { id: Date.now(), nodeId: '', fixed: false }]);
  };

  const removeCoWaypoint = (id) => {
    if (coWaypoints.length <= 1) return;
    setCoWaypoints(coWaypoints.filter((wp) => wp.id !== id));
  };

  const updateCoWaypoint = (id, value) => {
    setCoWaypoints(coWaypoints.map((wp) => wp.id === id ? { ...wp, nodeId: value } : wp));
  };

  const toggleCoWaypointFixed = (id) => {
    setCoWaypoints(coWaypoints.map((wp) => wp.id === id ? { ...wp, fixed: !wp.fixed } : wp));
  };

  const addCiTarget = () => {
    setCiTargetRooms([...ciTargetRooms, { id: Date.now(), roomId: '' }]);
  };

  const removeCiTarget = (id) => {
    if (ciTargetRooms.length <= 1) return;
    setCiTargetRooms(ciTargetRooms.filter((tr) => tr.id !== id));
  };

  const updateCiTarget = (id, roomId) => {
    setCiTargetRooms(ciTargetRooms.map((tr) => tr.id === id ? { ...tr, roomId } : tr));
  };

  const handleNavigate = () => {
    setRouteResult(null);
    setSelectedLeg(null);
    if (tab === 'campus') {
      if (campusSub === 'outdoor') handleCampusOutdoorNavigate();
      else handleCampusIndoorNavigate();
    } else {
      if (pointMode === 'single') handleExternalNavigate();
      else handleExternalMultiNavigate();
    }
  };

  // 分段 polyline: 按 path 中"命名节点"做合并，每段 = 两个命名地点之间的完整 polyline
  const legPolylines = useMemo(() => {
    const segs = routeResult?.mapSegments || routeResult?.segments || [];
    const nodeCoords = routeResult?.nodeCoordinates || {};
    const path = routeResult?.path || [];

    // 没有 segment 或没有 path → 直接用 raw segments
    if (!segs.length || !path.length) {
      return segs.map((seg) => {
        const own = seg.coordinates || seg.polyline || seg.path || [];
        return { polyline: own, from: seg.from, to: seg.to };
      });
    }

    // 高德外部路线 (每个 seg 自带 polyline)
    const hasOwnCoords = segs.some((s) => {
      const c = s.coordinates || s.polyline || s.path;
      return Array.isArray(c) && c.length > 0;
    });
    if (hasOwnCoords) {
      return segs.map((seg) => {
        const c = seg.coordinates || seg.polyline || seg.path || [];
        return { polyline: c, from: seg.from, to: seg.to };
      });
    }

    // 校园路线: 找出 path 中哪些是命名地点
    const namedIdx = [];
    path.forEach((nodeId, i) => {
      if (nodeName(nodeId) !== nodeId) namedIdx.push(i);
    });
    if (namedIdx.length < 2) namedIdx.push(0, path.length - 1); // 兜底: 首尾

    // 构建 raw per-segment polylines
    const raw = segs.map((seg) => {
      const fc = nodeCoords[seg.from] || nodeCoords[seg.fromId];
      const tc = nodeCoords[seg.to] || nodeCoords[seg.toId];
      const pts = [];
      if (Array.isArray(fc) && fc.length >= 2) pts.push([Number(fc[1]), Number(fc[0])]);
      if (Array.isArray(tc) && tc.length >= 2) pts.push([Number(tc[1]), Number(tc[0])]);
      return { polyline: pts, from: seg.from, to: seg.to };
    });

    // 合并相邻命名节点之间的 polyline
    const result = [];
    for (let i = 0; i < namedIdx.length - 1; i++) {
      const startI = namedIdx[i];
      const endI = namedIdx[i + 1];
      const merged = [];
      for (let j = startI; j < endI && j < raw.length; j++) {
        merged.push(...raw[j].polyline);
      }
      if (merged.length > 0) {
        result.push({
          polyline: merged,
          from: path[startI],
          to: path[endI],
        });
      }
    }
    return result.length > 0 ? result : raw;
  }, [routeResult, nodeName]);

  const isValid = () => {
    if (tab === 'campus' && campusSub === 'outdoor') {
      if (pointMode === 'single') return coStart && coEnd;
      return coStart && coWaypoints.some((wp) => wp.nodeId);
    }
    if (tab === 'campus' && campusSub === 'indoor') {
      return ciTargetRooms.some((tr) => tr.roomId && rooms.some((r) => (r.id || r.roomId) === tr.roomId));
    }
    // external
    if (pointMode === 'single') return extSelectedStart && extSelectedEnd;
    return extSelectedStart && extWaypoints.some((wp) => wp.selected);
  };

  // ==================== SearchableSelect 组件 ====================

  const SearchableSelect = ({ value, onChange, placeholder, groups, className = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchText, setSearchText] = useState('');
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    const selectedName = useMemo(() => {
      if (!value) return '';
      for (const g of groups) {
        const found = g.items.find((item) => item.id === value);
        if (found) return found.name;
      }
      return '';
    }, [value, groups]);

    const filteredGroups = useMemo(() => {
      if (!searchText.trim()) return groups;
      const q = searchText.trim().toLowerCase();
      return groups
        .map((g) => ({
          ...g,
          items: g.items.filter((item) => item.name.toLowerCase().includes(q)),
        }))
        .filter((g) => g.items.length > 0);
    }, [groups, searchText]);

    useEffect(() => {
      const handleClick = (e) => {
        if (containerRef.current && !containerRef.current.contains(e.target)) {
          setIsOpen(false);
          setSearchText('');
        }
      };
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleSelect = (id) => {
      onChange(id);
      setIsOpen(false);
      setSearchText('');
    };

    const handleClear = (e) => {
      e.stopPropagation();
      onChange('');
      setSearchText('');
      inputRef.current?.focus();
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSearchText('');
      }
    };

    const handleInputFocus = () => {
      setSearchText('');
      setIsOpen(true);
    };

    return (
      <div ref={containerRef} className={`relative ${className}`}>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={isOpen ? searchText : selectedName}
            placeholder={placeholder || '请选择'}
            onChange={(e) => { setSearchText(e.target.value); setIsOpen(true); }}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            className="w-full border border-border px-3 py-2 pr-8 text-sm font-sans bg-surface outline-none focus:border-heading/40"
            autoComplete="off"
          />
          {value ? (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-heading p-0.5"
              tabIndex={-1}
            >
              <X size={14} />
            </button>
          ) : (
            <Search size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          )}
        </div>
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 max-h-64 overflow-y-auto border border-border bg-surface shadow-lg">
            {filteredGroups.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted text-center">无匹配结果</div>
            ) : (
              filteredGroups.map((g) => (
                <div key={g.label}>
                  <div className="px-3 py-1.5 text-xs text-muted font-medium bg-muted/5 border-b border-border/50">
                    —— {g.label} ——
                  </div>
                  {g.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item.id)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/10 transition-colors ${
                        item.id === value ? 'bg-heading/5 text-heading font-medium' : 'text-main'
                      }`}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  };

  const NodeSelect = ({ value, onChange, placeholder, className = '' }) => (
    <SearchableSelect
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      groups={groupedNodes.map(([group, items]) => ({ label: group, items }))}
      className={className}
    />
  );

  const RoomSelect = ({ value, onChange, placeholder }) => (
    <SearchableSelect
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      groups={Object.entries(roomsByFloor).map(([floor, floorRooms]) => ({
        label: `${floor}楼`,
        items: floorRooms.map((r) => ({ id: r.id || r.roomId, name: r.name || r.roomName })),
      }))}
    />
  );

  // ==================== 加载状态 ====================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
      </div>
    );
  }

  // ==================== 渲染 ====================

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl text-heading">导航</h1>
          <p className="text-muted text-sm mt-1">
            {tab === 'campus' ? '校园内路径规划' : '全国路线规划'}
            {campusPlace && tab === 'campus' && <span className="ml-1 text-xs">· {campusPlace.name}</span>}
          </p>
        </div>
      </div>

      {/* 一级 Tab: 校内 / 校外 */}
      <div className="flex border-b border-border">
        {[
          { key: 'campus', label: '校内' },
          { key: 'external', label: '校外' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setRouteResult(null); setError(null); }}
            className={`px-6 py-2.5 text-sm font-sans transition-colors border-b-2 -mb-px ${
              tab === t.key ? 'border-heading text-heading font-medium' : 'border-transparent text-muted hover:text-heading'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 二级 Tab (仅校内) */}
      {tab === 'campus' && (
        <div className="flex gap-1 -mt-2">
          {[
            { key: 'outdoor', label: '室外' },
            { key: 'indoor', label: '室内' },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => { setCampusSub(s.key); setRouteResult(null); setError(null); }}
              className={`px-4 py-1.5 text-xs font-sans rounded-sm transition-colors ${
                campusSub === s.key ? 'bg-heading/10 text-heading font-medium' : 'text-muted hover:text-heading'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* 三级切换: 单点/多点 (仅室外和校外) */}
      {!(tab === 'campus' && campusSub === 'indoor') && (
        <div className="flex items-center gap-3">
          <PointModeToggle value={pointMode} onChange={(v) => { setPointMode(v); setRouteResult(null); setError(null); }} />
          {pointMode === 'multi' && (
            <select value={multiMode} onChange={(e) => setMultiMode(e.target.value)}
              className="border border-border px-2 py-1 text-xs font-sans bg-surface">
              {MULTI_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          )}
          {pointMode === 'multi' && (multiMode === 'optimized' || multiMode === 'mixed') && (
            <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value)}
              className="border border-border px-2 py-1 text-xs font-sans bg-surface">
              {ALGORITHMS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          )}
        </div>
      )}

      {/* ==================== 主内容区 ==================== */}
      {tab === 'campus' && campusSub === 'indoor' ? (
        /* ---- 校内室内：居中全宽布局，无地图 ---- */
        <div className="max-w-lg mx-auto space-y-5">
          {!buildingInfo ? (
            <div className="text-center py-8 border border-border">
              <AlertCircle size={32} className="mx-auto mb-2 text-muted" />
              <p className="text-sm text-muted">室内导航数据未加载</p>
            </div>
          ) : (
            <>
              {/* 建筑信息 */}
              <div className="border border-border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Building size={16} className="text-muted" />
                  <span className="font-serif text-heading">{buildingInfo.name || '教学楼'}</span>
                </div>
                {buildingInfo.floors && (
                  <div className="flex flex-wrap gap-1.5">
                    {(Array.isArray(buildingInfo.floors)
                      ? buildingInfo.floors
                      : Array.from({ length: buildingInfo.floors }, (_, i) => `${i + 1}楼`)
                    ).map((f) => (
                      <span key={f} className="px-2 py-0.5 text-xs border border-border font-sans text-muted">{f}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* 起点 */}
              <div>
                <label className="block font-sans text-[10px] uppercase tracking-widest text-muted mb-1">起点</label>
                <SearchableSelect
                  value={ciStartRoom}
                  onChange={setCiStartRoom}
                  placeholder="选择起点"
                  groups={[
                    { label: '入口', items: [{ id: 'entrance', name: '大楼入口' }] },
                    ...Object.entries(roomsByFloor).map(([floor, floorRooms]) => ({
                      label: `${floor}楼`,
                      items: floorRooms.map((r) => ({ id: r.id || r.roomId, name: r.name || r.roomName })),
                    })),
                  ]}
                />
              </div>

              {/* 目标房间 */}
              {ciTargetRooms.map((tr, index) => (
                <div key={tr.id} className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-blue-700">{index + 1}</span>
                  </div>
                  <div className="flex-1">
                    <RoomSelect value={tr.roomId} onChange={(v) => updateCiTarget(tr.id, v)} placeholder={`目标房间 ${index + 1}`} />
                  </div>
                  {ciTargetRooms.length > 1 && (
                    <button onClick={() => removeCiTarget(tr.id)}
                      className="p-2 text-muted hover:text-red-500 transition-colors shrink-0">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addCiTarget}
                className="flex items-center gap-1.5 text-sm text-muted hover:text-heading transition-colors py-2 px-3 border border-dashed border-neutral-300 hover:border-neutral-500 w-full justify-center">
                <Plus size={14} /> 添加目标房间
              </button>

              <div className="flex items-center justify-between py-2">
                <span className="font-sans text-xs text-muted">避开拥挤</span>
                <button
                  onClick={() => setAvoidCongestion(!avoidCongestion)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${avoidCongestion ? 'bg-heading' : 'bg-muted/30'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-surface transition-transform ${avoidCongestion ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
            </>
          )}

          {/* 导航按钮 + 错误 */}
          <div className="flex items-center gap-3 flex-wrap">
            <CTAButton onClick={handleNavigate} disabled={!isValid() || navigating}>
              <Navigation size={16} className="inline mr-1" />
              {navigating ? '规划中...' : '开始导航'}
            </CTAButton>
            {error && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle size={14} /> {error}
              </p>
            )}
          </div>

          {/* 结果摘要 - 室内 */}
          {routeResult && (
            <RouteSummary result={routeResult} nodes={allNodes} formatNodeName={nodeName} />
          )}
        </div>
      ) : (
        /* ---- 室外/校外：网格 + 地图布局 ---- */
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* 左侧控制面板 */}
          <div className="lg:col-span-2 space-y-5">

            {/* ---- 校内室外 ---- */}
            {tab === 'campus' && campusSub === 'outdoor' && (
              <>
                {/* 起点 */}
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <MapPin size={14} className="text-green-700" />
                  </div>
                  <div className="flex-1">
                    <label className="block font-sans text-[10px] uppercase tracking-widest text-muted mb-1">起点</label>
                    <NodeSelect value={coStart} onChange={setCoStart} placeholder="选择起点" />
                  </div>
                </div>

                {pointMode === 'single' ? (
                  /* 单点: 终点 */
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                      <MapPin size={14} className="text-red-700" />
                    </div>
                    <div className="flex-1">
                      <label className="block font-sans text-[10px] uppercase tracking-widest text-muted mb-1">终点</label>
                      <NodeSelect value={coEnd} onChange={setCoEnd} placeholder="选择终点" />
                    </div>
                  </div>
                ) : (
                  /* 多点: 途经点列表 */
                  <>
                    <WaypointList
                      waypoints={coWaypoints}
                      onAdd={addCoWaypoint}
                      onRemove={removeCoWaypoint}
                      showFixed={multiMode === 'mixed'}
                      onToggleFixed={toggleCoWaypointFixed}
                    >
                      {(wp) => (
                        <NodeSelect value={wp.nodeId} onChange={(v) => updateCoWaypoint(wp.id, v)} placeholder={`途经点`} />
                      )}
                    </WaypointList>

                    {/* 终点(可选) */}
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                        <MapPin size={14} className="text-red-700" />
                      </div>
                      <div className="flex-1">
                        <label className="block font-sans text-[10px] uppercase tracking-widest text-muted mb-1">终点 (可选)</label>
                        <NodeSelect value={coEnd} onChange={setCoEnd} placeholder="选择终点（默认返回起点）" />
                      </div>
                    </div>
                  </>
                )}

                {/* 拥堵避让 (校园室外) */}
                <div className="flex items-center justify-between py-2">
                  <span className="font-sans text-xs text-muted">避开拥挤路段</span>
                  <button
                    onClick={() => setAvoidCongestion(!avoidCongestion)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${avoidCongestion ? 'bg-heading' : 'bg-muted/30'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-surface transition-transform ${avoidCongestion ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>
              </>
            )}

            {/* ---- 校外 ---- */}
            {tab === 'external' && (
              <>
                {/* 起点搜索 */}
                <div>
                  <label className="block font-sans text-[10px] uppercase tracking-widest text-muted mb-1">起点</label>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      value={extStartKeyword}
                      onChange={(e) => { setExtStartKeyword(e.target.value); searchPois(e.target.value, setExtStartOptions); }}
                      placeholder="输入起点"
                      className="w-full pl-9 pr-4 py-2 border border-border text-sm font-sans focus:border-heading focus:ring-0 focus:outline-none"
                    />
                  </div>
                  {extStartOptions.length > 0 && (
                    <div className="border border-border mt-1 max-h-40 overflow-y-auto">
                      {extStartOptions.map((tip, i) => (
                        <div key={i} onClick={() => { setExtSelectedStart({ name: tip.name, location: tip.location }); setExtStartKeyword(tip.name); setExtStartOptions([]); }}
                          className="px-3 py-2 text-sm font-sans hover:bg-neutral-50 cursor-pointer">{tip.name}</div>
                      ))}
                    </div>
                  )}
                </div>

                {pointMode === 'single' ? (
                  /* 终点搜索 */
                  <div>
                    <label className="block font-sans text-[10px] uppercase tracking-widest text-muted mb-1">终点</label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                      <input
                        value={extEndKeyword}
                        onChange={(e) => { setExtEndKeyword(e.target.value); searchPois(e.target.value, setExtEndOptions); }}
                        placeholder="输入终点"
                        className="w-full pl-9 pr-4 py-2 border border-border text-sm font-sans focus:border-heading focus:ring-0 focus:outline-none"
                      />
                    </div>
                    {extEndOptions.length > 0 && (
                      <div className="border border-border mt-1 max-h-40 overflow-y-auto">
                        {extEndOptions.map((tip, i) => (
                          <div key={i} onClick={() => { setExtSelectedEnd({ name: tip.name, location: tip.location }); setExtEndKeyword(tip.name); setExtEndOptions([]); }}
                            className="px-3 py-2 text-sm font-sans hover:bg-neutral-50 cursor-pointer">{tip.name}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* 校外途经点 */
                  <>
                    <WaypointList
                      waypoints={extWaypoints}
                      onAdd={addExtWaypoint}
                      onRemove={removeExtWaypoint}
                    >
                      {(wp) => (
                        <div>
                          <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                            <input
                              value={wp.keyword}
                              onChange={(e) => {
                                updateExtWaypoint(wp.id, 'keyword', e.target.value);
                                searchPois(e.target.value, (opts) => updateExtWaypoint(wp.id, 'options', opts));
                              }}
                              placeholder="搜索途经点"
                              className="w-full pl-8 pr-3 py-1.5 border border-border text-sm font-sans focus:border-heading focus:ring-0 focus:outline-none"
                            />
                          </div>
                          {wp.options && wp.options.length > 0 && (
                            <div className="border border-border mt-1 max-h-32 overflow-y-auto">
                              {wp.options.map((tip, i) => (
                                <div key={i} onClick={() => {
                                  updateExtWaypoint(wp.id, 'selected', { name: tip.name, location: tip.location });
                                  updateExtWaypoint(wp.id, 'keyword', tip.name);
                                  updateExtWaypoint(wp.id, 'options', []);
                                }}
                                  className="px-3 py-1.5 text-sm font-sans hover:bg-neutral-50 cursor-pointer">{tip.name}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </WaypointList>

                    {/* 校外终点 (可选) */}
                    <div>
                      <label className="block font-sans text-[10px] uppercase tracking-widest text-muted mb-1">终点 (可选)</label>
                      <div className="relative">
                        <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                        <input
                          value={extEndKeyword}
                          onChange={(e) => { setExtEndKeyword(e.target.value); searchPois(e.target.value, setExtEndOptions); }}
                          placeholder="输入终点（默认返回起点）"
                          className="w-full pl-9 pr-4 py-2 border border-border text-sm font-sans focus:border-heading focus:ring-0 focus:outline-none"
                        />
                      </div>
                      {extEndOptions.length > 0 && (
                        <div className="border border-border mt-1 max-h-40 overflow-y-auto">
                          {extEndOptions.map((tip, i) => (
                            <div key={i} onClick={() => { setExtSelectedEnd({ name: tip.name, location: tip.location }); setExtEndKeyword(tip.name); setExtEndOptions([]); }}
                              className="px-3 py-2 text-sm font-sans hover:bg-neutral-50 cursor-pointer">{tip.name}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* 出行方式 */}
                <div className="flex gap-2">
                  {TRAVEL_MODES.map((m) => {
                    const Icon = m.icon;
                    return (
                      <button key={m.key} onClick={() => setTravelMode(m.key)}
                        className={`flex items-center gap-1 px-3 py-1.5 text-xs font-sans border transition-colors ${
                          travelMode === m.key ? 'border-heading text-heading bg-heading/5' : 'border-border text-muted hover:text-heading'
                        }`}>
                        <Icon size={14} /> {m.label}
                      </button>
                    );
                  })}
                </div>

                {/* 定位按钮 */}
                <CTAButton variant="secondary" onClick={handleLocate} disabled={locating} size="sm">
                  {locating ? '定位中...' : '使用我的位置'}
                </CTAButton>
              </>
            )}

            {/* 导航按钮 + 错误 */}
            <div className="flex items-center gap-3 flex-wrap">
              <CTAButton onClick={handleNavigate} disabled={!isValid() || navigating}>
                <Navigation size={16} className="inline mr-1" />
                {navigating ? '规划中...' : '开始导航'}
              </CTAButton>
              {error && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle size={14} /> {error}
                </p>
              )}
            </div>

            {/* 结果摘要 - 左侧 */}
            {routeResult && (
              <>
                <RouteSummary result={routeResult} nodes={allNodes} formatNodeName={nodeName} />

                {legPolylines.length > 0 && (
                  <div className="space-y-2">
                    <span className="font-sans text-[10px] uppercase tracking-widest text-muted">分段切换</span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setSelectedLeg(null)}
                        className={`px-2.5 py-1 text-xs font-sans border transition-colors ${
                          selectedLeg === null
                            ? 'border-heading bg-heading text-white'
                            : 'border-border text-muted hover:text-heading hover:border-heading'
                        }`}
                      >
                        全部
                      </button>
                      {legPolylines.map((leg, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedLeg(i)}
                          className={`px-2.5 py-1 text-xs font-sans border transition-colors ${
                            selectedLeg === i
                              ? 'border-heading bg-heading text-white'
                              : 'border-border text-muted hover:text-heading hover:border-heading'
                          }`}
                        >
                          {nodeName(leg.from)} → {nodeName(leg.to)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 右侧地图 */}
          <div className="lg:col-span-3">
            <div className="border border-border overflow-hidden rounded-sm sticky top-20">
              <AMapView
                routeResult={{ ...routeResult, legPolylines }}
                buildings={mapMarkers}
                currentLocation={currentLocation}
                onLocationChange={setCurrentLocation}
                mapHeight={550}
                showRouteMarkers={false}
                selectedLeg={selectedLeg}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
