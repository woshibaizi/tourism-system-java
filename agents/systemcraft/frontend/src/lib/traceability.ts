import { summarizeMarkdown } from './content';
import type { ArtifactKey, ProjectDetail } from '../types/api';

export interface TraceabilityNode {
  id: string;
  artifactKey: ArtifactKey;
  title: string;
  summary: string;
}

export interface TraceabilityRow {
  id: string;
  requirement?: TraceabilityNode;
  architecture?: TraceabilityNode;
  implementation?: TraceabilityNode;
  testing?: TraceabilityNode;
}

interface ArtifactDescriptor {
  artifactKey: ArtifactKey;
  markdown: string;
  fallbackPrefix: string;
}

const headingPattern = /^(#{1,4})\s+(.+)$/gm;
const listPattern = /^\s*(?:[-*]|\d+\.)\s+(.+)$/gm;

export function buildTraceabilityRows(project?: ProjectDetail | null): TraceabilityRow[] {
  if (!project) {
    return [];
  }

  const requirements = extractTraceabilityNodes({
    artifactKey: 'requirements_doc',
    markdown: project.requirements_doc ?? '',
    fallbackPrefix: '需求项',
  });
  const architecture = extractTraceabilityNodes({
    artifactKey: 'architecture_doc',
    markdown: project.architecture_doc ?? '',
    fallbackPrefix: '架构项',
  });
  const implementation = extractTraceabilityNodes({
    artifactKey: 'code_artifacts',
    markdown: project.code_artifacts ?? '',
    fallbackPrefix: '实现项',
  });
  const testing = extractTraceabilityNodes({
    artifactKey: 'test_report',
    markdown: project.test_report ?? '',
    fallbackPrefix: '测试项',
  });

  const rowCount = Math.max(
    requirements.length,
    architecture.length,
    implementation.length,
    testing.length,
  );

  return Array.from({ length: rowCount }, (_, index) => ({
    id: `trace-row-${index + 1}`,
    requirement: requirements[index],
    architecture: architecture[index],
    implementation: implementation[index],
    testing: testing[index],
  }));
}

export function getTraceabilityCoverage(rows: TraceabilityRow[]) {
  if (rows.length === 0) {
    return {
      totalRows: 0,
      fullyConnectedRows: 0,
      coveragePercent: 0,
    };
  }

  const fullyConnectedRows = rows.filter(
    (row) => row.requirement && row.architecture && row.implementation && row.testing,
  ).length;

  return {
    totalRows: rows.length,
    fullyConnectedRows,
    coveragePercent: Math.round((fullyConnectedRows / rows.length) * 100),
  };
}

function extractTraceabilityNodes({
  artifactKey,
  markdown,
  fallbackPrefix,
}: ArtifactDescriptor): TraceabilityNode[] {
  const normalized = (markdown ?? '').trim();
  if (!normalized) {
    return [];
  }

  const headingNodes = extractHeadingNodes(artifactKey, normalized);
  if (headingNodes.length > 0) {
    return headingNodes;
  }

  const listNodes = extractListNodes(artifactKey, normalized, fallbackPrefix);
  if (listNodes.length > 0) {
    return listNodes;
  }

  return extractParagraphNodes(artifactKey, normalized, fallbackPrefix);
}

function extractHeadingNodes(artifactKey: ArtifactKey, markdown: string): TraceabilityNode[] {
  const matches = Array.from(markdown.matchAll(headingPattern));
  if (matches.length === 0) {
    return [];
  }

  return matches.slice(0, 6).map((match, index) => {
    const title = match[2].trim();
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? markdown.length;
    const body = markdown.slice(start, end).replace(match[0], '').trim();

    return {
      id: `${artifactKey}-heading-${index + 1}`,
      artifactKey,
      title,
      summary: summarizeMarkdown(body || title, 120),
    };
  });
}

function extractListNodes(
  artifactKey: ArtifactKey,
  markdown: string,
  fallbackPrefix: string,
): TraceabilityNode[] {
  const matches = Array.from(markdown.matchAll(listPattern)).slice(0, 6);
  return matches.map((match, index) => ({
    id: `${artifactKey}-list-${index + 1}`,
    artifactKey,
    title: `${fallbackPrefix} ${index + 1}`,
    summary: summarizeMarkdown(match[1].trim(), 120),
  }));
}

function extractParagraphNodes(
  artifactKey: ArtifactKey,
  markdown: string,
  fallbackPrefix: string,
): TraceabilityNode[] {
  return markdown
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((part, index) => ({
      id: `${artifactKey}-paragraph-${index + 1}`,
      artifactKey,
      title: `${fallbackPrefix} ${index + 1}`,
      summary: summarizeMarkdown(part, 120),
    }));
}
