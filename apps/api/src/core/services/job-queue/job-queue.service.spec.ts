import { faker } from "@faker-js/faker";
import type PgBoss from "pg-boss";
import { describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { LoggerService } from "@src/core/providers/logging.provider";
import type { CoreConfigService } from "../core-config/core-config.service";
import type { ExecutionContextService } from "../execution-context/execution-context.service";
import { type Job, JOB_NAME, type JobHandler, JobQueueService } from "./job-queue.service";

describe(JobQueueService.name, () => {
  describe("registerHandlers", () => {
    it("creates queues for all handlers and stores them", async () => {
      const handleFn = vi.fn().mockResolvedValue(undefined);
      const handler = new TestHandler(handleFn);
      const { service, pgBoss } = setup();

      await service.registerHandlers([handler]);

      expect(pgBoss.createQueue).toHaveBeenCalledWith("test", {
        name: "test",
        retryBackoff: true,
        retryDelayMax: 5 * 60,
        retryLimit: 5,
        policy: undefined
      });
    });

    it("handles multiple handlers", async () => {
      const handleFn1 = vi.fn().mockResolvedValue(undefined);
      const handleFn2 = vi.fn().mockResolvedValue(undefined);

      class AnotherTestJob implements Job {
        static readonly [JOB_NAME] = "another";
        readonly name = AnotherTestJob[JOB_NAME];
        readonly version = 1;

        constructor(public readonly data: { type: string }) {}
      }

      class AnotherHandler implements JobHandler<AnotherTestJob> {
        readonly accepts = AnotherTestJob;
        readonly handle: JobHandler<AnotherTestJob>["handle"] = handleFn2;
      }

      const handler1 = new TestHandler(handleFn1);
      const handler2 = new AnotherHandler();
      const { service, pgBoss } = setup();

      await service.registerHandlers([handler1, handler2]);

      expect(pgBoss.createQueue).toHaveBeenCalledTimes(2);
      expect(pgBoss.createQueue).toHaveBeenCalledWith("test", {
        name: "test",
        retryBackoff: true,
        retryDelayMax: 5 * 60,
        retryLimit: 5,
        policy: undefined
      });
      expect(pgBoss.createQueue).toHaveBeenCalledWith("another", {
        name: "another",
        retryBackoff: true,
        retryDelayMax: 5 * 60,
        retryLimit: 5,
        policy: undefined
      });
    });

    it("throws error when multiple handlers register for the same queue", async () => {
      const handleFn1 = vi.fn().mockResolvedValue(undefined);
      const handleFn2 = vi.fn().mockResolvedValue(undefined);
      const handler1 = new TestHandler(handleFn1);
      const handler2 = new TestHandler(handleFn2);
      const { service } = setup();

      await expect(service.registerHandlers([handler1, handler2])).rejects.toThrow("JobQueue does not support multiple handlers for the same queue: test");
    });
  });

  describe("enqueue", () => {
    it("logs job enqueued event and sends job to PgBoss", async () => {
      const job = new TestJob({
        message: "Hello World",
        userId: "user-123"
      });
      const { service, pgBoss, logger } = setup();
      vi.spyOn(pgBoss, "send").mockResolvedValue("job-id-123");

      const result = await service.enqueue(job, { startAfter: new Date() });

      expect(pgBoss.send).toHaveBeenCalledWith({
        name: job.name,
        data: { ...job.data, version: job.version },
        options: { startAfter: expect.any(Date) }
      });
      expect(logger.info).toHaveBeenCalledWith({
        event: "JOB_ENQUEUED",
        job,
        jobId: "job-id-123",
        options: { startAfter: expect.any(Date) }
      });
      expect(result).toBe("job-id-123");
    });

    it("sends job without options", async () => {
      const job = new TestJob({
        message: "Hello World",
        userId: "user-123"
      });
      const { service, pgBoss } = setup();
      vi.spyOn(pgBoss, "send").mockResolvedValue("job-id-456");

      const result = await service.enqueue(job);

      expect(pgBoss.send).toHaveBeenCalledWith({
        name: job.name,
        data: { ...job.data, version: job.version },
        options: undefined
      });
      expect(result).toBe("job-id-456");
    });
  });

  describe("cancel", () => {
    it("cancels a job", async () => {
      const { service, pgBoss, logger } = setup();
      const jobId = faker.string.uuid();
      vi.spyOn(pgBoss, "cancel").mockResolvedValue();

      await service.cancel("test", jobId);

      expect(pgBoss.cancel).toHaveBeenCalledWith("test", jobId);
      expect(logger.info).toHaveBeenCalledWith({
        event: "JOB_CANCELLED",
        jobId,
        name: "test"
      });
    });

    it("logs warning when trying to cancel a job in terminal state", async () => {
      const { service, pgBoss, logger } = setup();
      const jobId = faker.string.uuid();
      const error = new Error("job already cancelled");
      vi.spyOn(pgBoss, "cancel").mockRejectedValue(error);

      await service.cancel("test", jobId);

      expect(pgBoss.cancel).toHaveBeenCalledWith("test", jobId);
      expect(logger.warn).toHaveBeenCalledWith({
        event: "JOB_CANCEL_FAILED",
        jobId,
        name: "test",
        error
      });
    });

    it("re-throws error when cancel fails for reasons other than terminal state", async () => {
      const { service, pgBoss } = setup();
      const jobId = faker.string.uuid();
      const error = new Error("database connection failed");
      vi.spyOn(pgBoss, "cancel").mockRejectedValue(error);

      await expect(service.cancel("test", jobId)).rejects.toThrow(error);
      expect(pgBoss.cancel).toHaveBeenCalledWith("test", jobId);
    });
  });

  describe("complete()", () => {
    it("completes a job and logs completion", async () => {
      const { service, pgBoss, logger } = setup();
      const jobId = faker.string.uuid();
      pgBoss.complete = vi.fn().mockResolvedValue(undefined);

      await service.complete("test", jobId);

      expect(pgBoss.complete).toHaveBeenCalledWith("test", jobId);
      expect(logger.info).toHaveBeenCalledWith({
        event: "JOB_COMPLETED",
        jobId,
        name: "test"
      });
    });

    it("logs warning when trying to complete a job in terminal state", async () => {
      const { service, pgBoss, logger } = setup();
      const jobId = faker.string.uuid();
      const error = new Error("job already completed");
      pgBoss.complete = vi.fn().mockRejectedValue(error);

      await service.complete("test", jobId);

      expect(pgBoss.complete).toHaveBeenCalledWith("test", jobId);
      expect(logger.warn).toHaveBeenCalledWith({
        event: "JOB_COMPLETE_FAILED",
        jobId,
        name: "test",
        error
      });
    });

    it("re-throws error when complete fails for reasons other than terminal state", async () => {
      const { service, pgBoss } = setup();
      const jobId = faker.string.uuid();
      const error = new Error("database connection failed");
      pgBoss.complete = vi.fn().mockRejectedValue(error);

      await expect(service.complete("test", jobId)).rejects.toThrow(error);
      expect(pgBoss.complete).toHaveBeenCalledWith("test", jobId);
    });
  });

  describe("startWorkers", () => {
    it("throws error when handlers are not registered", async () => {
      const { service } = setup();

      await expect(service.startWorkers()).rejects.toThrow("Handlers not registered. Register handlers first.");
    });

    it("processes job successfully", async () => {
      const handleFn = vi.fn().mockResolvedValue(undefined);
      const handler = new TestHandler(handleFn);
      const { service, pgBoss, logger } = setup();

      const job = { id: "1", data: { message: "Job 1", userId: "user-1" } };

      vi.spyOn(pgBoss, "work").mockImplementation(async (queueName: string, options: unknown, processFn: PgBoss.WorkHandler<unknown>) => {
        await processFn([job as PgBoss.Job<unknown>]);
        return "work-id";
      });

      await service.registerHandlers([handler]);
      await service.startWorkers({ concurrency: 5 });

      expect(pgBoss.createQueue).toHaveBeenCalledWith("test", {
        name: "test",
        retryBackoff: true,
        retryDelayMax: 5 * 60,
        retryLimit: 5,
        policy: undefined
      });
      expect(pgBoss.work).toHaveBeenCalledTimes(5);
      expect(pgBoss.work).toHaveBeenCalledWith("test", { batchSize: 1 }, expect.any(Function));
      expect(logger.info).toHaveBeenCalledWith({
        event: "JOB_STARTED",
        jobId: job.id
      });
      expect(handleFn).toHaveBeenCalledTimes(5);
      expect(handleFn).toHaveBeenCalledWith({ message: "Job 1", userId: "user-1" }, { id: job.id });
      expect(logger.info).toHaveBeenCalledWith({
        event: "JOB_DONE",
        jobId: job.id
      });
    });

    it("handles job failures and logs errors", async () => {
      const error = new Error("Job processing failed");
      const handleFn = vi.fn().mockRejectedValue(error);
      const handler = new TestHandler(handleFn);
      const { service, pgBoss, logger } = setup();

      const job = { id: "1", data: { message: "Job 1", userId: "user-1" } };

      vi.spyOn(pgBoss, "work").mockImplementation(async (queueName: string, options: unknown, processFn: PgBoss.WorkHandler<unknown>) => {
        await processFn([job as PgBoss.Job<unknown>]);
        return "work-id";
      });

      await service.registerHandlers([handler]);
      const [result] = await Promise.allSettled([service.startWorkers({ concurrency: 1 })]);

      expect(result.status).toBe("rejected");
      expect((result as PromiseRejectedResult).reason).toBe(error);
      expect(logger.error).toHaveBeenCalledWith({
        event: "JOB_FAILED",
        jobId: job.id,
        error: (result as PromiseRejectedResult).reason
      });
      expect(handleFn).toHaveBeenCalledTimes(1);
      expect(handleFn).toHaveBeenCalledWith({ message: "Job 1", userId: "user-1" }, { id: job.id });
    });

    it("uses default options when none provided", async () => {
      const handleFn = vi.fn().mockResolvedValue(undefined);
      const handler = new TestHandler(handleFn);
      const { service, pgBoss } = setup();
      const job = { id: "1", data: { message: "Job 1", userId: "user-1" } };

      vi.spyOn(pgBoss, "work").mockImplementation(async (queueName: string, options: unknown, processFn: PgBoss.WorkHandler<unknown>) => {
        await processFn([job as PgBoss.Job<unknown>]);
        return "work-id";
      });

      await service.registerHandlers([handler]);
      await service.startWorkers();

      expect(pgBoss.work).toHaveBeenCalledTimes(2);
      expect(pgBoss.work).toHaveBeenCalledWith("test", { batchSize: 1 }, expect.any(Function));
      expect(handleFn).toHaveBeenCalledTimes(2);
      expect(handleFn).toHaveBeenCalledWith({ message: "Job 1", userId: "user-1" }, { id: job.id });
    });
  });

  describe("setup", () => {
    it("starts PgBoss and sets up error handling", async () => {
      const { service, pgBoss, logger } = setup();

      await service.setup();

      expect(logger.info).toHaveBeenCalledWith({ event: "JOB_QUEUE_STARTING" });
      expect(pgBoss.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(pgBoss.start).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith({ event: "JOB_QUEUE_STARTED" });
    });

    it("handles PgBoss errors", async () => {
      const { service, pgBoss, logger } = setup();
      const mockError = new Error("PgBoss connection failed");

      let errorHandler: (error: Error) => void;
      vi.spyOn(pgBoss, "on").mockImplementation(((event, handler) => {
        if (event === "error") {
          errorHandler = handler as (error: Error) => void;
        }
        return pgBoss;
      }) as PgBoss["on"]);

      await service.setup();
      errorHandler!(mockError);

      expect(logger.error).toHaveBeenCalledWith({
        event: "JOB_QUEUE_ERROR",
        error: mockError
      });
    });
  });

  describe("dispose", () => {
    it("stops PgBoss", async () => {
      const { service, pgBoss } = setup();

      await service.dispose();

      expect(pgBoss.stop).toHaveBeenCalled();
    });
  });

  describe("ping", () => {
    it("pings PgBoss", async () => {
      const { service, pgBoss } = setup();
      vi.spyOn(pgBoss, "getDb").mockReturnValue({ executeSql: vi.fn().mockResolvedValue(undefined) });
      await service.ping();

      expect(pgBoss.getDb().executeSql).toHaveBeenCalledWith("SELECT 1", []);
    });
  });

  function setup(input?: { pgBoss?: PgBoss; postgresDbUri?: string }) {
    const mocks = {
      logger: mock<LoggerService>(),
      coreConfig: mock<CoreConfigService>({
        get: vi.fn().mockReturnValue(input?.postgresDbUri ?? "postgresql://localhost:5432/test")
      }),
      pgBoss:
        input?.pgBoss ??
        mockDeep<PgBoss>({
          createQueue: vi.fn().mockResolvedValue(undefined),
          send: vi.fn().mockResolvedValue("job-id"),
          work: vi.fn().mockResolvedValue(undefined),
          start: vi.fn().mockResolvedValue(undefined),
          stop: vi.fn().mockResolvedValue(undefined),
          cancel: vi.fn().mockResolvedValue(undefined),
          on: vi.fn().mockReturnValue(undefined),
          getDb: vi.fn().mockReturnValue({ executeSql: vi.fn().mockResolvedValue(undefined) })
        }),
      executionContextService: mock<ExecutionContextService>({
        set: vi.fn().mockResolvedValue(undefined),
        runWithContext: vi.fn(async (cb: () => Promise<unknown>) => await cb()) as ExecutionContextService["runWithContext"]
      })
    };

    const service = new JobQueueService(
      mocks.logger,
      mocks.coreConfig,
      mocks.executionContextService,
      input && Object.hasOwn(input, "pgBoss") ? input?.pgBoss : mocks.pgBoss
    );

    return { service, ...mocks };
  }

  class TestJob implements Job {
    static readonly [JOB_NAME] = "test";
    readonly name = TestJob[JOB_NAME];
    readonly version = 1;

    constructor(
      public readonly data: {
        message: string;
        userId: string;
      }
    ) {}
  }

  class TestHandler implements JobHandler<TestJob> {
    readonly accepts = TestJob;
    constructor(public readonly handle: JobHandler<TestJob>["handle"]) {}
  }
});
