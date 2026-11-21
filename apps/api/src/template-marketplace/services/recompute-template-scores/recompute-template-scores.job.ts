import { type Job, JOB_NAME } from "@src/core";

export class RecomputeTemplateScores implements Job {
  static readonly [JOB_NAME] = "RecomputeTemplateScores";
  readonly name = RecomputeTemplateScores[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { windowStartsAt: string }) {}
}

export function recomputeTemplateScoresKeyFor(windowStartsAt: Date): string {
  return `recomputeTemplateScores.${windowStartsAt.toISOString()}`;
}

/** Windows start on multiples of the interval since the epoch, so every replica seeding a run names the same one. */
export function nextScoreWindowAt(now: Date, intervalSeconds: number): Date {
  const intervalMs = intervalSeconds * 1000;

  return new Date((Math.floor(now.getTime() / intervalMs) + 1) * intervalMs);
}
