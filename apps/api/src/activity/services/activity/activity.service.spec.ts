import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ACTIVITIES_DEDUPE_KEY_INDEX, type NewActivity } from "@src/activity/model-schemas";
import type { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import type { AuthService } from "@src/auth/services/auth.service";
import type { CreateLogger } from "@src/core";
import { encodeActivityCursor } from "../../lib/activity-cursor/activity-cursor";
import { ActivityService } from "./activity.service";

import { createActivity } from "@test/seeders/activity.seeder";
import { createUniqueViolation } from "@test/seeders/unique-violation.seeder";

describe(ActivityService.name, () => {
  describe("record", () => {
    it("stores the activity unless another row already holds its dedupe key", async () => {
      const { service, activityRepository, logger } = setup();
      const activity = createNewActivity();
      activityRepository.createUnlessDuplicate.mockResolvedValue(createActivity());

      await service.record(activity);

      expect(activityRepository.createUnlessDuplicate).toHaveBeenCalledWith(activity);
      expect(logger.info).not.toHaveBeenCalled();
    });

    it("says so when another row already reports the outcome, without failing the action", async () => {
      const { service, activityRepository, logger } = setup();
      const activity = createNewActivity({ dedupeKey: "deployment_close.1234" });
      activityRepository.createUnlessDuplicate.mockResolvedValue(undefined);

      await expect(service.record(activity)).resolves.toBeUndefined();

      expect(logger.info).toHaveBeenCalledWith({
        event: "ACTIVITY_RECORD_DEDUPED",
        userId: activity.userId,
        type: "deployment_close",
        dedupeKey: "deployment_close.1234"
      });
    });

    it("logs a failed write instead of failing the action that already happened", async () => {
      const { service, activityRepository, logger, createLogger } = setup();
      const error = new Error("connection reset");
      activityRepository.createUnlessDuplicate.mockRejectedValue(error);
      const activity = createNewActivity({ status: "failed" });

      await expect(service.record(activity)).resolves.toBeUndefined();

      expect(createLogger).toHaveBeenCalledWith({ context: ActivityService.name });
      expect(logger.error).toHaveBeenCalledWith({
        event: "ACTIVITY_RECORD_FAILED",
        userId: activity.userId,
        type: "deployment_close",
        status: "failed",
        error
      });
    });
  });

  describe("open", () => {
    it("stores the activity under the id it was given and lets a failed write fail the caller", async () => {
      const { service, activityRepository } = setup();
      const error = new Error("connection reset");
      activityRepository.create.mockRejectedValue(error);
      const activity = { id: faker.string.uuid(), ...createNewActivity({ status: "pending" }) };

      await expect(service.open(activity)).rejects.toBe(error);

      expect(activityRepository.create).toHaveBeenCalledWith(activity);
    });
  });

  describe("isPending", () => {
    it.each([
      ["a pending activity", createActivity({ status: "pending" }), true],
      ["a settled activity", createActivity({ status: "succeeded" }), false],
      ["an activity that no longer exists", undefined, false]
    ])("answers %s", async (_, found, expected) => {
      const { service, activityRepository } = setup();
      activityRepository.findById.mockResolvedValue(found);

      expect(await service.isPending("activity-1")).toBe(expected);
      expect(activityRepository.findById).toHaveBeenCalledWith("activity-1");
    });
  });

  describe("findByDedupeKey", () => {
    it("reads the user's row holding the dedupe key", async () => {
      const { service, activityRepository } = setup();
      const activity = createActivity({ dedupeKey: "deployment_close.100" });
      activityRepository.findOneBy.mockResolvedValue(activity);

      expect(await service.findByDedupeKey(activity.userId, "deployment_close.100")).toBe(activity);
      expect(activityRepository.findOneBy).toHaveBeenCalledWith({ userId: activity.userId, dedupeKey: "deployment_close.100" });
    });
  });

  describe("settle", () => {
    it("writes the outcome and its dedupe key only onto an activity that is still pending", async () => {
      const { service, activityRepository } = setup();

      await service.settle("activity-1", createNewActivity({ status: "succeeded", meta: { dseq: "100" }, dedupeKey: "deployment_close.100" }));

      expect(activityRepository.updateByIdIfStatusIn).toHaveBeenCalledWith("activity-1", ["pending"], {
        status: "succeeded",
        meta: { dseq: "100" },
        dedupeKey: "deployment_close.100"
      });
    });

    it("writes the outcome over the statuses the caller allows instead", async () => {
      const { service, activityRepository } = setup();

      await service.settle("activity-1", createNewActivity({ status: "succeeded", meta: { dseq: "100" } }), { from: ["pending", "failed"] });

      expect(activityRepository.updateByIdIfStatusIn).toHaveBeenCalledWith("activity-1", ["pending", "failed"], {
        status: "succeeded",
        meta: { dseq: "100" },
        dedupeKey: null
      });
    });

    it("leaves the activity as it was when another row already holds the dedupe key it would take", async () => {
      const { service, activityRepository, logger } = setup();
      activityRepository.updateByIdIfStatusIn.mockRejectedValue(createUniqueViolation(ACTIVITIES_DEDUPE_KEY_INDEX));

      await expect(
        service.settle("activity-1", createNewActivity({ status: "succeeded", dedupeKey: "deployment_close.100" }), { from: ["pending", "failed"] })
      ).resolves.toBeUndefined();

      expect(logger.info).toHaveBeenCalledWith({
        event: "ACTIVITY_SETTLE_DEDUPED",
        activityId: "activity-1",
        status: "succeeded",
        dedupeKey: "deployment_close.100"
      });
    });

    it("lets any other failed write through", async () => {
      const { service, activityRepository } = setup();
      const error = createUniqueViolation("activities_pkey");
      activityRepository.updateByIdIfStatusIn.mockRejectedValue(error);

      await expect(service.settle("activity-1", createNewActivity())).rejects.toBe(error);
    });
  });

  describe("list", () => {
    it("reads the caller's activities one row past the page so it can tell whether another page follows", async () => {
      const { service, activityRepository, readRepository, ability } = setup();
      const rows = [createActivity(), createActivity(), createActivity()];
      readRepository.findPage.mockResolvedValue(rows);

      const page = await service.list({ limit: 2 });

      expect(activityRepository.accessibleBy).toHaveBeenCalledWith(ability, "read");
      expect(readRepository.findPage).toHaveBeenCalledWith({ limit: 3, after: undefined, status: undefined, type: undefined });
      expect(page).toEqual({ activities: rows.slice(0, 2), hasMore: true, nextCursor: encodeActivityCursor(rows[1]) });
    });

    it("reports the last page without a cursor to a next one", async () => {
      const { service, readRepository } = setup();
      const rows = [createActivity(), createActivity()];
      readRepository.findPage.mockResolvedValue(rows);

      expect(await service.list({ limit: 2 })).toEqual({ activities: rows, hasMore: false, nextCursor: null });
    });

    it("continues after the position its cursor names, with the filters it was given", async () => {
      const { service, readRepository } = setup();
      const position = { createdAt: "2026-10-05T10:15:30.123Z", id: faker.string.uuid() };
      readRepository.findPage.mockResolvedValue([]);

      await service.list({ limit: 20, cursor: encodeActivityCursor(position), status: "failed", type: "deployment_close" });

      expect(readRepository.findPage).toHaveBeenCalledWith({ limit: 21, after: position, status: "failed", type: "deployment_close" });
    });

    it("refuses a cursor it cannot read before querying", async () => {
      const { service, readRepository } = setup();

      await expect(service.list({ limit: 20, cursor: "garbage" })).rejects.toMatchObject({ status: 400 });

      expect(readRepository.findPage).not.toHaveBeenCalled();
    });
  });

  describe("findById", () => {
    it("reads the activity only among the caller's own", async () => {
      const { service, activityRepository, readRepository, ability } = setup();
      const activity = createActivity();
      readRepository.findById.mockResolvedValue(activity);

      expect(await service.findById(activity.id)).toBe(activity);
      expect(activityRepository.accessibleBy).toHaveBeenCalledWith(ability, "read");
      expect(readRepository.findById).toHaveBeenCalledWith(activity.id);
    });
  });

  describe("countUnseen", () => {
    it("counts the caller's unseen activities", async () => {
      const { service, activityRepository, readRepository, ability } = setup();
      readRepository.countUnseen.mockResolvedValue(4);

      expect(await service.countUnseen()).toBe(4);
      expect(activityRepository.accessibleBy).toHaveBeenCalledWith(ability, "read");
    });
  });

  describe("markSeen", () => {
    it("marks the caller's selected activities seen and answers with what is still unseen", async () => {
      const { service, activityRepository, updateRepository, readRepository, ability } = setup();
      readRepository.countUnseen.mockResolvedValue(1);
      const selection = { ids: [faker.string.uuid()] };

      expect(await service.markSeen(selection)).toBe(1);

      expect(activityRepository.accessibleBy).toHaveBeenCalledWith(ability, "update");
      expect(updateRepository.markSeen).toHaveBeenCalledWith(selection);
    });
  });

  function createNewActivity(overrides: Partial<NewActivity> = {}): NewActivity {
    return { userId: faker.string.uuid(), type: "deployment_close", status: "succeeded", initiator: "user", meta: { dseq: "1234" }, dedupeKey: null, ...overrides };
  }

  function setup() {
    const activityRepository = mock<ActivityRepository>();
    const readRepository = mock<ActivityRepository>();
    const updateRepository = mock<ActivityRepository>();
    activityRepository.accessibleBy.mockImplementation((_, action) => (action === "update" ? updateRepository : readRepository));
    const ability = createMongoAbility();
    const authService = mock<AuthService>();
    authService.ability = ability;
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new ActivityService(activityRepository, authService, createLogger);

    return { service, activityRepository, readRepository, updateRepository, logger, createLogger, ability };
  }
});
