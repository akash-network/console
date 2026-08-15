import { describe, expect, it } from "vitest";

import { envSchema } from "@src/config/env.config";
import { IndexerState } from "@src/db/schema";
import { StatusResponseSchema } from "@src/http-schemas/status.schema";
import type { ChainDatabase } from "@src/providers/db.provider";
import { StatusService } from "@src/services/status/status.service";

describe(StatusService.name, () => {
  it("returns checkpoints with dead-letter counts grouped by type", async () => {
    const { service } = setup({
      checkpoints: [{ stream: "sync", lastHeight: 42, updatedAt: new Date("2026-08-14T00:00:00Z") }],
      deadLetterCounts: [
        { type: "/akash.unknown.v1.MsgMystery", count: 2 },
        { type: "/cosmos.unknown.v1.MsgOther", count: 1 }
      ]
    });

    const status = await service.getStatus();

    expect(status.data.network).toBe("sandbox");
    expect(status.data.role).toBe("sync");
    expect(status.data.checkpoints).toEqual([{ stream: "sync", lastHeight: 42, updatedAt: "2026-08-14T00:00:00.000Z" }]);
    expect(status.data.deadLetters).toEqual({
      total: 3,
      byType: [
        { type: "/akash.unknown.v1.MsgMystery", count: 2 },
        { type: "/cosmos.unknown.v1.MsgOther", count: 1 }
      ]
    });
    expect(StatusResponseSchema.parse(status)).toEqual(status);
  });

  it("reports zero dead letters when the store is empty", async () => {
    const { service } = setup({ checkpoints: [], deadLetterCounts: [] });

    const status = await service.getStatus();

    expect(status.data.deadLetters).toEqual({ total: 0, byType: [] });
  });

  function setup(input: {
    checkpoints: Array<{ stream: string; lastHeight: number; updatedAt: Date }>;
    deadLetterCounts: Array<{ type: string; count: number }>;
  }) {
    const dbFake = {
      select: () => ({
        from: (table: unknown) =>
          Object.assign(Promise.resolve(table === IndexerState ? input.checkpoints : []), {
            innerJoin: () => ({ groupBy: () => Promise.resolve(input.deadLetterCounts) })
          })
      })
    };

    const config = envSchema.parse({ POSTGRES_DB_URI: "postgres://unit:unit@localhost:5432/unit" });
    const service = new StatusService(dbFake as unknown as ChainDatabase, config);
    return { service };
  }
});
