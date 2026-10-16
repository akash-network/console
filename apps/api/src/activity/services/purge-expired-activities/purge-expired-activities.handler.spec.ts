import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import type { CreateLogger } from "@src/core";
import { PurgeExpiredActivitiesHandler } from "./purge-expired-activities.handler";

describe(PurgeExpiredActivitiesHandler.name, () => {
  it("deletes settled activities created more than 90 days ago in batches until a batch comes back short", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-12T09:30:00.000Z"), toFake: ["Date"] });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const { handler, activityRepository, logger, createLogger } = setup({ deletedPerBatch: [1000, 1000, 999] });

    await handler.handle();

    expect(activityRepository.deleteSettledCreatedBefore.mock.calls).toEqual([
      [new Date("2026-07-14T09:30:00.000Z"), 1000],
      [new Date("2026-07-14T09:30:00.000Z"), 1000],
      [new Date("2026-07-14T09:30:00.000Z"), 1000]
    ]);
    expect(createLogger).toHaveBeenCalledWith({ context: PurgeExpiredActivitiesHandler.name });
    expect(logger.info).toHaveBeenCalledWith({ event: "EXPIRED_ACTIVITIES_PURGED", createdBefore: "2026-07-14T09:30:00.000Z", purged: 2999 });
  });

  it("stops after one batch when nothing is old enough to delete", async () => {
    const { handler, activityRepository, logger } = setup({ deletedPerBatch: [0] });

    await handler.handle();

    expect(activityRepository.deleteSettledCreatedBefore).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ purged: 0 }));
  });

  it("keeps one waiting purge for the whole feed and needs no user's permission", () => {
    const { handler } = setup({ deletedPerBatch: [] });

    expect(handler.policy).toBe("short");
    expect(handler.requiresPermission()).toEqual([]);
  });

  function setup(input: { deletedPerBatch: number[] }) {
    const activityRepository = mock<ActivityRepository>();
    input.deletedPerBatch.forEach(deleted => activityRepository.deleteSettledCreatedBefore.mockResolvedValueOnce(deleted));
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const handler = new PurgeExpiredActivitiesHandler(activityRepository, createLogger);

    return { handler, activityRepository, logger, createLogger };
  }
});
