import { faker } from "@faker-js/faker";
import { inArray } from "drizzle-orm";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { toAskToken, toDedupeKey } from "@src/deployment/lib/unmet-gpu-ask/unmet-gpu-ask";
import { GpuService } from "@src/gpu/services/gpu.service";
import { RecordUnmetGpuScreening, RecordUnmetGpuScreeningHandler } from "./record-unmet-gpu-screening.handler";

import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";

const OCCURRED_AT = new Date("2026-11-06T10:00:00Z");

const jobWorkers = useJobWorkers(() => [container.resolve(RecordUnmetGpuScreeningHandler)]);

describe(RecordUnmetGpuScreeningHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records each ask of an empty screening as a missed fit or a missing gpu by what the network offers, run the way a worker runs it", async () => {
    const { runJob, findEvents } = await setup({ offered: [{ vendor: "nvidia", model: "h100" }] });
    const offeredAsk = { vendor: "nvidia", model: "h100", gpuCount: 8, regionArea: "eu" as const };
    const missingAsk = { vendor: "nvidia", model: `b200-${faker.string.alphanumeric(8)}`, gpuCount: 2, regionArea: null };
    const [offeredToken, missingToken] = [toAskToken(offeredAsk, OCCURRED_AT, "user-1"), toAskToken(missingAsk, OCCURRED_AT, "user-1")];

    await runJob([
      { ...offeredAsk, askToken: offeredToken },
      { ...missingAsk, askToken: missingToken }
    ]);

    expect(await findEvents([toDedupeKey("no_fit", offeredToken), toDedupeKey("missing_gpu", missingToken)])).toEqual(
      expect.arrayContaining([
        { id: expect.any(String), kind: "no_fit", ...offeredAsk, dedupeKey: toDedupeKey("no_fit", offeredToken), occurredAt: OCCURRED_AT },
        { id: expect.any(String), kind: "missing_gpu", ...missingAsk, dedupeKey: toDedupeKey("missing_gpu", missingToken), occurredAt: OCCURRED_AT }
      ])
    );
  });

  async function setup(input: { offered: Array<{ vendor: string; model: string }> }) {
    vi.spyOn(container.resolve(GpuService), "findOfferedGpuModels").mockResolvedValue(input.offered);
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const table = resolveTable("UnmetDemandEvents");
    const { enqueue, startWorkers } = await jobWorkers();
    const singletonKey = faker.string.uuid();

    async function runJob(asks: RecordUnmetGpuScreening["data"]["asks"]) {
      await enqueue(new RecordUnmetGpuScreening({ occurredAt: OCCURRED_AT.toISOString(), asks }), { singletonKey });
      await startWorkers();
      await expectJobCompleted(RecordUnmetGpuScreening[JOB_NAME], { singletonKey });
    }

    return {
      runJob,
      findEvents: (dedupeKeys: string[]) => db.select().from(table).where(inArray(table.dedupeKey, dedupeKeys))
    };
  }
});
