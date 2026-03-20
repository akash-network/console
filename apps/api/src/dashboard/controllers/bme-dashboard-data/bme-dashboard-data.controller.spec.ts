import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BmeDashboardDataResponse } from "@src/dashboard/http-schemas/bme-dashboard-data/bme-dashboard-data.schema";
import type { StatsService } from "@src/dashboard/services/stats/stats.service";
import { BmeDashboardDataController } from "./bme-dashboard-data.controller";

describe(BmeDashboardDataController.name, () => {
  it("delegates to statsService.getBmeDashboardData", async () => {
    const { controller, statsService, mockResponse } = setup();

    const result = await controller.getDashboardData();

    expect(result).toBe(mockResponse);
    expect(statsService.getBmeDashboardData).toHaveBeenCalledOnce();
  });

  function setup() {
    const statsService = mock<StatsService>();
    const mockResponse: BmeDashboardDataResponse = {
      now: {
        date: "2024-01-03T12:00:00.000Z",
        outstandingAct: 1000,
        vaultAkt: 5000,
        collateralRatio: 1.5,
        dailyAktBurnedForAct: 100,
        totalAktBurnedForAct: 500,
        dailyActMinted: 50,
        totalActMinted: 200,
        dailyActBurnedForAkt: 10,
        totalActBurnedForAkt: 50,
        dailyAktReminted: 5,
        totalAktReminted: 20,
        dailyNetAktBurned: 95,
        netAktBurned: 480
      },
      compare: {
        date: "2024-01-02T12:00:00.000Z",
        outstandingAct: 800,
        vaultAkt: 4000,
        collateralRatio: 1.4,
        dailyAktBurnedForAct: 80,
        totalAktBurnedForAct: 400,
        dailyActMinted: 40,
        totalActMinted: 150,
        dailyActBurnedForAkt: 8,
        totalActBurnedForAkt: 40,
        dailyAktReminted: 4,
        totalAktReminted: 15,
        dailyNetAktBurned: 76,
        netAktBurned: 385
      }
    };
    statsService.getBmeDashboardData.mockResolvedValue(mockResponse);

    const controller = new BmeDashboardDataController(statsService as unknown as StatsService);

    return { controller, statsService, mockResponse };
  }
});
