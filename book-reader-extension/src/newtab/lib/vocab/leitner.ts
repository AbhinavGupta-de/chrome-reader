import { LeitnerRating, LeitnerStage, LeitnerState } from "./types";

const DAY = 24 * 3600 * 1000;
export const FAR_FUTURE = Number.MAX_SAFE_INTEGER;

const INTERVALS: Record<LeitnerStage, number> = {
  0: 0,
  1: 1 * DAY,
  2: 3 * DAY,
  3: 7 * DAY,
  4: 14 * DAY,
  5: 30 * DAY,
};

export function intervalForStage(stage: LeitnerStage): number {
  return INTERVALS[stage];
}

function clampStage(s: number): LeitnerStage {
  if (s < 0) return 0;
  if (s > 5) return 5;
  return s as LeitnerStage;
}

export function applyRating(prev: LeitnerState, rating: LeitnerRating, now: number): LeitnerState {
  const base = { ...prev, lastReviewAt: now };
  if (rating === "again") {
    return { ...base, stage: 1, mastered: false, nextReviewAt: now + INTERVALS[1], correctStreak: 0 };
  }
  if (rating === "hard") {
    return { ...base, nextReviewAt: now + INTERVALS[prev.stage] };
  }
  const bump = rating === "good" ? 1 : 2;
  if (prev.stage + bump >= 6) {
    return { ...base, stage: 5, mastered: true, nextReviewAt: FAR_FUTURE, correctStreak: prev.correctStreak + 1 };
  }
  const newStage = clampStage(prev.stage + bump);
  return { ...base, stage: newStage, nextReviewAt: now + INTERVALS[newStage], correctStreak: prev.correctStreak + 1 };
}
