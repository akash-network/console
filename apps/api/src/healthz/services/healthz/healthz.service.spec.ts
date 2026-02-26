import type { LoggerService } from "@akashnetwork/logging";
import { millisecondsInMinute } from "date-fns";
import { mock } from "vitest-mock-extended";

import type { DbHealthcheck, JobQueueHealthcheck } from "@src/core";
import type { HealthzConfigService } from "@src/healthz/services/healthz-config/healthz-config.service";
import { HealthzService } from "./healthz.service";

describe(HealthzService.name, () => {
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
      const { service, dbHealthcheck, jobQueueHealthcheck, logger } = setup();

      const error = new Error("Postgres is not ready");
      dbHealthcheck.ping.mockRejectedValue(error);

      expect(await service.getReadinessStatus()).toEqual({
        status: "error",
        data: {
          postgres: false,
          jobQueue: true
        }
      });
      expect(logger.error).toHaveBeenCalledWith({
        event: "POSTGRES_HEALTHCHECK_ERROR",
        error
      });
      expect(dbHealthcheck.ping).toHaveBeenCalled();
      expect(jobQueueHealthcheck.ping).toHaveBeenCalled();
    });

    it("returns error if jobsQueue is not ready", async () => {
      const { service, dbHealthcheck, jobQueueHealthcheck, logger } = setup();

      const error = new Error("JobsQueue is not ready");
      jobQueueHealthcheck.ping.mockRejectedValue(error);

      expect(await service.getReadinessStatus()).toEqual({
        status: "error",
        data: {
          postgres: true,
          jobQueue: false
        }
      });
      expect(logger.error).toHaveBeenCalledWith({
        event: "JOBQUEUE_HEALTHCHECK_ERROR",
        error
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
        event: "POSTGRES_HEALTHCHECK_ERROR",
        error: dbError
      });
      expect(logger.error).toHaveBeenCalledWith({
        event: "JOBQUEUE_HEALTHCHECK_ERROR",
        error: jobQueueError
      });
    });

    it("caches liveness results and retries after TTL expires", async () => {
      jest.useFakeTimers();
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
      jest.advanceTimersByTime(millisecondsInMinute + 1);

      // Call after TTL - should make new calls
      await service.getLivenessStatus();
      expect(dbHealthcheck.ping).toHaveBeenCalledTimes(2);
      expect(jobQueueHealthcheck.ping).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it("does not tolerate failure if has not succeeded at least once", async () => {
      const { service, dbHealthcheck, jobQueueHealthcheck } = setup();

      dbHealthcheck.ping.mockRejectedValue(new Error("Postgres is not ready"));
      jobQueueHealthcheck.ping.mockRejectedValue(new Error("JobsQueue is not ready"));

      expect(await service.getLivenessStatus()).toEqual({
        status: "error",
        data: {
          postgres: false,
          jobQueue: false
        }
      });
    });

    it("tolerates failure for the 1st time and waits for the cache to expire until the next check", async () => {
      jest.useFakeTimers();
      const { service, dbHealthcheck, jobQueueHealthcheck } = setup();

      await service.getLivenessStatus();

      // wait for TTL to expire
      jest.advanceTimersByTime(millisecondsInMinute + 1);
      dbHealthcheck.ping.mockRejectedValue(new Error("Postgres is not ready"));

      expect(await service.getLivenessStatus()).toEqual({
        status: "ok",
        data: {
          postgres: true,
          jobQueue: true
        }
      });
      expect(dbHealthcheck.ping).toHaveBeenCalledTimes(2);
      expect(jobQueueHealthcheck.ping).toHaveBeenCalledTimes(2);

      // uses cached results
      expect(await service.getLivenessStatus()).toEqual({
        status: "ok",
        data: {
          postgres: true,
          jobQueue: true
        }
      });
      expect(dbHealthcheck.ping).toHaveBeenCalledTimes(2);
      expect(jobQueueHealthcheck.ping).toHaveBeenCalledTimes(2);

      // wait for TTL to expire
      jest.advanceTimersByTime(millisecondsInMinute + 1);

      expect(await service.getLivenessStatus()).toEqual({
        status: "error",
        data: {
          postgres: false,
          jobQueue: true
        }
      });
      expect(dbHealthcheck.ping).toHaveBeenCalledTimes(3);
      expect(jobQueueHealthcheck.ping).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });
  });

  function setup() {
    const logger = mock<LoggerService>();
    const dbHealthcheck = mock<DbHealthcheck>({ ping: jest.fn().mockResolvedValue(undefined) });
    const jobQueueHealthcheck = mock<JobQueueHealthcheck>({ ping: jest.fn().mockResolvedValue(undefined) });
    const healthzConfigService = mock<HealthzConfigService>();
    healthzConfigService.get.calledWith("HEALTHZ_TIMEOUT_SECONDS").mockReturnValue(10);
    const healthzService = new HealthzService(dbHealthcheck, jobQueueHealthcheck, healthzConfigService, logger);

    return {
      logger,
      service: healthzService,
      dbHealthcheck,
      jobQueueHealthcheck
    };
  }
});
