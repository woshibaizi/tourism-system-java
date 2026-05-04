import { BarChart3, BrainCircuit, FolderOpenDot } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useUserSession } from '../app/user-session';
import { LearningDeck } from '../components/learning/LearningDeck';
import { getProject, listProjects } from '../lib/api';
import type { ProjectDetail, ProjectSummary } from '../types/api';

export function LearnPage() {
  const { isLoading: isSessionLoading } = useUserSession();
  const [projects, setProjects] = useState<ProjectDetail[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isSessionLoading) {
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError('');

    async function loadLearningData() {
      try {
        const summaries = await listProjects();
        const orderedSummaries = prioritizeSummaries(summaries);
        const details = await Promise.all(
          orderedSummaries.slice(0, 8).map((project) => getProject(project.id)),
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

    void loadLearningData();
    return () => {
      isActive = false;
    };
  }, [isSessionLoading]);

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }

    const nextFrameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });

    return () => {
      window.cancelAnimationFrame(nextFrameId);
    };
  }, [selectedProjectId]);

  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null;

  const totalKnowledgeCards = projects.reduce((count, project) => {
    const matches = (project.knowledge_cards ?? '').match(/^###\s+/gm);
    return count + (matches?.length ?? 0);
  }, 0);

  function handleProjectUpdate(nextProject: ProjectDetail) {
    setProjects((currentProjects) => {
      const existingIndex = currentProjects.findIndex((project) => project.id === nextProject.id);
      if (existingIndex < 0) {
        return currentProjects;
      }

      const nextProjects = [...currentProjects];
      nextProjects[existingIndex] = nextProject;
      return nextProjects;
    });
  }

  if (isLoading || isSessionLoading) {
    return (
      <div className="glass-panel flex min-h-[420px] items-center justify-center rounded-[32px] p-8 text-sm text-slate-500 dark:text-slate-400">
        正在整理学习中心数据...
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

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: '收录项目', value: projects.length, icon: FolderOpenDot },
          {
            label: '完成项目',
            value: projects.filter((project) => project.status === 'completed').length,
            icon: BarChart3,
          },
          { label: '知识卡片', value: totalKnowledgeCards, icon: BrainCircuit },
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

      <section className="glass-panel rounded-[32px] p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="section-title">学习中心</div>
            <p className="section-subtitle mt-2">
              集中查看导师总结、知识卡片，并在项目完成后继续向导师追问不理解的知识点。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => setSelectedProjectId(project.id)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  selectedProject?.id === project.id
                    ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                    : 'border border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white'
                }`}
              >
                {project.project_name || project.description.slice(0, 18)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <LearningDeck project={selectedProject} onProjectUpdate={handleProjectUpdate} />
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
