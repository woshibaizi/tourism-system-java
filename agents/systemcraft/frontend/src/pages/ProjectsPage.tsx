import {
  ArrowUpRight,
  FolderKanban,
  LayoutList,
  PencilLine,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteProject, listProjects, updateProject } from '../lib/api';
import { getStageMeta, getStatusLabel, isProjectActive } from '../lib/stage';
import type { ProjectStatus, ProjectSummary } from '../types/api';

const statusFilters: Array<{ label: string; value: 'all' | ProjectStatus }> = [
  { label: '全部项目', value: 'all' },
  { label: '进行中', value: 'running' },
  { label: '已暂停', value: 'paused' },
  { label: '已完成', value: 'completed' },
  { label: '异常', value: 'error' },
];

export function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [deletingProjectId, setDeletingProjectId] = useState('');
  const [editingProjectId, setEditingProjectId] = useState('');
  const [projectNameDraft, setProjectNameDraft] = useState('');
  const [savingProjectId, setSavingProjectId] = useState('');

  const loadProjects = useCallback(async (mode: 'initial' | 'refresh' = 'refresh') => {
    if (mode === 'initial') {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const result = await listProjects();
      setProjects(result);
      setError('');
    } catch (loadError) {
      if (loadError instanceof Error) {
        setError(loadError.message);
      }
    } finally {
      if (mode === 'initial') {
        setIsLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    async function startLoad() {
      await loadProjects('initial');
    }

    void startLoad();

    const intervalId = window.setInterval(() => {
      if (isActive) {
        void loadProjects('refresh');
      }
    }, 5000);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [loadProjects]);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'running'
            ? isProjectActive(project.status)
            : project.status === statusFilter;
      const matchesQuery = normalizedQuery
        ? `${project.project_name ?? ''} ${project.description} ${project.id}`
            .toLowerCase()
            .includes(normalizedQuery)
        : true;
      return matchesStatus && matchesQuery;
    });
  }, [projects, query, statusFilter]);

  function beginRename(project: ProjectSummary) {
    setEditingProjectId(project.id);
    setProjectNameDraft(project.project_name || project.description);
    setError('');
  }

  function cancelRename() {
    setEditingProjectId('');
    setProjectNameDraft('');
  }

  async function handleRenameProject(project: ProjectSummary) {
    const nextName = projectNameDraft.trim();
    if (!nextName) {
      setError('项目名称不能为空。');
      return;
    }

    setSavingProjectId(project.id);
    setError('');

    try {
      const updatedProject = await updateProject(project.id, {
        project_name: nextName,
      });
      setProjects((currentProjects) =>
        currentProjects.map((currentProject) =>
          currentProject.id === project.id
            ? {
                ...currentProject,
                ...updatedProject,
              }
            : currentProject,
        ),
      );
      cancelRename();
    } catch (renameError) {
      if (renameError instanceof Error) {
        setError(renameError.message);
      }
    } finally {
      setSavingProjectId('');
    }
  }

  async function handleDeleteProject(project: ProjectSummary) {
    if (isProjectActive(project.status)) {
      return;
    }

    const confirmed = window.confirm(
      `确定删除项目“${project.project_name || project.description}”吗？此操作无法撤销。`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingProjectId(project.id);
    setError('');

    try {
      await deleteProject(project.id);
      setProjects((currentProjects) =>
        currentProjects.filter((currentProject) => currentProject.id !== project.id),
      );
    } catch (deleteError) {
      if (deleteError instanceof Error) {
        setError(deleteError.message);
      }
    } finally {
      setDeletingProjectId('');
    }
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel-strong rounded-[32px] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white dark:bg-white dark:text-slate-950">
              <FolderKanban className="h-3.5 w-3.5" />
              Project Management
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
              管理你的全部项目
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              在这里可以搜索、筛选、重命名、继续打开或删除项目。运行中的项目会自动刷新状态。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: '总项目数', value: projects.length },
              {
                label: '进行中',
                value: projects.filter((project) => isProjectActive(project.status)).length,
              },
              {
                label: '已完成',
                value: projects.filter((project) => project.status === 'completed').length,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[24px] border border-white/10 bg-white/70 px-5 py-4 dark:bg-white/5"
              >
                <div className="text-sm text-slate-500 dark:text-slate-400">{item.label}</div>
                <div className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-[32px] p-6 sm:p-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative max-w-[460px] flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索项目名称、需求或 ID"
              className="w-full rounded-full border border-slate-200 bg-white/80 py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition focus:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:border-white/20"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {statusFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  statusFilter === filter.value
                    ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                    : 'border border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white'
                }`}
              >
                {filter.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => void loadProjects('refresh')}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20 dark:hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-5 rounded-[22px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-[132px] animate-pulse rounded-[24px] border border-slate-200/70 bg-white/60 dark:border-white/10 dark:bg-white/5"
              />
            ))
          ) : filteredProjects.length > 0 ? (
            filteredProjects.map((project) => {
              const stageMeta = getStageMeta(project.current_stage);
              const canDelete = !isProjectActive(project.status);
              const isDeleting = deletingProjectId === project.id;
              const isEditing = editingProjectId === project.id;
              const isSaving = savingProjectId === project.id;

              return (
                <article
                  key={project.id}
                  className="rounded-[26px] border border-white/10 bg-white/70 px-5 py-5 dark:bg-white/5"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="status-pill bg-slate-950/6 text-slate-600 dark:bg-white/10 dark:text-slate-300">
                          {getStatusLabel(project.status)}
                        </span>
                        {project.template_label ? (
                          <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                            {project.template_label}
                          </span>
                        ) : null}
                        <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                          {stageMeta.label}
                        </span>
                        <span className="rounded-full bg-slate-950/5 px-3 py-1 text-xs text-slate-500 dark:bg-white/10 dark:text-slate-400">
                          {project.updated_at ? new Date(project.updated_at).toLocaleString() : '刚刚更新'}
                        </span>
                      </div>

                      {isEditing ? (
                        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                          <input
                            value={projectNameDraft}
                            onChange={(event) => setProjectNameDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                void handleRenameProject(project);
                              }
                              if (event.key === 'Escape') {
                                event.preventDefault();
                                cancelRename();
                              }
                            }}
                            className="w-full max-w-[460px] rounded-[18px] border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:border-white/20"
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void handleRenameProject(project)}
                              disabled={isSaving}
                              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950"
                            >
                              <Save className="h-4 w-4" />
                              {isSaving ? '保存中...' : '保存'}
                            </button>
                            <button
                              type="button"
                              onClick={cancelRename}
                              disabled={isSaving}
                              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20 dark:hover:text-white"
                            >
                              <X className="h-4 w-4" />
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">
                          {project.project_name || project.description}
                        </div>
                      )}

                      <div className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {project.progress_message || project.status_detail || project.description}
                      </div>
                      <div className="mt-2 text-xs text-slate-400">ID · {project.id}</div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {!isEditing ? (
                        <button
                          type="button"
                          onClick={() => beginRename(project)}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20 dark:hover:text-white"
                        >
                          <PencilLine className="h-4 w-4" />
                          重命名
                        </button>
                      ) : null}

                      {project.status === 'completed' ? (
                        <Link
                          to={`/showcase/${project.id}`}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20 dark:hover:text-white"
                        >
                          <Sparkles className="h-4 w-4" />
                          成果展示
                        </Link>
                      ) : null}

                      <Link
                        to={`/workbench/${project.id}`}
                        className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.01] dark:bg-white dark:text-slate-950"
                      >
                        <LayoutList className="h-4 w-4" />
                        打开工作台
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>

                      <button
                        type="button"
                        disabled={!canDelete || isDeleting}
                        onClick={() => void handleDeleteProject(project)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-rose-300 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-rose-400/30 dark:hover:text-rose-300"
                      >
                        <Trash2 className="h-4 w-4" />
                        {isDeleting ? '删除中...' : '删除项目'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-[24px] border border-dashed border-slate-300/80 px-6 py-14 text-center text-sm leading-7 text-slate-500 dark:border-white/10 dark:text-slate-400">
              当前筛选条件下没有项目。可以回到首页创建一个新的项目。
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
