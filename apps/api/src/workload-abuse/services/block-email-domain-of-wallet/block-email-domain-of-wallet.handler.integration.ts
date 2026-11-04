import { AuthzHttpService, DeploymentHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { UserWalletRepository } from "@src/billing/repositories";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import { JOB_NAME } from "@src/core";
import { ABUSE_LOCK_REASON, BLOCKED_DOMAIN_LOCK_REASON } from "@src/workload-abuse/lib/abuse-lock-reason/abuse-lock-reason";
import { BlockedEmailDomainRepository } from "@src/workload-abuse/repositories/blocked-email-domain/blocked-email-domain.repository";
import { WorkloadAbuseDetectionRepository } from "@src/workload-abuse/repositories/workload-abuse-detection/workload-abuse-detection.repository";
import {
  LockBlockedDomainWallet,
  LockBlockedDomainWalletHandler,
  lockBlockedDomainWalletKeyFor
} from "@src/workload-abuse/services/lock-blocked-domain-wallet/lock-blocked-domain-wallet.handler";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { BlockEmailDomainOfWallet, BlockEmailDomainOfWalletHandler, blockEmailDomainOfWalletKeyFor } from "./block-email-domain-of-wallet.handler";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(BlockEmailDomainOfWalletHandler), container.resolve(LockBlockedDomainWalletHandler)]);

describe(BlockEmailDomainOfWalletHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps a fresh domain open and its other trials unlocked when one account on it is caught", async () => {
    const { domain, catchAccount, seedTrial, runDomainBlock, findDomain, findWallet, findSiblingLocks } = await setup();
    const caught = await catchAccount(`first@${domain}`);
    const sibling = await seedTrial(`colleague@${domain}`);

    await runDomainBlock(caught.wallet.id);

    expect(await findDomain()).toBeUndefined();
    expect(await findSiblingLocks(sibling.wallet.id)).toEqual([]);
    expect((await findWallet(sibling.wallet.id))?.abuseLockedAt).toBeNull();
  });

  it("blocks the domain and locks its other trials once a second account on it is caught", async () => {
    const { domain, catchAccount, seedTrial, runDomainBlock, findDomain, findWallet } = await setup();
    await catchAccount(`first@${domain}`);
    const sibling = await seedTrial(`colleague@${domain}`);
    const second = await catchAccount(`second@${domain}`);

    await runDomainBlock(second.wallet.id);

    expect(await findDomain()).toMatchObject({ status: "blocked", source: "auto", triggeredByUserId: second.user.id });
    await expectJobCompleted(LockBlockedDomainWallet[JOB_NAME], { singletonKey: lockBlockedDomainWalletKeyFor(sibling.wallet.id) });
    expect(await findWallet(sibling.wallet.id)).toMatchObject({ isTrialing: false, abuseLockedReason: BLOCKED_DOMAIN_LOCK_REASON });
  });

  it("does not count the same account twice when it is caught on another deployment", async () => {
    const { domain, catchAccount, seedTrial, runDomainBlock, findDomain, findSiblingLocks } = await setup();
    const caught = await catchAccount(`first@${domain}`);
    await caught.catchAgain();
    const sibling = await seedTrial(`colleague@${domain}`);

    await runDomainBlock(caught.wallet.id);

    expect(await findDomain()).toBeUndefined();
    expect(await findSiblingLocks(sibling.wallet.id)).toEqual([]);
  });

  it.each([
    { earlier: "the same mailbox under a plus tag", firstEmail: (domain: string) => `second+trial@${domain}` },
    { earlier: "the same mailbox in other casing", firstEmail: (domain: string) => `Second@${domain.toUpperCase()}` },
    { earlier: "a match that was never enforced", firstEmail: (domain: string) => `first@${domain}`, action: "detected" as const },
    { earlier: "repeated behaviour without a signature match", firstEmail: (domain: string) => `first@${domain}`, verdict: "behavioural" as const },
    { earlier: "an account on another domain", firstEmail: () => `first@${faker.string.alpha({ length: 12, casing: "lower" })}.test` }
  ])("keeps the domain open when the earlier catch is $earlier", async ({ firstEmail, verdict, action }) => {
    const { domain, catchAccount, seedTrial, runDomainBlock, findDomain, findSiblingLocks } = await setup();
    await catchAccount(firstEmail(domain), { verdict, action });
    const sibling = await seedTrial(`colleague@${domain}`);
    const second = await catchAccount(`second@${domain}`);

    await runDomainBlock(second.wallet.id);

    expect(await findDomain()).toBeUndefined();
    expect(await findSiblingLocks(sibling.wallet.id)).toEqual([]);
  });

  async function setup() {
    const { enqueue, startWorkers } = await jobWorkers();
    const userWalletRepository = container.resolve(UserWalletRepository);
    const detectionRepository = container.resolve(WorkloadAbuseDetectionRepository);
    const blockedEmailDomainRepository = container.resolve(BlockedEmailDomainRepository);
    const domain = `${faker.string.alpha({ length: 12, casing: "lower" })}.test`;

    const config = container.resolve(WorkloadAbuseConfigService);
    const readConfig = config.get.bind(config);
    vi.spyOn(config, "get").mockImplementation((key => (key === "WORKLOAD_ABUSE_DOMAIN_BLOCK_MODE" ? "enforce" : readConfig(key))) as typeof config.get);

    vi.spyOn(container.resolve(TxManagerService), "getFundingWalletAddress").mockResolvedValue(createAkashAddress());
    vi.spyOn(container.resolve(AuthzHttpService), "hasDepositDeploymentGrant").mockResolvedValue(true);
    vi.spyOn(container.resolve(AuthzHttpService), "hasFeeAllowance").mockResolvedValue(true);
    vi.spyOn(container.resolve(DeploymentHttpService), "findAll").mockResolvedValue({ deployments: [], pagination: { next_key: null, total: "0" } });
    vi.spyOn(container.resolve(ManagedSignerService), "executeFundingTx").mockResolvedValue(
      mock<Awaited<ReturnType<ManagedSignerService["executeFundingTx"]>>>()
    );

    async function catchAccount(email: string, detection: { verdict?: "hard" | "behavioural"; action?: "detected" | "enforced" } = {}) {
      const seeded = await seedUserWithWallet({
        user: { email },
        isTrialing: false,
        activatedAt: new Date(),
        abuseLockedAt: new Date(),
        abuseLockedReason: ABUSE_LOCK_REASON
      });

      const catchAgain = () =>
        detectionRepository.create({
          userId: seeded.user.id,
          walletId: seeded.wallet.id,
          dseq: faker.string.numeric(8),
          provider: createAkashAddress(),
          verdict: detection.verdict ?? "hard",
          probeStatus: "probed",
          signals: [],
          evidenceExcerpt: "",
          action: detection.action ?? "enforced"
        });

      await catchAgain();

      return { ...seeded, catchAgain };
    }

    async function seedTrial(email: string) {
      return await seedUserWithWallet({ user: { email }, isTrialing: true, activatedAt: new Date() });
    }

    async function runDomainBlock(walletId: number) {
      const singletonKey = blockEmailDomainOfWalletKeyFor(walletId);

      await enqueue(new BlockEmailDomainOfWallet({ walletId }), { singletonKey });
      await startWorkers();
      await expectJobCompleted(BlockEmailDomainOfWallet[JOB_NAME], { singletonKey });
    }

    return {
      domain,
      catchAccount,
      seedTrial,
      runDomainBlock,
      findDomain: () => blockedEmailDomainRepository.findByDomain(domain),
      findWallet: (walletId: number) => userWalletRepository.findById(walletId),
      findSiblingLocks: (walletId: number) => findJobRows(LockBlockedDomainWallet[JOB_NAME], { singletonKey: lockBlockedDomainWalletKeyFor(walletId) })
    };
  }
});
