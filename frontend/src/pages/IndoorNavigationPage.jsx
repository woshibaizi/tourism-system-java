import React, { useState, useEffect } from 'react';
import { Building, Navigation, AlertCircle, Layers } from 'lucide-react';
import { indoorNavigationAPI } from '../services/api';
import CTAButton from '../components/ui/CTAButton';
import SectionLabel from '../components/ui/SectionLabel';
import AMapView from '../components/Map/AMapView';

function IndoorNavigationPage({ embedded = false }) {
  const [loading, setLoading] = useState(true);
  const [buildingInfo, setBuildingInfo] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [avoidCongestion, setAvoidCongestion] = useState(false);
  const [navResult, setNavResult] = useState(null);
  const [navigating, setNavigating] = useState(false);
  const [buildingLocation] = useState({ lng: 116.3577, lat: 39.9577 });

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

  const handleNavigate = async () => {
    if (!selectedRoom) return;
    setNavigating(true);
    try {
      const res = await indoorNavigationAPI.navigate({ roomId: selectedRoom, avoidCongestion, useTimeWeight: true });
      if (res.success) setNavResult(res.data);
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

            <div className="border border-border p-6">
              <label className="block font-sans text-xs uppercase tracking-widest text-muted mb-2">目标房间</label>
              <select value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)}
                className="w-full border border-border px-3 py-2 text-sm font-sans bg-surface">
                <option value="">选择房间</option>
                {Object.entries(roomsByFloor).map(([floor, rooms]) => (
                  <optgroup key={floor} label={`${floor}楼`}>
                    {rooms.map((r) => <option key={r.id || r.roomId} value={r.id || r.roomId}>{r.name || r.roomName}</option>)}
                  </optgroup>
                ))}
              </select>
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

            <CTAButton onClick={handleNavigate} disabled={!selectedRoom || navigating} className="w-full justify-center">
              <Navigation size={16} className="inline mr-1" /> {navigating ? '规划中...' : '开始室内导航'}
            </CTAButton>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <AMapView
              currentLocation={buildingLocation}
              mapHeight={300}
              showControls={false}
            />
            {navResult ? (
              <div className="border border-border p-6 space-y-6">
                <div className="flex items-center gap-6">
                  <div>
                    <span className="font-sans text-xs uppercase tracking-widest text-muted">目的地</span>
                    <p className="font-serif text-lg text-heading">{navResult.destinationName || selectedRoom}</p>
                  </div>
                  <div>
                    <span className="font-sans text-xs uppercase tracking-widest text-muted">距离</span>
                    <p className="font-serif text-lg text-heading">{navResult.distance ? `${Math.round(navResult.distance)} m` : '-'}</p>
                  </div>
                  <div>
                    <span className="font-sans text-xs uppercase tracking-widest text-muted">预计时间</span>
                    <p className="font-serif text-lg text-heading">{navResult.duration ? `${navResult.duration} min` : '-'}</p>
                  </div>
                </div>

                {navResult.steps && navResult.steps.length > 0 && (
                  <div className="border-t border-border pt-4 space-y-3">
                    <h3 className="font-sans text-xs uppercase tracking-widest text-muted">导航步骤</h3>
                    {navResult.steps.map((step, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-6 h-6 flex items-center justify-center border border-neutral-300 rounded-full flex-shrink-0">
                          <span className="font-mono text-xs">{i + 1}</span>
                        </div>
                        <div>
                          <p className="font-sans text-sm text-body">{step.instruction || step.description || `第${i + 1}步`}</p>
                          {step.floor && (
                            <span className="inline-flex items-center gap-1 mt-1 font-sans text-xs text-muted">
                              <Layers size={10} /> {step.floor}
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
                  <p className="font-sans text-sm text-muted">选择一个房间开始室内导航</p>
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
