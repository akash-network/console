import { faker } from "@faker-js/faker";
import { addMilliseconds, subDays, subHours } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import { hashAccount } from "@src/workload-abuse/lib/account-hashes/account-hashes";
import type {
  DeletedTrialAccountOutput,
  DeletedTrialAccountRepository
} from "@src/workload-abuse/repositories/deleted-trial-account/deleted-trial-account.repository";
import { ReviewRefusedTrial } from "@src/workload-abuse/services/review-refused-trial/review-refused-trial.handler";
import type { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { DeletedTrialAccountService } from "./deleted-trial-account.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const SECRET = "a".repeat(32);
const NOW = new Date("2026-06-15T12:00:00.000Z");
const MEMORY_DAYS = 9;

describe(DeletedTrialAccountService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("remember", () => {
    it("records the keyed hashes and the wallet address of the deleted account", async () => {
      const { service, repository } = setup();
      const account = createUser({ userId: "auth0|abc123", email: "  Jane.Doe@Example.COM " });
      const wallet = trialWallet();

      await service.remember(account, wallet);

      expect(repository.create).toHaveBeenCalledWith({ ...hashAccount(SECRET, account), walletAddress: wallet.address });
      expect(repository.create.mock.calls[0][0]).toEqual({
        identityHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        emailHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        walletAddress: wallet.address
      });
    });

    it("drops the records past the configured age before adding one", async () => {
      const { service, repository } = setup();

      await service.remember(createUser(), trialWallet());

      expect(repository.deleteOlderThan).toHaveBeenCalledWith(subDays(NOW, MEMORY_DAYS));
      expect(repository.deleteOlderThan.mock.invocationCallOrder[0]).toBeLessThan(repository.create.mock.invocationCallOrder[0]);
    });

    it("logs the record under the deleted account's id", async () => {
      const { service, logger } = setup();
      const account = createUser();

      await service.remember(account, trialWallet());

      expect(logger.info).toHaveBeenCalledWith({ event: "DELETED_TRIAL_ACCOUNT_REMEMBERED", userId: account.id });
    });

    it.each([undefined, createUserWallet({ isTrialing: true, activatedAt: null }), createUserWallet({ isTrialing: false, activatedAt: new Date() })])(
      "records nothing for ineligible wallet %#",
      async wallet => {
        const { service, repository, logger } = setup();

        await service.remember(createUser(), wallet);

        expect(repository.deleteOlderThan).not.toHaveBeenCalled();
        expect(repository.create).not.toHaveBeenCalled();
        expect(logger.info).not.toHaveBeenCalled();
      }
    );

    it("records nothing while the record age is not configured", async () => {
      const { service, repository } = setup({ memoryDays: undefined });

      await service.remember(createUser(), trialWallet());

      expect(repository.deleteOlderThan).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("records nothing for an account with neither an identity nor an email", async () => {
      const { service, repository } = setup();

      await service.remember(createUser({ userId: null, email: null }), trialWallet());

      expect(repository.deleteOlderThan).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it.each([
      { userId: "auth0|abc123", email: null },
      { userId: null, email: "jane@example.com" }
    ])("records an account that has only one of its identity and email, case %#", async identity => {
      const { service, repository } = setup();
      const account = createUser(identity);
      const wallet = trialWallet();

      await service.remember(account, wallet);

      expect(repository.create).toHaveBeenCalledWith({ ...hashAccount(SECRET, account), walletAddress: wallet.address });
    });
  });

  describe("refusesTrialOf", () => {
    it("looks the account up by its keyed hashes among the records inside the configured age", async () => {
      const { service, repository } = setup({ cooldownHours: 4 });
      const account = createUser({ userId: "auth0|abc123", email: "JANE.doe+trial@example.com" });

      await service.refusesTrialOf(account);

      expect(repository.findByAnyHashSince).toHaveBeenCalledWith(hashAccount(SECRET, account), subDays(NOW, MEMORY_DAYS));
    });

    it("refuses nothing and reads no record while the record age is not configured", async () => {
      const { service, repository, txService } = setup({ memoryDays: undefined, cooldownHours: 4, maxReturns: 0, deletionAgesInHours: [1] });

      await expect(service.refusesTrialOf(createUser())).resolves.toBe(false);

      expect(repository.findByAnyHashSince).not.toHaveBeenCalled();
      expect(txService.transaction).not.toHaveBeenCalled();
    });

    it.each([
      { cooldownHours: 4, maxReturns: undefined, deletionAgesInHours: [], isRefused: false },
      { cooldownHours: undefined, maxReturns: undefined, deletionAgesInHours: [1], isRefused: false },
      { cooldownHours: 4, maxReturns: undefined, deletionAgesInHours: [3], isRefused: true },
      { cooldownHours: 4, maxReturns: undefined, deletionAgesInHours: [4], isRefused: false },
      { cooldownHours: 4, maxReturns: undefined, deletionAgesInHours: [5, 6, 7], isRefused: false },
      { cooldownHours: undefined, maxReturns: 0, deletionAgesInHours: [50], isRefused: true },
      { cooldownHours: undefined, maxReturns: 1, deletionAgesInHours: [50], isRefused: false },
      { cooldownHours: undefined, maxReturns: 1, deletionAgesInHours: [50, 60], isRefused: true },
      { cooldownHours: 4, maxReturns: 2, deletionAgesInHours: [50, 60], isRefused: false },
      { cooldownHours: 4, maxReturns: 2, deletionAgesInHours: [3, 60], isRefused: true },
      { cooldownHours: 4, maxReturns: 1, deletionAgesInHours: [50, 60], isRefused: true }
    ])("decides case %# from the configured limits and the deletions on record", async ({ isRefused, ...input }) => {
      const { service, txService, jobQueueService } = setup(input);

      await expect(service.refusesTrialOf(createUser())).resolves.toBe(isRefused);

      expect(txService.transaction).toHaveBeenCalledTimes(isRefused ? 1 : 0);
      expect(jobQueueService.enqueue).toHaveBeenCalledTimes(isRefused ? 1 : 0);
    });

    it("refuses a deletion recorded a moment inside the limit", async () => {
      const { service, repository } = setup({ cooldownHours: 4 });
      repository.findByAnyHashSince.mockResolvedValue([deletion({ createdAt: addMilliseconds(subHours(NOW, 4), 1) })]);

      await expect(service.refusesTrialOf(createUser())).resolves.toBe(true);
    });

    it("marks the latest deletion with the refused account and queues its review in one transaction", async () => {
      const { service, repository, txService, jobQueueService, deletions } = setup({ cooldownHours: 4, deletionAgesInHours: [1, 30, 60] });
      const account = createUser();
      let isInsideTransaction = false;
      const writesInsideTransaction: string[] = [];
      txService.transaction.mockImplementation(async callback => {
        isInsideTransaction = true;
        const result = await callback();
        isInsideTransaction = false;
        return result;
      });
      repository.markRefusedOnce.mockImplementation(async () => {
        if (isInsideTransaction) writesInsideTransaction.push("mark");
        return true;
      });
      jobQueueService.enqueue.mockImplementation(async () => {
        if (isInsideTransaction) writesInsideTransaction.push("enqueue");
        return faker.string.uuid();
      });

      await service.refusesTrialOf(account);

      expect(repository.markRefusedOnce).toHaveBeenCalledWith(deletions[0].id, account.id);
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        new ReviewRefusedTrial({
          userId: account.id,
          deletedAccount: { walletAddress: deletions[0].walletAddress, deletedAt: deletions[0].createdAt.toISOString(), deletionsOnRecord: 3 }
        })
      );
      expect(writesInsideTransaction).toEqual(["mark", "enqueue"]);
    });

    it("refuses again without a second review once the account was already refused over the deletion", async () => {
      const { service, repository, jobQueueService } = setup({ cooldownHours: 4, deletionAgesInHours: [1] });
      repository.markRefusedOnce.mockResolvedValue(false);

      await expect(service.refusesTrialOf(createUser())).resolves.toBe(true);

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("logs a refusal under the refused account's id, and nothing when the trial goes ahead", async () => {
      const refused = setup({ cooldownHours: 4, deletionAgesInHours: [1, 30] });
      const allowed = setup({ cooldownHours: 4, deletionAgesInHours: [30] });
      const account = createUser();

      await refused.service.refusesTrialOf(account);
      await allowed.service.refusesTrialOf(account);

      expect(refused.logger.info).toHaveBeenCalledWith({ event: "TRIAL_REFUSED_AFTER_ACCOUNT_DELETION", userId: account.id, deletionsOnRecord: 2 });
      expect(allowed.logger.info).not.toHaveBeenCalled();
    });
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: DeletedTrialAccountService.name });
  });

  function trialWallet() {
    return createUserWallet({ isTrialing: true, activatedAt: new Date() });
  }

  function deletion(overrides: Partial<DeletedTrialAccountOutput> = {}): DeletedTrialAccountOutput {
    return {
      id: faker.string.uuid(),
      identityHash: faker.string.hexadecimal({ length: 64, casing: "lower", prefix: "" }),
      emailHash: faker.string.hexadecimal({ length: 64, casing: "lower", prefix: "" }),
      walletAddress: createAkashAddress(),
      refusedUserId: null,
      createdAt: NOW,
      ...overrides
    };
  }

  function setup(input: { memoryDays?: number; cooldownHours?: number; maxReturns?: number; deletionAgesInHours?: number[] } = {}) {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });

    const deletions = (input.deletionAgesInHours ?? []).map(ageInHours => deletion({ createdAt: subHours(NOW, ageInHours) }));
    const repository = mock<DeletedTrialAccountRepository>();
    repository.findByAnyHashSince.mockResolvedValue(deletions);
    repository.markRefusedOnce.mockResolvedValue(true);

    const config = mockConfigService<WorkloadAbuseConfigService>({
      WORKLOAD_ABUSE_ACCOUNT_HASH_SECRET: SECRET,
      WORKLOAD_ABUSE_DELETED_TRIAL_MEMORY_DAYS: "memoryDays" in input ? input.memoryDays : MEMORY_DAYS,
      WORKLOAD_ABUSE_DELETED_TRIAL_COOLDOWN_HOURS: input.cooldownHours,
      WORKLOAD_ABUSE_DELETED_TRIAL_MAX_RETURNS: input.maxReturns
    });
    const jobQueueService = mock<JobQueueService>();
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async callback => await callback());
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const service = new DeletedTrialAccountService(repository, config, jobQueueService, txService, createLogger);

    return { service, repository, jobQueueService, txService, logger, createLogger, deletions };
  }
});
