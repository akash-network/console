import { container } from "tsyringe";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { JobRuns } from "@src/db/schema";
import { JobRunRecorder } from "@src/jobs/job-run-recorder.service";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";
import type { LoggerService } from "@src/providers/logging.provider";

describe(JobRunRecorder.name, () => {
  it("records a run through start, success and failure with running counts", async () => {
    const { recorder, db, logger } = await setup();

    await recorder.onStart("price-history");
    expect(await db.select().from(JobRuns)).toEqual([
      expect.objectContaining({ name: "price-history", lastStatus: "running", lastFinishedAt: null, successCount: 0, failureCount: 0 })
    ]);

    await recorder.onSuccess("price-history", 120);
    expect(await db.select().from(JobRuns)).toEqual([expect.objectContaining({ lastStatus: "success", lastError: null, successCount: 1, failureCount: 0 })]);
    expect(logger.info).toHaveBeenCalledWith({ event: "JOB_COMPLETED", job: "price-history", durationMs: 120 });

    await recorder.onStart("price-history");
    await recorder.onFailure("price-history", 5_000, new Error("coingecko down"));
    const [run] = await db.select().from(JobRuns);
    expect(run).toEqual(expect.objectContaining({ lastStatus: "failure", lastError: "coingecko down", successCount: 1, failureCount: 1 }));
    expect(run.lastFinishedAt).not.toBeNull();
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "JOB_FAILED", job: "price-history", durationMs: 5_000 }));
  });

  it("keeps one row per job", async () => {
    const { recorder, db } = await setup();

    await recorder.onStart("price-history");
    await recorder.onStart("keybase-identities");
    await recorder.onSuccess("keybase-identities", 1);

    expect(await db.select({ name: JobRuns.name, lastStatus: JobRuns.lastStatus }).from(JobRuns).orderBy(JobRuns.name)).toEqual([
      { name: "keybase-identities", lastStatus: "success" },
      { name: "price-history", lastStatus: "running" }
    ]);
  });

  async function setup() {
    const db: ChainDatabase = container.resolve(CHAIN_DB);
    await db.delete(JobRuns);
    const logger = mock<LoggerService>();
    const recorder = new JobRunRecorder(db, logger);
    return { recorder, db, logger };
  }
});
