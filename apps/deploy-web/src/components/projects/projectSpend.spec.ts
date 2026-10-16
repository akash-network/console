import { describe, expect, it } from "vitest";

import type { ProjectBudget } from "@src/types/project-budget";
import { budgetAccessFor, budgetStandingOf, budgetUsedPercent, formatSpendUsd, thisMonthSpendRange } from "./projectSpend";

describe(thisMonthSpendRange.name, () => {
  it("runs this month from its first day to today", () => {
    expect(thisMonthSpendRange(new Date("2026-03-15T23:30:00.000Z"))).toEqual({ startDate: "2026-03-01", endDate: "2026-03-15" });
  });

  it("reads the calendar in UTC", () => {
    expect(thisMonthSpendRange(new Date("2026-04-01T00:30:00.000+02:00"))).toEqual({ startDate: "2026-03-01", endDate: "2026-03-31" });
  });

  it("defaults to the current date", () => {
    const today = new Date().toISOString().slice(0, 10);

    expect(thisMonthSpendRange()).toEqual({ startDate: `${today.slice(0, 7)}-01`, endDate: today });
  });
});

describe(formatSpendUsd.name, () => {
  it("shows dollars and cents with grouping", () => {
    expect(formatSpendUsd(1234.5)).toBe("$1,234.50");
    expect(formatSpendUsd(0)).toBe("$0.00");
  });
});

describe(budgetAccessFor.name, () => {
  it("lets owners and admins manage every budget", () => {
    expect(budgetAccessFor("owner", undefined)).toEqual({ canManage: true, canRead: true });
    expect(budgetAccessFor("admin", undefined)).toEqual({ canManage: true, canRead: true });
  });

  it("lets billing read every budget without changing it", () => {
    expect(budgetAccessFor("billing", undefined)).toEqual({ canManage: false, canRead: true });
  });

  it("lets a member read the budget of a project it administers", () => {
    expect(budgetAccessFor("member", "admin")).toEqual({ canManage: false, canRead: true });
  });

  it("shows no budget to other members, to viewers or before the role is known", () => {
    expect(budgetAccessFor("member", "member")).toEqual({ canManage: false, canRead: false });
    expect(budgetAccessFor("member", undefined)).toEqual({ canManage: false, canRead: false });
    expect(budgetAccessFor("viewer", "admin")).toEqual({ canManage: false, canRead: false });
    expect(budgetAccessFor(undefined, undefined)).toEqual({ canManage: false, canRead: false });
  });
});

describe(budgetStandingOf.name, () => {
  it("is within the budget below the alert threshold", () => {
    expect(budgetStandingOf(budget({ committedUsd: 79.99 }))).toBe("within");
  });

  it("is past the alert once the threshold is reached", () => {
    expect(budgetStandingOf(budget({ committedUsd: 80 }))).toBe("past-alert");
    expect(budgetStandingOf(budget({ committedUsd: 99.99 }))).toBe("past-alert");
  });

  it("has reached the budget once committed spend equals or passes it", () => {
    expect(budgetStandingOf(budget({ committedUsd: 100 }))).toBe("reached");
    expect(budgetStandingOf(budget({ committedUsd: 140 }))).toBe("reached");
  });
});

describe(budgetUsedPercent.name, () => {
  it("is the committed share of the monthly amount", () => {
    expect(budgetUsedPercent(budget({ committedUsd: 25 }))).toBe(25);
  });

  it("reads above 100 past the budget", () => {
    expect(budgetUsedPercent(budget({ committedUsd: 140 }))).toBe(140);
  });
});

function budget({ committedUsd }: { committedUsd: number }): ProjectBudget {
  return {
    id: "budget-1",
    projectId: "storefront",
    monthlyAmountUsd: 100,
    alertThresholdPercent: 80,
    stopTopUps: false,
    currentPeriod: { startDate: "2026-03-01", endDate: "2026-03-31", committedUsd },
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z"
  };
}
