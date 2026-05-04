import type { ArtifactKey, ProjectDetail, ProjectSummary } from '../types/api';

export interface StageDefinition {
  id: string;
  role: string;
  label: string;
  agentName: string;
  summary: string;
  artifactKey: ArtifactKey;
  color: string;
}

export const stageDefinitions: StageDefinition[] = [
  {
    id: 'requirements_analysis',
    role: 'pm',
    label: '需求分析',
    agentName: 'PM Agent',
    summary: '把自然语言需求拆成结构化规格、用户角色和核心用例。',
    artifactKey: 'requirements_doc',
    color: '#6366f1',
  },
  {
    id: 'architecture_design',
    role: 'architect',
    label: '架构设计',
    agentName: 'Arch Agent',
    summary: '输出技术选型、模块拆分、数据库方案与 API 设计。',
    artifactKey: 'architecture_doc',
    color: '#0ea5e9',
  },
  {
    id: 'development',
    role: 'developer',
    label: '开发实现',
    agentName: 'Dev Agent',
    summary: '根据架构方案生成核心代码、配置与关键接口实现。',
    artifactKey: 'code_artifacts',
    color: '#22c55e',
  },
  {
    id: 'testing',
    role: 'qa',
    label: '测试评审',
    agentName: 'QA Agent',
    summary: '设计测试用例、评审代码质量，并决定是否需要返工。',
    artifactKey: 'test_report',
    color: '#f59e0b',
  },
  {
    id: 'mentor_review',
    role: 'mentor',
    label: '导师总结',
    agentName: 'Mentor Agent',
    summary: '沉淀学习笔记、知识卡片与后续提升建议。',
    artifactKey: 'mentor_notes',
    color: '#ec4899',
  },
];

export const difficultyMeta = {
  easy: { label: '入门级', description: '更适合课程作业和小型练习。' },
  medium: { label: '进阶级', description: '覆盖完整软件工程流程。' },
  hard: { label: '挑战级', description: '适合更复杂的边界、模块与质量要求。' },
};

export function getStageMeta(stageId?: string) {
  if (stageId === 'completed') {
    return stageDefinitions[stageDefinitions.length - 1];
  }

  return stageDefinitions.find((stage) => stage.id === stageId) ?? stageDefinitions[0];
}

export function getStagePosition(stageId?: string) {
  if (!stageId || stageId === 'init') {
    return 0;
  }

  if (stageId === 'completed') {
    return stageDefinitions.length;
  }

  const index = stageDefinitions.findIndex((stage) => stage.id === stageId);
  return index >= 0 ? index + 1 : 0;
}

export function getProgressPercent(project?: ProjectSummary | ProjectDetail | null) {
  if (!project) {
    return 0;
  }

  if (project.status === 'completed') {
    return 100;
  }

  return Math.round((getStagePosition(project.current_stage) / stageDefinitions.length) * 100);
}

export function getStatusLabel(status?: string) {
  if (status === 'queued') {
    return '排队中';
  }

  if (status === 'pausing') {
    return '暂停中';
  }

  if (status === 'paused') {
    return '已暂停';
  }

  if (status === 'completed') {
    return '已完成';
  }

  if (status === 'error') {
    return '异常';
  }

  return '进行中';
}

export function isProjectActive(status?: string) {
  return ['queued', 'running', 'pausing', 'paused'].includes(status ?? '');
}

export function getStageArtifactKey(stageId?: string) {
  return getStageMeta(stageId).artifactKey;
}
