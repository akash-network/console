import type { TemplateSource } from "@src/template-marketplace/model-schemas/template-usage-event/template-usage-event.schema";

export type ScoringSettings = {
  trialWeight: number;
  popularHalfLifeDays: number;
  popularWindowDays: number;
  trendingWindowDays: number;
  trendingMinVolume: number;
};

export type ScoredTemplateKey = { source: TemplateSource; templateRef: string };

/** Users counted once a day whose deployment was still running after 24 hours, by how many whole days ago that was. */
export type StillRunningUserDays = { ageDays: number; paid: number; trial: number };

export type WeightedUserDays = { paid: number; trial: number; weighted: number };

export const TEMPLATE_SCORE_BREAKDOWN_VERSION = 1;

export type TemplateScoreBreakdown = {
  version: typeof TEMPLATE_SCORE_BREAKDOWN_VERSION;
  popular: {
    windowDays: number;
    halfLifeDays: number;
    trialWeight: number;
    paid: number;
    trial: number;
    decayedPaid: number;
    decayedTrial: number;
  };
  trending: {
    windowDays: number;
    minVolume: number;
    trialWeight: number;
    current: WeightedUserDays;
    previous: WeightedUserDays;
    meetsMinVolume: boolean;
  };
  weeklyDeployers: number;
};

export type TemplateScore = {
  popularScore: number;
  trendingScore: number;
  isTrending: boolean;
  weeklyDeployers: number;
  breakdown: TemplateScoreBreakdown;
};

export type ScoredTemplate = ScoredTemplateKey & TemplateScore;

const SCORE_DECIMALS = 4;

/** A trial weight times a count can land a hair under a whole number, and a weighted count of exactly the minimum must still reach it. */
const MIN_VOLUME_TOLERANCE = 1e-9;

function rounded(value: number): number {
  const scale = 10 ** SCORE_DECIMALS;

  return Math.round(value * scale) / scale;
}

function sumOf(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}

/** Trending compares two windows back to back, so the events read have to reach both even when Popular looks back less. */
export function scoreLookbackDays({ popularWindowDays, trendingWindowDays }: Pick<ScoringSettings, "popularWindowDays" | "trendingWindowDays">): number {
  return Math.max(popularWindowDays, 2 * trendingWindowDays);
}

export function decayOf(ageDays: number, halfLifeDays: number): number {
  return 0.5 ** (ageDays / halfLifeDays);
}

function weightedUserDays(userDays: StillRunningUserDays[], trialWeight: number): WeightedUserDays {
  const paid = sumOf(userDays.map(day => day.paid));
  const trial = sumOf(userDays.map(day => day.trial));

  return { paid, trial, weighted: paid + trial * trialWeight };
}

function publishedUserDays(userDays: WeightedUserDays): WeightedUserDays {
  return { ...userDays, weighted: rounded(userDays.weighted) };
}

function agedWithin(userDays: StillRunningUserDays[], fromDays: number, toDays: number): StillRunningUserDays[] {
  return userDays.filter(({ ageDays }) => ageDays >= fromDays && ageDays < toDays);
}

function popularOf(userDays: StillRunningUserDays[], { trialWeight, popularHalfLifeDays, popularWindowDays }: ScoringSettings) {
  const counted = agedWithin(userDays, 0, popularWindowDays);
  const decayedPaid = sumOf(counted.map(day => day.paid * decayOf(day.ageDays, popularHalfLifeDays)));
  const decayedTrial = sumOf(counted.map(day => day.trial * decayOf(day.ageDays, popularHalfLifeDays)));

  return {
    score: rounded(decayedPaid + decayedTrial * trialWeight),
    breakdown: {
      windowDays: popularWindowDays,
      halfLifeDays: popularHalfLifeDays,
      trialWeight,
      paid: sumOf(counted.map(day => day.paid)),
      trial: sumOf(counted.map(day => day.trial)),
      decayedPaid: rounded(decayedPaid),
      decayedTrial: rounded(decayedTrial)
    }
  };
}

/** Growth is measured against at least the minimum volume, so a tiny or empty previous window cannot post a huge rate, and it reads as flat while neither window reaches it; growth above zero therefore means the last window reached it. */
function trendingOf(userDays: StillRunningUserDays[], { trialWeight, trendingWindowDays, trendingMinVolume }: ScoringSettings) {
  const current = weightedUserDays(agedWithin(userDays, 0, trendingWindowDays), trialWeight);
  const previous = weightedUserDays(agedWithin(userDays, trendingWindowDays, 2 * trendingWindowDays), trialWeight);
  const meetsMinVolume = Math.max(current.weighted, previous.weighted) + MIN_VOLUME_TOLERANCE >= trendingMinVolume;
  const score = meetsMinVolume ? rounded((current.weighted - previous.weighted) / Math.max(previous.weighted, trendingMinVolume)) : 0;

  return {
    score,
    isTrending: score > 0,
    breakdown: {
      windowDays: trendingWindowDays,
      minVolume: trendingMinVolume,
      trialWeight,
      current: publishedUserDays(current),
      previous: publishedUserDays(previous),
      meetsMinVolume
    }
  };
}

export function scoreTemplate(userDays: StillRunningUserDays[], weeklyDeployers: number, settings: ScoringSettings): TemplateScore {
  const popular = popularOf(userDays, settings);
  const trending = trendingOf(userDays, settings);

  return {
    popularScore: popular.score,
    trendingScore: trending.score,
    isTrending: trending.isTrending,
    weeklyDeployers,
    breakdown: { version: TEMPLATE_SCORE_BREAKDOWN_VERSION, popular: popular.breakdown, trending: trending.breakdown, weeklyDeployers }
  };
}

function keyOf({ source, templateRef }: ScoredTemplateKey): string {
  return JSON.stringify([source, templateRef]);
}

/** Scores every template named by either list, so one deployed this week with nothing still running yet has a row staff can read. */
export function scoreTemplates(
  userDays: (ScoredTemplateKey & StillRunningUserDays)[],
  weeklyDeployers: (ScoredTemplateKey & { weeklyDeployers: number })[],
  settings: ScoringSettings
): ScoredTemplate[] {
  const templates = new Map<string, ScoredTemplateKey & { userDays: StillRunningUserDays[]; weeklyDeployers: number }>();
  const templateOf = (key: ScoredTemplateKey) => {
    const template = templates.get(keyOf(key)) ?? { source: key.source, templateRef: key.templateRef, userDays: [], weeklyDeployers: 0 };
    templates.set(keyOf(key), template);

    return template;
  };

  for (const { ageDays, paid, trial, ...key } of userDays) {
    templateOf(key).userDays.push({ ageDays, paid, trial });
  }

  for (const { weeklyDeployers: deployers, ...key } of weeklyDeployers) {
    templateOf(key).weeklyDeployers = deployers;
  }

  return [...templates.values()].map(({ source, templateRef, userDays: counted, weeklyDeployers: deployers }) => ({
    source,
    templateRef,
    ...scoreTemplate(counted, deployers, settings)
  }));
}
