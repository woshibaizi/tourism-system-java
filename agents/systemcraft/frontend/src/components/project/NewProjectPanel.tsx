import { Check, ChevronDown, ChevronUp, LoaderCircle, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { difficultyMeta } from '../../lib/stage';
import { projectTemplates } from '../../lib/templates';
import type { Difficulty, ProjectCreateRequest } from '../../types/api';

interface NewProjectPanelProps {
  isSubmitting: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onCreate: (payload: ProjectCreateRequest) => Promise<void>;
}

export function NewProjectPanel({
  isSubmitting,
  disabled = false,
  disabledReason = '',
  onCreate,
}: NewProjectPanelProps) {
  const defaultTemplate = projectTemplates[1];
  const [description, setDescription] = useState(defaultTemplate.prompt);
  const [difficulty, setDifficulty] = useState<Difficulty>(defaultTemplate.difficulty);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(defaultTemplate.id);
  const [isTemplatePanelOpen, setIsTemplatePanelOpen] = useState(false);

  const selectedTemplate = useMemo(
    () => projectTemplates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId],
  );

  function applyTemplate(templateId: string) {
    const template = projectTemplates.find((item) => item.id === templateId);
    if (!template) {
      return;
    }

    setSelectedTemplateId(template.id);
    setDescription(template.prompt);
    setDifficulty(template.difficulty);
    setIsTemplatePanelOpen(false);
  }

  return (
    <div className="mx-auto w-full max-w-[960px]">
      {disabledReason ? (
        <div className="mb-4 rounded-[20px] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-700 dark:text-amber-200">
          {disabledReason}
        </div>
      ) : null}

      <form
        className="space-y-5"
        onSubmit={async (event) => {
          event.preventDefault();
          await onCreate({
            description,
            difficulty,
            template_id: selectedTemplate?.id,
            template_label: selectedTemplate?.title,
            template_category: selectedTemplate?.category,
          });
        }}
      >
        <div className="prompt-shell rounded-[32px] p-5 sm:p-6">
          <textarea
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              if (selectedTemplate && event.target.value.trim() !== selectedTemplate.prompt.trim()) {
                setSelectedTemplateId('');
              }
            }}
            disabled={disabled || isSubmitting}
            minLength={5}
            required
            rows={6}
            className="min-h-[220px] w-full resize-none border-0 bg-transparent px-1 py-1 text-[17px] leading-8 text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
            placeholder="描述你想生成的软件项目，例如：做一个在线考试系统，支持题库、组卷、自动阅卷和学习报告。"
          />

          <div className="prompt-divider mt-5 border-t pt-4">
            <button
              type="button"
              disabled={disabled || isSubmitting}
              onClick={() => setIsTemplatePanelOpen((current) => !current)}
              className="prompt-surface flex w-full items-center justify-between gap-4 rounded-[20px] border px-4 py-3 text-left transition"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-950 dark:text-white">
                  项目模板
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {selectedTemplate
                    ? `当前已选：${selectedTemplate.title} · ${selectedTemplate.category}`
                    : '按需展开，快速套用常见项目模板。'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {selectedTemplate ? (
                  <span className="prompt-pill rounded-full px-3 py-1 text-xs font-semibold">
                    {selectedTemplate.title}
                  </span>
                ) : null}
                {isTemplatePanelOpen ? (
                  <ChevronUp className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                )}
              </div>
            </button>

            {isTemplatePanelOpen ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {projectTemplates.map((template) => {
                  const isActive = template.id === selectedTemplateId;

                  return (
                    <button
                      key={template.id}
                      type="button"
                      disabled={disabled || isSubmitting}
                      onClick={() => applyTemplate(template.id)}
                      className={`rounded-[22px] border p-4 text-left transition ${
                        isActive
                          ? 'prompt-option-active'
                          : 'prompt-option'
                      } disabled:cursor-not-allowed disabled:opacity-55`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold">{template.title}</div>
                        {isActive ? <Check className="h-4 w-4" /> : null}
                      </div>
                      <div
                        className={`mt-2 text-xs font-semibold tracking-[0.16em] ${
                          isActive
                            ? 'text-white/70 dark:text-slate-300'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {template.category} · {difficultyMeta[template.difficulty].label}
                      </div>
                      <p
                        className={`mt-3 text-sm leading-6 ${
                          isActive
                            ? 'text-white/82 dark:text-slate-300'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {template.summary}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {template.highlights.map((highlight) => (
                          <span
                            key={highlight}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                              isActive
                                ? 'bg-white/12 text-white/88 dark:bg-slate-700/60 dark:text-slate-200'
                                : 'bg-slate-950/5 text-slate-500 dark:bg-white/10 dark:text-slate-400'
                            }`}
                          >
                            {highlight}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="prompt-divider mt-5 flex flex-col gap-4 border-t pt-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2">
              <div className="text-xs font-semibold tracking-[0.16em] text-slate-500 dark:text-slate-400">
                复杂度
              </div>
              <div className="flex flex-wrap gap-2">
                {(['easy', 'medium', 'hard'] as Difficulty[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    disabled={disabled || isSubmitting}
                    onClick={() => setDifficulty(value)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      difficulty === value
                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                        : 'prompt-level border hover:border-slate-300 hover:text-slate-950'
                    } disabled:cursor-not-allowed disabled:opacity-55`}
                  >
                    {difficultyMeta[value].label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {difficultyMeta[difficulty].description}
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || disabled}
              className="inline-flex items-center justify-center gap-3 rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70 dark:bg-white dark:text-slate-950"
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  正在启动多 Agent 工作流...
                </>
              ) : disabled ? (
                <>
                  <LoaderCircle className="h-4 w-4" />
                  当前已有任务正在执行
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  开始生成
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
