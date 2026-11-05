import { subDays } from "date-fns";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_FEEDBACK_THEME_SCORE_WEIGHTS,
  type FeedbackThemeScoreSignal,
  type FeedbackThemeScoreWeights,
  feedbackThemeScoreWeightsSchema,
  scoreFeedbackTheme
} from "./feedback-theme-score";

const NOW = new Date("2026-11-04T12:00:00.000Z");

const NEUTRAL_WEIGHTS: FeedbackThemeScoreWeights = {
  recencyHalfLifeDays: 14,
  payingUser: 1,
  firstWeekUser: 1,
  lowRating: 0,
  negativeSentiment: 0,
  endedStuck: 0,
  failedDeployment: 0
};

function signal(overrides: Partial<FeedbackThemeScoreSignal> = {}): FeedbackThemeScoreSignal {
  return {
    userId: "user-1",
    seenAt: NOW,
    rating: null,
    sentimentScore: null,
    endedStuck: null,
    deploymentFailed: false,
    isPayingUser: false,
    isFirstWeekUser: false,
    ...overrides
  };
}

describe(scoreFeedbackTheme.name, () => {
  it("scores an empty theme at zero", () => {
    expect(scoreFeedbackTheme([], DEFAULT_FEEDBACK_THEME_SCORE_WEIGHTS, NOW)).toBe(0);
  });

  it("counts one point per distinct user seen just now", () => {
    const score = scoreFeedbackTheme([signal({ userId: "a" }), signal({ userId: "b" }), signal({ userId: "a" })], NEUTRAL_WEIGHTS, NOW);

    expect(score).toBe(2);
  });

  it("halves an item's weight every half-life", () => {
    expect(scoreFeedbackTheme([signal({ seenAt: subDays(NOW, 14) })], NEUTRAL_WEIGHTS, NOW)).toBeCloseTo(0.5);
    expect(scoreFeedbackTheme([signal({ seenAt: subDays(NOW, 28) })], NEUTRAL_WEIGHTS, NOW)).toBeCloseTo(0.25);
    expect(scoreFeedbackTheme([signal({ seenAt: subDays(NOW, 7) })], { ...NEUTRAL_WEIGHTS, recencyHalfLifeDays: 7 }, NOW)).toBeCloseTo(0.5);
  });

  it("does not boost an item seen after now", () => {
    expect(scoreFeedbackTheme([signal({ seenAt: new Date(NOW.getTime() + 60_000) })], NEUTRAL_WEIGHTS, NOW)).toBe(1);
  });

  it("counts a user once through their weightiest item", () => {
    const signals = [signal({ seenAt: subDays(NOW, 14) }), signal({ seenAt: NOW, endedStuck: true })];

    expect(scoreFeedbackTheme(signals, { ...NEUTRAL_WEIGHTS, endedStuck: 2 }, NOW)).toBe(3);
  });

  it.each([
    { name: "a rating of 2", overrides: { rating: 2 }, weights: { lowRating: 1.5 }, expected: 2.5 },
    { name: "a rating of 1", overrides: { rating: 1 }, weights: { lowRating: 1.5 }, expected: 2.5 },
    { name: "a rating of 3", overrides: { rating: 3 }, weights: { lowRating: 1.5 }, expected: 1 },
    { name: "fully negative sentiment", overrides: { sentimentScore: -1 }, weights: { negativeSentiment: 2 }, expected: 3 },
    { name: "half negative sentiment", overrides: { sentimentScore: -0.5 }, weights: { negativeSentiment: 2 }, expected: 2 },
    { name: "positive sentiment", overrides: { sentimentScore: 0.8 }, weights: { negativeSentiment: 2 }, expected: 1 },
    { name: "a user who ended stuck", overrides: { endedStuck: true }, weights: { endedStuck: 1.5 }, expected: 2.5 },
    { name: "a user who got unstuck", overrides: { endedStuck: false }, weights: { endedStuck: 1.5 }, expected: 1 },
    { name: "a failed deployment", overrides: { deploymentFailed: true }, weights: { failedDeployment: 0.5 }, expected: 1.5 },
    { name: "a paying user", overrides: { isPayingUser: true }, weights: { payingUser: 2 }, expected: 2 },
    { name: "a first-week user", overrides: { isFirstWeekUser: true }, weights: { firstWeekUser: 1.5 }, expected: 1.5 }
  ])("weighs $name", ({ overrides, weights, expected }) => {
    expect(scoreFeedbackTheme([signal(overrides)], { ...NEUTRAL_WEIGHTS, ...weights }, NOW)).toBeCloseTo(expected);
  });

  it("adds severities up and multiplies them by the user's value", () => {
    const score = scoreFeedbackTheme(
      [signal({ rating: 1, sentimentScore: -1, endedStuck: true, deploymentFailed: true, isPayingUser: true, isFirstWeekUser: true })],
      DEFAULT_FEEDBACK_THEME_SCORE_WEIGHTS,
      NOW
    );

    expect(score).toBeCloseTo((1 + 1 + 1 + 1.5 + 1) * 2 * 1.5);
  });

  it("values a user by any of their items being paying or first-week", () => {
    const score = scoreFeedbackTheme(
      [signal({ isPayingUser: true }), signal({ isFirstWeekUser: true })],
      { ...NEUTRAL_WEIGHTS, payingUser: 2, firstWeekUser: 3 },
      NOW
    );

    expect(score).toBe(6);
  });

  it("ranks many quiet users above one loud user", () => {
    const loudUser = Array.from({ length: 10 }, () => signal({ userId: "loud", rating: 1 }));
    const quietUsers = Array.from({ length: 4 }, (_, index) => signal({ userId: `quiet-${index}` }));

    expect(scoreFeedbackTheme(quietUsers, DEFAULT_FEEDBACK_THEME_SCORE_WEIGHTS, NOW)).toBeGreaterThan(
      scoreFeedbackTheme(loudUser, DEFAULT_FEEDBACK_THEME_SCORE_WEIGHTS, NOW)
    );
  });
});

describe("feedbackThemeScoreWeightsSchema", () => {
  it("fills the weights it is not given from the defaults", () => {
    expect(feedbackThemeScoreWeightsSchema.parse(undefined)).toEqual(DEFAULT_FEEDBACK_THEME_SCORE_WEIGHTS);
    expect(feedbackThemeScoreWeightsSchema.parse({ endedStuck: 4 })).toEqual({ ...DEFAULT_FEEDBACK_THEME_SCORE_WEIGHTS, endedStuck: 4 });
  });

  it.each([
    { recencyHalfLifeDays: -1 },
    { payingUser: -1 },
    { firstWeekUser: -1 },
    { lowRating: -1 },
    { negativeSentiment: -1 },
    { endedStuck: -1 },
    { failedDeployment: -1 },
    { failedDeployment: "1" }
  ])("rejects %o", weights => {
    expect(feedbackThemeScoreWeightsSchema.safeParse(weights).success).toBe(false);
  });
});
