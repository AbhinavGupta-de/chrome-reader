import { describe, it, expect } from "vitest";
import { intervalForStage, applyRating, FAR_FUTURE } from "../../../src/newtab/lib/vocab/leitner";
import { LeitnerState } from "../../../src/newtab/lib/vocab/types";

const NOW = 1_700_000_000_000;
const DAY = 24 * 3600 * 1000;

function state(overrides: Partial<LeitnerState> = {}): LeitnerState {
  return {
    stage: 0,
    mastered: false,
    nextReviewAt: NOW,
    correctStreak: 0,
    ...overrides,
  };
}

describe("intervalForStage", () => {
  it("returns ms for each stage", () => {
    expect(intervalForStage(0)).toBe(0);
    expect(intervalForStage(1)).toBe(1 * DAY);
    expect(intervalForStage(2)).toBe(3 * DAY);
    expect(intervalForStage(3)).toBe(7 * DAY);
    expect(intervalForStage(4)).toBe(14 * DAY);
    expect(intervalForStage(5)).toBe(30 * DAY);
  });
});

describe("applyRating — Again", () => {
  it("from any stage → stage 1, +1d, streak 0", () => {
    for (const stage of [0, 1, 2, 3, 4, 5] as const) {
      const next = applyRating(state({ stage, correctStreak: 7 }), "again", NOW);
      expect(next.stage).toBe(1);
      expect(next.mastered).toBe(false);
      expect(next.nextReviewAt).toBe(NOW + DAY);
      expect(next.correctStreak).toBe(0);
      expect(next.lastReviewAt).toBe(NOW);
    }
  });
});

describe("applyRating — Hard", () => {
  it("repeats same stage with same interval, streak unchanged", () => {
    const next = applyRating(state({ stage: 3, correctStreak: 5 }), "hard", NOW);
    expect(next.stage).toBe(3);
    expect(next.nextReviewAt).toBe(NOW + 7 * DAY);
    expect(next.correctStreak).toBe(5);
  });

  it("at stage 0 (Hard before any review) bumps to stage 1", () => {
    const next = applyRating(state({ stage: 0 }), "hard", NOW);
    expect(next.stage).toBe(0);
    expect(next.nextReviewAt).toBe(NOW + 0);
  });
});

describe("applyRating — Good", () => {
  it("from stage 0 → stage 1, +1d, streak +1", () => {
    const next = applyRating(state({ stage: 0 }), "good", NOW);
    expect(next.stage).toBe(1);
    expect(next.nextReviewAt).toBe(NOW + 1 * DAY);
    expect(next.correctStreak).toBe(1);
    expect(next.mastered).toBe(false);
  });

  it("from stage 4 → stage 5, +30d, not mastered", () => {
    const next = applyRating(state({ stage: 4 }), "good", NOW);
    expect(next.stage).toBe(5);
    expect(next.nextReviewAt).toBe(NOW + 30 * DAY);
    expect(next.mastered).toBe(false);
  });

  it("from stage 5 → mastered, far-future review", () => {
    const next = applyRating(state({ stage: 5, correctStreak: 4 }), "good", NOW);
    expect(next.mastered).toBe(true);
    expect(next.stage).toBe(5);
    expect(next.nextReviewAt).toBe(FAR_FUTURE);
    expect(next.correctStreak).toBe(5);
  });
});

describe("applyRating — Easy", () => {
  it("from stage 0 → stage 2, +3d", () => {
    const next = applyRating(state({ stage: 0 }), "easy", NOW);
    expect(next.stage).toBe(2);
    expect(next.nextReviewAt).toBe(NOW + 3 * DAY);
  });

  it("from stage 4 → mastered (4+2=6 ≥ 6)", () => {
    const next = applyRating(state({ stage: 4 }), "easy", NOW);
    expect(next.mastered).toBe(true);
    expect(next.stage).toBe(5);
    expect(next.nextReviewAt).toBe(FAR_FUTURE);
  });

  it("from stage 5 → mastered", () => {
    const next = applyRating(state({ stage: 5 }), "easy", NOW);
    expect(next.mastered).toBe(true);
    expect(next.stage).toBe(5);
  });
});
