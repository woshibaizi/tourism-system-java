import {
  BookMarked,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  FolderKanban,
  GraduationCap,
  Lightbulb,
  LoaderCircle,
  MessageSquareMore,
  PencilLine,
  PlusCircle,
  Target,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { addLearningCard, askProjectFollowUp } from '../../lib/api';
import { extractKnowledgeCards, summarizeMarkdown } from '../../lib/content';
import {
  calculateLearningCompletion,
  createEmptyLearningProgress,
  type LearningProgressState,
  loadLearningProgress,
  saveLearningProgress,
} from '../../lib/learning-progress';
import type { KnowledgeCard, LearningChatMessage, ProjectDetail } from '../../types/api';

interface LearningDeckProps {
  project: ProjectDetail | null;
  onProjectUpdate: (project: ProjectDetail) => void;
}

export function LearningDeck({ project, onProjectUpdate }: LearningDeckProps) {
  const [question, setQuestion] = useState('');
  const [shouldAddToCards, setShouldAddToCards] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [followUpError, setFollowUpError] = useState('');
  const [exerciseError, setExerciseError] = useState('');
  const [studyProgress, setStudyProgress] = useState<LearningProgressState>(
    createEmptyLearningProgress(),
  );
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<string[]>([]);
  const [resolvingCardId, setResolvingCardId] = useState<string | null>(null);
  const [savingMessageId, setSavingMessageId] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  const cards = useMemo(() => extractKnowledgeCards(project?.knowledge_cards ?? ''), [project]);
  const questionCards = useMemo(
    () => cards.filter((card) => card.hasThinkingQuestion),
    [cards],
  );
  const completion = useMemo(
    () => calculateLearningCompletion(cards, studyProgress),
    [cards, studyProgress],
  );
  const stageProgress = useMemo(() => {
    const stages = Array.from(new Set(cards.map((card) => card.stage || 'Overall')));

    return stages.map((stage) => {
      const stageCards = cards.filter((card) => (card.stage || 'Overall') === stage);
      const completed = stageCards.filter(
        (card) =>
          studyProgress.reviewedCardIds.includes(card.id) &&
          (!card.hasThinkingQuestion || studyProgress.completedQuestionIds.includes(card.id)),
      ).length;

      return {
        stage,
        total: stageCards.length,
        completed,
      };
    });
  }, [cards, studyProgress]);
  const recommendedCard =
    questionCards.find((card) => !studyProgress.completedQuestionIds.includes(card.id)) ??
    questionCards[0] ??
    null;
  const exerciseAnswers = useMemo(() => {
    const map = new Map<string, LearningChatMessage>();
    for (const message of project?.learning_chat ?? []) {
      if (
        message.role === 'mentor' &&
        message.source === 'exercise' &&
        message.related_card_id
      ) {
        map.set(message.related_card_id, message);
      }
    }
    return map;
  }, [project?.learning_chat]);

  useEffect(() => {
    const nextFrameId = window.requestAnimationFrame(() => {
      const container = chatContainerRef.current;
      if (!container) {
        return;
      }

      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    });

    return () => {
      window.cancelAnimationFrame(nextFrameId);
    };
  }, [project?.learning_chat]);

  useEffect(() => {
    if (!project?.id) {
      setStudyProgress(createEmptyLearningProgress());
      return;
    }

    setStudyProgress(loadLearningProgress(project.id));
  }, [project?.id]);

  useEffect(() => {
    if (!project?.id) {
      return;
    }

    saveLearningProgress(project.id, studyProgress);
  }, [project?.id, studyProgress]);

  useEffect(() => {
    setExpandedQuestionIds((current) => {
      const validIds = current.filter((id) => questionCards.some((card) => card.id === id));
      if (validIds.length > 0) {
        return validIds;
      }
      return recommendedCard ? [recommendedCard.id] : [];
    });
  }, [questionCards, recommendedCard]);

  if (!project) {
    return (
      <section className="glass-panel rounded-[32px] p-8 text-sm leading-7 text-slate-500 dark:text-slate-400">
        还没有学习数据。先在项目总览创建一个项目，等导师 Agent 产出学习总结后，这里就会自动生成知识卡片、思考题和学习进度。
      </section>
    );
  }

  const currentProject = project;
  const canAskFollowUp = currentProject.status === 'completed';

  async function handleSubmitQuestion() {
    if (!question.trim()) {
      return;
    }

    setFollowUpError('');
    setIsSubmitting(true);

    try {
      const response = await askProjectFollowUp(currentProject.id, {
        question: question.trim(),
        add_to_knowledge_cards: shouldAddToCards,
        source: 'general',
      });
      onProjectUpdate(response.project);
      setQuestion('');
    } catch (submitError) {
      if (submitError instanceof Error) {
        setFollowUpError(submitError.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRequestMentorAnswer(card: KnowledgeCard) {
    if (!card.prompt.trim()) {
      return;
    }

    setExerciseError('');
    setResolvingCardId(card.id);

    try {
      const response = await askProjectFollowUp(currentProject.id, {
        question: buildThinkingExerciseQuestion(card, studyProgress.reflections[card.id] ?? ''),
        add_to_knowledge_cards: false,
        source: 'exercise',
        related_card_id: card.id,
        related_card_title: card.title,
      });
      onProjectUpdate(response.project);
      setExpandedQuestionIds((current) =>
        current.includes(card.id) ? current : [...current, card.id],
      );
    } catch (submitError) {
      if (submitError instanceof Error) {
        setExerciseError(submitError.message);
      }
    } finally {
      setResolvingCardId(null);
    }
  }

  async function handleAddMessageToCards(
    message: LearningChatMessage,
    fallbackQuestion: string,
    source: 'exercise' | 'general',
  ) {
    const questionText = (message.question || fallbackQuestion || '').trim();
    if (!questionText || !message.content.trim()) {
      return;
    }

    if (source === 'exercise') {
      setExerciseError('');
    } else {
      setFollowUpError('');
    }
    setSavingMessageId(message.id);

    try {
      const response = await addLearningCard(currentProject.id, {
        question: questionText,
        answer: message.content,
        mentor_message_id: message.id,
        source: message.source ?? source,
        related_card_id: message.related_card_id,
        related_card_title: message.related_card_title,
      });
      onProjectUpdate(response.project);
    } catch (submitError) {
      if (!(submitError instanceof Error)) {
        return;
      }

      if (source === 'exercise') {
        setExerciseError(submitError.message);
      } else {
        setFollowUpError(submitError.message);
      }
    } finally {
      setSavingMessageId(null);
    }
  }

  function toggleReviewed(cardId: string) {
    setStudyProgress((current) => ({
      ...current,
      reviewedCardIds: current.reviewedCardIds.includes(cardId)
        ? current.reviewedCardIds.filter((id) => id !== cardId)
        : [...current.reviewedCardIds, cardId],
    }));
  }

  function updateReflection(cardId: string, value: string) {
    setStudyProgress((current) => ({
      ...current,
      reflections: {
        ...current.reflections,
        [cardId]: value,
      },
    }));
  }

  function toggleQuestionComplete(cardId: string) {
    setStudyProgress((current) => ({
      ...current,
      completedQuestionIds: current.completedQuestionIds.includes(cardId)
        ? current.completedQuestionIds.filter((id) => id !== cardId)
        : [...current.completedQuestionIds, cardId],
    }));
  }

  function toggleQuestionPanel(cardId: string) {
    setExpandedQuestionIds((current) =>
      current.includes(cardId) ? current.filter((id) => id !== cardId) : [...current, cardId],
    );
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel-strong rounded-[32px] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-pink-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-pink-600 dark:text-pink-300">
              <GraduationCap className="h-3.5 w-3.5" />
              导师复盘
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
              {project.project_name || project.description}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              {summarizeMarkdown(project.mentor_notes ?? project.description, 240)}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="知识卡片"
              value={`${cards.length}`}
              hint={`复习卡片 ${cards.filter((card) => !card.hasThinkingQuestion).length} 张`}
              icon={Brain}
            />
            <MetricCard
              label="学习进度"
              value={`${completion.completionPercent}%`}
              hint={`已精读 ${completion.reviewedCount} / ${cards.length || 1}`}
              icon={Target}
            />
            <MetricCard
              label="思考题完成"
              value={`${completion.completedQuestionCount}`}
              hint={`共 ${questionCards.length} 题`}
              icon={PencilLine}
            />
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            <span>学习进度</span>
            <span>{completion.completionPercent}%</span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-pink-500 via-fuchsia-400 to-cyan-400 transition-[width] duration-500"
              style={{ width: `${completion.completionPercent}%` }}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="glass-panel rounded-[32px] p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            <div>
              <div className="text-lg font-semibold text-slate-950 dark:text-white">思考题训练</div>
              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                先写下自己的理解，再按需展开查看导师解答。确认有价值之后，再决定是否加入知识卡片。
              </p>
            </div>
          </div>

          {exerciseError ? (
            <div className="mt-5 rounded-[22px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
              {exerciseError}
            </div>
          ) : null}

          <div className="mt-6 space-y-4">
            {questionCards.length > 0 ? (
              questionCards.map((card) => {
                const reviewed = studyProgress.reviewedCardIds.includes(card.id);
                const completedQuestion = studyProgress.completedQuestionIds.includes(card.id);
                const reflection = studyProgress.reflections[card.id] ?? '';
                const isExpanded = expandedQuestionIds.includes(card.id);
                const mentorAnswer = exerciseAnswers.get(card.id);

                return (
                  <article
                    key={card.id}
                    className="rounded-[26px] border border-white/10 bg-white/75 px-5 py-5 dark:bg-white/5"
                  >
                    <button
                      type="button"
                      onClick={() => toggleQuestionPanel(card.id)}
                      className="flex w-full items-start justify-between gap-3 text-left"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-950 dark:text-white">
                          {card.title}
                        </div>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {card.stage} · {card.concept}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                            reviewed
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : 'bg-slate-950/5 text-slate-500 dark:bg-white/10 dark:text-slate-400'
                          }`}
                        >
                          {reviewed ? '已精读' : '待精读'}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                            completedQuestion
                              ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                              : 'bg-slate-950/5 text-slate-500 dark:bg-white/10 dark:text-slate-400'
                          }`}
                        >
                          {completedQuestion ? '已作答' : '待作答'}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="mt-1 h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="mt-1 h-4 w-4 text-slate-400" />
                        )}
                      </div>
                    </button>

                    {isExpanded ? (
                      <div className="mt-5 space-y-4">
                        <div className="rounded-[22px] border border-dashed border-slate-300/80 px-4 py-4 text-sm leading-7 text-slate-600 dark:border-white/10 dark:text-slate-300">
                          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                            思考题
                          </div>
                          <div className="mt-2">{card.prompt}</div>
                        </div>

                        <textarea
                          value={reflection}
                          onChange={(event) => updateReflection(card.id, event.target.value)}
                          placeholder="先写下你自己的理解、取舍判断或复盘结论。哪怕还是半成品想法也可以，重点是把思考过程留下来。"
                          className="min-h-[120px] w-full rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4 text-sm leading-7 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-white/20"
                        />

                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => toggleReviewed(card.id)}
                            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                              reviewed
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20'
                            }`}
                          >
                            {reviewed ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <CircleDashed className="h-4 w-4" />
                            )}
                            {reviewed ? '取消精读完成' : '标记已精读'}
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleQuestionComplete(card.id)}
                            disabled={!reflection.trim()}
                            className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950"
                          >
                            <PencilLine className="h-4 w-4" />
                            {completedQuestion ? '取消作答完成' : '标记思考题完成'}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleRequestMentorAnswer(card)}
                            disabled={!canAskFollowUp || resolvingCardId === card.id}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20 dark:hover:text-white"
                          >
                            {resolvingCardId === card.id ? (
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : (
                              <MessageSquareMore className="h-4 w-4" />
                            )}
                            {mentorAnswer ? '重新查看导师解答' : '查看导师解答'}
                          </button>
                        </div>

                        {mentorAnswer ? (
                          <div className="rounded-[24px] border border-cyan-500/15 bg-cyan-500/5 px-4 py-4 dark:border-cyan-400/15 dark:bg-cyan-400/10">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-300">
                                导师解答
                              </div>
                              {mentorAnswer.added_to_knowledge_cards ? (
                                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
                                  已加入知识卡片
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleAddMessageToCards(
                                      mentorAnswer,
                                      `知识卡片《${card.title}》的思考题：${card.prompt}`,
                                      'exercise',
                                    )
                                  }
                                  disabled={savingMessageId === mentorAnswer.id}
                                  className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950"
                                >
                                  {savingMessageId === mentorAnswer.id ? (
                                    <LoaderCircle className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <PlusCircle className="h-4 w-4" />
                                  )}
                                  加入知识卡片
                                </button>
                              )}
                            </div>

                            <div className="markdown-body prose prose-slate mt-4 max-w-none text-sm leading-7 dark:prose-invert">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {mentorAnswer.content}
                              </ReactMarkdown>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-300/80 px-5 py-6 text-sm leading-7 text-slate-500 dark:border-white/10 dark:text-slate-400">
                当前还没有可训练的思考题。后续新增到知识卡片里的追问内容会作为复习卡片保留，但不会自动进入思考题训练。
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="glass-panel rounded-[28px] p-6">
            <div className="flex items-center gap-3">
              <FolderKanban className="h-5 w-5 text-blue-500" />
              <h3 className="text-lg font-semibold text-slate-950 dark:text-white">学习路线</h3>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-[24px] border border-white/10 bg-white/70 px-4 py-4 dark:bg-white/5">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  当前推荐
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-950 dark:text-white">
                  {recommendedCard ? recommendedCard.title : '等待知识卡片生成'}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {recommendedCard
                    ? recommendedCard.prompt
                    : '知识卡片生成后，这里会自动推荐下一张最适合优先复习的卡片。'}
                </p>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/70 px-4 py-4 dark:bg-white/5">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  阶段掌握
                </div>
                <div className="mt-4 space-y-3">
                  {stageProgress.length > 0 ? (
                    stageProgress.map((item) => {
                      const percent = item.total
                        ? Math.round((item.completed / item.total) * 100)
                        : 0;

                      return (
                        <div key={item.stage}>
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="font-medium text-slate-700 dark:text-slate-200">
                              {item.stage}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400">{percent}%</span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-[width] duration-500"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                      暂时还没有可统计的阶段数据。
                    </div>
                  )}
                </div>
              </div>

              <ul className="rounded-[24px] border border-dashed border-slate-300/80 px-4 py-4 text-sm leading-7 text-slate-600 dark:border-white/10 dark:text-slate-300">
                <li>先写下自己的答案，再去看导师解答，会更容易形成结构化理解。</li>
                <li>加入知识卡片的追问内容会保留在复习区，但不会再次进入思考题训练。</li>
                <li>如果某张卡片反复看不懂，优先追问它背后的工程取舍，而不是只问结论。</li>
              </ul>
            </div>
          </section>

          <section className="glass-panel rounded-[28px] p-6">
            <div className="flex items-center gap-3">
              <BookMarked className="h-5 w-5 text-pink-500" />
              <div className="text-lg font-semibold text-slate-950 dark:text-white">导师摘要</div>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
              {summarizeMarkdown(project.mentor_notes ?? '', 320) || '导师总结生成后，这里会显示重点摘录。'}
            </p>
          </section>
        </aside>
      </section>

      <section className="glass-panel rounded-[32px] p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <MessageSquareMore className="h-5 w-5 text-cyan-500" />
          <div>
            <div className="text-lg font-semibold text-slate-950 dark:text-white">继续追问导师</div>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
              这里适合提更大的设计、代码、测试或工程取舍问题。是否加入知识卡片由你自己决定。
            </p>
          </div>
        </div>

        {!canAskFollowUp ? (
          <div className="mt-6 rounded-[24px] border border-amber-500/20 bg-amber-500/10 px-5 py-4 text-sm leading-7 text-amber-700 dark:text-amber-300">
            当前项目还没有完成。等工作流结束后，这里会开放“继续追问”功能。
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="例如：为什么这里选择 REST API 而不是 GraphQL？为什么测试阶段会触发返工？如果我换一种架构方案会有什么代价？"
            disabled={!canAskFollowUp || isSubmitting}
            className="min-h-[140px] w-full rounded-[26px] border border-slate-200 bg-white/80 px-5 py-4 text-sm leading-7 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-white/20"
          />

          <label className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/70 px-4 py-3 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">
            <input
              type="checkbox"
              checked={shouldAddToCards}
              onChange={(event) => setShouldAddToCards(event.target.checked)}
              disabled={!canAskFollowUp || isSubmitting}
              className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-400 dark:border-white/20"
            />
            回答时同步整理成知识卡片
          </label>

          {followUpError ? (
            <div className="rounded-[22px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
              {followUpError}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void handleSubmitQuestion()}
            disabled={!canAskFollowUp || isSubmitting || !question.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950"
          >
            {isSubmitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : shouldAddToCards ? (
              <PlusCircle className="h-4 w-4" />
            ) : (
              <MessageSquareMore className="h-4 w-4" />
            )}
            {shouldAddToCards ? '提问并整理成知识卡片' : '仅提问'}
          </button>
        </div>

        <div
          ref={chatContainerRef}
          className="mt-8 max-h-[520px] space-y-3 overflow-y-auto pr-1"
        >
          {(project.learning_chat ?? []).length > 0 ? (
            (project.learning_chat ?? []).map((message, index, messages) => {
              const fallbackQuestion =
                message.question ||
                findPreviousUserQuestion(messages, index) ||
                message.related_card_title ||
                '';
              const canSaveThisAnswer =
                message.role === 'mentor' &&
                message.source !== 'exercise' &&
                !message.added_to_knowledge_cards &&
                Boolean(fallbackQuestion.trim());

              return (
                <article
                  key={message.id}
                  className={`rounded-[24px] border px-4 py-4 ${
                    message.role === 'user'
                      ? 'border-slate-200 bg-white/80 dark:border-white/10 dark:bg-white/5'
                      : 'border-cyan-500/15 bg-cyan-500/5 dark:border-cyan-400/15 dark:bg-cyan-400/10'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white dark:bg-white dark:text-slate-950">
                      {message.role === 'user' ? '学生' : '导师'}
                    </span>
                    {message.source === 'exercise' ? (
                      <span className="rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-600 dark:text-amber-300">
                        来自思考题
                      </span>
                    ) : null}
                    {message.added_to_knowledge_cards ? (
                      <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
                        已加入知识卡片
                      </span>
                    ) : null}
                  </div>

                  {message.related_card_title ? (
                    <div className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                      关联卡片：{message.related_card_title}
                    </div>
                  ) : null}

                  <div className="markdown-body prose prose-slate mt-4 max-w-none text-sm leading-7 dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                  </div>

                  {canSaveThisAnswer ? (
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() =>
                          void handleAddMessageToCards(message, fallbackQuestion, 'general')
                        }
                        disabled={savingMessageId === message.id}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20 dark:hover:text-white"
                      >
                        {savingMessageId === message.id ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <PlusCircle className="h-4 w-4" />
                        )}
                        加入知识卡片
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })
          ) : (
            <div className="rounded-[24px] border border-dashed border-slate-300/80 px-5 py-6 text-sm leading-7 text-slate-500 dark:border-white/10 dark:text-slate-400">
              项目完成后，这里会记录你与导师的继续追问对话。你可以先提问，再决定是否把回答沉淀成知识卡片。
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        {cards.map((card) => (
          <article key={card.id} className="glass-panel rounded-[28px] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-white dark:text-slate-950">
                  <Brain className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{card.title}</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {card.stage} · {card.concept}
                    {card.source ? ` · ${card.source}` : ''}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => toggleReviewed(card.id)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  studyProgress.reviewedCardIds.includes(card.id)
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20'
                }`}
              >
                {studyProgress.reviewedCardIds.includes(card.id) ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <CircleDashed className="h-4 w-4" />
                )}
                {studyProgress.reviewedCardIds.includes(card.id) ? '已精读' : '标记精读'}
              </button>
            </div>

            {card.hasThinkingQuestion ? (
              <div className="mt-5 rounded-[24px] border border-dashed border-slate-300/80 px-4 py-4 text-sm leading-7 text-slate-600 dark:border-white/10 dark:text-slate-300">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  思考题
                </div>
                <div className="mt-2">{card.prompt}</div>
              </div>
            ) : (
              <div className="mt-5 rounded-[24px] border border-dashed border-slate-300/80 px-4 py-4 text-sm leading-7 text-slate-500 dark:border-white/10 dark:text-slate-400">
                这是一张追问后沉淀的复习卡片，仅用于回顾和理解，不会再次进入思考题训练。
              </div>
            )}

            <div className="markdown-body prose prose-slate mt-6 max-w-none text-sm leading-7 dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.markdown}</ReactMarkdown>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function buildThinkingExerciseQuestion(card: KnowledgeCard, reflection: string) {
  const reflectionBlock = reflection.trim()
    ? `学生当前的思考草稿：\n${reflection.trim()}\n\n`
    : '';

  return `请围绕下面这张知识卡片里的思考题，用中文给出导师式解答。\n\n知识卡片标题：${card.title}\n所属阶段：${card.stage}\n核心概念：${card.concept}\n思考题：${card.prompt}\n\n${reflectionBlock}请按下面要求回答：\n1. 先指出学生最应该抓住的关键点。\n2. 再用通俗但专业的方式展开解释。\n3. 尽量结合这个项目里的真实需求、架构、代码或测试现象举例。\n4. 最后给一个可以马上实践的建议。`;
}

function findPreviousUserQuestion(messages: LearningChatMessage[], currentIndex: number) {
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      return messages[index]?.content ?? '';
    }
  }
  return '';
}

interface MetricCardProps {
  label: string;
  value: string;
  hint: string;
  icon: typeof Brain;
}

function MetricCard({ label, value, hint, icon: Icon }: MetricCardProps) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/70 px-5 py-4 dark:bg-white/5">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-white dark:text-slate-950">
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{value}</div>
      <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{hint}</div>
    </div>
  );
}
