import { describe, expect, it } from "vitest";

import type { InsightTotals, TemplateInsights } from "@src/template-marketplace/lib/template-insights/template-insights";
import { crossedMilestone, digestEntryOf, digestWeekEndingBefore, nextDigestRunAt } from "./publisher-digest";

describe("publisher digest", () => {
  describe(nextDigestRunAt.name, () => {
    it.each([
      ["2026-11-27T10:00:00.000Z", "2026-11-30T14:00:00.000Z"],
      ["2026-11-29T23:59:59.000Z", "2026-11-30T14:00:00.000Z"],
      ["2026-11-30T00:00:00.000Z", "2026-11-30T14:00:00.000Z"],
      ["2026-11-30T13:59:59.999Z", "2026-11-30T14:00:00.000Z"],
      ["2026-11-30T14:00:00.000Z", "2026-12-07T14:00:00.000Z"],
      ["2026-12-01T09:00:00.000Z", "2026-12-07T14:00:00.000Z"]
    ])("runs next after %s on Monday %s", (now, expected) => {
      expect(nextDigestRunAt(new Date(now)).toISOString()).toBe(expected);
    });
  });

  describe(digestWeekEndingBefore.name, () => {
    it("reports on the week that ended the Sunday before the run", () => {
      expect(digestWeekEndingBefore(new Date("2026-11-30T14:00:00.000Z"))).toBe("2026-11-29");
    });
  });

  describe(crossedMilestone.name, () => {
    it.each([
      [0, 9, undefined],
      [9, 10, 10],
      [10, 49, undefined],
      [40, 60, 50],
      [99, 100, 100],
      [200, 260, 250],
      [499, 500, 500],
      [600, 1000, 1000],
      [1000, 2499, undefined],
      [2000, 2500, 2500],
      [4000, 5000, 5000],
      [9999, 10000, 10000],
      [20000, 25000, 25000],
      [8, 120, 100],
      [120, 120, undefined]
    ])("from %s to %s deploys crosses %s", (before, after, expected) => {
      expect(crossedMilestone(before, after)).toBe(expected);
    });
  });

  describe(digestEntryOf.name, () => {
    const template = { id: "tpl-1", title: "Postgres 16" };

    it("sums up the week with its top hint", () => {
      const hint = { kind: "few_get_a_provider" as const, tone: "warning" as const, value: 0.4, previousValue: null, version: null };

      expect(
        digestEntryOf(
          template,
          insights({ current: totals({ views: 120, deploys: 12, stillRunning: 5 }), previous: totals({ deploys: 8 }), hints: [hint, { ...hint, tone: "info" }] })
        )
      ).toEqual({ templateId: "tpl-1", title: "Postgres 16", views: 120, deploys: 12, previousDeploys: 8, stillRunning: 5, hint });
    });

    it.each<[Partial<InsightTotals>]>([[{ views: 1 }], [{ configureOpens: 1 }], [{ deploys: 1 }], [{ forks: 1 }]])("counts %o as a week with activity", current => {
      expect(digestEntryOf(template, insights({ current: totals(current) }))).toMatchObject({ templateId: "tpl-1", hint: undefined });
    });

    it("leaves out a week nobody used the template, whatever happened the week before", () => {
      expect(digestEntryOf(template, insights({ previous: totals({ views: 40, deploys: 3 }) }))).toBeUndefined();
    });
  });

  function totals(overrides: Partial<InsightTotals> = {}): InsightTotals {
    return {
      views: 0,
      configureOpens: 0,
      deploys: 0,
      leases: 0,
      decidedLeases: 0,
      stillRunning: 0,
      forks: 0,
      leaseRate: null,
      stillRunningRate: null,
      viewToDeployRate: null,
      ...overrides
    };
  }

  function insights(overrides: Partial<TemplateInsights>): TemplateInsights {
    return { days: 7, from: "2026-11-23", to: "2026-11-29", current: totals(), previous: totals(), daily: [], versions: [], hints: [], ...overrides };
  }
});
