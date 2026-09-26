import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { JobRunObserver } from "@src/jobs/job-scheduler";
import { JobScheduler } from "@src/jobs/job-scheduler";
import type { LoggerService } from "@src/providers/logging.provider";

describe(JobScheduler.name, () => {
  it("runs a job at start when asked and again on every interval", async () => {
    vi.useFakeTimers();
    try {
      const { scheduler, run } = setup({ intervalMs: 1_000, runAtStart: true });

      scheduler.start();
      await vi.advanceTimersByTimeAsync(2_500);
      await scheduler.stop();

      expect(run).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits for the first interval when the job does not run at start", async () => {
    vi.useFakeTimers();
    try {
      const { scheduler, run } = setup({ intervalMs: 1_000, runAtStart: false });

      scheduler.start();
      await vi.advanceTimersByTimeAsync(999);
      expect(run).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await scheduler.stop();

      expect(run).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips a tick while the previous run is still in flight", async () => {
    vi.useFakeTimers();
    try {
      const { scheduler, run, logger } = setup({ intervalMs: 1_000, runAtStart: true, runDurationMs: 1_500 });

      scheduler.start();
      await vi.advanceTimersByTimeAsync(2_500);
      const stopping = scheduler.stop();
      await vi.advanceTimersByTimeAsync(2_000);
      await stopping;

      expect(run).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "JOB_TICK_SKIPPED", job: "price-history" }));
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a successful run with its duration", async () => {
    vi.useFakeTimers();
    try {
      const { scheduler, observer } = setup({ intervalMs: 60_000, runAtStart: true, runDurationMs: 250 });

      scheduler.start();
      await vi.advanceTimersByTimeAsync(300);
      await scheduler.stop();

      expect(observer.onStart).toHaveBeenCalledWith("price-history");
      expect(observer.onSuccess).toHaveBeenCalledWith("price-history", 250);
      expect(observer.onFailure).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a failed run with the error and keeps scheduling", async () => {
    vi.useFakeTimers();
    try {
      const { scheduler, run, observer } = setup({ intervalMs: 1_000, runAtStart: true, failWith: new Error("coingecko down") });

      scheduler.start();
      await vi.advanceTimersByTimeAsync(1_000);
      await scheduler.stop();

      expect(observer.onFailure).toHaveBeenCalledWith("price-history", expect.any(Number), expect.objectContaining({ message: "coingecko down" }));
      expect(run).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("aborts a run that exceeds its timeout and records it as a failure", async () => {
    vi.useFakeTimers();
    try {
      const { scheduler, observer, signals } = setup({ intervalMs: 60_000, runAtStart: true, timeoutMs: 500, hangs: true });

      scheduler.start();
      await vi.advanceTimersByTimeAsync(600);
      await scheduler.stop();

      expect(signals[0].aborted).toBe(true);
      expect(observer.onFailure).toHaveBeenCalledWith(
        "price-history",
        500,
        expect.objectContaining({ message: expect.stringMatching(/timed out after 500 ms/) })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects registering the same job twice", () => {
    const { scheduler } = setup({ intervalMs: 1_000 });

    expect(() => scheduler.register({ name: "price-history", intervalMs: 1_000, timeoutMs: 1_000, run: async () => undefined })).toThrow(
      'Job "price-history" is already registered'
    );
  });

  it("stops ticking and waits for the in-flight run when stopped", async () => {
    vi.useFakeTimers();
    try {
      const { scheduler, run, observer } = setup({ intervalMs: 1_000, runAtStart: true, runDurationMs: 300 });

      scheduler.start();
      await vi.advanceTimersByTimeAsync(100);
      const stopping = scheduler.stop();
      await vi.advanceTimersByTimeAsync(5_000);
      await stopping;

      expect(run).toHaveBeenCalledTimes(1);
      expect(observer.onSuccess).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  function setup(input: { intervalMs: number; runAtStart?: boolean; runDurationMs?: number; timeoutMs?: number; failWith?: Error; hangs?: boolean }) {
    const signals: AbortSignal[] = [];
    const run = vi.fn(async (signal: AbortSignal) => {
      signals.push(signal);
      if (input.hangs) {
        await new Promise<void>(resolve => signal.addEventListener("abort", () => resolve()));
        return;
      }
      if (input.runDurationMs) {
        await new Promise(resolve => setTimeout(resolve, input.runDurationMs));
      }
      if (input.failWith) {
        throw input.failWith;
      }
    });
    const observer = mock<JobRunObserver>();
    observer.onStart.mockResolvedValue(undefined);
    observer.onSuccess.mockResolvedValue(undefined);
    observer.onFailure.mockResolvedValue(undefined);
    const logger = mock<LoggerService>();

    const scheduler = new JobScheduler(observer, logger);
    scheduler.register({ name: "price-history", intervalMs: input.intervalMs, timeoutMs: input.timeoutMs ?? 10_000, runAtStart: input.runAtStart, run });

    return { scheduler, run, observer, logger, signals };
  }
});
