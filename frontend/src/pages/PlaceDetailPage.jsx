import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Building, ChevronLeft, Star, Eye, Sparkles, ChevronRight } from 'lucide-react';
import { getPlace, recordVisit, ratePlace, getFileUrl, surroundingAPI } from '../services/api';
import { refreshPlaceXhs } from '../services/api/xhs';
import { addRecentPlace } from '../utils/recentPlaces';
import { useToast } from '../components/ui/Toast';
import CTAButton from '../components/ui/CTAButton';
import StarRating from '../components/ui/StarRating';
import SectionLabel from '../components/ui/SectionLabel';
import EmptyState from '../components/ui/EmptyState';
import LazyImage from '../components/ui/LazyImage';
import XhsCard from '../components/XhsCard';
import Pagination from '../components/ui/Pagination';

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
  const [srPage, setSrPage] = useState(1);
  const [srTextPage, setSrTextPage] = useState(1);
  const [surrounding, setSurrounding] = useState([]);
  const [surroundingCounts, setSurroundingCounts] = useState({});
  const pageSize = 5;
  const srPageSize = 6;
  const srScenicPageSize = 10;

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getPlace(placeId);
        if (res.success) {
          setPlaceData(res.data);
          addRecentPlace(res.data);
          // 懒加载小红书热度数据：若无缓存则后台触发抓取，下次访问即可展示
          if (!res.data.xhsInfo) {
            refreshPlaceXhs(placeId).catch(() => {});
          }
        }
        const userId = JSON.parse(localStorage.getItem('user') || '{}').id;
        if (userId) recordVisit(placeId, userId);
        // Load surrounding data
        const [srRes, countsRes] = await Promise.all([
          surroundingAPI.listByPlace(placeId),
          surroundingAPI.getCategoryCounts(placeId),
        ]);
        // BUPT 保留前6条做预览卡片，景区保留前12条做纯文字列表
        if (srRes.success) setSurrounding(srRes.data || []);
        if (countsRes.success) setSurroundingCounts(countsRes.data || {});
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
  const srPages = Math.ceil(surrounding.length / srPageSize);
  const srScenicPages = Math.ceil(surrounding.length / srScenicPageSize);
  const paginatedSr = surrounding.slice((srPage - 1) * srPageSize, srPage * srPageSize);
  const paginatedSrScenic = surrounding.slice((srTextPage - 1) * srScenicPageSize, srTextPage * srScenicPageSize);

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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:items-start">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <h2 className="font-serif text-2xl text-heading mb-4">关于此地</h2>
              <p className="font-sans text-body leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>{placeData.detailDescription || placeData.description || '暂无描述'}</p>
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
                  <Pagination current={bldPage} total={bldPages} onChange={setBldPage} />
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
                  <Pagination current={facPage} total={facPages} onChange={setFacPage} />
                )}
              </div>
            )}

            {/* 校园周边 */}
            {surrounding.length > 0 && (
              <div>
                <h3 className="font-serif text-lg text-heading mb-4 flex items-center gap-2">
                  <Sparkles size={18} />
                  周边 ({Object.values(surroundingCounts).reduce((a, b) => a + b, 0)})
                </h3>

                {/* BUPT (place_001): 富媒体展示 + 分类标签 + 跳转链接 */}
                {placeId === 'place_001' ? (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(surroundingCounts).map(([type, count]) => (
                          <button
                            key={type}
                            onClick={() => navigate(`/surrounding/${placeId}`)}
                            className="px-3 py-1 rounded-full text-xs bg-surface border border-border
                                       text-gray-300 hover:text-white hover:border-accent/40 transition-colors font-sans"
                          >
                            {surroundingAPI.getTypeIcon(type)} {surroundingAPI.getTypeLabel(type)} ({count})
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => navigate(`/surrounding/${placeId}`)}
                        className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 font-sans transition-colors flex-shrink-0 ml-4"
                      >
                        查看全部 <ChevronRight size={14} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {paginatedSr.map(sr => (
                        <div
                          key={sr.id}
                          onClick={() => navigate(`/surrounding/${placeId}/${sr.id}`)}
                          className="flex items-center gap-3 border border-border p-3 rounded-xl
                                     cursor-pointer hover:border-accent/30 hover:bg-surface/50 transition-all font-sans"
                        >
                          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-lg flex-shrink-0">
                            {surroundingAPI.getTypeIcon(sr.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-heading truncate">{sr.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                              {sr.rating > 0 && (
                                <span className="flex items-center gap-0.5">
                                  <Star size={10} className="text-yellow-500 fill-yellow-500" />
                                  {sr.rating}
                                </span>
                              )}
                              {sr.distanceMeters != null && (
                                <span>{sr.distanceMeters < 1000 ? `${sr.distanceMeters}m` : `${(sr.distanceMeters / 1000).toFixed(1)}km`}</span>
                              )}
                              {sr.avgCost != null ? <span>¥{sr.avgCost}/人</span> : sr.priceRange && <span>{sr.priceRange}</span>}
                            </div>
                          </div>
                          <ChevronRight size={14} className="text-gray-600 flex-shrink-0" />
                        </div>
                      ))}
                    </div>
                    {srPages > 1 && (
                      <Pagination current={srPage} total={srPages} onChange={setSrPage} />
                    )}
                  </>
                ) : (
                  /* 景区/其他学校: 纯文字精简列表 + 分页，无图片、无评分、无跳转 */
                  <>
                    <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
                      {paginatedSrScenic.map((sr) => (
                        <div key={sr.id} className="flex items-center gap-3 px-4 py-2.5 font-sans text-sm">
                          <span className="text-base flex-shrink-0">{surroundingAPI.getTypeIcon(sr.type)}</span>
                          <span className="text-heading truncate flex-1">{sr.name}</span>
                          <span className="text-xs text-muted flex-shrink-0">{surroundingAPI.getTypeLabel(sr.type)}</span>
                          {sr.distanceMeters != null && (
                            <span className="text-xs text-muted/60 flex-shrink-0">
                              {sr.distanceMeters < 1000 ? `${sr.distanceMeters}m` : `${(sr.distanceMeters / 1000).toFixed(1)}km`}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    {srScenicPages > 1 && (
                      <Pagination current={srTextPage} total={srScenicPages} onChange={setSrTextPage} />
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div>
            <div className="border border-border p-6 space-y-6">
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

              <CTAButton className="w-full justify-center" onClick={() => {
                // 放弃本地数据库坐标（大量数据不准确），只传名称和地址，
                // 由导航页通过高德 API 搜索匹配最准确的 POI 坐标
                navigate(`/navigation?tab=external`, {
                  state: {
                    presetDestination: {
                      name: placeData.name,
                      address: placeData.address || '',
                    },
                  },
                });
              }}>
                去导航
              </CTAButton>
            </div>

            {/* 小红书热度卡片 */}
            <div className="mt-6">
              <XhsCard xhsInfo={placeData.xhsInfo} placeId={placeId} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlaceDetailPage;
