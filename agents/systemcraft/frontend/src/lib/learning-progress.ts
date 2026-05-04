import type { KnowledgeCard } from '../types/api';

export interface LearningProgressState {
  reviewedCardIds: string[];
  completedQuestionIds: string[];
  reflections: Record<string, string>;
}

const STORAGE_KEY = 'systemcraft-learning-progress';

export function createEmptyLearningProgress(): LearningProgressState {
  return {
    reviewedCardIds: [],
    completedQuestionIds: [],
    reflections: {},
  };
}

export function loadLearningProgress(projectId: string): LearningProgressState {
  if (!projectId) {
    return createEmptyLearningProgress();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createEmptyLearningProgress();
    }

    const parsed = JSON.parse(raw) as Record<string, LearningProgressState>;
    const progress = parsed[projectId];
    if (!progress) {
      return createEmptyLearningProgress();
    }

    return {
      reviewedCardIds: Array.isArray(progress.reviewedCardIds) ? progress.reviewedCardIds : [],
      completedQuestionIds: Array.isArray(progress.completedQuestionIds)
        ? progress.completedQuestionIds
        : [],
      reflections:
        progress.reflections && typeof progress.reflections === 'object' ? progress.reflections : {},
    };
  } catch {
    return createEmptyLearningProgress();
  }
}

export function saveLearningProgress(projectId: string, progress: LearningProgressState) {
  if (!projectId) {
    return;
  }

  const current = readLearningProgressMap();
  current[projectId] = progress;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}

export function calculateLearningCompletion(
  cards: KnowledgeCard[],
  progress: LearningProgressState,
) {
  if (cards.length === 0) {
    return {
      reviewedCount: 0,
      completedQuestionCount: 0,
      completionPercent: 0,
    };
  }

  const reviewedCount = cards.filter((card) => progress.reviewedCardIds.includes(card.id)).length;
  const questionCards = cards.filter((card) => card.hasThinkingQuestion);
  const completedQuestionCount = questionCards.filter((card) =>
    progress.completedQuestionIds.includes(card.id),
  ).length;
  const totalMilestones = cards.length + questionCards.length;

  return {
    reviewedCount,
    completedQuestionCount,
    completionPercent: Math.round(
      ((reviewedCount + completedQuestionCount) / totalMilestones) * 100,
    ),
  };
}

function readLearningProgressMap() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {} as Record<string, LearningProgressState>;
    }

    const parsed = JSON.parse(raw) as Record<string, LearningProgressState>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {} as Record<string, LearningProgressState>;
  }
}
