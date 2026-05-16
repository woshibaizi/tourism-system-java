import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Building, ChevronLeft, Star, Eye } from 'lucide-react';
import { getPlace, recordVisit, ratePlace, getFileUrl } from '../services/api';
import { useToast } from '../components/ui/Toast';
import CTAButton from '../components/ui/CTAButton';
import StarRating from '../components/ui/StarRating';
import SectionLabel from '../components/ui/SectionLabel';
import EmptyState from '../components/ui/EmptyState';
import LazyImage from '../components/ui/LazyImage';

function PlaceDetailPage() {
  const { placeId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [placeData, setPlaceData] = useState(null);
  const [userRating, setUserRating] = useState(0);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [bldPage, setBldPage] = useState(1);
  const [facPage, setFacPage] = useState(1);
  const pageSize = 5;

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getPlace(placeId);
        if (res.success) setPlaceData(res.data);
        const userId = JSON.parse(localStorage.getItem('user') || '{}').id;
        if (userId) recordVisit(placeId, userId);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [placeId]);

  const handleRate = async (rating) => {
    setRatingLoading(true);
    try {
      const userId = JSON.parse(localStorage.getItem('user') || '{}').id || 'user_001';
      await ratePlace(placeId, rating, userId);
      setUserRating(rating);
      showToast('success', '评分成功');
    } catch { showToast('error', '评分失败'); }
    finally { setRatingLoading(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!placeData) {
    return <EmptyState icon={MapPin} title="地点不存在" description="该地点可能已被删除" actionLabel="返回列表" onAction={() => navigate('/location-search')} />;
  }

  const buildings = placeData.buildings || [];
  const facilities = placeData.facilities || [];
  const bldPages = Math.ceil(buildings.length / pageSize);
  const facPages = Math.ceil(facilities.length / pageSize);
  const paginatedBld = buildings.slice((bldPage - 1) * pageSize, bldPage * pageSize);
  const paginatedFac = facilities.slice((facPage - 1) * pageSize, facPage * pageSize);

  return (
    <div>
      {/* Hero */}
      <section className="relative w-full h-[400px] md:h-[500px] bg-accent-soft">
        {placeData.image ? (
          <img src={getFileUrl(placeData.image)} alt={placeData.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><MapPin size={64} className="text-muted" /></div>
        )}
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-16 max-w-screen-xl mx-auto w-full">
          <button onClick={() => navigate('/location-search')} className="flex items-center gap-2 text-white/80 hover:text-white mb-4 font-sans text-sm">
            <ChevronLeft size={16} /> 返回列表
          </button>
          <SectionLabel className="!text-white/80">{placeData.type || '景点'}</SectionLabel>
          <h1 className="font-serif text-4xl md:text-6xl text-white drop-shadow-md">{placeData.name}</h1>
        </div>
      </section>

      <div className="max-w-screen-xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <h2 className="font-serif text-2xl text-heading mb-4">关于此地</h2>
              <p className="font-sans text-body leading-relaxed">{placeData.description || '暂无描述'}</p>
            </div>

            {placeData.keywords && placeData.keywords.length > 0 && (
              <div>
                <h3 className="font-serif text-lg text-heading mb-3">特色标签</h3>
                <div className="flex flex-wrap gap-2">
                  {placeData.keywords.map((kw) => (
                    <span key={kw} className="px-3 py-1 text-xs bg-accent-soft border border-border font-sans">{kw}</span>
                  ))}
                </div>
              </div>
            )}

            {placeData.features && placeData.features.length > 0 && (
              <div>
                <h3 className="font-serif text-lg text-heading mb-3">特色亮点</h3>
                <div className="flex flex-wrap gap-2">
                  {placeData.features.map((f) => (
                    <span key={f} className="px-3 py-1 text-xs bg-accent-soft border border-border font-sans">{f}</span>
                  ))}
                </div>
              </div>
            )}

            {buildings.length > 0 && (
              <div>
                <h3 className="font-serif text-lg text-heading mb-4 flex items-center gap-2"><Building size={18} /> 建筑 ({buildings.length})</h3>
                <div className="space-y-3">
                  {paginatedBld.map((b) => (
                    <div key={b.id} className="border border-border p-4">
                      <h4 className="font-serif text-base text-heading">{b.name}</h4>
                      {b.description && <p className="font-sans text-xs text-muted mt-1">{b.description}</p>}
                    </div>
                  ))}
                </div>
                {bldPages > 1 && (
                  <div className="flex gap-2 mt-4">
                    {Array.from({ length: bldPages }, (_, i) => (
                      <button key={i} onClick={() => setBldPage(i + 1)} className={`w-8 h-8 text-xs border ${bldPage === i + 1 ? 'bg-heading text-white border-heading' : 'border-border'}`}>{i + 1}</button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {facilities.length > 0 && (
              <div>
                <h3 className="font-serif text-lg text-heading mb-4">设施 ({facilities.length})</h3>
                <div className="space-y-3">
                  {paginatedFac.map((f) => (
                    <div key={f.id} className="border border-border p-4">
                      <h4 className="font-serif text-base text-heading">{f.name}</h4>
                      <p className="font-sans text-xs text-muted mt-1">{f.type || '设施'} · {f.description || ''}</p>
                    </div>
                  ))}
                </div>
                {facPages > 1 && (
                  <div className="flex gap-2 mt-4">
                    {Array.from({ length: facPages }, (_, i) => (
                      <button key={i} onClick={() => setFacPage(i + 1)} className={`w-8 h-8 text-xs border ${facPage === i + 1 ? 'bg-heading text-white border-heading' : 'border-border'}`}>{i + 1}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div>
            <div className="border border-border p-6 sticky top-8 space-y-6">
              <div>
                <SectionLabel>Rating</SectionLabel>
                <div className="flex items-center gap-3 mt-2">
                  <span className="font-serif text-3xl text-heading">{placeData.rating || '-'}</span>
                  <StarRating value={placeData.rating || 0} size={16} />
                </div>
                <div className="mt-4">
                  <SectionLabel>你的评分</SectionLabel>
                  <div className="mt-2">
                    <StarRating value={userRating} size={20} interactive onChange={handleRate} />
                    {ratingLoading && <span className="text-xs text-muted ml-2">提交中...</span>}
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Eye size={14} />
                  <span>{placeData.clickCount || 0} 次浏览</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted">
                  <MapPin size={14} />
                  <span>{placeData.location || placeData.address || '地址未提供'}</span>
                </div>
              </div>

              <CTAButton className="w-full justify-center" onClick={() => navigate(`/route-planning`, { state: { presetDestinationKeyword: placeData.name } })}>
                去导航
              </CTAButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlaceDetailPage;
