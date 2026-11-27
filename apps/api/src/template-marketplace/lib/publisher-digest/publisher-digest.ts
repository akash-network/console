import type { InsightHint } from "@src/template-marketplace/lib/template-insights/template-insight-hints";
import type { TemplateInsights } from "@src/template-marketplace/lib/template-insights/template-insights";

export type DigestEntry = {
  templateId: string;
  title: string;
  views: number;
  deploys: number;
  previousDeploys: number;
  stillRunning: number;
  hint: InsightHint | undefined;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const MONDAY = 1;

/** Monday afternoon in Europe and morning in the Americas, once the week it reports on has ended everywhere. */
const DIGEST_SEND_HOUR_UTC = 14;

const FIRST_MILESTONES = [10, 50];

const MILESTONE_STEPS_PER_POWER_OF_TEN = [1, 2.5, 5];

export function nextDigestRunAt(now: Date): Date {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysUntilMonday = (MONDAY - now.getUTCDay() + 7) % 7;
  const thisWeeksRun = today + daysUntilMonday * DAY_MS + DIGEST_SEND_HOUR_UTC * 60 * 60 * 1000;

  return new Date(thisWeeksRun > now.getTime() ? thisWeeksRun : thisWeeksRun + 7 * DAY_MS);
}

/** The UTC day before the run, which closes the week the digest reports on. */
export function digestWeekEndingBefore(runAt: Date): string {
  return new Date(Date.UTC(runAt.getUTCFullYear(), runAt.getUTCMonth(), runAt.getUTCDate()) - DAY_MS).toISOString().slice(0, 10);
}

/** The highest milestone reached once the count went from before to after, so a template already past a milestone when counting began never hears of it. */
export function crossedMilestone(before: number, after: number): number | undefined {
  let crossed: number | undefined;

  for (const milestone of milestonesUpTo(after)) {
    if (milestone > before) crossed = milestone;
  }

  return crossed;
}

/** Answers nothing for a template nobody viewed, opened, deployed or forked in the week. */
export function digestEntryOf(template: { id: string; title: string }, { current, previous, hints }: TemplateInsights): DigestEntry | undefined {
  if (current.views + current.configureOpens + current.deploys + current.forks === 0) return undefined;

  return {
    templateId: template.id,
    title: template.title,
    views: current.views,
    deploys: current.deploys,
    previousDeploys: previous.deploys,
    stillRunning: current.stillRunning,
    hint: hints[0]
  };
}

function milestonesUpTo(count: number): number[] {
  const milestones = FIRST_MILESTONES.filter(milestone => milestone <= count);

  for (let powerOfTen = 100; powerOfTen <= count; powerOfTen *= 10) {
    milestones.push(...MILESTONE_STEPS_PER_POWER_OF_TEN.map(step => step * powerOfTen).filter(milestone => milestone <= count));
  }

  return milestones;
}
