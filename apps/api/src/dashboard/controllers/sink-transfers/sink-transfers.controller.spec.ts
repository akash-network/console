import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SinkTransfersQuery, SinkTransfersResponse } from "@src/dashboard/http-schemas/sink-transfers/sink-transfers.schema";
import type { StatsService } from "@src/dashboard/services/stats/stats.service";
import { SinkTransfersController } from "./sink-transfers.controller";

describe(SinkTransfersController.name, () => {
  it("returns the sink transfers the stats service finds for the query", async () => {
    const { controller, statsService, transfers } = setup();
    const query: SinkTransfersQuery = { skip: 20, limit: 10, sort: "largest" };

    const result = await controller.getTransfers(query);

    expect(result).toBe(transfers);
    expect(statsService.getSinkTransfers).toHaveBeenCalledWith(query);
  });

  function setup() {
    const statsService = mock<StatsService>();
    const transfers: SinkTransfersResponse = {
      count: 1,
      results: [
        {
          owner: "akash1first",
          height: 29448411,
          sequence: 1,
          recipient: "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV",
          amountUakt: 975031000000,
          status: "minted",
          createdAt: "2026-11-11T12:00:00.000Z",
          statusHeight: 29448440,
          statusUpdatedAt: "2026-11-11T12:03:00.000Z"
        }
      ]
    };
    statsService.getSinkTransfers.mockResolvedValue(transfers);

    const controller = new SinkTransfersController(statsService);

    return { controller, statsService, transfers };
  }
});
