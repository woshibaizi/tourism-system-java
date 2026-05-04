import { ArrowRight, FolderKanban, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useShellStatus } from '../app/shell-status';
import { createProject, listProjects } from '../lib/api';
import { getProgressPercent, getStageMeta, getStatusLabel, isProjectActive } from '../lib/stage';
import type { ProjectCreateRequest, ProjectSummary } from '../types/api';
import { NewProjectPanel } from '../components/project/NewProjectPanel';

export function HomePage() {
  const navigate = useNavigate();
  const { setStatus } = useShellStatus();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isActive = true;

    async function loadProjects() {
      try {
        const result = await listProjects();
        if (isActive) {
          setProjects(result);
          setError('');
        }
      } catch (loadError) {
        if (isActive && loadError instanceof Error) {
          setError(loadError.message);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadProjects();
    return () => {
      isActive = false;
    };
  }, []);

  const activeProject = projects.find((project) => isProjectActive(project.status));
  const recentProjects = [...projects]
    .sort((left, right) => {
      const leftTime = left.updated_at ? new Date(left.updated_at).getTime() : 0;
      const rightTime = right.updated_at ? new Date(right.updated_at).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, 3);
  const disabledReason = activeProject
    ? `当前已有项目正在执行或暂停：${activeProject.description}。请先继续处理当前项目。`
    : '';

  useEffect(() => () => setStatus(null), [setStatus]);

  useEffect(() => {
    if (!activeProject) {
      setStatus({
        tone: 'idle',
        label: '系统已就绪',
        detail: '输入一句需求，系统会自动组织多 Agent 协作流程。',
      });
      return;
    }

    const stageMeta = getStageMeta(activeProject.current_stage);
    setStatus({
      tone: activeProject.status === 'paused' ? 'paused' : 'active',
      label: `${getStatusLabel(activeProject.status)} · ${stageMeta.label}`,
      detail: activeProject.progress_message || activeProject.status_detail || activeProject.description,
      progress: activeProject.progress_percent ?? getProgressPercent(activeProject),
      href: `/workbench/${activeProject.id}`,
    });
  }, [activeProject, setStatus]);

  async function handleCreateProject(payload: ProjectCreateRequest) {
    if (activeProject) {
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const project = await createProject(payload);
      navigate(`/workbench/${project.id}`, { state: { project } });
    } catch (submitError) {
      if (submitError instanceof Error) {
        setError(submitError.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-10">
      <section className="flex min-h-[66vh] items-center justify-center">
        <div className="w-full max-w-[960px]">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/85 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <Sparkles className="h-3.5 w-3.5" />
              SystemCraft
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-[3.2rem] sm:leading-[1.08]">
              今天想做什么项目？
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-slate-500 dark:text-slate-400">
              输入一句需求，系统会自动拆解、协作并交付完整结果。
            </p>
          </div>

          {activeProject ? (
            <div className="mt-6 w-full rounded-[22px] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
              <div className="font-medium">当前已有项目正在执行</div>
              <div className="mt-1 leading-6 opacity-90">
                {activeProject.progress_message || activeProject.status_detail || activeProject.description}
              </div>
              <Link
                to={`/workbench/${activeProject.id}`}
                className="mt-2 inline-flex items-center gap-2 font-semibold text-amber-800 transition hover:opacity-80 dark:text-amber-100"
              >
                继续当前工作台
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : null}

          <div className="mt-8">
            <NewProjectPanel
              isSubmitting={isSubmitting}
              disabled={Boolean(activeProject)}
              disabledReason={disabledReason}
              onCreate={handleCreateProject}
            />
          </div>

          {error ? (
            <div className="mt-4 w-full rounded-[24px] border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-700 dark:text-rose-200">
              {error}
            </div>
          ) : null}
        </div>
      </section>

      <section className="mx-auto max-w-[960px]">
        <div className="rounded-[28px] border border-slate-200/70 bg-white/58 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)] backdrop-blur dark:border-white/10 dark:bg-white/5 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-950 dark:text-white">最近项目</div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                首页只保留最核心的开始入口，完整管理请前往项目管理页。
              </p>
            </div>

            <Link
              to="/projects"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20 dark:hover:text-white"
            >
              <FolderKanban className="h-4 w-4" />
              项目管理
            </Link>
          </div>

          <div className="mt-4 space-y-2">
            {isLoading ? (
              <div className="rounded-[22px] border border-dashed border-slate-300/80 px-4 py-5 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                正在加载项目列表...
              </div>
            ) : recentProjects.length > 0 ? (
              recentProjects.map((project) => (
                <Link
                  key={project.id}
                  to={`/workbench/${project.id}`}
                  className="flex flex-col gap-2.5 rounded-[20px] border border-transparent bg-slate-950/[0.025] px-4 py-3.5 transition hover:border-slate-200 hover:bg-white hover:shadow-[0_10px_24px_rgba(15,23,42,0.04)] dark:bg-white/[0.03] dark:hover:border-white/10 dark:hover:bg-white/[0.06]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                        {project.project_name || project.description}
                      </div>
                      <div className="mt-1 line-clamp-1 text-sm text-slate-500 dark:text-slate-400">
                        {project.description}
                      </div>
                    </div>

                    <span className="rounded-full bg-slate-950/6 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                      {getStatusLabel(project.status)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    {project.template_label ? (
                      <span className="rounded-full bg-white/80 px-2.5 py-1 dark:bg-white/8">
                        {project.template_label}
                      </span>
                    ) : null}
                    {project.updated_at ? (
                      <span>
                        更新于{' '}
                        {new Date(project.updated_at).toLocaleString('zh-CN', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    ) : null}
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-slate-300/80 px-4 py-5 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                还没有历史项目。上面输入一句需求，就可以开始第一个项目。
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
