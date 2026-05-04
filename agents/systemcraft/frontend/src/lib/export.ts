import { buildArtifactTabs, extractKnowledgeCards, summarizeMarkdown } from './content';
import { buildTraceabilityRows, getTraceabilityCoverage } from './traceability';
import type { ArtifactKey, ProjectDetail } from '../types/api';

export function downloadProjectBundle(project: ProjectDetail) {
  const title = project.project_name?.trim() || `systemcraft-${project.id}`;
  const content = createProjectBundle(project);
  downloadFile(`${sanitizeFilename(title)}-bundle.md`, content, 'text/markdown;charset=utf-8');
}

export function downloadProjectSelection(project: ProjectDetail, selectedKeys: ArtifactKey[]) {
  const title = project.project_name?.trim() || `systemcraft-${project.id}`;
  const content = createProjectBundle(project, selectedKeys);
  downloadFile(`${sanitizeFilename(title)}-selected.md`, content, 'text/markdown;charset=utf-8');
}

export function downloadProjectShowcase(project: ProjectDetail) {
  const title = project.project_name?.trim() || `systemcraft-${project.id}`;
  const content = createProjectShowcaseHtml(project);
  downloadFile(`${sanitizeFilename(title)}-showcase.html`, content, 'text/html;charset=utf-8');
}

export function copyProjectShareSummary(project: ProjectDetail) {
  const content = createProjectShareSummary(project);
  return navigator.clipboard.writeText(content);
}

export function downloadTextFile(filename: string, content: string) {
  downloadFile(filename, content, 'text/markdown;charset=utf-8');
}

export function createProjectBundle(project: ProjectDetail, selectedKeys?: ArtifactKey[]) {
  const allowedKeys = selectedKeys?.length ? new Set(selectedKeys) : null;
  const selectedTabs = buildArtifactTabs(project).filter(
    (tab) => !allowedKeys || allowedKeys.has(tab.key),
  );
  const sections = selectedTabs
    .map((tab) => `## ${tab.label}\n\n${tab.content.trim()}`)
    .join('\n\n---\n\n');

  return [
    `# ${project.project_name || 'SystemCraft 项目导出'}`,
    '',
    `- 项目 ID: ${project.id}`,
    `- 难度: ${project.difficulty}`,
    `- 状态: ${project.status}`,
    `- 迭代轮次: ${project.iteration_count}`,
    '',
    '## 原始需求',
    '',
    project.description,
    '',
    '---',
    '',
    sections,
  ].join('\n');
}

