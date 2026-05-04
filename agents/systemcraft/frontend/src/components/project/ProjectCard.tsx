import { ArrowRight, Clock3, ShieldAlert, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getStatusLabel } from '../../lib/stage';
import type { ProjectSummary } from '../../types/api';

interface ProjectCardProps {
  project: ProjectSummary;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const status = getStatusLabel(project.status);
  const statusClassName =
    project.status === 'completed'
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
      : project.status === 'paused'
        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : project.status === 'pausing'
          ? 'bg-orange-500/10 text-orange-700 dark:text-orange-300'
      : project.status === 'error'
        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-300'
        : 'bg-blue-500/10 text-blue-600 dark:text-blue-300';

  const StatusIcon =
    project.status === 'completed' ? Sparkles : project.status === 'error' ? ShieldAlert : Clock3;

  return (
    <Link
      to={`/workbench/${project.id}`}
      className="group glass-panel block rounded-[28px] p-6 transition duration-300 hover:-translate-y-1 hover:shadow-glow"
    >
      <div className="flex items-start justify-between gap-4">
        <span className={`status-pill ${statusClassName}`}>
          <StatusIcon className="h-3.5 w-3.5" />
          {status}
        </span>
        <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-950 dark:group-hover:text-white" />
      </div>

      <h3 className="mt-5 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
        {project.description}
      </h3>

      <div className="mt-6 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>项目 ID · {project.id}</span>
        <span>{project.status_detail || project.difficulty || '未标注难度'}</span>
      </div>
    </Link>
  );
}
