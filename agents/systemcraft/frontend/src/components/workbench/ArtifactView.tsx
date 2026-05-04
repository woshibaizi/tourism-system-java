import { Clipboard, Download, FileText, ListTree } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { buildArtifactTabs, slugifyHeading, type MarkdownHeading } from '../../lib/content';
import { downloadProjectBundle, downloadTextFile } from '../../lib/export';
import type { ArtifactKey, ProjectDetail } from '../../types/api';

interface ArtifactViewProps {
  activeArtifact: ArtifactKey;
  onChangeArtifact: (key: ArtifactKey) => void;
  project: ProjectDetail | null;
  focusMode?: boolean;
}

export function ArtifactView({
  activeArtifact,
  onChangeArtifact,
  project,
  focusMode = false,
}: ArtifactViewProps) {
  const tabs = buildArtifactTabs(project);
  const activeTab =
    tabs.find((tab) => tab.key === activeArtifact) ??
    tabs[0] ?? {
      key: 'requirements_doc' as ArtifactKey,
      label: '暂无产物',
      description: '项目推进后，这里会自动出现文档、代码和测试结果。',
      content: '',
    };

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const markdownRef = useRef<HTMLDivElement | null>(null);
  const [headings, setHeadings] = useState<MarkdownHeading[]>([]);
  const [activeHeadingId, setActiveHeadingId] = useState('');

  useEffect(() => {
    const markdownRoot = markdownRef.current;
    const scrollRoot = scrollRef.current;

    if (!markdownRoot || !scrollRoot) {
      setHeadings([]);
      setActiveHeadingId('');
      return;
    }

    const headingNodes = Array.from(markdownRoot.querySelectorAll<HTMLElement>('h1, h2, h3, h4'));
    const headingCount = new Map<string, number>();
    const nextHeadings = headingNodes.map((node) => {
      const text = node.textContent?.trim() || '未命名小节';
      const baseId = slugifyHeading(text);
      const order = (headingCount.get(baseId) ?? 0) + 1;
      headingCount.set(baseId, order);

      const id = order === 1 ? baseId : `${baseId}-${order}`;
      node.id = id;
      node.dataset.headingId = id;
      node.style.scrollMarginTop = focusMode ? '28px' : '96px';

      return {
        id,
        text,
        level: Number(node.tagName.slice(1)),
      };
    });

    setHeadings(nextHeadings);
    setActiveHeadingId(nextHeadings[0]?.id ?? '');
    scrollRoot.scrollTo({ top: 0 });
  }, [activeTab.content, activeTab.key, focusMode]);

  useEffect(() => {
    const scrollRoot = scrollRef.current;
    const markdownRoot = markdownRef.current;

    if (!scrollRoot || !markdownRoot || headings.length === 0) {
      return;
    }

    const currentScrollRoot = scrollRoot;
    const currentMarkdownRoot = markdownRoot;

    function syncActiveHeading() {
      const threshold = currentScrollRoot.scrollTop + 40;
      let currentId = headings[0]?.id ?? '';

      for (const heading of headings) {
        const target = currentMarkdownRoot.querySelector<HTMLElement>(
          `[data-heading-id="${heading.id}"]`,
        );
        if (target && target.offsetTop <= threshold) {
          currentId = heading.id;
        }
      }

      setActiveHeadingId((previousId) => (previousId === currentId ? previousId : currentId));
    }

    syncActiveHeading();
    currentScrollRoot.addEventListener('scroll', syncActiveHeading);

    return () => {
      currentScrollRoot.removeEventListener('scroll', syncActiveHeading);
    };
  }, [headings]);

  function jumpToHeading(id: string) {
    const scrollRoot = scrollRef.current;
    const markdownRoot = markdownRef.current;

    if (!scrollRoot || !markdownRoot) {
      return;
    }

    const target = markdownRoot.querySelector<HTMLElement>(`[data-heading-id="${id}"]`);
    if (!target) {
      return;
    }

    scrollRoot.scrollTo({
      top: Math.max(target.offsetTop - 28, 0),
      behavior: 'smooth',
    });
    setActiveHeadingId(id);
  }

  return (
    <div className={`flex h-full min-h-0 min-w-0 flex-col ${focusMode ? 'space-y-5' : 'space-y-4'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-white/70 px-4 py-3 dark:bg-white/5">
        <div>
          <div className="text-sm font-semibold text-slate-950 dark:text-white">产出物预览</div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            需求、架构、代码、测试和导师总结都可以在这里查看与导出。
          </p>
        </div>
        {project ? (
          <button
            type="button"
            onClick={() => downloadProjectBundle(project)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20"
          >
            <Download className="h-4 w-4" />
            导出全套 Markdown
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChangeArtifact(tab.key)}
            className={`rounded-full px-4 py-2 text-sm transition ${
              tab.key === activeTab.key
                ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                : 'border border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className={`min-h-0 min-w-0 flex-1 overflow-hidden ${
          focusMode ? 'grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]' : ''
        }`}
      >
        {focusMode ? (
          <aside className="glass-panel hidden min-h-0 overflow-hidden rounded-[28px] p-4 lg:flex lg:flex-col">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white dark:bg-white dark:text-slate-950">
              <ListTree className="h-3.5 w-3.5" />
              目录导航
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
              目录会跟随当前阅读位置高亮，点击即可跳转到对应章节。
            </p>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
              {headings.length > 0 ? (
                <div className="space-y-2">
                  {headings.map((heading) => (
                    <button
                      key={heading.id}
                      type="button"
                      onClick={() => jumpToHeading(heading.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-[20px] px-3 py-2 text-left text-sm transition ${
                        activeHeadingId === heading.id
                          ? 'bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950'
                          : 'text-slate-600 hover:bg-white/80 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/8 dark:hover:text-white'
                      }`}
                      style={{ paddingLeft: `${heading.level * 10 + 8}px` }}
                    >
                      <span className="line-clamp-2">{heading.text}</span>
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] opacity-60">
                        H{heading.level}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-[22px] border border-dashed border-slate-300/80 px-4 py-5 text-sm leading-6 text-slate-500 dark:border-white/10 dark:text-slate-400">
                  当前产物里还没有可识别的小节标题，检测到 Markdown 标题后目录会自动出现。
                </div>
              )}
            </div>
          </aside>
        ) : null}

        <section className="glass-panel flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[32px] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">
                <FileText className="h-3.5 w-3.5" />
                {activeTab.label}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {activeTab.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(activeTab.content)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20"
              >
                <Clipboard className="h-4 w-4" />
                复制内容
              </button>

              <button
                type="button"
                onClick={() =>
                  downloadTextFile(
                    `${project?.project_name || project?.id || 'artifact'}-${activeTab.key}.md`,
                    activeTab.content,
                  )
                }
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:scale-[1.01] dark:bg-white dark:text-slate-950"
              >
                <Download className="h-4 w-4" />
                单独下载
              </button>
            </div>
          </div>

          {focusMode ? (
            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-[24px] border border-white/10 bg-white/70 px-4 py-3 dark:bg-white/5">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Focus Reading
              </span>
              <span className="text-sm text-slate-600 dark:text-slate-300">
                当前共 {headings.length} 个章节，可配合左侧目录快速跳转。
              </span>
            </div>
          ) : null}

          <div
            ref={scrollRef}
            className="artifact-scroll-region mt-8 h-0 min-h-0 flex-1 overflow-x-hidden overflow-y-auto pr-1.5 [scrollbar-gutter:stable_both-edges] overscroll-contain"
          >
            <div
              ref={markdownRef}
              className="markdown-body prose prose-slate min-h-full max-w-none text-sm leading-7 dark:prose-invert"
            >
              {activeTab.content ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeTab.content}</ReactMarkdown>
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-300/80 px-6 py-10 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                  当前阶段还没有可展示的内容，等工作流推进后这里会自动填充。
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
