import type { InsightTotals, VersionInsight } from "./template-insights";

export const INSIGHT_HINT_KINDS = [
  "few_get_a_provider",
  "few_still_running",
  "latest_version_gets_fewer_providers",
  "latest_version_stops_more",
  "few_viewers_deploy",
  "deploys_growing",
  "running_well"
] as const;

export type InsightHintKind = (typeof INSIGHT_HINT_KINDS)[number];

export type InsightHintTone = "warning" | "info" | "positive";

/** `value` is the rate or count the hint is about; `previousValue` what it is compared to, for the hints that compare. */
export type InsightHint = { kind: InsightHintKind; tone: InsightHintTone; value: number; previousValue: number | null; version: number | null };

export const MIN_DEPLOYS_FOR_PROVIDER_HINT = 10;
export const LOW_LEASE_RATE = 0.6;
export const LOW_STILL_RUNNING_RATE = 0.5;
export const MIN_VIEWS_FOR_CONVERSION_HINT = 50;
export const LOW_VIEW_TO_DEPLOY_RATE = 0.02;
export const MIN_VERSION_RATE_DROP_POINTS = 20;
export const MIN_DEPLOYS_FOR_GROWTH_HINT = 5;
export const GROWTH_FACTOR = 1.5;
export const MIN_DECIDED_LEASES_FOR_RUNNING_WELL = 10;
export const HIGH_STILL_RUNNING_RATE = 0.8;

type HintInput = { current: InsightTotals; previous: InsightTotals; versions: VersionInsight[] };

const TONE_ORDER: InsightHintTone[] = ["warning", "info", "positive"];

/** Absorbs floating-point error only, so a drop of exactly the minimum still counts. */
const RATE_DROP_TOLERANCE_POINTS = 1e-9;

/** Only says what the numbers support: every hint needs enough deployments or visitors behind it, and praise never sits next to a warning. */
export function findInsightHints({ current, previous, versions }: HintInput): InsightHint[] {
  const concerns = [...periodConcerns(current), ...versionConcerns(versions)];
  const praise = concerns.some(hint => hint.tone === "warning") ? [] : periodPraise(current, previous);

  return [...concerns, ...praise].sort((left, right) => TONE_ORDER.indexOf(left.tone) - TONE_ORDER.indexOf(right.tone));
}

function periodConcerns({ deploys, views, leaseRate, stillRunningRate, viewToDeployRate }: InsightTotals): InsightHint[] {
  const hints: InsightHint[] = [];

  if (leaseRate !== null && deploys >= MIN_DEPLOYS_FOR_PROVIDER_HINT && leaseRate < LOW_LEASE_RATE) {
    hints.push(hintOf("few_get_a_provider", "warning", leaseRate));
  }

  if (stillRunningRate !== null && stillRunningRate < LOW_STILL_RUNNING_RATE) {
    hints.push(hintOf("few_still_running", "warning", stillRunningRate));
  }

  if (viewToDeployRate !== null && views >= MIN_VIEWS_FOR_CONVERSION_HINT && viewToDeployRate < LOW_VIEW_TO_DEPLOY_RATE) {
    hints.push(hintOf("few_viewers_deploy", "info", viewToDeployRate));
  }

  return hints;
}

function versionConcerns(versions: VersionInsight[]): InsightHint[] {
  const deployed = versions.filter(version => version.deploys > 0).sort((left, right) => left.version - right.version);
  const latest = deployed.at(-1);
  const earlier = deployed.at(-2);

  if (!latest || !earlier) return [];

  const hints: InsightHint[] = [];

  if (hasDropped(latest.leaseRate, earlier.leaseRate) && Math.min(latest.deploys, earlier.deploys) >= MIN_DEPLOYS_FOR_PROVIDER_HINT) {
    hints.push(hintOf("latest_version_gets_fewer_providers", "warning", latest.leaseRate!, earlier.leaseRate, latest.version));
  }

  if (hasDropped(latest.stillRunningRate, earlier.stillRunningRate)) {
    hints.push(hintOf("latest_version_stops_more", "warning", latest.stillRunningRate!, earlier.stillRunningRate, latest.version));
  }

  return hints;
}

function periodPraise(current: InsightTotals, previous: InsightTotals): InsightHint[] {
  const hints: InsightHint[] = [];

  if (current.deploys >= MIN_DEPLOYS_FOR_GROWTH_HINT && current.deploys >= previous.deploys * GROWTH_FACTOR) {
    hints.push(hintOf("deploys_growing", "positive", current.deploys, previous.deploys));
  }

  if (current.stillRunningRate !== null && current.decidedLeases >= MIN_DECIDED_LEASES_FOR_RUNNING_WELL && current.stillRunningRate >= HIGH_STILL_RUNNING_RATE) {
    hints.push(hintOf("running_well", "positive", current.stillRunningRate));
  }

  return hints;
}

function hasDropped(latest: number | null, earlier: number | null): boolean {
  return latest !== null && earlier !== null && (earlier - latest) * 100 >= MIN_VERSION_RATE_DROP_POINTS - RATE_DROP_TOLERANCE_POINTS;
}

function hintOf(kind: InsightHintKind, tone: InsightHintTone, value: number, previousValue: number | null = null, version: number | null = null): InsightHint {
  return { kind, tone, value, previousValue, version };
}
