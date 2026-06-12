import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Phone, Clock, Star, ChevronLeft, Navigation, Tag, Award } from 'lucide-react';
import { getSurroundingDetail, rateSurrounding, surroundingAPI, getFileUrl } from '../services/api';
import { useToast } from '../components/ui/Toast';
import CTAButton from '../components/ui/CTAButton';
import StarRating from '../components/ui/StarRating';
import SectionLabel from '../components/ui/SectionLabel';
import LazyImage from '../components/ui/LazyImage';

function SurroundingDetailPage() {
  const { placeId, id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState(null);
  const [ratingLoading, setRatingLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getSurroundingDetail(id);
        if (res.success) setItem(res.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  const handleRate = async (score) => {
    setRatingLoading(true);
    try {
      const res = await rateSurrounding(id, score);
      if (res.success && res.data) {
        setItem(prev => ({ ...prev, ...res.data }));
        showToast('success', '评分成功');
      }
    } catch { showToast('error', '评分失败'); }
    finally { setRatingLoading(false); }
  };

  const handleNavigate = () => {
    if (item) {
      navigate(`/navigation?tab=external`, {
        state: {
          presetDestination: {
            name: item.name,
            address: item.address || '',
          },
        },
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-400">商户不存在或已下架</p>
        <CTAButton className="mt-4" onClick={() => navigate(-1)}>返回</CTAButton>
      </div>
    );
  }

  const imageUrl = item.image ? getFileUrl(item.image) : null;
  const images = (() => {
    try { return typeof item.images === 'string' ? JSON.parse(item.images) : (item.images || []); }
    catch { return []; }
  })();
  const tags = (() => {
    try { return typeof item.tags === 'string' ? JSON.parse(item.tags) : (item.tags || []); }
    catch { return []; }
  })();

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-muted hover:text-heading mb-4 transition-colors"
      >
        <ChevronLeft size={20} />
        <span className="text-sm">返回</span>
      </button>

      {/* Hero image */}
      <div className="rounded-2xl overflow-hidden bg-black/20 mb-6 aspect-[16/9] relative">
        {imageUrl ? (
          <LazyImage src={imageUrl} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-7xl">
            {surroundingAPI.getTypeIcon(item.type)}
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className="px-3 py-1.5 rounded-full bg-black/50 backdrop-blur text-white text-xs font-medium">
            {surroundingAPI.getTypeIcon(item.type)} {surroundingAPI.getTypeLabel(item.type)}
          </span>
        </div>
      </div>

      {/* Name & basic info */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-heading mb-2">{item.name}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-body">
          {item.rating > 0 && (
            <span className="flex items-center gap-1 text-yellow-500">
              <Star size={16} className="fill-yellow-500" />
              <span className="font-semibold">{item.rating}</span>
              {item.ratingCount > 0 && (
                <span className="text-muted">({item.ratingCount}评)</span>
              )}
            </span>
          )}
          {item.distanceMeters != null && (
            <span className="flex items-center gap-1">
              <MapPin size={14} />
              {item.distanceMeters < 1000
                ? `${item.distanceMeters}m`
                : `${(item.distanceMeters / 1000).toFixed(1)}km`}
            </span>
          )}
          {item.priceRange && (
            <span className="px-2 py-0.5 rounded bg-surface border border-border text-accent text-xs font-medium">
              {item.priceRange}
              {item.avgCost ? ` 人均${item.avgCost}元` : ''}
            </span>
          )}
          {item.studentDiscount === 1 && (
            <span className="px-2 py-0.5 rounded bg-green-500/15 text-green-400 text-xs font-medium">
              学生优惠
            </span>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 mb-6">
        <CTAButton
          variant="primary"
          size="sm"
          icon={<Navigation size={16} />}
          onClick={handleNavigate}
        >
          导航到这里
        </CTAButton>
        {item.phone ? (
          <button
            onClick={() => window.open(`tel:${item.phone}`)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-sans text-sm font-semibold
                       bg-emerald-500/15 text-emerald-400 border border-emerald-500/30
                       hover:bg-emerald-500/25 hover:border-emerald-400/50
                       active:scale-[0.98] transition-all duration-200"
          >
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/20 flex-shrink-0">
              <Phone size={14} className="fill-emerald-400 text-emerald-400" />
            </span>
            <span>{item.phone}</span>
          </button>
        ) : (
          <span className="flex items-center gap-2 px-4 py-2 rounded-lg font-sans text-sm
                           bg-surface border border-border text-muted cursor-not-allowed">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-surface border border-border flex-shrink-0">
              <Phone size={14} className="text-muted" />
            </span>
            暂无电话
          </span>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {tags.map((tag, i) => (
            <span key={i} className="px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium
                                     border border-accent/20 flex items-center gap-1">
              <Tag size={12} />
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Description */}
      {item.description && item.description !== item.name && (
        <div className="mb-6">
          <SectionLabel>简介</SectionLabel>
          <p className="text-body text-sm leading-relaxed">{item.description}</p>
        </div>
      )}

      {/* Detail description */}
      {item.detailDescription && (
        <div className="mb-6">
          <SectionLabel>详细介绍</SectionLabel>
          <p className="text-body text-sm leading-relaxed whitespace-pre-line">
            {item.detailDescription}
          </p>
        </div>
      )}

      {/* Address */}
      {item.address && (
        <div className="mb-6">
          <SectionLabel>地址</SectionLabel>
          <p className="text-body text-sm">{item.address}</p>
        </div>
      )}

      {/* Must try */}
      {item.mustTry && (
        <div className="mb-6 p-4 rounded-xl bg-accent/5 border border-accent/20">
          <div className="flex items-center gap-2 text-accent mb-2">
            <Award size={18} />
            <span className="font-semibold text-sm">必点/必玩推荐</span>
          </div>
          <p className="text-body text-sm">{item.mustTry}</p>
        </div>
      )}

      {/* Rating */}
      <div className="mb-6">
        <SectionLabel>评分</SectionLabel>
        <div className="flex items-center gap-3">
          <StarRating
            value={item.rating || 0}
            onChange={handleRate}
            disabled={ratingLoading}
            size={28}
          />
          {ratingLoading && <span className="text-xs text-muted">提交中...</span>}
        </div>
      </div>

      {/* Images gallery */}
      {images.length > 0 && (
        <div className="mb-6">
          <SectionLabel>图片 ({images.length})</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            {images.map((img, i) => (
              <div key={i} className="aspect-square rounded-xl overflow-hidden bg-black/20">
                <LazyImage src={getFileUrl(img)} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="h-16" />
    </div>
  );
}

export default SurroundingDetailPage;
