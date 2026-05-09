import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, User, Eye, Calendar, Tag as TagIcon } from 'lucide-react';
import { getDiary, getUsers, rateDiary, getFileUrl } from '../services/api';
import { useToast } from '../components/ui/Toast';
import StarRating from '../components/ui/StarRating';
import SectionLabel from '../components/ui/SectionLabel';
import EmptyState from '../components/ui/EmptyState';
import LazyImage from '../components/ui/LazyImage';

function DiaryDetailPage() {
  const { diaryId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [diary, setDiary] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [userRating, setUserRating] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const [d, u] = await Promise.all([getDiary(diaryId), getUsers()]);
        if (d.success) setDiary(d.data);
        if (u.success) setUsers(u.data || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [diaryId]);

  const handleRate = async (rating) => {
    setRatingLoading(true);
    try {
      const userId = JSON.parse(localStorage.getItem('user') || '{}').id || 'user_001';
      await rateDiary(diaryId, rating, userId);
      setUserRating(rating);
      showToast('success', '评分成功');
    } catch { showToast('error', '评分失败'); }
    finally { setRatingLoading(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin" /></div>;
  }

  if (!diary) {
    return <EmptyState icon={ChevronLeft} title="日记不存在" actionLabel="返回列表" onAction={() => navigate('/diaries')} />;
  }

  const author = users.find((u) => u.id === diary.authorId);
  const tags = diary.tags || [];

  return (
    <div>
      <header className="border-b border-border bg-surface sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-6 py-4">
          <button onClick={() => navigate('/diaries')} className="flex items-center gap-2 text-sm text-muted hover:text-heading font-sans">
            <ChevronLeft size={16} /> 返回列表
          </button>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-12">
        <SectionLabel>{diary.destination || 'Travel'}</SectionLabel>
        <h1 className="font-serif text-4xl text-heading mb-6">{diary.title}</h1>

        <div className="flex items-center gap-6 mb-8 pb-8 border-b border-border">
          <div className="flex items-center gap-2 text-sm text-muted">
            <div className="w-8 h-8 rounded-full bg-accent-soft flex items-center justify-center"><User size={14} className="text-muted" /></div>
            <span>{author?.username || '匿名'}</span>
          </div>
          <span className="flex items-center gap-1 text-sm text-muted"><Calendar size={14} /> {diary.createdAt ? new Date(diary.createdAt).toLocaleDateString('zh-CN') : '-'}</span>
          <span className="flex items-center gap-1 text-sm text-muted"><Eye size={14} /> {diary.clickCount || 0}</span>
        </div>

        {diary.images && diary.images.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {diary.images.map((img, i) => (
              <div key={i} className="aspect-[3/2] bg-accent-soft overflow-hidden">
                <LazyImage src={getFileUrl(img)} alt={`${diary.title} ${i + 1}`} />
              </div>
            ))}
          </div>
        )}

        {diary.videos && diary.videos.length > 0 && (
          <div className="mb-8 space-y-4">
            {diary.videos.map((v, i) => (
              <video key={i} src={getFileUrl(v)} controls className="w-full" />
            ))}
          </div>
        )}

        <div className="font-sans text-body leading-relaxed whitespace-pre-wrap mb-8">
          {diary.content}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8 pb-8 border-b border-border">
            {tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1 px-3 py-1 text-xs border border-border font-sans text-muted">
                <TagIcon size={10} />{tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-4">
          <div>
            <SectionLabel>评分</SectionLabel>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-serif text-2xl text-heading">{diary.rating || '-'}</span>
              <StarRating value={diary.rating || 0} size={14} />
            </div>
          </div>
          <div className="text-right">
            <SectionLabel>你的评分</SectionLabel>
            <div className="mt-1">
              <StarRating value={userRating} size={18} interactive onChange={handleRate} />
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

export default DiaryDetailPage;
