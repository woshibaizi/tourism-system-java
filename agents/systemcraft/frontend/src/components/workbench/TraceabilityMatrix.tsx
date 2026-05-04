import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  GitBranch,
  Layers3,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildTraceabilityRows, getTraceabilityCoverage } from '../../lib/traceability';
import type { ArtifactKey, ProjectDetail } from '../../types/api';

interface TraceabilityMatrixProps {
  project: ProjectDetail | null;
  onOpenArtifact?: (artifactKey: ArtifactKey) => void;
  compact?: boolean;
}

const columnMeta = [
  { key: 'requirement', label: '需求', icon: Target },
  { key: 'architecture', label: '架构', icon: Layers3 },
  { key: 'implementation', label: '实现', icon: GitBranch },
  { key: 'testing', label: '测试', icon: ShieldCheck },
] as const;

export function TraceabilityMatrix({
  project,
  onOpenArtifact,
  compact = false,
}: TraceabilityMatrixProps) {
  const rows = useMemo(() => buildTraceabilityRows(project), [project]);
  const coverage = useMemo(() => getTraceabilityCoverage(rows), [rows]);
  const [isExpanded, setIsExpanded] = useState(compact);

  return (
    <section className={`glass-panel rounded-[30px] ${compact ? 'p-5' : 'p-5 sm:p-6'}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
            <GitBranch className="h-3.5 w-3.5" />
            交付追踪图
          </div>
          <h3 className="mt-3 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
            从需求到交付的映射关系
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            用一张表快速看清需求、架构、实现和测试之间的对应关系。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {[
              { label: '追踪行数', value: `${coverage.totalRows}` },
              { label: '完整闭环', value: `${coverage.fullyConnectedRows}` },
              { label: '覆盖率', value: `${coverage.coveragePercent}%` },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-full border border-slate-200/80 bg-white/85 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
              >
                <span className="text-slate-500 dark:text-slate-400">{item.label}</span>
                <span className="ml-2 font-semibold text-slate-950 dark:text-white">{item.value}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20 dark:hover:text-white"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                收起追踪图
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                展开追踪图
              </>
            )}
          </button>
        </div>
      </div>

      {isExpanded ? (
        rows.length > 0 ? (
          <div className="mt-6 space-y-4">
            <div className="grid gap-3 xl:grid-cols-4">
              {columnMeta.map(({ label, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-[22px] border border-dashed border-slate-300/80 px-4 py-3 text-xs font-semibold tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400"
                >
                  <div className="inline-flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </div>
                </div>
              ))}
            </div>

            {rows.map((row, rowIndex) => (
              <div key={row.id} className="grid gap-3 xl:grid-cols-4">
                {columnMeta.map(({ key, label }) => {
                  const node = row[key];
                  if (!node) {
                    return (
                      <div
                        key={`${row.id}-${label}`}
                        className="rounded-[24px] border border-dashed border-slate-300/80 px-4 py-4 text-sm leading-6 text-slate-400 dark:border-white/10 dark:text-slate-500"
                      >
                        当前还没有对应内容
                      </div>
                    );
                  }

                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => onOpenArtifact?.(node.artifactKey)}
                      className="rounded-[24px] border border-white/10 bg-white/70 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 dark:bg-white/5 dark:hover:border-white/20"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full bg-slate-950/5 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-slate-500 dark:bg-white/10 dark:text-slate-400">
                          第 {rowIndex + 1} 行
                        </span>
                        {onOpenArtifact ? <ArrowUpRight className="h-4 w-4 text-slate-400" /> : null}
                      </div>
                      <div className="mt-3 text-sm font-semibold text-slate-950 dark:text-white">
                        {node.title}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {node.summary}
                      </p>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-[24px] border border-dashed border-slate-300/80 px-5 py-8 text-sm leading-7 text-slate-500 dark:border-white/10 dark:text-slate-400">
            等需求、架构、实现和测试产物生成后，这里会自动整理出对应的追踪关系。
          </div>
        )
      ) : (
        <div className="mt-6 rounded-[24px] border border-dashed border-slate-300/80 px-5 py-5 text-sm leading-7 text-slate-500 dark:border-white/10 dark:text-slate-400">
          追踪图已收起。你可以在需要时展开查看每一条需求如何映射到架构、实现和测试。
        </div>
      )}
    </section>
  );
}
