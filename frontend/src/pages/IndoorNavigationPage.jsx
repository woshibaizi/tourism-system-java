import React, { useState, useEffect } from 'react';
import { Building, Navigation, AlertCircle, Layers, Plus, Trash2 } from 'lucide-react';
import { indoorNavigationAPI, multiPointAPI } from '../services/api';
import CTAButton from '../components/ui/CTAButton';
import SectionLabel from '../components/ui/SectionLabel';
import AMapView from '../components/Map/AMapView';

function IndoorNavigationPage({ embedded = false }) {
  const [loading, setLoading] = useState(true);
  const [buildingInfo, setBuildingInfo] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [startRoom, setStartRoom] = useState('entrance');
  const [targetRooms, setTargetRooms] = useState([{ id: Date.now(), roomId: '' }]);
  const [avoidCongestion, setAvoidCongestion] = useState(false);
  const [navResult, setNavResult] = useState(null);
  const [navigating, setNavigating] = useState(false);
  // indoor building 坐标由后端 building-info 返回 (GCJ-02)，此处仅作 AMap 初始化默认值
  const [buildingLocation] = useState({ lng: 116.3633, lat: 39.9595 });

  useEffect(() => {
    const load = async () => {
      try {
        const [info, r] = await Promise.all([indoorNavigationAPI.getBuildingInfo(), indoorNavigationAPI.getRooms()]);
        setBuildingInfo(info.data || info);
        setRooms(r.data || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const isValidRoomId = (id) => rooms.some((r) => (r.id || r.roomId) === id);

  const addTarget = () => {
    setTargetRooms([...targetRooms, { id: Date.now(), roomId: '' }]);
  };

  const removeTarget = (id) => {
    if (targetRooms.length <= 1) return;
    setTargetRooms(targetRooms.filter((tr) => tr.id !== id));
  };

  const updateTarget = (id, roomId) => {
    setTargetRooms(targetRooms.map((tr) => tr.id === id ? { ...tr, roomId } : tr));
  };

  const handleNavigate = async () => {
    const validTargets = targetRooms.filter((tr) => tr.roomId && isValidRoomId(tr.roomId)).map((tr) => tr.roomId);
    if (validTargets.length === 0) return;

    setNavigating(true);
    try {
      if (validTargets.length === 1 && startRoom === 'entrance') {
        // 单目标从大门出发，使用原有API
        const res = await indoorNavigationAPI.navigate({
          roomId: validTargets[0], avoidCongestion, useTimeWeight: true,
        });
        if (res.success) setNavResult({ ...res.data, multiRoom: false });
      } else if (validTargets.length === 1 && startRoom !== 'entrance') {
        // 单目标房间到房间
        const res = await multiPointAPI.planIndoorRoomToRoom({
          from: startRoom, to: validTargets[0], avoidCongestion, useTimeWeight: true,
        });
        if (res.success) setNavResult({ ...res.data, multiRoom: false });
      } else {
        // 多房间串联导航
        const allRoomIds = startRoom !== 'entrance' ? [startRoom, ...validTargets] : validTargets;
        const res = await multiPointAPI.planIndoorMultiRoom({
          roomIds: allRoomIds, avoidCongestion, useTimeWeight: true,
        });
        if (res.success) setNavResult({ ...res.data, multiRoom: true });
      }
    } catch (e) { console.error(e); }
    finally { setNavigating(false); }
  };

  const roomsByFloor = rooms.reduce((acc, r) => {
    const floor = r.floor || '未知';
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(r);
    return acc;
  }, {});

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin" /></div>;
  }

  const RoomSelect = ({ value, onChange, placeholder }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full border border-border px-3 py-2 text-sm font-sans bg-surface">
      <option value="">{placeholder || '选择房间'}</option>
      {Object.entries(roomsByFloor).map(([floor, floorRooms]) => (
        <optgroup key={floor} label={`${floor}楼`}>
          {floorRooms.map((r) => (
            <option key={r.id || r.roomId} value={r.id || r.roomId}>{r.name || r.roomName}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );

  return (
    <div className={embedded ? '' : 'max-w-screen-xl mx-auto px-6 py-12'}>
      {!embedded && (
        <>
          <SectionLabel>Indoor Navigation</SectionLabel>
          <h1 className="font-serif text-3xl text-heading mb-8">室内导航</h1>
        </>
      )}

      {!buildingInfo ? (
        <div className="text-center py-16">
          <AlertCircle size={48} className="mx-auto mb-4 text-muted" />
          <p className="font-sans text-sm text-muted">无法获取建筑信息，请确保后端服务正常运行</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            <div className="border border-border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Building size={18} className="text-muted" />
                <h2 className="font-serif text-lg text-heading">{buildingInfo.name || '教学楼'}</h2>
              </div>
              {buildingInfo.floors && (
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(buildingInfo.floors) ? buildingInfo.floors : Array.from({ length: buildingInfo.floors }, (_, i) => `${i + 1}楼`)).map((f) => (
                    <span key={f} className="px-3 py-1 text-xs border border-border font-sans">{f}</span>
                  ))}
                </div>
              )}
            </div>

            {/* 起点选择 */}
            <div className="border border-border p-6">
              <label className="block font-sans text-xs uppercase tracking-widest text-muted mb-2">起点</label>
              <select value={startRoom} onChange={(e) => setStartRoom(e.target.value)}
                className="w-full border border-border px-3 py-2 text-sm font-sans bg-surface mb-2">
                <option value="entrance">大楼入口</option>
                {Object.entries(roomsByFloor).map(([floor, floorRooms]) => (
                  <optgroup key={floor} label={`${floor}楼`}>
                    {floorRooms.map((r) => (
                      <option key={r.id || r.roomId} value={r.id || r.roomId}>{r.name || r.roomName}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* 目标房间列表 */}
            <div className="border border-border p-6 space-y-3">
              <label className="block font-sans text-xs uppercase tracking-widest text-muted">目标房间 (按顺序访问)</label>
              {targetRooms.map((tr, index) => (
                <div key={tr.id} className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <RoomSelect value={tr.roomId} onChange={(v) => updateTarget(tr.id, v)} placeholder={`目标房间 ${index + 1}`} />
                  </div>
                  {targetRooms.length > 1 && (
                    <button onClick={() => removeTarget(tr.id)}
                      className="p-2 text-muted hover:text-red-500 transition-colors shrink-0" title="移除">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addTarget}
                className="flex items-center gap-1.5 text-sm text-muted hover:text-heading transition-colors py-1.5 px-3 border border-dashed border-neutral-300 hover:border-neutral-500 w-full justify-center">
                <Plus size={14} /> 添加目标房间
              </button>
            </div>

            <div className="flex items-center justify-between p-4 border border-border">
              <span className="font-sans text-xs uppercase tracking-widest text-muted">避开拥挤</span>
              <button
                onClick={() => setAvoidCongestion(!avoidCongestion)}
                className={`relative w-10 h-5 rounded-full transition-colors ${avoidCongestion ? 'bg-heading' : 'bg-muted/30'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-surface transition-transform ${avoidCongestion ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>

            <CTAButton onClick={handleNavigate}
              disabled={!targetRooms.some((tr) => tr.roomId && isValidRoomId(tr.roomId)) || navigating}
              className="w-full justify-center">
              <Navigation size={16} className="inline mr-1" /> {navigating ? '规划中...' : '开始室内导航'}
            </CTAButton>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <AMapView currentLocation={buildingLocation} mapHeight={300} showControls={false} />
            {navResult ? (
              <div className="border border-border p-6 space-y-6">
                <div className="flex items-center gap-6 flex-wrap">
                  <div>
                    <span className="font-sans text-xs uppercase tracking-widest text-muted">
                      {navResult.multiRoom ? '途经房间' : '目的地'}
                    </span>
                    <p className="font-serif text-lg text-heading">
                      {navResult.multiRoom
                        ? (navResult.roomsVisited || []).map((r) => r.name).join(' → ')
                        : navResult.destinationName || navResult.destination?.name || '-'}
                    </p>
                  </div>
                  <div>
                    <span className="font-sans text-xs uppercase tracking-widest text-muted">总距离</span>
                    <p className="font-serif text-lg text-heading">
                      {navResult.totalDistance != null
                        ? `${Math.round(navResult.totalDistance)} m`
                        : navResult.distance != null ? `${Math.round(navResult.distance)} m` : '-'}
                    </p>
                  </div>
                  <div>
                    <span className="font-sans text-xs uppercase tracking-widest text-muted">预计时间</span>
                    <p className="font-serif text-lg text-heading">
                      {navResult.totalEstimatedTimeMinutes != null
                        ? `${navResult.totalEstimatedTimeMinutes} min`
                        : navResult.estimatedTimeMinutes != null ? `${navResult.estimatedTimeMinutes} min`
                        : navResult.duration ? `${navResult.duration} min` : '-'}
                    </p>
                  </div>
                </div>

                {/* 楼层分析 */}
                {(navResult.totalFloorAnalysis || navResult.floorAnalysis) && (
                  <div className="text-xs text-muted space-y-1 border-t border-border pt-4">
                    {(() => {
                      const fa = navResult.totalFloorAnalysis || navResult.floorAnalysis;
                      const fc = fa.totalFloorChanges != null ? fa.totalFloorChanges : fa.floorChanges;
                      return (
                        <p>楼层变化: {fc || 0} 次 (电梯: {fa.elevatorChanges || 0}, 楼梯: {fa.stairChanges || 0}) · 经过楼层: {(fa.floorsVisited || []).join(', ')}</p>
                      );
                    })()}
                  </div>
                )}

                {/* 多房间分段 */}
                {navResult.segments && navResult.segments.length > 0 && (
                  <div className="space-y-3 border-t border-border pt-4">
                    <h3 className="font-sans text-xs uppercase tracking-widest text-muted">房间分段</h3>
                    {navResult.segments.map((seg, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm border-b border-border pb-2">
                        <span className="text-muted text-xs">段{i + 1}</span>
                        <span className="font-medium">{seg.fromRoomName || seg.fromRoomId}</span>
                        <span className="text-muted">→</span>
                        <span className="font-medium">{seg.toRoomName || seg.toRoomId}</span>
                        <span className="text-muted ml-auto text-xs">{Math.round(seg.distance || 0)}m / {seg.estimatedTime || 0}min</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 导航步骤 */}
                {(navResult.mergedSteps || navResult.navigationSteps || navResult.steps) && (
                  <div className="border-t border-border pt-4 space-y-3">
                    <h3 className="font-sans text-xs uppercase tracking-widest text-muted">导航步骤</h3>
                    {(navResult.mergedSteps || navResult.navigationSteps || navResult.steps || []).map((step, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-6 h-6 flex items-center justify-center border border-neutral-300 rounded-full flex-shrink-0">
                          <span className="font-mono text-xs">{i + 1}</span>
                        </div>
                        <div>
                          <p className="font-sans text-sm text-body">{step.action || step.instruction || step.description || `第${i + 1}步`}</p>
                          {step.floorChange && (
                            <span className="inline-flex items-center gap-1 mt-1 font-sans text-xs text-muted">
                              <Layers size={10} /> 楼层切换
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center border border-border py-16">
                <div className="text-center">
                  <Building size={48} className="mx-auto mb-4 text-muted" />
                  <p className="font-sans text-sm text-muted">选择一个或多个房间开始室内导航</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default IndoorNavigationPage;
