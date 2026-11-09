import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger, JobQueueService, TxService } from "@src/core";
import type { AccountStatus } from "@src/user/lib/account-status/account-status";
import type { AccountStatusEventOutput, AccountStatusEventRepository } from "@src/user/repositories/account-status-event/account-status-event.repository";
import type { UserOutput, UserRepository } from "@src/user/repositories/user/user.repository";
import { ApplyAccountTermination } from "@src/user/services/apply-account-termination/apply-account-termination.job";
import { AccountStatusService } from "./account-status.service";

import { createUser } from "@test/seeders/user.seeder";

describe(AccountStatusService.name, () => {
  describe("terminateIfVerifiedEmailWasTerminated", () => {
    it("terminates an account whose verified address a verified termination used, as the system, with that termination's reason, and queues its effects in the same transaction", async () => {
      const { service, user, userRepository, accountStatusEventRepository, jobQueueService, logger, calls } = setup({ accountStatus: "active" });
      const matchedUserId = faker.string.uuid();
      accountStatusEventRepository.findLatestVerifiedTerminationOf.mockResolvedValue({ userId: matchedUserId, userReason: "Fraud" });

      const result = await service.terminateIfVerifiedEmailWasTerminated(user);

      expect(result).toEqual({ ...user, accountStatus: "terminated" });
      expect(calls).toEqual(["tx:begin", "lock", "update", "event", "enqueue", "tx:commit"]);
      expect(accountStatusEventRepository.findLatestVerifiedTerminationOf).toHaveBeenCalledWith(user.email);
      expect(userRepository.findOneByAndLock).toHaveBeenCalledWith({ id: user.id });
      expect(userRepository.updateById).toHaveBeenCalledWith(user.id, { accountStatus: "terminated" });
      expect(accountStatusEventRepository.create).toHaveBeenCalledWith({
        userId: user.id,
        userEmail: user.email,
        action: "terminate",
        actorStaffId: null,
        actorEmail: "system",
        actorName: "Console",
        userReason: "Fraud",
        internalNote: null,
        options: { forfeitCredits: false, matchedUserId, emailVerified: true }
      });
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new ApplyAccountTermination({ userId: user.id, forfeitCredits: false }), {
        singletonKey: `applyAccountTermination.${user.id}`,
        retryLimit: 8,
        retryBackoff: true,
        retryDelay: 30,
        retryDelayMax: 300
      });
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: "ACCOUNT_STATUS_CHANGED", userId: user.id, action: "terminate", from: "active", to: "terminated" })
      );
    });

    it("names no matched account when the terminated account has since been deleted", async () => {
      const { service, user, accountStatusEventRepository } = setup({ accountStatus: "active" });
      accountStatusEventRepository.findLatestVerifiedTerminationOf.mockResolvedValue({ userId: null, userReason: "Fraud" });

      await service.terminateIfVerifiedEmailWasTerminated(user);

      expect(accountStatusEventRepository.create).toHaveBeenCalledWith(expect.objectContaining({ options: { forfeitCredits: false, emailVerified: true } }));
    });

    it("records nothing when the account was terminated or removed while its row was being locked", async () => {
      const { service, user, userRepository, accountStatusEventRepository, jobQueueService } = setup({ accountStatus: "active" });
      accountStatusEventRepository.findLatestVerifiedTerminationOf.mockResolvedValue({ userId: faker.string.uuid(), userReason: "Fraud" });
      userRepository.findOneByAndLock.mockResolvedValueOnce({ ...user, accountStatus: "terminated" }).mockResolvedValueOnce(undefined);

      await service.terminateIfVerifiedEmailWasTerminated(user);
      await service.terminateIfVerifiedEmailWasTerminated(user);

      expect(userRepository.updateById).not.toHaveBeenCalled();
      expect(accountStatusEventRepository.create).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("returns the account as it is when no verified termination used its address", async () => {
      const { service, user, userRepository, accountStatusEventRepository, jobQueueService } = setup({ accountStatus: "active" });
      accountStatusEventRepository.findLatestVerifiedTerminationOf.mockResolvedValue(undefined);

      expect(await service.terminateIfVerifiedEmailWasTerminated(user)).toBe(user);
      expect(userRepository.updateById).not.toHaveBeenCalled();
      expect(accountStatusEventRepository.create).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it.each([
      ["whose address is not verified yet", { accountStatus: "active" as const, emailVerified: false }],
      ["that is suspended", { accountStatus: "suspended" as const }],
      ["that is already terminated", { accountStatus: "terminated" as const }]
    ])("looks nothing up for an account %s", async (_, input) => {
      const { service, user, accountStatusEventRepository } = setup(input);

      expect(await service.terminateIfVerifiedEmailWasTerminated(user)).toBe(user);
      expect(accountStatusEventRepository.findLatestVerifiedTerminationOf).not.toHaveBeenCalled();
    });

    it("looks nothing up for an account without an address", async () => {
      const { service, accountStatusEventRepository } = setup({ accountStatus: "active" });
      const user = createUser({ accountStatus: "active", emailVerified: true, email: null });

      expect(await service.terminateIfVerifiedEmailWasTerminated(user)).toBe(user);
      expect(accountStatusEventRepository.findLatestVerifiedTerminationOf).not.toHaveBeenCalled();
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

  function setup(input: { accountStatus: AccountStatus; emailVerified?: boolean }) {
    const user: UserOutput = createUser({ accountStatus: input.accountStatus, emailVerified: input.emailVerified ?? true });
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

    return { service, user, calls, userRepository, accountStatusEventRepository, jobQueueService, logger };
  }
});
