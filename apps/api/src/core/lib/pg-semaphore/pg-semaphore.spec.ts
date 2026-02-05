import postgres = require("postgres");
import * as process from "node:process";
import { setTimeout as delay } from "timers/promises";

import { PgSemaphore } from "./pg-semaphore";

jest.setTimeout(30000);

describe(PgSemaphore.name, () => {
  const db = postgres(process.env.POSTGRES_DB_URI!);

  beforeAll(() => {
    PgSemaphore.configure(db);
  });

  afterAll(async () => {
    await db.end();
  });

  describe("withLock", () => {
    it("executes function and returns result", async () => {
      const semaphore = new PgSemaphore("test-lock-1", db);

      const result = await semaphore.withLock(async () => {
        return "success";
      });

      expect(result).toBe("success");
    });

    it("serializes concurrent executions with the same key", async () => {
      const semaphore = new PgSemaphore("test-lock-2", db);
      let activeCount = 0;
      let maxConcurrent = 0;

      const task = async (id: number, delayMs: number) => {
        return semaphore.withLock(async () => {
          activeCount++;
          maxConcurrent = Math.max(maxConcurrent, activeCount);
          await delay(delayMs);
          activeCount--;
          return id;
        });
      };

      const [result1, result2, result3] = await Promise.all([task(1, 50), task(2, 10), task(3, 10)]);

      expect(result1).toBe(1);
      expect(result2).toBe(2);
      expect(result3).toBe(3);
      expect(maxConcurrent).toBe(1);
    });

    it("allows concurrent executions with different keys", async () => {
      const semaphore1 = new PgSemaphore("test-lock-3a", db);
      const semaphore2 = new PgSemaphore("test-lock-3b", db);
      const executionOrder: string[] = [];

      const task1 = semaphore1.withLock(async () => {
        executionOrder.push("1-start");
        await delay(50);
        executionOrder.push("1-end");
        return 1;
      });

      const task2 = semaphore2.withLock(async () => {
        executionOrder.push("2-start");
        await delay(10);
        executionOrder.push("2-end");
        return 2;
      });

      const [result1, result2] = await Promise.all([task1, task2]);

      expect(result1).toBe(1);
      expect(result2).toBe(2);
      expect(executionOrder).toContain("1-start");
      expect(executionOrder).toContain("2-start");
      expect(executionOrder.indexOf("2-end")).toBeLessThan(executionOrder.indexOf("1-end"));
    });

    it("releases lock when function throws", async () => {
      const semaphore = new PgSemaphore("test-lock-4", db);

      await expect(
        semaphore.withLock(async () => {
          throw new Error("test error");
        })
      ).rejects.toThrow("test error");

      const result = await semaphore.withLock(async () => "recovered");
      expect(result).toBe("recovered");
    });

    it("works with default sql from static configuration", async () => {
      const semaphore = new PgSemaphore("test-lock-static");

      const result = await semaphore.withLock(async () => "static-config-works");

      expect(result).toBe("static-config-works");
    });
  });

  describe("nrInFlight", () => {
    it("tracks in-flight count", async () => {
      const semaphore = new PgSemaphore("test-lock-5", db);

      expect(semaphore.nrInFlight()).toBe(0);

      const longTask = semaphore.withLock(async () => {
        await delay(100);
        return "done";
      });

      await delay(10);

      const waitingTask = semaphore.withLock(async () => "waiting");

      await delay(10);
      expect(semaphore.nrInFlight()).toBeGreaterThanOrEqual(1);

      await Promise.all([longTask, waitingTask]);
      expect(semaphore.nrInFlight()).toBe(0);
    });
  });
});
