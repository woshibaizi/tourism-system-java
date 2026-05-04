import { summarizeMarkdown } from './content';
import type { ArtifactKey, IterationHistoryItem, ProjectArtifactSnapshot } from '../types/api';

export interface IterationArtifactDiff {
  key: ArtifactKey;
  label: string;
  changed: boolean;
  beforeSummary: string;
  afterSummary: string;
  addedLines: number;
  removedLines: number;
}

export interface IterationDiffResult {
  changeCount: number;
  changedArtifacts: IterationArtifactDiff[];
  allArtifacts: IterationArtifactDiff[];
}

const artifactMeta: Array<{ key: ArtifactKey; label: string }> = [
  { key: 'requirements_doc', label: '需求文档' },
  { key: 'architecture_doc', label: '架构方案' },
  { key: 'code_artifacts', label: '实现产物' },
  { key: 'test_report', label: '测试报告' },
  { key: 'mentor_notes', label: '导师总结' },
  { key: 'knowledge_cards', label: '知识卡片' },
];

export function getLatestComparableIteration(
  iterationHistory: IterationHistoryItem[] | undefined,
): IterationHistoryItem | null {
  return (
    [...(iterationHistory ?? [])]
      .reverse()
      .find((entry) => entry.before_snapshot && entry.after_snapshot) ?? null
  );
}

export function buildIterationDiff(entry?: IterationHistoryItem | null): IterationDiffResult {
  const beforeSnapshot = entry?.before_snapshot ?? {};
  const afterSnapshot = entry?.after_snapshot ?? {};

  const allArtifacts = artifactMeta.map(({ key, label }) => {
    const beforeContent = getSnapshotContent(beforeSnapshot, key);
    const afterContent = getSnapshotContent(afterSnapshot, key);
    const changed = normalizeText(beforeContent) !== normalizeText(afterContent);
    const { addedLines, removedLines } = countLineDelta(beforeContent, afterContent);

    return {
      key,
      label,
      changed,
      beforeSummary: summarizeMarkdown(beforeContent || '这一轮修改前还没有对应内容。', 180),
      afterSummary: summarizeMarkdown(afterContent || '这一轮修改后还没有对应内容。', 180),
      addedLines,
      removedLines,
    };
  });

  const changedArtifacts = allArtifacts.filter((artifact) => artifact.changed);

  return {
    changeCount: changedArtifacts.length,
    changedArtifacts,
    allArtifacts,
  };
}

export function getIterationStatusLabel(status?: string) {
  if (status === 'completed') {
    return '已完成';
  }
  if (status === 'failed') {
    return '失败';
  }
  return '进行中';
}

function getSnapshotContent(snapshot: ProjectArtifactSnapshot, key: ArtifactKey) {
  return snapshot?.[key] ?? '';
}

function normalizeText(value: string) {
  return value.replace(/\r/g, '').trim();
}

function countLineDelta(before: string, after: string) {
  const beforeCounts = buildLineCountMap(before);
  const afterCounts = buildLineCountMap(after);

  let removedLines = 0;
  let addedLines = 0;

  for (const [line, count] of beforeCounts.entries()) {
    const nextCount = afterCounts.get(line) ?? 0;
    if (count > nextCount) {
      removedLines += count - nextCount;
    }
  }

  for (const [line, count] of afterCounts.entries()) {
    const previousCount = beforeCounts.get(line) ?? 0;
    if (count > previousCount) {
      addedLines += count - previousCount;
    }
  }

  return {
    addedLines,
    removedLines,
  };
}

function buildLineCountMap(content: string) {
  const counts = new Map<string, number>();
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  return counts;
}
