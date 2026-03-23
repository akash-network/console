import { add } from "date-fns";
import { describe, expect, it, vi } from "vitest";

import { getDailyRevenue, getWeb3IndexRevenue } from "./networkRevenueService";

// NOTE: vi.mock is used here because networkRevenueService uses Sequelize models
// directly rather than injected repositories. Ideally this module would be
// refactored to accept dependencies via DI and tested with mock<T>() instead.
vi.mock("@akashnetwork/database/dbSchemas/base", () => ({
  Day: { findAll: vi.fn() }
}));

vi.mock("@akashnetwork/database/dbSchemas/akash", () => ({
  AkashBlock: {}
}));

vi.mock("@src/utils", () => ({
  getTodayUTC: vi.fn()
}));

import { Day } from "@akashnetwork/database/dbSchemas/base";

import { getTodayUTC } from "@src/utils";

describe("networkRevenueService", () => {
  describe(getDailyRevenue.name, () => {
    it("combines totalUUsdcSpent and totalUActSpent into uact", async () => {
      const { dayFindAll } = setup();
      dayFindAll.mockResolvedValue([
        { date: new Date("2024-01-01"), aktPrice: 2, lastBlockYet: { totalUAktSpent: 1000, totalUUsdcSpent: 500, totalUActSpent: 200 } },
        { date: new Date("2024-01-02"), aktPrice: 3, lastBlockYet: { totalUAktSpent: 2000, totalUUsdcSpent: 800, totalUActSpent: 400 } }
      ] as never);

      const result = await getDailyRevenue();

      expect(result).toHaveLength(2);
      expect(result[0].uact).toBe(700);
      expect(result[1].uact).toBe(500);
    });

    it("computes relative daily values for uakt and uact", async () => {
      const { dayFindAll } = setup();
      dayFindAll.mockResolvedValue([
        { date: new Date("2024-01-01"), aktPrice: 2, lastBlockYet: { totalUAktSpent: 1000, totalUUsdcSpent: 300, totalUActSpent: 100 } },
        { date: new Date("2024-01-02"), aktPrice: 2, lastBlockYet: { totalUAktSpent: 1500, totalUUsdcSpent: 600, totalUActSpent: 200 } },
        { date: new Date("2024-01-03"), aktPrice: 2, lastBlockYet: { totalUAktSpent: 2200, totalUUsdcSpent: 1000, totalUActSpent: 350 } }
      ] as never);

      const result = await getDailyRevenue();

      expect(result[0]).toEqual(expect.objectContaining({ uakt: 1000, uact: 400 }));
      expect(result[1]).toEqual(expect.objectContaining({ uakt: 500, uact: 400 }));
      expect(result[2]).toEqual(expect.objectContaining({ uakt: 700, uact: 550 }));
    });

    it("converts uact to act and computes usd from akt price", async () => {
      const { dayFindAll } = setup();
      dayFindAll.mockResolvedValue([
        { date: new Date("2024-01-01"), aktPrice: 4, lastBlockYet: { totalUAktSpent: 2_000_000, totalUUsdcSpent: 1_000_000, totalUActSpent: 500_000 } }
      ] as never);

      const result = await getDailyRevenue();

      expect(result[0].akt).toBe(2);
      expect(result[0].act).toBe(1.5);
      expect(result[0].usd).toBe(2 * 4 + 1.5);
    });

    it("returns zeros when block values are zero", async () => {
      const { dayFindAll } = setup();
      dayFindAll.mockResolvedValue([
        { date: new Date("2024-01-01"), aktPrice: 1, lastBlockYet: { totalUAktSpent: 0, totalUUsdcSpent: 0, totalUActSpent: 0 } }
      ] as never);

      const result = await getDailyRevenue();

      expect(result[0]).toEqual(expect.objectContaining({ uakt: 0, uact: 0, usd: 0 }));
    });
  });

  describe(getWeb3IndexRevenue.name, () => {
    it("strips debug fields from days in non-debug mode", async () => {
      const { dayFindAll, todayUTC } = setup();
      todayUTC.mockReturnValue(new Date("2024-06-15T00:00:00Z"));
      dayFindAll.mockResolvedValue([
        { date: new Date("2024-06-14"), aktPrice: 2, lastBlockYet: { totalUAktSpent: 1000, totalUUsdcSpent: 500, totalUActSpent: 300 } }
      ] as never);

      const result = await getWeb3IndexRevenue();

      expect(result.days).toHaveLength(1);
      expect(result.days[0]).toHaveProperty("date");
      expect(result.days[0]).toHaveProperty("revenue");
      expect(result.days[0]).not.toHaveProperty("revenueUAct");
      expect(result.days[0]).not.toHaveProperty("revenueUAkt");
    });

    it("includes revenueUAct and aktPrice in debug mode", async () => {
      const { dayFindAll, todayUTC } = setup();
      todayUTC.mockReturnValue(new Date("2024-06-15T00:00:00Z"));
      dayFindAll.mockResolvedValue([
        { date: new Date("2024-06-14"), aktPrice: 2, lastBlockYet: { totalUAktSpent: 1000, totalUUsdcSpent: 500, totalUActSpent: 300 } }
      ] as never);

      const result = await getWeb3IndexRevenue(true);

      expect(result.days[0]).toHaveProperty("revenueUAct");
      expect(result.days[0]).toHaveProperty("revenueUAkt");
      expect(result.days[0]).toHaveProperty("aktPrice");
    });

    it("accumulates revenue into time-period buckets", async () => {
      const { dayFindAll, todayUTC } = setup();
      const today = new Date("2024-06-15T00:00:00Z");
      todayUTC.mockReturnValue(today);

      const M = 1_000_000;
      const daysData = [
        { date: add(today, { days: -100 }), aktPrice: 2, totalUAktSpent: 10 * M, totalUUsdcSpent: 5 * M, totalUActSpent: 2 * M },
        { date: add(today, { days: -50 }), aktPrice: 2, totalUAktSpent: 30 * M, totalUUsdcSpent: 15 * M, totalUActSpent: 7 * M },
        { date: add(today, { days: -20 }), aktPrice: 2, totalUAktSpent: 60 * M, totalUUsdcSpent: 30 * M, totalUActSpent: 15 * M },
        { date: add(today, { days: -5 }), aktPrice: 2, totalUAktSpent: 100 * M, totalUUsdcSpent: 50 * M, totalUActSpent: 25 * M },
        { date: add(today, { days: -1 }), aktPrice: 2, totalUAktSpent: 150 * M, totalUUsdcSpent: 75 * M, totalUActSpent: 37 * M }
      ];

      dayFindAll.mockResolvedValue(
        daysData.map(d => ({
          date: d.date,
          aktPrice: d.aktPrice,
          lastBlockYet: { totalUAktSpent: d.totalUAktSpent, totalUUsdcSpent: d.totalUUsdcSpent, totalUActSpent: d.totalUActSpent }
        })) as never
      );

      const result = await getWeb3IndexRevenue();

      expect(result.revenue.now).toBeGreaterThan(0);
      expect(result.revenue.ninetyDaysAgo).toBeGreaterThanOrEqual(0);
      expect(result.days).toHaveLength(5);
    });

    it("includes Act breakdown in debug mode revenue stats", async () => {
      const { dayFindAll, todayUTC } = setup();
      const today = new Date("2024-06-15T00:00:00Z");
      todayUTC.mockReturnValue(today);

      dayFindAll.mockResolvedValue([
        { date: add(today, { days: -2 }), aktPrice: 3, lastBlockYet: { totalUAktSpent: 3_000_000, totalUUsdcSpent: 1_000_000, totalUActSpent: 500_000 } },
        { date: add(today, { days: -1 }), aktPrice: 3, lastBlockYet: { totalUAktSpent: 6_000_000, totalUUsdcSpent: 2_000_000, totalUActSpent: 1_000_000 } }
      ] as never);

      const result = await getWeb3IndexRevenue(true);

      expect(result.revenue).toHaveProperty("nowAct");
      expect(result.revenue).toHaveProperty("oneDayAgoAct");
      expect(result.revenue).toHaveProperty("nowAkt");
      expect(result.revenue.nowAct).toBeGreaterThan(0);
    });

    it("returns zero revenue when no data exists", async () => {
      const { dayFindAll, todayUTC } = setup();
      todayUTC.mockReturnValue(new Date("2024-06-15T00:00:00Z"));
      dayFindAll.mockResolvedValue([] as never);

      const result = await getWeb3IndexRevenue();

      expect(result.days).toHaveLength(0);
      expect(result.revenue.now).toBe(0);
      expect(result.revenue.oneDayAgo).toBe(0);
    });
  });

  function setup() {
    const dayFindAll = vi.mocked(Day.findAll);
    const todayUTC = vi.mocked(getTodayUTC);

    dayFindAll.mockReset();
    todayUTC.mockReset();

    return { dayFindAll, todayUTC };
  }
});
