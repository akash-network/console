import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type { GpuWinBackService } from "./gpu-win-back.service";
import { GpuWinBackCheckHandler } from "./gpu-win-back-check.handler";

const RECHECK_AT = new Date("2026-10-20T12:00:00.000Z");

describe(GpuWinBackCheckHandler.name, () => {
  it("checks the person as of now", async () => {
    const { handler, gpuWinBackService } = setup();
    const before = Date.now();

    await handler.handle({ userId: "user-1", version: 1 });

    const [userId, checkedAt] = gpuWinBackService.check.mock.calls[0];
    expect(userId).toBe("user-1");
    expect(checkedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(checkedAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("logs what the check decided", async () => {
    const { handler, gpuWinBackService, logger } = setup();
    gpuWinBackService.check.mockResolvedValue({ outcome: "rescheduled", startAfter: RECHECK_AT });

    await handler.handle({ userId: "user-1", version: 1 });

    expect(logger.info).toHaveBeenCalledWith({ event: "GPU_WIN_BACK_CHECKED", userId: "user-1", outcome: "rescheduled", startAfter: RECHECK_AT });
  });

  it("lets a failed check throw, so the queue retries it", async () => {
    const { handler, gpuWinBackService } = setup();
    gpuWinBackService.check.mockRejectedValue(new Error("chain db down"));

    await expect(handler.handle({ userId: "user-1", version: 1 })).rejects.toThrow("chain db down");
  });

  it("creates the logger with the handler context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: GpuWinBackCheckHandler.name });
  });

  it("declares no permissions, because a worker carries no user", () => {
    expect(setup().handler.requiresPermission()).toEqual([]);
  });

  it("declares the short policy, so one check per person waits in the queue while a running one can queue its successor", () => {
    expect(setup().handler.policy).toBe("short");
  });

  function setup() {
    const gpuWinBackService = mock<GpuWinBackService>();
    gpuWinBackService.check.mockResolvedValue({ outcome: "ineligible" });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const handler = new GpuWinBackCheckHandler(gpuWinBackService, createLogger);

    return { handler, gpuWinBackService, logger, createLogger };
  }
});
