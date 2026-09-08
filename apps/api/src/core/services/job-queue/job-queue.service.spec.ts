import { type MongoAbility, subject } from "@casl/ability";
import { faker } from "@faker-js/faker";
import type { Job as PgBossJob, PgBoss, QueueResult, WorkHandler } from "pg-boss";
import type { Sql } from "postgres";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { mock, mockDeep, type MockProxy } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { CoreConfigService } from "../core-config/core-config.service";
import type { ExecutionContextService } from "../execution-context/execution-context.service";
import type { TxService } from "../tx/tx.service";
import { type EnqueueOptions, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, JobQueueService } from "./job-queue.service";

describe(JobQueueService.name, () => {
  describe("registerHandlers", () => {
    it("creates queues for all handlers and stores them", async () => {
      const handleFn = vi.fn().mockResolvedValue(undefined);
      const handler = new TestHandler(handleFn);
      const { service, pgBoss } = setup();

      await service.registerHandlers([handler]);

      expect(pgBoss.createQueue).toHaveBeenCalledWith("test", {
        retryBackoff: true,
        retryDelay: 30,
        retryDelayMax: 5 * 60,
        retryLimit: 5,
        policy: undefined
      });
    });

    it("handles multiple handlers", async () => {
      const handler1 = new TestHandler(vi.fn().mockResolvedValue(undefined));
      const handler2 = new AnotherTestHandler(vi.fn().mockResolvedValue(undefined));
      const { service, pgBoss } = setup();

      await service.registerHandlers([handler1, handler2]);

      expect(pgBoss.createQueue).toHaveBeenCalledTimes(2);
      expect(pgBoss.createQueue).toHaveBeenCalledWith("test", {
        retryBackoff: true,
        retryDelay: 30,
        retryDelayMax: 5 * 60,
        retryLimit: 5,
        policy: undefined
      });
      expect(pgBoss.createQueue).toHaveBeenCalledWith("another", {
        retryBackoff: true,
        retryDelay: 30,
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

    it("creates the queue with its handler's policy", async () => {
      const { service, pgBoss } = setup();

      await service.registerHandlers([new SingletonTestHandler(vi.fn())]);

      expect(pgBoss.createQueue).toHaveBeenCalledWith("test", expect.objectContaining({ policy: "singleton" }));
    });

    it("converges an existing queue onto the current retry settings", async () => {
      const { service, pgBoss, logger } = setup({ queues: [liveQueue({ retryDelay: 0 })] });

      await service.registerHandlers([new TestHandler(vi.fn())]);

      expect(pgBoss.updateQueue).toHaveBeenCalledWith("test", {
        retryBackoff: true,
        retryDelay: 30,
        retryDelayMax: 5 * 60,
        retryLimit: 5
      });
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "JOB_QUEUE_RETRY_OPTIONS_CONVERGED", queue: "test" }));
    });

    it("never asks pg-boss to change a policy it refuses to change", async () => {
      const { service, pgBoss } = setup({ queues: [liveQueue({ retryDelay: 0 })] });

      await service.registerHandlers([new SingletonTestHandler(vi.fn())]);

      const [, options] = vi.mocked(pgBoss.updateQueue).mock.calls[0];
      expect(Object.keys(options as object)).not.toContain("policy");
    });

    it("leaves a queue that already carries the current retry settings alone", async () => {
      const { service, pgBoss } = setup({ queues: [liveQueue()] });

      await service.registerHandlers([new TestHandler(vi.fn())]);

      expect(pgBoss.updateQueue).not.toHaveBeenCalled();
    });

    it("reads the live queue settings once for all handlers", async () => {
      const { service, pgBoss } = setup();

      await service.registerHandlers([new TestHandler(vi.fn()), new AnotherTestHandler(vi.fn())]);

      expect(pgBoss.getQueues).toHaveBeenCalledTimes(1);
      expect(pgBoss.getQueues).toHaveBeenCalledWith(["test", "another"]);
    });

    it("rewrites the policy of an unpartitioned live queue onto the one its handler declares", async () => {
      const { service, pgBoss, logger } = setup({ queues: [liveQueue({ policy: "standard", partition: false })] });

      await service.registerHandlers([new SingletonTestHandler(vi.fn())]);

      expect(pgBoss.getDb().executeSql).toHaveBeenCalledWith(expect.stringMatching(/UPDATE \S+\.queue SET policy = \$2/), ["test", "singleton"]);
      expect(logger.info).toHaveBeenCalledWith({ event: "JOB_QUEUE_POLICY_CONVERGED", queue: "test", from: "standard", to: "singleton" });
    });

    it("rewrites the policy back to standard for a handler that stopped declaring one", async () => {
      const { service, pgBoss } = setup({ queues: [liveQueue({ policy: "singleton", partition: false })] });

      await service.registerHandlers([new TestHandler(vi.fn())]);

      expect(pgBoss.getDb().executeSql).toHaveBeenCalledWith(expect.stringContaining("SET policy = $2"), ["test", "standard"]);
    });

    it("leaves the policy of a live queue that already matches its handler untouched", async () => {
      const { service, pgBoss } = setup({ queues: [liveQueue({ policy: "singleton", partition: false })] });

      await service.registerHandlers([new SingletonTestHandler(vi.fn())]);

      expect(pgBoss.getDb().executeSql).not.toHaveBeenCalled();
    });

    it("warns instead of rewriting the policy of a partitioned queue, whose table lacks the other policies' indexes", async () => {
      const { service, pgBoss, logger } = setup({ queues: [liveQueue({ policy: "standard", partition: true })] });

      await service.registerHandlers([new SingletonTestHandler(vi.fn())]);

      expect(pgBoss.getDb().executeSql).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith({
        event: "JOB_QUEUE_POLICY_UNCHANGEABLE",
        queue: "test",
        declared: "singleton",
        live: "standard"
      });
    });

    it("still converges the retry settings when the policy rewrite fails", async () => {
      const error = new Error("update failed");
      const { service, pgBoss, logger } = setup({ queues: [liveQueue({ policy: "standard", partition: false, retryDelay: 0 })] });
      vi.mocked(pgBoss.getDb().executeSql).mockRejectedValue(error);

      await service.registerHandlers([new SingletonTestHandler(vi.fn())]);

      expect(logger.error).toHaveBeenCalledWith({ event: "JOB_QUEUE_POLICY_CONVERGE_FAILED", queue: "test", error });
      expect(pgBoss.updateQueue).toHaveBeenCalledWith("test", expect.objectContaining({ retryDelay: 30 }));
    });

    it("starts workers even when it cannot converge the queue settings", async () => {
      const error = new Error("update failed");
      const { service, pgBoss, logger } = setup({ queues: [liveQueue({ retryDelay: 0 })] });
      vi.mocked(pgBoss.updateQueue).mockRejectedValue(error);

      await service.registerHandlers([new TestHandler(vi.fn())]);

      expect(logger.error).toHaveBeenCalledWith({ event: "JOB_QUEUE_RETRY_OPTIONS_CONVERGE_FAILED", queue: "test", error });
      await expect(service.startWorkers()).resolves.toBeUndefined();
    });

    it("converges the remaining queues when one of them refuses to update", async () => {
      const error = new Error("update failed");
      const { service, pgBoss } = setup({
        queues: [liveQueue({ retryDelay: 0 }), liveQueue({ name: "another", retryDelay: 0 })]
      });
      vi.mocked(pgBoss.updateQueue).mockRejectedValueOnce(error).mockResolvedValue(undefined);

      await service.registerHandlers([new TestHandler(vi.fn()), new AnotherTestHandler(vi.fn())]);

      expect(pgBoss.updateQueue).toHaveBeenCalledTimes(2);
      expect(pgBoss.updateQueue).toHaveBeenLastCalledWith("another", expect.objectContaining({ retryDelay: 30 }));
    });

    it("starts workers even when it cannot read the live queue settings", async () => {
      const error = new Error("read failed");
      const { service, pgBoss, logger } = setup();
      vi.mocked(pgBoss.getQueues).mockRejectedValue(error);

      await service.registerHandlers([new TestHandler(vi.fn())]);

      expect(logger.error).toHaveBeenCalledWith({ event: "JOB_QUEUE_READ_FAILED", error });
      expect(pgBoss.updateQueue).not.toHaveBeenCalled();
      await expect(service.startWorkers()).resolves.toBeUndefined();
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
        options: { startAfter: expect.any(Date), db: undefined }
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
        options: { db: undefined }
      });
      expect(result).toBe("job-id-456");
    });

    it("enqueues the job on the ambient transaction connection when one is active", async () => {
      const job = new TestJob({ message: "Hello World", userId: "user-123" });
      const unsafe = vi.fn().mockResolvedValue([{ id: "job-1" }]);
      const connection = { unsafe } as unknown as Sql;
      const { service, pgBoss, txService } = setup();
      txService.getConnection.mockReturnValue(connection);
      const send = vi.spyOn(pgBoss, "send").mockResolvedValue("job-id-789");

      await service.enqueue(job);

      const { db } = (send.mock.calls[0][0] as unknown as { options: EnqueueOptions }).options;
      await db!.executeSql("INSERT INTO job VALUES ($1)", ["payload"]);
      expect(unsafe).toHaveBeenCalledWith("INSERT INTO job VALUES ($1)", ["payload"]);
    });
  });

  describe("cancel", () => {
    it("cancels a job", async () => {
      const { service, pgBoss, logger } = setup();
      const jobId = faker.string.uuid();
      vi.spyOn(pgBoss, "cancel").mockResolvedValue({});

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

  describe("findPendingSingletonKeys", () => {
    it("returns the singleton keys of the queue's unfinished jobs", async () => {
      const { service, pgBoss, txService } = setup();
      txService.getConnection.mockReturnValue(undefined);
      const executeSql = vi.fn().mockResolvedValue({ rows: [{ singleton_key: "singleton-1" }, { singleton_key: "singleton-2" }] });
      vi.spyOn(pgBoss, "getDb").mockReturnValue({ executeSql });

      await expect(service.findPendingSingletonKeys("test-job")).resolves.toEqual(new Set(["singleton-1", "singleton-2"]));

      expect(executeSql).toHaveBeenCalledWith(expect.stringContaining("state IN ('created', 'retry', 'active')"), ["test-job"]);
    });

    it("reads the singleton keys on the ambient transaction connection when one is active", async () => {
      const { service, pgBoss, txService } = setup();
      const unsafe = vi.fn().mockResolvedValue([{ singleton_key: "singleton-1" }]);
      txService.getConnection.mockReturnValue({ unsafe } as unknown as Sql);
      const getDb = vi.spyOn(pgBoss, "getDb");

      await expect(service.findPendingSingletonKeys("test-job")).resolves.toEqual(new Set(["singleton-1"]));

      expect(unsafe).toHaveBeenCalledWith(expect.stringContaining("SELECT DISTINCT singleton_key"), ["test-job"]);
      expect(getDb).not.toHaveBeenCalled();
    });
  });

  describe("hasWaitingSingleton", () => {
    it("asks for a job under the key that no worker holds yet and that is not due before the instant given", async () => {
      const { service, pgBoss, txService } = setup();
      txService.getConnection.mockReturnValue(undefined);
      const executeSql = vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] });
      vi.spyOn(pgBoss, "getDb").mockReturnValue({ executeSql });

      await expect(
        service.hasWaitingSingleton({ name: "test-job", singletonKey: "singleton-1", notDueBefore: new Date("2026-01-01T00:03:00.000Z") })
      ).resolves.toBe(true);

      expect(executeSql).toHaveBeenCalledWith(expect.stringContaining("state IN ('created', 'retry')"), ["test-job", "singleton-1", "2026-01-01T00:03:00.000Z"]);
      expect(executeSql).toHaveBeenCalledWith(expect.stringContaining("start_after > $3"), expect.anything());
    });

    it("reports no job when nothing under the key is still waiting", async () => {
      const { service, pgBoss, txService } = setup();
      txService.getConnection.mockReturnValue(undefined);
      vi.spyOn(pgBoss, "getDb").mockReturnValue({ executeSql: vi.fn().mockResolvedValue({ rows: [] }) });

      await expect(
        service.hasWaitingSingleton({ name: "test-job", singletonKey: "singleton-1", notDueBefore: new Date("2026-01-01T00:03:00.000Z") })
      ).resolves.toBe(false);
    });

    it("reads on the ambient transaction connection when one is active", async () => {
      const { service, pgBoss, txService } = setup();
      const unsafe = vi.fn().mockResolvedValue([{ "?column?": 1 }]);
      txService.getConnection.mockReturnValue({ unsafe } as unknown as Sql);
      const getDb = vi.spyOn(pgBoss, "getDb");

      await expect(
        service.hasWaitingSingleton({ name: "test-job", singletonKey: "singleton-1", notDueBefore: new Date("2026-01-01T00:03:00.000Z") })
      ).resolves.toBe(true);

      expect(unsafe).toHaveBeenCalledWith(expect.stringContaining("singleton_key = $2"), ["test-job", "singleton-1", "2026-01-01T00:03:00.000Z"]);
      expect(getDb).not.toHaveBeenCalled();
    });
  });

  describe("cancelCreatedBy", () => {
    it("cancels created jobs on the pg-boss connection when no transaction is active", async () => {
      const { service, pgBoss, txService } = setup();
      txService.getConnection.mockReturnValue(undefined);
      const executeSql = vi.fn().mockResolvedValue({ rows: [{ id: "job-1" }] });
      const getDb = vi.spyOn(pgBoss, "getDb").mockReturnValue({ executeSql });

      await service.cancelCreatedBy({ name: "test-job", singletonKey: "singleton-1" });

      expect(getDb).toHaveBeenCalled();
      expect(executeSql).toHaveBeenCalledWith(expect.stringContaining("state = 'cancelled'"), ["test-job", "singleton-1"]);
    });

    it("cancels a job waiting on a retry, not only one that has never run", async () => {
      const { service, pgBoss, txService } = setup();
      txService.getConnection.mockReturnValue(undefined);
      const executeSql = vi.fn().mockResolvedValue({ rows: [] });
      vi.spyOn(pgBoss, "getDb").mockReturnValue({ executeSql });

      await service.cancelCreatedBy({ name: "test-job", singletonKey: "singleton-1" });

      expect(executeSql).toHaveBeenCalledWith(expect.stringContaining("state IN ('created', 'retry')"), ["test-job", "singleton-1"]);
    });

    it("cancels created jobs on the ambient transaction connection when one is active", async () => {
      const { service, pgBoss, txService } = setup();
      const unsafe = vi.fn().mockResolvedValue([{ id: "job-1" }]);
      const connection = { unsafe } as unknown as Sql;
      txService.getConnection.mockReturnValue(connection);
      const getDb = vi.spyOn(pgBoss, "getDb");

      await service.cancelCreatedBy({ name: "test-job", singletonKey: "singleton-1" });

      expect(unsafe).toHaveBeenCalledWith(expect.stringContaining("state = 'cancelled'"), ["test-job", "singleton-1"]);
      expect(getDb).not.toHaveBeenCalled();
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

      vi.spyOn(pgBoss, "work").mockImplementation(async (queueName: string, options: unknown, processFn: WorkHandler<unknown>) => {
        await processFn([job as PgBossJob<unknown>]);
        return "work-id";
      });

      await service.registerHandlers([handler]);
      await service.startWorkers({ concurrency: 5 });

      expect(pgBoss.createQueue).toHaveBeenCalledWith("test", {
        retryBackoff: true,
        retryDelay: 30,
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

      vi.spyOn(pgBoss, "work").mockImplementation(async (queueName: string, options: unknown, processFn: WorkHandler<unknown>) => {
        await processFn([job as PgBossJob<unknown>]);
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

    it("installs the permissions the handler declares for its execution", async () => {
      const { service, pgBoss, executionContextService } = setup();
      deliverOneJob(pgBoss, { message: "Job 1", userId: "user-1" });

      await service.registerHandlers([new ReadPaymentMethodTestHandler(vi.fn().mockResolvedValue(undefined))]);
      await service.startWorkers({ concurrency: 1 });

      const ability = installedAbility(executionContextService);
      expect(ability.can("read", "PaymentMethod")).toBe(true);
      expect(ability.can("update", "PaymentMethod")).toBe(false);
    });

    it("installs an ability without rules when the handler declares no permissions", async () => {
      const { service, pgBoss, executionContextService } = setup();
      deliverOneJob(pgBoss, { message: "Job 1", userId: "user-1" });

      await service.registerHandlers([new TestHandler(vi.fn().mockResolvedValue(undefined))]);
      await service.startWorkers({ concurrency: 1 });

      const ability = installedAbility(executionContextService);
      expect(abilityInstallations(executionContextService)).toHaveLength(1);
      expect(ability.rules).toEqual([]);
      expect(ability.can("read", "PaymentMethod")).toBe(false);
    });

    it("declares the permissions from the payload the handler is given", async () => {
      const { service, pgBoss } = setup();
      const handler = new ReadOwnPaymentMethodTestHandler(vi.fn().mockResolvedValue(undefined));
      const requiresPermission = vi.spyOn(handler, "requiresPermission");
      const job = deliverOneJob(pgBoss, { message: "Job 1", userId: "user-1" });

      await service.registerHandlers([handler]);
      await service.startWorkers({ concurrency: 1 });

      expect(requiresPermission).toHaveBeenCalledWith(job.data);
    });

    it("keeps the conditions the handler declares for the job at hand", async () => {
      const { service, pgBoss, executionContextService } = setup();
      deliverOneJob(pgBoss, { message: "Job 1", userId: "user-1" });

      await service.registerHandlers([new ReadOwnPaymentMethodTestHandler(vi.fn().mockResolvedValue(undefined))]);
      await service.startWorkers({ concurrency: 1 });

      const ability = installedAbility(executionContextService);
      expect(ability.can("read", subject("PaymentMethod", { userId: "user-1" }))).toBe(true);
      expect(ability.can("read", subject("PaymentMethod", { userId: "user-2" }))).toBe(false);
    });

    it("installs the declared permissions before running the handler", async () => {
      const { service, pgBoss, executionContextService } = setup();
      deliverOneJob(pgBoss, { message: "Job 1", userId: "user-1" });
      const handle = vi.fn(async () => {
        expect(installedAbility(executionContextService).can("read", "PaymentMethod")).toBe(true);
      });

      await service.registerHandlers([new ReadPaymentMethodTestHandler(handle)]);
      await service.startWorkers({ concurrency: 1 });

      expect(handle).toHaveBeenCalledTimes(1);
    });

    it("fails the job when the handler cannot declare its permissions", async () => {
      const error = new Error("Permissions unavailable");
      const { service, pgBoss, logger } = setup();
      const handle = vi.fn().mockResolvedValue(undefined);
      const job = deliverOneJob(pgBoss, { message: "Job 1", userId: "user-1" });

      await service.registerHandlers([new UndeclarablePermissionTestHandler(handle, error)]);
      const [result] = await Promise.allSettled([service.startWorkers({ concurrency: 1 })]);

      expect(result.status).toBe("rejected");
      expect(logger.error).toHaveBeenCalledWith({ event: "JOB_FAILED", jobId: job.id, error });
      expect(handle).not.toHaveBeenCalled();
    });

    it("uses default options when none provided", async () => {
      const handleFn = vi.fn().mockResolvedValue(undefined);
      const handler = new TestHandler(handleFn);
      const { service, pgBoss } = setup();
      const job = { id: "1", data: { message: "Job 1", userId: "user-1" } };

      vi.spyOn(pgBoss, "work").mockImplementation(async (queueName: string, options: unknown, processFn: WorkHandler<unknown>) => {
        await processFn([job as PgBossJob<unknown>]);
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
      vi.spyOn(pgBoss, "on").mockImplementation(((event: string, handler: unknown) => {
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

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: JobQueueService.name });
  });

  it("obliges every handler to declare the permissions its execution needs", () => {
    expectTypeOf<JobHandler<TestJob>["requiresPermission"]>().toBeFunction();
  });

  function setup(input?: { pgBoss?: PgBoss; postgresDbUri?: string; queues?: QueueResult[] }) {
    const mocks = {
      logger: mock<ReturnType<CreateLogger>>(),
      coreConfig: mock<CoreConfigService>({
        get: vi.fn().mockReturnValue(input?.postgresDbUri ?? "postgresql://localhost:5432/test")
      }),
      pgBoss:
        input?.pgBoss ??
        mockDeep<PgBoss>({
          createQueue: vi.fn().mockResolvedValue(undefined),
          updateQueue: vi.fn().mockResolvedValue(undefined),
          getQueues: vi.fn().mockResolvedValue(input?.queues ?? []),
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
      }),
      txService: mock<TxService>()
    };

    const createLogger = vi.fn<CreateLogger>(() => mocks.logger);

    const service = new JobQueueService(
      createLogger,
      mocks.coreConfig,
      mocks.executionContextService,
      mocks.txService,
      input && Object.hasOwn(input, "pgBoss") ? input?.pgBoss : mocks.pgBoss
    );

    return { service, createLogger, ...mocks };
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

    requiresPermission(): JobPermissions {
      return [];
    }
  }

  class SingletonTestHandler implements JobHandler<TestJob> {
    readonly accepts = TestJob;
    readonly policy = "singleton" as const;
    constructor(public readonly handle: JobHandler<TestJob>["handle"]) {}

    requiresPermission(): JobPermissions {
      return [];
    }
  }

  class ReadPaymentMethodTestHandler implements JobHandler<TestJob> {
    readonly accepts = TestJob;
    constructor(public readonly handle: JobHandler<TestJob>["handle"]) {}

    requiresPermission(): JobPermissions {
      return [{ action: "read", subject: "PaymentMethod" }];
    }
  }

  class ReadOwnPaymentMethodTestHandler implements JobHandler<TestJob> {
    readonly accepts = TestJob;
    constructor(public readonly handle: JobHandler<TestJob>["handle"]) {}

    requiresPermission(payload: JobPayload<TestJob>): JobPermissions {
      return [{ action: "read", subject: "PaymentMethod", conditions: { userId: payload.userId } }];
    }
  }

  class UndeclarablePermissionTestHandler implements JobHandler<TestJob> {
    readonly accepts = TestJob;
    constructor(
      public readonly handle: JobHandler<TestJob>["handle"],
      private readonly error: Error
    ) {}

    requiresPermission(): JobPermissions {
      throw this.error;
    }
  }

  class AnotherTestJob implements Job {
    static readonly [JOB_NAME] = "another";
    readonly name = AnotherTestJob[JOB_NAME];
    readonly version = 1;

    constructor(public readonly data: { type: string }) {}
  }

  class AnotherTestHandler implements JobHandler<AnotherTestJob> {
    readonly accepts = AnotherTestJob;
    constructor(public readonly handle: JobHandler<AnotherTestJob>["handle"]) {}

    requiresPermission(): JobPermissions {
      return [];
    }
  }

  function deliverOneJob(pgBoss: PgBoss, data: Record<string, unknown>) {
    const job = { id: "1", data };
    vi.spyOn(pgBoss, "work").mockImplementation(async (queueName: string, options: unknown, processFn: WorkHandler<unknown>) => {
      await processFn([job as PgBossJob<unknown>]);
      return "work-id";
    });

    return job;
  }

  function abilityInstallations(executionContextService: MockProxy<ExecutionContextService>) {
    return vi.mocked(executionContextService.set).mock.calls.filter(([key]) => key === "ABILITY");
  }

  function installedAbility(executionContextService: MockProxy<ExecutionContextService>) {
    const [installation] = abilityInstallations(executionContextService);

    return installation[1] as MongoAbility;
  }

  function liveQueue(overrides?: Partial<QueueResult>) {
    return mock<QueueResult>({
      name: TestJob[JOB_NAME],
      policy: "standard",
      partition: false,
      retryLimit: 5,
      retryBackoff: true,
      retryDelay: 30,
      retryDelayMax: 5 * 60,
      ...overrides
    });
  }
});
