import { z } from "zod";

export const FIRST_WEEK_DAYS = 7;
export const MAX_LOW_RATING = 2;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** Starting guesses, overridable through FEEDBACK_THEME_SCORE_WEIGHTS until the team settles them. */
export const DEFAULT_FEEDBACK_THEME_SCORE_WEIGHTS = {
  recencyHalfLifeDays: 14,
  payingUser: 2,
  firstWeekUser: 1.5,
  lowRating: 1,
  negativeSentiment: 1,
  endedStuck: 1.5,
  failedDeployment: 1
};

export type FeedbackThemeScoreWeights = typeof DEFAULT_FEEDBACK_THEME_SCORE_WEIGHTS;

export const feedbackThemeScoreWeightsSchema = z
  .object({
    recencyHalfLifeDays: z.number().positive(),
    payingUser: z.number().nonnegative(),
    firstWeekUser: z.number().nonnegative(),
    lowRating: z.number().nonnegative(),
    negativeSentiment: z.number().nonnegative(),
    endedStuck: z.number().nonnegative(),
    failedDeployment: z.number().nonnegative()
  })
  .partial()
  .strict()
  .optional()
  .transform((overrides): FeedbackThemeScoreWeights => ({ ...DEFAULT_FEEDBACK_THEME_SCORE_WEIGHTS, ...overrides }));

export interface FeedbackThemeScoreSignal {
  userId: string;
  seenAt: Date;
  rating: number | null;
  sentimentScore: number | null;
  endedStuck: boolean | null;
  deploymentFailed: boolean;
  isPayingUser: boolean;
  isFirstWeekUser: boolean;
}

function recencyOf(signal: FeedbackThemeScoreSignal, weights: FeedbackThemeScoreWeights, now: Date): number {
  const ageInDays = Math.max(0, now.getTime() - signal.seenAt.getTime()) / DAY_IN_MS;

  return 0.5 ** (ageInDays / weights.recencyHalfLifeDays);
}

function severityOf(signal: FeedbackThemeScoreSignal, weights: FeedbackThemeScoreWeights): number {
  const lowRating = signal.rating !== null && signal.rating <= MAX_LOW_RATING ? weights.lowRating : 0;
  const negativeSentiment = Math.max(0, -(signal.sentimentScore ?? 0)) * weights.negativeSentiment;
  const endedStuck = signal.endedStuck ? weights.endedStuck : 0;
  const deploymentFailed = signal.deploymentFailed ? weights.failedDeployment : 0;

  return 1 + lowRating + negativeSentiment + endedStuck + deploymentFailed;
}

function userValueOf(signals: FeedbackThemeScoreSignal[], weights: FeedbackThemeScoreWeights): number {
  const paying = signals.some(signal => signal.isPayingUser) ? weights.payingUser : 1;
  const firstWeek = signals.some(signal => signal.isFirstWeekUser) ? weights.firstWeekUser : 1;

  return paying * firstWeek;
}

function groupByUser(signals: FeedbackThemeScoreSignal[]): FeedbackThemeScoreSignal[][] {
  const byUser = new Map<string, FeedbackThemeScoreSignal[]>();

  for (const signal of signals) {
    byUser.set(signal.userId, [...(byUser.get(signal.userId) ?? []), signal]);
  }

  return [...byUser.values()];
}

/** Each user counts once, through their weightiest recent item, so one loud user cannot outrank many quiet ones. */
export function scoreFeedbackTheme(signals: FeedbackThemeScoreSignal[], weights: FeedbackThemeScoreWeights, now: Date): number {
  return groupByUser(signals).reduce((score, userSignals) => {
    const strongestItem = Math.max(...userSignals.map(signal => recencyOf(signal, weights, now) * severityOf(signal, weights)));

    return score + strongestItem * userValueOf(userSignals, weights);
  }, 0);
}
