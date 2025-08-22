import type { LoggerService } from "@akashnetwork/logging";
import { millisecondsInMinute } from "date-fns";
import { mock } from "jest-mock-extended";

import { cacheEngine } from "@src/caching/helpers";
import type { DbHealthcheck, JobQueueHealthcheck } from "@src/core";
import { HealthzService } from "./healthz.service";

describe(HealthzService.name, () => {
  afterEach(() => {
    cacheEngine.clearAllKeyInCache();
  });

  describe("getReadinessStatus", () => {
    it("returns ok if db and jobsQueue are ready", async () => {
      const { service, dbHealthcheck, jobQueueHealthcheck } = setup();

      expect(await service.getReadinessStatus()).toEqual({
        status: "ok",
        data: {
          postgres: true,
          jobQueue: true
        }
      });
      expect(dbHealthcheck.ping).toHaveBeenCalled();
      expect(jobQueueHealthcheck.ping).toHaveBeenCalled();
    });

    it("returns error if db is not ready", async () => {
      const { service, dbHealthcheck, jobQueueHealthcheck } = setup();

      dbHealthcheck.ping.mockRejectedValue(new Error("Postgres is not ready"));

      expect(await service.getReadinessStatus()).toEqual({
        status: "error",
        data: {
          postgres: false,
          jobQueue: true
        }
      });
      expect(dbHealthcheck.ping).toHaveBeenCalled();
      expect(jobQueueHealthcheck.ping).toHaveBeenCalled();
    });

    it("returns error if jobsQueue is not ready", async () => {
      const { service, dbHealthcheck, jobQueueHealthcheck } = setup();

      jobQueueHealthcheck.ping.mockRejectedValue(new Error("JobsQueue is not ready"));

      expect(await service.getReadinessStatus()).toEqual({
        status: "error",
        data: {
          postgres: true,
          jobQueue: false
        }
      });
      expect(dbHealthcheck.ping).toHaveBeenCalled();
      expect(jobQueueHealthcheck.ping).toHaveBeenCalled();
    });
  });

  describe("getLivenessStatus", () => {
    it("returns ok if postgres and jobQueue are ready", async () => {
      const { service, dbHealthcheck, jobQueueHealthcheck } = setup();

      expect(await service.getLivenessStatus()).toEqual({
        status: "ok",
        data: {
          postgres: true,
          jobQueue: true
        }
      });
      expect(dbHealthcheck.ping).toHaveBeenCalled();
      expect(jobQueueHealthcheck.ping).toHaveBeenCalled();
    });

    it("returns error if db or jobsQueue are not ready", async () => {
      const { service, dbHealthcheck, jobQueueHealthcheck, logger } = setup();
      const dbError = new Error("Postgres is not ready");
      const jobQueueError = new Error("JobsQueue is not ready");
      dbHealthcheck.ping.mockRejectedValue(dbError);
      jobQueueHealthcheck.ping.mockRejectedValue(jobQueueError);

      expect(await service.getLivenessStatus()).toEqual({
        status: "error",
        data: {
          postgres: false,
          jobQueue: false
        }
      });
      expect(dbHealthcheck.ping).toHaveBeenCalled();
      expect(jobQueueHealthcheck.ping).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith({
        event: "DB_HEALTHCHECK_ERROR",
        error: dbError
      });
      expect(logger.error).toHaveBeenCalledWith({
        event: "JOB_QUEUE_HEALTHCHECK_ERROR",
        error: jobQueueError
      });
    });

    it("caches liveness results and retries after TTL expires", async () => {
      const { service, dbHealthcheck, jobQueueHealthcheck } = setup();

      // First call - both should be called
      await service.getLivenessStatus();
      expect(dbHealthcheck.ping).toHaveBeenCalledTimes(1);
      expect(jobQueueHealthcheck.ping).toHaveBeenCalledTimes(1);

      // Second call within TTL - should use cached results, no additional calls
      await service.getLivenessStatus();
      expect(dbHealthcheck.ping).toHaveBeenCalledTimes(1);
      expect(jobQueueHealthcheck.ping).toHaveBeenCalledTimes(1);

      // Advance time beyond TTL
      jest.useFakeTimers();
      jest.advanceTimersByTime(millisecondsInMinute + 1);

      // Call after TTL - should make new calls
      await service.getLivenessStatus();
      expect(dbHealthcheck.ping).toHaveBeenCalledTimes(2);
      expect(jobQueueHealthcheck.ping).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });
  });

  function setup() {
    const logger = mock<LoggerService>();
    const dbHealthcheck = mock<DbHealthcheck>();
    const jobQueueHealthcheck = mock<JobQueueHealthcheck>();
    const healthzService = new HealthzService(dbHealthcheck, jobQueueHealthcheck, logger);

    return {
      logger,
      service: healthzService,
      dbHealthcheck,
      jobQueueHealthcheck
    };
  }
});