export function createProjectShareSummary(project: ProjectDetail) {
  const artifactTabs = buildArtifactTabs(project);
  const knowledgeCards = extractKnowledgeCards(project.knowledge_cards ?? '');
  const traceabilityCoverage = getTraceabilityCoverage(buildTraceabilityRows(project));

  return [
    `${project.project_name || 'SystemCraft 项目'} (${project.id})`,
    `状态：${project.status}`,
    project.template_label ? `模板：${project.template_label}` : '',
    `需求：${project.description}`,
    artifactTabs[0] ? `核心产物：${summarizeMarkdown(artifactTabs[0].content, 160)}` : '',
    `产物数量：${artifactTabs.length}`,
    `知识卡片：${knowledgeCards.length}`,
    `追踪覆盖率：${traceabilityCoverage.coveragePercent}%`,
    `迭代次数：${project.iteration_history?.length ?? 0}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function createProjectShowcaseHtml(project: ProjectDetail) {
  const artifactTabs = buildArtifactTabs(project);
  const knowledgeCards = extractKnowledgeCards(project.knowledge_cards ?? '');
  const traceabilityRows = buildTraceabilityRows(project);
  const traceabilityCoverage = getTraceabilityCoverage(traceabilityRows);

  const deliverableCards = artifactTabs
    .map(
      (tab) => `
        <article class="card">
          <div class="chip">${escapeHtml(tab.label)}</div>
          <h3>${escapeHtml(tab.label)}</h3>
          <p>${escapeHtml(summarizeMarkdown(tab.content, 280))}</p>
        </article>
      `,
    )
    .join('');

  const knowledgeCardsHtml = knowledgeCards
    .slice(0, 6)
    .map(
      (card) => `
        <article class="card">
          <div class="eyebrow">${escapeHtml(card.stage)} · ${escapeHtml(card.concept)}</div>
          <h3>${escapeHtml(card.title)}</h3>
          <p>${escapeHtml(card.prompt)}</p>
        </article>
      `,
    )
    .join('');

  const traceabilityHtml = traceabilityRows
    .slice(0, 4)
    .map(
      (row, index) => `
        <article class="trace-row">
          <div class="trace-index">第 ${index + 1} 行</div>
          <div class="trace-grid">
            ${renderTraceCell('需求', row.requirement?.summary)}
            ${renderTraceCell('架构', row.architecture?.summary)}
            ${renderTraceCell('实现', row.implementation?.summary)}
            ${renderTraceCell('测试', row.testing?.summary)}
          </div>
        </article>
      `,
    )
    .join('');

  const revisionsHtml = (project.iteration_history ?? [])
    .map(
      (entry, index) => `
        <article class="timeline-item">
          <div class="eyebrow">第 ${index + 1} 轮迭代</div>
          <h3>${escapeHtml(entry.change_request)}</h3>
          <p>${escapeHtml(
            entry.completed_at
              ? `完成于 ${new Date(entry.completed_at).toLocaleString()}`
              : `创建于 ${new Date(entry.created_at).toLocaleString()}`,
          )}</p>
        </article>
      `,
    )
    .join('');

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(project.project_name || project.description)}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5f7fb;
        --panel: rgba(255,255,255,0.92);
        --border: rgba(148,163,184,0.25);
        --text: #0f172a;
        --muted: #475569;
        --soft: #64748b;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, "Noto Sans SC", system-ui, sans-serif;
        background:
          radial-gradient(circle at top left, rgba(14,165,233,0.12), transparent 24%),
          radial-gradient(circle at top right, rgba(34,197,94,0.12), transparent 22%),
          var(--bg);
        color: var(--text);
      }
      .page {
        max-width: 1200px;
        margin: 0 auto;
        padding: 32px 20px 48px;
      }
      .hero, .panel {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 28px;
        backdrop-filter: blur(12px);
      }
      .hero {
        padding: 28px;
        box-shadow: 0 24px 60px rgba(15,23,42,0.08);
      }
      .chip, .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.18em;
        color: var(--soft);
      }
      .hero h1 {
        margin: 18px 0 12px;
        font-size: 40px;
        line-height: 1.1;
      }
      .hero p {
        margin: 0;
        font-size: 15px;
        line-height: 1.8;
        color: var(--muted);
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 20px;
      }
      .pill {
        border-radius: 999px;
        padding: 9px 14px;
        background: rgba(15,23,42,0.05);
        font-size: 12px;
        font-weight: 700;
        color: var(--muted);
      }
      .section {
        margin-top: 20px;
      }
      .section .panel {
        padding: 24px;
      }
      .section h2 {
        margin: 0 0 10px;
        font-size: 24px;
      }
      .section p.lead {
        margin: 0 0 20px;
        color: var(--muted);
        line-height: 1.8;
      }
      .grid {
        display: grid;
        gap: 16px;
      }
      .stats {
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }
      .cards {
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      }
      .card, .timeline-item, .trace-row {
        border-radius: 22px;
        border: 1px solid var(--border);
        background: rgba(255,255,255,0.82);
        padding: 18px;
      }
      .card h3, .timeline-item h3 {
        margin: 12px 0 10px;
        font-size: 17px;
      }
      .card p, .timeline-item p, .trace-cell p {
        margin: 0;
        color: var(--muted);
        line-height: 1.7;
        font-size: 14px;
      }
      .stat-value {
        margin-top: 10px;
        font-size: 28px;
        font-weight: 700;
      }
      .trace-index {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.16em;
        color: var(--soft);
      }
      .trace-grid {
        display: grid;
        gap: 12px;
        margin-top: 14px;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      }
      .trace-cell {
        border-radius: 18px;
        background: rgba(15,23,42,0.04);
        padding: 14px;
      }
      .trace-cell h4 {
        margin: 0 0 8px;
        font-size: 13px;
        letter-spacing: 0.14em;
      }
      @media (max-width: 720px) {
        .hero h1 { font-size: 32px; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <div class="chip">SystemCraft 项目成果展示</div>
        <h1>${escapeHtml(project.project_name || project.description)}</h1>
        <p>${escapeHtml(project.description)}</p>
        <div class="meta">
          <span class="pill">项目 ID：${escapeHtml(project.id)}</span>
          <span class="pill">状态：${escapeHtml(project.status)}</span>
          <span class="pill">难度：${escapeHtml(project.difficulty || 'medium')}</span>
          ${
            project.template_label
              ? `<span class="pill">模板：${escapeHtml(project.template_label)}</span>`
              : ''
          }
          <span class="pill">迭代次数：${escapeHtml(
            String(project.iteration_history?.length ?? 0),
          )}</span>
        </div>
      </section>

      <section class="section">
        <div class="panel">
          <h2>项目总览</h2>
          <p class="lead">这是一份适合分享和展示的项目摘要，集中呈现核心产物、学习结果和交付追踪关系。</p>
          <div class="grid stats">
            ${renderStatCard('产物数量', String(artifactTabs.length))}
            ${renderStatCard('知识卡片', String(knowledgeCards.length))}
            ${renderStatCard('追踪覆盖率', `${traceabilityCoverage.coveragePercent}%`)}
            ${renderStatCard('迭代轮次', String(project.iteration_history?.length ?? 0))}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="panel">
          <h2>核心产物</h2>
          <p class="lead">快速查看需求、架构、实现、测试和导师总结等关键交付内容。</p>
          <div class="grid cards">${deliverableCards || '<p>当前还没有可展示的项目产物。</p>'}</div>
        </div>
      </section>

      <section class="section">
        <div class="panel">
          <h2>交付追踪图</h2>
          <p class="lead">把需求、架构、实现和测试串成一条清晰链路。</p>
          <div class="grid">${traceabilityHtml || '<p>当前还没有可展示的追踪关系。</p>'}</div>
        </div>
      </section>

      <section class="section">
        <div class="panel">
          <h2>学习收获</h2>
          <p class="lead">${escapeHtml(
            summarizeMarkdown(project.mentor_notes ?? project.description, 220),
          )}</p>
          <div class="grid cards">${knowledgeCardsHtml || '<p>当前还没有知识卡片。</p>'}</div>
        </div>
      </section>

      ${
        revisionsHtml
          ? `
      <section class="section">
        <div class="panel">
          <h2>迭代时间线</h2>
          <p class="lead">查看项目在交付后是如何继续演进的。</p>
          <div class="grid cards">${revisionsHtml}</div>
        </div>
      </section>
      `
          : ''
      }
    </main>
  </body>
</html>`;
}

function renderTraceCell(title: string, content?: string) {
  return `
    <div class="trace-cell">
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(content || '当前还没有对应内容。')}</p>
    </div>
  `;
}

function renderStatCard(label: string, value: string) {
  return `
    <article class="card">
      <div class="eyebrow">${escapeHtml(label)}</div>
      <div class="stat-value">${escapeHtml(value)}</div>
    </article>
  `;
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function sanitizeFilename(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
