import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SinkDashboardDataResponse, SinkPeriodData } from "@src/dashboard/http-schemas/sink-dashboard-data/sink-dashboard-data.schema";
import type { StatsService } from "@src/dashboard/services/stats/stats.service";
import { SinkDashboardDataController } from "./sink-dashboard-data.controller";

describe(SinkDashboardDataController.name, () => {
  it("returns the sink dashboard data of the stats service", async () => {
    const { controller, statsService, dashboardData } = setup();

    const result = await controller.getDashboardData();

    expect(result).toBe(dashboardData);
    expect(statsService.getSinkDashboardData).toHaveBeenCalledOnce();
  });

  function setup() {
    const statsService = mock<StatsService>();
    const period: SinkPeriodData = {
      date: "2026-11-11T12:00:00.000Z",
      mintedUakt: 900,
      dailyMintedUakt: 300,
      mintedTransfers: 9,
      dailyMintedTransfers: 4,
      pendingUakt: 50,
      pendingTransfers: 2,
      voidedUakt: 30,
      voidedTransfers: 3,
      refundPendingUakt: 20,
      refundPendingTransfers: 1,
      refundedUakt: 10,
      refundedTransfers: 4,
      uniqueSenders: 21,
      medianSecondsToMint: 162.5
    };
    const dashboardData: SinkDashboardDataResponse = { now: period, compare: { ...period, date: "2026-11-10T12:00:00.000Z", mintedUakt: 600 } };
    statsService.getSinkDashboardData.mockResolvedValue(dashboardData);

    const controller = new SinkDashboardDataController(statsService);

    return { controller, statsService, dashboardData };
  }
});
