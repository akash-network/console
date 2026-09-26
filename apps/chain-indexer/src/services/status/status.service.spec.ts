import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { envSchema } from "@src/config/env.config";
import type { DeferredIndexService } from "@src/db/deferred-index.service";
import { IndexerState, JobRuns } from "@src/db/schema";
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
    expect(status.data.deferredIndexes).toEqual([]);
    expect(status.data.jobs).toEqual([]);
  });

  it("lists the last outcome of every scheduled job", async () => {
    const { service } = setup({
      checkpoints: [],
      deadLetterCounts: [],
      jobRuns: [
        {
          name: "price-history",
          lastStartedAt: new Date("2026-08-14T01:00:00Z"),
          lastFinishedAt: new Date("2026-08-14T01:00:02Z"),
          lastStatus: "failure",
          lastError: "coingecko down",
          successCount: 10,
          failureCount: 1
        }
      ]
    });

    const status = await service.getStatus();

    expect(status.data.jobs).toEqual([
      {
        name: "price-history",
        lastStartedAt: "2026-08-14T01:00:00.000Z",
        lastFinishedAt: "2026-08-14T01:00:02.000Z",
        lastStatus: "failure",
        lastError: "coingecko down",
        successCount: 10,
        failureCount: 1
      }
    ]);
    expect(StatusResponseSchema.parse(status)).toEqual(status);
  });

  it("lists the indexes a backfill left deferred", async () => {
    const { service } = setup({ checkpoints: [], deadLetterCounts: [], deferredIndexes: ["messages_type_id_idx", "transactions_hash_idx"] });

    const status = await service.getStatus();

    expect(status.data.deferredIndexes).toEqual(["messages_type_id_idx", "transactions_hash_idx"]);
    expect(StatusResponseSchema.parse(status)).toEqual(status);
  });

  function setup(input: {
    checkpoints: Array<{ stream: string; lastHeight: number; updatedAt: Date }>;
    deadLetterCounts: Array<{ type: string; count: number }>;
    deferredIndexes?: string[];
    jobRuns?: Array<typeof JobRuns.$inferSelect>;
  }) {
    const rowsFor = (table: unknown) => {
      if (table === IndexerState) {
        return input.checkpoints;
      }
      if (table === JobRuns) {
        return input.jobRuns ?? [];
      }
      return [];
    };
    const dbFake = {
      select: () => ({
        from: (table: unknown) =>
          Object.assign(Promise.resolve(rowsFor(table)), {
            innerJoin: () => ({ groupBy: () => Promise.resolve(input.deadLetterCounts) }),
            orderBy: () => Promise.resolve(rowsFor(table))
          })
      })
    };
    const deferredIndexService = mock<DeferredIndexService>();
    deferredIndexService.listDeferred.mockResolvedValue(input.deferredIndexes ?? []);

    const config = envSchema.parse({ POSTGRES_DB_URI: "postgres://unit:unit@localhost:5432/unit" });
    const service = new StatusService(dbFake as unknown as ChainDatabase, deferredIndexService, config);
    return { service };
  }
});
