import { describe, expect, it } from "vitest";

import { ImportAwesomeAkashTemplates, importAwesomeAkashTemplatesKeyFor, nextTemplateImportWindowAt } from "./import-awesome-akash-templates.job";

describe(nextTemplateImportWindowAt.name, () => {
  it.each([
    { now: "2026-11-18T00:00:00.000Z", intervalSeconds: 21600, next: "2026-11-18T06:00:00.000Z" },
    { now: "2026-11-18T05:59:59.999Z", intervalSeconds: 21600, next: "2026-11-18T06:00:00.000Z" },
    { now: "2026-11-18T06:00:00.001Z", intervalSeconds: 21600, next: "2026-11-18T12:00:00.000Z" },
    { now: "2026-11-18T23:10:00.000Z", intervalSeconds: 21600, next: "2026-11-19T00:00:00.000Z" },
    { now: "2026-11-18T10:20:30.000Z", intervalSeconds: 60, next: "2026-11-18T10:21:00.000Z" }
  ])("answers $next after $now for windows of $intervalSeconds seconds", ({ now, intervalSeconds, next }) => {
    expect(nextTemplateImportWindowAt(new Date(now), intervalSeconds).toISOString()).toBe(next);
  });
});

describe(ImportAwesomeAkashTemplates.name, () => {
  it("names its window in the job and in the key that keeps one run per window", () => {
    const windowStartsAt = new Date("2026-11-18T06:00:00.000Z");
    const job = new ImportAwesomeAkashTemplates({ windowStartsAt: windowStartsAt.toISOString() });

    expect(job).toMatchObject({ name: "ImportAwesomeAkashTemplates", version: 1, data: { windowStartsAt: "2026-11-18T06:00:00.000Z" } });
    expect(importAwesomeAkashTemplatesKeyFor(windowStartsAt)).toBe("importAwesomeAkashTemplates.2026-11-18T06:00:00.000Z");
  });
});
