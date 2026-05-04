import {
  CheckSquare,
  Download,
  FileArchive,
  Files,
  FolderOutput,
  Square,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useUserSession } from '../app/user-session';
import { getProject, listProjects } from '../lib/api';
import { buildArtifactTabs, summarizeMarkdown } from '../lib/content';
import { downloadProjectBundle, downloadProjectSelection } from '../lib/export';
import type { ArtifactKey, ProjectDetail, ProjectSummary } from '../types/api';

export function ExportPage() {
  const { isLoading: isSessionLoading } = useUserSession();
  const [projects, setProjects] = useState<ProjectDetail[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<ArtifactKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isSessionLoading) {
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError('');

    async function loadExportData() {
      try {
        const summaries = await listProjects();
        const orderedSummaries = prioritizeSummaries(summaries);
        const details = await Promise.all(
          orderedSummaries.slice(0, 12).map((project) => getProject(project.id)),
        );

        if (!isActive) {
          return;
        }

        setProjects(details);
        setSelectedProjectId((currentId) =>
          details.some((project) => project.id === currentId) ? currentId : details[0]?.id || '',
        );
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

    void loadExportData();
    return () => {
      isActive = false;
    };
  }, [isSessionLoading]);

  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null;
  const tabs = useMemo(() => buildArtifactTabs(selectedProject), [selectedProject]);
  const totalExportableSections = useMemo(
    () => projects.reduce((total, project) => total + buildArtifactTabs(project).length, 0),
    [projects],
  );

  useEffect(() => {
    setSelectedKeys(tabs.map((tab) => tab.key));
  }, [selectedProject?.id, tabs]);

  function toggleKey(key: ArtifactKey) {
    setSelectedKeys((currentKeys) =>
      currentKeys.includes(key)
        ? currentKeys.filter((currentKey) => currentKey !== key)
        : [...currentKeys, key],
    );
  }

  if (isLoading || isSessionLoading) {
    return (
      <div className="glass-panel flex min-h-[420px] items-center justify-center rounded-[32px] p-8 text-sm text-slate-500 dark:text-slate-400">
        正在整理可导出的项目文档...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[28px] border border-rose-500/20 bg-rose-500/10 px-6 py-5 text-sm text-rose-700 dark:text-rose-200">
        {error}
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="glass-panel rounded-[32px] p-8 text-sm leading-7 text-slate-500 dark:text-slate-400">
        还没有可以导出的项目。先去首页创建一个项目，等工作流生成出文档后，这里就会自动出现导出项。
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: '可选项目', value: projects.length, icon: FolderOutput },
          {
            label: '已完成项目',
            value: projects.filter((project) => project.status === 'completed').length,
            icon: FileArchive,
          },
          { label: '导出模块', value: totalExportableSections, icon: Files },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="glass-panel rounded-[28px] p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-white dark:text-slate-950">
              <Icon className="h-5 w-5" />
            </div>
            <div className="mt-5 text-3xl font-semibold text-slate-950 dark:text-white">{value}</div>
            <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{label}</div>
          </div>
        ))}
      </section>

      <section className="glass-panel-strong rounded-[32px] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white dark:bg-white dark:text-slate-950">
              <Download className="h-3.5 w-3.5" />
              Export Center
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
              勾选你要的模块，一键导出整套项目文档
            </h2>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              这里对应规划书里的“文档导出模块”。你可以导出完整 bundle，也可以只勾选需求、架构、代码、测试或知识卡片，生成一份更适合课程作业和汇报展示的 Markdown 文档。
            </p>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/70 px-5 py-4 dark:bg-white/5">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              当前项目
            </div>
            <div className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">
              {selectedProject.project_name || selectedProject.description}
            </div>
            <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              已选 {selectedKeys.length} / {tabs.length} 个模块
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <section className="glass-panel rounded-[32px] p-6 sm:p-8">
          <div>
            <div className="section-title">选择项目</div>
            <p className="section-subtitle mt-2">
              已完成项目会优先排在前面。切换项目后，下面的导出模块会自动同步。
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => setSelectedProjectId(project.id)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  selectedProject.id === project.id
                    ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                    : 'border border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white'
                }`}
              >
                {project.project_name || project.description.slice(0, 18)}
              </button>
            ))}
          </div>

          <div className="mt-8 space-y-4">
            {tabs.map((tab) => {
              const checked = selectedKeys.includes(tab.key);
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => toggleKey(tab.key)}
                  className={`flex w-full items-start justify-between gap-4 rounded-[24px] border px-5 py-4 text-left transition ${
                    checked
                      ? 'border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950'
                      : 'border-slate-200 bg-white/75 text-slate-700 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      {checked ? (
                        <CheckSquare className="h-4.5 w-4.5 shrink-0" />
                      ) : (
                        <Square className="h-4.5 w-4.5 shrink-0" />
                      )}
                      <span className="text-sm font-semibold">{tab.label}</span>
                    </div>
                    <p
                      className={`mt-3 text-sm leading-6 ${
                        checked
                          ? 'text-white/82 dark:text-slate-700'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {tab.description}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                      checked
                        ? 'bg-white/15 text-white dark:bg-slate-950/10 dark:text-slate-700'
                        : 'bg-slate-950/5 text-slate-500 dark:bg-white/10 dark:text-slate-400'
                    }`}
                  >
                    {tab.content.trim().length} chars
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="glass-panel rounded-[28px] p-6">
            <div className="section-title">导出动作</div>
            <p className="section-subtitle mt-2">
              适合课程作业提交、项目展示、阶段汇报和复盘归档。
            </p>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => downloadProjectSelection(selectedProject, selectedKeys)}
                disabled={selectedKeys.length === 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950"
              >
                <Download className="h-4 w-4" />
                导出已勾选模块
              </button>

              <button
                type="button"
                onClick={() => downloadProjectBundle(selectedProject)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20"
              >
                <FileArchive className="h-4 w-4" />
                导出完整 Bundle
              </button>
            </div>

            <div className="mt-6 rounded-[24px] border border-dashed border-slate-300/80 px-4 py-4 text-sm leading-6 text-slate-500 dark:border-white/10 dark:text-slate-400">
              导出格式当前为 Markdown，已经适合继续转 PDF、提交课程作业或放入项目仓库留档。
            </div>
          </section>

          <section className="glass-panel rounded-[28px] p-6">
            <div className="section-title">导出预览</div>
            <div className="mt-5 space-y-3">
              {tabs
                .filter((tab) => selectedKeys.includes(tab.key))
                .map((tab) => (
                  <article
                    key={tab.key}
                    className="rounded-[22px] border border-white/10 bg-white/70 px-4 py-4 dark:bg-white/5"
                  >
                    <div className="text-sm font-semibold text-slate-950 dark:text-white">
                      {tab.label}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                      {summarizeMarkdown(tab.content, 140)}
                    </p>
                  </article>
                ))}

              {selectedKeys.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-slate-300/80 px-4 py-5 text-sm leading-6 text-slate-500 dark:border-white/10 dark:text-slate-400">
                  还没有勾选任何模块。先从左侧选择你想导出的内容。
                </div>
              ) : null}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}

function prioritizeSummaries(summaries: ProjectSummary[]) {
  return [...summaries].sort((left, right) => {
    if (left.status === right.status) {
      return 0;
    }

    if (left.status === 'completed') {
      return -1;
    }

    if (right.status === 'completed') {
      return 1;
    }

    return 0;
  });
}
