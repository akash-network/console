import { mock, mockDeep } from "jest-mock-extended";
import type PgBoss from "pg-boss";

import type { LoggerService } from "@src/core/providers/logging.provider";
import type { CoreConfigService } from "../core-config/core-config.service";
import { type Job, JOB_NAME, type JobHandler, JobQueueService } from "./job-queue.service";

describe(JobQueueService.name, () => {
  describe("registerHandlers", () => {
    it("creates queues for all handlers and stores them", async () => {
      const handleFn = jest.fn().mockResolvedValue(undefined);
      const handler = new TestHandler(handleFn);
      const { service, pgBoss } = setup();

      await service.registerHandlers([handler]);

      expect(pgBoss.createQueue).toHaveBeenCalledWith("test", {
        name: "test",
        retryLimit: 10
      });
    });

    it("handles multiple handlers", async () => {
      const handleFn1 = jest.fn().mockResolvedValue(undefined);
      const handleFn2 = jest.fn().mockResolvedValue(undefined);

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
        retryLimit: 10
      });
      expect(pgBoss.createQueue).toHaveBeenCalledWith("another", {
        name: "another",
        retryLimit: 10
      });
    });
  });

  describe("enqueue", () => {
    it("logs job enqueued event and sends job to PgBoss", async () => {
      const job = new TestJob({
        message: "Hello World",
        userId: "user-123"
      });
      const { service, pgBoss, logger } = setup();
      jest.spyOn(pgBoss, "send").mockResolvedValue("job-id-123");

      const result = await service.enqueue(job, { startAfter: new Date() });

      expect(logger.info).toHaveBeenCalledWith({
        event: "JOB_ENQUEUED",
        job
      });
      expect(pgBoss.send).toHaveBeenCalledWith({
        name: job.name,
        data: { ...job.data, version: job.version },
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
      jest.spyOn(pgBoss, "send").mockResolvedValue("job-id-456");

      const result = await service.enqueue(job);

      expect(pgBoss.send).toHaveBeenCalledWith({
        name: job.name,
        data: { ...job.data, version: job.version },
        options: undefined
      });
      expect(result).toBe("job-id-456");
    });
  });

  describe("startWorkers", () => {
    it("throws error when handlers are not registered", async () => {
      const { service } = setup();

      await expect(service.startWorkers()).rejects.toThrow("Handlers not registered. Register handlers first.");
    });

    it("processes job successfully", async () => {
      const handleFn = jest.fn().mockResolvedValue(undefined);
      const handler = new TestHandler(handleFn);
      const { service, pgBoss, logger } = setup();

      const jobs = [{ id: "1", data: { message: "Job 1", userId: "user-1" } }];

      jest.spyOn(pgBoss, "work").mockImplementation(async (queueName: string, options: any, processFn: (jobs: any[]) => Promise<void>) => {
        await processFn(jobs);
        return "work-id";
      });

      await service.registerHandlers([handler]);
      await service.startWorkers({ concurrency: 5 });

      expect(pgBoss.createQueue).toHaveBeenCalledWith("test", {
        name: "test",
        retryLimit: 10
      });
      expect(pgBoss.work).toHaveBeenCalledTimes(5);
      expect(pgBoss.work).toHaveBeenCalledWith("test", { batchSize: 1 }, expect.any(Function));
      expect(logger.info).toHaveBeenCalledWith({
        event: "JOB_STARTED",
        jobId: jobs[0].id
      });
      expect(handleFn).toHaveBeenCalledTimes(5);
      expect(handleFn).toHaveBeenCalledWith({ message: "Job 1", userId: "user-1" });
      expect(logger.info).toHaveBeenCalledWith({
        event: "JOB_DONE",
        jobId: jobs[0].id
      });
    });

    it("handles job failures and logs errors", async () => {
      const error = new Error("Job processing failed");
      const handleFn = jest.fn().mockRejectedValue(error);
      const handler = new TestHandler(handleFn);
      const { service, pgBoss, logger } = setup();

      const jobs = [{ id: "1", data: { message: "Job 1", userId: "user-1" } }];

      jest.spyOn(pgBoss, "work").mockImplementation(async (queueName: string, options: any, processFn: (jobs: any[]) => Promise<void>) => {
        await processFn(jobs);
        return "work-id";
      });

      await service.registerHandlers([handler]);
      const [result] = await Promise.allSettled([service.startWorkers({ concurrency: 1 })]);

      expect(result.status).toBe("rejected");
      expect((result as PromiseRejectedResult).reason).toBe(error);
      expect(logger.error).toHaveBeenCalledWith({
        event: "JOB_FAILED",
        jobId: jobs[0].id,
        error: (result as PromiseRejectedResult).reason
      });
      expect(handleFn).toHaveBeenCalledTimes(1);
    });

    it("uses default options when none provided", async () => {
      const handleFn = jest.fn().mockResolvedValue(undefined);
      const handler = new TestHandler(handleFn);
      const { service, pgBoss } = setup();

      jest.spyOn(pgBoss, "work").mockImplementation(async (queueName: string, options: any, processFn: (jobs: any[]) => Promise<void>) => {
        await processFn([{ id: "1", data: { message: "Job 1", userId: "user-1" } }]);
        return "work-id";
      });

      await service.registerHandlers([handler]);
      await service.startWorkers();

      expect(handleFn).toHaveBeenCalledTimes(2);
      expect(pgBoss.work).toHaveBeenCalledWith("test", { batchSize: 1 }, expect.any(Function));
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
      jest.spyOn(pgBoss, "on").mockImplementation(((event, handler) => {
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
      jest.spyOn(pgBoss, "getDb").mockReturnValue({ executeSql: jest.fn().mockResolvedValue(undefined) });
      await service.ping();

      expect(pgBoss.getDb().executeSql).toHaveBeenCalledWith("SELECT 1", []);
    });
  });

  function setup(input?: { pgBoss?: PgBoss; postgresDbUri?: string }) {
    const mocks = {
      logger: mock<LoggerService>(),
      coreConfig: mock<CoreConfigService>({
        get: jest.fn().mockReturnValue(input?.postgresDbUri ?? "postgresql://localhost:5432/test")
      }),
      pgBoss:
        input?.pgBoss ??
        mockDeep<PgBoss>({
          createQueue: jest.fn().mockResolvedValue(undefined),
          send: jest.fn().mockResolvedValue("job-id"),
          work: jest.fn().mockResolvedValue(undefined),
          start: jest.fn().mockResolvedValue(undefined),
          stop: jest.fn().mockResolvedValue(undefined)
        })
    };

    const service = new JobQueueService(mocks.logger, mocks.coreConfig, input && Object.hasOwn(input, "pgBoss") ? input?.pgBoss : mocks.pgBoss);

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
