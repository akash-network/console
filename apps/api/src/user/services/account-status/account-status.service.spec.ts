import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger, JobQueueService, TxService } from "@src/core";
import type { AccountStatus } from "@src/user/lib/account-status/account-status";
import type { AccountStatusEventOutput, AccountStatusEventRepository } from "@src/user/repositories/account-status-event/account-status-event.repository";
import type { UserRepository } from "@src/user/repositories/user/user.repository";
import { CloseAccountDeployments } from "@src/user/services/close-account-deployments/close-account-deployments.job";
import { AccountStatusService } from "./account-status.service";

import { createUser } from "@test/seeders/user.seeder";

describe(AccountStatusService.name, () => {
  describe("suspend", () => {
    it("locks the user row, suspends the account and records who did it and why, inside one transaction", async () => {
      const { service, user, actor, userRepository, accountStatusEventRepository, calls } = setup({ accountStatus: "active" });

      const event = await service.suspend(user.id, { actor, userReason: "Unpaid invoices", internalNote: "Chargeback on card", closeDeployments: false });

      expect(calls).toEqual(["tx:begin", "lock", "update", "event", "tx:commit"]);
      expect(userRepository.findOneByAndLock).toHaveBeenCalledWith({ id: user.id });
      expect(userRepository.updateById).toHaveBeenCalledWith(user.id, { accountStatus: "suspended" });
      expect(accountStatusEventRepository.create).toHaveBeenCalledWith({
        userId: user.id,
        userEmail: user.email,
        action: "suspend",
        actorStaffId: actor.staffId,
        actorEmail: actor.email,
        actorName: actor.name,
        userReason: "Unpaid invoices",
        internalNote: "Chargeback on card",
        options: { closeDeployments: false }
      });
      expect(event).toEqual(expect.objectContaining({ action: "suspend" }));
    });

    it("queues the close of the account's deployments in the same transaction when asked to", async () => {
      const { service, user, actor, jobQueueService, calls } = setup({ accountStatus: "active" });

      await service.suspend(user.id, { actor, userReason: "Abuse", closeDeployments: true });

      expect(calls).toEqual(["tx:begin", "lock", "update", "event", "enqueue", "tx:commit"]);
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        new CloseAccountDeployments({ userId: user.id }),
        expect.objectContaining({ singletonKey: `closeAccountDeployments.${user.id}`, retryLimit: 8 })
      );
    });

    it("does not queue any close when not asked to", async () => {
      const { service, user, actor, jobQueueService } = setup({ accountStatus: "active" });

      await service.suspend(user.id, { actor, userReason: "Abuse", closeDeployments: false });

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("records a missing or empty internal note and a missing staff id as null", async () => {
      const { service, user, accountStatusEventRepository } = setup({ accountStatus: "active" });

      await service.suspend(user.id, { actor: { email: "ops@akash.network", name: "Ops" }, userReason: "Abuse", internalNote: "", closeDeployments: false });

      expect(accountStatusEventRepository.create).toHaveBeenCalledWith(expect.objectContaining({ actorStaffId: null, internalNote: null }));
    });

    it("refuses an account that is already suspended with a conflict naming its status", async () => {
      const { service, user, actor, userRepository, accountStatusEventRepository } = setup({ accountStatus: "suspended" });

      await expect(service.suspend(user.id, { actor, userReason: "Abuse", closeDeployments: true })).rejects.toMatchObject({
        status: 409,
        errorCode: "account_status_conflict",
        message: "Cannot suspend an account that is suspended",
        data: { accountStatus: "suspended" }
      });

      expect(userRepository.updateById).not.toHaveBeenCalled();
      expect(accountStatusEventRepository.create).not.toHaveBeenCalled();
    });

    it("refuses an unknown user with a 404", async () => {
      const { service, actor, userRepository } = setup({ accountStatus: "active" });
      userRepository.findOneByAndLock.mockResolvedValue(undefined);

      await expect(service.suspend(faker.string.uuid(), { actor, userReason: "Abuse", closeDeployments: false })).rejects.toMatchObject({
        status: 404,
        message: "User not found"
      });

      expect(userRepository.updateById).not.toHaveBeenCalled();
    });

    it("logs the change without the reason or the note", async () => {
      const { service, user, actor, logger } = setup({ accountStatus: "active" });

      await service.suspend(user.id, { actor, userReason: "Unpaid invoices", internalNote: "Chargeback", closeDeployments: false });

      expect(logger.info).toHaveBeenCalledWith({
        event: "ACCOUNT_STATUS_CHANGED",
        userId: user.id,
        action: "suspend",
        from: "active",
        to: "suspended",
        eventId: expect.any(String),
        actorEmail: actor.email
      });
    });
  });

  describe("reinstate", () => {
    it("reactivates a suspended account and keeps the note as the internal note", async () => {
      const { service, user, actor, userRepository, accountStatusEventRepository, jobQueueService, calls } = setup({ accountStatus: "suspended" });

      await service.reinstate(user.id, { actor, note: "Paid in full" });

      expect(calls).toEqual(["tx:begin", "lock", "update", "event", "tx:commit"]);
      expect(userRepository.updateById).toHaveBeenCalledWith(user.id, { accountStatus: "active" });
      expect(accountStatusEventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: "reinstate", userReason: null, internalNote: "Paid in full", options: {} })
      );
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("records a missing note as null", async () => {
      const { service, user, actor, accountStatusEventRepository } = setup({ accountStatus: "suspended" });

      await service.reinstate(user.id, { actor });

      expect(accountStatusEventRepository.create).toHaveBeenCalledWith(expect.objectContaining({ internalNote: null }));
    });

    it("refuses an active account with a conflict", async () => {
      const { service, user, actor } = setup({ accountStatus: "active" });

      await expect(service.reinstate(user.id, { actor })).rejects.toMatchObject({ status: 409, errorCode: "account_status_conflict" });
    });
  });

  describe("findEventsOf", () => {
    it("returns the user's events as the repository lists them", async () => {
      const { service, user, accountStatusEventRepository } = setup({ accountStatus: "active" });
      const events = [mock<AccountStatusEventOutput>({ id: faker.string.uuid() })];
      accountStatusEventRepository.findManyByUserId.mockResolvedValue(events);

      expect(await service.findEventsOf(user.id)).toBe(events);
      expect(accountStatusEventRepository.findManyByUserId).toHaveBeenCalledWith(user.id);
    });
  });

  describe("findUserReasonOf", () => {
    it("returns null for an active account without reading the events", async () => {
      const { service, user, accountStatusEventRepository } = setup({ accountStatus: "active" });

      expect(await service.findUserReasonOf(user)).toBeNull();
      expect(accountStatusEventRepository.findLatestUserReasonOf).not.toHaveBeenCalled();
    });

    it("returns the latest reason written for the user of a suspended account", async () => {
      const { service, user, accountStatusEventRepository } = setup({ accountStatus: "suspended" });
      accountStatusEventRepository.findLatestUserReasonOf.mockResolvedValue("Unpaid invoices");

      expect(await service.findUserReasonOf(user)).toBe("Unpaid invoices");
      expect(accountStatusEventRepository.findLatestUserReasonOf).toHaveBeenCalledWith(user.id);
    });
  });

  function setup(input: { accountStatus: AccountStatus }) {
    const user = createUser({ accountStatus: input.accountStatus });
    const actor = { staffId: faker.string.uuid(), email: faker.internet.email(), name: faker.person.fullName() };
    const calls: string[] = [];

    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => {
      calls.push("tx:begin");
      const result = await cb();
      calls.push("tx:commit");
      return result;
    });
    const userRepository = mock<UserRepository>();
    userRepository.findOneByAndLock.mockImplementation(async () => {
      calls.push("lock");
      return user;
    });
    userRepository.updateById.mockImplementation(async () => {
      calls.push("update");
    });
    const accountStatusEventRepository = mock<AccountStatusEventRepository>();
    accountStatusEventRepository.create.mockImplementation(async event => {
      calls.push("event");
      return mock<AccountStatusEventOutput>({ ...event, id: faker.string.uuid() });
    });
    const jobQueueService = mock<JobQueueService>();
    jobQueueService.enqueue.mockImplementation(async () => {
      calls.push("enqueue");
      return faker.string.uuid();
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new AccountStatusService(userRepository, accountStatusEventRepository, jobQueueService, txService, createLogger);

    return { service, user, actor, calls, userRepository, accountStatusEventRepository, jobQueueService, logger };
  }
});
