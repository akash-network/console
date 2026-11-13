import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SinkUnbondingsResponse } from "@src/dashboard/http-schemas/sink-unbondings/sink-unbondings.schema";
import type { StatsService } from "@src/dashboard/services/stats/stats.service";
import { SinkUnbondingsController } from "./sink-unbondings.controller";

describe(SinkUnbondingsController.name, () => {
  it("returns the unbondings the stats service finds", async () => {
    const { controller, statsService, unbondings } = setup();

    const result = await controller.getUnbondings();

    expect(result).toBe(unbondings);
    expect(statsService.getSinkUnbondings).toHaveBeenCalledWith();
  });

  function setup() {
    const statsService = mock<StatsService>();
    const unbondings: SinkUnbondingsResponse = {
      summary: { unbondingUakt: 420, unbondingDelegators: 2, senders: 3, sendersWhoUnbonded: 2, sentUakt: 220, sentBySendersWhoUnbondedUakt: 160 },
      daily: [{ date: "2026-11-12", unbondStartedUakt: 0, unbondCompletingUakt: 0, cancelledUakt: 0, sentToSolanaUakt: 220, sentBySendersWhoUnbondedUakt: 160 }]
    };
    statsService.getSinkUnbondings.mockResolvedValue(unbondings);

    const controller = new SinkUnbondingsController(statsService);

    return { controller, statsService, unbondings };
  }
});
