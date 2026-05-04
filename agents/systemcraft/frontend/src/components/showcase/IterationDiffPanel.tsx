import { ArrowDown, ArrowUp, GitCompareArrows, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  buildIterationDiff,
  getIterationStatusLabel,
  getLatestComparableIteration,
} from '../../lib/iterations';
import type { ProjectDetail } from '../../types/api';

interface IterationDiffPanelProps {
  project: ProjectDetail | null;
}

export function IterationDiffPanel({ project }: IterationDiffPanelProps) {
  const comparableIterations = useMemo(
    () =>
      (project?.iteration_history ?? []).filter(
        (entry) => entry.before_snapshot && entry.after_snapshot,
      ),
    [project?.iteration_history],
  );
  const latestIteration = useMemo(
    () => getLatestComparableIteration(project?.iteration_history),
    [project?.iteration_history],
  );
  const [selectedIterationId, setSelectedIterationId] = useState<string>(latestIteration?.id ?? '');

  useEffect(() => {
    setSelectedIterationId(latestIteration?.id ?? '');
  }, [latestIteration?.id]);

  const selectedIteration =
    comparableIterations.find((entry) => entry.id === selectedIterationId) ?? latestIteration;
  const diff = useMemo(() => buildIterationDiff(selectedIteration), [selectedIteration]);

  if (!selectedIteration) {
    return (
      <section className="glass-panel rounded-[32px] p-6 sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-300">
          <GitCompareArrows className="h-3.5 w-3.5" />
          迭代对比
        </div>
        <div className="mt-5 rounded-[24px] border border-dashed border-slate-300/80 px-5 py-8 text-sm leading-7 text-slate-500 dark:border-white/10 dark:text-slate-400">
          至少完成一轮项目迭代后，这里才会显示前后差异。完成后你可以直接查看需求、架构、实现和测试在这一轮里分别发生了哪些变化。
        </div>
      </section>
    );
  }

  return (
    <section className="glass-panel rounded-[32px] p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-300">
            <GitCompareArrows className="h-3.5 w-3.5" />
            迭代对比
          </div>
          <h3 className="mt-4 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
            迭代前后差异一览
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500 dark:text-slate-400">
            对比每一轮变更请求前后的产物差异，能更直观地展示项目是如何逐步演进的。
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: '当前版本', value: selectedIteration.change_request.slice(0, 24) || '第 1 轮' },
            { label: '变更产物', value: `${diff.changeCount}` },
            { label: '迭代状态', value: getIterationStatusLabel(selectedIteration.status) },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-[22px] border border-white/10 bg-white/70 px-4 py-3 dark:bg-white/5"
            >
              <div className="text-xs font-semibold tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {item.label}
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {comparableIterations.length > 1 ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {comparableIterations.map((entry, index) => {
            const isActive = entry.id === selectedIteration.id;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSelectedIterationId(entry.id)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                    : 'border border-slate-200 bg-white/75 text-slate-600 hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white'
                }`}
              >
                第 {index + 1} 轮
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="mt-6 rounded-[24px] border border-white/10 bg-white/75 px-5 py-5 dark:bg-white/5">
        <div className="text-xs font-semibold tracking-[0.16em] text-slate-500 dark:text-slate-400">
          本轮变更需求
        </div>
        <p className="mt-3 text-sm leading-7 text-slate-700 dark:text-slate-300">
          {selectedIteration.change_request}
        </p>
        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          创建于 {new Date(selectedIteration.created_at).toLocaleString()}
          {selectedIteration.completed_at
            ? ` · 完成于 ${new Date(selectedIteration.completed_at).toLocaleString()}`
            : ''}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {diff.changedArtifacts.length > 0 ? (
          diff.changedArtifacts.map((artifact) => (
            <article
              key={artifact.key}
              className="rounded-[26px] border border-white/10 bg-white/75 p-5 dark:bg-white/5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950 dark:text-white">
                    {artifact.label}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      <span className="inline-flex items-center gap-1">
                        <ArrowUp className="h-3.5 w-3.5" />
                        新增 {artifact.addedLines} 行
                      </span>
                    </span>
                    <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300">
                      <span className="inline-flex items-center gap-1">
                        <ArrowDown className="h-3.5 w-3.5" />
                        移除 {artifact.removedLines} 行
                      </span>
                    </span>
                  </div>
                </div>
                <span className="rounded-full bg-slate-950/5 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                  已更新
                </span>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <div className="rounded-[22px] border border-slate-200/80 bg-white/90 px-4 py-4 dark:border-white/10 dark:bg-slate-950/30">
                  <div className="text-xs font-semibold tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    迭代前
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {artifact.beforeSummary}
                  </p>
                </div>
                <div className="rounded-[22px] border border-cyan-500/15 bg-cyan-500/5 px-4 py-4 dark:border-cyan-400/15 dark:bg-cyan-400/10">
                  <div className="text-xs font-semibold tracking-[0.16em] text-cyan-700 dark:text-cyan-300">
                    迭代后
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">
                    {artifact.afterSummary}
                  </p>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-[24px] border border-dashed border-slate-300/80 px-5 py-8 text-sm leading-7 text-slate-500 dark:border-white/10 dark:text-slate-400">
            这一轮迭代暂时还没有生成可对比的产物差异。
          </div>
        )}
      </div>

      <div className="mt-6 rounded-[24px] border border-slate-200/80 bg-white/85 px-5 py-4 text-sm leading-7 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
        <span className="inline-flex items-center gap-2 font-semibold text-slate-950 dark:text-white">
          <Sparkles className="h-4 w-4" />
          这个模块的意义
        </span>
        <p className="mt-2">
          迭代差异视图能把“项目会继续演进”这件事展示得更清楚，让整个产品更像真实的软件工程工作台，而不只是一次性生成器。
        </p>
      </div>
    </section>
  );
}
