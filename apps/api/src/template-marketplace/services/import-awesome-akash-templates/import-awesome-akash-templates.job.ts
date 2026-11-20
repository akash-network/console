import { type Job, JOB_NAME } from "@src/core";

export class ImportAwesomeAkashTemplates implements Job {
  static readonly [JOB_NAME] = "ImportAwesomeAkashTemplates";
  readonly name = ImportAwesomeAkashTemplates[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { windowStartsAt: string }) {}
}

export function importAwesomeAkashTemplatesKeyFor(windowStartsAt: Date): string {
  return `importAwesomeAkashTemplates.${windowStartsAt.toISOString()}`;
}

/** Windows start on multiples of the interval since the epoch, so every replica seeding a run names the same one. */
export function nextTemplateImportWindowAt(now: Date, intervalSeconds: number): Date {
  const intervalMs = intervalSeconds * 1000;

  return new Date((Math.floor(now.getTime() / intervalMs) + 1) * intervalMs);
}
