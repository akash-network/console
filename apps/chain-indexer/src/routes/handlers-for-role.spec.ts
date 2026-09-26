import { describe, expect, it } from "vitest";

import { addressTransactionsRouter, blocksRouter, healthzRouter, networkStatsRouter, statusRouter } from "@src/routes";
import { handlersForRole } from "@src/routes/handlers-for-role";

describe(handlersForRole.name, () => {
  it("mounts the query routers on the api role only", () => {
    expect(handlersForRole("api")).toEqual([healthzRouter, statusRouter, blocksRouter, addressTransactionsRouter, networkStatsRouter]);
  });

  it.each(["sync", "backfill", "jobs"] as const)("serves only health and status on the %s role", role => {
    expect(handlersForRole(role)).toEqual([healthzRouter, statusRouter]);
  });
});
