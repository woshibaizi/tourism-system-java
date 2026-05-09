import React, { useState, useEffect } from 'react';
import { Star, MapPin, BookOpen, Users, GitBranch, TrendingUp, Award } from 'lucide-react';
import { statsAPI, placeAPI, diaryAPI, userAPI } from '../services/api';
import SectionLabel from '../components/ui/SectionLabel';

function StatsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [places, setPlaces] = useState([]);
  const [diaries, setDiaries] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, p, d, u] = await Promise.all([
          statsAPI.getStatistics(),
          placeAPI.getPlaces(),
          diaryAPI.getDiaries({ pageSize: 1000 }),
          userAPI.getUsers(),
        ]);
        setStats(s.data || {});
        setPlaces(p.data || []);
        setDiaries(d.data || []);
        setUsers(u.data || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  const overviewStats = [
    { label: '旅游场所', value: stats.places || places.length, icon: MapPin },
    { label: '旅游日记', value: stats.diaries || diaries.length, icon: BookOpen },
    { label: '注册用户', value: stats.users || users.length, icon: Users },
    { label: '路径网络', value: stats.roads || 0, icon: GitBranch },
  ];

  const popularPlaces = [...places].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5);
  const popularDiaries = [...diaries].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5);
  const activeUsers = [...users].sort((a, b) => (b.clickCount || 0) - (a.clickCount || 0)).slice(0, 5);

  const ratingDist = [1, 2, 3, 4, 5].map((star) => {
    const count = places.filter((p) => Math.round(p.rating) === star).length;
    const max = places.length || 1;
    return { star, count, pct: Math.round((count / max) * 100) };
  });

  const placeTypes = {};
  places.forEach((p) => {
    const t = p.type || '其他';
    placeTypes[t] = (placeTypes[t] || 0) + 1;
  });

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-12">
      <SectionLabel>Dashboard</SectionLabel>
      <h1 className="font-serif text-3xl text-heading mb-8">系统统计</h1>

      {/* Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
        {overviewStats.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="border border-border p-6 text-center">
              <div className="flex justify-center mb-3"><Icon size={24} className="text-muted" /></div>
              <p className="font-serif text-3xl text-heading">{s.value}</p>
              <p className="font-sans text-xs uppercase tracking-widest text-muted mt-1">{s.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Popular Places */}
        <div>
          <SectionLabel>Top Rated</SectionLabel>
          <h2 className="font-serif text-2xl text-heading mb-6">热门场所 Top 5</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-3 font-sans text-xs uppercase tracking-widest text-muted w-10">#</th>
                <th className="py-3 font-sans text-xs uppercase tracking-widest text-muted">名称</th>
                <th className="py-3 font-sans text-xs uppercase tracking-widest text-muted w-20">评分</th>
              </tr>
            </thead>
            <tbody>
              {popularPlaces.map((p, i) => (
                <tr key={p.id} className="border-b border-neutral-50 hover:bg-accent-soft">
                  <td className="py-3 font-mono text-sm text-muted">{i + 1}</td>
                  <td className="py-3 font-sans text-sm text-body">{p.name}</td>
                  <td className="py-3 font-sans text-sm text-body flex items-center gap-1">
                    <Star size={12} className="text-amber-500" fill="currentColor" /> {p.rating || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Popular Diaries */}
        <div>
          <SectionLabel>Most Read</SectionLabel>
          <h2 className="font-serif text-2xl text-heading mb-6">热门日记 Top 5</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-3 font-sans text-xs uppercase tracking-widest text-muted w-10">#</th>
                <th className="py-3 font-sans text-xs uppercase tracking-widest text-muted">标题</th>
                <th className="py-3 font-sans text-xs uppercase tracking-widest text-muted w-16">浏览</th>
              </tr>
            </thead>
            <tbody>
              {popularDiaries.map((d, i) => (
                <tr key={d.id} className="border-b border-neutral-50 hover:bg-accent-soft">
                  <td className="py-3 font-mono text-sm text-muted">{i + 1}</td>
                  <td className="py-3 font-sans text-sm text-body">{d.title}</td>
                  <td className="py-3 font-sans text-sm text-body">{d.clickCount || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mt-12">
        {/* User Activity */}
        <div>
          <SectionLabel>Active Users</SectionLabel>
          <h2 className="font-serif text-2xl text-heading mb-6">用户活跃度</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-3 font-sans text-xs uppercase tracking-widest text-muted w-10">#</th>
                <th className="py-3 font-sans text-xs uppercase tracking-widest text-muted">用户名</th>
                <th className="py-3 font-sans text-xs uppercase tracking-widest text-muted w-20">活跃度</th>
              </tr>
            </thead>
            <tbody>
              {activeUsers.map((u, i) => (
                <tr key={u.id} className="border-b border-neutral-50">
                  <td className="py-3 font-mono text-sm text-muted">{i + 1}</td>
                  <td className="py-3 font-sans text-sm text-body">{u.username || u.name || '-'}</td>
                  <td className="py-3 font-sans text-sm text-body">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-accent-soft">
                        <div className="h-full bg-heading" style={{ width: `${Math.min(((u.clickCount || 0) / (activeUsers[0]?.clickCount || 1)) * 100, 100)}%` }} />
                      </div>
                      {u.clickCount || 0}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Rating Distribution */}
        <div>
          <SectionLabel>Analysis</SectionLabel>
          <h2 className="font-serif text-2xl text-heading mb-6">评分分布</h2>
          <div className="space-y-3">
            {ratingDist.map((r) => (
              <div key={r.star} className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted w-12">{r.star} 星</span>
                <div className="flex-1 h-2 bg-accent-soft">
                  <div className="h-full bg-heading transition-all" style={{ width: `${r.pct}%` }} />
                </div>
                <span className="font-mono text-xs text-muted w-8 text-right">{r.count}</span>
              </div>
            ))}
          </div>

          {/* Place type distribution */}
          <div className="mt-8">
            <SectionLabel>Types</SectionLabel>
            <h2 className="font-serif text-2xl text-heading mb-6">场所类型分布</h2>
            <div className="flex flex-wrap gap-3">
              {Object.entries(placeTypes).map(([type, count]) => (
                <span key={type} className="px-4 py-2 border border-border font-sans text-sm">
                  {type} <span className="text-muted ml-1">({count})</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StatsPage;
