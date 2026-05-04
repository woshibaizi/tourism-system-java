import {
  ArrowUpRight,
  Clipboard,
  Download,
  FolderOpen,
  GraduationCap,
  LayoutList,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { IterationDiffPanel } from '../components/showcase/IterationDiffPanel';
import { TraceabilityMatrix } from '../components/workbench/TraceabilityMatrix';
import { useShellStatus } from '../app/shell-status';
import { useUserSession } from '../app/user-session';
import { ApiError, getProject } from '../lib/api';
import { buildArtifactTabs, extractKnowledgeCards, summarizeMarkdown } from '../lib/content';
import {
  copyProjectShareSummary,
  downloadProjectBundle,
  downloadProjectShowcase,
} from '../lib/export';
import { getProgressPercent, getStatusLabel } from '../lib/stage';
import type { ProjectDetail } from '../types/api';

export function ShowcasePage() {
  const { projectId = '' } = useParams();
  const { setStatus } = useShellStatus();
  const { isLoading: isSessionLoading } = useUserSession();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [missingProject, setMissingProject] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');

  const artifactTabs = useMemo(() => buildArtifactTabs(project), [project]);
  const knowledgeCards = useMemo(
    () => extractKnowledgeCards(project?.knowledge_cards ?? ''),
    [project?.knowledge_cards],
  );

  useEffect(() => () => setStatus(null), [setStatus]);

  useEffect(() => {
    if (isSessionLoading) {
      return;
    }

    let isActive = true;

    async function loadProject() {
      setIsLoading(true);

      try {
        const nextProject = await getProject(projectId);
        if (!isActive) {
          return;
        }

        setProject(nextProject);
        setMissingProject(false);
        setError('');
      } catch (loadError) {
        if (!isActive || !(loadError instanceof Error)) {
          return;
        }

        if (loadError instanceof ApiError && loadError.status === 404) {
          setMissingProject(true);
          setProject(null);
          setError('');
        } else {
          setError(loadError.message);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadProject();

    return () => {
      isActive = false;
    };
  }, [isSessionLoading, projectId]);

  useEffect(() => {
    if (missingProject) {
      setStatus({
        tone: 'error',
        label: '成果展示不可用',
        detail: '当前后端实例中找不到这个项目。',
      });
      return;
    }

    if (!project && !error) {
      setStatus({
        tone: 'idle',
        label: '正在加载成果展示',
        detail: '正在整理项目摘要、核心产物和学习内容。',
      });
      return;
    }

    if (project) {
      setStatus({
        tone: project.status === 'completed' ? 'success' : 'active',
        label: `成果展示 · ${project.project_name || project.description}`,
        detail:
          project.progress_message ||
          project.status_detail ||
          '项目摘要、追踪图和学习内容已经准备就绪。',
        progress: project.progress_percent ?? getProgressPercent(project),
        href: `/showcase/${project.id}`,
      });
      return;
    }

    if (error) {
      setStatus({
        tone: 'error',
        label: '成果展示加载失败',
        detail: error,
      });
    }
  }, [error, missingProject, project, setStatus]);

  if (isLoading || isSessionLoading) {
    return (
      <div className="glass-panel flex min-h-[420px] items-center justify-center rounded-[32px] p-8 text-sm text-slate-500 dark:text-slate-400">
        正在加载成果展示...
      </div>
    );
  }

  if (missingProject) {
    return (
      <div className="glass-panel rounded-[32px] p-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-rose-700 dark:text-rose-300">
          项目不存在
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
          当前项目已经无法查看
        </h2>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          这个项目可能已经被删除，或者当前后端环境已经重置。你可以先回到项目管理页，重新选择其他项目查看。
        </p>
        <Link
          to="/projects"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
        >
          <FolderOpen className="h-4 w-4" />
          打开项目管理
        </Link>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="rounded-[28px] border border-rose-500/20 bg-rose-500/10 px-6 py-5 text-sm text-rose-700 dark:text-rose-200">
        {error || '成果展示加载失败。'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel-strong rounded-[36px] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white dark:bg-white dark:text-slate-950">
              <Sparkles className="h-3.5 w-3.5" />
              项目成果展示
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
              {project.project_name || project.description}
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
              {project.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {project.template_label ? (
                <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                  {project.template_label}
                </span>
              ) : null}
              {project.template_category ? (
                <span className="rounded-full bg-slate-950/5 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                  {project.template_category}
                </span>
              ) : null}
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                {getStatusLabel(project.status)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to={`/workbench/${project.id}`}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20 dark:hover:text-white"
            >
              <LayoutList className="h-4 w-4" />
              打开工作台
            </Link>
            <button
              type="button"
              onClick={() => downloadProjectShowcase(project)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20 dark:hover:text-white"
            >
              <Sparkles className="h-4 w-4" />
              下载分享页
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await copyProjectShareSummary(project);
                  setCopyFeedback('项目摘要已复制到剪贴板。');
                  window.setTimeout(() => setCopyFeedback(''), 1800);
                } catch {
                  setCopyFeedback('复制失败，请稍后再试。');
                  window.setTimeout(() => setCopyFeedback(''), 1800);
                }
              }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20 dark:hover:text-white"
            >
              <Clipboard className="h-4 w-4" />
              复制分享摘要
            </button>
            <button
              type="button"
              onClick={() => downloadProjectBundle(project)}
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.01] dark:bg-white dark:text-slate-950"
            >
              <Download className="h-4 w-4" />
              导出完整文档
            </button>
          </div>
        </div>

        {copyFeedback ? (
          <div className="mt-5 rounded-[20px] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">
            {copyFeedback}
          </div>
        ) : null}

        <div className="mt-8 grid gap-4 lg:grid-cols-4">
          {[
            { label: '产物数量', value: `${artifactTabs.length}` },
            { label: '知识卡片', value: `${knowledgeCards.length}` },
            { label: '迭代次数', value: `${project.iteration_history?.length ?? 0}` },
            { label: '当前进度', value: `${project.progress_percent ?? getProgressPercent(project)}%` },
          ].map((item) => (
            <article
              key={item.label}
              className="rounded-[24px] border border-white/10 bg-white/75 px-5 py-4 dark:bg-white/5"
            >
              <div className="text-sm text-slate-500 dark:text-slate-400">{item.label}</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                {item.value}
              </div>
            </article>
          ))}
        </div>
      </section>

      <TraceabilityMatrix project={project} compact />

      <IterationDiffPanel project={project} />

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="glass-panel rounded-[32px] p-6 sm:p-8">
          <div className="section-title">核心产物概览</div>
          <p className="section-subtitle mt-2">
            快速浏览这次项目生成过程中最关键的几份交付物。
          </p>

          <div className="mt-6 space-y-4">
            {artifactTabs.length > 0 ? (
              artifactTabs.map((tab) => (
                <article
                  key={tab.key}
                  className="rounded-[24px] border border-white/10 bg-white/75 px-5 py-5 dark:bg-white/5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950 dark:text-white">
                        {tab.label}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {summarizeMarkdown(tab.content, 220)}
                      </p>
                    </div>
                    <Link
                      to={`/workbench/${project.id}`}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white"
                    >
                      查看详情
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-300/80 px-5 py-6 text-sm leading-7 text-slate-500 dark:border-white/10 dark:text-slate-400">
                当前还没有可展示的项目产物。
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="glass-panel rounded-[32px] p-6 sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-pink-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-pink-600 dark:text-pink-300">
              <GraduationCap className="h-3.5 w-3.5" />
              学习收获
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
              {summarizeMarkdown(project.mentor_notes ?? project.description, 320)}
            </p>

            <div className="mt-5 space-y-3">
              {knowledgeCards.slice(0, 4).map((card) => (
                <article
                  key={card.id}
                  className="rounded-[22px] border border-white/10 bg-white/75 px-4 py-4 dark:bg-white/5"
                >
                  <div className="text-sm font-semibold text-slate-950 dark:text-white">
                    {card.title}
                  </div>
                  <div className="mt-1 text-xs font-semibold tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    {card.stage} · {card.concept}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {card.prompt}
                  </p>
                </article>
              ))}
            </div>
          </section>

          {(project.iteration_history?.length ?? 0) > 0 ? (
            <section className="glass-panel rounded-[32px] p-6 sm:p-8">
              <div className="section-title">迭代时间线</div>
              <p className="section-subtitle mt-2">
                记录每一轮迭代需求，方便你展示项目是如何一步步演进的。
              </p>

              <div className="mt-5 space-y-3">
                {(project.iteration_history ?? []).map((entry, index) => (
                  <article
                    key={entry.id}
                    className="rounded-[22px] border border-white/10 bg-white/75 px-4 py-4 dark:bg-white/5"
                  >
                    <div className="text-xs font-semibold tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      第 {index + 1} 轮 · {new Date(entry.created_at).toLocaleString()}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {entry.change_request}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
