import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Navigation, MapPin, Shuffle, ListOrdered, GitMerge, AlertCircle } from 'lucide-react';
import { getPlaces, getBuildings, getFacilities, multiPointAPI } from '../services/api';
import AMapView from '../components/Map/AMapView';
import CTAButton from '../components/ui/CTAButton';
import SectionLabel from '../components/ui/SectionLabel';

const MODE_OPTIONS = [
  { value: 'ordered', label: '有序途经', icon: ListOrdered, desc: '按添加顺序依次访问每个途经点' },
  { value: 'optimized', label: '智能优化', icon: Shuffle, desc: '系统自动计算最优访问顺序' },
  { value: 'mixed', label: '混合模式', icon: GitMerge, desc: '固定点位保持顺序，其余点位自动优化' },
];

const ALGORITHM_OPTIONS = [
  { value: 'nearest_neighbor', label: '最近邻' },
  { value: 'dynamic_programming', label: '动态规划' },
  { value: 'simulated_annealing', label: '模拟退火' },
  { value: 'genetic_algorithm', label: '遗传算法' },
];

export default function MultiPointNavigationPage() {
  const [loading, setLoading] = useState(true);
  const [navigating, setNavigating] = useState(false);
  const [campusPlace, setCampusPlace] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [mode, setMode] = useState('ordered');
  const [algorithm, setAlgorithm] = useState('nearest_neighbor');
  const [selectedStart, setSelectedStart] = useState('');
  const [waypoints, setWaypoints] = useState([{ id: Date.now(), nodeId: '', name: '', fixed: false }]);
  const [selectedEnd, setSelectedEnd] = useState('');
  const [routeResult, setRouteResult] = useState(null);
  const [error, setError] = useState(null);
  const [selectedLeg, setSelectedLeg] = useState(null);

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

  const selectedMarkers = useMemo(() => {
    const markers = [];
    if (selectedStart) {
      const n = allNodes.find((x) => x.id === selectedStart);
      if (n) markers.push({ ...n, role: 'start', index: 0 });
    }
    waypoints.forEach((wp, i) => {
      if (wp.nodeId) {
        const n = allNodes.find((x) => x.id === wp.nodeId);
        if (n) markers.push({ ...n, role: 'waypoint', index: i + 1 });
      }
    });
    if (selectedEnd) {
      const n = allNodes.find((x) => x.id === selectedEnd);
      if (n) markers.push({ ...n, role: 'end', index: 99 });
    }
    return markers;
  }, [allNodes, selectedStart, waypoints, selectedEnd]);

  const addWaypoint = () => {
    setWaypoints([...waypoints, { id: Date.now(), nodeId: '', name: '', fixed: false }]);
  };

  const removeWaypoint = (id) => {
    if (waypoints.length <= 1) return;
    setWaypoints(waypoints.filter((wp) => wp.id !== id));
  };

  const updateWaypoint = (id, field, value) => {
    setWaypoints(waypoints.map((wp) => wp.id === id ? { ...wp, [field]: value } : wp));
  };

  const handleNavigate = async () => {
    const validWaypoints = waypoints.filter((wp) => wp.nodeId);
    if (!selectedStart || validWaypoints.length === 0 || !campusPlace) {
      setError('请至少选择起点和一个途经点');
      return;
    }
    setNavigating(true);
    setError(null);
    setSelectedLeg(null);
    try {
      const wpData = validWaypoints.map((wp) => ({
        nodeId: wp.nodeId,
        name: allNodes.find((n) => n.id === wp.nodeId)?.name || '',
        fixed: wp.fixed,
      }));

      const res = await multiPointAPI.planMultiPointRoute({
        start: selectedStart,
        waypoints: wpData,
        end: selectedEnd || undefined,
        mode,
        algorithm,
        vehicle: '步行',
        strategy: 'time',
        placeType: '校园',
        provider: 'local',
      });

      if (res.success) {
        setRouteResult(res.data);
        setError(null);
      } else {
        setError(res.message || '导航规划失败');
      }
    } catch (e) {
      setError('导航请求失败: ' + (e.message || '网络错误'));
    } finally {
      setNavigating(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" /></div>;
  }

  const NodeSelect = ({ value, onChange, placeholder, className }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className={`w-full border border-neutral-200 px-3 py-2 text-sm font-sans bg-white ${className || ''}`}>
      <option value="">{placeholder || '请选择'}</option>
      {groupedNodes.map(([group, items]) => (
        <optgroup key={group} label={`—— ${group} ——`}>
          {items.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
        </optgroup>
      ))}
    </select>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-8">
      <div>
        <h1 className="font-serif text-2xl md:text-3xl text-heading">多点导航</h1>
        <p className="text-muted text-sm mt-1">规划途经多个地点的最优路线</p>
      </div>

      {/* 模式选择 */}
      <section>
        <SectionLabel>导航模式</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          {MODE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = mode === opt.value;
            return (
              <button key={opt.value} onClick={() => setMode(opt.value)}
                className={`text-left p-4 border transition-colors ${active ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 hover:border-neutral-400'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={16} className={active ? 'text-neutral-900' : 'text-neutral-400'} />
                  <span className={`font-sans text-sm font-medium ${active ? 'text-heading' : 'text-body'}`}>{opt.label}</span>
                </div>
                <p className="text-xs text-muted">{opt.desc}</p>
              </button>
            );
          })}
        </div>
        {(mode === 'optimized' || mode === 'mixed') && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-muted">优化算法：</span>
            <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value)}
              className="border border-neutral-200 px-2 py-1 text-xs font-sans bg-white">
              {ALGORITHM_OPTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
        )}
      </section>

      {/* 点位选择 */}
      <section className="space-y-4">
        <SectionLabel>途径点位</SectionLabel>

        {/* 起点 */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <MapPin size={14} className="text-green-700" />
          </div>
          <div className="flex-1">
            <label className="block font-sans text-[10px] uppercase tracking-widest text-muted mb-1">起点</label>
            <NodeSelect value={selectedStart} onChange={setSelectedStart} placeholder="选择起点" />
          </div>
        </div>

        {/* 途经点列表 */}
        {waypoints.map((wp, index) => (
          <div key={wp.id} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-xs font-bold text-blue-700">
              {index + 1}
            </div>
            <div className="flex-1">
              <label className="block font-sans text-[10px] uppercase tracking-widest text-muted mb-1">
                途经点 {index + 1}
              </label>
              <div className="flex gap-2">
                <NodeSelect value={wp.nodeId} onChange={(v) => updateWaypoint(wp.id, 'nodeId', v)} placeholder="选择途经点" className="flex-1" />
                {mode === 'mixed' && (
                  <label className="flex items-center gap-1 text-xs text-muted shrink-0">
                    <input type="checkbox" checked={wp.fixed} onChange={(e) => updateWaypoint(wp.id, 'fixed', e.target.checked)}
                      className="w-3.5 h-3.5" />
                    固定
                  </label>
                )}
                {waypoints.length > 1 && (
                  <button onClick={() => removeWaypoint(wp.id)}
                    className="p-2 text-neutral-400 hover:text-red-500 transition-colors shrink-0" title="移除">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* 添加途经点 */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-dashed border-neutral-300 flex items-center justify-center shrink-0" />
          <button onClick={addWaypoint}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-heading transition-colors py-2 px-3 border border-dashed border-neutral-300 hover:border-neutral-500">
            <Plus size={14} /> 添加途经点
          </button>
        </div>

        {/* 终点（可选） */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <MapPin size={14} className="text-red-700" />
          </div>
          <div className="flex-1">
            <label className="block font-sans text-[10px] uppercase tracking-widest text-muted mb-1">终点 (可选，默认返回起点)</label>
            <NodeSelect value={selectedEnd} onChange={setSelectedEnd} placeholder="选择终点（可选）" />
          </div>
        </div>
      </section>

      {/* 导航按钮 */}
      <div className="flex items-center gap-3">
        <CTAButton onClick={handleNavigate} loading={navigating} disabled={!selectedStart || !waypoints.some(wp => wp.nodeId)}>
          <Navigation size={16} /> 开始导航
        </CTAButton>
        {error && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <AlertCircle size={14} /> {error}
          </p>
        )}
      </div>

      {/* 地图展示 */}
      {selectedMarkers.length > 0 && (
        <section>
          <SectionLabel>地图预览</SectionLabel>
          <div className="border border-neutral-200 mt-3 overflow-hidden" style={{ height: 400 }}>
            <AMapView
              center={selectedMarkers[0]}
              markers={selectedMarkers.map((m, i) => ({
                ...m,
                label: m.role === 'start' ? '起' : m.role === 'end' ? '终' : String(m.index),
              }))}
              polyline={routeResult?.mapPath || routeResult?.polylineCoordinates}
              routeResult={routeResult}
              showControls
              selectedLeg={selectedLeg}
            />
          </div>
        </section>
      )}

      {/* 结果摘要 */}
      {routeResult && (
        <section className="border border-neutral-200 p-6 space-y-4">
          <SectionLabel>路线摘要</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted">总距离</span>
              <p className="font-medium text-heading">{routeResult.totalDistance != null ? (routeResult.totalDistance / 1000).toFixed(2) + ' km' : '--'}</p>
            </div>
            <div>
              <span className="text-muted">总时间</span>
              <p className="font-medium text-heading">{routeResult.totalTime != null ? Math.round(routeResult.totalTime) + ' 分钟' : '--'}</p>
            </div>
            <div>
              <span className="text-muted">途经点</span>
              <p className="font-medium text-heading">{routeResult.waypointCount || (waypoints.filter(wp => wp.nodeId).length)} 个</p>
            </div>
            <div>
              <span className="text-muted">模式</span>
              <p className="font-medium text-heading">{MODE_OPTIONS.find((o) => o.value === mode)?.label || mode}</p>
            </div>
          </div>

          {routeResult.targetPath && routeResult.targetPath.length > 0 && (
            <div>
              <span className="text-xs text-muted">最优访问顺序</span>
              <p className="text-sm font-mono text-body mt-1">
                {routeResult.targetPath.map((id) => {
                  const n = allNodes.find((x) => x.id === id);
                  return n ? n.name : id;
                }).join(' → ')}
              </p>
            </div>
          )}

          {/* 分段路径选择 */}
          {routeResult.legPolylines && routeResult.legPolylines.length > 0 && (() => {
            const legNames = routeResult.legPolylines.map((leg) => {
              const fromName = leg.fromName || allNodes.find((n) => n.id === leg.from)?.name || leg.from;
              const toName = leg.toName || allNodes.find((n) => n.id === leg.to)?.name || leg.to;
              return { fromName, toName, distance: leg.distance, time: leg.time };
            });
            return (
              <div>
                <span className="text-xs text-muted">分段路径 — 点击按钮查看单段路线</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    onClick={() => setSelectedLeg(null)}
                    className={`px-3 py-1.5 text-xs border transition-colors ${selectedLeg === null ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 hover:border-neutral-400 text-body'}`}
                  >
                    全部路径
                  </button>
                  {legNames.map((leg, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedLeg(i)}
                      className={`px-3 py-1.5 text-xs border transition-colors text-left ${selectedLeg === i ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 hover:border-neutral-400'}`}
                    >
                      <span className="font-medium">{leg.fromName}</span>
                      <span className="mx-1 text-muted">→</span>
                      <span className="font-medium">{leg.toName}</span>
                      {leg.distance != null && (
                        <span className="ml-2 text-muted">
                          {leg.distance >= 1000 ? (leg.distance / 1000).toFixed(1) + 'km' : Math.round(leg.distance) + 'm'}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
        </section>
      )}
    </div>
  );
}
