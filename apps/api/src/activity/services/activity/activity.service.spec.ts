import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import createError from "http-errors";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ACTIVITIES_DEDUPE_KEY_INDEX, type NewActivity } from "@src/activity/model-schemas";
import type { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import type { ActivityInstrumentationService } from "@src/activity/services/activity-instrumentation/activity-instrumentation.service";
import { PurgeExpiredActivities } from "@src/activity/services/purge-expired-activities/purge-expired-activities.job";
import type { AuthService } from "@src/auth/services/auth.service";
import type { CreateLogger, JobQueueService, TxService } from "@src/core";
import { ORGANIZATION_FORBIDDEN_ERROR_CODE } from "@src/core/repositories/org-scoped.repository";
import { type OrganizationContextResolver, PROJECT_FORBIDDEN_ERROR_CODE } from "@src/organization/services/organization-context/organization-context.resolver";
import type { OrganizationContext, ProjectScope } from "@src/organization/types/organization-context";
import type { UserRepository } from "@src/user/repositories/user/user.repository";
import { encodeActivityCursor } from "../../lib/activity-cursor/activity-cursor";
import { ActivityService, type NewAlertActivity } from "./activity.service";

import { createActivity } from "@test/seeders/activity.seeder";
import { createForeignKeyViolation } from "@test/seeders/foreign-key-violation.seeder";
import { createUniqueViolation } from "@test/seeders/unique-violation.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(ActivityService.name, () => {
  describe("record", () => {
    it("stores the activity unless another row already holds its dedupe key, and measures the row it wrote", async () => {
      const { service, activityRepository, activityInstrumentation, logger } = setup();
      const activity = createNewActivity();
      const recorded = createActivity();
      activityRepository.createUnlessDuplicate.mockResolvedValue(recorded);

      await service.record(activity);

      expect(activityRepository.createUnlessDuplicate).toHaveBeenCalledWith(activity);
      expect(activityInstrumentation.trackRecorded).toHaveBeenCalledWith(recorded);
      expect(logger.info).not.toHaveBeenCalled();
    });

    it("stores an activity without a dedupe key outside any transaction, leaving every alert in place", async () => {
      const { service, activityRepository, txService } = setup();

      await service.record(createNewActivity({ status: "failed", dedupeKey: null }));

      expect(activityRepository.createUnlessDuplicate).toHaveBeenCalledTimes(1);
      expect(activityRepository.deleteBy).not.toHaveBeenCalled();
      expect(txService.transaction).not.toHaveBeenCalled();
    });

    it("stores a close whose dedupe key is free without touching any alert", async () => {
      const { service, activityRepository, txService } = setup();
      activityRepository.createUnlessDuplicate.mockResolvedValue(createActivity());

      await service.record(createNewActivity({ dedupeKey: "deployment_close.akash1owner.1234" }));

      expect(activityRepository.createUnlessDuplicate).toHaveBeenCalledTimes(1);
      expect(activityRepository.deleteBy).not.toHaveBeenCalled();
      expect(txService.transaction).not.toHaveBeenCalled();
    });

    it("replaces the deployment-closed alert holding the close's dedupe key with the close, in one transaction", async () => {
      const { service, activityRepository, activityInstrumentation, txService } = setup();
      const activity = createNewActivity({ dedupeKey: "deployment_close.akash1owner.1234" });
      const recorded = createActivity();
      activityRepository.createUnlessDuplicate.mockResolvedValueOnce(undefined).mockResolvedValueOnce(recorded);

      await service.record(activity);

      expect(txService.transaction).toHaveBeenCalledTimes(1);
      expect(activityRepository.deleteBy).toHaveBeenCalledWith({
        userId: activity.userId,
        dedupeKey: "deployment_close.akash1owner.1234",
        type: "deployment_closed_alert"
      });
      expect(activityRepository.createUnlessDuplicate).toHaveBeenCalledTimes(2);
      expect(activityRepository.createUnlessDuplicate).toHaveBeenLastCalledWith(activity);
      expect(activityRepository.deleteBy.mock.invocationCallOrder[0]).toBeLessThan(activityRepository.createUnlessDuplicate.mock.invocationCallOrder[1]);
      expect(activityInstrumentation.trackRecorded).toHaveBeenCalledWith(recorded);
    });

    it("logs a failed replacement instead of failing the action that already happened", async () => {
      const { service, activityRepository, logger } = setup();
      const error = new Error("connection reset");
      activityRepository.createUnlessDuplicate.mockResolvedValue(undefined);
      activityRepository.deleteBy.mockRejectedValue(error);
      const activity = createNewActivity({ dedupeKey: "deployment_close.akash1owner.1234" });

      await expect(service.record(activity)).resolves.toBeUndefined();

      expect(activityRepository.createUnlessDuplicate).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "ACTIVITY_RECORD_FAILED", error }));
    });

    it("says so when another row already reports the outcome, without failing the action or measuring it twice", async () => {
      const { service, activityRepository, activityInstrumentation, logger } = setup();
      const activity = createNewActivity({ dedupeKey: "deployment_close.akash1owner.1234" });
      activityRepository.createUnlessDuplicate.mockResolvedValue(undefined);

      await expect(service.record(activity)).resolves.toBeUndefined();

      expect(activityInstrumentation.trackRecorded).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith({
        event: "ACTIVITY_RECORD_DEDUPED",
        userId: activity.userId,
        type: "deployment_close",
        dedupeKey: "deployment_close.akash1owner.1234"
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

    it("queues the next purge of old activities a day ahead under the one key every write shares", async () => {
      vi.useFakeTimers({ now: new Date("2026-10-12T09:30:00.000Z"), toFake: ["Date"] });
      onTestFinished(() => {
        vi.useRealTimers();
      });
      const { service, activityRepository, jobQueueService } = setup();
      activityRepository.createUnlessDuplicate.mockResolvedValue(createActivity());

      await service.record(createNewActivity());

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new PurgeExpiredActivities(), {
        singletonKey: "purgeExpiredActivities",
        startAfter: "2026-10-13T09:30:00.000Z",
        retryLimit: 5,
        retryBackoff: true,
        retryDelay: 60,
        retryDelayMax: 3600
      });
    });

    it("logs a purge it could not queue without failing the action", async () => {
      const { service, activityRepository, jobQueueService, logger } = setup();
      const error = new Error("Queue PurgeExpiredActivities does not exist");
      activityRepository.createUnlessDuplicate.mockResolvedValue(createActivity());
      jobQueueService.enqueue.mockRejectedValue(error);

      await expect(service.record(createNewActivity())).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith({ event: "ACTIVITY_PURGE_QUEUE_FAILED", error });
    });
  });

  describe("addAlert", () => {
    it("adds an alert set before organizations as an info entry Console wrote, measuring it, without asking who can see it", async () => {
      const { service, activityRepository, activityInstrumentation, organizationContextResolver, userRepository, logger } = setup();
      const alert = createNewAlertActivity({ organizationId: null, projectId: null });
      const added = createActivity({ type: "wallet_balance_alert", status: "info", initiator: "system" });
      activityRepository.createUnlessDuplicate.mockResolvedValue(added);

      await service.addAlert(alert);

      expect(activityRepository.createUnlessDuplicate).toHaveBeenCalledWith({
        userId: alert.userId,
        type: "wallet_balance_alert",
        status: "info",
        initiator: "system",
        meta: alert.meta,
        dedupeKey: alert.dedupeKey
      });
      expect(activityInstrumentation.trackRecorded).toHaveBeenCalledWith(added);
      expect(userRepository.findById).not.toHaveBeenCalled();
      expect(organizationContextResolver.resolveBoundTo).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });

    it("resolves the user in the alert's organization as a job bound to it does, and adds an alert the user reaches every project of", async () => {
      const { service, activityRepository, organizationContextResolver, userRepository, user } = setup({ access: { kind: "all" } });
      const alert = createNewAlertActivity({ userId: user.id, projectId: null });
      activityRepository.createUnlessDuplicate.mockResolvedValue(createActivity());

      await service.addAlert(alert);

      expect(userRepository.findById).toHaveBeenCalledWith(user.id);
      expect(organizationContextResolver.resolveBoundTo).toHaveBeenCalledWith(user, alert.organizationId);
      expect(activityRepository.createUnlessDuplicate).toHaveBeenCalledWith(expect.objectContaining({ userId: user.id, dedupeKey: alert.dedupeKey }));
    });

    it("keeps the organization an alert is filed in on its entry, so the entry can lead to that organization", async () => {
      const { service, activityRepository, user } = setup({ access: { kind: "all" } });
      const alert = createNewAlertActivity({ userId: user.id, projectId: null });
      activityRepository.createUnlessDuplicate.mockResolvedValue(createActivity());

      await service.addAlert(alert);

      expect(activityRepository.createUnlessDuplicate).toHaveBeenCalledWith({
        userId: user.id,
        type: "wallet_balance_alert",
        status: "info",
        initiator: "system",
        meta: { ...alert.meta, organizationId: alert.organizationId },
        dedupeKey: alert.dedupeKey
      });
    });

    it("adds the alert of a project the member can still see", async () => {
      const projectId = faker.string.uuid();
      const { service, activityRepository } = setup({ access: projectScopeOf([faker.string.uuid(), projectId]) });
      activityRepository.createUnlessDuplicate.mockResolvedValue(createActivity());

      await service.addAlert(createNewAlertActivity({ type: "deployment_reclaim_alert", projectId }));

      expect(activityRepository.createUnlessDuplicate).toHaveBeenCalledTimes(1);
    });

    it.each([
      ["the user left the organization", { access: "not_a_member" as const, projectId: faker.string.uuid() }],
      ["no organization context resolves for the user", { access: "no_context" as const, projectId: faker.string.uuid() }],
      ["the member cannot see the alert's project", { access: projectScopeOf([faker.string.uuid()]), projectId: faker.string.uuid() }],
      ["the alert is in no project and the member reaches only some", { access: projectScopeOf([faker.string.uuid()]), projectId: null }]
    ])("writes nothing and says so when %s", async (_, { access, projectId }) => {
      const { service, activityRepository, activityInstrumentation, jobQueueService, logger } = setup({ access });
      const alert = createNewAlertActivity({ type: "deployment_closed_alert", projectId });

      await expect(service.addAlert(alert)).resolves.toBeUndefined();

      expect(activityRepository.createUnlessDuplicate).not.toHaveBeenCalled();
      expect(activityInstrumentation.trackRecorded).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith({
        event: "ACTIVITY_ALERT_OUT_OF_REACH",
        userId: alert.userId,
        organizationId: alert.organizationId,
        projectId,
        type: "deployment_closed_alert",
        alertId: alert.meta.alertId
      });
    });

    it("answers 404 for an organization's alert whose user console-api does not know", async () => {
      const { service, activityRepository, organizationContextResolver } = setup({ userExists: false });

      await expect(service.addAlert(createNewAlertActivity())).rejects.toMatchObject({ status: 404, message: "User not found" });

      expect(organizationContextResolver.resolveBoundTo).not.toHaveBeenCalled();
      expect(activityRepository.createUnlessDuplicate).not.toHaveBeenCalled();
    });

    it("lets another failure to resolve the organization reach the caller and writes nothing", async () => {
      const error = new Error("connection reset");
      const { service, activityRepository } = setup({ access: error });

      await expect(service.addAlert(createNewAlertActivity())).rejects.toBe(error);

      expect(activityRepository.createUnlessDuplicate).not.toHaveBeenCalled();
    });

    it("lets another refusal to resolve the organization reach the caller", async () => {
      const refusal = createError(403, "The API key belongs to an organization this request cannot run in", { errorCode: PROJECT_FORBIDDEN_ERROR_CODE });
      const { service } = setup({ access: refusal });

      await expect(service.addAlert(createNewAlertActivity())).rejects.toBe(refusal);
    });

    it("says so when another row already holds the alert's dedupe key, and still succeeds without measuring a write", async () => {
      const { service, activityRepository, activityInstrumentation, logger } = setup();
      const alert = createNewAlertActivity({ type: "deployment_closed_alert", dedupeKey: "deployment_close.akash1owner.1234" });
      activityRepository.createUnlessDuplicate.mockResolvedValue(undefined);

      await expect(service.addAlert(alert)).resolves.toBeUndefined();

      expect(activityInstrumentation.trackRecorded).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith({
        event: "ACTIVITY_ALERT_DEDUPED",
        userId: alert.userId,
        type: "deployment_closed_alert",
        dedupeKey: "deployment_close.akash1owner.1234"
      });
    });

    it("queues the next purge of old activities once the alert is in", async () => {
      const { service, activityRepository, jobQueueService } = setup();
      activityRepository.createUnlessDuplicate.mockResolvedValue(createActivity());

      await service.addAlert(createNewAlertActivity());

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new PurgeExpiredActivities(), expect.objectContaining({ singletonKey: "purgeExpiredActivities" }));
    });

    it("answers 404 when the write finds no user with the alert's user id", async () => {
      const { service, activityRepository } = setup();
      activityRepository.createUnlessDuplicate.mockRejectedValue(createForeignKeyViolation("activities_user_id_userSetting_id_fk"));

      await expect(service.addAlert(createNewAlertActivity({ organizationId: null }))).rejects.toMatchObject({ status: 404, message: "User not found" });
    });

    it("lets any other failure reach the caller", async () => {
      const { service, activityRepository } = setup();
      const error = createUniqueViolation("activities_pkey");
      activityRepository.createUnlessDuplicate.mockRejectedValue(error);

      await expect(service.addAlert(createNewAlertActivity())).rejects.toBe(error);
    });
  });

  describe("open", () => {
    it("stores the activity under the id it was given and measures it as opened", async () => {
      const { service, activityRepository, activityInstrumentation } = setup();
      const activity = { id: faker.string.uuid(), ...createNewActivity({ status: "pending", initiator: "system" }) };

      await service.open(activity);

      expect(activityRepository.create).toHaveBeenCalledWith(activity);
      expect(activityInstrumentation.trackOpened).toHaveBeenCalledWith(activity);
    });

    it("lets a failed write fail the caller without measuring an activity that was never opened or queueing a purge", async () => {
      const { service, activityRepository, activityInstrumentation, jobQueueService } = setup();
      const error = new Error("connection reset");
      activityRepository.create.mockRejectedValue(error);
      const activity = { id: faker.string.uuid(), ...createNewActivity({ status: "pending" }) };

      await expect(service.open(activity)).rejects.toBe(error);

      expect(activityRepository.create).toHaveBeenCalledWith(activity);
      expect(activityInstrumentation.trackOpened).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("queues the next purge of old activities once the activity is stored", async () => {
      const { service, activityRepository, jobQueueService } = setup();

      await service.open({ id: faker.string.uuid(), ...createNewActivity({ status: "pending" }) });

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new PurgeExpiredActivities(), expect.objectContaining({ singletonKey: "purgeExpiredActivities" }));
      expect(activityRepository.create.mock.invocationCallOrder[0]).toBeLessThan(jobQueueService.enqueue.mock.invocationCallOrder[0]);
    });

    it("logs a purge it could not queue without failing the transaction the activity is opened in", async () => {
      const { service, jobQueueService, logger } = setup();
      const error = new Error("Queue PurgeExpiredActivities does not exist");
      jobQueueService.enqueue.mockRejectedValue(error);

      await expect(service.open({ id: faker.string.uuid(), ...createNewActivity({ status: "pending" }) })).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith({ event: "ACTIVITY_PURGE_QUEUE_FAILED", error });
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

  describe("isOvertakenBySuccess", () => {
    it("asks whether the same user's same action on the deployment succeeded after this one was opened", async () => {
      const { service, activityRepository } = setup();
      const pending = createActivity({ type: "lease_create", status: "pending", meta: { dseq: "100" }, createdAt: "2026-10-05T10:00:00.000Z" });
      activityRepository.findById.mockResolvedValue(pending);
      activityRepository.hasSucceededSince.mockResolvedValue(true);

      expect(await service.isOvertakenBySuccess(pending.id)).toBe(true);
      expect(activityRepository.findById).toHaveBeenCalledWith(pending.id);
      expect(activityRepository.hasSucceededSince).toHaveBeenCalledWith({
        userId: pending.userId,
        type: "lease_create",
        dseq: "100",
        since: "2026-10-05T10:00:00.000Z"
      });
    });

    it("answers no when nothing succeeded after it", async () => {
      const { service, activityRepository } = setup();
      activityRepository.findById.mockResolvedValue(createActivity({ meta: { dseq: "100" } }));
      activityRepository.hasSucceededSince.mockResolvedValue(false);

      expect(await service.isOvertakenBySuccess("activity-1")).toBe(false);
    });

    it.each([
      ["an activity that no longer exists", undefined],
      ["an activity about no particular deployment", createActivity({ meta: {} })]
    ])("answers no for %s, reading nothing further", async (_, found) => {
      const { service, activityRepository } = setup();
      activityRepository.findById.mockResolvedValue(found);

      expect(await service.isOvertakenBySuccess("activity-1")).toBe(false);
      expect(activityRepository.hasSucceededSince).not.toHaveBeenCalled();
    });
  });

  describe("findByDedupeKey", () => {
    it("reads the user's row holding the dedupe key", async () => {
      const { service, activityRepository } = setup();
      const activity = createActivity({ dedupeKey: "deployment_close.akash1owner.100" });
      activityRepository.findOneBy.mockResolvedValue(activity);

      expect(await service.findByDedupeKey(activity.userId, "deployment_close.akash1owner.100")).toBe(activity);
      expect(activityRepository.findOneBy).toHaveBeenCalledWith({ userId: activity.userId, dedupeKey: "deployment_close.akash1owner.100" });
    });
  });

  describe("settle", () => {
    it("writes the outcome and its dedupe key only onto an activity that is still pending, leaving every alert in place", async () => {
      const { service, activityRepository, txService, logger } = setup();

      await service.settle("activity-1", createNewActivity({ status: "succeeded", meta: { dseq: "100" }, dedupeKey: "deployment_close.akash1owner.100" }));

      expect(activityRepository.updateByIdIfStatusIn).toHaveBeenCalledTimes(1);
      expect(activityRepository.updateByIdIfStatusIn).toHaveBeenCalledWith("activity-1", ["pending"], {
        status: "succeeded",
        meta: { dseq: "100" },
        dedupeKey: "deployment_close.akash1owner.100"
      });
      expect(activityRepository.deleteBy).not.toHaveBeenCalled();
      expect(txService.transaction).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
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

    it("measures the activity it settled", async () => {
      const { service, activityRepository, activityInstrumentation } = setup();
      const settled = createActivity({ status: "failed" });
      activityRepository.updateByIdIfStatusIn.mockResolvedValue(settled);

      await service.settle(settled.id, createNewActivity({ status: "failed" }));

      expect(activityInstrumentation.trackSettled).toHaveBeenCalledWith(settled);
    });

    it("measures nothing when no activity was left in a status it could settle from", async () => {
      const { service, activityRepository, activityInstrumentation } = setup();
      activityRepository.updateByIdIfStatusIn.mockResolvedValue(undefined);

      await service.settle("activity-1", createNewActivity());

      expect(activityInstrumentation.trackSettled).not.toHaveBeenCalled();
    });

    it("takes the dedupe key from the deployment-closed alert holding it, deleting the alert in the transaction that settles the close", async () => {
      const { service, activityRepository, activityInstrumentation, txService, logger } = setup();
      const activity = createNewActivity({ status: "succeeded", meta: { dseq: "100" }, dedupeKey: "deployment_close.akash1owner.100" });
      const settled = createActivity({ id: "activity-1" });
      activityRepository.updateByIdIfStatusIn.mockRejectedValueOnce(createUniqueViolation(ACTIVITIES_DEDUPE_KEY_INDEX)).mockResolvedValueOnce(settled);

      await service.settle("activity-1", activity, { from: ["pending", "failed"] });

      expect(txService.transaction).toHaveBeenCalledTimes(1);
      expect(activityRepository.deleteBy).toHaveBeenCalledWith({
        userId: activity.userId,
        dedupeKey: "deployment_close.akash1owner.100",
        type: "deployment_closed_alert"
      });
      expect(activityRepository.updateByIdIfStatusIn).toHaveBeenCalledTimes(2);
      expect(activityRepository.updateByIdIfStatusIn).toHaveBeenLastCalledWith("activity-1", ["pending", "failed"], {
        status: "succeeded",
        meta: { dseq: "100" },
        dedupeKey: "deployment_close.akash1owner.100"
      });
      expect(activityRepository.deleteBy.mock.invocationCallOrder[0]).toBeLessThan(activityRepository.updateByIdIfStatusIn.mock.invocationCallOrder[1]);
      expect(activityInstrumentation.trackSettled).toHaveBeenCalledWith(settled);
      expect(logger.info).not.toHaveBeenCalled();
    });

    it("settles the activity without the dedupe key when another close holds it, over the same statuses the caller allows", async () => {
      const { service, activityRepository, activityInstrumentation, logger } = setup();
      const settled = createActivity({ id: "activity-1" });
      activityRepository.updateByIdIfStatusIn
        .mockRejectedValueOnce(createUniqueViolation(ACTIVITIES_DEDUPE_KEY_INDEX))
        .mockRejectedValueOnce(createUniqueViolation(ACTIVITIES_DEDUPE_KEY_INDEX))
        .mockResolvedValueOnce(settled);

      await service.settle("activity-1", createNewActivity({ status: "succeeded", meta: { dseq: "100" }, dedupeKey: "deployment_close.akash1owner.100" }), {
        from: ["pending", "failed"]
      });

      expect(activityRepository.updateByIdIfStatusIn).toHaveBeenCalledTimes(3);
      expect(activityRepository.updateByIdIfStatusIn).toHaveBeenLastCalledWith("activity-1", ["pending", "failed"], {
        status: "succeeded",
        meta: { dseq: "100" },
        dedupeKey: null
      });
      expect(activityInstrumentation.trackSettled).toHaveBeenCalledWith(settled);
      expect(logger.info).toHaveBeenCalledWith({
        event: "ACTIVITY_SETTLE_DEDUPED",
        activityId: "activity-1",
        status: "succeeded",
        dedupeKey: "deployment_close.akash1owner.100"
      });
    });

    it("lets any other failed write through", async () => {
      const { service, activityRepository } = setup();
      const error = createUniqueViolation("activities_pkey");
      activityRepository.updateByIdIfStatusIn.mockRejectedValueOnce(error);

      await expect(service.settle("activity-1", createNewActivity())).rejects.toBe(error);
      expect(activityRepository.updateByIdIfStatusIn).toHaveBeenCalledTimes(1);
    });

    it("lets any other failure to replace the alert through", async () => {
      const { service, activityRepository } = setup();
      const error = new Error("connection reset");
      activityRepository.updateByIdIfStatusIn.mockRejectedValueOnce(createUniqueViolation(ACTIVITIES_DEDUPE_KEY_INDEX));
      activityRepository.deleteBy.mockRejectedValue(error);

      await expect(service.settle("activity-1", createNewActivity({ dedupeKey: "deployment_close.akash1owner.100" }))).rejects.toBe(error);
      expect(activityRepository.updateByIdIfStatusIn).toHaveBeenCalledTimes(1);
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
    return {
      userId: faker.string.uuid(),
      type: "deployment_close",
      status: "succeeded",
      initiator: "user",
      meta: { dseq: "1234" },
      dedupeKey: null,
      ...overrides
    };
  }

  function createNewAlertActivity(overrides: Partial<NewAlertActivity> = {}): NewAlertActivity {
    const alertId = faker.string.uuid();

    return {
      userId: faker.string.uuid(),
      organizationId: faker.string.uuid(),
      projectId: faker.string.uuid(),
      type: "wallet_balance_alert",
      status: "info",
      meta: { alertId, summary: "Wallet balance is low" },
      dedupeKey: `wallet_balance_alert.${alertId}.1200`,
      ...overrides
    };
  }

  function projectScopeOf(projectIds: string[]): ProjectScope {
    return { kind: "projects", projectIds, writableProjectIds: projectIds, adminProjectIds: [] };
  }

  function setup(input: { access?: ProjectScope | "not_a_member" | "no_context" | Error; userExists?: boolean } = {}) {
    const activityRepository = mock<ActivityRepository>();
    const readRepository = mock<ActivityRepository>();
    const updateRepository = mock<ActivityRepository>();
    activityRepository.accessibleBy.mockImplementation((_, action) => (action === "update" ? updateRepository : readRepository));
    const ability = createMongoAbility();
    const authService = mock<AuthService>();
    authService.ability = ability;
    const jobQueueService = mock<JobQueueService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const activityInstrumentation = mock<ActivityInstrumentationService>();
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async callback => await callback());

    const user = createUser();
    const userRepository = mock<UserRepository>();
    userRepository.findById.mockResolvedValue(input.userExists === false ? undefined : user);
    const organizationContextResolver = mock<OrganizationContextResolver>();
    const access = input.access ?? { kind: "all" };
    if (access === "not_a_member") {
      organizationContextResolver.resolveBoundTo.mockRejectedValue(
        createError(403, "Not a member of this organization", { errorCode: ORGANIZATION_FORBIDDEN_ERROR_CODE })
      );
    } else if (access === "no_context") {
      organizationContextResolver.resolveBoundTo.mockResolvedValue(undefined);
    } else if (access instanceof Error) {
      organizationContextResolver.resolveBoundTo.mockRejectedValue(access);
    } else {
      organizationContextResolver.resolveBoundTo.mockResolvedValue(mock<OrganizationContext>({ projectScope: access }));
    }

    const service = new ActivityService(
      activityRepository,
      authService,
      jobQueueService,
      activityInstrumentation,
      organizationContextResolver,
      userRepository,
      txService,
      createLogger
    );

    return {
      service,
      activityRepository,
      readRepository,
      updateRepository,
      jobQueueService,
      activityInstrumentation,
      organizationContextResolver,
      userRepository,
      user,
      txService,
      logger,
      createLogger,
      ability
    };
  }
});
