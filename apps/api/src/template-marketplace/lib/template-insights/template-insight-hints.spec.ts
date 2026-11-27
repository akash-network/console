import { describe, expect, it } from "vitest";

import { findInsightHints } from "./template-insight-hints";
import type { InsightTotals, VersionInsight } from "./template-insights";

describe(findInsightHints.name, () => {
  it("gives no hint to a template without usage", () => {
    expect(findInsightHints({ current: totals(), previous: totals(), versions: [] })).toEqual([]);
  });

  describe("when few deployments get a provider", () => {
    it("warns once there are enough deployments behind the rate", () => {
      const hints = findInsightHints({ current: totals({ deploys: 10, leaseRate: 0.59 }), previous: totals(), versions: [] });

      expect(hints).toEqual([{ kind: "few_get_a_provider", tone: "warning", value: 0.59, previousValue: null, version: null }]);
    });

    it.each([
      { deploys: 9, leaseRate: 0.1 },
      { deploys: 10, leaseRate: 0.6 },
      { deploys: 10, leaseRate: null }
    ])("stays quiet with $deploys deploys and a $leaseRate lease rate", ({ deploys, leaseRate }) => {
      const hints = findInsightHints({ current: totals({ deploys, leaseRate }), previous: totals(), versions: [] });

      expect(kindsOf(hints)).not.toContain("few_get_a_provider");
    });
  });

  describe("when few deployments are still running a day later", () => {
    it("warns below half", () => {
      const hints = findInsightHints({ current: totals({ stillRunningRate: 0.49 }), previous: totals(), versions: [] });

      expect(hints).toEqual([{ kind: "few_still_running", tone: "warning", value: 0.49, previousValue: null, version: null }]);
    });

    it.each([0.5, null])("stays quiet with a %s still-running rate", stillRunningRate => {
      const hints = findInsightHints({ current: totals({ stillRunningRate }), previous: totals(), versions: [] });

      expect(kindsOf(hints)).not.toContain("few_still_running");
    });
  });

  describe("when many people look but few deploy", () => {
    it("suggests improving the page", () => {
      const hints = findInsightHints({ current: totals({ views: 50, viewToDeployRate: 0.019 }), previous: totals(), versions: [] });

      expect(hints).toEqual([{ kind: "few_viewers_deploy", tone: "info", value: 0.019, previousValue: null, version: null }]);
    });

    it.each([
      { views: 49, viewToDeployRate: 0 },
      { views: 50, viewToDeployRate: 0.02 },
      { views: 50, viewToDeployRate: null }
    ])("stays quiet with $views views and a $viewToDeployRate deploy rate", ({ views, viewToDeployRate }) => {
      const hints = findInsightHints({ current: totals({ views, viewToDeployRate }), previous: totals(), versions: [] });

      expect(kindsOf(hints)).not.toContain("few_viewers_deploy");
    });
  });

  describe("when the latest version does worse than the one before", () => {
    it("warns that it gets a provider less often", () => {
      const versions = [version({ version: 1, deploys: 10, leaseRate: 0.9 }), version({ version: 2, deploys: 10, leaseRate: 0.7 })];

      const hints = findInsightHints({ current: totals(), previous: totals(), versions });

      expect(hints).toEqual([{ kind: "latest_version_gets_fewer_providers", tone: "warning", value: 0.7, previousValue: 0.9, version: 2 }]);
    });

    it("warns that it stops running more often", () => {
      const versions = [version({ version: 3, stillRunningRate: 0.5 }), version({ version: 1, stillRunningRate: 0.7 }), version({ version: 2, deploys: 0 })];

      const hints = findInsightHints({ current: totals(), previous: totals(), versions });

      expect(hints).toEqual([{ kind: "latest_version_stops_more", tone: "warning", value: 0.5, previousValue: 0.7, version: 3 }]);
    });

    it.each([
      { label: "drops just under 20 points", earlier: { leaseRate: 0.9, stillRunningRate: 0.9 }, latest: { leaseRate: 0.704, stillRunningRate: 0.704 } },
      { label: "has too few deploys for its lease rate", earlier: { leaseRate: 0.9, deploys: 9 }, latest: { leaseRate: 0.1 } },
      { label: "has no rate", earlier: { leaseRate: 0.9, stillRunningRate: 0.9 }, latest: { leaseRate: null, stillRunningRate: null } },
      { label: "compares to no rate", earlier: { leaseRate: null, stillRunningRate: null }, latest: { leaseRate: 0, stillRunningRate: 0 } }
    ])("stays quiet when the latest version $label", ({ earlier, latest }) => {
      const versions = [version({ version: 1, ...earlier }), version({ version: 2, ...latest })];

      expect(findInsightHints({ current: totals(), previous: totals(), versions })).toEqual([]);
    });

    it("stays quiet with a single deployed version", () => {
      const versions = [version({ version: 1, deploys: 0 }), version({ version: 2, leaseRate: 0, stillRunningRate: 0 })];

      expect(findInsightHints({ current: totals(), previous: totals(), versions })).toEqual([]);
    });
  });

  describe("when things go well", () => {
    it("says deploys are growing once they reach half again the previous period", () => {
      const hints = findInsightHints({ current: totals({ deploys: 6 }), previous: totals({ deploys: 4 }), versions: [] });

      expect(hints).toEqual([{ kind: "deploys_growing", tone: "positive", value: 6, previousValue: 4, version: null }]);
    });

    it.each([
      { current: 4, previous: 0 },
      { current: 8, previous: 6 }
    ])("does not call $current deploys after $previous growth", ({ current, previous }) => {
      const hints = findInsightHints({ current: totals({ deploys: current }), previous: totals({ deploys: previous }), versions: [] });

      expect(kindsOf(hints)).not.toContain("deploys_growing");
    });

    it("says deployments keep running once enough have been followed for a day", () => {
      const hints = findInsightHints({ current: totals({ decidedLeases: 10, stillRunningRate: 0.8 }), previous: totals(), versions: [] });

      expect(hints).toEqual([{ kind: "running_well", tone: "positive", value: 0.8, previousValue: null, version: null }]);
    });

    it.each([
      { decidedLeases: 9, stillRunningRate: 1 },
      { decidedLeases: 10, stillRunningRate: 0.79 },
      { decidedLeases: 10, stillRunningRate: null }
    ])("does not praise $decidedLeases followed deployments at $stillRunningRate", ({ decidedLeases, stillRunningRate }) => {
      const hints = findInsightHints({ current: totals({ decidedLeases, stillRunningRate }), previous: totals(), versions: [] });

      expect(kindsOf(hints)).not.toContain("running_well");
    });

    it("holds praise back while something needs fixing", () => {
      const hints = findInsightHints({
        current: totals({ deploys: 20, leaseRate: 0.5, decidedLeases: 10, stillRunningRate: 0.9 }),
        previous: totals({ deploys: 2 }),
        versions: []
      });

      expect(kindsOf(hints)).toEqual(["few_get_a_provider"]);
    });

    it("keeps praise next to a suggestion that is not a warning", () => {
      const hints = findInsightHints({ current: totals({ deploys: 6, views: 400, viewToDeployRate: 0.015 }), previous: totals(), versions: [] });

      expect(kindsOf(hints)).toEqual(["few_viewers_deploy", "deploys_growing"]);
    });
  });

  it("lists warnings first, then suggestions, then praise", () => {
    const hints = findInsightHints({
      current: totals({ views: 100, viewToDeployRate: 0.01, stillRunningRate: 0.2 }),
      previous: totals(),
      versions: [version({ version: 1, leaseRate: 1, deploys: 10 }), version({ version: 2, leaseRate: 0.5, deploys: 10 })]
    });

    expect(kindsOf(hints)).toEqual(["few_still_running", "latest_version_gets_fewer_providers", "few_viewers_deploy"]);
  });

  function kindsOf(hints: ReturnType<typeof findInsightHints>) {
    return hints.map(({ kind }) => kind);
  }

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

  function version(overrides: Partial<VersionInsight> & Pick<VersionInsight, "version">): VersionInsight {
    return { deploys: 10, leases: 0, decidedLeases: 0, stillRunning: 0, leaseRate: null, stillRunningRate: null, ...overrides };
  }
});
