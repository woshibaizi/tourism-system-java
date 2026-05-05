import React, { useState } from 'react';
import { Zap, CheckCircle, XCircle, Clock } from 'lucide-react';
import CTAButton from '../components/ui/CTAButton';
import SectionLabel from '../components/ui/SectionLabel';

function ConcurrencyTestPage() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0, avgTime: 0 });
  const [progress, setProgress] = useState(0);
  const [config, setConfig] = useState({ count: 20, concurrency: 5 });

  const endpoints = ['/api/places', '/api/buildings', '/api/facilities', '/api/diaries', '/api/stats'];

  const runTest = async () => {
    setTesting(true);
    setResults([]);
    setProgress(0);
    const allResults = [];
    let successCount = 0;
    let failCount = 0;
    const times = [];

    const batch = async (start, size) => {
      for (let i = start; i < Math.min(start + size, config.count); i++) {
        const url = endpoints[i % endpoints.length];
        const t0 = performance.now();
        try {
          const res = await fetch(url);
          const elapsed = performance.now() - t0;
          times.push(elapsed);
          if (res.ok) {
            successCount++;
            allResults.push({ id: i + 1, url, status: res.status, time: Math.round(elapsed), success: true });
          } else {
            failCount++;
            allResults.push({ id: i + 1, url, status: res.status, time: Math.round(elapsed), success: false });
          }
        } catch {
          failCount++;
          allResults.push({ id: i + 1, url, status: 'ERROR', time: Math.round(performance.now() - t0), success: false });
        }
        setResults([...allResults]);
        setStats({ total: allResults.length, success: successCount, failed: failCount, avgTime: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0 });
        setProgress(Math.round((allResults.length / config.count) * 100));
      }
    };

    for (let i = 0; i < config.count; i += config.concurrency) {
      const tasks = [];
      for (let j = 0; j < config.concurrency && i + j < config.count; j++) {
        tasks.push(batch(i + j, 1));
      }
      await Promise.all(tasks);
    }

    setTesting(false);
  };

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-12">
      <SectionLabel>Benchmark</SectionLabel>
      <h1 className="font-serif text-3xl text-heading mb-8 flex items-center gap-3"><Zap size={28} /> 并发测试</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="border border-neutral-100 p-6 text-center">
          <p className="font-serif text-3xl text-heading">{stats.total}</p>
          <p className="font-sans text-xs uppercase tracking-widest text-muted mt-1">总请求</p>
        </div>
        <div className="border border-neutral-100 p-6 text-center">
          <p className="font-serif text-3xl text-green-600">{stats.success}</p>
          <p className="font-sans text-xs uppercase tracking-widest text-muted mt-1">成功</p>
        </div>
        <div className="border border-neutral-100 p-6 text-center">
          <p className="font-serif text-3xl text-red-500">{stats.failed}</p>
          <p className="font-sans text-xs uppercase tracking-widest text-muted mt-1">失败</p>
        </div>
        <div className="border border-neutral-100 p-6 text-center">
          <p className="font-serif text-3xl text-heading">{stats.avgTime}ms</p>
          <p className="font-sans text-xs uppercase tracking-widest text-muted mt-1">平均耗时</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-8 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="font-sans text-xs uppercase tracking-widest text-muted">请求数</label>
          <input type="number" min={1} max={100} value={config.count} onChange={(e) => setConfig({ ...config, count: Number(e.target.value) })}
            className="w-20 border border-neutral-200 px-2 py-1.5 text-sm font-sans" />
        </div>
        <div className="flex items-center gap-2">
          <label className="font-sans text-xs uppercase tracking-widest text-muted">并发数</label>
          <input type="number" min={1} max={20} value={config.concurrency} onChange={(e) => setConfig({ ...config, concurrency: Number(e.target.value) })}
            className="w-20 border border-neutral-200 px-2 py-1.5 text-sm font-sans" />
        </div>
        <CTAButton onClick={runTest} disabled={testing}>
          {testing ? '测试中...' : '开始测试'}
        </CTAButton>
      </div>

      {testing && (
        <div className="mb-8">
          <div className="h-2 bg-neutral-100">
            <div className="h-full bg-black transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="font-sans text-xs text-muted mt-2">{progress}%</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left">
                <th className="py-3 font-sans text-xs uppercase tracking-widest text-muted w-10">#</th>
                <th className="py-3 font-sans text-xs uppercase tracking-widest text-muted">端点</th>
                <th className="py-3 font-sans text-xs uppercase tracking-widest text-muted w-16">状态</th>
                <th className="py-3 font-sans text-xs uppercase tracking-widest text-muted w-20">耗时</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-b border-neutral-50 hover:bg-neutral-50">
                  <td className="py-2 font-mono text-xs text-muted">{r.id}</td>
                  <td className="py-2 font-mono text-xs">{r.url}</td>
                  <td className="py-2">
                    {r.success ? (
                      <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle size={12} /> {r.status}</span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-500 text-xs"><XCircle size={12} /> {r.status}</span>
                    )}
                  </td>
                  <td className="py-2 font-mono text-xs text-muted">
                    <span className="flex items-center gap-1"><Clock size={10} /> {r.time}ms</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ConcurrencyTestPage;
