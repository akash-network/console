import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DbHealthcheck } from "@src/providers/postgres.provider";
import { HealthzController } from "./healthz.controller";

describe(HealthzController.name, () => {
  it("returns 200 with ok status when DB ping succeeds", async () => {
    const { controller } = setup();

    const result = await controller.getLivenessStatus();

    expect(result).toEqual({ response: { data: { status: "ok" } }, status: 200 });
  });

  it("returns 503 with error status when DB ping fails", async () => {
    const { controller } = setup({
      dbPingError: new Error("connection refused")
    });

    const result = await controller.getLivenessStatus();

    expect(result).toEqual({ response: { data: { status: "error" } }, status: 503 });
  });

  function setup(input?: { dbPingError?: Error }) {
    const dbHealthcheck = mock<DbHealthcheck>();

    if (input?.dbPingError) {
      dbHealthcheck.ping.mockRejectedValue(input.dbPingError);
    } else {
      dbHealthcheck.ping.mockResolvedValue(undefined);
    }

    const controller = new HealthzController(dbHealthcheck, () => mock());

    return { controller, dbHealthcheck };
  }
});
