import type { ArtifactTab, KnowledgeCard, ProjectDetail } from '../types/api';

export interface MarkdownHeading {
  id: string;
  text: string;
  level: number;
}

export function buildArtifactTabs(project?: ProjectDetail | null): ArtifactTab[] {
  if (!project) {
    return [];
  }

  const tabs: ArtifactTab[] = [
    {
      key: 'requirements_doc',
      label: '需求文档',
      description: 'PM Agent 输出的结构化需求、角色和核心用例。',
      content: project.requirements_doc ?? '',
    },
    {
      key: 'architecture_doc',
      label: '架构方案',
      description: '架构师给出的技术选型、模块拆分、数据库与接口设计。',
      content: project.architecture_doc ?? '',
    },
    {
      key: 'code_artifacts',
      label: '代码产物',
      description: '开发工程师整理的项目结构、核心逻辑与接口实现。',
      content: project.code_artifacts ?? '',
    },
    {
      key: 'test_report',
      label: '测试报告',
      description: 'QA 的测试结论、问题清单和回归结果。',
      content: project.test_report ?? '',
    },
    {
      key: 'mentor_notes',
      label: '导师总结',
      description: '学习复盘、关键决策说明与改进建议。',
      content: project.mentor_notes ?? '',
    },
    {
      key: 'knowledge_cards',
      label: '知识卡片',
      description: '适合复习和延展思考的分阶段知识点卡片。',
      content: project.knowledge_cards ?? '',
    },
  ];

  return tabs.filter((tab) => tab.content.trim().length > 0);
}

export function extractKnowledgeCards(markdown: string): KnowledgeCard[] {
  if (!markdown.trim()) {
    return [];
  }

  const sections = markdown
    .split(/\n(?=###\s+)/g)
    .filter((section) => section.trim().startsWith('###'));

  if (sections.length === 0) {
    return [
      {
        id: 'card-1',
        title: '学习摘要',
        stage: 'Overall',
        concept: '软件工程复盘',
        prompt: '结合这个项目，重新梳理一次需求、架构、开发与测试之间的因果链。',
        hasThinkingQuestion: true,
        markdown,
      },
    ];
  }

  return sections.map((section, index) => {
    const lines = section.trim().split('\n');
    const title = lines[0].replace(/^###\s*/, '').trim();
    const stage = captureField(section, 'Stage') ?? 'Overall';
    const concept = captureField(section, 'Concept') ?? '关键概念';
    const source = captureField(section, 'Source') ?? undefined;
    const explicitPrompt = captureField(section, 'Thinking Question') ?? '';
    const isFollowUpCard =
      stage.trim().toLowerCase() === 'follow-up' ||
      (source ?? '').trim().toLowerCase().includes('follow-up');
    const hasThinkingQuestion = !isFollowUpCard && Boolean(explicitPrompt.trim());
    const prompt = hasThinkingQuestion
      ? explicitPrompt.trim()
      : isFollowUpCard
        ? ''
        : '尝试把这个概念迁移到你正在做的课程项目中。';

    return {
      id: `card-${index + 1}`,
      title,
      stage,
      concept,
      prompt,
      hasThinkingQuestion: !isFollowUpCard && Boolean(prompt.trim()),
      source,
      markdown: section.trim(),
    };
  });
}

export function stripMarkdown(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, '代码片段')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[[^\]]+\]\(([^)]+)\)/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/\r/g, '')
    .trim();
}

export function summarizeMarkdown(markdown: string, maxLength = 160) {
  const plainText = stripMarkdown(markdown).replace(/\n+/g, ' ');
  if (plainText.length <= maxLength) {
    return plainText;
  }

  return `${plainText.slice(0, maxLength).trim()}...`;
}

export function slugifyHeading(text: string) {
  const cleaned = text
    .toLowerCase()
    .trim()
    .replace(/[`*_~]/g, '')
    .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return cleaned || 'section';
}

function captureField(markdown: string, field: string) {
  const regex = new RegExp(`\\*\\*${field}\\*\\*:\\s*(.+)`, 'i');
  return markdown.match(regex)?.[1]?.trim();
}
