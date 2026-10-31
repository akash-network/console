import { faker } from "@faker-js/faker";
import { addDays, addHours, addMilliseconds, addMinutes, subDays, subHours, subMilliseconds } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { StripeTransactionRepository, UserWalletRepository } from "@src/billing/repositories";
import type { FirstPurchaseBonusWinBackRepository } from "@src/billing/repositories/first-purchase-bonus-win-back/first-purchase-bonus-win-back.repository";
import type { UsageRepository } from "@src/billing/repositories/usage/usage.repository";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { BlockRepository } from "@src/chain/repositories/block.repository";
import type { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import type { CreateLogger, JobQueueService } from "@src/core";
import type { TxService } from "@src/core/services/tx/tx.service";
import type { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import type { UserRepository } from "@src/user/repositories";
import { GpuWinBackService } from "./gpu-win-back.service";
import { GpuWinBackCheck } from "./gpu-win-back-check.job";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const NOW = new Date("2026-10-19T12:00:00.000Z");
const TRIAL_DAYS = 30;
const INDEXED_HEIGHT = 30_000_000;
const MAX_INDEXER_LAG_IN_BLOCKS = 100;

describe(GpuWinBackService.name, () => {
  describe("check", () => {
    it("opens a 7-day window for a person who paid before and stopped running gpu deployments over a week ago", async () => {
      const { service, userId, winBackRepository, jobQueueService } = setup();

      const result = await service.check(userId, NOW);

      expect(result).toEqual({ outcome: "opened" });
      expect(winBackRepository.create).toHaveBeenCalledWith({ userId, openedAt: NOW, closesAt: addDays(NOW, 7) });
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: "FirstPurchaseBonusWindowOpened", data: { userId, reason: "gpu_win_back", closesAt: addDays(NOW, 7).toISOString() } })
      );
    });

    it("opens a window with no deadline for a person who never paid", async () => {
      const { service, userId, winBackRepository, jobQueueService } = setup({ hasPaid: false });

      await service.check(userId, NOW);

      expect(winBackRepository.create).toHaveBeenCalledWith({ userId, openedAt: NOW, closesAt: null });
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(expect.objectContaining({ data: { userId, reason: "gpu_win_back", closesAt: null } }));
    });

    it("asks whether the person's own account paid before", async () => {
      const { service, userId, stripeTransactionRepository } = setup();

      await service.check(userId, NOW);

      expect(stripeTransactionRepository.findEarliestCompletedPaidTransaction).toHaveBeenCalledWith({ userId });
    });

    it("locks the person, rechecks them, then records the window and announces it in one transaction", async () => {
      const { service, userId, txService, userRepository, stripeTransactionRepository, winBackRepository, jobQueueService } = setup();
      const steps: string[] = [];
      const record = <T>(step: string, value: T) => {
        steps.push(step);
        return value;
      };
      txService.transaction.mockImplementation(async cb => {
        steps.push("begin");
        const result = await cb();
        steps.push("commit");
        return result;
      });
      userRepository.findOneByAndLock.mockImplementation(async () => record("lock", createUser({ id: userId })));
      stripeTransactionRepository.hasReceivedFirstPurchaseBonus.mockImplementation(async () => record("bonus", false));
      winBackRepository.findByUserId.mockImplementation(async () => record("win-back", undefined));
      stripeTransactionRepository.hasCompletedPaidTransactionOfAtLeast.mockImplementation(async () => record("large purchase", false));
      stripeTransactionRepository.findEarliestCompletedPaidTransaction.mockImplementation(async () =>
        record("payment", { id: faker.string.uuid(), createdAt: subDays(NOW, 40), amount: 2000 })
      );
      winBackRepository.create.mockImplementation(async () => record("create", true));
      jobQueueService.enqueue.mockImplementation(async () => record("announce", "job-1"));

      await service.check(userId, NOW);

      expect(steps.slice(steps.indexOf("begin"))).toEqual(["begin", "lock", "bonus", "win-back", "large purchase", "payment", "create", "announce", "commit"]);
    });

    it("locks the person the way a settling purchase does", async () => {
      const { service, userId, userRepository } = setup();

      await service.check(userId, NOW);

      expect(userRepository.findOneByAndLock).toHaveBeenCalledWith({ id: userId }, { strength: "no key update" });
    });

    it("stops for a person whose account is gone by the time they are locked", async () => {
      const subject = setup();
      subject.userRepository.findOneByAndLock.mockResolvedValue(undefined);

      await expectNothingOpened(subject);
    });

    it.each([
      {
        case: "received the bonus",
        changeMeanwhile: ({ stripeTransactionRepository }: ReturnType<typeof setup>) =>
          stripeTransactionRepository.hasReceivedFirstPurchaseBonus.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
      },
      {
        case: "got a win-back",
        changeMeanwhile: ({ winBackRepository, userId }: ReturnType<typeof setup>) =>
          winBackRepository.findByUserId.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ userId, openedAt: NOW, closesAt: addDays(NOW, 7) })
      },
      {
        case: "bought $100 or more",
        changeMeanwhile: ({ stripeTransactionRepository }: ReturnType<typeof setup>) =>
          stripeTransactionRepository.hasCompletedPaidTransactionOfAtLeast.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
      }
    ])("opens nothing for a person who $case while the check ran", async ({ changeMeanwhile }) => {
      const subject = setup();
      changeMeanwhile(subject);

      await expectNothingOpened(subject);
    });

    it("gives a deadline to a person whose first payment settled while the check ran", async () => {
      const { service, userId, stripeTransactionRepository, winBackRepository } = setup({ hasPaid: false });
      stripeTransactionRepository.findEarliestCompletedPaidTransaction
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ id: faker.string.uuid(), createdAt: NOW, amount: 2000 });

      await service.check(userId, NOW);

      expect(winBackRepository.create).toHaveBeenCalledWith({ userId, openedAt: NOW, closesAt: addDays(NOW, 7) });
    });

    it("logs the window it opened", async () => {
      const { service, userId, logger } = setup();

      await service.check(userId, NOW);

      expect(logger.info).toHaveBeenCalledWith({ event: "GPU_WIN_BACK_WINDOW_OPENED", userId, closesAt: addDays(NOW, 7) });
    });

    it("leaves a window another check already opened alone", async () => {
      const { service, userId, winBackRepository, jobQueueService, logger } = setup();
      winBackRepository.create.mockResolvedValue(false);

      const result = await service.check(userId, NOW);

      expect(result).toEqual({ outcome: "ineligible" });
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });

    it("anchors the trial on the day the wallet was activated, not the day the person signed up", async () => {
      const trialStartedAt = subDays(NOW, 20);
      const { service, userId, userRepository } = setup({ hasPaid: false, isTrialing: true, trialStartedAt });
      userRepository.findById.mockResolvedValue(createUser({ id: userId, createdAt: subDays(NOW, 200) }));

      await expect(service.check(userId, NOW)).resolves.toEqual({ outcome: "rescheduled", startAfter: addHours(addDays(trialStartedAt, TRIAL_DAYS + 7), 1) });
    });

    it("anchors the trial on the wallet's creation when the wallet was never activated", async () => {
      const walletCreatedAt = subDays(NOW, 20);
      const { service, userId, userWalletRepository } = setup({ hasPaid: false, isTrialing: true });
      userWalletRepository.findOneByUserId.mockResolvedValue(createUserWallet({ userId, isTrialing: true, createdAt: walletCreatedAt, activatedAt: null }));

      await expect(service.check(userId, NOW)).resolves.toEqual({ outcome: "rescheduled", startAfter: addHours(addDays(walletCreatedAt, TRIAL_DAYS + 7), 1) });
    });

    it("stops for a person who received the bonus", async () => {
      const subject = setup({ hasBonus: true });

      await expectNothingOpened(subject);
      expect(subject.stripeTransactionRepository.hasReceivedFirstPurchaseBonus).toHaveBeenCalledWith(subject.userId);
    });

    it("stops for a person who already had a win-back", async () => {
      const subject = setup({ hasWinBack: true });

      await expectNothingOpened(subject);
      expect(subject.winBackRepository.findByUserId).toHaveBeenCalledWith(subject.userId);
    });

    it("stops for a person whose personal account ever bought $100 or more", async () => {
      const subject = setup({ hasLargePurchase: true });

      await expectNothingOpened(subject);
      expect(subject.stripeTransactionRepository.hasCompletedPaidTransactionOfAtLeast).toHaveBeenCalledWith({ userId: subject.userId }, 10000);
    });

    it("stops for a person whose account is gone", async () => {
      const subject = setup();
      subject.userRepository.findById.mockResolvedValue(undefined);

      await expectNothingOpened(subject);
      expect(subject.userRepository.findById).toHaveBeenCalledWith(subject.userId);
    });

    it.each([
      { case: "no personal wallet", wallet: undefined },
      { case: "a personal wallet without an address", wallet: createUserWallet({ address: null }) }
    ])("stops for a person with $case", async ({ wallet }) => {
      const subject = setup();
      subject.userWalletRepository.findOneByUserId.mockResolvedValue(wallet);

      await expectNothingOpened(subject);
      expect(subject.userWalletRepository.findOneByUserId).toHaveBeenCalledWith(subject.userId);
    });

    it("waits for the last trial email before opening the window of a trial user who never paid", async () => {
      const trialStartedAt = subDays(NOW, 20);
      const { service, userId, jobQueueService, winBackRepository } = setup({ hasPaid: false, isTrialing: true, trialStartedAt });

      const result = await service.check(userId, NOW);

      const afterLastTrialEmail = addHours(addDays(trialStartedAt, TRIAL_DAYS + 7), 1);
      expect(result).toEqual({ outcome: "rescheduled", startAfter: afterLastTrialEmail });
      expectRescheduled(jobQueueService, userId, afterLastTrialEmail);
      expect(winBackRepository.create).not.toHaveBeenCalled();
    });

    it("waits for the last trial email when it is a moment away", async () => {
      const { service, userId } = setup({ hasPaid: false, isTrialing: true, trialStartedAt: addMilliseconds(subDays(subHours(NOW, 1), TRIAL_DAYS + 7), 1) });

      await expect(service.check(userId, NOW)).resolves.toEqual({ outcome: "rescheduled", startAfter: addMilliseconds(NOW, 1) });
    });

    it("opens the window of a trial user who never paid once the last trial email went out", async () => {
      const { service, userId, winBackRepository } = setup({ hasPaid: false, isTrialing: true, trialStartedAt: subDays(subHours(NOW, 1), TRIAL_DAYS + 7) });

      await expect(service.check(userId, NOW)).resolves.toEqual({ outcome: "opened" });
      expect(winBackRepository.create).toHaveBeenCalledWith({ userId, openedAt: NOW, closesAt: null });
    });

    it.each([
      { case: "who paid, though still trialing", hasPaid: true, isTrialing: true },
      { case: "who never paid but is not trialing", hasPaid: false, isTrialing: false }
    ])("does not wait for trial emails for a person $case", async ({ hasPaid, isTrialing }) => {
      const { service, userId } = setup({ hasPaid, isTrialing, trialStartedAt: subDays(NOW, 20) });

      await expect(service.check(userId, NOW)).resolves.toEqual({ outcome: "opened" });
    });

    it("reads the deployments of every address of the person's personal wallet", async () => {
      const { service, userId, wallet, usageRepository, deploymentRepository } = setup();
      const earlierAddress = createAkashAddress();
      usageRepository.resolveAddresses.mockResolvedValue([wallet.address!, earlierAddress]);

      await service.check(userId, NOW);

      expect(usageRepository.resolveAddresses).toHaveBeenCalledWith(wallet.address);
      expect(deploymentRepository.findGpuDeploymentActivity).toHaveBeenCalledWith([wallet.address, earlierAddress]);
    });

    it("stops for a person who never ran a gpu deployment", async () => {
      await expectNothingOpened(setup({ latestGpuDeploymentCreatedAt: null }));
    });

    it("checks again a week after the latest gpu deployment was created", async () => {
      const latestGpuDeploymentCreatedAt = subDays(NOW, 3);
      const { service, userId, jobQueueService, winBackRepository } = setup({ latestGpuDeploymentCreatedAt });

      const result = await service.check(userId, NOW);

      expect(result).toEqual({ outcome: "rescheduled", startAfter: addDays(latestGpuDeploymentCreatedAt, 7) });
      expectRescheduled(jobQueueService, userId, addDays(latestGpuDeploymentCreatedAt, 7));
      expect(winBackRepository.create).not.toHaveBeenCalled();
    });

    it("checks again a moment later when the latest gpu deployment is a moment short of a week old", async () => {
      const { service, userId } = setup({ latestGpuDeploymentCreatedAt: addMilliseconds(subDays(NOW, 7), 1) });

      await expect(service.check(userId, NOW)).resolves.toEqual({ outcome: "rescheduled", startAfter: addMilliseconds(NOW, 1) });
    });

    it("opens the window once the latest gpu deployment is exactly a week old", async () => {
      const { service, userId } = setup({ latestGpuDeploymentCreatedAt: subDays(NOW, 7) });

      await expect(service.check(userId, NOW)).resolves.toEqual({ outcome: "opened" });
    });

    it.each([
      { case: "a week", age: 7 },
      { case: "exactly 60 days", age: 60 }
    ])("checks again tomorrow while a deployment is still open and the latest gpu one is $case old", async ({ age }) => {
      const { service, userId, jobQueueService, winBackRepository } = setup({ latestGpuDeploymentCreatedAt: subDays(NOW, age), hasOpenDeployment: true });

      const result = await service.check(userId, NOW);

      expect(result).toEqual({ outcome: "rescheduled", startAfter: addDays(NOW, 1) });
      expectRescheduled(jobQueueService, userId, addDays(NOW, 1));
      expect(winBackRepository.create).not.toHaveBeenCalled();
    });

    it("stops checking a person still running deployments once the latest gpu one is more than 60 days old", async () => {
      await expectNothingOpened(setup({ latestGpuDeploymentCreatedAt: subMilliseconds(subDays(NOW, 60), 1), hasOpenDeployment: true }));
    });

    it("opens the window of a person whose latest gpu deployment is more than 60 days old and who runs nothing", async () => {
      const { service, userId } = setup({ latestGpuDeploymentCreatedAt: subDays(NOW, 61) });

      await expect(service.check(userId, NOW)).resolves.toEqual({ outcome: "opened" });
    });

    it("checks again in 30 minutes rather than trust an indexer that trails the chain", async () => {
      const chainHeight = INDEXED_HEIGHT + MAX_INDEXER_LAG_IN_BLOCKS + 1;
      const { service, userId, jobQueueService, winBackRepository, logger } = setup({ chainHeight });

      const result = await service.check(userId, NOW);

      expect(result).toEqual({ outcome: "rescheduled", startAfter: addMinutes(NOW, 30) });
      expectRescheduled(jobQueueService, userId, addMinutes(NOW, 30));
      expect(winBackRepository.create).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith({ event: "GPU_WIN_BACK_INDEXER_LAGGING", userId, chainHeight, indexedHeight: INDEXED_HEIGHT });
    });

    it("trusts an indexer that trails the chain by no more than 10 minutes of blocks", async () => {
      const { service, userId } = setup({ chainHeight: INDEXED_HEIGHT + MAX_INDEXER_LAG_IN_BLOCKS });

      await expect(service.check(userId, NOW)).resolves.toEqual({ outcome: "opened" });
    });

    async function expectNothingOpened({ service, userId, winBackRepository, jobQueueService }: ReturnType<typeof setup>) {
      await expect(service.check(userId, NOW)).resolves.toEqual({ outcome: "ineligible" });
      expect(winBackRepository.create).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    }

    function expectRescheduled(jobQueueService: ReturnType<typeof setup>["jobQueueService"], userId: string, startAfter: Date) {
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new GpuWinBackCheck({ userId }), { singletonKey: `gpuWinBackCheck.${userId}`, startAfter });
    }
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: GpuWinBackService.name });
  });

  describe("scheduleCheck", () => {
    it("queues one check per person at the given time", async () => {
      const { service, jobQueueService } = setup();
      const startAfter = addDays(NOW, 7);

      await expect(service.scheduleCheck("user-1", startAfter)).resolves.toBe(true);

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new GpuWinBackCheck({ userId: "user-1" }), { singletonKey: "gpuWinBackCheck.user-1", startAfter });
    });

    it("answers false when a check of the person is already waiting", async () => {
      const { service, jobQueueService } = setup();
      jobQueueService.enqueue.mockResolvedValue(null);

      await expect(service.scheduleCheck("user-1", NOW)).resolves.toBe(false);
    });
  });

  describe("scheduleCheckAfterLease", () => {
    it("queues a check of the wallet's owner a week after a lease of their personal wallet was created", async () => {
      const { service, jobQueueService, userWalletRepository } = setup();
      const wallet = createUserWallet({ userId: "user-1" });
      userWalletRepository.findById.mockResolvedValue(wallet);

      await service.scheduleCheckAfterLease({ walletId: wallet.id, leaseCreatedAt: NOW });

      expect(userWalletRepository.findById).toHaveBeenCalledWith(wallet.id);
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new GpuWinBackCheck({ userId: "user-1" }), {
        singletonKey: "gpuWinBackCheck.user-1",
        startAfter: addDays(NOW, 7)
      });
    });

    it.each([
      { case: "a team wallet", wallet: { ...createUserWallet(), userId: null } },
      { case: "a wallet that is gone", wallet: undefined }
    ])("queues nothing for a lease of $case", async ({ wallet }) => {
      const { service, jobQueueService, userWalletRepository } = setup();
      userWalletRepository.findById.mockResolvedValue(wallet);

      await service.scheduleCheckAfterLease({ walletId: 7, leaseCreatedAt: NOW });

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });
  });

  function setup(
    input: {
      hasBonus?: boolean;
      hasWinBack?: boolean;
      hasLargePurchase?: boolean;
      hasPaid?: boolean;
      isTrialing?: boolean;
      trialStartedAt?: Date;
      latestGpuDeploymentCreatedAt?: Date | null;
      hasOpenDeployment?: boolean;
      chainHeight?: number;
    } = {}
  ) {
    const userId = faker.string.uuid();
    const user = createUser({ id: userId, createdAt: subDays(NOW, 90) });
    const wallet = createUserWallet({ userId, isTrialing: input.isTrialing ?? false, activatedAt: input.trialStartedAt ?? subDays(NOW, 90) });

    const stripeTransactionRepository = mock<StripeTransactionRepository>();
    stripeTransactionRepository.hasReceivedFirstPurchaseBonus.mockResolvedValue(input.hasBonus ?? false);
    stripeTransactionRepository.hasCompletedPaidTransactionOfAtLeast.mockResolvedValue(input.hasLargePurchase ?? false);
    stripeTransactionRepository.findEarliestCompletedPaidTransaction.mockResolvedValue(
      input.hasPaid === false ? undefined : { id: faker.string.uuid(), createdAt: subDays(NOW, 40), amount: 2000 }
    );

    const winBackRepository = mock<FirstPurchaseBonusWinBackRepository>();
    winBackRepository.findByUserId.mockResolvedValue(input.hasWinBack ? { userId, openedAt: subDays(NOW, 100), closesAt: subDays(NOW, 93) } : undefined);
    winBackRepository.create.mockResolvedValue(true);

    const userRepository = mock<UserRepository>();
    userRepository.findById.mockResolvedValue(user);
    userRepository.findOneByAndLock.mockResolvedValue(user);

    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.findOneByUserId.mockResolvedValue(wallet);

    const usageRepository = mock<UsageRepository>();
    usageRepository.resolveAddresses.mockImplementation(async address => [address]);

    const deploymentRepository = mock<DeploymentRepository>();
    deploymentRepository.findGpuDeploymentActivity.mockResolvedValue({
      latestGpuDeploymentCreatedAt: input.latestGpuDeploymentCreatedAt === undefined ? subDays(NOW, 10) : input.latestGpuDeploymentCreatedAt,
      hasOpenDeployment: input.hasOpenDeployment ?? false
    });

    const blockHttpService = mock<BlockHttpService>();
    blockHttpService.getCurrentHeight.mockResolvedValue(input.chainHeight ?? INDEXED_HEIGHT);
    const blockRepository = mock<BlockRepository>();
    blockRepository.getLatestProcessedHeight.mockResolvedValue(INDEXED_HEIGHT);

    const jobQueueService = mock<JobQueueService>();
    jobQueueService.enqueue.mockResolvedValue("job-1");
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => await cb());
    const billingConfig = mockConfigService<BillingConfigService>({ TRIAL_ALLOWANCE_EXPIRATION_DAYS: TRIAL_DAYS });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new GpuWinBackService(
      stripeTransactionRepository,
      winBackRepository,
      userRepository,
      userWalletRepository,
      usageRepository,
      deploymentRepository,
      blockHttpService,
      blockRepository,
      jobQueueService,
      txService,
      billingConfig,
      createLogger
    );

    return {
      createLogger,
      service,
      userId,
      wallet,
      stripeTransactionRepository,
      winBackRepository,
      userRepository,
      userWalletRepository,
      usageRepository,
      deploymentRepository,
      jobQueueService,
      txService,
      logger
    };
  }
});
