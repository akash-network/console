import { describe, expect, it } from "vitest";

import { buildTemplateInsights, type InsightSources, insightWindowOf, isInsightPeriod, ratesOf } from "./template-insights";

describe("template insights", () => {
  describe(insightWindowOf.name, () => {
    it("covers the last given days up to today in UTC, and as many days before them", () => {
      expect(insightWindowOf(new Date("2026-11-27T23:30:00-05:00"), 7)).toEqual({
        days: 7,
        from: "2026-11-22",
        to: "2026-11-28",
        previousFrom: "2026-11-15"
      });
    });

    it("crosses month boundaries", () => {
      expect(insightWindowOf(new Date("2026-03-01T00:00:00Z"), 30)).toEqual({ days: 30, from: "2026-01-31", to: "2026-03-01", previousFrom: "2026-01-01" });
    });
  });

  describe(isInsightPeriod.name, () => {
    it.each([
      [7, true],
      [30, true],
      [90, true],
      [14, false]
    ])("answers %s for %s", (days, expected) => {
      expect(isInsightPeriod(days)).toBe(expected);
    });
  });

  describe(ratesOf.name, () => {
    it("answers each rate once enough is behind it", () => {
      expect(ratesOf({ views: 20, deploys: 5, leases: 4, decidedLeases: 5, stillRunning: 2 })).toEqual({
        leaseRate: 0.8,
        stillRunningRate: 0.4,
        viewToDeployRate: 0.25
      });
    });

    it("answers no rate on too little", () => {
      expect(ratesOf({ views: 19, deploys: 4, leases: 4, decidedLeases: 4, stillRunning: 4 })).toEqual({
        leaseRate: null,
        stillRunningRate: null,
        viewToDeployRate: null
      });
    });

    it("never answers more deploys than views", () => {
      expect(ratesOf({ views: 20, deploys: 30, leases: 0, decidedLeases: 0, stillRunning: 0 }).viewToDeployRate).toBe(1);
    });
  });

  describe(buildTemplateInsights.name, () => {
    const window = insightWindowOf(new Date("2026-11-27T12:00:00Z"), 7);

    it("answers a zero for every day of a template without usage", () => {
      const insights = buildTemplateInsights(window, sources());

      expect(insights).toMatchObject({ days: 7, from: "2026-11-21", to: "2026-11-27", versions: [], hints: [] });
      expect(insights.daily.map(({ day }) => day)).toEqual(["2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27"]);
      expect(insights.daily.every(({ views, configureOpens, deploys, leases, stillRunning }) => views + configureOpens + deploys + leases + stillRunning === 0)).toBe(
        true
      );
      expect(insights.current).toEqual(insights.previous);
    });

    it("puts each day in its period and adds them up", () => {
      const insights = buildTemplateInsights(
        window,
        sources({
          views: [
            { day: "2026-11-21", kind: "page_view", viewers: 30 },
            { day: "2026-11-27", kind: "page_view", viewers: 10 },
            { day: "2026-11-27", kind: "configure_open", viewers: 4 },
            { day: "2026-11-20", kind: "page_view", viewers: 7 }
          ],
          deploys: [
            { day: "2026-11-22", deploys: 5, leases: 4, decidedLeases: 4, stillRunning: 3 },
            { day: "2026-11-13", deploys: 9, leases: 9, decidedLeases: 9, stillRunning: 9 },
            { day: "2026-11-15", deploys: 2, leases: 1, decidedLeases: 1, stillRunning: 0 }
          ],
          forks: [
            { day: "2026-11-23", forks: 2 },
            { day: "2026-11-16", forks: 1 }
          ]
        })
      );

      expect(insights.current).toEqual({
        views: 40,
        configureOpens: 4,
        deploys: 5,
        leases: 4,
        decidedLeases: 4,
        stillRunning: 3,
        forks: 2,
        leaseRate: 0.8,
        stillRunningRate: null,
        viewToDeployRate: 0.125
      });
      expect(insights.previous).toEqual({
        views: 7,
        configureOpens: 0,
        deploys: 2,
        leases: 1,
        decidedLeases: 1,
        stillRunning: 0,
        forks: 1,
        leaseRate: null,
        stillRunningRate: null,
        viewToDeployRate: null
      });
      expect(insights.daily[1]).toEqual({ day: "2026-11-22", views: 0, configureOpens: 0, deploys: 5, leases: 4, stillRunning: 3 });
      expect(insights.daily[6]).toEqual({ day: "2026-11-27", views: 10, configureOpens: 4, deploys: 0, leases: 0, stillRunning: 0 });
    });

    it("rates each version and finds hints in the numbers", () => {
      const insights = buildTemplateInsights(
        window,
        sources({
          versions: [
            { version: 1, deploys: 10, leases: 9, decidedLeases: 9, stillRunning: 8 },
            { version: 2, deploys: 10, leases: 5, decidedLeases: 4, stillRunning: 4 }
          ]
        })
      );

      expect(insights.versions).toEqual([
        { version: 1, deploys: 10, leases: 9, decidedLeases: 9, stillRunning: 8, leaseRate: 0.9, stillRunningRate: 8 / 9 },
        { version: 2, deploys: 10, leases: 5, decidedLeases: 4, stillRunning: 4, leaseRate: 0.5, stillRunningRate: null }
      ]);
      expect(insights.hints).toEqual([{ kind: "latest_version_gets_fewer_providers", tone: "warning", value: 0.5, previousValue: 0.9, version: 2 }]);
    });
  });

  function sources(overrides: Partial<InsightSources> = {}): InsightSources {
    return { views: [], deploys: [], forks: [], versions: [], ...overrides };
  }
});
