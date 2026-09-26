import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { envSchema } from "@src/config/env.config";
import type { JobRunRecorder } from "@src/jobs/job-run-recorder.service";
import { JobsRunnerService } from "@src/jobs/jobs-runner.service";
import type { KeybaseIdentitiesJob } from "@src/jobs/keybase-identities/keybase-identities.job";
import type { PriceHistoryJob } from "@src/jobs/price-history/price-history.job";
import type { LoggerService } from "@src/providers/logging.provider";

describe(JobsRunnerService.name, () => {
  it("runs the price and keybase jobs at start and stops them on dispose", async () => {
    const { runner, priceHistory, keybase, recorder } = setup({ coinId: "akash-network" });

    const started = runner.start();
    await vi.waitFor(() => expect(recorder.onSuccess).toHaveBeenCalledTimes(2));
    await runner.dispose();
    await started;

    expect(priceHistory.run).toHaveBeenCalledTimes(1);
    expect(keybase.run).toHaveBeenCalledTimes(1);
    expect(recorder.onStart).toHaveBeenCalledWith("price-history");
    expect(recorder.onStart).toHaveBeenCalledWith("keybase-identities");
  });

  it("leaves the price job out when no coin id is configured", async () => {
    const { runner, priceHistory, keybase, logger } = setup({ coinId: "" });

    const started = runner.start();
    await vi.waitFor(() => expect(keybase.run).toHaveBeenCalledTimes(1));
    await runner.dispose();
    await started;

    expect(priceHistory.run).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "JOBS_STARTED", jobs: ["keybase-identities"] }));
  });

  function setup(input: { coinId: string }) {
    const config = envSchema.parse({ POSTGRES_DB_URI: "postgres://unit:unit@localhost:5432/unit", INDEXER_ROLE: "jobs", PRICE_COINGECKO_ID: input.coinId });
    const recorder = mock<JobRunRecorder>();
    recorder.onStart.mockResolvedValue(undefined);
    recorder.onSuccess.mockResolvedValue(undefined);
    recorder.onFailure.mockResolvedValue(undefined);
    const priceHistory = mock<PriceHistoryJob>();
    priceHistory.run.mockResolvedValue(undefined);
    const keybase = mock<KeybaseIdentitiesJob>();
    keybase.run.mockResolvedValue(undefined);
    const logger = mock<LoggerService>();

    const runner = new JobsRunnerService(recorder, priceHistory, keybase, config, logger);
    return { runner, recorder, priceHistory, keybase, logger };
  }
});
